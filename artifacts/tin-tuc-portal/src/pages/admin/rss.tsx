import { useEffect, useRef, useState } from 'react';
import { Edit2, Plus, RefreshCw, Rss, Trash2 } from 'lucide-react';
import { AdminPage, Badge, Btn, Input, Modal, Select, useAdmin } from './layout';

type Category = { id: number; name: string };
type Country = { id: number; name: string };

type Feed = {
  id: number; name: string; url: string; active: boolean;
  categoryId: number; countryId: number | null;
  lastFetchedAt: string | null; itemsImported: number;
};

type IngestResult = {
  feedId: number; feedName: string;
  fetched: number; skipped: number; imported: number; errors: string[];
};

type FeedForm = { name: string; url: string; categoryId: string; countryId: string; active: boolean };
const EMPTY: FeedForm = { name: '', url: '', categoryId: '', countryId: '', active: true };

// curated presets to help users get started quickly
const PRESETS = [
  { name: 'Aktuálně.cz – Hlavní zprávy', url: 'https://zpravy.aktualne.cz/rss/rss.xml' },
  { name: 'iDNES.cz', url: 'https://servis.idnes.cz/rss.aspx?c=zpravodajstvi' },
  { name: 'ČT24', url: 'https://ct24.ceskatelevize.cz/rss/hlavni-zpravy' },
  { name: 'VnExpress – Thời sự', url: 'https://vnexpress.net/rss/tin-tuc.rss' },
  { name: 'BBC Vietnamese', url: 'https://feeds.bbci.co.uk/vietnamese/rss.xml' },
  { name: 'RFI Vietnamese', url: 'https://www.rfi.fr/vi/rss' },
  { name: 'DW Vietnamese', url: 'https://rss.dw.com/xml/rss-vi-all' },
  { name: 'Thanh Niên', url: 'https://thanhnien.vn/rss/home.rss' },
];

