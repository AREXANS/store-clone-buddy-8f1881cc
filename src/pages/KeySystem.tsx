import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import GlobalBackground from '@/components/GlobalBackground';
import { Key, RefreshCw, Copy, ArrowLeft, Shield, Calendar, Clock, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const API_BASE = 'https://tvnoeugyucdanyjsrkvg.supabase.co/functions/v1';

interface KeyData {
  key: string;
  expired: string;
  role: string;
  maxHwid: number;
  frozenUntil: string | null;
  hwids: string[];
  robloxUsers: {
    hwid: string;
    username: string;
    registeredAt: string;
  }[];
}

const KeySystem = () => {
  const navigate = useNavigate();
  const [keyInput, setKeyInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [keyData, setKeyData] = useState<KeyData | null>(null);
  const [loadstring, setLoadstring] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [timeRemaining, setTimeRemaining] = useState({ text: '', className: '' });

  // Real-time countdown effect
  useEffect(() => {
    if (!keyData) return;

    const updateCountdown = () => {
      if (keyData.frozenUntil) {
        setTimeRemaining({ text: '⏸️ FROZEN', className: 'text-blue-400' });
        return;
      }

      const now = new Date();
      const expired = new Date(keyData.expired);
      const diff = expired.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining({ text: 'EXPIRED', className: 'text-destructive' });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeRemaining({ text: `${days}d ${hours}h ${minutes}m ${seconds}s`, className: 'text-secondary' });
      } else if (hours > 0) {
        setTimeRemaining({ text: `${hours}h ${minutes}m ${seconds}s`, className: 'text-yellow-400' });
      } else if (minutes > 0) {
        setTimeRemaining({ text: `${minutes}m ${seconds}s`, className: 'text-orange-400' });
      } else {
        setTimeRemaining({ text: `${seconds}s`, className: 'text-destructive' });
      }
    };

    // Initial update
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [keyData]);

  const validateKey = async () => {
    if (!keyInput.trim()) {
      setErrorMsg('Masukkan key terlebih dahulu');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const response = await fetch(`${API_BASE}/get-keys`);
      const data = await response.json();
      
      if (data.keys) {
        const foundKey = data.keys.find((k: KeyData) => k.key === keyInput.trim());
        
        if (foundKey) {
          // Check if key is expired
          const now = new Date();
          const expiredDate = new Date(foundKey.expired);
          
          if (expiredDate < now && !foundKey.frozenUntil) {
            setErrorMsg('Key sudah expired');
            setKeyData(null);
          } else {
            setKeyData(foundKey);
            
            // Load loadstring from settings
            const { data: settings } = await supabase
              .from('site_settings')
              .select('value')
              .eq('key', 'loadstring_script')
              .maybeSingle();
            
            if (settings?.value) {
              setLoadstring(settings.value);
            }
          }
        } else {
          setErrorMsg('Key tidak ditemukan');
          setKeyData(null);
        }
      }
    } catch (error) {
      console.error('Validate key error:', error);
      setErrorMsg('Gagal memvalidasi key');
    } finally {
      setLoading(false);
    }
  };

  const resetHwid = async () => {
    if (!keyData) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/update-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: keyData.key,
          hwids: [],
          robloxUsers: []
        })
      });
      
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Berhasil', description: 'HWID berhasil direset' });
        setKeyData({ ...keyData, hwids: [], robloxUsers: [] });
      } else {
        toast({ title: 'Error', description: result.error || 'Gagal reset HWID', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Reset HWID error:', error);
      toast({ title: 'Error', description: 'Gagal reset HWID', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Disalin!', description: `${label} berhasil disalin ke clipboard` });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // getRoleColor is still used, getTimeRemaining replaced by state

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'developer':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/50';
      case 'vip':
        return 'bg-secondary/20 text-secondary border-secondary/50';
      case 'normal':
        return 'bg-primary/20 text-primary border-primary/50';
      default:
        return 'bg-muted text-muted-foreground border-muted';
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <GlobalBackground />
      
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Kembali
            </Button>
          </div>

          {!keyData ? (
            /* Key Validation Form */
            <Card className="glass-card border-primary/30">
              <CardHeader className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
                  <Key className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-2xl font-display">Key System</CardTitle>
                <CardDescription>Masukkan key Anda untuk mengakses fitur</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder="AXSTOOLS-XXXX-XXXX"
                    className="bg-background/50 font-mono"
                    onKeyDown={(e) => e.key === 'Enter' && validateKey()}
                  />
                  <Button onClick={validateKey} disabled={loading}>
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Validasi'}
                  </Button>
                </div>
                
                {errorMsg && (
                  <p className="text-sm text-destructive text-center">{errorMsg}</p>
                )}
              </CardContent>
            </Card>
          ) : (
            /* Key Dashboard */
            <div className="space-y-4">
              {/* Key Info Card */}
              <Card className="glass-card border-primary/30">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Key className="w-5 h-5 text-primary" />
                      Key Dashboard
                    </CardTitle>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getRoleColor(keyData.role)}`}>
                      {keyData.role}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Key Display */}
                  <div className="flex items-center gap-2 bg-muted/30 p-3 rounded-lg">
                    <code className="flex-1 font-mono text-sm truncate">{keyData.key}</code>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(keyData.key, 'Key')}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/20 p-4 rounded-lg">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Calendar className="w-4 h-4" />
                        <span className="text-xs">Expired</span>
                      </div>
                      <p className="text-sm font-medium">{formatDate(keyData.expired)}</p>
                    </div>
                    <div className="bg-muted/20 p-4 rounded-lg">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Clock className="w-4 h-4" />
                        <span className="text-xs">Sisa Waktu</span>
                      </div>
                      <p className={`text-lg font-bold ${timeRemaining.className}`}>
                        {timeRemaining.text}
                      </p>
                    </div>
                  </div>

                  {/* HWID Info */}
                  <div className="bg-muted/20 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">HWID Terdaftar ({keyData.robloxUsers.length}/{keyData.maxHwid})</span>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={resetHwid} 
                        disabled={loading || keyData.robloxUsers.length === 0}
                      >
                        {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                        Reset HWID
                      </Button>
                    </div>
                    
                    {keyData.robloxUsers.length > 0 ? (
                      <div className="space-y-2">
                        {keyData.robloxUsers.map((user, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-background/30 p-2 rounded">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-muted-foreground" />
                              <span className="font-mono text-sm">{user.username}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{formatDate(user.registeredAt)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-2">Belum ada HWID terdaftar</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Loadstring Card */}
              {loadstring && (
                <Card className="glass-card border-secondary/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-secondary">
                      <Copy className="w-5 h-5" />
                      Loadstring Script
                    </CardTitle>
                    <CardDescription>Salin script ini ke executor Roblox Anda</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="relative">
                      <pre className="bg-muted/30 p-4 rounded-lg overflow-x-auto text-xs font-mono whitespace-pre-wrap break-all max-h-40">
                        {loadstring}
                      </pre>
                      <Button 
                        className="absolute top-2 right-2" 
                        size="sm"
                        onClick={() => copyToClipboard(loadstring, 'Loadstring')}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Salin
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Back Button */}
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => { setKeyData(null); setKeyInput(''); }}
              >
                Cek Key Lain
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KeySystem;
