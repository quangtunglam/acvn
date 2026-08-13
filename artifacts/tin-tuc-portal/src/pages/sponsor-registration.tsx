import { useState } from 'react';
import { PageShell } from '@/components/page-shell';
import { Check } from 'lucide-react';

const SPONSOR_TYPES = ['Tài chính', 'Hiện vật / Quà tặng', 'Dịch vụ / Kỹ thuật', 'Truyền thông', 'Khác'];

export default function SponsorRegistrationPage() {
  const [orgName, setOrgName] = useState('');
  const [representative, setRepresentative] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [sponsorType, setSponsorType] = useState('');
  const [details, setDetails] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/register/sponsor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgName, representative, email, phone, sponsorType, details, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Lỗi không xác định');
      setStatus('success');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Đã xảy ra lỗi.');
      setStatus('error');
    }
  };

  return (
    <PageShell>
      <div className="wrap" style={{ paddingBlock: '2rem', maxWidth: 680 }}>
        <h1 style={{ fontFamily: 'var(--app-font-serif)', fontSize: 'clamp(22px,3vw,32px)', fontWeight: 700, marginBottom: '0.5rem', letterSpacing: '-.02em' }}>
          Đăng ký tài trợ
        </h1>
        <p style={{ color: 'var(--color-ink-light)', marginBottom: '2rem', lineHeight: 1.7 }}>
          Hội người Séc gốc Việt Nam trân trọng sự đồng hành của các nhà tài trợ.
          Vui lòng điền thông tin để chúng tôi liên hệ và trao đổi thêm.
        </p>

        {status === 'success' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '3rem', background: '#f0faf4', borderRadius: 12, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, background: '#22c55e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Check size={28} color="#fff" />
            </div>
            <h2 style={{ fontFamily: 'var(--app-font-serif)', fontWeight: 700, fontSize: '1.4rem', color: 'var(--color-navy)' }}>Đăng ký thành công!</h2>
            <p style={{ color: 'var(--color-ink-light)', lineHeight: 1.7 }}>
              Cảm ơn bạn đã quan tâm tài trợ cho Hội. Chúng tôi sẽ liên hệ lại qua email hoặc điện thoại.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-ink)' }}>Tên tổ chức / cá nhân<span style={{ color: 'var(--color-crimson)', marginLeft: 3 }}>*</span></span>
              <input type="text" required value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Công ty ABC / Nguyễn Văn A" style={inputStyle} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-ink)' }}>Người đại diện</span>
              <input type="text" value={representative} onChange={(e) => setRepresentative(e.target.value)} placeholder="Họ và tên người liên hệ" style={inputStyle} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-ink)' }}>Email<span style={{ color: 'var(--color-crimson)', marginLeft: 3 }}>*</span></span>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@email.com" style={inputStyle} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-ink)' }}>Số điện thoại</span>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+420 xxx xxx xxx" style={inputStyle} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-ink)' }}>Hình thức tài trợ</span>
              <select value={sponsorType} onChange={(e) => setSponsorType(e.target.value)} style={{ ...inputStyle, background: '#fff' }}>
                <option value="">— Chọn hình thức —</option>
                {SPONSOR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>

            {sponsorType === 'Tài chính' && (
              <div style={{ background: '#f0f7ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '1rem 1.25rem', fontSize: '0.875rem', lineHeight: 1.8 }}>
                <p style={{ fontWeight: 700, color: 'var(--color-navy)', marginBottom: 6 }}>Thông tin chuyển khoản</p>
                <p><span style={{ color: 'var(--color-ink-light)' }}>Số tài khoản:</span> <strong>237949249/0300</strong>, ngân hàng ČSOB</p>
                <p><span style={{ color: 'var(--color-ink-light)' }}>Nội dung:</span> <strong>Sponzorský dar spolku</strong></p>
              </div>
            )}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-ink)' }}>Nội dung tài trợ dự kiến</span>
              <textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Mô tả ngắn gọn nội dung hoặc giá trị tài trợ…" style={{ ...inputStyle, resize: 'vertical' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-ink)' }}>Ghi chú thêm</span>
              <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Bất kỳ thông tin nào bạn muốn thêm…" style={{ ...inputStyle, resize: 'vertical' }} />
            </label>
            {errorMsg && <p style={{ color: 'var(--color-crimson)', fontSize: '0.875rem' }}>{errorMsg}</p>}
            <button
              type="submit"
              disabled={status === 'loading'}
              style={{ padding: '0.75rem 2rem', background: 'var(--color-crimson)', color: '#fff', border: 'none', borderRadius: 7, fontSize: '1rem', fontWeight: 700, cursor: status === 'loading' ? 'not-allowed' : 'pointer', opacity: status === 'loading' ? 0.7 : 1, alignSelf: 'flex-start', fontFamily: 'var(--font-sans)' }}
            >
              {status === 'loading' ? 'Đang gửi…' : 'Gửi đăng ký'}
            </button>
          </form>
        )}
      </div>
    </PageShell>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '0.65rem 0.875rem', border: '1px solid var(--color-rule)', borderRadius: 6,
  fontSize: '0.95rem', fontFamily: 'var(--font-sans)', outline: 'none',
};
