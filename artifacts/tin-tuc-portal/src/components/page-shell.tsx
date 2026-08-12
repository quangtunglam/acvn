import { type ReactNode, useState } from 'react';
import {
  ArrowRight,
  CloudSun,
  Facebook,
  Mail,
  Menu,
  Pause,
  Search,
  X,
  Youtube,
} from 'lucide-react';
import { useLocation } from 'wouter';

// ─── Utility bar ──────────────────────────────────────────────────────────────

export function UtilityBar() {
  const today = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date());
  return (
    <div className="utility">
      <div className="wrap">
        <div className="u-left">
          <span className="u-date" data-testid="text-current-date">{today}</span>
        </div>
        <div className="u-right">
          <a href="/api/ty-gia">Bảng tỷ giá</a>
          <span className="u-sep">|</span>
          <span className="lang"><b>VI</b> / <a href="/">CZ</a> / <a href="/">EN</a></span>
        </div>
      </div>
    </div>
  );
}

// ─── Masthead ─────────────────────────────────────────────────────────────────

export function Masthead() {
  return (
    <header className="masthead">
      <div className="wrap">
        <a className="logo" href="/" aria-label="Trang chủ Hội người Séc gốc Việt Nam" data-testid="link-logo">
          <img src="/logo-hoi.png" alt="Logo" className="logo-img" />
          <span>
            <span className="logo-name logo-name--hoi">Hội người Séc<em style={{ fontStyle: 'normal' }}> gốc Việt Nam</em></span>
            <span className="logo-tag logo-tag--hoi">Asociace českých občanů vietnamského původu</span>
          </span>
        </a>
        <div className="masthead-ad">KHU VỰC ĐẶT LOGO / QUẢNG CÁO ĐỐI TÁC</div>
      </div>
    </header>
  );
}

// ─── Navigation ───────────────────────────────────────────────────────────────

type NavItem = { label: string; href: string; children?: { label: string; href: string }[] };

const NAV_LINKS: NavItem[] = [
  { label: 'Trang chủ', href: '/' },
  {
    label: 'Tin tức', href: '/danh-muc/tin-tuc',
    children: [
      { label: 'Tin Việt Nam', href: '/danh-muc/tin-viet-nam' },
      { label: 'Tin thế giới', href: '/danh-muc/tin-the-gioi' },
    ],
  },
  { label: 'Kinh doanh', href: '/danh-muc/kinh-doanh' },
  { label: 'Chuyên mục', href: '/danh-muc/chuyen-dau-tu' },
  { label: 'Golf', href: '/danh-muc/golf' },
  { label: 'Cộng đồng', href: '/danh-muc/cong-dong' },
];

