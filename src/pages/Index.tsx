import { useState, useEffect, useRef } from 'react';
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

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const state: StoredState = JSON.parse(stored);
        if (state.paymentData?.expiresAt) {
          const expiresAt = new Date(state.paymentData.expiresAt);
          if (expiresAt < new Date()) {
            clearStoredState();
            return;
          }
        }
        if (state.step === 4 && state.finalData) {
          setStep(4);
          setSelectedPkg(state.selectedPkg);
          setFormData(state.formData);
          setFinalData(state.finalData);
        }
      } catch {
        clearStoredState();
      }
    }
  }, []);

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

  useEffect(() => {
    return () => { if (checkInterval.current) clearInterval(checkInterval.current); };
  }, []);

  const handlePackageSelect = (pkg: 'NORMAL' | 'VIP') => {
    setSelectedPkg(pkg);
    setStep(2);
    setErrorMsg('');
  };

  const generateRandomKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const randomStr = (length: number) => {
      let result = '';
      for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
      return result;
    };
    setFormData(prev => ({ ...prev, key: `AXSTOOLS-${randomStr(4)}-${randomStr(4)}` }));
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
    const calculatedAmount = pricePerDay * durationData.days;

    if (calculatedAmount < 1000) {
      setErrorMsg("Nominal terlalu kecil untuk QRIS (minimal Rp 1.000)");
      setLoading(false);
      return;
    }

    // Demo mode - simulate payment flow
    const transactionId = `TRX-${Date.now()}`;
    const newPaymentData = {
      transactionId,
      qr_string: 'DEMO-QRIS-' + transactionId,
      qris_url: `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=DEMO-${transactionId}`,
      totalAmount: calculatedAmount,
      expiresAt: new Date(Date.now() + 30 * 60000).toISOString()
    };

    setPaymentData(newPaymentData);
    setDaysToAdd(durationData.days);
    setStep(3);
    saveState(3, newPaymentData, null, durationData.days);
    setLoading(false);
    
    // Auto-complete after 5 seconds for demo
    setTimeout(() => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() + durationData.days);
      const newFinalData = {
        key: formData.key,
        package: selectedPkg || 'NORMAL',
        expired: expiredDate.toISOString(),
        expiredDisplay: expiredDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
        days: durationData.days
      };
      setFinalData(newFinalData);
      setStep(4);
      saveState(4, null, newFinalData, durationData.days);
    }, 5000);

    setStatusMsg("Menunggu pembayaran...");
  };

  const handleCancelOrder = () => {
    if (checkInterval.current) clearInterval(checkInterval.current);
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
  if (step === 2) return <OrderForm selectedPkg={selectedPkg} formData={formData} setFormData={setFormData} onSubmit={handleFormSubmit} onBack={() => { setStep(1); setErrorMsg(''); }} onGenerate={generateRandomKey} loading={loading} errorMsg={errorMsg} formatRupiah={formatRupiah} parseDuration={parseDuration} prices={PRICES} />;
  if (step === 3 && paymentData) return <PaymentQR paymentData={paymentData} statusMsg={statusMsg} errorMsg={errorMsg} onCancel={handleCancelOrder} onCopy={copyToClipboard} formatRupiah={formatRupiah} />;
  if (step === 4 && finalData) return <PaymentSuccess finalData={finalData} onCopy={copyToClipboard} />;
  return null;
};

export default Index;
