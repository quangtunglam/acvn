import { useEffect, useState } from 'react';
import { FileText, Mail, Tag, CalendarDays } from 'lucide-react';
import { AdminPage, useAdmin } from './layout';

type Stats = { articles: number; categories: number; subscribers: number; events: number };

function StatCard({ icon: Icon, label, value, color }: { icon: typeof FileText; label: string; value: number; color: string }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 8, padding: '1.25rem 1.5rem',
      display: 'flex', alignItems: 'center', gap: 16,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 8, background: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={22} color="#fff" />
      </div>
      <div>
        <p style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-navy)', lineHeight: 1.1, margin: 0 }}>
          {value.toLocaleString('vi-VN')}
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--color-ink-light)', margin: '2px 0 0' }}>{label}</p>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { apiFetch } = useAdmin();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Stats>('/stats')
      .then(setStats)
      .finally(() => setLoading(false));
  }, [apiFetch]);

  return (
    <AdminPage title="Dashboard">
      {loading ? (
        <p style={{ color: 'var(--color-ink-light)' }}>Đang tải…</p>
      ) : stats ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <StatCard icon={FileText} label="Tổng bài viết" value={stats.articles} color="var(--color-navy)" />
            <StatCard icon={Tag} label="Danh mục" value={stats.categories} color="var(--color-crimson)" />
            <StatCard icon={Mail} label="Người đăng ký" value={stats.subscribers} color="#10b981" />
            <StatCard icon={CalendarDays} label="Sự kiện" value={stats.events} color="#f59e0b" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ background: '#fff', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-navy)', marginBottom: '0.75rem' }}>
                Truy cập nhanh
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  ['/admin/articles', 'Quản lý bài viết'],
                  ['/admin/articles/new', 'Tạo bài viết mới'],
                  ['/admin/taxonomy', 'Quản lý danh mục'],
                  ['/admin/events', 'Quản lý sự kiện'],
                  ['/admin/ai', 'AI News Assistant'],
                ].map(([href, label]) => (
                  <a key={href} href={href} style={{
                    fontSize: '0.85rem', color: 'var(--color-crimson)', textDecoration: 'none',
                    padding: '0.35rem 0', borderBottom: '1px solid var(--color-bone)',
                  }}>
                    → {label}
                  </a>
                ))}
              </div>
            </div>
            <div style={{ background: '#fff', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-navy)', marginBottom: '0.75rem' }}>
                Thông tin hệ thống
              </h3>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-ink-light)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>Phiên bản: VietPress EU 1.0</span>
                <span>Database: PostgreSQL</span>
                <span>API: /api</span>
                <a href="/api/sitemap.xml" target="_blank" style={{ color: 'var(--color-crimson)' }}>Sitemap.xml ↗</a>
                <a href="/api/robots.txt" target="_blank" style={{ color: 'var(--color-crimson)' }}>Robots.txt ↗</a>
              </div>
            </div>
          </div>
        </>
      ) : (
        <p style={{ color: 'var(--color-crimson)' }}>Không tải được dữ liệu.</p>
      )}
    </AdminPage>
  );
}