export function Navigation({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  const [query, setQuery] = useState('');
  const [, setLocation] = useLocation();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim()) {
      setLocation(`/tim-kiem?q=${encodeURIComponent(query.trim())}`);
      setQuery('');
    }
  };

  return (
    <nav className="primary-nav" aria-label="Điều hướng chính">
      <div className="wrap">
        <div className="nav-weather" aria-label="Thời tiết">
          <CloudSun size={13} aria-hidden="true" />
          <span>Praha 21°C</span>
          <span className="nav-weather-sep">·</span>
          <span>Hà Nội 34°C</span>
        </div>
        <div className={`nav-links ${open ? 'open' : ''}`}>
          {NAV_LINKS.map((item, index) =>
            item.children ? (
              <div key={item.label} className="nav-item nav-item--has-dropdown">
                <a
                  className={`nav-link ${index === 0 ? 'active' : ''}`}
                  href={item.href}
                  onClick={onToggle}
                  data-testid={`link-nav-${item.label}`}
                >
                  {item.label}
                  <span className="nav-caret" aria-hidden="true">▾</span>
                </a>
                <div className="nav-dropdown">
                  {item.children.map((child) => (
                    <a
                      key={child.label}
                      className="nav-dropdown-link"
                      href={child.href}
                      onClick={onToggle}
                    >
                      {child.label}
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <a
                key={item.label}
                className={`nav-link ${index === 0 ? 'active' : ''}`}
                href={item.href}
                onClick={onToggle}
                data-testid={`link-nav-${item.label}`}
              >
                {item.label}
              </a>
            )
          )}
        </div>
        <div className="nav-spacer" />
        <label className="nav-search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tìm kiếm tin bài… (Enter)"
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

// ─── Ticker ───────────────────────────────────────────────────────────────────

export function Ticker({ items }: { items: string[] }) {
  const loop = [...items, ...items];
  return (
    <div className="ticker" aria-label="Tin nóng">
      <div className="wrap">
        <span className="ticker-label"><span className="ticker-dot" />Tin nóng</span>
        <div className="ticker-track">
          <div className="ticker-move">
            {loop.map((item, index) => (
              <a href="/tim-kiem" key={`${item}-${index}`}>{item}</a>
            ))}
          </div>
        </div>
        <Pause size={13} aria-label="Di chuột để tạm dừng" />
      </div>
    </div>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function FooterColumn({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className="footer-col">
      <h3>{title}</h3>
      <ul>
        {links.map(([label, href]) => (
          <li key={label}><a href={href}>{label}</a></li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div className="footer-grid">
          <div className="footer-brand">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <img src="/logo-hoi.png" alt="Logo" style={{ height: 48, width: 'auto', objectFit: 'contain' }} />
              <span className="logo-name" style={{ fontSize: '0.95rem', lineHeight: 1.3 }}>Hội người Séc<em style={{ fontStyle: 'normal' }}> gốc Việt Nam</em></span>
            </div>
            <p>Cổng thông tin kết nối cộng đồng người Việt tại Cộng hòa Séc và châu Âu.</p>
            <div className="socials">
              <a className="social-link" href="/" aria-label="Facebook"><Facebook size={16} /></a>
              <a className="social-link" href="/" aria-label="YouTube"><Youtube size={16} /></a>
              <a className="social-link" href="mailto:toasoan@vietpress.eu" aria-label="Email"><Mail size={16} /></a>
            </div>
          </div>
          <FooterColumn title="Chuyên mục" links={[
            ['Tin tức', '/danh-muc/tin-tuc'],
            ['Kinh doanh', '/danh-muc/kinh-doanh'],
            ['Chuyện đầu tư', '/danh-muc/chuyen-dau-tu'],
            ['Golf', '/danh-muc/golf'],
            ['Cộng đồng', '/danh-muc/cong-dong'],
          ]} />
          <FooterColumn title="Khu vực" links={[
            ['Cộng hòa Séc', '/khu-vuc/sec'],
            ['Slovakia', '/khu-vuc/slovakia'],
            ['Ba Lan', '/khu-vuc/ba-lan'],
            ['Đức', '/khu-vuc/duc'],
            ['Việt Nam', '/khu-vuc/viet-nam'],
          ]} />
          <FooterColumn title="Liên hệ" links={[
            ['Email: toasoan@vietpress.eu', 'mailto:toasoan@vietpress.eu'],
            ['Gửi tin bài', '/'],
            ['Quảng cáo', '/'],
            ['Về chúng tôi', '/'],
          ]} />
        </div>
        <div className="footer-bottom">
          <span>© 2025–2026 Hội người Séc gốc Việt Nam. Bảo lưu mọi quyền.</span>
          <span className="footer-links">
            <a href="/">Điều khoản sử dụng</a>
            <a href="/">Chính sách bảo mật</a>
            <a href="/">Cookie</a>
          </span>
        </div>
      </div>
    </footer>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────

export function SectionHeading({ title, more, id }: { title: string; more?: string; id?: string }) {
  return (
    <div className="section-heading" id={id}>
      <h2><span className="section-mark">▍</span>{title}</h2>
      <div className="section-rule" />
      {more && (
        <a className="more-link" href={more} data-testid={`link-more-${title}`}>
          Xem tất cả <ArrowRight size={13} />
        </a>
      )}
    </div>
  );
}

// ─── PageShell ────────────────────────────────────────────────────────────────

export function PageShell({ children, ticker }: { children: ReactNode; ticker?: string[] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="page-shell">
      <UtilityBar />
      <Masthead />
      <Navigation open={menuOpen} onToggle={() => setMenuOpen((v) => !v)} />
      {ticker && ticker.length > 0 && <Ticker items={ticker} />}
      <main>{children}</main>
      <Footer />
    </div>
  );
}
