import { useEffect, useState } from 'react';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { AdminPage, Badge, Btn, Input, Modal, useAdmin } from './layout';

type Subscriber = { id: number; email: string; active: boolean; subscribedAt: string };
type SubList = { items: Subscriber[]; total: number; page: number; pageSize: number };
type Banner = { id: number; name: string; image: string | null; targetUrl: string | null; position: string; enabled: boolean };

type BannerForm = { name: string; image: string; targetUrl: string; position: string; enabled: boolean };
const BANNER_EMPTY: BannerForm = { name: '', image: '', targetUrl: '', position: 'sidebar', enabled: true };

type Tab = 'subscribers' | 'banners';

export default function AdminNewsletter() {
  const { apiFetch } = useAdmin();
  const [tab, setTab] = useState<Tab>('subscribers');
  const [subs, setSubs] = useState<SubList | null>(null);
  const [subPage, setSubPage] = useState(1);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [bannerModal, setBannerModal] = useState<{ open: boolean; editing: Banner | null }>({ open: false, editing: null });
  const [bForm, setBForm] = useState<BannerForm>(BANNER_EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadSubs = () => {
    apiFetch<SubList>(`/newsletter?page=${subPage}&pageSize=30`).then(setSubs);
  };
  const loadBanners = () => apiFetch<Banner[]>('/banners').then(setBanners);

  useEffect(() => { loadSubs(); }, [apiFetch, subPage]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadBanners(); }, [apiFetch]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSub = async (id: number, active: boolean) => {
    await apiFetch(`/newsletter/${id}`, { method: 'PATCH', body: JSON.stringify({ active: !active }) });
    loadSubs();
  };
  const deleteSub = async (id: number) => {
    if (!confirm('Xóa người đăng ký này?')) return;
    await apiFetch(`/newsletter/${id}`, { method: 'DELETE' });
    loadSubs();
  };

  const openBannerCreate = () => { setBForm(BANNER_EMPTY); setError(''); setBannerModal({ open: true, editing: null }); };
  const openBannerEdit = (b: Banner) => {
    setError('');
    setBForm({ name: b.name, image: b.image ?? '', targetUrl: b.targetUrl ?? '', position: b.position, enabled: b.enabled });
    setBannerModal({ open: true, editing: b });
  };
  const deleteBanner = async (id: number) => {
    if (!confirm('Xóa banner này?')) return;
    await apiFetch(`/banners/${id}`, { method: 'DELETE' });
    loadBanners();
  };
  const bf = (k: keyof BannerForm, v: string | boolean) => setBForm((p) => ({ ...p, [k]: v }));
  const saveBanner = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const body = { ...bForm, image: bForm.image || null, targetUrl: bForm.targetUrl || null };
      if (bannerModal.editing) {
        await apiFetch(`/banners/${bannerModal.editing.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await apiFetch('/banners', { method: 'POST', body: JSON.stringify(body) });
      }
      setBannerModal({ open: false, editing: null }); loadBanners();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Lỗi'); }
    setSaving(false);
  };

  return (
    <AdminPage title="Newsletter & Quảng cáo">
      <div style={{ display: 'flex', gap: 0, marginBottom: '1.25rem', borderBottom: '2px solid var(--color-rule)' }}>
        {(['subscribers', 'banners'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '0.5rem 1.25rem', border: 'none', background: 'transparent', cursor: 'pointer',
            fontFamily: 'var(--font-sans)', fontSize: '0.9rem', fontWeight: tab === t ? 700 : 400,
            color: tab === t ? 'var(--color-navy)' : 'var(--color-ink-light)',
            borderBottom: tab === t ? '2px solid var(--color-navy)' : '2px solid transparent', marginBottom: -2,
          }}>
            {t === 'subscribers' ? 'Người đăng ký' : 'Banners quảng cáo'}
          </button>
        ))}
      </div>

      {tab === 'subscribers' && (
        <>
          {subs && <p style={{ fontSize: '0.82rem', color: 'var(--color-ink-light)', marginBottom: '0.75rem' }}>Tổng: {subs.total} người đăng ký</p>}
          <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'var(--color-bone)' }}>
                  {['Email', 'Trạng thái', 'Ngày đăng ký', ''].map((h) => (
                    <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, fontSize: '0.8rem', borderBottom: '1px solid var(--color-rule)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subs?.items.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--color-bone)' }}>
                    <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>{s.email}</td>
                    <td style={{ padding: '0.6rem 0.75rem' }}><Badge color={s.active ? 'green' : 'gray'}>{s.active ? 'Đang hoạt động' : 'Đã hủy'}</Badge></td>
                    <td style={{ padding: '0.6rem 0.75rem', color: 'var(--color-ink-light)', fontSize: '0.82rem' }}>{new Date(s.subscribedAt).toLocaleDateString('vi-VN')}</td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Btn size="sm" variant="ghost" onClick={() => toggleSub(s.id, s.active)}>{s.active ? 'Hủy đăng ký' : 'Kích hoạt'}</Btn>
                        <Btn size="sm" variant="danger" onClick={() => deleteSub(s.id)}><Trash2 size={12} /></Btn>
                      </div>
                    </td>
                  </tr>
                ))}
                {!subs?.items.length && <tr><td colSpan={4} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-ink-light)' }}>Chưa có người đăng ký</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'banners' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
            <Btn onClick={openBannerCreate}><Plus size={14} /> Banner mới</Btn>
          </div>
          <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'var(--color-bone)' }}>
                  {['Tên', 'Vị trí', 'Trạng thái', ''].map((h) => (
                    <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, fontSize: '0.8rem', borderBottom: '1px solid var(--color-rule)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {banners.map((b) => (
                  <tr key={b.id} style={{ borderBottom: '1px solid var(--color-bone)' }}>
                    <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>{b.name}</td>
                    <td style={{ padding: '0.6rem 0.75rem', color: 'var(--color-ink-light)' }}>{b.position}</td>
                    <td style={{ padding: '0.6rem 0.75rem' }}><Badge color={b.enabled ? 'green' : 'gray'}>{b.enabled ? 'Đang chạy' : 'Tắt'}</Badge></td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Btn size="sm" variant="secondary" onClick={() => openBannerEdit(b)}><Edit2 size={12} /></Btn>
                        <Btn size="sm" variant="danger" onClick={() => deleteBanner(b.id)}><Trash2 size={12} /></Btn>
                      </div>
                    </td>
                  </tr>
                ))}
                {!banners.length && <tr><td colSpan={4} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-ink-light)' }}>Chưa có banner</td></tr>}
              </tbody>
            </table>
          </div>

          {bannerModal.open && (
            <Modal title={bannerModal.editing ? 'Chỉnh sửa banner' : 'Tạo banner mới'} onClose={() => setBannerModal({ open: false, editing: null })}>
              <form onSubmit={saveBanner}>
                <Input label="Tên banner *" value={bForm.name} onChange={(e) => bf('name', e.target.value)} required />
                <Input label="Vị trí *" value={bForm.position} onChange={(e) => bf('position', e.target.value)} placeholder="sidebar / header / footer" required />
                <Input label="Hình ảnh (URL)" value={bForm.image} onChange={(e) => bf('image', e.target.value)} placeholder="https://…" />
                <Input label="URL đích" value={bForm.targetUrl} onChange={(e) => bf('targetUrl', e.target.value)} placeholder="https://…" />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer', marginBottom: '1rem' }}>
                  <input type="checkbox" checked={bForm.enabled} onChange={(e) => bf('enabled', e.target.checked)} />
                  Đang kích hoạt
                </label>
                {error && <p style={{ color: 'var(--color-crimson)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{error}</p>}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <Btn variant="ghost" onClick={() => setBannerModal({ open: false, editing: null })}>Hủy</Btn>
                  <Btn type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu'}</Btn>
                </div>
              </form>
            </Modal>
          )}
        </>
      )}
    </AdminPage>
  );
}
