import { useQuery } from '@tanstack/react-query';
import { CalendarDays, MapPin } from 'lucide-react';
import { listEvents } from '@workspace/api-client-react';
import { PageShell, SectionHeading } from '@/components/page-shell';

function fmtDate(d: Date | string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(d));
}

function fmtDateRange(start: Date | string, end: Date | string | null): string {
  const s = fmtDate(start);
  if (!end) return s;
  const e = fmtDate(end);
  return s === e ? s : `${s} – ${e}`;
}

export default function EventsPage() {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events', 'all'],
    queryFn: () => listEvents({ includePast: true }),
    staleTime: 60_000,
  });

  const now = new Date();
  const upcoming = events
    .filter((ev) => new Date(ev.startDate) >= now)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  const past = events
    .filter((ev) => new Date(ev.startDate) < now)
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

  return (
    <PageShell>
      <div className="wrap page-section" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
        <nav style={{ fontSize: '0.8rem', color: 'var(--color-ink-light)', marginBottom: '1rem' }}>
          <a href="/">Trang chủ</a> › <span>Sự kiện</span>
        </nav>

        <SectionHeading title="Sự kiện của Hội" />

        {isLoading ? (
          <p style={{ color: 'var(--color-ink-light)', padding: '2rem 0' }}>Đang tải…</p>
        ) : events.length === 0 ? (
          <p style={{ color: 'var(--color-ink-light)', padding: '2rem 0' }}>Chưa có sự kiện nào.</p>
        ) : (
          <>
            {upcoming.length > 0 && (
              <section style={{ marginBottom: '2.5rem' }}>
                <h2 className="ev-section-title">Sắp diễn ra</h2>
                <div className="ev-grid">
                  {upcoming.map((ev) => (
                    <EventCard key={ev.id} ev={ev} />
                  ))}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section>
                <h2 className="ev-section-title ev-section-title--past">Đã diễn ra</h2>
                <div className="ev-grid ev-grid--past">
                  {past.map((ev) => (
                    <EventCard key={ev.id} ev={ev} past />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}

interface Ev {
  id: number;
  title: string;
  description: string | null;
  startDate: Date;
  endDate: Date | null;
  location: string | null;
  image: string | null;
  registrationUrl: string | null;
  eventType: string;
}

function EventCard({ ev, past = false }: { ev: Ev; past?: boolean }) {
  return (
    <div className={`ev-card ${past ? 'ev-card--past' : ''}`}>
      {ev.image && (
        <div className="ev-card-img">
          <img src={ev.image} alt={ev.title} loading="lazy" />
        </div>
      )}
      <div className="ev-card-body">
        {past && <span className="event-past-badge">Đã diễn ra</span>}
        <h3 className="ev-card-title">{ev.title}</h3>
        <div className="ev-card-meta">
          <span className="ev-card-meta-item">
            <CalendarDays size={13} aria-hidden="true" />
            {fmtDateRange(ev.startDate, ev.endDate)}
          </span>
          {ev.location && (
            <span className="ev-card-meta-item">
              <MapPin size={13} aria-hidden="true" />
              {ev.location}
            </span>
          )}
        </div>
        {ev.description && <p className="ev-card-desc">{ev.description}</p>}
        {ev.registrationUrl && !past && (
          <a
            href={ev.registrationUrl}
            className="ev-card-cta"
            target="_blank"
            rel="noopener noreferrer"
          >
            Đăng ký tham dự →
          </a>
        )}
      </div>
    </div>
  );
}
