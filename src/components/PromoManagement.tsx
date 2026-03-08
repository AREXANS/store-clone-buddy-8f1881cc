import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Edit2, Tag, Copy } from 'lucide-react';

interface PromoCode {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  min_amount: number;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

const PromoManagement = () => {
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PromoCode | null>(null);
  const [form, setForm] = useState({
    code: '',
    discount_type: 'percentage',
    discount_value: 10,
    min_amount: 0,
    max_uses: '',
    is_active: true,
    expires_at: ''
  });

  const fetchPromos = async () => {
    setLoading(true);
    const { data } = await supabase.from('promo_codes').select('*').order('created_at', { ascending: false });
    if (data) setPromos(data as PromoCode[]);
    setLoading(false);
  };

  useEffect(() => { fetchPromos(); }, []);

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'PROMO-';
    for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    setForm(prev => ({ ...prev, code }));
  };

  const resetForm = () => {
    setEditing(null);
    setForm({ code: '', discount_type: 'percentage', discount_value: 10, min_amount: 0, max_uses: '', is_active: true, expires_at: '' });
  };

  const handleSave = async () => {
    if (!form.code) { toast({ title: "Error", description: "Kode promo wajib diisi", variant: "destructive" }); return; }
    
    const payload = {
      code: form.code.toUpperCase(),
      discount_type: form.discount_type,
      discount_value: form.discount_value,
      min_amount: form.min_amount,
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      is_active: form.is_active,
      expires_at: form.expires_at || null
    };

    let error;
    if (editing) {
      ({ error } = await supabase.from('promo_codes').update(payload).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('promo_codes').insert(payload));
    }

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Berhasil", description: editing ? "Promo diupdate" : "Promo ditambahkan" });
      resetForm();
      fetchPromos();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus promo ini?')) return;
    await supabase.from('promo_codes').delete().eq('id', id);
    toast({ title: "Berhasil", description: "Promo dihapus" });
    fetchPromos();
  };

  const startEdit = (p: PromoCode) => {
    setEditing(p);
    setForm({
      code: p.code,
      discount_type: p.discount_type,
      discount_value: p.discount_value,
      min_amount: p.min_amount,
      max_uses: p.max_uses?.toString() || '',
      is_active: p.is_active,
      expires_at: p.expires_at ? p.expires_at.slice(0, 16) : ''
    });
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="w-5 h-5 text-primary" />
          Kode Promo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Form */}
        <div className="bg-muted/30 p-4 rounded-xl space-y-4 border border-border">
          <h3 className="font-semibold text-sm">{editing ? 'Edit Promo' : 'Tambah Promo Baru'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Kode Promo</Label>
              <div className="flex gap-2">
                <Input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="PROMO-XXXX" className="bg-background/50" />
                <Button type="button" variant="outline" size="sm" onClick={generateCode}>Auto</Button>
              </div>
            </div>
            <div>
              <Label>Tipe Diskon</Label>
              <div className="flex gap-2 mt-1">
                <Button size="sm" variant={form.discount_type === 'percentage' ? 'default' : 'outline'} onClick={() => setForm(p => ({ ...p, discount_type: 'percentage' }))}>Persen (%)</Button>
                <Button size="sm" variant={form.discount_type === 'fixed' ? 'default' : 'outline'} onClick={() => setForm(p => ({ ...p, discount_type: 'fixed' }))}>Nominal (Rp)</Button>
              </div>
            </div>
            <div>
              <Label>Nilai Diskon</Label>
              <Input type="number" value={form.discount_value} onChange={e => setForm(p => ({ ...p, discount_value: parseInt(e.target.value) || 0 }))} className="bg-background/50" />
            </div>
            <div>
              <Label>Min. Pembelian (Rp)</Label>
              <Input type="number" value={form.min_amount} onChange={e => setForm(p => ({ ...p, min_amount: parseInt(e.target.value) || 0 }))} className="bg-background/50" />
            </div>
            <div>
              <Label>Maks Penggunaan (kosong = unlimited)</Label>
              <Input type="number" value={form.max_uses} onChange={e => setForm(p => ({ ...p, max_uses: e.target.value }))} placeholder="Unlimited" className="bg-background/50" />
            </div>
            <div>
              <Label>Kadaluarsa (kosong = tidak ada)</Label>
              <Input type="datetime-local" value={form.expires_at} onChange={e => setForm(p => ({ ...p, expires_at: e.target.value }))} className="bg-background/50" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.is_active} onCheckedChange={v => setForm(p => ({ ...p, is_active: v }))} />
            <Label>Aktif</Label>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave}>{editing ? 'Update' : 'Tambah'}</Button>
            {editing && <Button variant="outline" onClick={resetForm}>Batal</Button>}
          </div>
        </div>

        {/* List */}
        {loading ? <p className="text-muted-foreground text-sm">Loading...</p> : promos.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">Belum ada kode promo</p>
        ) : (
          <div className="space-y-3">
            {promos.map(p => (
              <div key={p.id} className="bg-muted/20 border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-primary">{p.code}</span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { navigator.clipboard.writeText(p.code); toast({ title: "Disalin!" }); }}>
                      <Copy className="w-3 h-3" />
                    </Button>
                    {!p.is_active && <span className="text-xs bg-destructive/20 text-destructive px-2 py-0.5 rounded">Nonaktif</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Diskon: {p.discount_type === 'percentage' ? `${p.discount_value}%` : `Rp ${p.discount_value.toLocaleString()}`}
                    {p.min_amount > 0 && ` · Min Rp ${p.min_amount.toLocaleString()}`}
                    {p.max_uses && ` · ${p.used_count}/${p.max_uses} digunakan`}
                    {p.expires_at && ` · Exp: ${new Date(p.expires_at).toLocaleDateString('id-ID')}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => startEdit(p)}><Edit2 className="w-3 h-3" /></Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(p.id)}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PromoManagement;
