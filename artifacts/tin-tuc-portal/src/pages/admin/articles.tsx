import React, { useCallback, useEffect, useState } from 'react';
import { Edit2, Eye, Plus, Trash2 } from 'lucide-react';
import { AdminPage, Badge, Btn, Input, Modal, Select, Textarea, useAdmin } from './layout';

type Category = { id: number; name: string; slug: string };
type Country = { id: number; name: string; slug: string };
type Author = { id: number; name: string };
type ArticleRow = {
  id: number; title: string; slug: string; status: string; featured: boolean;
  breakingNews: boolean; views: number; publishedAt: string | null;
  category: Category | null; updatedAt: string;
};
type ArticleDetail = ArticleRow & {
  summary: string; content: string; coverImage: string | null;
  categoryId: number; countryId: number | null; authorId: number | null;
  sourceName: string | null; sourceUrl: string | null; editor: string | null;
};

type ArticleList = { items: ArticleDetail[]; total: number; page: number; pageSize: number };

function slugify(t: string) {
  const m: Record<string, string> = { à:'a',á:'a',â:'a',ã:'a',ä:'a',è:'e',é:'e',ê:'e',ë:'e',ì:'i',í:'i',î:'i',ï:'i',ò:'o',ó:'o',ô:'o',õ:'o',ö:'o',ù:'u',ú:'u',û:'u',ü:'u',ý:'y',ÿ:'y',đ:'d',ă:'a',ắ:'a',ặ:'a',ẵ:'a',ẳ:'a',ằ:'a',ấ:'a',ầ:'a',ẩ:'a',ẫ:'a',ậ:'a',ế:'e',ề:'e',ể:'e',ễ:'e',ệ:'e',ố:'o',ồ:'o',ổ:'o',ỗ:'o',ộ:'o',ớ:'o',ờ:'o',ở:'o',ỡ:'o',ợ:'o',ứ:'u',ừ:'u',ử:'u',ữ:'u',ự:'u',ơ:'o',ư:'u',ả:'a',ạ:'a',ẻ:'e',ẽ:'e',ẹ:'e',ỉ:'i',ĩ:'i',ị:'i',ỏ:'o',ọ:'o',ủ:'u',ũ:'u',ụ:'u',ỳ:'y',ỷ:'y',ỹ:'y',ỵ:'y' };
  return t.toLowerCase().split('').map(c => m[c] ?? c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
}

type FormData = {
  title: string; slug: string; summary: string; content: string; coverImage: string;
  categoryId: string; countryId: string; authorId: string; sourceName: string;
  sourceUrl: string; editor: string; publishedAt: string; status: string;
  featured: boolean; breakingNews: boolean;
};

const EMPTY: FormData = {
  title: '', slug: '', summary: '', content: '<p></p>', coverImage: '',
  categoryId: '', countryId: '', authorId: '', sourceName: '', sourceUrl: '',
  editor: 'VietPress EU', publishedAt: '', status: 'draft', featured: false, breakingNews: false,
};

const selStyle: React.CSSProperties = {
  padding: '0.45rem 0.65rem', border: '1px solid var(--color-rule)',
  borderRadius: 4, fontSize: '0.85rem', fontFamily: 'var(--font-sans)',
  background: '#fff', color: 'var(--color-ink)',
};

export default function AdminArticles() {
  const { apiFetch } = useAdmin();
  const [data, setData] = useState<ArticleList | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [rssOnly, setRssOnly] = useState(false);
  const [dateFilter, setDateFilter] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [modal, setModal] = useState<{ open: boolean; editing: ArticleDetail | null }>({ open: false, editing: null });
  const [form, setForm] = useState<FormData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const q = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (statusFilter) q.set('status', statusFilter);
    if (categoryFilter) q.set('categoryId', categoryFilter);
    if (rssOnly) q.set('rssOnly', '1');
    if (dateFilter) q.set('date', dateFilter);
    const d = await apiFetch<ArticleList>(`/articles?${q}`);
    setData(d);
  }, [apiFetch, page, statusFilter, categoryFilter, rssOnly, dateFilter]);

  useEffect(() => {
    load();
    apiFetch<Category[]>('/categories').then(setCategories).catch(() => {});
    apiFetch<Country[]>('/countries').then(setCountries).catch(() => {});
    apiFetch<Author[]>('/authors').then(setAuthors).catch(() => {});
  }, [load, apiFetch]);

  const openCreate = () => { setForm(EMPTY); setError(''); setModal({ open: true, editing: null }); };
  const openEdit = (a: ArticleDetail) => {
    setError('');
    setForm({
      title: a.title, slug: a.slug, summary: a.summary, content: a.content,
      coverImage: a.coverImage ?? '', categoryId: String(a.categoryId),
      countryId: a.countryId ? String(a.countryId) : '',
      authorId: a.authorId ? String(a.authorId) : '',
      sourceName: a.sourceName ?? '', sourceUrl: a.sourceUrl ?? '',
      editor: a.editor ?? '', status: a.status, featured: a.featured,
      breakingNews: a.breakingNews,
      publishedAt: a.publishedAt ? a.publishedAt.slice(0, 16) : '',
    });
    setModal({ open: true, editing: a });
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Xóa bài viết này?')) return;
    await apiFetch(`/articles/${id}`, { method: 'DELETE' });
    load();
  };

  const f = (k: keyof FormData, v: string | boolean) => {
    setForm((prev) => {
      const next = { ...prev, [k]: v };
      if (k === 'title' && !modal.editing) next.slug = slugify(v as string);
      return next;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const body = {
        ...form,
        categoryId: Number(form.categoryId),
        countryId: form.countryId ? Number(form.countryId) : null,
        authorId: form.authorId ? Number(form.authorId) : null,
        coverImage: form.coverImage || null,
        sourceName: form.sourceName || null,
        sourceUrl: form.sourceUrl || null,
        editor: form.editor || null,
        publishedAt: form.publishedAt || null,
      };
      if (modal.editing) {
        await apiFetch(`/articles/${modal.editing.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await apiFetch('/articles', { method: 'POST', body: JSON.stringify(body) });
      }
      setModal({ open: false, editing: null });
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    }
    setSaving(false);
  };

  const totalPages = Math.ceil((data?.total ?? 0) / 20);

  return (
    <AdminPage title="Quản lý bài viết">
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <Btn onClick={openCreate}><Plus size={14} /> Bài viết mới</Btn>

        {/* Trạng thái */}
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          style={selStyle}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="published">Đã xuất bản</option>
          <option value="draft">Bản nháp</option>
        </select>

        {/* Danh mục */}
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          style={selStyle}
        >
          <option value="">Tất cả danh mục</option>
          {categories.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </select>

        {/* Thời gian */}
        <select
          value={dateFilter}
          onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
          style={selStyle}
        >
          <option value="">Mọi thời gian</option>
          <option value="today">Hôm nay</option>
          <option value="week">7 ngày qua</option>
        </select>

        {/* Chỉ RSS */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.85rem', cursor: 'pointer', padding: '0.45rem 0.65rem', border: '1px solid var(--color-rule)', borderRadius: 4, background: rssOnly ? 'var(--color-navy)' : '#fff', color: rssOnly ? '#fff' : 'var(--color-ink)', userSelect: 'none' }}>
          <input type="checkbox" checked={rssOnly} onChange={(e) => { setRssOnly(e.target.checked); setPage(1); }} style={{ display: 'none' }} />
          RSS only
        </label>

        {data && <span style={{ fontSize: '0.8rem', color: 'var(--color-ink-light)', marginLeft: 'auto' }}>{data.total} bài</span>}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: 'var(--color-bone)', textAlign: 'left' }}>
              {['Tiêu đề', 'Danh mục', 'Trạng thái', 'Lượt đọc', 'Cập nhật', ''].map(h => (
                <th key={h} style={{ padding: '0.6rem 0.75rem', fontWeight: 600, color: '#000', fontSize: '0.8rem', borderBottom: '1px solid var(--color-rule)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.items.map((a) => (
              <tr key={a.id} style={{ borderBottom: '1px solid var(--color-bone)' }}>
                <td style={{ padding: '0.6rem 0.75rem', maxWidth: 340 }}>
                  <div style={{ fontWeight: 600, color: 'var(--color-navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-ink-light)', fontFamily: 'var(--font-mono)' }}>{a.slug}</div>
                </td>
                <td style={{ padding: '0.6rem 0.75rem', color: 'var(--color-ink-light)', whiteSpace: 'nowrap' }}>{a.category?.name ?? '—'}</td>
                <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap' }}>
                  <Badge color={a.status === 'published' ? 'green' : 'orange'}>{a.status}</Badge>
                  {a.featured && <Badge color="gray" children=" ★" />}
                </td>
                <td style={{ padding: '0.6rem 0.75rem', color: 'var(--color-ink-light)' }}>{a.views.toLocaleString('vi-VN')}</td>
                <td style={{ padding: '0.6rem 0.75rem', color: 'var(--color-ink-light)', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                  {new Date(a.updatedAt).toLocaleDateString('vi-VN')}
                </td>
                <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Btn size="sm" variant="ghost" onClick={() => window.open(`/bai-viet/${a.slug}`, '_blank')}><Eye size={12} /></Btn>
                    <Btn size="sm" variant="secondary" onClick={() => openEdit(a)}><Edit2 size={12} /></Btn>
                    <Btn size="sm" variant="danger" onClick={() => handleDelete(a.id)}><Trash2 size={12} /></Btn>
                  </div>
                </td>
              </tr>
            ))}
            {!data?.items.length && (
              <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-ink-light)' }}>Chưa có bài viết</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 6, marginTop: '1rem', justifyContent: 'center' }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => Math.abs(p - page) <= 2).map(p => (
            <button key={p} onClick={() => setPage(p)} style={{ padding: '0.35rem 0.65rem', borderRadius: 4, border: '1px solid var(--color-rule)', background: p === page ? 'var(--color-navy)' : '#fff', color: p === page ? '#fff' : 'var(--color-ink)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.85rem' }}>{p}</button>
          ))}
        </div>
      )}

      {/* Modal form */}
      {modal.open && (
        <Modal title={modal.editing ? 'Chỉnh sửa bài viết' : 'Tạo bài viết mới'} onClose={() => setModal({ open: false, editing: null })}>
          <form onSubmit={handleSave}>
            <Input label="Tiêu đề *" value={form.title} onChange={(e) => f('title', e.target.value)} required />
            <Input label="Slug (tự động từ tiêu đề)" value={form.slug} onChange={(e) => f('slug', e.target.value)} required style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }} />
            <Input label="Ảnh bìa (URL)" value={form.coverImage} onChange={(e) => f('coverImage', e.target.value)} placeholder="https://…" />
            <Textarea label="Tóm tắt" value={form.summary} onChange={(e) => f('summary', e.target.value)} rows={2} />
            <Textarea label="Nội dung (HTML)" value={form.content} onChange={(e) => f('content', e.target.value)} rows={10} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
              <Select label="Danh mục *" value={form.categoryId} onChange={(e) => f('categoryId', e.target.value)} required>
                <option value="">-- Chọn danh mục --</option>
                {categories.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
              </Select>
              <Select label="Quốc gia" value={form.countryId} onChange={(e) => f('countryId', e.target.value)}>
                <option value="">-- Không có --</option>
                {countries.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
              </Select>
              <Select label="Tác giả" value={form.authorId} onChange={(e) => f('authorId', e.target.value)}>
                <option value="">-- Không có --</option>
                {authors.map((a) => <option key={a.id} value={String(a.id)}>{a.name}</option>)}
              </Select>
              <Select label="Trạng thái" value={form.status} onChange={(e) => f('status', e.target.value)}>
                <option value="draft">Bản nháp</option>
                <option value="published">Xuất bản</option>
              </Select>
              <Input label="Nguồn" value={form.sourceName} onChange={(e) => f('sourceName', e.target.value)} />
              <Input label="URL nguồn" value={form.sourceUrl} onChange={(e) => f('sourceUrl', e.target.value)} />
              <Input label="Biên tập" value={form.editor} onChange={(e) => f('editor', e.target.value)} />
              <Input label="Ngày xuất bản" type="datetime-local" value={form.publishedAt} onChange={(e) => f('publishedAt', e.target.value)} />
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.featured} onChange={(e) => f('featured', e.target.checked)} />
                Bài nổi bật (featured)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.breakingNews} onChange={(e) => f('breakingNews', e.target.checked)} />
                Tin nóng (ticker)
              </label>
            </div>

            {error && <p style={{ color: 'var(--color-crimson)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{error}</p>}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn variant="ghost" onClick={() => setModal({ open: false, editing: null })}>Hủy</Btn>
              <Btn type="submit" disabled={saving}>{saving ? 'Đang lưu…' : modal.editing ? 'Cập nhật' : 'Tạo bài'}</Btn>
            </div>
          </form>
        </Modal>
      )}
    </AdminPage>
  );
}
