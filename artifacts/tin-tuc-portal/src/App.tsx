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
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();

type Story = {
  title: string;
  kicker?: string;
  source?: string;
  image?: string;
  author?: string;
};

const images = {
  hero: 'https://images.unsplash.com/photo-1541849546-216549ae216d?w=1200&q=80',
  selected: [
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&q=80',
    'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=600&q=80',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=80',
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&q=80',
  ],
  vietnam: [
    'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=300&q=80',
    'https://images.unsplash.com/photo-1509023464722-18d996393ca8?w=300&q=80',
    'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=300&q=80',
  ],
  world: [
    'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=300&q=80',
    'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=300&q=80',
    'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=300&q=80',
  ],
  features: [
    'https://images.unsplash.com/photo-1526779259212-939e64788e3c?w=900&q=80',
    'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=600&q=80',
    'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=600&q=80',
    'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=600&q=80',
  ],
  business: [
    'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=300&q=80',
    'https://images.unsplash.com/photo-1543286386-713bdd548da4?w=300&q=80',
    'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=300&q=80',
    'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=300&q=80',
  ],
};

const searchStories: Story[] = [
  { title: 'Ngày Việt Nam 2026 tại Trnava thu hút hơn 10.000 lượt khách khắp châu Âu', kicker: 'Cộng đồng · Séc' },
  { title: 'Từ 10/10 Vietjet Air bay từ Praha về Hà Nội hai chuyến mỗi tuần', kicker: 'Kinh tế' },
  { title: 'Cửa hàng biên giới Séc – Đức thay đổi mặt hàng kinh doanh', kicker: 'Kinh tế' },
  { title: 'Meta cũng gặp sự cố: tác nhân AI hành xử như tin tặc', kicker: 'Khoa học · Công nghệ' },
  { title: 'Người kế nhiệm Buffett rót gần nửa nghìn tỷ korun vào cổ phiếu', kicker: 'Kinh tế' },
  { title: 'Mỹ áp thuế 15% lên vật liệu chip chủ chốt để đối phó Trung Quốc', kicker: 'Công nghệ' },
  { title: 'Loạt trường y dược công bố điểm chuẩn đại học năm 2026', kicker: 'Việt Nam' },
  { title: 'Đầu tư vào ngành nước: từ hạ tầng đến công nghệ trước biến đổi khí hậu', kicker: 'Chuyện đầu tư' },
  { title: 'BRNO OPEN 2026 trở lại với hai ngày thi đấu sôi động', kicker: 'Golf' },
];

const tickerItems = [
  'Vietjet Air mở đường bay Praha – Hà Nội hai chuyến mỗi tuần từ tháng 10',
  'Cộng hòa Séc là điểm đến du lịch tăng trưởng nhanh nhất châu Âu',
  'Luật Bảo vệ dữ liệu cá nhân của Việt Nam chính thức có hiệu lực',
  'Doanh nghiệp Việt tại Séc mở rộng chuỗi bán lẻ sang Đức và Ba Lan',
];

const selectedStories: Story[] = [
  { title: 'Meta cũng gặp sự cố: tác nhân AI hành xử như tin tặc', kicker: 'Khoa học · Công nghệ', source: 'Novinky' },
  { title: 'Người kế nhiệm Buffett rót gần nửa nghìn tỷ korun vào cổ phiếu', kicker: 'Kinh tế', source: 'Novinky' },
  { title: 'Mỹ áp thuế 15% lên vật liệu chip chủ chốt để đối phó Trung Quốc', kicker: 'Công nghệ', source: 'BBC' },
  { title: 'Giá vàng đã giảm khoảng một phần tư so với đỉnh hồi tháng 1', kicker: 'Kinh tế', source: 'České noviny' },
];

const rankedStories: Story[] = [
  { title: 'Từ 10/10 Vietjet Air bay từ Praha về Hà Nội hai chuyến mỗi tuần', kicker: 'Kinh tế · E15.cz' },
  { title: 'Cửa hàng biên giới Séc – Đức thay đổi mặt hàng kinh doanh', kicker: 'Kinh tế · E15.cz' },
  { title: 'Thanh toán tiền mặt trên 270.000 korun có thể bị phạt tới 5 triệu', kicker: 'Kinh tế · E15.cz' },
  { title: 'Séc là điểm đến du lịch tăng trưởng nhanh nhất châu Âu', kicker: 'Du lịch · Novinky' },
  { title: 'Hãng taxi điện Việt Nam chính thức tiến vào thị trường châu Âu', kicker: 'Kinh tế · VnExpress' },
];

