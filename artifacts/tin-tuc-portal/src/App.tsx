import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
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
import MemberRegistrationPage from '@/pages/member-registration';
import SponsorRegistrationPage from '@/pages/sponsor-registration';
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
  const fmt = (d: Date) => new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
  const start = new Date(event.startDate);
  const startStr = fmt(start);
  if (!event.endDate) return startStr;
  const end = new Date(event.endDate);
  if (start.toDateString() === end.toDateString()) return startStr;
  return `${startStr} – ${fmt(end)}`;
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

// ─── Czech weather widget ─────────────────────────────────────────────────────

const VI_DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

// ── SVG weather icons ─────────────────────────────────────────────────────────
function WxIcon({ code, isDay = true, size = 40 }: { code: number; isDay?: boolean; size?: number }) {
  const s = size;
  // Clear
  if (code === 0 && isDay) return (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="13" fill="#FFD600"/>
      {[0,45,90,135,180,225,270,315].map(a => (
        <line key={a} x1="32" y1="6" x2="32" y2="13" stroke="#FFD600" strokeWidth="3.5" strokeLinecap="round"
          transform={`rotate(${a} 32 32)`}/>
      ))}
    </svg>
  );
  if (code === 0 && !isDay) return (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
      <path d="M42 22a16 16 0 1 1-20 20 12 12 0 0 0 20-20z" fill="#FFC107"/>
      <circle cx="46" cy="14" r="2.5" fill="#FFF9C4"/>
      <circle cx="52" cy="22" r="1.8" fill="#FFF9C4"/>
      <circle cx="40" cy="8" r="2" fill="#FFF9C4"/>
    </svg>
  );
  // Partly cloudy
  if (code <= 2) return (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
      {isDay && <><circle cx="22" cy="26" r="10" fill="#FFD600"/>
      {[315,0,45].map(a=>(
        <line key={a} x1="22" y1="8" x2="22" y2="14" stroke="#FFD600" strokeWidth="3" strokeLinecap="round"
          transform={`rotate(${a} 22 26)`}/>
      ))}</>}
      <rect x="14" y="34" width="36" height="18" rx="9" fill="white"/>
      <rect x="22" y="28" width="26" height="16" rx="8" fill="white"/>
      <rect x="13" y="33" width="38" height="20" rx="10" fill="white" opacity=".7"/>
      <rect x="14" y="35" width="36" height="17" rx="8.5" fill="#E3F2FD"/>
    </svg>
  );
  // Overcast
  if (code === 3) return (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
      <rect x="8" y="30" width="48" height="22" rx="11" fill="#B0BEC5"/>
      <rect x="18" y="22" width="34" height="20" rx="10" fill="#CFD8DC"/>
      <rect x="8" y="30" width="48" height="22" rx="11" fill="#90A4AE" opacity=".5"/>
    </svg>
  );
  // Fog
  if (code <= 48) return (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
      {[18,28,38,48].map((y,i)=>(
        <rect key={y} x={8+i*2} y={y} width={48-i*4} height="4" rx="2" fill="#B0BEC5" opacity={1-i*0.15}/>
      ))}
    </svg>
  );
  // Drizzle / Light rain
  if (code <= 65) return (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
      <rect x="10" y="14" width="44" height="22" rx="11" fill="#64B5F6"/>
      <rect x="18" y="8" width="30" height="18" rx="9" fill="#90CAF9"/>
      {[[20,42],[32,46],[44,42],[26,50],[38,50]].map(([x,y])=>(
        <line key={`${x}${y}`} x1={x} y1={y} x2={x-3} y2={y+8} stroke="#1E88E5" strokeWidth="2.5" strokeLinecap="round"/>
      ))}
    </svg>
  );
  // Snow
  if (code <= 77 || (code >= 85 && code <= 86)) return (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
      <rect x="10" y="10" width="44" height="22" rx="11" fill="#90CAF9"/>
      <rect x="18" y="6" width="30" height="18" rx="9" fill="#BBDEFB"/>
      {[[20,42],[32,44],[44,42],[26,52],[38,52]].map(([x,y])=>(
        <g key={`${x}${y}`}>
          <circle cx={x} cy={y} r="3" fill="white"/>
          <line x1={x} y1={y-4} x2={x} y2={y+4} stroke="#90CAF9" strokeWidth="1.5"/>
          <line x1={x-4} y1={y} x2={x+4} y2={y} stroke="#90CAF9" strokeWidth="1.5"/>
        </g>
      ))}
    </svg>
  );
  // Storm
  if (code >= 95) return (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
      <rect x="8" y="10" width="48" height="22" rx="11" fill="#546E7A"/>
      <rect x="16" y="4" width="34" height="20" rx="10" fill="#607D8B"/>
      <polygon points="36,34 28,48 33,48 27,62 42,44 36,44" fill="#FFD600"/>
      {[[18,38],[22,46]].map(([x,y])=>(
        <line key={`${x}${y}`} x1={x} y1={y} x2={x-2} y2={y+8} stroke="#90CAF9" strokeWidth="2" strokeLinecap="round"/>
      ))}
    </svg>
  );
  // Default rain
  return (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
      <rect x="10" y="14" width="44" height="22" rx="11" fill="#64B5F6"/>
      {[[20,42],[32,46],[44,42]].map(([x,y])=>(
        <line key={`${x}${y}`} x1={x} y1={y} x2={x-3} y2={y+8} stroke="#1565C0" strokeWidth="2.5" strokeLinecap="round"/>
      ))}
    </svg>
  );
}

