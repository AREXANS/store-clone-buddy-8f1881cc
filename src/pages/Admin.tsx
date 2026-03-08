import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { 
  Settings, Package, Image, List, CreditCard, LogOut, Save, 
  Plus, Trash2, Edit2, Eye, EyeOff, RefreshCw, MessageSquare, Shield, Key, FileText, FileCode, Upload, Tag
} from 'lucide-react';
import GlobalBackground from '@/components/GlobalBackground';
import DeviceApprovalScreen from '@/components/DeviceApprovalScreen';
import DeviceManagement from '@/components/DeviceManagement';
import KeyManagement from '@/components/KeyManagement';
import ApiDocumentation from '@/components/ApiDocumentation';
import ScriptManagement from '@/components/ScriptManagement';
import WhitelistManagement from '@/components/WhitelistManagement';
import LuaUploadManager from '@/components/LuaUploadManager';
import PromoManagement from '@/components/PromoManagement';
import { useDeviceDetection } from '@/hooks/useDeviceDetection';

interface SiteSetting {
  id: string;
  key: string;
  value: string;
  description: string | null;
}

interface PackageItem {
  id: string;
  name: string;
  display_name: string;
  price_per_day: number;
  description: string | null;
  features: string[] | null;
  is_active: boolean;
  sort_order: number;
}

interface AdItem {
  id: string;
  title: string;
  media_url: string;
  media_type: string;
  link_url: string | null;
  is_active: boolean;
  sort_order: number;
}

interface BackgroundItem {
  id: string;
  title: string;
  background_url: string;
  background_type: string;
  is_muted: boolean;
  is_active: boolean;
  sort_order: number;
}

interface TransactionItem {
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
  created_at: string;
  paid_at: string | null;
}

interface SocialLink {
  id: string;
  name: string;
  icon_type: string;
  url: string;
  label: string;
  link_location: string;
  is_active: boolean;
  sort_order: number;
}

