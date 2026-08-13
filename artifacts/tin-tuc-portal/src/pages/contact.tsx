import { useState } from 'react';
import { PageShell } from '@/components/page-shell';

type FormState = { name: string; email: string; phone: string; subject: string; message: string };
type Status = 'idle' | 'sending' | 'ok' | 'err';

const EMPTY: FormState = { name: '', email: '', phone: '', subject: '', message: '' };

export default function ContactPage() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [status, setStatus] = useState<Status>('idle');
  const [errMsg, setErrMsg] = useState('');

  const f = (k: keyof FormState, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setErrMsg('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setStatus('ok');
      setForm(EMPTY);
    } catch (err) {
      setStatus('err');
      setErrMsg(err instanceof Error ? err.message : 'Có lỗi xảy ra, vui lòng thử lại.');
    }
  };

  return (
    <PageShell>
      <div className="wrap">
        <div className="contact-page">

          {/* Breadcrumb */}
          <nav className="about-breadcrumb" aria-label="Điều hướng phụ">
            <a href="/">Trang chủ</a>
            <span aria-hidden="true"> / </span>
            <a href="/gioi-thieu">Giới thiệu</a>
            <span aria-hidden="true"> / </span>
            <span>Liên hệ</span>
          </nav>

          <h1 className="about-title">Liên hệ với chúng tôi</h1>

          <div className="contact-layout">

            {/* Info sidebar */}
            <aside className="contact-info">
              <div className="contact-info-block">
                <h2 className="contact-info-heading">Hội người Séc gốc Việt Nam</h2>
                <p className="contact-info-sub">Asociace českých občanů vietnamského původu</p>
              </div>

              <div className="contact-info-block">
                <div className="contact-info-item">
                  <span className="contact-info-icon">📍</span>
                  <span>Praha, Cộng hòa Séc</span>
                </div>
                <div className="contact-info-item">
                  <span className="contact-info-icon">✉️</span>
                  <a href="mailto:tung@pamacorp.com">tung@pamacorp.com</a>
                </div>
              </div>

              <div className="contact-info-block">
                <p className="contact-info-note">
                  Chúng tôi sẽ phản hồi trong vòng 1–3 ngày làm việc.
                </p>
              </div>
            </aside>

            {/* Form */}
            <div className="contact-form-wrap">
              {status === 'ok' ? (
                <div className="contact-success">
                  <div className="contact-success-icon">✓</div>
                  <h2>Gửi thành công!</h2>
                  <p>Cảm ơn bạn đã liên hệ. Chúng tôi sẽ phản hồi sớm nhất có thể.</p>
                  <button className="contact-btn" onClick={() => setStatus('idle')}>Gửi thêm</button>
                </div>
              ) : (
                <form className="contact-form" onSubmit={handleSubmit} noValidate>
                  <div className="contact-row">
                    <div className="contact-field">
                      <label className="contact-label" htmlFor="cf-name">Họ và tên *</label>
                      <input
                        id="cf-name" className="contact-input" type="text"
                        value={form.name} onChange={e => f('name', e.target.value)}
                        placeholder="Nguyễn Văn A" required
                      />
                    </div>
                    <div className="contact-field">
                      <label className="contact-label" htmlFor="cf-email">Email *</label>
                      <input
                        id="cf-email" className="contact-input" type="email"
                        value={form.email} onChange={e => f('email', e.target.value)}
                        placeholder="email@example.com" required
                      />
                    </div>
                  </div>

                  <div className="contact-row">
                    <div className="contact-field">
                      <label className="contact-label" htmlFor="cf-phone">Điện thoại</label>
                      <input
                        id="cf-phone" className="contact-input" type="tel"
                        value={form.phone} onChange={e => f('phone', e.target.value)}
                        placeholder="+420 …"
                      />
                    </div>
                    <div className="contact-field">
                      <label className="contact-label" htmlFor="cf-subject">Tiêu đề *</label>
                      <input
                        id="cf-subject" className="contact-input" type="text"
                        value={form.subject} onChange={e => f('subject', e.target.value)}
                        placeholder="Nội dung cần liên hệ" required
                      />
                    </div>
                  </div>

                  <div className="contact-field">
                    <label className="contact-label" htmlFor="cf-message">Nội dung *</label>
                    <textarea
                      id="cf-message" className="contact-input contact-textarea"
                      value={form.message} onChange={e => f('message', e.target.value)}
                      placeholder="Nhập nội dung bạn muốn gửi…" rows={6} required
                    />
                  </div>

                  {status === 'err' && (
                    <p className="contact-error">{errMsg}</p>
                  )}

                  <button className="contact-btn" type="submit" disabled={status === 'sending'}>
                    {status === 'sending' ? 'Đang gửi…' : 'Gửi liên hệ →'}
                  </button>
                </form>
              )}
            </div>
          </div>

        </div>
      </div>
    </PageShell>
  );
}