function wmoEmoji(code: number, isDay = true): string {
  if (code === 0) return isDay ? '☀️' : '🌙';
  if (code <= 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 55) return '🌦️';
  if (code <= 65) return '🌧️';
  if (code <= 77) return '🌨️';
  if (code <= 82) return '🌧️';
  if (code <= 86) return '🌨️';
  return '⛈️';
}
function wmoDesc(code: number): string {
  if (code === 0) return 'Quang đãng';
  if (code <= 2) return 'Ít mây';
  if (code === 3) return 'Nhiều mây';
  if (code <= 48) return 'Sương mù';
  if (code <= 55) return 'Mưa phùn';
  if (code <= 65) return 'Mưa';
  if (code <= 77) return 'Tuyết';
  if (code <= 82) return 'Mưa rào';
  if (code <= 86) return 'Tuyết rào';
  return 'Giông bão';
}

interface PragueWeather {
  temp: number;
  feelsLike: number;
  code: number;
  isDay: boolean;
  forecast: { date: string; max: number; min: number; code: number; precip: number }[];
}

const WX_CITIES = [
  { key: 'praha',  label: 'Praha',   flag: <span className="flag flag-cz" style={{ display:'inline-block', verticalAlign:'middle', marginRight:6 }} />, lat: 50.0755,  lon: 14.4378,  tz: 'Europe%2FPrague' },
  { key: 'hanoi',  label: 'Hà Nội',  flag: <span className="flag flag-vn" style={{ display:'inline-block', verticalAlign:'middle', marginRight:6 }} />, lat: 21.0285,  lon: 105.8542, tz: 'Asia%2FBangkok' },
] as const;

