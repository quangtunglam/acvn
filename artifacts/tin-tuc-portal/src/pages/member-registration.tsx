import { useState } from 'react';
import { PageShell } from '@/components/page-shell';
import { Check } from 'lucide-react';

type Field = { name: string; label: string; type?: string; required?: boolean; placeholder?: string };

const FIELDS: Field[] = [
  { name: 'fullName', label: 'Họ và tên', required: true, placeholder: 'Nguyễn Văn A' },
  { name: 'dateOfBirth', label: 'Ngày sinh', type: 'date' },
  { name: 'address', label: 'Địa chỉ tại Séc', placeholder: 'Số nhà, đường, thành phố' },
  { name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'example@email.com' },
  { name: 'phone', label: 'Số điện thoại', type: 'tel', placeholder: '+420 xxx xxx xxx' },
  { name: 'occupation', label: 'Nghề nghiệp', placeholder: 'Ví dụ: kỹ sư, giáo viên, kinh doanh…' },
];

export default function MemberRegistrationPage() {
  const [form, setForm] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/register/member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, notes }),
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
          Đăng ký thành viên
        </h1>
        <p style={{ color: 'var(--color-ink-light)', marginBottom: '2rem', lineHeight: 1.7 }}>
          Điền thông tin bên dưới để đăng ký trở thành thành viên của Hội người Czech gốc Việt Nam.
          Ban quản lý hội sẽ liên hệ lại với bạn trong thời gian sớm nhất.
        </p>

        {status === 'success' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '3rem', background: '#f0faf4', borderRadius: 12, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, background: '#22c55e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Check size={28} color="#fff" />
            </div>
            <h2 style={{ fontFamily: 'var(--app-font-serif)', fontWeight: 700, fontSize: '1.4rem', color: 'var(--color-navy)' }}>Đăng ký thành công!</h2>
            <p style={{ color: 'var(--color-ink-light)', lineHeight: 1.7 }}>
              Cảm ơn bạn đã đăng ký. Hội sẽ liên hệ với bạn qua email hoặc điện thoại để hoàn tất thủ tục.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {FIELDS.map((f) => (
              <label key={f.name} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-ink)' }}>
                  {f.label}{f.required && <span style={{ color: 'var(--color-crimson)', marginLeft: 3 }}>*</span>}
                </span>
                <input
                  type={f.type ?? 'text'}
                  required={f.required}
                  placeholder={f.placeholder}
                  value={form[f.name] ?? ''}
                  onChange={(e) => set(f.name, e.target.value)}
                  style={{ padding: '0.65rem 0.875rem', border: '1px solid var(--color-rule)', borderRadius: 6, fontSize: '0.95rem', fontFamily: 'var(--font-sans)', outline: 'none' }}
                />
              </label>
            ))}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-ink)' }}>Ghi chú thêm</span>
              <textarea
                rows={4}
                placeholder="Bất kỳ thông tin nào bạn muốn thêm…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ padding: '0.65rem 0.875rem', border: '1px solid var(--color-rule)', borderRadius: 6, fontSize: '0.95rem', fontFamily: 'var(--font-sans)', resize: 'vertical', outline: 'none' }}
              />
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
