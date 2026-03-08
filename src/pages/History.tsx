import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import GlobalBackground from '@/components/GlobalBackground';
import { ArrowLeft, Copy, Search, Package, Clock, CheckCircle, XCircle, Gift, Loader2 } from 'lucide-react';
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

const HISTORY_SESSION_KEY = 'arexans_history_phone';

const History = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searched, setSearched] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(HISTORY_SESSION_KEY);
    if (saved) {
      setPhone(saved);
      searchTransactions(saved);
    }
  }, []);

  const normalizePhone = (p: string) => {
    let clean = p.replace(/\D/g, '');
    if (clean.startsWith('0')) clean = '62' + clean.slice(1);
    if (!clean.startsWith('62')) clean = '62' + clean;
    return clean;
  };

  const searchTransactions = async (phoneNum?: string) => {
    const searchPhone = phoneNum || phone;
    if (!searchPhone.trim()) {
      toast({ title: 'Error', description: 'Masukkan nomor WhatsApp', variant: 'destructive' });
      return;
    }

    setIsSearching(true);
    setSearched(true);
    const normalized = normalizePhone(searchPhone);

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('customer_whatsapp', normalized)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions((data as Transaction[]) || []);
      localStorage.setItem(HISTORY_SESSION_KEY, searchPhone);
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Gagal mencari transaksi', variant: 'destructive' });
    } finally {
      setIsSearching(false);
    }
  };

  const handleClaim = async (transactionId: string) => {
    setClaimingId(transactionId);
    setClaimResult(null);

    try {
      const response = await supabase.functions.invoke('claim-key', {
        body: { transactionId }
      });

      if (response.error) throw response.error;
      const data = response.data;

      if (!data.success) {
        toast({ title: 'Gagal', description: data.error || 'Gagal klaim key', variant: 'destructive' });
        return;
      }

      setClaimResult({
        key: data.key,
        package: data.package,
        days: data.days,
        expired: data.expired,
        expiredDisplay: data.expiredDisplay
      });

      // Refresh transactions
      const normalized = normalizePhone(phone);
      const { data: refreshed } = await supabase
        .from('transactions')
        .select('*')
        .eq('customer_whatsapp', normalized)
        .order('created_at', { ascending: false });
      if (refreshed) setTransactions(refreshed as Transaction[]);

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

  const isClaimable = (status: string) => status === 'paid';

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <GlobalBackground />

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-4">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
            </Button>
            <h1 className="text-lg font-display font-bold">Riwayat Transaksi</h1>
          </div>

          {/* Search */}
          <Card className="glass-card border-primary/30">
            <CardContent className="pt-4 pb-4">
              <div className="flex gap-2">
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Nomor WhatsApp (08xxx)"
                  className="bg-background/50"
                  onKeyDown={(e) => e.key === 'Enter' && searchTransactions()}
                />
                <Button onClick={() => searchTransactions()} disabled={isSearching}>
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Claim Result */}
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

          {/* Transaction List */}
          {searched && (
            <div className="space-y-3">
              {transactions.length === 0 ? (
                <Card className="glass-card">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>Tidak ada transaksi ditemukan</p>
                  </CardContent>
                </Card>
              ) : (
                transactions.map((tx) => (
                  <Card key={tx.id} className="glass-card border-border/50">
                    <CardContent className="pt-4 pb-3 space-y-3">
                      {/* Top row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-primary" />
                          <span className="font-medium text-sm">{tx.package_name}</span>
                          <span className="text-xs text-muted-foreground">• {tx.package_duration}d</span>
                        </div>
                        {getStatusBadge(tx.status)}
                      </div>

                      {/* Transaction ID */}
                      <div className="flex items-center gap-2 bg-muted/20 p-2 rounded text-xs">
                        <span className="text-muted-foreground">ID:</span>
                        <code className="flex-1 font-mono truncate">{tx.transaction_id}</code>
                        <button onClick={() => copyText(tx.transaction_id, 'ID Transaksi')} className="text-muted-foreground hover:text-primary">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Key (if exists) */}
                      {tx.license_key && (
                        <div className="flex items-center gap-2 bg-muted/20 p-2 rounded text-xs">
                          <span className="text-muted-foreground">Key:</span>
                          <code className="flex-1 font-mono truncate">{tx.license_key}</code>
                          <button onClick={() => copyText(tx.license_key!, 'Key')} className="text-muted-foreground hover:text-primary">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Detail toggle */}
                      {detailId === tx.id ? (
                        <div className="bg-muted/10 p-3 rounded space-y-1 text-xs">
                          <div className="flex justify-between"><span className="text-muted-foreground">Harga Asli</span><span>{formatRupiah(tx.original_amount)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Total Bayar</span><span className="font-medium">{formatRupiah(tx.total_amount)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Tanggal</span><span>{formatDate(tx.created_at)}</span></div>
                          {tx.paid_at && <div className="flex justify-between"><span className="text-muted-foreground">Dibayar</span><span>{formatDate(tx.paid_at)}</span></div>}
                          <button onClick={() => setDetailId(null)} className="text-primary text-xs mt-2 hover:underline w-full text-center">Tutup detail</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{formatDate(tx.created_at)}</span>
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-foreground">{formatRupiah(tx.total_amount)}</span>
                            <button onClick={() => setDetailId(tx.id)} className="text-primary hover:underline">Detail</button>
                          </div>
                        </div>
                      )}

                      {/* Claim button */}
                      {isClaimable(tx.status) && (
                        <Button
                          className="w-full"
                          size="sm"
                          onClick={() => handleClaim(tx.transaction_id)}
                          disabled={claimingId === tx.transaction_id}
                        >
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
          )}
        </div>
      </div>
    </div>
  );
};

export default History;