// Pre-fetch ALL cities in parallel so switching is instant — no loading flash
function useAllCityWeather() {
  const [all, setAll] = useState<(PragueWeather | null)[]>(WX_CITIES.map(() => null));

  useEffect(() => {
    let cancelled = false;
    async function loadOne(i: number) {
      const c = WX_CITIES[i];
      try {
        const url =
          'https://api.open-meteo.com/v1/forecast' +
          `?latitude=${c.lat}&longitude=${c.lon}&timezone=${c.tz}` +
          '&current=temperature_2m,apparent_temperature,weather_code,is_day' +
          '&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max' +
          '&forecast_days=4';
        const res = await fetch(url);
        if (!res.ok || cancelled) return;
        const j = await res.json();
        if (cancelled) return;
        setAll(prev => {
          const next = [...prev];
          next[i] = {
            temp: Math.round(j.current.temperature_2m),
            feelsLike: Math.round(j.current.apparent_temperature),
            code: j.current.weather_code,
            isDay: j.current.is_day === 1,
            forecast: (j.daily.time as string[]).slice(1, 4).map((date: string, k: number) => ({
              date,
              max: Math.round(j.daily.temperature_2m_max[k + 1]),
              min: Math.round(j.daily.temperature_2m_min[k + 1]),
              code: j.daily.weather_code[k + 1],
              precip: j.daily.precipitation_probability_max[k + 1] ?? 0,
            })),
          };
          return next;
        });
      } catch { /* silent */ }
    }
    const reload = () => WX_CITIES.forEach((_, i) => loadOne(i));
    reload();
    const id = setInterval(reload, 15 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return all;
}

function CzechWeatherWidget() {
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState<'left' | 'right'>('left');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const all = useAllCityWeather();
  const city = WX_CITIES[idx];
  const w = all[idx];

  // Reset and restart the 5-second auto-advance
  const resetTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setDir('left');
      setIdx((i) => (i + 1) % WX_CITIES.length);
    }, 5000);
  };

  useEffect(() => {
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const prev = () => { setDir('right'); setIdx((i) => (i - 1 + WX_CITIES.length) % WX_CITIES.length); resetTimer(); };
  const next = () => { setDir('left');  setIdx((i) => (i + 1) % WX_CITIES.length); resetTimer(); };

  return (
    <div className="wx-card">
      {/* City + nav row */}
      <div className="wx-header">
        <button className="wx-nav-btn" onClick={prev} aria-label="Thành phố trước">‹</button>
        <span className="wx-city" key={`city-${idx}`} style={{ animation: `wx-slide-${dir} .35s ease` }}>
          {city.flag}{city.label}
        </span>
        <button className="wx-nav-btn" onClick={next} aria-label="Thành phố tiếp">›</button>
      </div>

      {/* Sliding content keyed to idx so animation re-triggers on change */}
      <div key={idx} className={`wx-slide wx-slide--${dir}`}>
        {!w ? (
          <div className="wx-loading" style={{ padding: '18px 0' }}>Đang tải…</div>
        ) : (
          <>
            <div className="wx-current">
              <div className="wx-current-main">
                <WxIcon code={w.code} isDay={w.isDay} size={56} />
                <div className="wx-temp">{w.temp}°C</div>
              </div>
              <div className="wx-current-details">
                <div className="wx-desc">{wmoDesc(w.code)}</div>
                <div className="wx-feels">Cảm giác {w.feelsLike}°C</div>
              </div>
            </div>
            <div className="wx-forecast">
              {w.forecast.map((d) => {
                const day = VI_DAYS[new Date(d.date + 'T12:00:00').getDay()];
                return (
                  <div className="wx-day" key={d.date}>
                    <span className="wx-day-name">{day}</span>
                    <span className="wx-day-emoji"><WxIcon code={d.code} size={28} /></span>
                    <span className="wx-day-temps"><b>{d.max}°</b><span>{d.min}°</span></span>
                    {d.precip > 20 && <span className="wx-precip">💧{d.precip}%</span>}
                  </div>
                );
              })}
            </div>
          </>
        )}
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
      <a className="widget-head widget-head--link" href="/su-kien"><CalendarDays size={15} /> Sự kiện của Hội</a>
      <div className="widget-body">
        {sorted.length === 0 ? (
          <p className="empty">Chưa có sự kiện nào.</p>
        ) : sorted.map((ev) => {
          const isPast = new Date(ev.startDate) < now;
          const href = ev.articleSlug ? `/bai-viet/${ev.articleSlug}` : `/su-kien`;
          return (
            <a href={href} className={`event event--link ${isPast ? 'event--past' : ''}`} key={ev.id}>
              {isPast && <span className="event-past-badge">Đã diễn ra</span>}
              <div className="event-title">{ev.title}</div>
              <div className="event-meta"><strong>{fmtEventDate(ev)}</strong>{ev.location && <span>{ev.location}</span>}</div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

// ─── EU countries band ────────────────────────────────────────────────────────

const EU_COUNTRY_ORDER = [
  { slug: 'cong-hoa-sec', name: 'Cộng hòa Czech', flagClass: 'flag-cz' },
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
    : ['Vietjet Air mở đường bay Praha – Hà Nội hai chuyến mỗi tuần từ tháng 10','Cộng hòa Czech là điểm đến du lịch tăng trưởng nhanh nhất châu Âu','Luật Bảo vệ dữ liệu cá nhân của Việt Nam chính thức có hiệu lực','Doanh nghiệp Việt tại Séc mở rộng chuỗi bán lẻ sang Đức và Ba Lan'];

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
                <div className="side-newsletter animate-in" style={{ animationDelay: '400ms' }}>
                  <CzechWeatherWidget />
                </div>
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
            {data.activities.length > 0 && (
              <section className="page-section" id="tin-hoat-dong">
                <SectionHeading title="Tin hoạt động" more="/danh-muc/tin-hoat-dong" />
                <div className="selected-grid">
                  {data.activities.slice(0, 4).map((article, index) => <StoryCard key={article.id} article={article} index={index} />)}
                </div>
              </section>
            )}
            <section className="page-section" id="chuyen-muc">
              <SectionHeading title="Văn hóa truyền thống" more="/danh-muc/van-hoa-truyen-thong" />
              <div className="selected-grid">
                {data.features.slice(0, 4).map((article, index) => <StoryCard key={article.id} article={article} index={index} />)}
              </div>
            </section>
          </div>
        </section>

        {/* ── Pháp luật + sidebar ── */}
        <div className="wrap">
          <section className="page-section" id="phap-luat">
            <div className="with-aside">
              <div>
                <SectionHeading title="Tin Pháp luật" more="/danh-muc/phap-luat" />
                <div className="stack">{data.business.slice(0, 4).map((a) => <StoryRow key={a.id} article={a} />)}</div>
              </div>
              <aside id="cong-dong">
                <CommunityWidget events={data.communityEvents} />
                <NewsletterWidget />
              </aside>
            </div>
          </section>
        </div>

      </main>
      <Footer />
    </>
  );
}

// ─── Home page ────────────────────────────────────────────────────────────────

const FALLBACK_TICKER = [
  'Vietjet Air mở đường bay Praha – Hà Nội hai chuyến mỗi tuần từ tháng 10',
  'Cộng hòa Czech là điểm đến du lịch tăng trưởng nhanh nhất châu Âu',
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
        <Route path="/dang-ky/thanh-vien" component={MemberRegistrationPage} />
        <Route path="/dang-ky/tai-tro" component={SponsorRegistrationPage} />
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
  const base = (import.meta.env.BASE_URL || '').replace(/\/$/, '');
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={base}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
