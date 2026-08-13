import { type ReactNode, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  ArrowRight,
  CalendarDays,
  Check,
} from 'lucide-react';
import {
  type Article,
  type Event,
  type HomepagePayload,
  useGetHomepage,
  useSubscribeNewsletter,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import {
  Footer,
  Masthead,
  Navigation,
  PageShell,
  SectionHeading,
  Ticker,
  UtilityBar,
} from '@/components/page-shell';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import ArticlePage from '@/pages/article';
import CategoryPage from '@/pages/category';
import CountryPage from '@/pages/country';
import SearchPage from '@/pages/search';
import AdminRouter from '@/pages/admin/index';
import { GoogleFormPage } from '@/pages/google-form-page';
import EventsPage from '@/pages/events';
import AboutPage from '@/pages/about';
import ContactPage from '@/pages/contact';
import { Route, Switch, useLocation, Router as WouterRouter, useParams } from 'wouter';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
});

// ─── helpers ──────────────────────────────────────────────────────────────────

const PLACEHOLDER = 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=600&q=80';

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
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(dateStr));
}

function fmtEventDate(event: Event): string {
  const start = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(event.startDate));
  if (!event.endDate) return start;
  return `${start} – ${new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(event.endDate))}`;
}

// ─── small UI atoms ───────────────────────────────────────────────────────────

function Img({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return <img src={src} alt={alt} loading="lazy" className={className} />;
}

function StoryCard({ article, index }: { article: Article; index: number }) {
  return (
    <article className="card animate-in" style={{ animationDelay: `${index * 55}ms` }} data-testid={`card-selected-${index}`}>
      <a className="card-thumb" href={`/bai-viet/${article.slug}`} aria-label={article.title}>
        <Img src={img(article, 600)} alt="" />
      </a>
      <span className="kicker">{articleKicker(article)}</span>
      <h3><a href={`/bai-viet/${article.slug}`}>{article.title}</a></h3>
      {article.sourceName && <div className="source">Nguồn: <strong>{article.sourceName}</strong></div>}
    </article>
  );
}

function StoryRow({ article, size = 300 }: { article: Article; size?: number }) {
  return (
    <div className="stack-row" data-testid={`row-story-${article.slug}`}>
      <a className="stack-thumb" href={`/bai-viet/${article.slug}`} aria-label={article.title}>
        <Img src={img(article, size)} alt="" />
      </a>
      <div>
        <h3 className="story-title"><a href={`/bai-viet/${article.slug}`}>{article.title}</a></h3>
        {article.sourceName && <div className="source">{article.sourceName}</div>}
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
      onSuccess: () => { setMessage('Đã đăng ký thành công. Hẹn gặp bạn vào sáng thứ Hai!'); setEmail(''); },
      onError: () => { setMessage('Có lỗi xảy ra, vui lòng thử lại.'); },
    },
  });
  const handleSubmit = () => {
    if (!email.includes('@')) { setMessage('Vui lòng nhập email hợp lệ.'); return; }
    subscribe.mutate({ data: { email } });
  };
  return (
    <div className="newsletter">
      <h3>Bản tin hằng tuần</h3>
      <p>Nhận điểm tin cộng đồng và kinh tế Séc – Việt mỗi sáng thứ Hai.</p>
      <div className="newsletter-field">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email của bạn" aria-label="Email đăng ký bản tin" data-testid="input-newsletter-email" />
        <button type="button" onClick={handleSubmit} disabled={subscribe.isPending} data-testid="button-newsletter-submit">
          {subscribe.isPending ? '…' : 'Đăng ký'}
        </button>
      </div>
      {message && <div className="newsletter-feedback" role="status" data-testid="status-newsletter"><Check size={13} /> {message}</div>}
    </div>
  );
}

