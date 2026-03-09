import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import GlobalBackground from '@/components/GlobalBackground';
import { ArrowLeft, Copy, Package, Clock, CheckCircle, XCircle, Gift, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Transaction {
  id: string;
  transaction_id: string;
  customer_name: string;
  customer_whatsapp: string | null;
  package_name: string;
  package_duration: number;
  original_amount: number;
  total_amount: number;
  status: string;
  license_key: string | null;
  paid_at: string | null;
  created_at: string;
}

interface ClaimResult {
  key: string;
  package: string;
  days: number;
  expired: string;
  expiredDisplay: string;
}

const getDeviceId = (): string => {
  let id = localStorage.getItem('arexans_device_id');
  if (!id) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) { ctx.textBaseline = 'top'; ctx.font = '14px Arial'; ctx.fillText('fp', 2, 2); }
    const fp = [navigator.userAgent, navigator.language, screen.width + 'x' + screen.height, new Date().getTimezoneOffset(), canvas.toDataURL()].join('|');
    let hash = 0;
    for (let i = 0; i < fp.length; i++) { hash = ((hash << 5) - hash) + fp.charCodeAt(i); hash = hash & hash; }
    id = 'USR-' + Math.abs(hash).toString(36).toUpperCase();
    localStorage.setItem('arexans_device_id', id);
  }
  return id;
};

const History = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const deviceId = getDeviceId();

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase
        .from('transactions')
        .select('*') as any)
        .eq('device_id', deviceId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions((data as Transaction[]) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (transactionId: string) => {
    setClaimingId(transactionId);
    setClaimResult(null);
    try {
      const response = await supabase.functions.invoke('claim-key', { body: { transactionId } });
      if (response.error) throw response.error;
      const data = response.data;
      if (!data.success) {
        toast({ title: 'Gagal', description: data.error || 'Gagal klaim key', variant: 'destructive' });
        return;
      }
      setClaimResult({ key: data.key, package: data.package, days: data.days, expired: data.expired, expiredDisplay: data.expiredDisplay });
      loadTransactions();
      toast({ title: 'Berhasil!', description: 'Key berhasil diklaim!' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Gagal klaim key', variant: 'destructive' });
    } finally {
      setClaimingId(null);
    }
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Disalin!', description: `${label} berhasil disalin` });
  };

  const formatRupiah = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
            <CheckCircle className="w-3 h-3" /> Klaim
          </span>
        );
      case 'claimed':
        return (
          <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-secondary/20 text-secondary border border-secondary/30">
            <Gift className="w-3 h-3" /> Diklaim
          </span>
        );
      case 'pending':
        return (
          <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case 'expired':
        return (
          <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-destructive/20 text-destructive border border-destructive/30">
            <XCircle className="w-3 h-3" /> Expired
          </span>
        );
      default:
        return (
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-muted text-muted-foreground">{status}</span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <GlobalBackground />
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
            </Button>
            <h1 className="text-lg font-display font-bold">Riwayat Transaksi</h1>
          </div>

          {claimResult && (
            <Card className="glass-card border-green-500/50 bg-green-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-green-400 text-base flex items-center gap-2">
                  <Gift className="w-5 h-5" /> Key Berhasil Diklaim!
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 bg-muted/30 p-3 rounded-lg">
                  <code className="flex-1 font-mono text-sm text-green-300 truncate">{claimResult.key}</code>
                  <Button variant="ghost" size="sm" onClick={() => copyText(claimResult.key, 'Key')}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-muted/20 p-2 rounded">
                    <span className="text-muted-foreground text-xs">Paket</span>
                    <p className="font-medium">{claimResult.package}</p>
                  </div>
                  <div className="bg-muted/20 p-2 rounded">
                    <span className="text-muted-foreground text-xs">Durasi</span>
                    <p className="font-medium">{claimResult.days} hari</p>
                  </div>
                  <div className="col-span-2 bg-muted/20 p-2 rounded">
                    <span className="text-muted-foreground text-xs">Berlaku hingga</span>
                    <p className="font-medium">{claimResult.expiredDisplay}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={() => setClaimResult(null)}>Tutup</Button>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {loading ? (
              <Card className="glass-card">
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin opacity-50" />
                  <p>Memuat riwayat...</p>
                </CardContent>
              </Card>
            ) : transactions.length === 0 ? (
              <Card className="glass-card">
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>Belum ada transaksi</p>
                  <p className="text-xs mt-1">Transaksi yang kamu buat akan muncul di sini</p>
                </CardContent>
              </Card>
            ) : (
              transactions.map((tx) => (
                <Card key={tx.id} className="glass-card border-border/50">
                  <CardContent className="pt-3 pb-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-primary" />
                        <span className="font-medium text-sm">{tx.package_name}</span>
                        <span className="text-xs text-muted-foreground">• {tx.package_duration}d</span>
                      </div>
                      {getStatusBadge(tx.status)}
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatDate(tx.created_at)}</span>
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-foreground">{formatRupiah(tx.total_amount)}</span>
                        <button
                          onClick={() => copyText(tx.transaction_id, 'ID Transaksi')}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                          title="Salin ID Transaksi"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {tx.license_key && (
                          <button
                            onClick={() => copyText(tx.license_key!, 'Key')}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                            title="Salin Key"
                          >
                            <span className="font-mono text-[10px]">KEY</span>
                          </button>
                        )}
                        <button
                          onClick={() => setDetailId(detailId === tx.id ? null : tx.id)}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                          title="Detail"
                        >
                          <Clock className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {detailId === tx.id && (
                      <div className="bg-muted/10 p-3 rounded space-y-1 text-xs animate-in fade-in">
                        <div className="flex justify-between"><span className="text-muted-foreground">ID</span><code className="font-mono truncate max-w-[180px]">{tx.transaction_id}</code></div>
                        {tx.license_key && <div className="flex justify-between"><span className="text-muted-foreground">Key</span><code className="font-mono">{'•'.repeat(12)}</code></div>}
                        <div className="flex justify-between"><span className="text-muted-foreground">Harga Asli</span><span>{formatRupiah(tx.original_amount)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Total Bayar</span><span className="font-medium">{formatRupiah(tx.total_amount)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Tanggal</span><span>{formatDate(tx.created_at)}</span></div>
                        {tx.paid_at && <div className="flex justify-between"><span className="text-muted-foreground">Dibayar</span><span>{formatDate(tx.paid_at)}</span></div>}
                      </div>
                    )}

                    {tx.status === 'paid' && (
                      <Button className="w-full" size="sm" onClick={() => handleClaim(tx.transaction_id)} disabled={claimingId === tx.transaction_id}>
                        {claimingId === tx.transaction_id ? (
                          <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Mengklaim...</>
                        ) : (
                          <><Gift className="w-4 h-4 mr-2" /> Klaim Key</>
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default History;
