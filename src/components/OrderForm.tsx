import { FC } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KeyRound } from 'lucide-react';
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
}

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
  prices
}) => {
  const durationData = parseDuration(formData.duration);
  const pricePerDay = selectedPkg === 'VIP' ? prices.VIP : prices.NORMAL;
  const estimatedTotal = durationData ? pricePerDay * durationData.days : 0;

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
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">
              Kunci Rahasia
            </label>
            <div className="flex gap-2">
              <Input
                type="text"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                placeholder="Masukkan key unik kamu"
                className="flex-1 bg-muted/50 border-border focus:border-primary"
              />
              <Button
                type="button"
                variant="outline"
                onClick={onGenerate}
                className="shrink-0 border-border hover:bg-muted gap-2"
              >
                <KeyRound className="w-4 h-4" />
                Generate
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Gunakan key unik yang mudah diingat
            </p>
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
              <div className="border-t border-border pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="font-semibold text-foreground">Total:</span>
                  <span className={`font-bold ${selectedPkg === 'VIP' ? 'text-secondary' : 'text-primary'}`}>
                    {formatRupiah(estimatedTotal)}
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
