import { useEffect, useState } from 'react';
import { Mail, Trash2, Eye } from 'lucide-react';
import { AdminPage, Btn, Modal, useAdmin } from './layout';

type Submission = {
  id: number; name: string; email: string; phone: string | null;
  subject: string; message: string; read: boolean; createdAt: string;
};

function fmtDate(s: string) {
  return new Date(s).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function AdminContacts() {
  const { apiFetch } = useAdmin();
  const [items, setItems] = useState<Submission[]>([]);
  const [viewing, setViewing] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const data = await apiFetch<Submission[]>('/contacts');
    setItems(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const markRead = async (id: number) => {
    await apiFetch(`/contacts/${id}/read`, { method: 'PATCH' });
    setItems((prev) => prev.map((s) => s.id === id ? { ...s, read: true } : s));
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Xóa tin nhắn này?')) return;
    await apiFetch(`/contacts/${id}`, { method: 'DELETE' });
    setViewing(null);
    load();
  };

  const openView = (s: Submission) => {
    setViewing(s);
    if (!s.read) markRead(s.id);
  };

  const unread = items.filter((s) => !s.read).length;

  return (
    <AdminPage title={`Tin nhắn liên hệ${unread > 0 ? ` (${unread} chưa đọc)` : ''}`}>
      {loading ? (
        <p style={{ color: 'var(--color-ink-light)', padding: '2rem 0' }}>Đang tải…</p>
      ) : (
        <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--color-bone)' }}>
                {['', 'Họ tên', 'Email', 'Tiêu đề', 'Thời gian', ''].map((h, i) => (
                  <th key={i} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, fontSize: '0.8rem', borderBottom: '1px solid var(--color-rule)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr
                  key={s.id}
                  style={{ borderBottom: '1px solid var(--color-bone)', background: s.read ? '#fff' : '#fef9f0', cursor: 'pointer' }}
                  onClick={() => openView(s)}
                >
                  <td style={{ padding: '0.6rem 0.75rem', width: 8 }}>
                    {!s.read && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--color-crimson)' }} />}
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', fontWeight: s.read ? 400 : 700 }}>{s.name}</td>
                  <td style={{ padding: '0.6rem 0.75rem', color: 'var(--color-ink-light)' }}>{s.email}</td>
                  <td style={{ padding: '0.6rem 0.75rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.subject}</td>
                  <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.8rem', color: 'var(--color-ink-light)', whiteSpace: 'nowrap' }}>{fmtDate(s.createdAt)}</td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>
                    <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                      <Btn size="sm" variant="secondary" onClick={() => openView(s)}><Eye size={12} /></Btn>
                      <Btn size="sm" variant="danger" onClick={() => handleDelete(s.id)}><Trash2 size={12} /></Btn>
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-ink-light)' }}>Chưa có tin nhắn nào.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {viewing && (
        <Modal title="Chi tiết tin nhắn" onClose={() => setViewing(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
            <Row label="Họ tên" value={viewing.name} />
            <Row label="Email" value={<a href={`mailto:${viewing.email}`} style={{ color: 'var(--color-crimson)' }}>{viewing.email}</a>} />
            {viewing.phone && <Row label="Điện thoại" value={viewing.phone} />}
            <Row label="Tiêu đề" value={viewing.subject} />
            <Row label="Thời gian" value={fmtDate(viewing.createdAt)} />
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--color-ink-light)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>Nội dung</div>
              <div style={{ background: 'var(--color-bone)', borderRadius: 6, padding: '0.75rem 1rem', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{viewing.message}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 4 }}>
              <Btn variant="danger" onClick={() => handleDelete(viewing.id)}><Trash2 size={13} /> Xóa</Btn>
              <a href={`mailto:${viewing.email}?subject=Re: ${encodeURIComponent(viewing.subject)}`}>
                <Btn onClick={() => {}}><Mail size={13} /> Trả lời email</Btn>
              </a>
            </div>
          </div>
        </Modal>
      )}
    </AdminPage>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <span style={{ fontWeight: 600, color: 'var(--color-ink-light)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '.04em', width: 90, flexShrink: 0, paddingTop: 1 }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