const Admin = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Device detection hook
  const {
    deviceId,
    deviceName,
    deviceStatus,
    allSessions,
    isChecking,
    isLoggedIn,
    registerDevice,
    loadAllSessions,
    approveDevice,
    removeDevice,
    persistLogin,
    clearLogin
  } = useDeviceDetection();
  
  // Use persistent login state
  const [authenticated, setAuthenticated] = useState(isLoggedIn);

  // Settings state
  const [settings, setSettings] = useState<SiteSetting[]>([]);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  
  // Packages state
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [editingPackage, setEditingPackage] = useState<PackageItem | null>(null);
  
  // Ads state
  const [ads, setAds] = useState<AdItem[]>([]);
  const [editingAd, setEditingAd] = useState<AdItem | null>(null);
  
  // Backgrounds state
  const [backgrounds, setBackgrounds] = useState<BackgroundItem[]>([]);
  const [editingBackground, setEditingBackground] = useState<BackgroundItem | null>(null);
  
  // Transactions state
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);

  // Social Links state
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [editingSocialLink, setEditingSocialLink] = useState<SocialLink | null>(null);

  // Effect to load data on mount if already logged in
  useEffect(() => {
    if (isLoggedIn) {
      setAuthenticated(true);
      loadAllData();
    }
  }, [isLoggedIn]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'admin_key')
      .maybeSingle();
    
    if (data && data.value === password) {
      setAuthenticated(true);
      persistLogin();
      loadAllData();
    } else {
      toast({ title: "Error", description: "Password salah!", variant: "destructive" });
    }
    setLoading(false);
  };
  
  const handleLogout = () => {
    setAuthenticated(false);
    clearLogin();
  };

  const loadAllData = async () => {
    const [settingsRes, packagesRes, adsRes, backgroundsRes, transactionsRes, socialLinksRes] = await Promise.all([
      supabase.from('site_settings').select('*').order('key'),
      supabase.from('packages').select('*').order('sort_order'),
      supabase.from('ads').select('*').order('sort_order'),
      supabase.from('backgrounds').select('*').order('sort_order'),
      supabase.from('transactions').select('*').order('created_at', { ascending: false }),
      supabase.from('social_links').select('*').order('sort_order')
    ]);
    
    if (settingsRes.data) setSettings(settingsRes.data);
    if (packagesRes.data) setPackages(packagesRes.data);
    if (adsRes.data) setAds(adsRes.data);
    if (backgroundsRes.data) setBackgrounds(backgroundsRes.data);
    if (transactionsRes.data) setTransactions(transactionsRes.data);
    if (socialLinksRes.data) setSocialLinks(socialLinksRes.data);
  };

  const updateSetting = async (key: string, value: string) => {
    const { error } = await supabase
      .from('site_settings')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', key);
    
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Berhasil", description: `Setting ${key} berhasil diupdate` });
      setSettings(prev => prev.map(s => s.key === key ? { ...s, value } : s));
    }
  };

  const savePackage = async (pkg: PackageItem) => {
    const { error } = await supabase
      .from('packages')
      .upsert(pkg);
    
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Berhasil", description: "Package berhasil disimpan" });
      loadAllData();
      setEditingPackage(null);
    }
  };

  const deletePackage = async (id: string) => {
    const { error } = await supabase.from('packages').delete().eq('id', id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Berhasil", description: "Package berhasil dihapus" });
      loadAllData();
    }
  };

  const saveAd = async (ad: AdItem) => {
    const { error } = await supabase.from('ads').upsert(ad);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Berhasil", description: "Ad berhasil disimpan" });
      loadAllData();
      setEditingAd(null);
    }
  };

  const deleteAd = async (id: string) => {
    const { error } = await supabase.from('ads').delete().eq('id', id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Berhasil", description: "Ad berhasil dihapus" });
      loadAllData();
    }
  };

  const saveBackground = async (bg: BackgroundItem) => {
    const { error } = await supabase.from('backgrounds').upsert(bg);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Berhasil", description: "Background berhasil disimpan" });
      loadAllData();
      setEditingBackground(null);
    }
  };

  const deleteBackground = async (id: string) => {
    const { error } = await supabase.from('backgrounds').delete().eq('id', id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Berhasil", description: "Background berhasil dihapus" });
      loadAllData();
    }
  };

  const saveSocialLink = async (link: SocialLink) => {
    const { error } = await supabase.from('social_links').upsert(link);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Berhasil", description: "Social link berhasil disimpan" });
      loadAllData();
      setEditingSocialLink(null);
    }
  };

  const deleteSocialLink = async (id: string) => {
    const { error } = await supabase.from('social_links').delete().eq('id', id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Berhasil", description: "Social link berhasil dihapus" });
      loadAllData();
    }
  };

  const formatRupiah = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

  const paymentKeys = ['cashify_license_key', 'cashify_qris_id', 'cashify_webhook_key', 'cashify_api_key', 'discord_webhook_url', 'payment_mode', 'payment_simulation'];

  // Show device approval screen if device is not approved
  if (deviceStatus === 'loading' || deviceStatus === 'new' || deviceStatus === 'pending') {
    return (
      <DeviceApprovalScreen
        deviceId={deviceId}
        deviceName={deviceName}
        onRegister={registerDevice}
        status={isChecking ? 'loading' : deviceStatus}
      />
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
        <GlobalBackground />
        <Card className="w-full max-w-md z-10 glass-card">
          <CardHeader className="text-center">
            <CardTitle className="font-display text-2xl text-primary">Developer Login</CardTitle>
            <CardDescription>Masukkan password admin untuk melanjutkan</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password admin"
                  className="bg-background/50"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Loading...' : 'Login'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <GlobalBackground />
      
      <div className="relative z-10 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-primary">Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground">Kelola toko AREXANS TOOLS</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/')}>
                Ke Toko
              </Button>
              <Button variant="destructive" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>

          <Tabs defaultValue="settings" className="space-y-6">
            <div className="overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
              <TabsList className="inline-flex w-max min-w-full md:w-auto bg-muted/50 gap-1">
                <TabsTrigger value="settings" className="gap-1.5 px-3 py-2 text-xs md:text-sm whitespace-nowrap">
                  <Settings className="w-4 h-4" />
                  <span className="hidden xs:inline">Settings</span>
                </TabsTrigger>
                <TabsTrigger value="packages" className="gap-1.5 px-3 py-2 text-xs md:text-sm whitespace-nowrap">
                  <Package className="w-4 h-4" />
                  <span className="hidden xs:inline">Packages</span>
                </TabsTrigger>
                <TabsTrigger value="keys" className="gap-1.5 px-3 py-2 text-xs md:text-sm whitespace-nowrap">
                  <Key className="w-4 h-4" />
                  <span className="hidden xs:inline">Keys</span>
                </TabsTrigger>
                <TabsTrigger value="docs" className="gap-1.5 px-3 py-2 text-xs md:text-sm whitespace-nowrap">
                  <FileText className="w-4 h-4" />
                  <span className="hidden xs:inline">API</span>
                </TabsTrigger>
                <TabsTrigger value="scripts" className="gap-1.5 px-3 py-2 text-xs md:text-sm whitespace-nowrap">
                  <FileCode className="w-4 h-4" />
                  <span className="hidden xs:inline">Scripts</span>
                </TabsTrigger>
                <TabsTrigger value="whitelist" className="gap-1.5 px-3 py-2 text-xs md:text-sm whitespace-nowrap">
                  <Shield className="w-4 h-4" />
                  <span className="hidden xs:inline">Whitelist</span>
                </TabsTrigger>
                <TabsTrigger value="upload" className="gap-1.5 px-3 py-2 text-xs md:text-sm whitespace-nowrap">
                  <Upload className="w-4 h-4" />
                  <span className="hidden xs:inline">Upload</span>
                </TabsTrigger>
                <TabsTrigger value="ads" className="gap-1.5 px-3 py-2 text-xs md:text-sm whitespace-nowrap">
                  <Image className="w-4 h-4" />
                  <span className="hidden xs:inline">Ads</span>
                </TabsTrigger>
                <TabsTrigger value="backgrounds" className="gap-1.5 px-3 py-2 text-xs md:text-sm whitespace-nowrap">
                  <Image className="w-4 h-4" />
                  <span className="hidden xs:inline">BG</span>
                </TabsTrigger>
                <TabsTrigger value="transactions" className="gap-1.5 px-3 py-2 text-xs md:text-sm whitespace-nowrap">
                  <CreditCard className="w-4 h-4" />
                  <span className="hidden xs:inline">Trans</span>
                </TabsTrigger>
                <TabsTrigger value="social" className="gap-1.5 px-3 py-2 text-xs md:text-sm whitespace-nowrap">
                  <MessageSquare className="w-4 h-4" />
                  <span className="hidden xs:inline">Social</span>
                </TabsTrigger>
                <TabsTrigger value="devices" className="gap-1.5 px-3 py-2 text-xs md:text-sm whitespace-nowrap">
                  <Shield className="w-4 h-4" />
                  <span className="hidden xs:inline">Devices</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-primary" />
                    Payment Gateway (Cashify QRIS)
                  </CardTitle>
                  <CardDescription>Konfigurasi pembayaran QRIS otomatis</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {settings.filter(s => paymentKeys.includes(s.key)).map(setting => (
                    <div key={setting.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={setting.key} className="capitalize">
                          {setting.key.replace(/_/g, ' ')}
                        </Label>
                        {setting.key !== 'payment_mode' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowSecrets(prev => ({ ...prev, [setting.key]: !prev[setting.key] }))}
                          >
                            {showSecrets[setting.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                        )}
                      </div>
                      {setting.description && (
                        <p className="text-xs text-muted-foreground">{setting.description}</p>
                      )}
                      {setting.key === 'payment_mode' ? (
                        <div className="flex items-center gap-4">
                          <Button
                            variant={setting.value === 'demo' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateSetting(setting.key, 'demo')}
                          >
                            Demo Mode
                          </Button>
                          <Button
                            variant={setting.value === 'live' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateSetting(setting.key, 'live')}
                          >
                            Live Mode
                          </Button>
                        </div>
                      ) : setting.key === 'payment_simulation' ? (
                        <div className="flex items-center gap-4">
                          <Switch
                            checked={setting.value === 'on'}
                            onCheckedChange={(checked) => updateSetting(setting.key, checked ? 'on' : 'off')}
                          />
                          <span className={`text-sm font-medium ${setting.value === 'on' ? 'text-secondary' : 'text-muted-foreground'}`}>
                            {setting.value === 'on' ? 'Simulasi AKTIF - Pembayaran otomatis sukses' : 'Simulasi OFF - Pembayaran normal'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Input
                            id={setting.key}
                            type={showSecrets[setting.key] ? 'text' : 'password'}
                            value={setting.value}
                            onChange={(e) => setSettings(prev => 
                              prev.map(s => s.key === setting.key ? { ...s, value: e.target.value } : s)
                            )}
                            placeholder={`Masukkan ${setting.key.replace(/_/g, ' ')}`}
                            className="bg-background/50"
                          />
                          <Button onClick={() => updateSetting(setting.key, setting.value)}>
                            <Save className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" />
                    General Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {settings.filter(s => !paymentKeys.includes(s.key)).map(setting => (
                    <div key={setting.id} className="space-y-2">
                      <Label htmlFor={setting.key} className="capitalize">
                        {setting.key.replace(/_/g, ' ')}
                      </Label>
                      {setting.description && (
                        <p className="text-xs text-muted-foreground">{setting.description}</p>
                      )}
                      <div className="flex gap-2">
                        <Input
                          id={setting.key}
                          type={setting.key.includes('key') || setting.key.includes('password') ? 'password' : 'text'}
                          value={setting.value}
                          onChange={(e) => setSettings(prev => 
                            prev.map(s => s.key === setting.key ? { ...s, value: e.target.value } : s)
                          )}
                          className="bg-background/50"
                        />
                        <Button onClick={() => updateSetting(setting.key, setting.value)}>
                          <Save className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Packages Tab */}
            <TabsContent value="packages" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-display font-semibold">Manage Packages</h2>
                <Button onClick={() => setEditingPackage({
                  id: crypto.randomUUID(),
                  name: '',
                  display_name: '',
                  price_per_day: 2000,
                  description: '',
                  features: [],
                  is_active: true,
                  sort_order: packages.length
                })}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Package
                </Button>
              </div>

              {editingPackage && (
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>{editingPackage.name ? 'Edit' : 'New'} Package</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Name (ID)</Label>
                        <Input
                          value={editingPackage.name}
                          onChange={e => setEditingPackage({ ...editingPackage, name: e.target.value.toUpperCase() })}
                          placeholder="NORMAL"
                          className="bg-background/50"
                        />
                      </div>
                      <div>
                        <Label>Display Name</Label>
                        <Input
                          value={editingPackage.display_name}
                          onChange={e => setEditingPackage({ ...editingPackage, display_name: e.target.value })}
                          placeholder="Normal Script"
                          className="bg-background/50"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Price per Day (IDR)</Label>
                        <Input
                          type="number"
                          value={editingPackage.price_per_day}
                          onChange={e => setEditingPackage({ ...editingPackage, price_per_day: parseInt(e.target.value) })}
                          className="bg-background/50"
                        />
                      </div>
                      <div>
                        <Label>Sort Order</Label>
                        <Input
                          type="number"
                          value={editingPackage.sort_order}
                          onChange={e => setEditingPackage({ ...editingPackage, sort_order: parseInt(e.target.value) })}
                          className="bg-background/50"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={editingPackage.description || ''}
                        onChange={e => setEditingPackage({ ...editingPackage, description: e.target.value })}
                        className="bg-background/50"
                      />
                    </div>
                    <div>
                      <Label>Features (one per line)</Label>
                      <Textarea
                        value={(editingPackage.features || []).join('\n')}
                        onChange={e => setEditingPackage({ ...editingPackage, features: e.target.value.split('\n').filter(f => f.trim()) })}
                        className="bg-background/50"
                        rows={4}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={editingPackage.is_active}
                        onCheckedChange={checked => setEditingPackage({ ...editingPackage, is_active: checked })}
                      />
                      <Label>Active</Label>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => savePackage(editingPackage)}>
                        <Save className="w-4 h-4 mr-2" />
                        Save
                      </Button>
                      <Button variant="outline" onClick={() => setEditingPackage(null)}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-4">
                {packages.map(pkg => (
                  <Card key={pkg.id} className="glass-card">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{pkg.display_name}</span>
                          <span className="text-xs text-muted-foreground">({pkg.name})</span>
                          {!pkg.is_active && <span className="text-xs text-destructive">[Inactive]</span>}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatRupiah(pkg.price_per_day)}/hari
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditingPackage(pkg)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deletePackage(pkg.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Keys Tab */}
            <TabsContent value="keys" className="space-y-4">
              <KeyManagement />
            </TabsContent>

            {/* API Documentation Tab */}
            <TabsContent value="docs" className="space-y-4">
              <ApiDocumentation />
            </TabsContent>

            {/* Scripts Tab */}
            <TabsContent value="scripts" className="space-y-4">
              <ScriptManagement />
            </TabsContent>

            {/* Whitelist Tab */}
            <TabsContent value="whitelist" className="space-y-4">
              <WhitelistManagement />
            </TabsContent>

            {/* Upload Tab */}
            <TabsContent value="upload" className="space-y-4">
              <LuaUploadManager />
            </TabsContent>

            {/* Ads Tab */}
            <TabsContent value="ads" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-display font-semibold">Manage Ads</h2>
                <Button onClick={() => setEditingAd({
                  id: crypto.randomUUID(),
                  title: '',
                  media_url: '',
                  media_type: 'image',
                  link_url: '',
                  is_active: true,
                  sort_order: ads.length
                })}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Ad
                </Button>
              </div>

              {editingAd && (
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>{editingAd.title ? 'Edit' : 'New'} Ad</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Title</Label>
                      <Input
                        value={editingAd.title}
                        onChange={e => setEditingAd({ ...editingAd, title: e.target.value })}
                        className="bg-background/50"
                      />
                    </div>
                    <div>
                      <Label>Media URL</Label>
                      <Input
                        value={editingAd.media_url}
                        onChange={e => setEditingAd({ ...editingAd, media_url: e.target.value })}
                        placeholder="https://..."
                        className="bg-background/50"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Media Type</Label>
                        <select
                          value={editingAd.media_type}
                          onChange={e => setEditingAd({ ...editingAd, media_type: e.target.value })}
                          className="w-full p-2 rounded-md bg-background/50 border border-border"
                        >
                          <option value="image">Image</option>
                          <option value="video">Video</option>
                        </select>
                      </div>
                      <div>
                        <Label>Sort Order</Label>
                        <Input
                          type="number"
                          value={editingAd.sort_order}
                          onChange={e => setEditingAd({ ...editingAd, sort_order: parseInt(e.target.value) })}
                          className="bg-background/50"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Link URL (optional)</Label>
                      <Input
                        value={editingAd.link_url || ''}
                        onChange={e => setEditingAd({ ...editingAd, link_url: e.target.value })}
                        placeholder="https://..."
                        className="bg-background/50"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={editingAd.is_active}
                        onCheckedChange={checked => setEditingAd({ ...editingAd, is_active: checked })}
                      />
                      <Label>Active</Label>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => saveAd(editingAd)}>
                        <Save className="w-4 h-4 mr-2" />
                        Save
                      </Button>
                      <Button variant="outline" onClick={() => setEditingAd(null)}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {ads.map(ad => (
                  <Card key={ad.id} className="glass-card overflow-hidden">
                    <div className="aspect-video bg-muted">
                      {ad.media_type === 'video' ? (
                        <video src={ad.media_url} className="w-full h-full object-cover" muted />
                      ) : (
                        <img src={ad.media_url} alt={ad.title} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <span className="font-semibold">{ad.title}</span>
                        {!ad.is_active && <span className="text-xs text-destructive ml-2">[Inactive]</span>}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditingAd(ad)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteAd(ad.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Backgrounds Tab */}
            <TabsContent value="backgrounds" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-display font-semibold">Manage Backgrounds</h2>
                <Button onClick={() => setEditingBackground({
                  id: crypto.randomUUID(),
                  title: '',
                  background_url: '',
                  background_type: 'image',
                  is_muted: true,
                  is_active: true,
                  sort_order: backgrounds.length
                })}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Background
                </Button>
              </div>

              {editingBackground && (
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>{editingBackground.title ? 'Edit' : 'New'} Background</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Title</Label>
                      <Input
                        value={editingBackground.title}
                        onChange={e => setEditingBackground({ ...editingBackground, title: e.target.value })}
                        className="bg-background/50"
                      />
                    </div>
                    <div>
                      <Label>Background URL</Label>
                      <Input
                        value={editingBackground.background_url}
                        onChange={e => setEditingBackground({ ...editingBackground, background_url: e.target.value })}
                        placeholder="https://..."
                        className="bg-background/50"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Type</Label>
                        <select
                          value={editingBackground.background_type}
                          onChange={e => setEditingBackground({ ...editingBackground, background_type: e.target.value })}
                          className="w-full p-2 rounded-md bg-background/50 border border-border"
                        >
                          <option value="image">Image</option>
                          <option value="video">Video</option>
                        </select>
                      </div>
                      <div>
                        <Label>Sort Order</Label>
                        <Input
                          type="number"
                          value={editingBackground.sort_order}
                          onChange={e => setEditingBackground({ ...editingBackground, sort_order: parseInt(e.target.value) })}
                          className="bg-background/50"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={editingBackground.is_muted}
                          onCheckedChange={checked => setEditingBackground({ ...editingBackground, is_muted: checked })}
                        />
                        <Label>Muted (for video)</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={editingBackground.is_active}
                          onCheckedChange={checked => setEditingBackground({ ...editingBackground, is_active: checked })}
                        />
                        <Label>Active</Label>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => saveBackground(editingBackground)}>
                        <Save className="w-4 h-4 mr-2" />
                        Save
                      </Button>
                      <Button variant="outline" onClick={() => setEditingBackground(null)}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {backgrounds.map(bg => (
                  <Card key={bg.id} className="glass-card overflow-hidden">
                    <div className="aspect-video bg-muted">
                      {bg.background_type === 'video' ? (
                        <video src={bg.background_url} className="w-full h-full object-cover" muted />
                      ) : (
                        <img src={bg.background_url} alt={bg.title} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <span className="font-semibold">{bg.title}</span>
                        {!bg.is_active && <span className="text-xs text-destructive ml-2">[Inactive]</span>}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditingBackground(bg)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteBackground(bg.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Transactions Tab */}
            <TabsContent value="transactions" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-display font-semibold">Transactions</h2>
                <Button variant="outline" onClick={loadAllData}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3">ID</th>
                      <th className="text-left p-3">Customer</th>
                      <th className="text-left p-3">Package</th>
                      <th className="text-left p-3">Amount</th>
                      <th className="text-left p-3">Status</th>
                      <th className="text-left p-3">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(tx => (
                      <tr key={tx.id} className="border-b border-border/50 hover:bg-muted/20">
                        <td className="p-3 font-mono text-xs">{tx.transaction_id}</td>
                        <td className="p-3">
                          <div>{tx.customer_name}</div>
                          {tx.customer_whatsapp && (
                            <div className="text-xs text-muted-foreground">{tx.customer_whatsapp}</div>
                          )}
                        </td>
                        <td className="p-3">
                          <div>{tx.package_name}</div>
                          <div className="text-xs text-muted-foreground">{tx.package_duration} hari</div>
                        </td>
                        <td className="p-3">{formatRupiah(tx.total_amount)}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            tx.status === 'paid' ? 'bg-success/20 text-success' :
                            tx.status === 'pending' ? 'bg-warning/20 text-warning' :
                            'bg-destructive/20 text-destructive'
                          }`}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="p-3 text-xs">
                          {new Date(tx.created_at).toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* Social Links Tab */}
            <TabsContent value="social" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-display font-semibold">Social Links</h2>
                <Button onClick={() => setEditingSocialLink({
                  id: crypto.randomUUID(),
                  name: '',
                  icon_type: 'link',
                  url: '',
                  label: '',
                  link_location: 'home',
                  is_active: true,
                  sort_order: socialLinks.length
                })}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Link
                </Button>
              </div>

              {editingSocialLink && (
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>{editingSocialLink.name ? 'Edit' : 'New'} Social Link</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Name</Label>
                        <Input
                          value={editingSocialLink.name}
                          onChange={e => setEditingSocialLink({ ...editingSocialLink, name: e.target.value })}
                          className="bg-background/50"
                        />
                      </div>
                      <div>
                        <Label>Label</Label>
                        <Input
                          value={editingSocialLink.label}
                          onChange={e => setEditingSocialLink({ ...editingSocialLink, label: e.target.value })}
                          className="bg-background/50"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>URL</Label>
                      <Input
                        value={editingSocialLink.url}
                        onChange={e => setEditingSocialLink({ ...editingSocialLink, url: e.target.value })}
                        placeholder="https://..."
                        className="bg-background/50"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Icon Type</Label>
                        <select
                          value={editingSocialLink.icon_type}
                          onChange={e => setEditingSocialLink({ ...editingSocialLink, icon_type: e.target.value })}
                          className="w-full p-2 rounded-md bg-background/50 border border-border"
                        >
                          <option value="link">Link</option>
                          <option value="whatsapp">WhatsApp</option>
                          <option value="whatsapp-contact">WhatsApp Contact</option>
                          <option value="telegram">Telegram</option>
                          <option value="discord">Discord</option>
                          <option value="youtube">YouTube</option>
                          <option value="tiktok">TikTok</option>
                          <option value="instagram">Instagram</option>
                        </select>
                      </div>
                      <div>
                        <Label>Location</Label>
                        <select
                          value={editingSocialLink.link_location}
                          onChange={e => setEditingSocialLink({ ...editingSocialLink, link_location: e.target.value })}
                          className="w-full p-2 rounded-md bg-background/50 border border-border"
                        >
                          <option value="home">Home</option>
                          <option value="footer">Footer</option>
                          <option value="both">Both</option>
                        </select>
                      </div>
                      <div>
                        <Label>Sort Order</Label>
                        <Input
                          type="number"
                          value={editingSocialLink.sort_order}
                          onChange={e => setEditingSocialLink({ ...editingSocialLink, sort_order: parseInt(e.target.value) })}
                          className="bg-background/50"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={editingSocialLink.is_active}
                        onCheckedChange={checked => setEditingSocialLink({ ...editingSocialLink, is_active: checked })}
                      />
                      <Label>Active</Label>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => saveSocialLink(editingSocialLink)}>
                        <Save className="w-4 h-4 mr-2" />
                        Save
                      </Button>
                      <Button variant="outline" onClick={() => setEditingSocialLink(null)}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-4">
                {socialLinks.map(link => (
                  <Card key={link.id} className="glass-card">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{link.name}</span>
                          <span className="text-xs text-muted-foreground">({link.icon_type})</span>
                          {!link.is_active && <span className="text-xs text-destructive">[Inactive]</span>}
                        </div>
                        <p className="text-sm text-muted-foreground truncate max-w-md">{link.url}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditingSocialLink(link)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteSocialLink(link.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Devices Tab */}
            <TabsContent value="devices" className="space-y-4">
              <DeviceManagement
                sessions={allSessions}
                currentDeviceId={deviceId}
                onApprove={approveDevice}
                onRemove={removeDevice}
                onRefresh={loadAllSessions}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Admin;
