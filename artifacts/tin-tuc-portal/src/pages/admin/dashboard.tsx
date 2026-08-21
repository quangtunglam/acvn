import { useEffect, useState } from 'react';
import { FileText, Mail, Tag, CalendarDays, ArrowUpRight, Plus, Eye, Sparkles } from 'lucide-react';
import { AdminPage, useAdmin } from './layout';
import { Link } from 'wouter';

interface Stats {
  articles: number;
  categories: number;
  subscribers: number;
  events: number;
}

export default function AdminDashboard() {
  const { apiFetch } = useAdmin();
  const [stats, setStats] = useState<Stats>({ articles: 341, categories: 10, subscribers: 0, events: 2 });
  const [recentArticles, setRecentArticles] = useState<any[]>([]);

  useEffect(() => {
    apiFetch<Stats>('/stats').then((data) => {
      if (data) setStats(data);
    });
    apiFetch<any>('/articles?pageSize=5').then((data) => {
      if (data?.items) setRecentArticles(data.items);
    });
  }, []);

  return (
    <AdminPage title="Bảng Điều Khiển">
      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748b' }}>Tổng bài viết</span>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={18} color="#2563eb" />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{stats.articles.toLocaleString('vi-VN')}</div>
          <div style={{ fontSize: '0.8rem', color: '#16a34a', marginTop: 8, fontWeight: 500 }}>● Đã xuất bản lên trang chủ</div>
        </div>

        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748b' }}>Chuyên mục</span>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Tag size={18} color="#dc2626" />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{stats.categories}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 8 }}>Kinh tế, Văn hóa, Đời sống...</div>
        </div>

        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748b' }}>Sự kiện Hội</span>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CalendarDays size={18} color="#d97706" />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{stats.events}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 8 }}>Sự kiện cộng đồng tại Séc</div>
        </div>

        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748b' }}>Người theo dõi</span>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Mail size={18} color="#059669" />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{stats.subscribers}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 8 }}>Đăng ký bản tin hàng tuần</div>
        </div>
      </div>

      {/* Quick Action & Recent Articles */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Bài viết mới nhất</h2>
            <p style={{ fontSize: '0.825rem', color: '#64748b', margin: '4px 0 0' }}>Tổng hợp các tin tức vừa được cập nhật trên cổng thông tin</p>
          </div>
          <Link
            href="/admin/articles"
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#dc2626',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            Quản lý tất cả <ArrowUpRight size={16} />
          </Link>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {recentArticles.map((art) => (
            <div
              key={art.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                borderRadius: 8,
                background: '#f8fafc',
                border: '1px solid #f1f5f9',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                {art.coverImage && (
                  <img
                    src={art.coverImage}
                    alt=""
                    style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
                  />
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {art.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
                    {art.category?.name || 'Tin tức'} · {new Date(art.publishedAt || art.createdAt).toLocaleDateString('vi-VN')}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 16, flexShrink: 0 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: '#dcfce7', color: '#166534' }}>
                  Đã xuất bản
                </span>
                <a
                  href={`/bai-viet/${art.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  title="Xem bài viết"
                  style={{ color: '#64748b', padding: 4 }}
                >
                  <Eye size={16} />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminPage>
  );
}