function CommunityWidget({ events }: { events: Event[] }) {
  const now = new Date();
  const upcoming = events
    .filter((ev) => new Date(ev.startDate) >= now)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  const past = events
    .filter((ev) => new Date(ev.startDate) < now)
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  const sorted = [...upcoming, ...past];

  return (
    <div className="widget">
      <div className="widget-head"><CalendarDays size={15} /> Sự kiện của Hội</div>
      <div className="widget-body">
        {sorted.length === 0 ? (
          <p className="empty">Chưa có sự kiện nào.</p>
        ) : sorted.map((ev) => {
          const isPast = new Date(ev.startDate) < now;
          return (
            <div className={`event ${isPast ? 'event--past' : ''}`} key={ev.id}>
              {isPast && <span className="event-past-badge">Đã diễn ra</span>}
              <div className="event-title">{ev.title}</div>
              <div className="event-meta"><strong>{fmtEventDate(ev)}</strong>{ev.location && <span>{ev.location}</span>}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── EU countries band ────────────────────────────────────────────────────────

const EU_COUNTRY_ORDER = [
  { slug: 'cong-hoa-sec', name: 'Cộng hòa Séc', flagClass: 'flag-cz' },
  { slug: 'slovakia', name: 'Slovakia', flagClass: 'flag-sk' },
  { slug: 'ba-lan', name: 'Ba Lan', flagClass: 'flag-pl' },
  { slug: 'duc', name: 'Đức', flagClass: 'flag-de' },
];

// ─── Homepage content ─────────────────────────────────────────────────────────

function HomepageContent({ data }: { data: HomepagePayload }) {
  const topics = ['Tất cả','Chiến tranh Nga – Ukraina','Trí tuệ nhân tạo','Donald Trump','Luật pháp & hội nhập','Khoa học – Giáo dục','Kinh tế Séc','Cộng đồng người Việt'];
  const [topic, setTopic] = useState('Tất cả');

  const tickerItems = data.breakingNews.length
    ? data.breakingNews.map((a) => a.title)
    : ['Vietjet Air mở đường bay Praha – Hà Nội hai chuyến mỗi tuần từ tháng 10','Cộng hòa Séc là điểm đến du lịch tăng trưởng nhanh nhất châu Âu','Luật Bảo vệ dữ liệu cá nhân của Việt Nam chính thức có hiệu lực','Doanh nghiệp Việt tại Séc mở rộng chuỗi bán lẻ sang Đức và Ba Lan'];

  const hero = data.featured;
  const mostRead = data.mostRead.slice(0, 5);
  const selected = data.selected.slice(0, 4);
  const featuresLead = data.features[0] ?? null;
  const featuresCards = data.features.slice(1, 4);

  return (
    <>
      <Ticker items={tickerItems} />
      <main>
        {/* ── Hero + Most Read ── */}
        <section className="hero">
          <div className="wrap page-section">
            <div className="hero-grid">
              <div className="lead animate-in">
                {hero ? (
                  <>
                    <a className="lead-thumb" href={`/bai-viet/${hero.slug}`} aria-label={hero.title}>
                      <Img src={img(hero, 1200)} alt={hero.summary} />
                    </a>
                    <span className="kicker">{articleKicker(hero)}</span>
                    <h1><a href={`/bai-viet/${hero.slug}`}>{hero.title}</a></h1>
                    <p className="dek">{hero.summary}</p>
                    <div className="source">
                      {hero.sourceName && <>Nguồn: <strong>{hero.sourceName}</strong> · </>}
                      {hero.editor && <>Biên tập: {hero.editor}</>}
                      {hero.publishedAt && <> · {fmtDate(hero.publishedAt)}</>}
                    </div>
                  </>
                ) : (
                  <div style={{ height: 380, background: 'var(--color-bone)', borderRadius: 4 }} />
                )}
              </div>
              <div className="side-list" aria-label="Tin đọc nhiều">
                {mostRead.map((article, index) => (
                  <div className="side-item animate-in" style={{ animationDelay: `${(index + 1) * 65}ms` }} key={article.id}>
                    <span className="rank">{index + 1}</span>
                    <div className="side-body">
                      <h3 className="story-title"><a href={`/bai-viet/${article.slug}`}>{article.title}</a></h3>
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
            <SectionHeading title="Tin chọn lọc" more="/danh-muc/tin-tuc" />
            <div className="selected-grid">
              {selected.map((article, index) => <StoryCard key={article.id} article={article} index={index} />)}
            </div>
          </section>
        </div>

        {/* ── EU countries ── */}
        <section className="eu-band">
          <div className="wrap">
            <section className="page-section">
              <SectionHeading title="Tin các nước EU" />
              <div className="eu-grid">
                {EU_COUNTRY_ORDER.map(({ slug, name, flagClass }) => {
                  const stories = (data.euCountries[slug] ?? []).slice(0, 3);
                  return (
                    <div className="eu-col" key={slug}>
                      <div className="country-label"><span className={`flag ${flagClass}`} /><b>{name}</b></div>
                      <ul>
                        {stories.map((a) => (
                          <li key={a.id}><a href={`/bai-viet/${a.slug}`}>{a.title}</a>{a.sourceName && <span>{a.sourceName}</span>}</li>
                        ))}
                        {stories.length === 0 && <li><span className="source">Chưa có tin.</span></li>}
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
                <SectionHeading title="Tin Việt Nam" more="/khu-vuc/viet-nam" />
                <div className="stack">{data.vietnam.slice(0, 3).map((a) => <StoryRow key={a.id} article={a} />)}</div>
              </div>
              <div>
                <SectionHeading title="Tin thế giới" more="/danh-muc/tin-the-gioi" />
                <div className="stack">{data.world.slice(0, 3).map((a) => <StoryRow key={a.id} article={a} />)}</div>
              </div>
            </div>
          </section>
        </div>

        {/* ── Chuyên mục ── */}
        <section className="features">
          <div className="wrap">
            <section className="page-section" id="chuyen-muc">
              <SectionHeading title="Văn hóa truyền thống" more="/danh-muc/van-hoa-truyen-thong" />
              <div className="selected-grid">
                {data.features.slice(0, 4).map((article, index) => <StoryCard key={article.id} article={article} index={index} />)}
              </div>
            </section>
          </div>
        </section>

        {/* ── Kinh doanh + sidebar ── */}
        <div className="wrap">
          <section className="page-section" id="kinh-doanh">
            <div className="with-aside">
              <div>
                <SectionHeading title="Tin kinh doanh" more="/danh-muc/kinh-doanh" />
                <div className="stack">{data.business.slice(0, 4).map((a) => <StoryRow key={a.id} article={a} />)}</div>
              </div>
              <aside id="cong-dong">
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
                  <button type="button" key={item} className={`chip ${item === 'Tất cả' ? 'hot' : ''} ${topic === item ? 'active' : ''}`} onClick={() => setTopic(item)} aria-pressed={topic === item} data-testid={`button-topic-${item}`}>
                    {item}
                  </button>
                ))}
              </div>
              <p className="source" aria-live="polite">Đang xem: <strong>{topic}</strong></p>
            </section>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

// ─── Home page ────────────────────────────────────────────────────────────────

const FALLBACK_TICKER = [
  'Vietjet Air mở đường bay Praha – Hà Nội hai chuyến mỗi tuần từ tháng 10',
  'Cộng hòa Séc là điểm đến du lịch tăng trưởng nhanh nhất châu Âu',
  'Luật Bảo vệ dữ liệu cá nhân của Việt Nam chính thức có hiệu lực',
  'Doanh nghiệp Việt tại Séc mở rộng chuỗi bán lẻ sang Đức và Ba Lan',
];

function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { data, isLoading, error } = useGetHomepage();

  return (
    <div className="page-shell">
      <UtilityBar />
      <Masthead />
      <Navigation open={menuOpen} onToggle={() => setMenuOpen((v) => !v)} />
      {!data && <Ticker items={FALLBACK_TICKER} />}
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
      {data && <HomepageContent data={data} />}
    </div>
  );
}

// ─── Admin wrapper (no PageShell — has own layout) ────────────────────────────

function AdminPage() {
  return <AdminRouter />;
}

// ─── Router ───────────────────────────────────────────────────────────────────

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/bai-viet/:slug" component={ArticlePage} />
        <Route path="/danh-muc/:slug" component={CategoryPage} />
        <Route path="/khu-vuc/:slug" component={CountryPage} />
        <Route path="/tim-kiem" component={SearchPage} />
        <Route path="/dang-ky/thanh-vien" component={() => (
          <GoogleFormPage
            title="Đăng ký thành viên"
            formUrl="https://docs.google.com/forms/d/1Ny4iXisVr1z2jvoWRnIYXX5gH4QAD6PSNQzqluf4_-0/viewform?embedded=true"
          />
        )} />
        <Route path="/dang-ky/tai-tro" component={() => (
          <GoogleFormPage
            title="Đăng ký tài trợ"
            formUrl="https://docs.google.com/forms/d/1xu9W4TxtlXe70_9ZKc3eLkfUtG9sqRLat1mvNX-6EpQ/viewform?embedded=true"
          />
        )} />
        <Route path="/su-kien" component={EventsPage} />
        <Route path="/gioi-thieu/thong-tin-ve-hoi" component={AboutPage} />
        <Route path="/gioi-thieu/lien-he" component={ContactPage} />
        <Route path="/admin/:rest*" component={AdminPage} />
        <Route path="/admin" component={AdminPage} />
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
