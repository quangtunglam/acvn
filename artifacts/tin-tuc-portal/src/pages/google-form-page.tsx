import { PageShell } from '@/components/page-shell';

interface GoogleFormPageProps {
  title: string;
  formUrl: string;
}

export function GoogleFormPage({ title, formUrl }: GoogleFormPageProps) {
  return (
    <PageShell>
      <div className="wrap" style={{ paddingBlock: '2rem' }}>
        <h1 style={{ fontFamily: 'var(--app-font-serif)', fontSize: 'clamp(22px,3vw,32px)', fontWeight: 700, marginBottom: '1.5rem', letterSpacing: '-.02em' }}>
          {title}
        </h1>
        <iframe
          src={formUrl}
          width="100%"
          style={{ border: 'none', minHeight: '80vh', borderRadius: 8 }}
          title={title}
          allowFullScreen
        />
      </div>
    </PageShell>
  );
}
