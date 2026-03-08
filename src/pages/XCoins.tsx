import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import GlobalBackground from '@/components/GlobalBackground';
import { 
  Coins, Send, ArrowUpCircle, ArrowDownCircle, Trophy, History, 
  LogOut, ArrowLeft, Wallet, RefreshCw, Eye, EyeOff, Copy, ChevronRight
} from 'lucide-react';

const XCOINS_SESSION_KEY = 'xcoins_session';

interface XCoinsUser {
  id: string;
  phone: string;
  display_name: string;
  balance: number;
}

interface XCoinsTransaction {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  description: string;
  reference_id: string;
  created_at: string;
}

interface LeaderboardEntry {
  rank: number;
  display_name: string;
  phone: string;
  balance: number;
  isMe: boolean;
}

const XCoinsPage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<XCoinsUser | null>(null);
  const [authStep, setAuthStep] = useState<'login' | 'register' | 'otp'>('login');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [otp, setOtp] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [cleanedPhone, setCleanedPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [showBalance, setShowBalance] = useState(true);

  // Dashboard state
  const [transactions, setTransactions] = useState<XCoinsTransaction[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Top-up state
  const [topupAmount, setTopupAmount] = useState('');
  const [topupPayment, setTopupPayment] = useState<{transactionId: string; qris_url: string; totalAmount: number; expiresAt: string} | null>(null);
  const topupInterval = useRef<number | null>(null);

  // Transfer state
  const [transferPhone, setTransferPhone] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferPin, setTransferPin] = useState('');

  // Restore session
  useEffect(() => {
    const stored = localStorage.getItem(XCOINS_SESSION_KEY);
    if (stored) {
      try {
        const u = JSON.parse(stored);
        setUser(u);
      } catch { localStorage.removeItem(XCOINS_SESSION_KEY); }
    }
  }, []);

  // Load data when user is set
  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user?.id]);

  const loadDashboardData = async () => {
    if (!user) return;
    const res = await supabase.functions.invoke('xcoins-balance', { body: { userId: user.id } });
    if (res.data?.success) {
      setUser(prev => prev ? { ...prev, balance: res.data.user.balance } : null);
      setTransactions(res.data.transactions);
      setLeaderboard(res.data.leaderboard);
      localStorage.setItem(XCOINS_SESSION_KEY, JSON.stringify({ ...user, balance: res.data.user.balance }));
    }
  };

  const handleLogin = async () => {
    if (!phone || !pin) { toast({ title: 'Error', description: 'Isi nomor WA dan PIN', variant: 'destructive' }); return; }
    setLoading(true);
    const res = await supabase.functions.invoke('xcoins-login', { body: { phone, pin } });
    if (res.data?.success) {
      setUser(res.data.user);
      localStorage.setItem(XCOINS_SESSION_KEY, JSON.stringify(res.data.user));
      toast({ title: 'Login berhasil!' });
    } else if (res.data?.notFound) {
      toast({ title: 'Akun tidak ditemukan', description: 'Silakan daftar terlebih dahulu', variant: 'destructive' });
    } else {
      toast({ title: 'Error', description: res.data?.error || 'Gagal login', variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleSendOtp = async () => {
    if (!phone) { toast({ title: 'Error', description: 'Isi nomor WhatsApp', variant: 'destructive' }); return; }
    setLoading(true);
    const res = await supabase.functions.invoke('xcoins-send-otp', { body: { phone } });
    if (res.data?.success) {
      setCleanedPhone(res.data.phone);
      setAuthStep('otp');
      toast({ title: 'OTP Terkirim!', description: 'Cek WhatsApp Anda' });
    } else if (res.data?.exists) {
      toast({ title: 'Sudah terdaftar', description: 'Silakan login dengan PIN', variant: 'destructive' });
      setAuthStep('login');
    } else {
      toast({ title: 'Error', description: res.data?.error || 'Gagal kirim OTP', variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleRegister = async () => {
    if (!otp || !pin || pin.length !== 6) {
      toast({ title: 'Error', description: 'OTP dan PIN 6 digit wajib diisi', variant: 'destructive' }); return;
    }
    setLoading(true);
    const res = await supabase.functions.invoke('xcoins-register', { body: { phone: cleanedPhone, otp, pin, displayName } });
    if (res.data?.success) {
      setUser(res.data.user);
      localStorage.setItem(XCOINS_SESSION_KEY, JSON.stringify(res.data.user));
      toast({ title: 'Registrasi berhasil!' });
    } else {
      toast({ title: 'Error', description: res.data?.error || 'Gagal registrasi', variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem(XCOINS_SESSION_KEY);
    setUser(null);
    setPhone(''); setPin(''); setOtp('');
    setAuthStep('login');
  };

  // Top-up
  const handleTopup = async () => {
    const amt = parseInt(topupAmount);
    if (!amt || amt < 1000) { toast({ title: 'Error', description: 'Minimal top-up Rp 1.000', variant: 'destructive' }); return; }
    setLoading(true);
    const res = await supabase.functions.invoke('xcoins-topup', { body: { userId: user!.id, amount: amt } });
    if (res.data?.success) {
      setTopupPayment(res.data);
      startTopupPolling(res.data.transactionId);
    } else {
      toast({ title: 'Error', description: res.data?.error || 'Gagal membuat top-up', variant: 'destructive' });
    }
    setLoading(false);
  };

  const startTopupPolling = (txId: string) => {
    if (topupInterval.current) clearInterval(topupInterval.current);
    topupInterval.current = window.setInterval(async () => {
      const res = await supabase.functions.invoke('xcoins-check-topup', { body: { transactionId: txId, userId: user!.id } });
      if (res.data?.paid) {
        if (topupInterval.current) clearInterval(topupInterval.current);
        setTopupPayment(null);
        setTopupAmount('');
        setUser(prev => prev ? { ...prev, balance: res.data.balance } : null);
        localStorage.setItem(XCOINS_SESSION_KEY, JSON.stringify({ ...user, balance: res.data.balance }));
        toast({ title: '🎉 Top-up Berhasil!', description: `+${res.data.added} XCoins telah ditambahkan` });
        loadDashboardData();
      } else if (res.data?.expired) {
        if (topupInterval.current) clearInterval(topupInterval.current);
        setTopupPayment(null);
        toast({ title: 'Expired', description: 'Pembayaran telah kadaluarsa', variant: 'destructive' });
      }
    }, 3000);
  };

  useEffect(() => { return () => { if (topupInterval.current) clearInterval(topupInterval.current); }; }, []);

  // Transfer
  const handleTransfer = async () => {
    const amt = parseInt(transferAmount);
    if (!transferPhone || !amt || !transferPin) {
      toast({ title: 'Error', description: 'Isi semua field', variant: 'destructive' }); return;
    }
    setLoading(true);
    const res = await supabase.functions.invoke('xcoins-transfer', { body: { senderId: user!.id, recipientPhone: transferPhone, amount: amt, pin: transferPin } });
    if (res.data?.success) {
      toast({ title: '✅ Transfer Berhasil!', description: `${amt} XCoins ke ${res.data.recipient.display_name}` });
      setUser(prev => prev ? { ...prev, balance: res.data.newBalance } : null);
      setTransferPhone(''); setTransferAmount(''); setTransferPin('');
      loadDashboardData();
    } else {
      toast({ title: 'Error', description: res.data?.error || 'Gagal transfer', variant: 'destructive' });
    }
    setLoading(false);
  };

  const formatRp = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
  const formatCoins = (n: number) => new Intl.NumberFormat('id-ID').format(n);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'topup': return <ArrowDownCircle className="w-5 h-5 text-green-400" />;
      case 'purchase': return <ArrowUpCircle className="w-5 h-5 text-red-400" />;
      case 'transfer_out': return <Send className="w-5 h-5 text-orange-400" />;
      case 'transfer_in': return <ArrowDownCircle className="w-5 h-5 text-blue-400" />;
      default: return <Coins className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'topup': return 'Top Up';
      case 'purchase': return 'Pembelian';
      case 'transfer_out': return 'Transfer Keluar';
      case 'transfer_in': return 'Transfer Masuk';
      default: return type;
    }
  };

  // Auth screens
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
        <GlobalBackground />
        <Card className="w-full max-w-md z-10 glass-card">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Coins className="w-8 h-8 text-primary animate-glow" />
              <CardTitle className="font-display text-2xl gradient-text">XCoins</CardTitle>
            </div>
            <CardDescription>
              {authStep === 'login' ? 'Masuk dengan nomor WhatsApp & PIN' : 
               authStep === 'register' ? 'Daftar akun baru' : 'Verifikasi OTP'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {authStep === 'login' && (
              <>
                <div>
                  <label className="text-sm text-muted-foreground">Nomor WhatsApp</label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" className="bg-background/50 mt-1" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">PIN (6 digit)</label>
                  <Input type="password" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••••" className="bg-background/50 mt-1 text-center tracking-[0.5em] font-mono text-lg" />
                </div>
                <Button className="w-full" onClick={handleLogin} disabled={loading}>
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Coins className="w-4 h-4 mr-2" />}
                  Login
                </Button>
                <div className="text-center">
                  <button className="text-sm text-primary hover:underline" onClick={() => { setAuthStep('register'); setPin(''); }}>
                    Belum punya akun? Daftar
                  </button>
                </div>
              </>
            )}

            {authStep === 'register' && (
              <>
                <div>
                  <label className="text-sm text-muted-foreground">Nomor WhatsApp</label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" className="bg-background/50 mt-1" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Nama Tampilan (opsional)</label>
                  <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Nama kamu" className="bg-background/50 mt-1" />
                </div>
                <Button className="w-full" onClick={handleSendOtp} disabled={loading}>
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Kirim OTP ke WhatsApp
                </Button>
                <div className="text-center">
                  <button className="text-sm text-primary hover:underline" onClick={() => setAuthStep('login')}>
                    Sudah punya akun? Login
                  </button>
                </div>
              </>
            )}

            {authStep === 'otp' && (
              <>
                <p className="text-sm text-muted-foreground text-center">OTP telah dikirim ke <span className="text-foreground font-mono">{cleanedPhone}</span></p>
                <div>
                  <label className="text-sm text-muted-foreground">Kode OTP</label>
                  <Input maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="123456" className="bg-background/50 mt-1 text-center tracking-[0.5em] font-mono text-lg" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Buat PIN (6 digit)</label>
                  <Input type="password" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••••" className="bg-background/50 mt-1 text-center tracking-[0.5em] font-mono text-lg" />
                </div>
                <Button className="w-full" onClick={handleRegister} disabled={loading}>
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Coins className="w-4 h-4 mr-2" />}
                  Verifikasi & Daftar
                </Button>
                <div className="text-center">
                  <button className="text-sm text-muted-foreground hover:underline" onClick={() => setAuthStep('register')}>
                    Kirim ulang OTP
                  </button>
                </div>
              </>
            )}

            <Button variant="ghost" className="w-full" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Toko
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Dashboard
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <GlobalBackground />
      <div className="relative z-10 p-4 max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate('/')} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-primary" />
            <span className="font-display text-lg gradient-text">XCoins</span>
          </div>
          <button onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* Balance Card */}
        <Card className="glass-card mb-4 glow-cyan overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Saldo XCoins</span>
              <button onClick={() => setShowBalance(!showBalance)}>
                {showBalance ? <Eye className="w-4 h-4 text-muted-foreground" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
              </button>
            </div>
            <div className="flex items-baseline gap-2">
              <Coins className="w-6 h-6 text-primary" />
              <span className="text-3xl font-display font-bold text-foreground">
                {showBalance ? formatCoins(user.balance) : '•••••'}
              </span>
              <span className="text-sm text-muted-foreground">XCoins</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {user.display_name} • {user.phone}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              <button onClick={() => setActiveTab('topup')} className="flex flex-col items-center gap-1 p-3 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors">
                <Wallet className="w-5 h-5 text-primary" />
                <span className="text-xs text-foreground">Top Up</span>
              </button>
              <button onClick={() => setActiveTab('transfer')} className="flex flex-col items-center gap-1 p-3 rounded-lg bg-secondary/10 hover:bg-secondary/20 transition-colors">
                <Send className="w-5 h-5 text-secondary" />
                <span className="text-xs text-foreground">Transfer</span>
              </button>
              <button onClick={() => setActiveTab('leaderboard')} className="flex flex-col items-center gap-1 p-3 rounded-lg bg-warning/10 hover:bg-warning/20 transition-colors">
                <Trophy className="w-5 h-5 text-warning" />
                <span className="text-xs text-foreground">Ranking</span>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full bg-muted/50">
            <TabsTrigger value="dashboard" className="flex-1 text-xs"><History className="w-4 h-4 mr-1" />Riwayat</TabsTrigger>
            <TabsTrigger value="topup" className="flex-1 text-xs"><Wallet className="w-4 h-4 mr-1" />Top Up</TabsTrigger>
            <TabsTrigger value="transfer" className="flex-1 text-xs"><Send className="w-4 h-4 mr-1" />Transfer</TabsTrigger>
            <TabsTrigger value="leaderboard" className="flex-1 text-xs"><Trophy className="w-4 h-4 mr-1" />Ranking</TabsTrigger>
          </TabsList>

          {/* History Tab */}
          <TabsContent value="dashboard" className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm">Riwayat Transaksi</h3>
              <Button variant="ghost" size="sm" onClick={loadDashboardData}><RefreshCw className="w-4 h-4" /></Button>
            </div>
            {transactions.length === 0 ? (
              <Card className="glass-card"><CardContent className="p-6 text-center text-muted-foreground text-sm">Belum ada transaksi</CardContent></Card>
            ) : (
              transactions.map(tx => (
                <Card key={tx.id} className="glass-card hover:border-border/80 transition-colors">
                  <CardContent className="p-3 flex items-center gap-3">
                    {getTypeIcon(tx.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{getTypeLabel(tx.type)}</span>
                        <span className={`text-sm font-mono font-bold ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {tx.amount >= 0 ? '+' : ''}{formatCoins(tx.amount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">{tx.description}</span>
                        <span className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString('id-ID')}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Top-up Tab */}
          <TabsContent value="topup" className="mt-4 space-y-4">
            {topupPayment ? (
              <Card className="glass-card">
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-lg font-display">Scan QRIS untuk Top Up</CardTitle>
                  <CardDescription>{formatRp(topupPayment.totalAmount)} = {formatCoins(topupPayment.totalAmount)} XCoins</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-center">
                    <img src={topupPayment.qris_url} alt="QRIS" className="w-64 h-64 rounded-lg bg-white p-2" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground animate-pulse-slow">Menunggu pembayaran...</p>
                    <p className="text-xs text-muted-foreground mt-1">ID: {topupPayment.transactionId}</p>
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => { 
                    if (topupInterval.current) clearInterval(topupInterval.current);
                    setTopupPayment(null); 
                  }}>
                    Batalkan
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg font-display"><Wallet className="w-5 h-5 text-primary" />Top Up XCoins</CardTitle>
                  <CardDescription>1 Rupiah = 1 XCoin</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    {[5000, 10000, 25000, 50000, 100000, 200000].map(amt => (
                      <button key={amt} onClick={() => setTopupAmount(amt.toString())} 
                        className={`p-3 rounded-lg border text-center transition-colors text-sm ${topupAmount === amt.toString() ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background/50 hover:border-primary/50'}`}>
                        {formatCoins(amt)}
                      </button>
                    ))}
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Atau masukkan jumlah</label>
                    <Input type="number" value={topupAmount} onChange={e => setTopupAmount(e.target.value)} placeholder="Minimal 1000" className="bg-background/50 mt-1" />
                  </div>
                  {topupAmount && parseInt(topupAmount) >= 1000 && (
                    <div className="text-center p-3 rounded-lg bg-primary/10">
                      <span className="text-sm text-muted-foreground">Anda akan mendapatkan</span>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <Coins className="w-5 h-5 text-primary" />
                        <span className="text-xl font-display font-bold text-primary">{formatCoins(parseInt(topupAmount))}</span>
                        <span className="text-sm text-muted-foreground">XCoins</span>
                      </div>
                    </div>
                  )}
                  <Button className="w-full" onClick={handleTopup} disabled={loading || !topupAmount || parseInt(topupAmount) < 1000}>
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Wallet className="w-4 h-4 mr-2" />}
                    Top Up via QRIS
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Transfer Tab */}
          <TabsContent value="transfer" className="mt-4 space-y-4">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-display"><Send className="w-5 h-5 text-secondary" />Transfer XCoins</CardTitle>
                <CardDescription>Kirim XCoins ke pengguna lain</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground">Nomor WhatsApp Penerima</label>
                  <Input value={transferPhone} onChange={e => setTransferPhone(e.target.value)} placeholder="08xxxxxxxxxx" className="bg-background/50 mt-1" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Jumlah XCoins</label>
                  <Input type="number" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} placeholder="Min: 100" className="bg-background/50 mt-1" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">PIN Konfirmasi</label>
                  <Input type="password" maxLength={6} value={transferPin} onChange={e => setTransferPin(e.target.value.replace(/\D/g, ''))} placeholder="••••••" className="bg-background/50 mt-1 text-center tracking-[0.5em] font-mono" />
                </div>
                {transferAmount && parseInt(transferAmount) > 0 && (
                  <div className="p-3 rounded-lg bg-secondary/10 text-center">
                    <span className="text-sm text-muted-foreground">Sisa saldo setelah transfer:</span>
                    <div className="font-display font-bold text-secondary">{formatCoins(user.balance - parseInt(transferAmount))} XCoins</div>
                  </div>
                )}
                <Button className="w-full" variant="secondary" onClick={handleTransfer} disabled={loading}>
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Transfer
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Leaderboard Tab */}
          <TabsContent value="leaderboard" className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm flex items-center gap-2"><Trophy className="w-4 h-4 text-warning" />Top 10 XCoins</h3>
              <Button variant="ghost" size="sm" onClick={loadDashboardData}><RefreshCw className="w-4 h-4" /></Button>
            </div>
            {leaderboard.map(entry => (
              <Card key={entry.rank} className={`glass-card transition-colors ${entry.isMe ? 'border-primary/50 glow-cyan' : 'hover:border-border/80'}`}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-display font-bold text-sm ${
                    entry.rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                    entry.rank === 2 ? 'bg-gray-400/20 text-gray-300' :
                    entry.rank === 3 ? 'bg-orange-500/20 text-orange-400' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {entry.rank}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{entry.display_name}</span>
                      {entry.isMe && <span className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">Kamu</span>}
                    </div>
                    <span className="text-xs text-muted-foreground">{entry.phone}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Coins className="w-4 h-4 text-primary" />
                    <span className="font-mono font-bold text-sm">{formatCoins(entry.balance)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>

        {/* Pay with XCoins button */}
        <Card className="glass-card mt-4 cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/')}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Coins className="w-5 h-5 text-primary" />
              <div>
                <span className="text-sm font-medium">Beli Paket dengan XCoins</span>
                <p className="text-xs text-muted-foreground">Bayar langsung dengan saldo XCoins</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default XCoinsPage;
