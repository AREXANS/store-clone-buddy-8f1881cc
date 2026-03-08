import { FC, useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { 
  Shield, Plus, Trash2, RefreshCw, Users, Copy, Search,
  CheckCircle, XCircle, User, Upload, FileCode, Eye, EyeOff, Code
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface WhitelistUser {
  username: string;
  addedAt: string;
  addedBy: 'manual' | 'key';
  keyRef?: string;
}

interface KeyData {
  key: string;
  expired: string;
  role: string;
  maxHwid: number;
  frozenUntil: string | null;
  hwids: string[];
  robloxUsers: { hwid: string; username: string; registeredAt: string }[];
}

const WhitelistManagement: FC = () => {
  const [manualWhitelist, setManualWhitelist] = useState<WhitelistUser[]>([]);
  const [keyWhitelist, setKeyWhitelist] = useState<WhitelistUser[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const SUPABASE_API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

  const fetchWhitelist = async () => {
    setLoading(true);
    try {
      const { data: manualData } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'manual_whitelist')
        .single();

      if (manualData?.value) {
        try {
          setManualWhitelist(JSON.parse(manualData.value));
        } catch {
          setManualWhitelist([]);
        }
      }

      const { data: keysData } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'license_keys')
        .single();

      if (keysData?.value) {
        try {
          const keys: KeyData[] = JSON.parse(keysData.value);
          const now = new Date();
          const keyUsers: WhitelistUser[] = [];

          keys.forEach(keyData => {
            const expiredDate = new Date(keyData.expired);
            if (expiredDate >= now && !keyData.frozenUntil && keyData.robloxUsers) {
              keyData.robloxUsers.forEach(user => {
                if (user.username) {
                  keyUsers.push({
                    username: user.username,
                    addedAt: user.registeredAt,
                    addedBy: 'key',
                    keyRef: keyData.key.slice(0, 8) + '...'
                  });
                }
              });
            }
          });

          setKeyWhitelist(keyUsers);
        } catch {
          setKeyWhitelist([]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch whitelist:', error);
      toast({ title: 'Error', description: 'Gagal mengambil data whitelist', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWhitelist();
  }, []);

  const handleAddUsername = async () => {
    if (!newUsername.trim()) {
      toast({ title: 'Error', description: 'Username tidak boleh kosong', variant: 'destructive' });
      return;
    }

    const allUsernames = [...manualWhitelist, ...keyWhitelist].map(u => u.username.toLowerCase());
    if (allUsernames.includes(newUsername.toLowerCase().trim())) {
      toast({ title: 'Error', description: 'Username sudah ada di whitelist', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const newUser: WhitelistUser = {
        username: newUsername.trim(),
        addedAt: new Date().toISOString(),
        addedBy: 'manual'
      };

      const updatedList = [...manualWhitelist, newUser];

      const { data: existing } = await supabase
        .from('site_settings')
        .select('id')
        .eq('key', 'manual_whitelist')
        .single();

      if (existing) {
        await supabase
          .from('site_settings')
          .update({ 
            value: JSON.stringify(updatedList),
            updated_at: new Date().toISOString()
          })
          .eq('key', 'manual_whitelist');
      } else {
        await supabase
          .from('site_settings')
          .insert({
            key: 'manual_whitelist',
            value: JSON.stringify(updatedList),
            description: 'Manual whitelist usernames for Roblox'
          });
      }

      setManualWhitelist(updatedList);
      setNewUsername('');
      toast({ title: 'Berhasil', description: `Username "${newUsername}" ditambahkan ke whitelist` });
    } catch (error) {
      console.error('Failed to add username:', error);
      toast({ title: 'Error', description: 'Gagal menambahkan username', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveUsername = async (username: string) => {
    setSaving(true);
    try {
      const updatedList = manualWhitelist.filter(u => u.username !== username);

      await supabase
        .from('site_settings')
        .update({ 
          value: JSON.stringify(updatedList),
          updated_at: new Date().toISOString()
        })
        .eq('key', 'manual_whitelist');

      setManualWhitelist(updatedList);
      toast({ title: 'Berhasil', description: `Username "${username}" dihapus dari whitelist` });
    } catch (error) {
      console.error('Failed to remove username:', error);
      toast({ title: 'Error', description: 'Gagal menghapus username', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const copyWhitelistUrl = (format: string) => {
    const url = `${SUPABASE_API_BASE}/get-whitelist?format=${format}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Copied!', description: `URL whitelist (${format}) berhasil disalin` });
  };

  const allWhitelist = [...manualWhitelist, ...keyWhitelist];
  const filteredWhitelist = allWhitelist.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg sm:text-xl font-display font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500 flex-shrink-0" />
            <span className="truncate">Whitelist Management</span>
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Kelola username Roblox yang di-whitelist
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchWhitelist} disabled={loading} className="flex-shrink-0">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline ml-2">Refresh</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="glass-card p-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold">{allWhitelist.length}</p>
            </div>
          </div>
        </Card>
        <Card className="glass-card p-3">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-yellow-500" />
            <div>
              <p className="text-xs text-muted-foreground">Manual</p>
              <p className="text-lg font-bold">{manualWhitelist.length}</p>
            </div>
          </div>
        </Card>
        <Card className="glass-card p-3 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-secondary" />
            <div>
              <p className="text-xs text-muted-foreground">Dari Key</p>
              <p className="text-lg font-bold">{keyWhitelist.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Add Username */}
      <Card className="glass-card">
        <CardHeader className="pb-3 px-3 sm:px-6">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            Tambah Username Manual
          </CardTitle>
          <CardDescription className="text-xs">
            Tambahkan username Roblox ke whitelist secara manual
          </CardDescription>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <div className="flex gap-2">
            <Input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="Masukkan username Roblox..."
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleAddUsername()}
            />
            <Button onClick={handleAddUsername} disabled={saving || !newUsername.trim()}>
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span className="hidden sm:inline ml-2">Tambah</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Whitelist Users */}
      <Card className="glass-card">
        <CardHeader className="pb-3 px-3 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Daftar Whitelist ({allWhitelist.length})
              </CardTitle>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari username..."
                className="pl-9 w-full sm:w-48"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          {filteredWhitelist.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <XCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Tidak ada username di whitelist</p>
            </div>
          ) : (
            <ScrollArea className="h-[300px] pr-2">
              <div className="space-y-2">
                {filteredWhitelist.map((user, idx) => (
                  <div
                    key={`${user.username}-${idx}`}
                    className="flex items-center justify-between p-2 rounded bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{user.username}</p>
                        <div className="flex items-center gap-1.5">
                          <Badge 
                            variant={user.addedBy === 'manual' ? 'default' : 'secondary'} 
                            className="text-[10px] px-1.5 py-0"
                          >
                            {user.addedBy === 'manual' ? 'Manual' : 'Key'}
                          </Badge>
                          {user.keyRef && (
                            <span className="text-[10px] text-muted-foreground">{user.keyRef}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {user.addedBy === 'manual' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveUsername(user.username)}
                        className="text-destructive hover:text-destructive flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* API Endpoints */}
      <Card className="glass-card">
        <CardHeader className="pb-3 px-3 sm:px-6">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <Copy className="w-4 h-4 text-primary" />
            API Endpoints
          </CardTitle>
          <CardDescription className="text-xs">
            URL untuk mengakses whitelist dari Roblox
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 px-3 sm:px-6">
          <div className="grid gap-2">
            {['json', 'lua', 'raw'].map(format => (
              <div key={format} className="flex items-center gap-2">
                <Input
                  readOnly
                  value={`${SUPABASE_API_BASE}/get-whitelist?format=${format}`}
                  className="font-mono text-xs flex-1"
                />
                <Button variant="outline" size="sm" onClick={() => copyWhitelistUrl(format)}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WhitelistManagement;
