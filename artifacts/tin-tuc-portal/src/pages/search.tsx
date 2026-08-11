import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { searchArticles } from '@workspace/api-client-react';
import { PageShell, SectionHeading } from '@/components/page-shell';

const PLACEHOLDER = 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=300&q=80';
const PAGE_SIZE = 12;

export default function SearchPage() {
  const [location, setLocation] = useLocation();
  const params = new URLSearchParams(
    typeof window !== 'undefined' ? window.location.search : ''
  );
  const initialQ = params.get('q') ?? '';
  const [inputVal, setInputVal] = useState(initialQ);
  const [q, setQ] = useState(initialQ);
  const [page, setPage] = useState(1);

  // sync URL → state
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('q') ?? '';
    setQ(p);
    setInputVal(p);
    setPage(1);
  }, [location]);

  const { data, isLoading } = useQuery({
    queryKey: ['search', q, page],
    queryFn: () => searchArticles({ q, page, pageSize: PAGE_SIZE }),
    enabled: q.trim().length > 0,
    placeholderData: (prev) => prev,
  });

  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  const handleSearch = () => {
    if (inputVal.trim()) {
      setLocation(`/tim-kiem?q=${encodeURIComponent(inputVal.trim())}`);
    }
  };

  return (
    <PageShell>
      <div className="wrap page-section" style={{ paddingTop: '2rem' }}>
        {/* Search bar */}
        <div style={{
          display: 'flex', gap: 8, marginBottom: '2rem',
          maxWidth: 600,
        }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--color-ink-light)',
            }} />
            <input
              type="search"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Nhập từ khoá tìm kiếm…"
              style={{
                width: '100%', paddingLeft: 40, paddingRight: 12, paddingTop: 10, paddingBottom: 10,
                border: '1px solid var(--color-rule)', borderRadius: 4,
                fontFamily: 'var(--font-sans)', fontSize: '0.95rem',
                background: 'var(--color-paper)', color: 'var(--color-ink)',
              }}
            />
          </div>
          <button
            type="button"
            onClick={handleSearch}
            style={{
              background: 'var(--color-navy)', color: '#fff', border: 'none',
              borderRadius: 4, padding: '0 20px', cursor: 'pointer',
              fontFamily: 'var(--font-sans)', fontSize: '0.9rem',
            }}
          >
            Tìm
          </button>
        </div>

        {q ? (
          <>
            <SectionHeading title={`Kết quả cho "${q}"`} />
            {isLoading ? (
              <p style={{ color: 'var(--color-ink-light)' }}>Đang tìm kiếm…</p>
            ) : !data?.items.length ? (
              <div style={{ padding: '2rem 0', color: 'var(--color-ink-light)' }}>
                <p>Không tìm thấy bài viết phù hợp với <strong>"{q}"</strong>.</p>
                <p style={{ marginTop: 8, fontSize: '0.9rem' }}>Hãy thử từ khoá khác hoặc kiểm tra lại chính tả.</p>
              </div>
            ) : (
              <>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-light)', marginBottom: '1.5rem' }}>
                  Tìm thấy <strong>{data.total}</strong> kết quả
                </p>
                <div className="selected-grid">
                  {data.items.map((article) => (
                    <article key={article.id} className="card animate-in">
                      <a className="card-thumb" href={`/bai-viet/${article.slug}`} aria-label={article.title}>
                        <img src={article.coverImage ?? PLACEHOLDER} alt="" loading="lazy" />
                      </a>
                      <span className="kicker">
                        {article.category.name}{article.country ? ` · ${article.country.name}` : ''}
                      </span>
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
              </>
            )}
          </>
        ) : (
          <div style={{ padding: '3rem 0', color: 'var(--color-ink-light)', textAlign: 'center' }}>
            <Search size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
            <p>Nhập từ khoá để bắt đầu tìm kiếm</p>
          </div>
        )}
      </div>
    </PageShell>
  );
}
