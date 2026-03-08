import { FC, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Plus, Trash2, Edit2, Save, Tag, Calendar, 
  Bell, Package, RefreshCw, Gift
} from 'lucide-react';

interface Discount {
  id: string;
  discount_type: string;
  min_days: number | null;
  max_days: number | null;
  discount_percent: number;
  promo_code: string | null;
  package_name: string | null;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  notify_users: boolean;
}

const DiscountManagement: FC = () => {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Discount | null>(null);
  const [isNew, setIsNew] = useState(false);

  const fetchDiscounts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('package_discounts')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setDiscounts((data || []) as Discount[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchDiscounts(); }, []);

  const saveDiscount = async () => {
    if (!editing) return;
    setLoading(true);
    const discountData: Record<string, unknown> = {
      discount_type: editing.discount_type,
      discount_percent: editing.discount_percent,
      min_days: editing.min_days,
      max_days: editing.max_days,
      promo_code: editing.promo_code,
      package_name: editing.package_name,
      is_active: editing.is_active,
      start_date: editing.start_date,
      end_date: editing.end_date,
      description: editing.description,
      notify_users: editing.notify_users,
      updated_at: new Date().toISOString()
    };
    if (editing.id && editing.id.length > 0) discountData.id = editing.id;

    const { error } = await supabase.from('package_discounts').upsert(discountData);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil', description: 'Diskon berhasil disimpan' });
      fetchDiscounts();
      setEditing(null);
      setIsNew(false);
    }
    setLoading(false);
  };

  const deleteDiscount = async (id: string) => {
    if (!confirm('Yakin ingin menghapus diskon ini?')) return;
    const { error } = await supabase.from('package_discounts').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil', description: 'Diskon berhasil dihapus' });
      fetchDiscounts();
    }
  };

  const startNewDiscount = () => {
    setEditing({
      id: '', discount_type: 'duration_based', min_days: 20, max_days: null,
      discount_percent: 10, promo_code: null, package_name: null, is_active: true,
      start_date: null, end_date: null, description: null, notify_users: false
    });
    setIsNew(true);
  };

  const getDiscountTypeLabel = (type: string) => {
    switch (type) {
      case 'duration_based': return 'Berdasarkan Durasi';
      case 'promo_code': return 'Kode Promo';
      case 'percentage': return 'Persentase Langsung';
      default: return type;
    }
  };

  const getDiscountTypeColor = (type: string) => {
    switch (type) {
      case 'duration_based': return 'bg-blue-500/20 text-blue-400';
      case 'promo_code': return 'bg-purple-500/20 text-purple-400';
      case 'percentage': return 'bg-green-500/20 text-green-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getDiscountRangeText = (d: Discount) => {
    if (d.max_days !== null && d.min_days !== null) return `${d.min_days}-${d.max_days}h`;
    return `${d.min_days}h+`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-display font-semibold">Discount & Promo</h2>
          <span className="text-sm text-muted-foreground">({discounts.length})</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchDiscounts} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={startNewDiscount}>
            <Plus className="w-4 h-4 mr-2" />
            Tambah Diskon
          </Button>
        </div>
      </div>

      {editing && (
        <Card className="glass-card border-primary/50">
          <CardHeader>
            <CardTitle>{isNew ? 'Tambah Diskon Baru' : 'Edit Diskon'}</CardTitle>
            <CardDescription>Atur diskon berdasarkan durasi pembelian, kode promo, atau persentase langsung</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Tipe Diskon</Label>
                <select
                  value={editing.discount_type}
                  onChange={(e) => setEditing({
                    ...editing,
                    discount_type: e.target.value,
                    min_days: e.target.value === 'duration_based' ? 20 : null,
                    max_days: null,
                    promo_code: e.target.value === 'promo_code' ? '' : null
                  })}
                  className="w-full p-2 rounded-md bg-background/50 border border-border"
                >
                  <option value="duration_based">Berdasarkan Durasi (min-max hari)</option>
                  <option value="promo_code">Kode Promo</option>
                  <option value="percentage">Persentase Langsung</option>
                </select>
              </div>
              <div>
                <Label>Package (kosongkan untuk semua)</Label>
                <select
                  value={editing.package_name || ''}
                  onChange={(e) => setEditing({ ...editing, package_name: e.target.value || null })}
                  className="w-full p-2 rounded-md bg-background/50 border border-border"
                >
                  <option value="">Semua Package</option>
                  <option value="NORMAL">NORMAL</option>
                  <option value="VIP">VIP</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {editing.discount_type === 'duration_based' && (
                <>
                  <div>
                    <Label>Minimal Hari</Label>
                    <Input type="number" min="1" value={editing.min_days || ''} onChange={(e) => setEditing({ ...editing, min_days: parseInt(e.target.value) || null })} placeholder="20" className="bg-background/50" />
                  </div>
                  <div>
                    <Label>Maksimal Hari (opsional)</Label>
                    <Input type="number" min="1" value={editing.max_days || ''} onChange={(e) => setEditing({ ...editing, max_days: parseInt(e.target.value) || null })} placeholder="30 (kosong = tak terbatas)" className="bg-background/50" />
                  </div>
                </>
              )}
              {editing.discount_type === 'promo_code' && (
                <>
                  <div>
                    <Label>Kode Promo</Label>
                    <Input value={editing.promo_code || ''} onChange={(e) => setEditing({ ...editing, promo_code: e.target.value.toUpperCase() })} placeholder="Contoh: DISKON20" className="bg-background/50 font-mono" />
                  </div>
                  <div>
                    <Label>Min Hari (opsional)</Label>
                    <Input type="number" min="1" value={editing.min_days || ''} onChange={(e) => setEditing({ ...editing, min_days: parseInt(e.target.value) || null })} placeholder="10" className="bg-background/50" />
                  </div>
                  <div>
                    <Label>Max Hari (opsional)</Label>
                    <Input type="number" min="1" value={editing.max_days || ''} onChange={(e) => setEditing({ ...editing, max_days: parseInt(e.target.value) || null })} placeholder="30" className="bg-background/50" />
                  </div>
                </>
              )}
              <div>
                <Label>Diskon (%)</Label>
                <Input
                  type="text" inputMode="decimal"
                  value={editing.discount_percent.toString().replace('.', ',')}
                  onChange={(e) => {
                    const val = e.target.value.replace(',', '.');
                    const num = parseFloat(val);
                    if (val === '' || val === '.' || val.endsWith('.')) {
                      setEditing({ ...editing, discount_percent: parseFloat(val) || 0 });
                    } else if (!isNaN(num) && num >= 0 && num <= 100) {
                      setEditing({ ...editing, discount_percent: num });
                    }
                  }}
                  placeholder="Contoh: 10,5" className="bg-background/50"
                />
              </div>
            </div>

            {editing.discount_type === 'duration_based' && (
              <p className="text-xs text-muted-foreground">
                {editing.min_days && editing.max_days
                  ? `Diskon berlaku untuk pembelian ${editing.min_days} sampai ${editing.max_days} hari`
                  : editing.min_days
                  ? `Diskon berlaku untuk pembelian ${editing.min_days} hari keatas`
                  : 'Tentukan minimal hari'}
              </p>
            )}

            <div>
              <Label>Deskripsi (opsional)</Label>
              <Input value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="Contoh: Diskon spesial tahun baru" className="bg-background/50" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Tanggal Mulai (opsional)</Label>
                <Input type="datetime-local" value={editing.start_date ? editing.start_date.slice(0, 16) : ''} onChange={(e) => setEditing({ ...editing, start_date: e.target.value ? new Date(e.target.value).toISOString() : null })} className="bg-background/50" />
              </div>
              <div>
                <Label>Tanggal Berakhir (opsional)</Label>
                <Input type="datetime-local" value={editing.end_date ? editing.end_date.slice(0, 16) : ''} onChange={(e) => setEditing({ ...editing, end_date: e.target.value ? new Date(e.target.value).toISOString() : null })} className="bg-background/50" />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={editing.is_active} onCheckedChange={(checked) => setEditing({ ...editing, is_active: checked })} />
                <Label>Aktif</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.notify_users} onCheckedChange={(checked) => setEditing({ ...editing, notify_users: checked })} />
                <Label className="flex items-center gap-1"><Bell className="w-4 h-4" /> Notifikasi</Label>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={saveDiscount} disabled={loading}>
                <Save className="w-4 h-4 mr-2" />
                {loading ? 'Menyimpan...' : 'Simpan'}
              </Button>
              <Button variant="outline" onClick={() => { setEditing(null); setIsNew(false); }}>Batal</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {loading && discounts.length === 0 ? (
          <Card className="glass-card"><CardContent className="p-8 text-center text-muted-foreground"><RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />Loading...</CardContent></Card>
        ) : discounts.length === 0 ? (
          <Card className="glass-card"><CardContent className="p-8 text-center text-muted-foreground"><Gift className="w-8 h-8 mx-auto mb-2 opacity-50" />Belum ada diskon</CardContent></Card>
        ) : (
          discounts.map((d) => (
            <Card key={d.id} className={`glass-card transition-all hover:border-primary/50 ${!d.is_active ? 'opacity-60' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getDiscountTypeColor(d.discount_type)}`}>{getDiscountTypeLabel(d.discount_type)}</span>
                      <span className="px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400 font-bold">-{d.discount_percent}%</span>
                      {d.package_name && <span className="px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground"><Package className="w-3 h-3 inline mr-1" />{d.package_name}</span>}
                      {d.notify_users && <span className="px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400"><Bell className="w-3 h-3 inline mr-1" />Notif</span>}
                      {!d.is_active && <span className="px-2 py-0.5 rounded text-xs bg-destructive/20 text-destructive">Nonaktif</span>}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      {d.discount_type === 'duration_based' && d.min_days && (
                        <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{getDiscountRangeText(d)}</span>
                      )}
                      {d.discount_type === 'promo_code' && d.promo_code && (
                        <span className="flex items-center gap-1"><Tag className="w-4 h-4" /><code className="bg-muted px-1 rounded">{d.promo_code}</code></span>
                      )}
                      {d.description && <span className="truncate max-w-[300px]">{d.description}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => { setEditing(d); setIsNew(false); }}><Edit2 className="w-4 h-4" /></Button>
                    <Button variant="destructive" size="sm" onClick={() => deleteDiscount(d.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default DiscountManagement;
