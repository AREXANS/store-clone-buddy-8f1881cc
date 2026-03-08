import { useState, useEffect, useRef, useCallback } from 'react';
import PackageSelection from '@/components/PackageSelection';
import OrderForm from '@/components/OrderForm';
import PaymentQR from '@/components/PaymentQR';
import PaymentSuccess from '@/components/PaymentSuccess';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Ad {
  id: string;
  title: string;
  media_url: string;
  media_type: string;
  link: string | null;
  link_url?: string | null;
  is_active: boolean;
}

interface Package {
  id: string;
  name: string;
  display_name: string;
  price_per_day: number;
  description: string | null;
  features: string[] | null;
  is_active: boolean;
}

interface PaymentData {
  transactionId: string;
  qr_string: string;
  qris_url: string;
  totalAmount: number;
  expiresAt: string;
}

interface FinalData {
  key: string;
  package: string;
  expired: string;
  expiredDisplay: string;
  days: number;
}

const STORAGE_KEY = 'arexans_payment_state';

interface StoredState {
  step: number;
  selectedPkg: 'NORMAL' | 'VIP' | null;
  formData: { key: string; duration: string };
  paymentData: PaymentData | null;
  finalData: FinalData | null;
  daysToAdd: number;
}

const Index = () => {
  const [step, setStep] = useState(1);
  const [selectedPkg, setSelectedPkg] = useState<'NORMAL' | 'VIP' | null>(null);
  const [formData, setFormData] = useState({ key: '', duration: '' });
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [finalData, setFinalData] = useState<FinalData | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [ads, setAds] = useState<Ad[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [daysToAdd, setDaysToAdd] = useState(0);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoCode, setPromoCode] = useState('');

  const checkInterval = useRef<number | null>(null);

  const PRICES = {
    NORMAL: packages.find(p => p.name === 'NORMAL')?.price_per_day ?? 2000,
    VIP: packages.find(p => p.name === 'VIP')?.price_per_day ?? 3000
  };

  const saveState = (newStep: number, newPaymentData?: PaymentData | null, newFinalData?: FinalData | null, newDays?: number) => {
    const state: StoredState = {
      step: newStep,
      selectedPkg,
      formData,
      paymentData: newPaymentData !== undefined ? newPaymentData : paymentData,
      finalData: newFinalData !== undefined ? newFinalData : finalData,
      daysToAdd: newDays !== undefined ? newDays : daysToAdd
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  };

  const clearStoredState = () => {
    localStorage.removeItem(STORAGE_KEY);
  };

  // Load stored state on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const state: StoredState = JSON.parse(stored);
        
        // Check if payment expired
        if (state.paymentData?.expiresAt) {
          const expiresAt = new Date(state.paymentData.expiresAt);
          if (expiresAt < new Date()) {
            clearStoredState();
            return;
          }
        }
        
        // Restore state based on step
        if (state.step === 4 && state.finalData) {
          setStep(4);
          setSelectedPkg(state.selectedPkg);
          setFormData(state.formData);
          setFinalData(state.finalData);
          setDaysToAdd(state.daysToAdd);
        } else if (state.step === 3 && state.paymentData) {
          setStep(3);
          setSelectedPkg(state.selectedPkg);
          setFormData(state.formData);
          setPaymentData(state.paymentData);
          setDaysToAdd(state.daysToAdd);
          setStatusMsg("Menunggu pembayaran...");
        }
      } catch {
        clearStoredState();
      }
    }
  }, []);

  // Load ads and packages
  useEffect(() => {
    const loadAds = async () => {
      const { data } = await supabase.from('ads').select('*').eq('is_active', true).order('sort_order');
      if (data) setAds(data as Ad[]);
    };

    const loadPackages = async () => {
      const { data } = await supabase.from('packages').select('*').eq('is_active', true).order('sort_order');
      if (data) setPackages(data as Package[]);
    };

    loadAds();
    loadPackages();
  }, []);

  const formatRupiah = (number: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
  };

  const parseDuration = (input: string) => {
    if (!input) return null;
    const match = input.toLowerCase().match(/^(\d+)([hb])$/);
    if (!match) return null;
    const value = parseInt(match[1]);
    const unit = match[2];
    const days = unit === 'h' ? value : value * 30;
    const label = unit === 'h' ? `${value} Hari` : `${value} Bulan`;
    return { days, text: label };
  };

  // Check payment status
  const checkPaymentStatus = useCallback(async (transactionId: string, days: number) => {
    try {
      const response = await supabase.functions.invoke('check-payment', {
        body: { transactionId }
      });

      if (response.error) {
        console.error('Check payment error:', response.error);
        return;
      }

      const data = response.data;

      if (data.expired) {
        if (checkInterval.current) clearInterval(checkInterval.current);
        setErrorMsg("Transaksi telah expired. Silakan buat pesanan baru.");
        setStatusMsg('');
        clearStoredState();
        return;
      }

      if (data.paid) {
        if (checkInterval.current) clearInterval(checkInterval.current);
        
        const expiredDate = new Date();
        expiredDate.setDate(expiredDate.getDate() + days);
        
        const newFinalData = {
          key: formData.key,
          package: selectedPkg || 'NORMAL',
          expired: expiredDate.toISOString(),
          expiredDisplay: expiredDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
          days: days
        };
        
        setFinalData(newFinalData);
        setStep(4);
        saveState(4, null, newFinalData, days);
        setStatusMsg('');
        
        toast({ 
          title: "Pembayaran Berhasil!", 
          description: "Terima kasih atas pembelian Anda." 
        });
      }
    } catch (error) {
      console.error('Check payment error:', error);
    }
  }, [formData.key, selectedPkg]);

  // Start payment status polling
  useEffect(() => {
    if (step === 3 && paymentData) {
      // Initial check
      checkPaymentStatus(paymentData.transactionId, daysToAdd);
      
      // Poll every 3 seconds
      checkInterval.current = window.setInterval(() => {
        checkPaymentStatus(paymentData.transactionId, daysToAdd);
      }, 3000);
    }

    return () => {
      if (checkInterval.current) {
        clearInterval(checkInterval.current);
        checkInterval.current = null;
      }
    };
  }, [step, paymentData, daysToAdd, checkPaymentStatus]);

  const handlePackageSelect = (pkg: 'NORMAL' | 'VIP') => {
    setSelectedPkg(pkg);
    setStep(2);
    setErrorMsg('');
  };

  const generateRandomKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'AXS-';
    for (let i = 0; i < 8; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    setFormData(prev => ({ ...prev, key: result }));
  };

  const handlePromoApplied = (discount: number, code: string) => {
    setPromoDiscount(discount);
    setPromoCode(code);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const durationData = parseDuration(formData.duration);

    if (!formData.key || formData.key.length < 4) {
      setErrorMsg(formData.key ? "Key minimal 4 karakter." : "Mohon isi key.");
      return;
    }
    if (!durationData) {
      setErrorMsg("Format durasi salah! Gunakan format: '1h' untuk 1 hari, '1b' untuk 1 bulan");
      return;
    }

    setLoading(true);
    const pricePerDay = selectedPkg === 'VIP' ? PRICES.VIP : PRICES.NORMAL;
    const calculatedAmount = Math.max(1000, pricePerDay * durationData.days - promoDiscount);

    if (calculatedAmount < 1000) {
      setErrorMsg("Nominal terlalu kecil untuk QRIS (minimal Rp 1.000)");
      setLoading(false);
      return;
    }

    try {
      // Call create-payment edge function
      const response = await supabase.functions.invoke('create-payment', {
        body: {
          amount: calculatedAmount,
          customerName: formData.key,
          packageName: selectedPkg || 'NORMAL',
          packageDuration: durationData.days,
          licenseKey: formData.key
        }
      });

      if (response.error) {
        console.error('Create payment error:', response.error);
        setErrorMsg("Gagal membuat pembayaran: " + (response.error.message || "Unknown error"));
        setLoading(false);
        return;
      }

      const data = response.data;

      if (!data.success) {
        setErrorMsg(data.error || "Gagal membuat pembayaran");
        setLoading(false);
        return;
      }

      const newPaymentData: PaymentData = {
        transactionId: data.transactionId,
        qr_string: data.qr_string,
        qris_url: data.qris_url,
        totalAmount: data.totalAmount,
        expiresAt: data.expiresAt
      };

      setPaymentData(newPaymentData);
      setDaysToAdd(durationData.days);
      setStep(3);
      saveState(3, newPaymentData, null, durationData.days);
      setStatusMsg("Menunggu pembayaran...");

    } catch (error) {
      console.error('Form submit error:', error);
      setErrorMsg("Terjadi kesalahan. Silakan coba lagi.");
    }

    setLoading(false);
  };

  const handleCancelOrder = async () => {
    if (checkInterval.current) clearInterval(checkInterval.current);
    
    // Cancel payment in backend
    if (paymentData?.transactionId) {
      try {
        await supabase.functions.invoke('cancel-payment', {
          body: { transactionId: paymentData.transactionId }
        });
      } catch (error) {
        console.error('Cancel payment error:', error);
      }
    }
    
    clearStoredState();
    setPaymentData(null);
    setStep(1);
    setStatusMsg('');
    setErrorMsg('');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Berhasil disalin!", description: "Teks telah disalin ke clipboard" });
  };

  if (step === 1) return <PackageSelection onSelect={handlePackageSelect} formatRupiah={formatRupiah} prices={PRICES} ads={ads} packages={packages} />;
  if (step === 2) return <OrderForm selectedPkg={selectedPkg} formData={formData} setFormData={setFormData} onSubmit={handleFormSubmit} onBack={() => { setStep(1); setErrorMsg(''); }} onGenerate={generateRandomKey} loading={loading} errorMsg={errorMsg} formatRupiah={formatRupiah} parseDuration={parseDuration} prices={PRICES} promoDiscount={promoDiscount} onPromoApplied={handlePromoApplied} />;
  if (step === 3 && paymentData) return <PaymentQR paymentData={paymentData} statusMsg={statusMsg} errorMsg={errorMsg} onCancel={handleCancelOrder} onCopy={copyToClipboard} formatRupiah={formatRupiah} />;
  if (step === 4 && finalData) return <PaymentSuccess finalData={finalData} onCopy={copyToClipboard} />;
  return null;
};

export default Index;