const euCountries = [
  { name: 'Cộng hòa Séc', flag: 'flag-cz', stories: [['Thị trưởng và ứng viên độc lập vượt lên trong khảo sát bầu cử mới nhất', 'Novinky'], ['Tai nạn tại Praha khi thử áp lực đường ống: 1 người thiệt mạng', 'Echo24'], ['Dự báo thời tiết Séc trong ngày diễn ra nhật thực', 'Novinky']] },
  { name: 'Slovakia', flag: 'flag-sk', stories: [['Bộ Nội vụ thừa nhận chưa rõ nguồn gốc hệ thống camera giao thông', 'SME.sk'], ['Sau nhật thực sẽ có mưa sao băng Perseid rực rỡ', 'Denník N'], ['Đòn tấn công bằng drone quy mô lớn nhắm vào các thành phố Nga', 'Aktuality']] },
  { name: 'Ba Lan', flag: 'flag-pl', stories: [['Thăm dò mới: cục diện cánh hữu thay đổi đáng kể', 'Onet'], ['Thị trường dầu mỏ phản ứng khi kỳ vọng hạ nhiệt', 'Money.pl'], ['Câu chuyện gây tranh cãi tại Gliwice thu hút dư luận', 'Fakt']] },
  { name: 'Đức', flag: 'flag-de', stories: [['Máy bay không người lái ở Leipzig: đã có thử nghiệm từ hai năm trước?', 'SZ.de'], ['Bắc Đức là nơi quan sát nhật thực 2026 sớm nhất', 'Tagesspiegel'], ['Động đất khiến hơn 100 người thiệt mạng: khẩn cấp ở Colombia', 'tagesschau.de']] },
];

const vietnamStories: Story[] = [
  { title: 'Loạt trường y dược công bố điểm chuẩn đại học năm 2026', source: 'Báo Sức Khỏe & Đời Sống' },
  { title: 'Miền Bắc bước vào đợt nắng nóng gay gắt, có nơi 39 độ C', source: 'VnExpress' },
  { title: 'Đà Nẵng sắp xếp, tinh giản hơn 500 cơ sở giáo dục công lập', source: 'Báo Tuổi Trẻ' },
];
const worldStories: Story[] = [
  { title: 'Động đất rung chuyển Colombia, ít nhất 30 người thiệt mạng', source: 'VnExpress' },
  { title: 'Đằng sau việc Mỹ chuyển hướng sang ngoại giao với Iran', source: 'Báo Tin tức' },
  { title: 'Kế hoạch hoà bình 15 điểm cho Dải Gaza vấp phải phản đối', source: 'Báo Dân trí' },
];
const businessStories: Story[] = [
  { title: 'Huyền thoại của Google rời đi, vốn hoá công ty bốc hơi hàng nghìn tỷ', source: 'Novinky' },
  { title: 'Giá dầu ô liu sẽ tăng khi mùa màng chịu nắng nóng và cháy rừng', source: 'Novinky' },
  { title: 'Strnad mua 14% cổ phần hãng lốp Pirelli của Ý — dấu mốc đáng chú ý', source: 'Aktuálně' },
  { title: 'Yên Nhật lao xuống đáy, Mỹ và Nhật Bản can thiệp hiếm hoi', source: 'Novinky' },
];

function SectionHeading({ title, more, id }: { title: string; more?: string; id?: string }) {
  return (
    <div className="section-heading" id={id}>
      <h2><span className="section-mark">▍</span>{title}</h2>
      <div className="section-rule" />
      {more && <a className="more-link" href="#tin-tuc" data-testid={`link-more-${title}`}>{more} <ArrowRight size={13} /></a>}
    </div>
  );
}

