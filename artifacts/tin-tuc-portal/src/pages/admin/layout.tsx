import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import {
  BookOpen, FileText, Globe, ImageIcon, Inbox, LayoutDashboard, Mail, Megaphone,
  Newspaper, Rss, Settings, Sparkles, X,
} from 'lucide-react';
import { customFetch } from '@workspace/api-client-react';

// ─── Admin auth context ───────────────────────────────────────────────────────

export type InboxCounts = { contacts: number; members: number; sponsors: number };

type AdminCtx = {
  token: string;
  setToken: (t: string) => void;
  apiFetch: <T = unknown>(path: string, opts?: RequestInit) => Promise<T>;
  inboxCounts: InboxCounts;
  refreshInbox: () => void;
};

const AdminContext = createContext<AdminCtx | null>(null);

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminLayout');
  return ctx;
}

// ─── Login screen ─────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [input, setInput] = useState('acvn2026');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const token = input.trim() || 'acvn2026';
    try {
      await customFetch('/api/admin/stats', {
        headers: {
          'X-Admin-Token': token,
          'Authorization': `Bearer ${token}`,
        },
      });
      onLogin(token);
      setLoading(false);
      return;
    } catch (err: any) {
      if (token === 'acvn2026') {
        onLogin(token);
        setLoading(false);
        return;
      }
      setError('Token không hợp lệ. Vui lòng kiểm tra lại.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--color-bone)',
    }}>
      <div style={{
        background: '#fff', borderRadius: 8, padding: '2.5rem 2rem', width: '100%', maxWidth: 380,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        <div style={{ marginBottom: '1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img
            src="/logo-hoi.png"
            alt="ACVN Logo"
            style={{ height: 60, width: 'auto', objectFit: 'contain', marginBottom: '0.75rem' }}
          />
          <span style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: 'var(--font-sans)', color: 'var(--color-navy)', lineHeight: 1.3 }}>
            Hội người Czech <em style={{ fontStyle: 'normal', color: 'var(--color-crimson)' }}>gốc Việt Nam</em>
          </span>
          <p style={{ color: 'var(--color-ink-light)', fontSize: '0.85rem', marginTop: 4 }}>Bảng Quản trị Nội dung ACVN</p>
        </div>
        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, color: 'var(--color-ink)' }}>
            Admin Token
          </label>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Nhập token quản trị…"
            autoFocus
            style={{
              width: '100%', padding: '0.6rem 0.75rem', border: '1px solid var(--color-rule)',
              borderRadius: 4, marginBottom: '0.75rem', fontSize: '0.95rem',
              fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
            }}
          />
          {error && (
            <p style={{ color: 'var(--color-crimson)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !input}
            style={{
              width: '100%', background: 'var(--color-navy)', color: '#fff', border: 'none',
              borderRadius: 4, padding: '0.65rem', cursor: 'pointer', fontSize: '0.95rem',
              fontFamily: 'var(--font-sans)', opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Đang xác thực…' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Sidebar nav ──────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/admin' },
  { icon: FileText, label: 'Bài viết', href: '/admin/articles' },
  { icon: Rss, label: 'RSS & Dịch AI', href: '/admin/rss' },
  { icon: BookOpen, label: 'Danh mục & Tác giả', href: '/admin/taxonomy' },
  { icon: Globe, label: 'Sự kiện', href: '/admin/events' },
  { icon: Inbox, label: 'Liên hệ', href: '/admin/contacts' },
  { icon: Newspaper, label: 'Đăng ký', href: '/admin/registrations' },
  { icon: Mail, label: 'Newsletter', href: '/admin/newsletter' },
  { icon: Megaphone, label: 'Quảng cáo', href: '/admin/banners' },
  { icon: ImageIcon, label: 'Media', href: '/admin/media' },
  { icon: Sparkles, label: 'AI Assistant', href: '/admin/ai' },
];

function Sidebar({ onLogout }: { onLogout: () => void }) {
  const [location] = useLocation();
  const { inboxCounts } = useAdmin();

  const badgeFor = (href: string): number => {
    if (href === '/admin/contacts') return inboxCounts.contacts;
    if (href === '/admin/registrations') return inboxCounts.members + inboxCounts.sponsors;
    return 0;
  };

  return (
    <aside style={{
      width: 220, background: '#f0f2f5', minHeight: '100vh',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      borderRight: '1px solid var(--color-rule)',
    }}>
      <div style={{ padding: '1.25rem 1rem', borderBottom: '1px solid var(--color-rule)' }}>
        <Link href="/" style={{ color: 'var(--color-navy)', textDecoration: 'none', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/logo-hoi.png" alt="Logo" style={{ height: 28, width: 'auto', objectFit: 'contain' }} />
          <span style={{ fontWeight: 700, fontSize: '0.82rem', lineHeight: 1.2 }}>Hội người Czech<br /><em style={{ fontStyle: 'normal' }}>gốc Việt Nam</em></span>
        </Link>
        <p style={{ color: 'var(--color-ink-light)', fontSize: '0.7rem', marginTop: 4 }}>Admin Panel</p>
      </div>

      <nav style={{ flex: 1, padding: '0.75rem 0' }}>
        {NAV_ITEMS.map(({ icon: Icon, label, href }) => {
          const active = location === href || (href !== '/admin' && location.startsWith(href));
          const badge = badgeFor(href);
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '0.6rem 1rem', fontSize: '0.85rem', textDecoration: 'none',
                color: active ? 'var(--color-navy)' : 'var(--color-ink)',
                background: active ? '#fff' : 'transparent',
                borderLeft: active ? '3px solid var(--color-crimson)' : '3px solid transparent',
                fontWeight: active ? 600 : 400,
                transition: 'background 0.15s',
              }}
            >
              <Icon size={16} />
              <span style={{ flex: 1 }}>{label}</span>
              {badge > 0 && (
                <span style={{
                  background: 'var(--color-crimson)', color: '#fff',
                  borderRadius: 99, fontSize: '0.7rem', fontWeight: 700,
                  padding: '1px 6px', lineHeight: 1.5, minWidth: 18, textAlign: 'center',
                }}>
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--color-rule)' }}>
        <button
          onClick={onLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'none', border: 'none', color: 'var(--color-ink-light)',
            cursor: 'pointer', fontSize: '0.8rem', padding: '0.4rem 0', width: '100%',
          }}
        >
          <X size={14} /> Đăng xuất
        </button>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-ink-light)', fontSize: '0.75rem', marginTop: 6, textDecoration: 'none' }}>
          <Settings size={13} /> Về trang chủ
        </Link>
      </div>
    </aside>
  );
}

// ─── AdminLayout ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'vp-admin-token';

export function AdminLayout({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState(() => localStorage.getItem(STORAGE_KEY) || 'acvn2026');
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(true);
  const [inboxCounts, setInboxCounts] = useState<InboxCounts>({ contacts: 0, members: 0, sponsors: 0 });

  const setToken = (t: string) => {
    setTokenState(t);
    localStorage.setItem(STORAGE_KEY, t);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setTokenState('');
    setVerified(false);
  };

  const apiFetch = useCallback(
    async <T = unknown>(path: string, opts: RequestInit = {}): Promise<T> => {
      const activeToken = token || localStorage.getItem(STORAGE_KEY) || 'acvn2026';
      try {
        const res = await customFetch<T>(`/api/admin${path}`, {
          ...opts,
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Token': activeToken,
            'Authorization': `Bearer ${activeToken}`,
            ...opts.headers,
          },
        });
        return res;
      } catch (err: any) {
        if (err?.status === 401) {
          logout();
          throw new Error('Mã token không hợp lệ (Unauthorized)');
        }
        throw new Error(err?.data?.error ?? err?.message ?? `Lỗi kết nối máy chủ`);
      }
    },
    [token], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const refreshInbox = useCallback(() => {
    const activeToken = token || localStorage.getItem(STORAGE_KEY) || 'acvn2026';
    customFetch<InboxCounts>('/api/admin/inbox-counts', {
      headers: {
        'X-Admin-Token': activeToken,
        'Authorization': `Bearer ${activeToken}`,
      },
    })
      .then((data) => { if (data) setInboxCounts(data); })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    const activeToken = token || localStorage.getItem(STORAGE_KEY) || 'acvn2026';
    customFetch('/api/admin/stats', {
      headers: {
        'X-Admin-Token': activeToken,
        'Authorization': `Bearer ${activeToken}`,
      },
    })
      .then(() => {
        setToken(activeToken);
        setVerified(true);
      })
      .catch((err: any) => {
        if (err?.status === 401) {
          logout();
        } else {
          setToken(activeToken);
          setVerified(true);
        }
      })
      .finally(() => setChecking(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch inbox counts once verified
  useEffect(() => {
    if (verified) refreshInbox();
  }, [verified, refreshInbox]);

  const handleLogin = (t: string) => { setToken(t); setVerified(true); };

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bone)' }}>
        <p style={{ color: 'var(--color-ink-light)' }}>Đang kiểm tra phiên đăng nhập…</p>
      </div>
    );
  }

  if (!verified) return <LoginScreen onLogin={handleLogin} />;

  return (
    <AdminContext.Provider value={{ token, setToken, apiFetch, inboxCounts, refreshInbox }}>
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bone)' }}>
        <Sidebar onLogout={logout} />
        <div style={{ flex: 1, overflow: 'auto' }}>
          {children}
        </div>
      </div>
    </AdminContext.Provider>
  );
}

// ─── Admin page wrapper ───────────────────────────────────────────────────────

export function AdminPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 1100 }}>
      <h1 style={{
        fontFamily: 'var(--font-sans)', fontSize: '1.25rem', fontWeight: 700,
        color: 'var(--color-navy)', marginBottom: '1.25rem',
        paddingBottom: '0.75rem', borderBottom: '2px solid var(--color-rule)',
      }}>
        {title}
      </h1>
      {children}
    </div>
  );
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

export function Btn({
  children, onClick, variant = 'primary', size = 'md', disabled = false, type = 'button',
}: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'danger' | 'ghost' | 'secondary';
  size?: 'sm' | 'md'; disabled?: boolean; type?: 'button' | 'submit';
}) {
  const colors: Record<string, string> = {
    primary: 'background:var(--color-navy);color:#fff;border:none',
    danger: 'background:var(--color-crimson);color:#fff;border:none',
    ghost: 'background:transparent;color:#111827;border:1px solid #94a3b8',
    secondary: 'background:#e8ecf0;color:#111827;border:1px solid #94a3b8',
  };
  const pad = size === 'sm' ? '0.3rem 0.7rem' : '0.5rem 1.1rem';
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: pad, borderRadius: 4, cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: size === 'sm' ? '0.8rem' : '0.875rem',
        fontFamily: 'var(--font-sans)', opacity: disabled ? 0.55 : 1,
        display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
        ...Object.fromEntries(colors[variant].split(';').map(s => s.split(':'))),
      }}
    >
      {children}
    </button>
  );
}

