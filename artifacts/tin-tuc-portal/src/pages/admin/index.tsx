import { AdminLayout } from './layout';
import AdminDashboard from './dashboard';
import AdminArticles from './articles';
import AdminRSS from './rss';
import AdminTaxonomy from './taxonomy';
import AdminEvents from './events';
import AdminNewsletter from './newsletter';
import AdminAI from './ai';

export default function AdminRouter({ section }: { section: string }) {
  const renderContent = () => {
    if (!section || section === '') return <AdminDashboard />;
    if (section.startsWith('articles')) return <AdminArticles />;
    if (section === 'rss') return <AdminRSS />;
    if (section === 'taxonomy') return <AdminTaxonomy />;
    if (section === 'events') return <AdminEvents />;
    if (section === 'newsletter' || section === 'banners') return <AdminNewsletter />;
    if (section === 'ai') return <AdminAI />;
    return (
      <div style={{ padding: '2rem', color: 'var(--color-ink-light)' }}>
        <p>Trang không tồn tại. <a href="/admin" style={{ color: 'var(--color-crimson)' }}>Về Dashboard</a></p>
      </div>
    );
  };

  return (
    <AdminLayout>
      {renderContent()}
    </AdminLayout>
  );
}