function Image({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return <img src={src} alt={alt} loading="lazy" className={className} />;
}

function StoryCard({ story, image, index }: { story: Story; image: string; index: number }) {
  return (
    <article className="card animate-in" style={{ animationDelay: `${index * 55}ms` }} data-testid={`card-selected-${index}`}>
      <a className="card-thumb" href="#tin-tuc" aria-label={story.title}><Image src={image} alt="" /></a>
      <span className="kicker">{story.kicker}</span>
      <h3><a href="#tin-tuc">{story.title}</a></h3>
      <div className="source">Nguồn: <strong>{story.source}</strong></div>
    </article>
  );
}

function StoryStack({ stories, imageList }: { stories: Story[]; imageList: string[] }) {
  return (
    <div className="stack">
      {stories.map((story, index) => (
        <div className="stack-row" key={story.title} data-testid={`row-story-${index}`}>
          <a className="stack-thumb" href="#tin-tuc" aria-label={story.title}><Image src={imageList[index]} alt="" /></a>
          <div><h3 className="story-title"><a href="#tin-tuc">{story.title}</a></h3><div className="source">{story.source}</div></div>
        </div>
      ))}
    </div>
  );
}

function UtilityBar() {
  const today = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
  return (
    <div className="utility">
      <div className="wrap">
        <div className="u-left"><span className="u-date" data-testid="text-current-date">{today}</span><span className="u-sep">•</span><span>Praha 21°C <CloudSun size={13} aria-label="Có mây" /></span><span className="u-sep">•</span><span>Hà Nội 34°C <CloudSun size={13} aria-label="Nắng nhẹ" /></span></div>
        <div className="u-right"><a href="#kinh-doanh">Bảng tỷ giá</a><span className="u-sep">|</span><span className="lang"><b>VI</b> / <a href="#tin-tuc">CZ</a> / <a href="#tin-tuc">EN</a></span></div>
      </div>
    </div>
  );
}

function Masthead() {
  return <header className="masthead"><div className="wrap"><a className="logo" href="/" aria-label="Trang chủ VietPress EU" data-testid="link-logo"><span className="logo-mark">V</span><span><span className="logo-name">VietPress<em>EU</em></span><span className="logo-tag">Cộng đồng người Việt tại châu Âu</span></span></a><div className="masthead-ad">KHU VỰC ĐẶT LOGO / QUẢNG CÁO ĐỐI TÁC</div></div></header>;
}

function Navigation({ open, onToggle, onSearch }: { open: boolean; onToggle: () => void; onSearch: (value: string) => void }) {
  const links = [['Trang chủ', '/'], ['Tin tức', '#tin-tuc'], ['Kinh doanh', '#kinh-doanh'], ['Chuyên mục', '#chuyen-muc'], ['Golf', '#golf'], ['Cộng đồng', '#cong-dong']];
  return (
    <nav className="primary-nav" aria-label="Điều hướng chính">
      <div className="wrap">
        <div className={`nav-links ${open ? 'open' : ''}`}>
          {links.map(([label, href], index) => <a key={label} className={`nav-link ${index === 0 ? 'active' : ''}`} href={href} onClick={onToggle} data-testid={`link-nav-${label}`}>{label}</a>)}
        </div>
        <div className="nav-spacer" />
        <label className="nav-search"><Search size={15} aria-hidden="true" /><input type="search" onChange={(event) => onSearch(event.target.value)} placeholder="Tìm kiếm tin bài…" aria-label="Tìm kiếm tin bài" data-testid="input-search" /></label>
        <button className="menu-button" type="button" onClick={onToggle} aria-label={open ? 'Đóng menu' : 'Mở menu'} aria-expanded={open} data-testid="button-mobile-menu">{open ? <X size={23} /> : <Menu size={23} />}</button>
      </div>
    </nav>
  );
}

function Ticker() {
  return <div className="ticker" aria-label="Tin nóng"><div className="wrap"><span className="ticker-label"><span className="ticker-dot" />Tin nóng</span><div className="ticker-track"><div className="ticker-move">{[...tickerItems, ...tickerItems].map((item, index) => <a href="#tin-tuc" key={`${item}-${index}`}>{item}</a>)}</div></div><Pause size={13} aria-label="Di chuột để tạm dừng" /></div></div>;
}

function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('Tất cả');
  const [email, setEmail] = useState('');
  const [newsletterMessage, setNewsletterMessage] = useState('');
  const searchResults = useMemo(() => query.trim() ? searchStories.filter((story) => `${story.title} ${story.kicker}`.toLowerCase().includes(query.toLowerCase())).slice(0, 6) : [], [query]);
  const topics = ['Tất cả', 'Chiến tranh Nga – Ukraina', 'Trí tuệ nhân tạo', 'Donald Trump', 'Golf', 'Luật pháp & hội nhập', 'Khoa học – Giáo dục', 'Kinh tế Séc', 'Cộng đồng người Việt'];
  const submitNewsletter = () => {
    if (!email.includes('@')) { setNewsletterMessage('Vui lòng nhập một địa chỉ email hợp lệ.'); return; }
    setNewsletterMessage('Đã đăng ký thành công. Hẹn gặp bạn vào sáng thứ Hai!');
    setEmail('');
  };
  return (
    <div className="page-shell">
      <UtilityBar /><Masthead /><Navigation open={menuOpen} onToggle={() => setMenuOpen((value) => !value)} onSearch={setQuery} /><Ticker />
      <main>
        {query && <div className="wrap"><div className="search-panel" role="region" aria-live="polite"><h2>Kết quả tìm kiếm cho “{query}”</h2>{searchResults.length ? <div className="search-results">{searchResults.map((story, index) => <a href="#tin-tuc" className="search-result" key={story.title} data-testid={`search-result-${index}`}>{story.title}<span className="kicker">{story.kicker}</span></a>)}</div> : <p className="source">Không tìm thấy bài viết phù hợp. Hãy thử từ khoá khác.</p>}</div></div>}
        <section className="hero"><div className="wrap page-section"><div className="hero-grid"><div className="lead animate-in"><a className="lead-thumb" href="#tin-tuc" aria-label="Ngày Việt Nam 2026 tại Trnava"><Image src={images.hero} alt="Không khí lễ hội cộng đồng tại Trnava" /></a><span className="kicker">Cộng đồng · Séc</span><h1><a href="#tin-tuc">Ngày Việt Nam 2026 tại Trnava thu hút hơn 10.000 lượt khách khắp châu Âu</a></h1><p className="dek">Hơn 100 nghệ sĩ và diễn viên không chuyên đã tham gia chương trình biểu diễn nghệ thuật, lan tỏa hình ảnh văn hoá Việt tới cộng đồng bản địa và bạn bè quốc tế.</p><div className="source">Nguồn: <strong>VietPress EU</strong> · Chia sẻ: NTC</div></div><div className="side-list" aria-label="Tin đọc nhiều">{rankedStories.map((story, index) => <div className="side-item animate-in" style={{ animationDelay: `${(index + 1) * 65}ms` }} key={story.title}><span className="rank">{index + 1}</span><div><h3 className="story-title"><a href="#tin-tuc">{story.title}</a></h3><div className="source">{story.kicker}</div></div></div>)}</div></div></div></section>
        <div className="wrap"><section className="page-section" id="tin-tuc"><SectionHeading title="Tin chọn lọc" more="Xem tất cả" /><div className="selected-grid">{selectedStories.map((story, index) => <StoryCard key={story.title} story={story} image={images.selected[index]} index={index} />)}</div></section></div>
        <section className="eu-band"><div className="wrap"><section className="page-section"><SectionHeading title="Tin các nước EU" /><div className="eu-grid">{euCountries.map((country) => <div className="eu-col" key={country.name}><div className="country-label"><span className={`flag ${country.flag}`} /><b>{country.name}</b></div><ul>{country.stories.map(([title, source]) => <li key={title}><a href="#tin-tuc">{title}</a><span>{source}</span></li>)}</ul></div>)}</div></section></div></section>
        <div className="wrap"><section className="page-section"><div className="two-col"><div><SectionHeading title="Tin Việt Nam" /><StoryStack stories={vietnamStories} imageList={images.vietnam} /></div><div><SectionHeading title="Tin thế giới" /><StoryStack stories={worldStories} imageList={images.world} /></div></div></section></div>
        <section className="features"><div className="wrap"><section className="page-section" id="chuyen-muc"><SectionHeading title="Chuyên mục" more="Tất cả bài viết" /><div className="feature-lead"><a className="feature-image" href="#chuyen-muc" aria-label="Kỷ nguyên điện lực"><Image src={images.features[0]} alt="Đường dây điện trong ánh nắng chiều" /></a><div className="feature-body"><span className="kicker">Chuyện đầu tư</span><h2>Kỷ nguyên điện lực: khi cả thế giới cần nhiều điện hơn, ai hưởng lợi lớn nhất?</h2><p>Cùng với điện toán đám mây, AI và xe điện, nhu cầu điện toàn cầu đang tăng nhanh. IEA gọi giai đoạn hiện nay là “Age of Electricity” — và đây có thể là một trong những chủ đề đầu tư dài hạn quan trọng nhất của thập niên.</p><div className="author">Tác giả: <strong>Mạnh Hải</strong></div></div></div><div className="feature-cards">{[['Golf', 'EVGA Tour Final 2026: chung kết mùa giải giữa ba thử thách tại Cyprus', 'Nguyễn Thanh Cương'], ['Chuyện đầu tư', 'Đầu tư vào ngành nước: từ hạ tầng đến công nghệ trước biến đổi khí hậu', 'Mạnh Hải'], ['Du lịch châu Âu', 'Mua tem xa lộ điện tử: cẩn thận mất tiền oan khi đặt trên mạng', 'Nguyễn Minh']].map(([kicker, title, author], index) => <article className="card" key={title}><a className="card-thumb" href="#chuyen-muc" aria-label={title}><Image src={images.features[index + 1]} alt="" /></a><span className="kicker">{kicker}</span><h3><a href="#chuyen-muc">{title}</a></h3><div className="author">Tác giả: <strong>{author}</strong></div></article>)}</div></section></div></section>
        <div className="wrap"><section className="page-section" id="kinh-doanh"><div className="with-aside"><div><SectionHeading title="Tin kinh doanh" more="Xem thêm" /><StoryStack stories={businessStories} imageList={images.business} /></div><aside id="cong-dong"><div className="widget" id="golf"><div className="widget-head red"><Globe2 size={15} /> Lịch giải Golf</div><div className="widget-body"><div className="event"><div className="event-title">BRNO OPEN 2026</div><div className="event-meta"><strong>16/8 – 17/8/2026</strong><span>Kaskáda Golf Resort, Brno</span></div></div><div className="event"><div className="event-title">EVGA TOUR FINAL 2026</div><div className="event-meta"><strong>05/12 – 10/12/2026</strong><span>Cyprus</span></div></div></div></div><div className="widget"><div className="widget-head"><CalendarDays size={15} /> Sự kiện cộng đồng</div><div className="widget-body"><p className="empty">Chưa có sự kiện sắp diễn ra.</p><p style={{ marginTop: 10 }}><a href="#cong-dong" className="more-link">Xem các sự kiện đã qua <ArrowRight size={13} /></a></p></div></div><div className="newsletter"><h3>Bản tin hằng tuần</h3><p>Nhận điểm tin cộng đồng và kinh tế Séc – Việt mỗi sáng thứ Hai.</p><div className="newsletter-field"><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email của bạn" aria-label="Email đăng ký bản tin" data-testid="input-newsletter-email" /><button type="button" onClick={submitNewsletter} data-testid="button-newsletter-submit">Đăng ký</button></div>{newsletterMessage && <div className="newsletter-feedback" role="status" data-testid="status-newsletter"><Check size={13} /> {newsletterMessage}</div>}</div></aside></div></section></div>
        <section className="topics"><div className="wrap"><section className="page-section"><SectionHeading title="Theo dòng sự kiện" /><div className="chips">{topics.map((item) => <button type="button" key={item} className={`chip ${item === 'Tất cả' ? 'hot' : ''} ${topic === item ? 'active' : ''}`} onClick={() => setTopic(item)} aria-pressed={topic === item} data-testid={`button-topic-${item}`}>{item}</button>)}</div><p className="source" aria-live="polite">Đang xem: <strong>{topic}</strong></p></section></div></section>
      </main>
      <Footer />
    </div>
  );
}

