import { useEffect, useState } from 'react';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { AdminPage, Badge, Btn, Input, Modal, Select, Textarea, useAdmin } from './layout';

type Event = {
  id: number; title: string; description: string | null; startDate: string; endDate: string | null;
  location: string | null; image: string | null; registrationUrl: string | null; eventType: string;
};

type FormData = {
  title: string; description: string; startDate: string; endDate: string;
  location: string; image: string; registrationUrl: string; eventType: string;
};

const EMPTY: FormData = { title: '', description: '', startDate: '', endDate: '', location: '', image: '', registrationUrl: '', eventType: 'community' };

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function AdminEvents() {
  const { apiFetch } = useAdmin();
  const [events, setEvents] = useState<Event[]>([]);
  const [modal, setModal] = useState<{ open: boolean; editing: Event | null }>({ open: false, editing: null });
  const [form, setForm] = useState<FormData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => apiFetch<Event[]>('/events').then(setEvents);
  useEffect(() => { load(); }, [apiFetch]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => { setForm(EMPTY); setError(''); setModal({ open: true, editing: null }); };
  const openEdit = (ev: Event) => {
    setError('');
    setForm({
      title: ev.title, description: ev.description ?? '',
      startDate: ev.startDate.slice(0, 16), endDate: ev.endDate?.slice(0, 16) ?? '',
      location: ev.location ?? '', image: ev.image ?? '',
      registrationUrl: ev.registrationUrl ?? '', eventType: ev.eventType,
    });
    setModal({ open: true, editing: ev });
  };
  const handleDelete = async (id: number) => {
    if (!confirm('Xóa sự kiện này?')) return;
    await apiFetch(`/events/${id}`, { method: 'DELETE' });
    load();
  };
  const f = (k: keyof FormData, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const body = { ...form, endDate: form.endDate || null, description: form.description || null, location: form.location || null, image: form.image || null, registrationUrl: form.registrationUrl || null };
      if (modal.editing) {
        await apiFetch(`/events/${modal.editing.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await apiFetch('/events', { method: 'POST', body: JSON.stringify(body) });
      }
      setModal({ open: false, editing: null }); load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Lỗi'); }
    setSaving(false);
  };

  return (
    <AdminPage title="Quản lý sự kiện">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
        <Btn onClick={openCreate}><Plus size={14} /> Sự kiện mới</Btn>
      </div>

      <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: 'var(--color-bone)' }}>
              {['Tên sự kiện', 'Loại', 'Thời gian', 'Địa điểm', ''].map(h => (
                <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, fontSize: '0.8rem', borderBottom: '1px solid var(--color-rule)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => (
              <tr key={ev.id} style={{ borderBottom: '1px solid var(--color-bone)' }}>
                <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600, color: 'var(--color-navy)' }}>{ev.title}</td>
                <td style={{ padding: '0.6rem 0.75rem' }}>
                  <Badge color={ev.eventType === 'golf' ? 'green' : 'gray'}>{ev.eventType}</Badge>
                </td>
                <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.82rem', color: 'var(--color-ink-light)' }}>
                  {fmtDate(ev.startDate)}{ev.endDate && ` – ${fmtDate(ev.endDate)}`}
                </td>
                <td style={{ padding: '0.6rem 0.75rem', color: 'var(--color-ink-light)' }}>{ev.location ?? '—'}</td>
                <td style={{ padding: '0.6rem 0.75rem' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Btn size="sm" variant="secondary" onClick={() => openEdit(ev)}><Edit2 size={12} /></Btn>
                    <Btn size="sm" variant="danger" onClick={() => handleDelete(ev.id)}><Trash2 size={12} /></Btn>
                  </div>
                </td>
              </tr>
            ))}
            {!events.length && <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-ink-light)' }}>Chưa có sự kiện</td></tr>}
          </tbody>
        </table>
      </div>

      {modal.open && (
        <Modal title={modal.editing ? 'Chỉnh sửa sự kiện' : 'Tạo sự kiện mới'} onClose={() => setModal({ open: false, editing: null })}>
          <form onSubmit={handleSave}>
            <Input label="Tên sự kiện *" value={form.title} onChange={(e) => f('title', e.target.value)} required />
            <Select label="Loại sự kiện" value={form.eventType} onChange={(e) => f('eventType', e.target.value)}>
              <option value="community">Cộng đồng</option>
              <option value="business">Kinh doanh</option>
            </Select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
              <Input label="Ngày bắt đầu *" type="datetime-local" value={form.startDate} onChange={(e) => f('startDate', e.target.value)} required />
              <Input label="Ngày kết thúc" type="datetime-local" value={form.endDate} onChange={(e) => f('endDate', e.target.value)} />
            </div>
            <Input label="Địa điểm" value={form.location} onChange={(e) => f('location', e.target.value)} />
            <Input label="Hình ảnh (URL)" value={form.image} onChange={(e) => f('image', e.target.value)} placeholder="https://…" />
            <Input label="URL đăng ký" value={form.registrationUrl} onChange={(e) => f('registrationUrl', e.target.value)} />
            <Textarea label="Mô tả" value={form.description} onChange={(e) => f('description', e.target.value)} rows={3} />
            {error && <p style={{ color: 'var(--color-crimson)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn variant="ghost" onClick={() => setModal({ open: false, editing: null })}>Hủy</Btn>
              <Btn type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu'}</Btn>
            </div>
          </form>
        </Modal>
      )}
    </AdminPage>
  );
}