export default function AdminRSS() {
  const { apiFetch } = useAdmin();
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [modal, setModal] = useState<{ open: boolean; editing: Feed | null }>({ open: false, editing: null });
  const [form, setForm] = useState<FeedForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [ingestLog, setIngestLog] = useState<IngestResult[]>([]);
  const [ingesting, setIngesting] = useState<number | 'all' | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const [f, c, ct] = await Promise.all([
      apiFetch<Feed[]>('/rss/feeds'),
      apiFetch<Category[]>('/categories'),
      apiFetch<Country[]>('/countries'),
    ]);
    setFeeds(f); setCategories(c); setCountries(ct);
  };

  useEffect(() => { load(); }, [apiFetch]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = (preset?: typeof PRESETS[0]) => {
    const defaultCatId = categories.length > 0 ? String(categories[0].id) : '';
    setForm(preset ? { ...EMPTY, name: preset.name, url: preset.url, categoryId: defaultCatId } : { ...EMPTY, categoryId: defaultCatId });
    setFormError(''); setModal({ open: true, editing: null });
  };
  const openEdit = (f: Feed) => {
    setFormError('');
    setForm({ name: f.name, url: f.url, categoryId: String(f.categoryId), countryId: f.countryId ? String(f.countryId) : '', active: f.active });
    setModal({ open: true, editing: f });
  };
  const deleteFeed = async (id: number) => {
    if (!confirm('Xóa feed này?')) return;
    await apiFetch(`/rss/feeds/${id}`, { method: 'DELETE' });
    load();
  };
  const ff = (k: keyof FeedForm, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  const saveFeed = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setFormError('');
    const targetCatId = form.categoryId || (categories.length > 0 ? String(categories[0].id) : '1');
    try {
      const body = { ...form, categoryId: Number(targetCatId), countryId: form.countryId ? Number(form.countryId) : null };
      if (modal.editing) {
        await apiFetch(`/rss/feeds/${modal.editing.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await apiFetch('/rss/feeds', { method: 'POST', body: JSON.stringify(body) });
      }
      setModal({ open: false, editing: null }); load();
    } catch (err: unknown) { setFormError(err instanceof Error ? err.message : 'Lỗi'); }
    setSaving(false);
  };

  const triggerIngest = async (feedId: number | 'all') => {
    setIngesting(feedId);
    try {
      const path = feedId === 'all' ? '/rss/ingest-all' : `/rss/feeds/${feedId}/ingest`;
      const results = await apiFetch<IngestResult[]>(path, { method: 'POST' });
      setIngestLog((prev) => [...results, ...prev].slice(0, 50));
      load();
      setTimeout(() => logRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi không xác định');
    }
    setIngesting(null);
  };

  const fmtDate = (s: string | null) => s ? new Date(s).toLocaleString('vi-VN') : 'Chưa lấy';

  return (
    <AdminPage title="Quản lý RSS Feeds">
      {/* Header actions */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <Btn onClick={() => openCreate()}><Plus size={14} /> Thêm feed</Btn>
        <Btn variant="secondary" onClick={() => triggerIngest('all')} disabled={ingesting !== null || !feeds.some(f => f.active)}>
          <RefreshCw size={14} style={{ animation: ingesting === 'all' ? 'spin 1s linear infinite' : 'none' }} />
          {ingesting === 'all' ? 'Đang lấy tin…' : 'Lấy tất cả feeds'}
        </Btn>
        <span style={{ fontSize: '0.8rem', color: 'var(--color-ink-light)', marginLeft: 'auto' }}>{feeds.length} feeds • {feeds.filter(f=>f.active).length} đang hoạt động</span>
      </div>

      {/* Feed table */}
      <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: 'var(--color-bone)' }}>
              {['Feed', 'Danh mục', 'Trạng thái', 'Lần cuối lấy', 'Đã nhập', ''].map((h) => (
                <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, fontSize: '0.8rem', borderBottom: '1px solid var(--color-rule)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {feeds.map((f) => (
              <tr key={f.id} style={{ borderBottom: '1px solid var(--color-bone)' }}>
                <td style={{ padding: '0.6rem 0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Rss size={14} color="var(--color-crimson)" style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 600, color: '#111' }}>{f.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-ink-light)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>{f.url}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '0.6rem 0.75rem', color: 'var(--color-ink-light)', fontSize: '0.82rem' }}>
                  {categories.find(c => c.id === f.categoryId)?.name ?? f.categoryId}
                </td>
                <td style={{ padding: '0.6rem 0.75rem' }}>
                  <Badge color={f.active ? 'green' : 'gray'}>{f.active ? 'Đang bật' : 'Tắt'}</Badge>
                </td>
                <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.8rem', color: 'var(--color-ink-light)' }}>{fmtDate(f.lastFetchedAt)}</td>
                <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600, color: 'var(--color-navy)' }}>{f.itemsImported.toLocaleString('vi-VN')}</td>
                <td style={{ padding: '0.6rem 0.75rem' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Btn size="sm" variant="ghost" onClick={() => triggerIngest(f.id)} disabled={ingesting !== null}>
                      <RefreshCw size={12} style={{ animation: ingesting === f.id ? 'spin 1s linear infinite' : 'none' }} />
                    </Btn>
                    <Btn size="sm" variant="secondary" onClick={() => openEdit(f)}><Edit2 size={12} /></Btn>
                    <Btn size="sm" variant="danger" onClick={() => deleteFeed(f.id)}><Trash2 size={12} /></Btn>
                  </div>
                </td>
              </tr>
            ))}
            {!feeds.length && (
              <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-ink-light)' }}>
                Chưa có feed nào. Thêm feed bên dưới hoặc chọn từ danh sách gợi ý.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Preset feed suggestions */}
      <div style={{ marginBottom: '1.5rem' }}>
        <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-ink)', marginBottom: '0.5rem' }}>
          Nguồn tin gợi ý — click để thêm nhanh:
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PRESETS.filter(p => !feeds.find(f => f.url === p.url)).map((preset) => (
            <button
              key={preset.url}
              onClick={() => openCreate(preset)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '0.3rem 0.75rem', borderRadius: 9999,
                border: '1px solid var(--color-rule)', background: '#fff',
                cursor: 'pointer', fontSize: '0.8rem', color: 'var(--color-ink)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              <Rss size={12} color="var(--color-crimson)" />
              {preset.name}
            </button>
          ))}
          {PRESETS.every(p => feeds.find(f => f.url === p.url)) && (
            <span style={{ fontSize: '0.8rem', color: 'var(--color-ink-light)' }}>Đã thêm tất cả nguồn gợi ý.</span>
          )}
        </div>
      </div>

      {/* Ingest log */}
      {ingestLog.length > 0 && (
        <div ref={logRef}>
          <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-navy)', marginBottom: '0.5rem' }}>Kết quả lấy tin gần đây:</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ingestLog.slice(0, 10).map((r, i) => (
              <div key={i} style={{
                background: r.errors.length ? '#fef2f2' : '#f0fdf4',
                border: `1px solid ${r.errors.length ? '#fecaca' : '#bbf7d0'}`,
                borderRadius: 6, padding: '0.65rem 0.85rem', fontSize: '0.82rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: r.errors.length ? 6 : 0 }}>
                  <Rss size={13} color={r.errors.length ? 'var(--color-crimson)' : '#16a34a'} />
                  <strong>{r.feedName}</strong>
                  <span style={{ color: 'var(--color-ink-light)', marginLeft: 'auto' }}>
                    Lấy: {r.fetched} · Bỏ qua: {r.skipped} ·{' '}
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>Nhập mới: {r.imported}</span>
                  </span>
                </div>
                {r.errors.map((e, j) => (
                  <div key={j} style={{ color: 'var(--color-crimson)', fontSize: '0.78rem', marginTop: 2 }}>⚠ {e}</div>
                ))}
              </div>
            ))}
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--color-ink-light)', marginTop: 6 }}>
            Bài mới đã được lưu dưới dạng <strong>bản nháp</strong> → vào <a href="/admin/articles" style={{ color: 'var(--color-crimson)' }}>Bài viết</a> để duyệt và xuất bản.
          </p>
        </div>
      )}

      {/* Add/Edit modal */}
      {modal.open && (
        <Modal
          title={modal.editing ? 'Chỉnh sửa feed' : 'Thêm RSS feed'}
          onClose={() => setModal({ open: false, editing: null })}
        >
          <form onSubmit={saveFeed}>
            <Input label="Tên nguồn tin *" value={form.name} onChange={(e) => ff('name', e.target.value)} required placeholder="Ví dụ: Aktuálně.cz" />
            <Input label="URL RSS/Atom *" value={form.url} onChange={(e) => ff('url', e.target.value)} required placeholder="https://example.com/rss.xml" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }} />
            <Select label="Danh mục mặc định *" value={form.categoryId} onChange={(e) => ff('categoryId', e.target.value)} required>
              <option value="">-- Chọn danh mục --</option>
              {categories.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
            </Select>
            <Select label="Quốc gia mặc định" value={form.countryId} onChange={(e) => ff('countryId', e.target.value)}>
              <option value="">-- Không có --</option>
              {countries.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
            </Select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer', marginBottom: '1rem' }}>
              <input type="checkbox" checked={form.active} onChange={(e) => ff('active', e.target.checked)} />
              Bật tự động lấy tin
            </label>
            {formError && <p style={{ color: 'var(--color-crimson)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{formError}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn variant="ghost" onClick={() => setModal({ open: false, editing: null })}>Hủy</Btn>
              <Btn type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu'}</Btn>
            </div>
          </form>
        </Modal>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </AdminPage>
  );
}
