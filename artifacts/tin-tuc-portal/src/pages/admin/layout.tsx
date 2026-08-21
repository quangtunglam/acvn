import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import {
  LayoutDashboard,
  FileText,
  Rss,
  FolderTree,
  Calendar,
  Mail,
  Image,
  LogOut,
  ExternalLink,
  ShieldCheck,
  User,
  Lock,
  Plus,
} from 'lucide-react';
import { handleClientApi } from '@/lib/client-store-bridge';

// ─── Admin Context ────────────────────────────────────────────────────────────

interface AdminContextType {
  user: { username: string; name: string; role: string } | null;
  logout: () => void;
  apiFetch: <T = any>(path: string, opts?: RequestInit) => Promise<T>;
}

const AdminContext = createContext<AdminContextType | null>(null);

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminLayout');
  return ctx;
}

// ─── Login Screen ─────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (user: any) => void }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('acvn2026');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    setTimeout(() => {
      const u = username.trim().toLowerCase();
      const p = password.trim();

      if ((u === 'admin' || u === 'acvn') && p === 'acvn2026') {
        const userData = { username: 'admin', name: 'Ban Quản Trị ACVN', role: 'superadmin' };
        localStorage.setItem('acvn_admin_user', JSON.stringify(userData));
        localStorage.setItem('acvn_admin_token', 'acvn_auth_master_token');
        onLogin(userData);
      } else {
        setError('Tên đăng nhập hoặc mật khẩu không chính xác.');
      }
      setLoading(false);
    }, 200);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f8fafc',
      padding: '1.5rem',
      fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)',
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: 16,
        padding: '2.5rem 2rem',
        width: '100%',
        maxWidth: 420,
        boxShadow: '0 20px 40px -15px rgba(0,0,0,0.07), 0 0 1px 1px rgba(0,0,0,0.05)',
        border: '1px solid #e2e8f0',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img
            src="/logo-hoi.png"
            alt="ACVN Logo"
            style={{ height: 68, width: 'auto', objectFit: 'contain', margin: '0 auto 1rem' }}
          />
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Hội người Czech <span style={{ color: '#dc2626' }}>gốc Việt Nam</span>
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: 6, fontWeight: 500 }}>
            Bảng Quản Trị Nội Dung & Hệ Thống
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
              Tên đăng nhập
            </label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập tên tài khoản (mặc định: admin)"
                required
                autoFocus
                style={{
                  width: '100%',
                  padding: '0.65rem 0.75rem 0.65rem 2.25rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  fontSize: '0.95rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
              Mật khẩu
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu (mặc định: acvn2026)"
                required
                style={{
                  width: '100%',
                  padding: '0.65rem 0.75rem 0.65rem 2.25rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  fontSize: '0.95rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
              />
            </div>
          </div>

          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fee2e2',
              color: '#dc2626',
              padding: '0.65rem 0.85rem',
              borderRadius: 8,
              fontSize: '0.85rem',
              marginBottom: '1.25rem',
              fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: '#0f172a',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              padding: '0.75rem',
              cursor: 'pointer',
              fontSize: '0.95rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: loading ? 0.7 : 1,
              transition: 'background 0.2s',
            }}
          >
            <ShieldCheck size={18} />
            {loading ? 'Đang xác thực…' : 'Đăng nhập Quản Trị'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
          <Link href="/" style={{ color: '#64748b', fontSize: '0.825rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            ← Quay lại trang chủ ACVN
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin Layout ────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: '/admin', label: 'Bảng điều khiển', icon: LayoutDashboard, exact: true },
  { href: '/admin/articles', label: 'Quản lý bài viết', icon: FileText },
  { href: '/admin/rss', label: 'Nguồn RSS & AI', icon: Rss },
  { href: '/admin/taxonomy', label: 'Danh mục & Tác giả', icon: FolderTree },
  { href: '/admin/events', label: 'Sự kiện Hội', icon: Calendar },
  { href: '/admin/registrations', label: 'Hội viên & Tài trợ', icon: User },
  { href: '/admin/contacts', label: 'Thư liên hệ', icon: Mail },
  { href: '/admin/banners', label: 'Quảng cáo & Banner', icon: Image },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [user, setUser] = useState<{ username: string; name: string; role: string } | null>(() => {
    try {
      const saved = localStorage.getItem('acvn_admin_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const logout = () => {
    localStorage.removeItem('acvn_admin_user');
    localStorage.removeItem('acvn_admin_token');
    setUser(null);
  };

  const apiFetch = async <T = any>(path: string, opts: RequestInit = {}): Promise<T> => {
    const fullPath = path.startsWith('/api') ? path : `/api/admin${path}`;
    const token = localStorage.getItem('acvn_admin_token');
    const headers = new Headers(opts.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (opts.body && typeof opts.body === 'string') headers.set('Content-Type', 'application/json');
    
    const res = await fetch(fullPath, { ...opts, headers });
    if (!res.ok) {
      let errText = await res.text().catch(() => 'Lỗi kết nối');
      try { errText = JSON.parse(errText).error || errText; } catch {}
      throw new Error(errText || `Lỗi HTTP ${res.status}`);
    }
    return res.json() as Promise<T>;
  };

  if (!user) {
    return <LoginScreen onLogin={setUser} />;
  }

  return (
    <AdminContext.Provider value={{ user, logout, apiFetch }}>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)' }}>
        {/* Sidebar */}
        <aside style={{
          width: 260,
          background: '#ffffff',
          borderRight: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}>
          {/* Logo & Brand */}
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/logo-hoi.png" alt="ACVN" style={{ height: 38, width: 'auto' }} />
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>ACVN Admin</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Hội Séc - Việt</div>
            </div>
          </div>

          {/* Navigation */}
          <nav style={{ flex: 1, padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {NAV_ITEMS.map((item) => {
              const active = item.exact ? location === item.href : location.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '0.65rem 0.85rem',
                    borderRadius: 8,
                    fontSize: '0.875rem',
                    fontWeight: active ? 600 : 500,
                    color: active ? '#0f172a' : '#475569',
                    background: active ? '#f1f5f9' : 'transparent',
                    textDecoration: 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  <Icon size={18} color={active ? '#dc2626' : '#64748b'} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User Footer */}
          <div style={{ padding: '1rem', borderTop: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#0f172a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 700 }}>
                  A
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>{user.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>● Online</div>
                </div>
              </div>
              <button
                onClick={logout}
                title="Đăng xuất"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 4 }}
              >
                <LogOut size={16} />
              </button>
            </div>

            <Link
              href="/"
              target="_blank"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '0.5rem',
                borderRadius: 6,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                color: '#475569',
                fontSize: '0.8rem',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <ExternalLink size={14} /> Xem trang chủ
            </Link>
          </div>
        </aside>

        {/* Content Area */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
          {children}
        </main>
      </div>
    </AdminContext.Provider>
  );
}

// ─── AdminPage Wrapper ────────────────────────────────────────────────────────

export function AdminPage({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; onClick: () => void; icon?: any };
  children: ReactNode;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
          {title}
        </h1>
        {action && (
          <button
            onClick={action.onClick}
            style={{
              background: '#dc2626',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '0.6rem 1rem',
              fontWeight: 600,
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(220,38,38,0.2)',
            }}
          >
            <Plus size={16} />
            {action.label}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Reusable UI Helpers ──────────────────────────────────────────────────────

export function Btn({
  children,
  variant = 'default',
  onClick,
  disabled,
  type = 'button',
  style,
}: {
  children: ReactNode;
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  style?: React.CSSProperties;
}) {
  let bg = '#0f172a';
  let color = '#fff';
  let border = 'none';

  if (variant === 'primary') {
    bg = '#dc2626';
  } else if (variant === 'danger') {
    bg = '#ef4444';
  } else if (variant === 'ghost') {
    bg = 'transparent';
    color = '#475569';
    border = '1px solid #cbd5e1';
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: bg,
        color: color,
        border: border,
        borderRadius: 6,
        padding: '0.5rem 0.9rem',
        fontSize: '0.85rem',
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: '100%',
        padding: '0.55rem 0.75rem',
        border: '1px solid #cbd5e1',
        borderRadius: 6,
        fontSize: '0.875rem',
        outline: 'none',
        boxSizing: 'border-box',
        background: '#fff',
        ...props.style,
      }}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{
        width: '100%',
        padding: '0.55rem 0.75rem',
        border: '1px solid #cbd5e1',
        borderRadius: 6,
        fontSize: '0.875rem',
        outline: 'none',
        boxSizing: 'border-box',
        background: '#fff',
        resize: 'vertical',
        ...props.style,
      }}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{
        width: '100%',
        padding: '0.55rem 0.75rem',
        border: '1px solid #cbd5e1',
        borderRadius: 6,
        fontSize: '0.875rem',
        outline: 'none',
        boxSizing: 'border-box',
        background: '#fff',
        ...props.style,
      }}
    >
      {props.children}
    </select>
  );
}

export function Badge({ children, variant = 'neutral' }: { children: ReactNode; variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }) {
  let bg = '#f1f5f9';
  let color = '#475569';

  if (variant === 'success') { bg = '#dcfce7'; color = '#166534'; }
  else if (variant === 'warning') { bg = '#fef3c7'; color = '#92400e'; }
  else if (variant === 'danger') { bg = '#fee2e2'; color = '#991b1b'; }
  else if (variant === 'info') { bg = '#e0f2fe'; color = '#075985'; }

  return (
    <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: bg, color: color }}>
      {children}
    </span>
  );
}

export function Modal({
  title,
  open = true,
  onClose,
  children,
  width = 650,
}: {
  title: string;
  open?: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, width: '100%', maxWidth: width, maxHeight: '90vh',
        overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
      }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>×</button>
        </div>
        <div style={{ padding: '1.5rem' }}>{children}</div>
      </div>
    </div>
  );
}

export function ConfirmModal({
  open,
  title,
  message,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <Modal title={title} open={open} onClose={onCancel} width={420}>
      <p style={{ color: '#475569', fontSize: '0.9rem', marginBottom: '1.5rem' }}>{message}</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn variant="ghost" onClick={onCancel}>Hủy</Btn>
        <Btn variant="danger" onClick={onConfirm}>Xóa</Btn>
      </div>
    </Modal>
  );
}
