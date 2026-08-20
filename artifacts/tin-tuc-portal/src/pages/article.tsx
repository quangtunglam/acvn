import { useEffect } from 'react';
import { useParams } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Calendar, Eye, User } from 'lucide-react';
import { getArticle, incrementArticleView, listArticles } from '@workspace/api-client-react';
import { PageShell, SectionHeading } from '@/components/page-shell';

const PLACEHOLDER = 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=1200&q=80';

function fmtDate(s: string | null): string {
  if (!s) return '';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(s));
}

export default function ArticlePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? '';

  const { data: article, isLoading, error } = useQuery({
    queryKey: ['article', slug],
    queryFn: () => getArticle(slug),
    enabled: Boolean(slug),
    retry: false,
  });

  const incrementView = useMutation({
    mutationFn: () => incrementArticleView(slug),
  });

  useEffect(() => {
    if (article) {
      incrementView.mutate();
      // SEO
      document.title = `${article.title} | VietPress EU`;
      const setMeta = (name: string, content: string) => {
        let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
        if (!el) { el = document.createElement('meta'); el.name = name; document.head.appendChild(el); }
        el.content = content;
      };
      const setOg = (prop: string, content: string) => {
        let el = document.querySelector(`meta[property="${prop}"]`) as HTMLMetaElement | null;
        if (!el) { el = document.createElement('meta'); el.setAttribute('property', prop); document.head.appendChild(el); }
        el.content = content;
      };
      setMeta('description', article.summary);
      setOg('og:title', article.title);
      setOg('og:description', article.summary);
      setOg('og:image', article.coverImage ?? PLACEHOLDER);
      setOg('og:type', 'article');
    }
    return () => { document.title = 'VietPress EU'; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article?.slug]);

  // Related articles (same category)
  const { data: related } = useQuery({
    queryKey: ['related', article?.category.slug],
    queryFn: () => listArticles({ category: article!.category.slug, pageSize: 4 }),
    enabled: Boolean(article),
  });

  const relatedFiltered = related?.items.filter((a) => a.slug !== slug).slice(0, 3) ?? [];

  if (isLoading) {
    return (
      <PageShell>
        <div className="wrap page-section" style={{ paddingTop: '3rem', color: 'var(--color-ink-light)' }}>
          Đang tải bài viết…
        </div>
      </PageShell>
    );
  }

  if (error || !article) {
    return (
      <PageShell>
        <div className="wrap page-section" style={{ paddingTop: '3rem' }}>
          <h1 style={{ color: 'var(--color-crimson)' }}>Không tìm thấy bài viết</h1>
          <p style={{ marginTop: 12, color: 'var(--color-ink-light)' }}>
            Bài viết không tồn tại hoặc đã bị gỡ xuống.
          </p>
          <a href="/" className="more-link" style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <ArrowLeft size={13} /> Về trang chủ
          </a>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      {/* Breadcrumb */}
      <div className="wrap" style={{ paddingTop: '1.5rem' }}>
        <nav style={{ fontSize: '0.8rem', color: 'var(--color-ink-light)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <a href="/">Trang chủ</a>
          <span>›</span>
          <a href={`/danh-muc/${article.category.slug}`}>{article.category.name}</a>
          {article.country && (
            <>
              <span>›</span>
              <a href={`/khu-vuc/${article.country.slug}`}>{article.country.name}</a>
            </>
          )}
        </nav>
      </div>

      {/* Article content */}
      <article style={{ maxWidth: 760, margin: '0 auto', padding: '1.5rem 1rem 3rem' }}>
        {/* Category kicker */}
        <span className="kicker">{article.category.name}{article.country ? ` · ${article.country.name}` : ''}</span>

        {/* Title */}
        <h1 style={{
          fontFamily: 'var(--font-serif)', fontSize: 'clamp(1.5rem, 4vw, 2.25rem)',
          lineHeight: 1.25, marginTop: '0.5rem', marginBottom: '1rem', color: 'var(--color-ink)',
        }}>
          {article.title}
        </h1>

        {/* Summary */}
        <p style={{
          fontSize: '1.1rem', lineHeight: 1.6, color: 'var(--color-ink-light)',
          borderLeft: '3px solid var(--color-crimson)', paddingLeft: '1rem',
          marginBottom: '1.25rem', fontStyle: 'italic',
        }}>
          {article.summary}
        </p>

        {/* Meta row */}
        <div style={{
          display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: '0.8rem',
          color: 'var(--color-ink-light)', borderBottom: '1px solid var(--color-rule)',
          paddingBottom: '1rem', marginBottom: '1.5rem',
        }}>
          {article.author && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <User size={13} /> {article.author.name}
            </span>
          )}
          {article.publishedAt && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={13} /> {fmtDate(article.publishedAt)}
            </span>
          )}
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Eye size={13} /> {article.views.toLocaleString('vi-VN')} lượt đọc
          </span>
          {article.sourceName && (
            <span>
              Nguồn: {article.sourceUrl
                ? <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer">{article.sourceName}</a>
                : article.sourceName}
            </span>
          )}
        </div>

        {/* Cover image */}
        {article.coverImage && (
          <figure style={{ margin: '0 0 1.5rem', borderRadius: 4, overflow: 'hidden' }}>
            <img
              src={article.coverImage}
              alt={article.title}
              style={{ width: '100%', height: 'auto', display: 'block' }}
              loading="eager"
            />
          </figure>
        )}

        {/* Body HTML */}
        <div
          className="article-body"
          dangerouslySetInnerHTML={{ __html: article.content }}
          style={{
            lineHeight: 1.8, fontSize: '1rem', color: 'var(--color-ink)',
            fontFamily: 'var(--font-serif)',
          }}
        />

        {/* Back link */}
        <div style={{ marginTop: '2.5rem', borderTop: '1px solid var(--color-rule)', paddingTop: '1.5rem' }}>
          <a href={`/danh-muc/${article.category.slug}`} className="more-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <ArrowLeft size={13} /> Quay lại {article.category.name}
          </a>
        </div>
      </article>

      {/* Related articles */}
      {relatedFiltered.length > 0 && (
        <div className="wrap" style={{ paddingBottom: '3rem' }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <SectionHeading title="Bài viết liên quan" />
            <div className="selected-grid">
              {relatedFiltered.map((a) => (
                <article key={a.id} className="card">
                  {a.coverImage && (
                    <a className="card-thumb" href={`/bai-viet/${a.slug}`} aria-label={a.title}>
                      <img src={a.coverImage} alt="" loading="lazy" />
                    </a>
                  )}
                  <span className="kicker">{a.category.name}</span>
                  <h3><a href={`/bai-viet/${a.slug}`}>{a.title}</a></h3>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
