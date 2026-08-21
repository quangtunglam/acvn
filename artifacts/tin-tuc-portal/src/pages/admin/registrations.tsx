import { useEffect, useState } from 'react';
import { Trash2, Eye } from 'lucide-react';
import { AdminPage, Btn, Modal, useAdmin } from './layout';

type Member = {
  id: number; fullName: string; dateOfBirth: string | null; address: string | null;
  email: string; phone: string | null; occupation: string | null; notes: string | null;
  read: boolean; createdAt: string;
};
type Sponsor = {
  id: number; orgName: string; representative: string | null; email: string; phone: string | null;
  sponsorType: string | null; details: string | null; notes: string | null;
  read: boolean; createdAt: string;
};
type Tab = 'members' | 'sponsors';

function fmtDate(s: string) {
  return new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function UnreadDot() {
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--color-crimson)', flexShrink: 0 }} />;
}

function RowDetail({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <span style={{ fontWeight: 600, color: 'var(--color-ink-light)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '.04em', width: 130, flexShrink: 0, paddingTop: 1 }}>{label}</span>
      <span style={{ fontSize: '0.875rem' }}>{value}</span>
    </div>
  );
}

export default function AdminRegistrations() {
  const { apiFetch } = useAdmin();
  const [tab, setTab] = useState<Tab>('members');
  const [members, setMembers] = useState<Member[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [viewingMember, setViewingMember] = useState<Member | null>(null);
  const [viewingSponsor, setViewingSponsor] = useState<Sponsor | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMembers = async () => {
    const data = await apiFetch<Member[]>('/registrations/members');
    setMembers(data);
  };
  const loadSponsors = async () => {
    const data = await apiFetch<Sponsor[]>('/registrations/sponsors');
    setSponsors(data);
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadMembers(), loadSponsors()]).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const markRead = async (type: Tab, id: number) => {
    await apiFetch(`/registrations/${type}/${id}/read`, { method: 'PATCH' });
    if (type === 'members') setMembers((p) => p.map((r) => r.id === id ? { ...r, read: true } : r));
    else setSponsors((p) => p.map((r) => r.id === id ? { ...r, read: true } : r));
  };

  const deleteRecord = async (type: Tab, id: number) => {
    if (!confirm('Xóa đăng ký này?')) return;
    await apiFetch(`/registrations/${type}/${id}`, { method: 'DELETE' });
    setViewingMember(null); setViewingSponsor(null);
    if (type === 'members') loadMembers(); else loadSponsors();
  };

  const openMember = (m: Member) => { setViewingMember(m); if (!m.read) markRead('members', m.id); };
  const openSponsor = (s: Sponsor) => { setViewingSponsor(s); if (!s.read) markRead('sponsors', s.id); };

  const unreadM = members.filter((r) => !r.read).length;
  const unreadS = sponsors.filter((r) => !r.read).length;
  const items = tab === 'members' ? members : sponsors;

  return (
    <AdminPage title="Đăng ký">
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: '1.25rem', borderBottom: '2px solid var(--color-rule)' }}>
        {(['members', 'sponsors'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '0.5rem 1.25rem', border: 'none', background: 'transparent', cursor: 'pointer',
            fontFamily: 'var(--font-sans)', fontSize: '0.9rem', fontWeight: tab === t ? 700 : 400,
            color: tab === t ? 'var(--color-navy)' : 'var(--color-ink-light)',
            borderBottom: tab === t ? '2px solid var(--color-navy)' : '2px solid transparent', marginBottom: -2,
          }}>
            {t === 'members' ? `Thành viên${unreadM > 0 ? ` (${unreadM})` : ''}` : `Tài trợ${unreadS > 0 ? ` (${unreadS})` : ''}`}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: 'var(--color-ink-light)' }}>Đang tải…</p>
      ) : (
        <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--color-bone)' }}>
                {tab === 'members'
                  ? ['', 'Họ tên', 'Email', 'Điện thoại', 'Thời gian', ''].map((h, i) => <th key={i} style={thStyle}>{h}</th>)
                  : ['', 'Tổ chức / Cá nhân', 'Email', 'Hình thức', 'Thời gian', ''].map((h, i) => <th key={i} style={thStyle}>{h}</th>)
                }
              </tr>
            </thead>
            <tbody>
              {(items as (Member | Sponsor)[]).map((r) => {
                const isMember = tab === 'members';
                const m = isMember ? r as Member : null;
                const s = !isMember ? r as Sponsor : null;
                return (
                  <tr key={r.id} onClick={() => isMember ? openMember(m!) : openSponsor(s!)}
                    style={{ borderBottom: '1px solid var(--color-bone)', background: r.read ? '#fff' : '#fef9f0', cursor: 'pointer' }}>
                    <td style={{ padding: '0.6rem 0.75rem', width: 12 }}>{!r.read && <UnreadDot />}</td>
                    <td style={{ padding: '0.6rem 0.75rem', fontWeight: r.read ? 400 : 700 }}>{m ? m.fullName : s!.orgName}</td>
                    <td style={{ padding: '0.6rem 0.75rem', color: 'var(--color-ink-light)' }}>{r.email}</td>
                    <td style={{ padding: '0.6rem 0.75rem', color: 'var(--color-ink-light)' }}>{m ? (m.phone ?? '—') : (s!.sponsorType ?? '—')}</td>
                    <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.8rem', color: 'var(--color-ink-light)', whiteSpace: 'nowrap' }}>{fmtDate(r.createdAt)}</td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>
                      <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                        <Btn size="sm" variant="secondary" onClick={() => isMember ? openMember(m!) : openSponsor(s!)}><Eye size={12} /></Btn>
                        <Btn size="sm" variant="danger" onClick={() => deleteRecord(tab, r.id)}><Trash2 size={12} /></Btn>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!items.length && (
                <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-ink-light)' }}>Chưa có đăng ký nào.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Member detail modal */}
      {viewingMember && (
        <Modal title="Chi tiết đăng ký thành viên" onClose={() => setViewingMember(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <RowDetail label="Họ và tên" value={viewingMember.fullName} />
            <RowDetail label="Ngày sinh" value={viewingMember.dateOfBirth} />
            <RowDetail label="Địa chỉ" value={viewingMember.address} />
            <RowDetail label="Email" value={<a href={`mailto:${viewingMember.email}`} style={{ color: 'var(--color-crimson)' }}>{viewingMember.email}</a>} />
            <RowDetail label="Điện thoại" value={viewingMember.phone} />
            <RowDetail label="Nghề nghiệp" value={viewingMember.occupation} />
            <RowDetail label="Thời gian" value={fmtDate(viewingMember.createdAt)} />
            {viewingMember.notes && (
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--color-ink-light)', marginBottom: 4 }}>Ghi chú</div>
                <div style={{ background: 'var(--color-bone)', borderRadius: 6, padding: '0.75rem', whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: '0.875rem' }}>{viewingMember.notes}</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 4 }}>
              <Btn variant="danger" onClick={() => deleteRecord('members', viewingMember.id)}><Trash2 size={13} /> Xóa</Btn>
              <a href={`mailto:${viewingMember.email}`}><Btn onClick={() => {}}>Trả lời email</Btn></a>
            </div>
          </div>
        </Modal>
      )}

      {/* Sponsor detail modal */}
      {viewingSponsor && (
        <Modal title="Chi tiết đăng ký tài trợ" onClose={() => setViewingSponsor(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <RowDetail label="Tổ chức / CN" value={viewingSponsor.orgName} />
            <RowDetail label="Người đại diện" value={viewingSponsor.representative} />
            <RowDetail label="Email" value={<a href={`mailto:${viewingSponsor.email}`} style={{ color: 'var(--color-crimson)' }}>{viewingSponsor.email}</a>} />
            <RowDetail label="Điện thoại" value={viewingSponsor.phone} />
            <RowDetail label="Hình thức" value={viewingSponsor.sponsorType} />
            <RowDetail label="Thời gian" value={fmtDate(viewingSponsor.createdAt)} />
            {viewingSponsor.details && (
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--color-ink-light)', marginBottom: 4 }}>Nội dung tài trợ</div>
                <div style={{ background: 'var(--color-bone)', borderRadius: 6, padding: '0.75rem', whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: '0.875rem' }}>{viewingSponsor.details}</div>
              </div>
            )}
            {viewingSponsor.notes && (
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--color-ink-light)', marginBottom: 4 }}>Ghi chú</div>
                <div style={{ background: 'var(--color-bone)', borderRadius: 6, padding: '0.75rem', whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: '0.875rem' }}>{viewingSponsor.notes}</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 4 }}>
              <Btn variant="danger" onClick={() => deleteRecord('sponsors', viewingSponsor.id)}><Trash2 size={13} /> Xóa</Btn>
              <a href={`mailto:${viewingSponsor.email}`}><Btn onClick={() => {}}>Trả lời email</Btn></a>
            </div>
          </div>
        </Modal>
      )}
    </AdminPage>
  );
}

const thStyle: React.CSSProperties = {
  padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600,
  fontSize: '0.8rem', borderBottom: '1px solid var(--color-rule)',
};
