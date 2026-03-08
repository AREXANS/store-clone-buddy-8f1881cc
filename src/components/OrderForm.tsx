import { FC, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KeyRound, Shuffle, Edit3, Tag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import GlobalBackground from './GlobalBackground';

interface OrderFormProps {
  selectedPkg: 'NORMAL' | 'VIP' | null;
  formData: { key: string; duration: string };
  setFormData: (data: { key: string; duration: string }) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  onGenerate: () => void;
  loading: boolean;
  errorMsg: string;
  formatRupiah: (n: number) => string;
  parseDuration: (input: string) => { days: number; text: string } | null;
  prices: { NORMAL: number; VIP: number };
  promoDiscount?: number;
  onPromoApplied?: (discount: number, code: string) => void;
}

const generateRandomKey = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'AXS-';
  for (let i = 0; i < 8; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
};

const OrderForm: FC<OrderFormProps> = ({
  selectedPkg,
  formData,
  setFormData,
  onSubmit,
  onBack,
  onGenerate,
  loading,
  errorMsg,
  formatRupiah,
  parseDuration,
  prices,
  promoDiscount = 0,
  onPromoApplied
}) => {
  const [keyMode, setKeyMode] = useState<'random' | 'custom'>('random');
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState('');

  // Auto-generate random key on mount and when switching to random
  useEffect(() => {
    if (keyMode === 'random' && (!formData.key || !formData.key.startsWith('AXS-'))) {
      setFormData({ ...formData, key: generateRandomKey() });
    }
  }, [keyMode]);

  // Generate on first mount
  useEffect(() => {
    if (!formData.key) {
      setFormData({ ...formData, key: generateRandomKey() });
    }
  }, []);

  const handleKeyModeChange = (mode: string) => {
    setKeyMode(mode as 'random' | 'custom');
    if (mode === 'random') {
      setFormData({ ...formData, key: generateRandomKey() });
    } else {
      setFormData({ ...formData, key: '' });
    }
  };

  const regenerateKey = () => {
    setFormData({ ...formData, key: generateRandomKey() });
  };

  const durationData = parseDuration(formData.duration);
  const pricePerDay = selectedPkg === 'VIP' ? prices.VIP : prices.NORMAL;
  const estimatedTotal = durationData ? pricePerDay * durationData.days : 0;
  const discountAmount = promoDiscount;
  const finalTotal = Math.max(0, estimatedTotal - discountAmount);

  const applyPromo = async () => {
    if (!promoCode.trim()) return;
    if (!estimatedTotal) {
      toast({ title: "Error", description: "Isi durasi terlebih dahulu", variant: "destructive" });
      return;
    }
    setPromoLoading(true);
    const { data, error } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('code', promoCode.toUpperCase())
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) {
      toast({ title: "Error", description: "Kode promo tidak valid", variant: "destructive" });
      setPromoLoading(false);
      return;
    }

    const promo = data as any;
    const now = new Date();
    if (promo.expires_at && new Date(promo.expires_at) < now) {
      toast({ title: "Error", description: "Kode promo sudah expired", variant: "destructive" });
      setPromoLoading(false);
      return;
    }
    if (promo.max_uses && promo.used_count >= promo.max_uses) {
      toast({ title: "Error", description: "Kode promo sudah habis", variant: "destructive" });
      setPromoLoading(false);
      return;
    }
    if (estimatedTotal < promo.min_amount) {
      toast({ title: "Error", description: `Minimal pembelian ${formatRupiah(promo.min_amount)}`, variant: "destructive" });
      setPromoLoading(false);
      return;
    }

    let discount = 0;
    if (promo.discount_type === 'percentage') {
      discount = Math.floor(estimatedTotal * promo.discount_value / 100);
    } else {
      discount = promo.discount_value;
    }

    setAppliedPromo(promo.code);
    onPromoApplied?.(discount, promo.code);
    toast({ title: "Promo Diterapkan!", description: `Diskon ${promo.discount_type === 'percentage' ? promo.discount_value + '%' : formatRupiah(promo.discount_value)}` });
    setPromoLoading(false);
  };

  const removePromo = () => {
    setAppliedPromo('');
    setPromoCode('');
    onPromoApplied?.(0, '');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      <GlobalBackground />

      <div className="glass-card p-8 rounded-2xl max-w-md w-full relative shadow-2xl z-10">
        <button
          onClick={onBack}
          className="absolute top-6 left-6 text-muted-foreground hover:text-foreground transition-colors duration-200 flex items-center gap-2 font-medium"
        >
          <span>←</span> Kembali
        </button>

        <div className="text-center mb-8 pt-8">
          <div className={`inline-block px-4 py-2 rounded-full text-sm font-bold mb-4 ${
            selectedPkg === 'VIP'
              ? 'bg-secondary/10 text-secondary'
              : 'bg-primary/10 text-primary'
          }`}>
            Paket {selectedPkg}
          </div>
          <h2 className="text-2xl font-display font-bold text-foreground">
            Isi Data Pembelian
          </h2>
        </div>

        {errorMsg && (
          <div className="bg-destructive/10 border border-destructive/50 text-destructive p-4 rounded-xl mb-6 text-sm animate-slide-in">
            {errorMsg}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Key mode tabs */}
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">
              Kunci Rahasia
            </label>
            <Tabs value={keyMode} onValueChange={handleKeyModeChange} className="w-full">
              <TabsList className="w-full mb-3">
                <TabsTrigger value="random" className="flex-1 gap-1.5 text-xs">
                  <Shuffle className="w-3.5 h-3.5" />
                  Random Key
                </TabsTrigger>
                <TabsTrigger value="custom" className="flex-1 gap-1.5 text-xs">
                  <Edit3 className="w-3.5 h-3.5" />
                  Custom Key
                </TabsTrigger>
              </TabsList>
              <TabsContent value="random" className="mt-0">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={formData.key}
                    readOnly
                    className="flex-1 bg-muted/50 border-border font-mono text-sm"
                  />
                  <Button type="button" variant="outline" onClick={regenerateKey} className="shrink-0 gap-1.5">
                    <Shuffle className="w-4 h-4" />
                    Acak
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Key otomatis format AXS-XXXXXXXX</p>
              </TabsContent>
              <TabsContent value="custom" className="mt-0">
                <Input
                  type="text"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  placeholder="Masukkan key unik kamu"
                  className="bg-muted/50 border-border focus:border-primary"
                />
                <p className="text-xs text-muted-foreground mt-2">Gunakan key unik yang mudah diingat (min 4 karakter)</p>
              </TabsContent>
            </Tabs>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">
              Durasi
            </label>
            <Input
              type="text"
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
              placeholder="Contoh: 7h (hari) atau 1b (bulan)"
              className="bg-muted/50 border-border focus:border-primary"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Format: angka + h (hari) atau b (bulan). Contoh: 30h, 1b
            </p>
          </div>

          {/* Promo code */}
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" />
              Kode Promo (opsional)
            </label>
            {appliedPromo ? (
              <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-xl p-3">
                <Tag className="w-4 h-4 text-primary" />
                <span className="font-mono font-bold text-primary text-sm">{appliedPromo}</span>
                <span className="text-xs text-muted-foreground">diterapkan</span>
                <Button type="button" variant="ghost" size="sm" onClick={removePromo} className="ml-auto text-xs h-7">Hapus</Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="Masukkan kode promo"
                  className="flex-1 bg-muted/50 border-border font-mono text-sm"
                />
                <Button type="button" variant="outline" onClick={applyPromo} disabled={promoLoading} className="shrink-0">
                  {promoLoading ? '...' : 'Pakai'}
                </Button>
              </div>
            )}
          </div>

          {durationData && (
            <div className="bg-muted/50 p-4 rounded-xl border border-border animate-slide-in">
              <div className="flex justify-between mb-2">
                <span className="text-muted-foreground">Durasi:</span>
                <span className="font-medium text-foreground">{durationData.text}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-muted-foreground">Harga/hari:</span>
                <span className="font-medium text-foreground">{formatRupiah(pricePerDay)}</span>
              </div>
              {discountAmount > 0 && (
                <>
                  <div className="flex justify-between mb-2">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-medium text-foreground">{formatRupiah(estimatedTotal)}</span>
                  </div>
                  <div className="flex justify-between mb-2 text-green-500">
                    <span>Diskon Promo:</span>
                    <span className="font-medium">-{formatRupiah(discountAmount)}</span>
                  </div>
                </>
              )}
              <div className="border-t border-border pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="font-semibold text-foreground">Total:</span>
                  <span className={`font-bold ${selectedPkg === 'VIP' ? 'text-secondary' : 'text-primary'}`}>
                    {formatRupiah(discountAmount > 0 ? finalTotal : estimatedTotal)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className={`w-full py-6 font-display font-bold text-lg ${
              selectedPkg === 'VIP' ? 'btn-secondary' : 'btn-primary'
            }`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⟳</span> Memproses...
              </span>
            ) : (
              'Lanjut ke Pembayaran'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default OrderForm;
