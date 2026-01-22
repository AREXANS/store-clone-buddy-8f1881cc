import { FC, useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { 
  Key, Plus, Trash2, Edit2, RefreshCw, Save, 
  Users, Calendar, Shield, Copy, AlertTriangle,
  Download, Upload, Pause, Play, Clock
} from 'lucide-react';

const API_BASE = 'https://tvnoeugyucdanyjsrkvg.supabase.co/functions/v1';

interface KeyItem {
  key: string;
  expired: string;
  role: string;
  maxHwid: number;
  frozenUntil: string | null;
  frozenRemainingMs?: number;
  hwids: string[];
  robloxUsers: {
    hwid: string;
    username: string;
    registeredAt: string;
  }[];
}

interface KeyManagementProps {
  onRefresh?: () => void;
}

const KeyManagement: FC<KeyManagementProps> = ({ onRefresh }) => {
  const [keys, setKeys] = useState<KeyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingKey, setEditingKey] = useState<KeyItem | null>(null);
  const [isNewKey, setIsNewKey] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Realtime countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/get-keys`);
      const data = await response.json();
      if (data.keys) {
        setKeys(data.keys);
      }
    } catch (error) {
      console.error('Failed to fetch keys:', error);
      toast({ title: 'Error', description: 'Gagal mengambil data keys', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const generateKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const randomStr = (length: number) => {
      let result = '';
      for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
      return result;
    };
    return `AXSTOOLS-${randomStr(4)}-${randomStr(4)}`;
  };

  const handleCreateKey = async () => {
    if (!editingKey) return;
    
    setLoading(true);
    try {
      const keyToCreate = editingKey.key || generateKey();
      
      const response = await fetch(`${API_BASE}/create-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: keyToCreate,
          role: editingKey.role || 'VIP',
          expired: editingKey.expired,
          max_hwid: editingKey.maxHwid || 1
        })
      });
      
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Berhasil', description: `Key ${result.key} berhasil dibuat` });
        setEditingKey(null);
        setIsNewKey(false);
        fetchKeys();
      } else {
        toast({ title: 'Error', description: result.error || 'Gagal membuat key', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to create key:', error);
      toast({ title: 'Error', description: 'Gagal membuat key', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateKey = async () => {
    if (!editingKey) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/update-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: editingKey.key,
          role: editingKey.role,
          expired: editingKey.expired,
          max_hwid: editingKey.maxHwid,
          frozenUntil: editingKey.frozenUntil,
          frozenRemainingMs: editingKey.frozenRemainingMs
        })
      });
      
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Berhasil', description: 'Key berhasil diupdate' });
        setEditingKey(null);
        fetchKeys();
      } else {
        toast({ title: 'Error', description: result.error || 'Gagal update key', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to update key:', error);
      toast({ title: 'Error', description: 'Gagal update key', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteKey = async (key: string) => {
    if (!confirm(`Yakin ingin menghapus key "${key}"?`)) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/delete-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
      });
      
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Berhasil', description: 'Key berhasil dihapus' });
        fetchKeys();
      } else {
        toast({ title: 'Error', description: result.error || 'Gagal menghapus key', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to delete key:', error);
      toast({ title: 'Error', description: 'Gagal menghapus key', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const toggleFreezeKey = async (keyItem: KeyItem) => {
    setLoading(true);
    try {
      const now = new Date();
      const expiredDate = new Date(keyItem.expired);
      
      let updateData: any = { key: keyItem.key };
      
      if (keyItem.frozenUntil) {
        // Unfreeze: Calculate new expiry based on remaining time
        const remainingMs = keyItem.frozenRemainingMs || 0;
        const newExpiry = new Date(now.getTime() + remainingMs);
        updateData.expired = newExpiry.toISOString();
        updateData.frozenUntil = null;
        updateData.frozenRemainingMs = null;
      } else {
        // Freeze: Store remaining time
        const remainingMs = expiredDate.getTime() - now.getTime();
        updateData.frozenUntil = now.toISOString();
        updateData.frozenRemainingMs = remainingMs > 0 ? remainingMs : 0;
      }

      const response = await fetch(`${API_BASE}/update-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      
      const result = await response.json();
      if (result.success) {
        toast({ 
          title: 'Berhasil', 
          description: keyItem.frozenUntil ? 'Key berhasil di-unfreeze' : 'Key berhasil di-freeze' 
        });
        fetchKeys();
      } else {
        toast({ title: 'Error', description: result.error || 'Gagal update key', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to toggle freeze:', error);
      toast({ title: 'Error', description: 'Gagal toggle freeze', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const freezeAllKeys = async (freeze: boolean) => {
    if (!confirm(freeze ? 'Freeze semua key?' : 'Unfreeze semua key?')) return;
    
    setLoading(true);
    const now = new Date();
    
    for (const key of keys) {
      if (freeze && !key.frozenUntil) {
        const expiredDate = new Date(key.expired);
        const remainingMs = expiredDate.getTime() - now.getTime();
        await fetch(`${API_BASE}/update-key`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: key.key,
            frozenUntil: now.toISOString(),
            frozenRemainingMs: remainingMs > 0 ? remainingMs : 0
          })
        });
      } else if (!freeze && key.frozenUntil) {
        const remainingMs = key.frozenRemainingMs || 0;
        const newExpiry = new Date(now.getTime() + remainingMs);
        await fetch(`${API_BASE}/update-key`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: key.key,
            expired: newExpiry.toISOString(),
            frozenUntil: null,
            frozenRemainingMs: null
          })
        });
      }
    }
    
    toast({ title: 'Berhasil', description: freeze ? 'Semua key di-freeze' : 'Semua key di-unfreeze' });
    fetchKeys();
    setLoading(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!', description: 'Key berhasil disalin' });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeRemaining = (keyItem: KeyItem) => {
    if (keyItem.frozenUntil) {
      const remainingMs = keyItem.frozenRemainingMs || 0;
      const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
      return { 
        text: `⏸️ ${days}d ${hours}h ${minutes}m ${seconds}s`, 
        className: 'text-blue-400',
        frozen: true 
      };
    }
    
    const now = currentTime;
    const expired = new Date(keyItem.expired);
    const diff = expired.getTime() - now.getTime();
    
    if (diff <= 0) {
      return { text: 'EXPIRED', className: 'text-destructive', frozen: false };
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (days > 0) {
      return { text: `${days}d ${hours}h ${minutes}m ${seconds}s`, className: 'text-secondary', frozen: false };
    } else if (hours > 0) {
      return { text: `${hours}h ${minutes}m ${seconds}s`, className: 'text-yellow-400', frozen: false };
    } else {
      return { text: `${minutes}m ${seconds}s`, className: 'text-destructive', frozen: false };
    }
  };

  const isExpired = (keyItem: KeyItem) => {
    if (keyItem.frozenUntil) return false;
    return new Date(keyItem.expired) < new Date();
  };

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'developer':
        return 'bg-purple-500/20 text-purple-400';
      case 'vip':
        return 'bg-secondary/20 text-secondary';
      case 'normal':
        return 'bg-primary/20 text-primary';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const filteredKeys = keys.filter(k => 
    k.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
    k.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    k.robloxUsers.some(u => u.username.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const frozenCount = keys.filter(k => k.frozenUntil).length;

  const startNewKey = () => {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    
    setEditingKey({
      key: '',
      expired: expiryDate.toISOString().slice(0, 16),
      role: 'VIP',
      maxHwid: 1,
      frozenUntil: null,
      hwids: [],
      robloxUsers: []
    });
    setIsNewKey(true);
  };

  // Export keys to JSON file
  const exportKeys = () => {
    const dataStr = JSON.stringify(keys, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `axs-keys-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'Berhasil', description: `${keys.length} keys berhasil diekspor` });
  };

  // Import keys from JSON file
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importedKeys: KeyItem[] = JSON.parse(text);
      
      if (!Array.isArray(importedKeys)) {
        toast({ title: 'Error', description: 'Format file tidak valid', variant: 'destructive' });
        return;
      }

      setLoading(true);
      let successCount = 0;
      let errorCount = 0;

      for (const keyData of importedKeys) {
        try {
          const response = await fetch(`${API_BASE}/create-key`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              key: keyData.key,
              role: keyData.role || 'VIP',
              expired: keyData.expired,
              max_hwid: keyData.maxHwid || 1
            })
          });
          
          const result = await response.json();
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch {
          errorCount++;
        }
      }

      toast({ 
        title: 'Import Selesai', 
        description: `${successCount} berhasil, ${errorCount} gagal` 
      });
      fetchKeys();
    } catch (error) {
      console.error('Import error:', error);
      toast({ title: 'Error', description: 'Gagal membaca file JSON', variant: 'destructive' });
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-display font-semibold flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            License Keys
          </h2>
          <span className="text-sm text-muted-foreground">
            Total: {keys.length} keys | Frozen: {frozenCount}
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="Search key, role, username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64 bg-background/50"
          />
          <Button variant="outline" onClick={fetchKeys} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportKeys} disabled={keys.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button 
            variant="outline" 
            onClick={() => fileInputRef.current?.click()} 
            disabled={loading}
          >
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportFile}
            className="hidden"
          />
          <Button onClick={startNewKey}>
            <Plus className="w-4 h-4 mr-2" />
            Add Key
          </Button>
        </div>
      </div>

      {/* Freeze All Controls */}
      <Card className="glass-card border-blue-500/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Pause className="w-5 h-5 text-blue-400" />
              <div>
                <h3 className="font-medium">Freeze Control</h3>
                <p className="text-sm text-muted-foreground">
                  Freeze akan menjeda countdown expiry, unfreeze akan melanjutkan dari sisa waktu
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => freezeAllKeys(true)}
                disabled={loading || frozenCount === keys.length}
                className="border-blue-500/50 text-blue-400 hover:bg-blue-500/20"
              >
                <Pause className="w-4 h-4 mr-2" />
                Freeze All
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => freezeAllKeys(false)}
                disabled={loading || frozenCount === 0}
                className="border-green-500/50 text-green-400 hover:bg-green-500/20"
              >
                <Play className="w-4 h-4 mr-2" />
                Unfreeze All
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit/Create Form */}
      {editingKey && (
        <Card className="glass-card border-primary/50">
          <CardHeader>
            <CardTitle>{isNewKey ? 'Create New Key' : 'Edit Key'}</CardTitle>
            <CardDescription>
              {isNewKey ? 'Buat license key baru (format: AXSTOOLS-XXXX-XXXX)' : 'Edit data license key'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Key {isNewKey && '(kosongkan untuk auto-generate)'}</Label>
                <Input
                  value={editingKey.key}
                  onChange={(e) => setEditingKey({ ...editingKey, key: e.target.value })}
                  placeholder="AXSTOOLS-XXXX-XXXX"
                  className="bg-background/50 font-mono"
                  disabled={!isNewKey}
                />
              </div>
              <div>
                <Label>Role</Label>
                <select
                  value={editingKey.role}
                  onChange={(e) => setEditingKey({ ...editingKey, role: e.target.value })}
                  className="w-full p-2 rounded-md bg-background/50 border border-border"
                >
                  <option value="Developer">Developer</option>
                  <option value="VIP">VIP</option>
                  <option value="NORMAL">NORMAL</option>
                  <option value="Free">Free</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Expired Date</Label>
                <Input
                  type="datetime-local"
                  value={editingKey.expired.slice(0, 16)}
                  onChange={(e) => setEditingKey({ ...editingKey, expired: new Date(e.target.value).toISOString() })}
                  className="bg-background/50"
                />
              </div>
              <div>
                <Label>Max HWID</Label>
                <Input
                  type="number"
                  min="1"
                  value={editingKey.maxHwid}
                  onChange={(e) => setEditingKey({ ...editingKey, maxHwid: parseInt(e.target.value) })}
                  className="bg-background/50"
                />
              </div>
            </div>
            
            {!isNewKey && editingKey.robloxUsers.length > 0 && (
              <div>
                <Label className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Registered Users ({editingKey.robloxUsers.length}/{editingKey.maxHwid})
                </Label>
                <div className="mt-2 space-y-2">
                  {editingKey.robloxUsers.map((user, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-muted/30 p-2 rounded">
                      <span className="font-mono text-sm">{user.username}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(user.registeredAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button 
                onClick={isNewKey ? handleCreateKey : handleUpdateKey} 
                disabled={loading}
              >
                <Save className="w-4 h-4 mr-2" />
                {loading ? 'Saving...' : 'Save'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => { setEditingKey(null); setIsNewKey(false); }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Keys List */}
      <div className="grid gap-3">
        {loading && keys.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="p-8 text-center text-muted-foreground">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
              Loading keys...
            </CardContent>
          </Card>
        ) : filteredKeys.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="p-8 text-center text-muted-foreground">
              <Key className="w-8 h-8 mx-auto mb-2 opacity-50" />
              {searchQuery ? 'Tidak ada key yang cocok' : 'Belum ada key'}
            </CardContent>
          </Card>
        ) : (
          filteredKeys.map((k) => {
            const timeRemaining = getTimeRemaining(k);
            return (
              <Card key={k.key} className={`glass-card transition-all hover:border-primary/50 ${isExpired(k) ? 'opacity-60' : ''} ${k.frozenUntil ? 'border-blue-500/30' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="font-mono text-sm bg-muted px-2 py-1 rounded truncate max-w-[300px]">
                          {k.key}
                        </code>
                        <button
                          onClick={() => copyToClipboard(k.key)}
                          className="p-1 rounded hover:bg-muted transition-colors"
                        >
                          <Copy className="w-4 h-4 text-muted-foreground" />
                        </button>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRoleColor(k.role)}`}>
                          {k.role}
                        </span>
                        {k.frozenUntil && (
                          <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400 flex items-center gap-1">
                            <Pause className="w-3 h-3" />
                            FROZEN
                          </span>
                        )}
                        {isExpired(k) && (
                          <span className="px-2 py-0.5 rounded text-xs bg-destructive/20 text-destructive flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Expired
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(k.expired)}
                        </span>
                        <span className={`flex items-center gap-1 font-mono font-bold ${timeRemaining.className}`}>
                          <Clock className="w-4 h-4" />
                          {timeRemaining.text}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {k.robloxUsers.length}/{k.maxHwid} HWID
                        </span>
                        {k.robloxUsers.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Shield className="w-4 h-4" />
                            {k.robloxUsers.map(u => u.username).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => toggleFreezeKey(k)}
                        className={k.frozenUntil ? 'text-green-400 hover:text-green-300' : 'text-blue-400 hover:text-blue-300'}
                        title={k.frozenUntil ? 'Unfreeze' : 'Freeze'}
                      >
                        {k.frozenUntil ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => { setEditingKey(k); setIsNewKey(false); }}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleDeleteKey(k.key)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default KeyManagement;
