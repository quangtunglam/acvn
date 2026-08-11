import { useState } from 'react';
import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { listArticles, listCountries } from '@workspace/api-client-react';
import { PageShell, SectionHeading } from '@/components/page-shell';

const PLACEHOLDER = 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=300&q=80';
const PAGE_SIZE = 12;

const FLAG_MAP: Record<string, string> = {
  sec: '🇨🇿', slovakia: '🇸🇰', 'ba-lan': '🇵🇱', duc: '🇩🇪',
  ao: '🇦🇹', phap: '🇫🇷', 'viet-nam': '🇻🇳',
};

export default function CountryPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? '';
  const [page, setPage] = useState(1);

  const { data: countries } = useQuery({
    queryKey: ['countries'],
    queryFn: listCountries,
    staleTime: 60_000,
  });

  const country = countries?.find((c) => c.slug === slug);

  const { data, isLoading } = useQuery({
    queryKey: ['articles', 'country', slug, page],
    queryFn: () => listArticles({ country: slug, page, pageSize: PAGE_SIZE }),
    enabled: Boolean(slug),
    placeholderData: (prev) => prev,
  });

  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);
  const flag = FLAG_MAP[slug];

  return (
    <PageShell>
      <div className="wrap page-section">
        <div style={{ paddingTop: '2rem', paddingBottom: '0.5rem' }}>
          <nav style={{ fontSize: '0.8rem', color: 'var(--color-ink-light)', marginBottom: '1rem' }}>
            <a href="/">Trang chủ</a> › Khu vực › <span>{country?.name ?? slug}</span>
          </nav>
          <SectionHeading
            title={`${flag ? flag + ' ' : ''}${country?.name ?? slug}`}
            id={`khu-vuc-${slug}`}
          />
        </div>

        {isLoading ? (
          <p style={{ color: 'var(--color-ink-light)', padding: '2rem 0' }}>Đang tải…</p>
        ) : !data?.items.length ? (
          <p style={{ color: 'var(--color-ink-light)', padding: '2rem 0' }}>Chưa có bài viết cho khu vực này.</p>
        ) : (
          <div className="selected-grid">
            {data.items.map((article) => (
              <article key={article.id} className="card animate-in">
                <a className="card-thumb" href={`/bai-viet/${article.slug}`} aria-label={article.title}>
                  <img src={article.coverImage ?? PLACEHOLDER} alt="" loading="lazy" />
                </a>
                <span className="kicker">{article.category.name}</span>
                <h3><a href={`/bai-viet/${article.slug}`}>{article.title}</a></h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-light)', margin: '4px 0 8px' }}>
                  {article.summary}
                </p>
                {article.sourceName && (
                  <div className="source">Nguồn: <strong>{article.sourceName}</strong></div>
                )}
              </article>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: '2.5rem', paddingBottom: '2rem' }}>
            <button className="chip" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <ChevronLeft size={14} /> Trước
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => Math.abs(p - page) <= 2)
              .map((p) => (
                <button key={p} className={`chip ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
              ))}
            <button className="chip" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              Sau <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </PageShell>
  );
}