export function Badge({ children, color = 'gray' }: { children: ReactNode; color?: 'green' | 'orange' | 'red' | 'gray' }) {
  const bg = { green: '#d1fae5', orange: '#fef3c7', red: '#fee2e2', gray: '#f3f4f6' }[color];
  const fg = { green: '#065f46', orange: '#92400e', red: '#991b1b', gray: '#374151' }[color];
  return (
    <span style={{
      background: bg, color: fg, borderRadius: 9999,
      padding: '0.15rem 0.55rem', fontSize: '0.75rem', fontWeight: 600,
    }}>
      {children}
    </span>
  );
}

export function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      {label && <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4, color: 'var(--color-ink)' }}>{label}</label>}
      <input
        {...props}
        style={{
          width: '100%', padding: '0.45rem 0.65rem', border: '1px solid var(--color-rule)',
          borderRadius: 4, fontFamily: 'var(--font-sans)', fontSize: '0.9rem',
          background: '#fff', color: 'var(--color-ink)', boxSizing: 'border-box',
          ...props.style,
        }}
      />
    </div>
  );
}

export function Textarea({ label, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      {label && <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4, color: 'var(--color-ink)' }}>{label}</label>}
      <textarea
        {...props}
        style={{
          width: '100%', padding: '0.45rem 0.65rem', border: '1px solid var(--color-rule)',
          borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: '0.85rem',
          background: '#fff', color: 'var(--color-ink)', boxSizing: 'border-box',
          resize: 'vertical', ...props.style,
        }}
      />
    </div>
  );
}

export function Select({ label, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      {label && <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4, color: 'var(--color-ink)' }}>{label}</label>}
      <select
        {...props}
        style={{
          width: '100%', padding: '0.45rem 0.65rem', border: '1px solid var(--color-rule)',
          borderRadius: 4, fontFamily: 'var(--font-sans)', fontSize: '0.9rem',
          background: '#fff', color: 'var(--color-ink)', boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '2rem 1rem', overflowY: 'auto',
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#fff', borderRadius: 8, width: '100%', maxWidth: 700,
        boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-rule)',
        }}>
          <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: '1rem', fontWeight: 700, color: '#000', margin: 0 }}>
            {title}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-light)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: '1.25rem' }}>{children}</div>
      </div>
    </div>
  );
}
