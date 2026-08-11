import { type ReactNode, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  ArrowRight,
  CalendarDays,
  Check,
  CloudSun,
  Facebook,
  Globe2,
  Mail,
  Menu,
  Pause,
  Search,
  X,
  Youtube,
} from 'lucide-react';
import {
  type Article,
  type Event,
  type HomepagePayload,
  useGetHomepage,
  useSubscribeNewsletter,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
});

// ─── helpers ──────────────────────────────────────────────────────────────────

const PLACEHOLDER =
  'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=600&q=80';

function img(article: Article, width = 600): string {
  return article.coverImage ?? PLACEHOLDER.replace('600', String(width));
}

function articleKicker(article: Article): string {
  const parts: string[] = [article.category.name];
  if (article.country) parts.push(article.country.name);
  return parts.join(' · ');
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateStr));
}

function fmtEventDate(event: Event): string {
  const start = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(event.startDate));
  if (!event.endDate) return start;
  const end = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(event.endDate));
  return `${start} – ${end}`;
}

// ─── small primitives ─────────────────────────────────────────────────────────

function Img({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return <img src={src} alt={alt} loading="lazy" className={className} />;
}

function SectionHeading({ title, more, id }: { title: string; more?: string; id?: string }) {
  return (
    <div className="section-heading" id={id}>
      <h2><span className="section-mark">▍</span>{title}</h2>
      <div className="section-rule" />
      {more && (
        <a className="more-link" href="#tin-tuc" data-testid={`link-more-${title}`}>
          {more} <ArrowRight size={13} />
        </a>
      )}
    </div>
  );
}

// ─── story cards ──────────────────────────────────────────────────────────────

function StoryCard({ article, index }: { article: Article; index: number }) {
  return (
    <article
      className="card animate-in"
      style={{ animationDelay: `${index * 55}ms` }}
      data-testid={`card-selected-${index}`}
    >
      <a className="card-thumb" href={`#article-${article.slug}`} aria-label={article.title}>
        <Img src={img(article, 600)} alt="" />
      </a>
      <span className="kicker">{articleKicker(article)}</span>
      <h3><a href={`#article-${article.slug}`}>{article.title}</a></h3>
      {article.sourceName && (
        <div className="source">Nguồn: <strong>{article.sourceName}</strong></div>
      )}
    </article>
  );
}

function StoryRow({ article, size = 300 }: { article: Article; size?: number }) {
  return (
    <div className="stack-row" data-testid={`row-story-${article.slug}`}>
      <a className="stack-thumb" href={`#article-${article.slug}`} aria-label={article.title}>
        <Img src={img(article, size)} alt="" />
      </a>
      <div>
        <h3 className="story-title"><a href={`#article-${article.slug}`}>{article.title}</a></h3>
        {article.sourceName && <div className="source">{article.sourceName}</div>}
      </div>
    </div>
  );
}

// ─── skeleton fallbacks ───────────────────────────────────────────────────────

function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton ${className}`} style={{ background: 'var(--color-bone)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite', ...style }} />;
}

// ─── layout sections ──────────────────────────────────────────────────────────

function UtilityBar() {
  const today = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());
  return (
    <div className="utility">
      <div className="wrap">
        <div className="u-left">
          <span className="u-date" data-testid="text-current-date">{today}</span>
          <span className="u-sep">•</span>
          <span>Praha 21°C <CloudSun size={13} aria-label="Có mây" /></span>
          <span className="u-sep">•</span>
          <span>Hà Nội 34°C <CloudSun size={13} aria-label="Nắng nhẹ" /></span>
        </div>
        <div className="u-right">
          <a href="#kinh-doanh">Bảng tỷ giá</a>
          <span className="u-sep">|</span>
          <span className="lang"><b>VI</b> / <a href="#tin-tuc">CZ</a> / <a href="#tin-tuc">EN</a></span>
        </div>
      </div>
    </div>
  );
}

function Masthead() {
  return (
    <header className="masthead">
      <div className="wrap">
        <a className="logo" href="/" aria-label="Trang chủ VietPress EU" data-testid="link-logo">
          <span className="logo-mark">V</span>
          <span>
            <span className="logo-name">VietPress<em>EU</em></span>
            <span className="logo-tag">Cộng đồng người Việt tại châu Âu</span>
          </span>
        </a>
        <div className="masthead-ad">KHU VỰC ĐẶT LOGO / QUẢNG CÁO ĐỐI TÁC</div>
      </div>
    </header>
  );
}

function Navigation({
  open,
  onToggle,
  onSearch,
}: {
  open: boolean;
  onToggle: () => void;
  onSearch: (value: string) => void;
}) {
  const links: [string, string][] = [
    ['Trang chủ', '/'],
    ['Tin tức', '#tin-tuc'],
    ['Kinh doanh', '#kinh-doanh'],
    ['Chuyên mục', '#chuyen-muc'],
    ['Golf', '#golf'],
    ['Cộng đồng', '#cong-dong'],
  ];
  return (
    <nav className="primary-nav" aria-label="Điều hướng chính">
      <div className="wrap">
        <div className={`nav-links ${open ? 'open' : ''}`}>
          {links.map(([label, href], index) => (
            <a
              key={label}
              className={`nav-link ${index === 0 ? 'active' : ''}`}
              href={href}
              onClick={onToggle}
              data-testid={`link-nav-${label}`}
            >
              {label}
            </a>
          ))}
        </div>
        <div className="nav-spacer" />
        <label className="nav-search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Tìm kiếm tin bài…"
            aria-label="Tìm kiếm tin bài"
            data-testid="input-search"
          />
        </label>
        <button
          className="menu-button"
          type="button"
          onClick={onToggle}
          aria-label={open ? 'Đóng menu' : 'Mở menu'}
          aria-expanded={open}
          data-testid="button-mobile-menu"
        >
          {open ? <X size={23} /> : <Menu size={23} />}
        </button>
      </div>
    </nav>
  );
}

function Ticker({ items }: { items: string[] }) {
  const loop = [...items, ...items];
  return (
    <div className="ticker" aria-label="Tin nóng">
      <div className="wrap">
        <span className="ticker-label"><span className="ticker-dot" />Tin nóng</span>
        <div className="ticker-track">
          <div className="ticker-move">
            {loop.map((item, index) => (
              <a href="#tin-tuc" key={`${item}-${index}`}>{item}</a>
            ))}
          </div>
        </div>
        <Pause size={13} aria-label="Di chuột để tạm dừng" />
      </div>
    </div>
  );
}

// ─── newsletter widget ────────────────────────────────────────────────────────

function NewsletterWidget() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const subscribe = useSubscribeNewsletter({
    mutation: {
      onSuccess: () => {
        setMessage('Đã đăng ký thành công. Hẹn gặp bạn vào sáng thứ Hai!');
        setEmail('');
      },
      onError: () => {
        setMessage('Có lỗi xảy ra, vui lòng thử lại.');
      },
    },
  });

  const handleSubmit = () => {
    if (!email.includes('@')) {
      setMessage('Vui lòng nhập một địa chỉ email hợp lệ.');
      return;
    }
    subscribe.mutate({ data: { email } });
  };

  return (
    <div className="newsletter">
      <h3>Bản tin hằng tuần</h3>
      <p>Nhận điểm tin cộng đồng và kinh tế Séc – Việt mỗi sáng thứ Hai.</p>
      <div className="newsletter-field">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email của bạn"
          aria-label="Email đăng ký bản tin"
          data-testid="input-newsletter-email"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={subscribe.isPending}
          data-testid="button-newsletter-submit"
        >
          {subscribe.isPending ? '…' : 'Đăng ký'}
        </button>
      </div>
      {message && (
        <div className="newsletter-feedback" role="status" data-testid="status-newsletter">
          <Check size={13} /> {message}
        </div>
      )}
    </div>
  );
}

// ─── golf / events widgets ────────────────────────────────────────────────────

function GolfWidget({ events }: { events: Event[] }) {
  return (
    <div className="widget" id="golf">
      <div className="widget-head red"><Globe2 size={15} /> Lịch giải Golf</div>
      <div className="widget-body">
        {events.length === 0 ? (
          <p className="empty">Chưa có giải Golf sắp diễn ra.</p>
        ) : (
          events.map((event) => (
            <div className="event" key={event.id}>
              <div className="event-title">{event.title}</div>
              <div className="event-meta">
                <strong>{fmtEventDate(event)}</strong>
                {event.location && <span>{event.location}</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CommunityWidget({ events }: { events: Event[] }) {
  return (
    <div className="widget">
      <div className="widget-head"><CalendarDays size={15} /> Sự kiện cộng đồng</div>
      <div className="widget-body">
        {events.length === 0 ? (
          <>
            <p className="empty">Chưa có sự kiện sắp diễn ra.</p>
            <p style={{ marginTop: 10 }}>
              <a href="#cong-dong" className="more-link">
                Xem các sự kiện đã qua <ArrowRight size={13} />
              </a>
            </p>
          </>
        ) : (
          events.map((event) => (
            <div className="event" key={event.id}>
              <div className="event-title">{event.title}</div>
              <div className="event-meta">
                <strong>{fmtEventDate(event)}</strong>
                {event.location && <span>{event.location}</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── homepage content (receives resolved data) ────────────────────────────────

const EU_COUNTRY_ORDER = [
  { slug: 'sec', name: 'Cộng hòa Séc', flagClass: 'flag-cz' },
  { slug: 'slovakia', name: 'Slovakia', flagClass: 'flag-sk' },
  { slug: 'ba-lan', name: 'Ba Lan', flagClass: 'flag-pl' },
  { slug: 'duc', name: 'Đức', flagClass: 'flag-de' },
];

function HomepageContent({
  data,
  query,
}: {
  data: HomepagePayload;
  query: string;
}) {
  const topics = [
    'Tất cả',
    'Chiến tranh Nga – Ukraina',
    'Trí tuệ nhân tạo',
    'Donald Trump',
    'Golf',
    'Luật pháp & hội nhập',
    'Khoa học – Giáo dục',
    'Kinh tế Séc',
    'Cộng đồng người Việt',
  ];
  const [topic, setTopic] = useState('Tất cả');

  // Local search over loaded articles
  const allArticles = useMemo(
    () => [
      ...data.breakingNews,
      ...(data.featured ? [data.featured] : []),
      ...data.mostRead,
      ...data.selected,
      ...data.vietnam,
      ...data.world,
      ...data.business,
      ...data.features,
    ],
    [data],
  );

  const deduped = useMemo(() => {
    const seen = new Set<number>();
    return allArticles.filter((a) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
  }, [allArticles]);

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return deduped
      .filter((a) =>
        `${a.title} ${a.summary} ${a.category.name} ${a.country?.name ?? ''}`.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [query, deduped]);

  const tickerItems = data.breakingNews.length
    ? data.breakingNews.map((a) => a.title)
    : [
        'Vietjet Air mở đường bay Praha – Hà Nội hai chuyến mỗi tuần từ tháng 10',
        'Cộng hòa Séc là điểm đến du lịch tăng trưởng nhanh nhất châu Âu',
        'Luật Bảo vệ dữ liệu cá nhân của Việt Nam chính thức có hiệu lực',
        'Doanh nghiệp Việt tại Séc mở rộng chuỗi bán lẻ sang Đức và Ba Lan',
      ];

  const hero = data.featured;
  const mostRead = data.mostRead.slice(0, 5);
  const selected = data.selected.slice(0, 4);
  const featuresLead = data.features[0] ?? null;
  const featuresCards = data.features.slice(1, 4);

  return (
    <>
      <Ticker items={tickerItems} />
      <main>
        {/* ── Search overlay ── */}
        {query && (
          <div className="wrap">
            <div className="search-panel" role="region" aria-live="polite">
              <h2>Kết quả tìm kiếm cho "{query}"</h2>
              {searchResults.length ? (
                <div className="search-results">
                  {searchResults.map((a, i) => (
                    <a
                      href={`#article-${a.slug}`}
                      className="search-result"
                      key={a.id}
                      data-testid={`search-result-${i}`}
                    >
                      {a.title}
                      <span className="kicker">{articleKicker(a)}</span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="source">Không tìm thấy bài viết phù hợp. Hãy thử từ khoá khác.</p>
              )}
            </div>
          </div>
        )}

        {/* ── Hero + Most Read ── */}
        <section className="hero">
          <div className="wrap page-section">
            <div className="hero-grid">
              {/* Lead story */}
              <div className="lead animate-in">
                {hero ? (
                  <>
                    <a className="lead-thumb" href={`#article-${hero.slug}`} aria-label={hero.title}>
                      <Img src={img(hero, 1200)} alt={hero.summary} />
                    </a>
                    <span className="kicker">{articleKicker(hero)}</span>
                    <h1><a href={`#article-${hero.slug}`}>{hero.title}</a></h1>
                    <p className="dek">{hero.summary}</p>
                    <div className="source">
                      {hero.sourceName && <>Nguồn: <strong>{hero.sourceName}</strong> · </>}
                      {hero.editor && <>Biên tập: {hero.editor}</>}
                      {hero.publishedAt && <> · {fmtDate(hero.publishedAt)}</>}
                    </div>
                  </>
                ) : (
                  <>
                    <Skeleton className="lead-thumb" style={{ height: 380 } as React.CSSProperties} />
                    <Skeleton style={{ height: 20, marginTop: 12, width: '60%' } as React.CSSProperties} />
                    <Skeleton style={{ height: 32, marginTop: 8 } as React.CSSProperties} />
                  </>
                )}
              </div>

              {/* Most-read sidebar */}
              <div className="side-list" aria-label="Tin đọc nhiều">
                {mostRead.map((article, index) => (
                  <div
                    className="side-item animate-in"
                    style={{ animationDelay: `${(index + 1) * 65}ms` }}
                    key={article.id}
                  >
                    <span className="rank">{index + 1}</span>
                    <div>
                      <h3 className="story-title">
                        <a href={`#article-${article.slug}`}>{article.title}</a>
                      </h3>
                      <div className="source">{articleKicker(article)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Tin chọn lọc ── */}
        <div className="wrap">
          <section className="page-section" id="tin-tuc">
            <SectionHeading title="Tin chọn lọc" more="Xem tất cả" />
            <div className="selected-grid">
              {selected.map((article, index) => (
                <StoryCard key={article.id} article={article} index={index} />
              ))}
            </div>
          </section>
        </div>

        {/* ── EU countries band ── */}
        <section className="eu-band">
          <div className="wrap">
            <section className="page-section">
              <SectionHeading title="Tin các nước EU" />
              <div className="eu-grid">
                {EU_COUNTRY_ORDER.map(({ slug, name, flagClass }) => {
                  const stories = (data.euCountries[slug] ?? []).slice(0, 3);
                  return (
                    <div className="eu-col" key={slug}>
                      <div className="country-label">
                        <span className={`flag ${flagClass}`} />
                        <b>{name}</b>
                      </div>
                      <ul>
                        {stories.map((a) => (
                          <li key={a.id}>
                            <a href={`#article-${a.slug}`}>{a.title}</a>
                            {a.sourceName && <span>{a.sourceName}</span>}
                          </li>
                        ))}
                        {stories.length === 0 && (
                          <li><span className="source">Chưa có tin.</span></li>
                        )}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </section>

        {/* ── Việt Nam + Thế giới ── */}
        <div className="wrap">
          <section className="page-section">
            <div className="two-col">
              <div>
                <SectionHeading title="Tin Việt Nam" />
                <div className="stack">
                  {data.vietnam.slice(0, 3).map((a) => (
                    <StoryRow key={a.id} article={a} size={300} />
                  ))}
                </div>
              </div>
              <div>
                <SectionHeading title="Tin thế giới" />
                <div className="stack">
                  {data.world.slice(0, 3).map((a) => (
                    <StoryRow key={a.id} article={a} size={300} />
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ── Chuyên mục (Features) ── */}
        <section className="features">
          <div className="wrap">
            <section className="page-section" id="chuyen-muc">
              <SectionHeading title="Chuyên mục" more="Tất cả bài viết" />
              {featuresLead && (
                <div className="feature-lead">
                  <a
                    className="feature-image"
                    href={`#article-${featuresLead.slug}`}
                    aria-label={featuresLead.title}
                  >
                    <Img src={img(featuresLead, 900)} alt={featuresLead.summary} />
                  </a>
                  <div className="feature-body">
                    <span className="kicker">{featuresLead.category.name}</span>
                    <h2>{featuresLead.title}</h2>
                    <p>{featuresLead.summary}</p>
                    {featuresLead.author && (
                      <div className="author">Tác giả: <strong>{featuresLead.author.name}</strong></div>
                    )}
                  </div>
                </div>
              )}
              <div className="feature-cards">
                {featuresCards.map((a) => (
                  <article className="card" key={a.id}>
                    <a className="card-thumb" href={`#article-${a.slug}`} aria-label={a.title}>
                      <Img src={img(a, 600)} alt="" />
                    </a>
                    <span className="kicker">{a.category.name}</span>
                    <h3><a href={`#article-${a.slug}`}>{a.title}</a></h3>
                    {a.author && (
                      <div className="author">Tác giả: <strong>{a.author.name}</strong></div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          </div>
        </section>

        {/* ── Kinh doanh + sidebar ── */}
        <div className="wrap">
          <section className="page-section" id="kinh-doanh">
            <div className="with-aside">
              <div>
                <SectionHeading title="Tin kinh doanh" more="Xem thêm" />
                <div className="stack">
                  {data.business.slice(0, 4).map((a) => (
                    <StoryRow key={a.id} article={a} size={300} />
                  ))}
                </div>
              </div>
              <aside id="cong-dong">
                <GolfWidget events={data.golfEvents} />
                <CommunityWidget events={data.communityEvents} />
                <NewsletterWidget />
              </aside>
            </div>
          </section>
        </div>

        {/* ── Topics strip ── */}
        <section className="topics">
          <div className="wrap">
            <section className="page-section">
              <SectionHeading title="Theo dòng sự kiện" />
              <div className="chips">
                {topics.map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={`chip ${item === 'Tất cả' ? 'hot' : ''} ${topic === item ? 'active' : ''}`}
                    onClick={() => setTopic(item)}
                    aria-pressed={topic === item}
                    data-testid={`button-topic-${item}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <p className="source" aria-live="polite">
                Đang xem: <strong>{topic}</strong>
              </p>
            </section>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

// ─── Home (fetches data) ───────────────────────────────────────────────────────

function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { data, isLoading, error } = useGetHomepage();

  const fallbackTicker = [
    'Vietjet Air mở đường bay Praha – Hà Nội hai chuyến mỗi tuần từ tháng 10',
    'Cộng hòa Séc là điểm đến du lịch tăng trưởng nhanh nhất châu Âu',
    'Luật Bảo vệ dữ liệu cá nhân của Việt Nam chính thức có hiệu lực',
    'Doanh nghiệp Việt tại Séc mở rộng chuỗi bán lẻ sang Đức và Ba Lan',
  ];

  return (
    <div className="page-shell">
      <UtilityBar />
      <Masthead />
      <Navigation
        open={menuOpen}
        onToggle={() => setMenuOpen((v) => !v)}
        onSearch={setQuery}
      />

      {/* Render ticker with whatever we have */}
      {!data && <Ticker items={fallbackTicker} />}

      {isLoading && !data && (
        <main>
          <div className="wrap page-section" style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--color-ink-light)' }}>
            Đang tải nội dung…
          </div>
        </main>
      )}

      {error && !data && (
        <main>
          <div className="wrap page-section" style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--color-crimson)' }}>
            Không thể tải nội dung. Vui lòng thử lại sau.
          </div>
        </main>
      )}

      {data && (
        <HomepageContent data={data} query={query} />
      )}
    </div>
  );
}

// ─── footer ───────────────────────────────────────────────────────────────────

function FooterColumn({ title, links }: { title: string; links: string[] }) {
  return (
    <div className="footer-col">
      <h3>{title}</h3>
      <ul>{links.map((link) => <li key={link}><a href="#tin-tuc">{link}</a></li>)}</ul>
    </div>
  );
}

function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div className="footer-grid">
          <div className="footer-brand">
            <span className="logo-name">VietPress<em>EU</em></span>
            <p>Cổng thông tin kết nối cộng đồng người Việt, doanh nghiệp và công nghệ tại Cộng hòa Séc và châu Âu.</p>
            <div className="socials">
              <a className="social-link" href="#tin-tuc" aria-label="Facebook"><Facebook size={16} /></a>
              <a className="social-link" href="#tin-tuc" aria-label="YouTube"><Youtube size={16} /></a>
              <a className="social-link" href="mailto:toasoan@vietpress.eu" aria-label="Email"><Mail size={16} /></a>
            </div>
          </div>
          <FooterColumn title="Chuyên mục" links={['Tin tức', 'Kinh doanh', 'Chuyện đầu tư', 'Golf', 'Cộng đồng']} />
          <FooterColumn title="Khu vực" links={['Cộng hòa Séc', 'Slovakia', 'Ba Lan', 'Đức', 'Việt Nam']} />
          <FooterColumn title="Liên hệ" links={['Email: toasoan@vietpress.eu', 'Gửi tin bài', 'Quảng cáo', 'Về chúng tôi']} />
        </div>
        <div className="footer-bottom">
          <span>© 2025–2026 VietPress EU. Bảo lưu mọi quyền.</span>
          <span className="footer-links">
            <a href="#tin-tuc">Điều khoản sử dụng</a>
            <a href="#tin-tuc">Chính sách bảo mật</a>
            <a href="#tin-tuc">Cookie</a>
          </span>
        </div>
      </div>
    </footer>
  );
}

// ─── router + app root ────────────────────────────────────────────────────────

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