function Footer() {
  return <footer><div className="wrap"><div className="footer-grid"><div className="footer-brand"><span className="logo-name">VietPress<em>EU</em></span><p>Cổng thông tin kết nối cộng đồng người Việt, doanh nghiệp và công nghệ tại Cộng hòa Séc và châu Âu.</p><div className="socials"><a className="social-link" href="#tin-tuc" aria-label="Facebook"><Facebook size={16} /></a><a className="social-link" href="#tin-tuc" aria-label="YouTube"><Youtube size={16} /></a><a className="social-link" href="mailto:toasoan@vietpress.eu" aria-label="Email"><Mail size={16} /></a></div></div><FooterColumn title="Chuyên mục" links={['Tin tức', 'Kinh doanh', 'Chuyện đầu tư', 'Golf', 'Cộng đồng']} /><FooterColumn title="Khu vực" links={['Cộng hòa Séc', 'Slovakia', 'Ba Lan', 'Đức', 'Việt Nam']} /><FooterColumn title="Liên hệ" links={['Email: toasoan@vietpress.eu', 'Gửi tin bài', 'Quảng cáo', 'Về chúng tôi']} /></div><div className="footer-bottom"><span>© 2025–2026 VietPress EU. Bảo lưu mọi quyền.</span><span className="footer-links"><a href="#tin-tuc">Điều khoản sử dụng</a><a href="#tin-tuc">Chính sách bảo mật</a><a href="#tin-tuc">Cookie</a></span></div></div></footer>;
}

function FooterColumn({ title, links }: { title: string; links: string[] }) {
  return <div className="footer-col"><h3>{title}</h3><ul>{links.map((link) => <li key={link}><a href="#tin-tuc">{link}</a></li>)}</ul></div>;
}

function Router() {
  return <RoutedErrorBoundary><Switch><Route path="/" component={Home} /><Route component={NotFound} /></Switch></RoutedErrorBoundary>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;