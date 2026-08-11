import { useEffect, useState } from 'react';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { AdminPage, Btn, Input, Modal, useAdmin } from './layout';

type Cat = { id: number; name: string; slug: string; description: string | null };
type Cty = { id: number; name: string; slug: string; code: string | null };
type Auth = { id: number; name: string; bio: string | null; avatar: string | null };

function slugify(t: string) {
  const m: Record<string, string> = { à:'a',á:'a',â:'a',ã:'a',ä:'a',è:'e',é:'e',ê:'e',ë:'e',ì:'i',í:'i',î:'i',ï:'i',ò:'o',ó:'o',ô:'o',õ:'o',ö:'o',ù:'u',ú:'u',û:'u',ü:'u',ý:'y',ÿ:'y',đ:'d',ă:'a',ắ:'a',ặ:'a',ẵ:'a',ẳ:'a',ằ:'a',ấ:'a',ầ:'a',ẩ:'a',ẫ:'a',ậ:'a',ế:'e',ề:'e',ể:'e',ễ:'e',ệ:'e',ố:'o',ồ:'o',ổ:'o',ỗ:'o',ộ:'o',ớ:'o',ờ:'o',ở:'o',ỡ:'o',ợ:'o',ứ:'u',ừ:'u',ử:'u',ữ:'u',ự:'u',ơ:'o',ư:'u',ả:'a',ạ:'a',ẻ:'e',ẽ:'e',ẹ:'e',ỉ:'i',ĩ:'i',ị:'i',ỏ:'o',ọ:'o',ủ:'u',ũ:'u',ụ:'u',ỳ:'y',ỷ:'y',ỹ:'y',ỵ:'y' };
  return t.toLowerCase().split('').map(c => m[c] ?? c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

type Tab = 'categories' | 'countries' | 'authors';

export default function AdminTaxonomy() {
  const { apiFetch } = useAdmin();
  const [tab, setTab] = useState<Tab>('categories');
  const [cats, setCats] = useState<Cat[]>([]);
  const [ctys, setCtys] = useState<Cty[]>([]);
  const [auths, setAuths] = useState<Auth[]>([]);
  const [modal, setModal] = useState<{ open: boolean; type: Tab; item: Cat | Cty | Auth | null }>({ open: false, type: 'categories', item: null });
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const [c, ct, a] = await Promise.all([
      apiFetch<Cat[]>('/categories'),
      apiFetch<Cty[]>('/countries'),
      apiFetch<Auth[]>('/authors'),
    ]);
    setCats(c); setCtys(ct); setAuths(a);
  };

  useEffect(() => { load(); }, [apiFetch]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = (t: Tab) => {
    setForm({}); setError('');
    setModal({ open: true, type: t, item: null });
  };

  const openEdit = (t: Tab, item: Cat | Cty | Auth) => {
    setError('');
    setForm({ ...Object.fromEntries(Object.entries(item).map(([k, v]) => [k, v != null ? String(v) : ''])) });
    setModal({ open: true, type: t, item });
  };

  const handleDelete = async (t: Tab, id: number) => {
    if (!confirm('Xóa mục này?')) return;
    const ep = t === 'categories' ? `/categories/${id}` : t === 'countries' ? `/countries/${id}` : `/authors/${id}`;
    await apiFetch(ep, { method: 'DELETE' });
    load();
  };

  const ff = (k: string, v: string) => {
    setForm((p) => {
      const next = { ...p, [k]: v };
      if ((k === 'name') && !modal.item) next.slug = slugify(v);
      return next;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const { type, item } = modal;
      const ep = type === 'categories' ? '/categories' : type === 'countries' ? '/countries' : '/authors';
      const body = { ...form };
      if (item) {
        await apiFetch(`${ep}/${(item as { id: number }).id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await apiFetch(ep, { method: 'POST', body: JSON.stringify(body) });
      }
      setModal({ open: false, type: 'categories', item: null });
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi');
    }
    setSaving(false);
  };

  const TAB_LABELS: Record<Tab, string> = { categories: 'Danh mục', countries: 'Quốc gia', authors: 'Tác giả' };

  return (
    <AdminPage title="Danh mục & Tác giả">
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: '1.25rem', borderBottom: '2px solid var(--color-rule)' }}>
        {(['categories', 'countries', 'authors'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '0.5rem 1.25rem', border: 'none', background: 'transparent', cursor: 'pointer',
            fontFamily: 'var(--font-sans)', fontSize: '0.9rem', fontWeight: tab === t ? 700 : 400,
            color: tab === t ? 'var(--color-navy)' : 'var(--color-ink-light)',
            borderBottom: tab === t ? '2px solid var(--color-navy)' : '2px solid transparent',
            marginBottom: -2,
          }}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
        <Btn onClick={() => openCreate(tab)}><Plus size={14} /> Thêm {TAB_LABELS[tab]}</Btn>
      </div>

      {/* Tables */}
      {tab === 'categories' && (
        <SimpleTable
          rows={cats} headers={['Tên', 'Slug', 'Mô tả', '']}
          renderRow={(c) => [c.name, <code style={{ fontSize: '0.78rem' }}>{c.slug}</code>, c.description ?? '—',
            <div style={{ display: 'flex', gap: 4 }}>
              <Btn size="sm" variant="secondary" onClick={() => openEdit('categories', c)}><Edit2 size={12} /></Btn>
              <Btn size="sm" variant="danger" onClick={() => handleDelete('categories', c.id)}><Trash2 size={12} /></Btn>
            </div>
          ]}
        />
      )}

      {tab === 'countries' && (
        <SimpleTable
          rows={ctys} headers={['Tên', 'Slug', 'Mã', '']}
          renderRow={(c) => [c.name, <code style={{ fontSize: '0.78rem' }}>{c.slug}</code>, c.code ?? '—',
            <div style={{ display: 'flex', gap: 4 }}>
              <Btn size="sm" variant="secondary" onClick={() => openEdit('countries', c)}><Edit2 size={12} /></Btn>
              <Btn size="sm" variant="danger" onClick={() => handleDelete('countries', c.id)}><Trash2 size={12} /></Btn>
            </div>
          ]}
        />
      )}

      {tab === 'authors' && (
        <SimpleTable
          rows={auths} headers={['Tên', 'Bio', '']}
          renderRow={(a) => [a.name, <span style={{ color: 'var(--color-ink-light)', fontSize: '0.82rem' }}>{a.bio ?? '—'}</span>,
            <div style={{ display: 'flex', gap: 4 }}>
              <Btn size="sm" variant="secondary" onClick={() => openEdit('authors', a)}><Edit2 size={12} /></Btn>
              <Btn size="sm" variant="danger" onClick={() => handleDelete('authors', a.id)}><Trash2 size={12} /></Btn>
            </div>
          ]}
        />
      )}

      {/* Modal */}
      {modal.open && (
        <Modal title={modal.item ? `Chỉnh sửa ${TAB_LABELS[modal.type]}` : `Thêm ${TAB_LABELS[modal.type]}`} onClose={() => setModal({ open: false, type: 'categories', item: null })}>
          <form onSubmit={handleSave}>
            <Input label="Tên *" value={form.name ?? ''} onChange={(e) => ff('name', e.target.value)} required />
            {modal.type !== 'authors' && (
              <Input label="Slug" value={form.slug ?? ''} onChange={(e) => ff('slug', e.target.value)} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }} />
            )}
            {modal.type === 'categories' && (
              <Input label="Mô tả" value={form.description ?? ''} onChange={(e) => ff('description', e.target.value)} />
            )}
            {modal.type === 'countries' && (
              <Input label="Mã quốc gia (ISO 2)" value={form.code ?? ''} onChange={(e) => ff('code', e.target.value)} maxLength={2} />
            )}
            {modal.type === 'authors' && (
              <>
                <Input label="Bio" value={form.bio ?? ''} onChange={(e) => ff('bio', e.target.value)} />
                <Input label="Avatar URL" value={form.avatar ?? ''} onChange={(e) => ff('avatar', e.target.value)} />
              </>
            )}
            {error && <p style={{ color: 'var(--color-crimson)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn variant="ghost" onClick={() => setModal({ open: false, type: 'categories', item: null })}>Hủy</Btn>
              <Btn type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu'}</Btn>
            </div>
          </form>
        </Modal>
      )}
    </AdminPage>
  );
}

function SimpleTable<T extends { id: number }>({
  rows, headers, renderRow,
}: {
  rows: T[]; headers: string[];
  renderRow: (row: T) => (React.ReactNode)[];
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ background: 'var(--color-bone)' }}>
            {headers.map((h) => (
              <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, fontSize: '0.8rem', color: 'var(--color-ink)', borderBottom: '1px solid var(--color-rule)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} style={{ borderBottom: '1px solid var(--color-bone)' }}>
              {renderRow(row).map((cell, i) => (
                <td key={i} style={{ padding: '0.55rem 0.75rem' }}>{cell}</td>
              ))}
            </tr>
          ))}
          {!rows.length && (
            <tr><td colSpan={headers.length} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-ink-light)' }}>Chưa có dữ liệu</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
