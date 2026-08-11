import { useState } from 'react';
import { Sparkles, Copy, CheckCheck, ArrowRight } from 'lucide-react';
import { AdminPage, Btn, useAdmin } from './layout';

type Draft = { title: string; summary: string; content: string; suggestedSlug: string; status: string };

export default function AdminAI() {
  const { apiFetch } = useAdmin();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true); setError(''); setDraft(null);
    try {
      const result = await apiFetch<Draft>('/ai/suggest', {
        method: 'POST',
        body: JSON.stringify({ prompt }),
      });
      setDraft(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối AI');
    }
    setLoading(false);
  };

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const copyBtn = (text: string, key: string) => (
    <button
      onClick={() => copy(text, key)}
      title="Sao chép"
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-light)', padding: 2 }}
    >
      {copied === key ? <CheckCheck size={14} color="var(--color-crimson)" /> : <Copy size={14} />}
    </button>
  );

  const EXAMPLES = [
    'Cộng đồng người Việt tại Brno tổ chức lễ hội Tết 2026 quy mô lớn',
    'Séc thay đổi luật cư trú cho người nước ngoài từ tháng 9/2026',
    'Doanh nghiệp Việt tại Praha mở rộng chuỗi siêu thị sang Slovakia',
    'Giải golf người Việt khu vực Trung Âu lần thứ 5 tổ chức tại Brno',
  ];

  return (
    <AdminPage title="AI News Assistant">
      <div style={{ maxWidth: 800 }}>
        {/* Intro */}
        <div style={{
          background: 'linear-gradient(135deg, var(--color-navy), #1e3a5f)',
          borderRadius: 8, padding: '1.25rem 1.5rem', marginBottom: '1.5rem',
          color: '#fff', display: 'flex', gap: 16, alignItems: 'flex-start',
        }}>
          <Sparkles size={24} style={{ flexShrink: 0, marginTop: 2, color: '#fbbf24' }} />
          <div>
            <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: '1rem', fontWeight: 700, marginBottom: 4 }}>Trợ lý AI tạo bài viết</h2>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>
              Mô tả chủ đề hoặc sự kiện — AI sẽ soạn thảo bài tin tức tiếng Việt dưới dạng bản nháp.
              Sau khi tạo xong, bạn có thể sao chép nội dung và tạo bài viết mới tại mục <strong>Bài viết</strong>.
            </p>
          </div>
        </div>

        {/* Prompt input */}
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, color: 'var(--color-ink)' }}>
            Mô tả chủ đề hoặc thông tin sự kiện
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ví dụ: Cộng đồng người Việt tại Brno tổ chức lễ hội văn hóa mùa hè 2026 với sự tham dự của hơn 500 người..."
            rows={4}
            style={{
              width: '100%', padding: '0.65rem 0.75rem', border: '1px solid var(--color-rule)',
              borderRadius: 4, fontFamily: 'var(--font-sans)', fontSize: '0.9rem',
              background: '#fff', color: 'var(--color-ink)', boxSizing: 'border-box', resize: 'vertical',
            }}
          />
        </div>

        {/* Example prompts */}
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.78rem', color: 'var(--color-ink-light)', marginBottom: 6 }}>Thử ngay:</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setPrompt(ex)}
                style={{
                  padding: '0.3rem 0.65rem', borderRadius: 9999, border: '1px solid var(--color-rule)',
                  background: '#fff', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--color-ink-light)',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {ex.slice(0, 50)}…
              </button>
            ))}
          </div>
        </div>

        <Btn onClick={handleGenerate} disabled={loading || !prompt.trim()}>
          <Sparkles size={14} />
          {loading ? 'AI đang soạn thảo…' : 'Tạo bản nháp'}
        </Btn>

        {error && (
          <p style={{ color: 'var(--color-crimson)', fontSize: '0.85rem', marginTop: '0.75rem' }}>{error}</p>
        )}

        {/* Draft output */}
        {draft && (
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{
              background: '#fff', borderRadius: 8, padding: '1.25rem',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '2px solid #d1fae5',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
                <CheckCheck size={16} color="#10b981" />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#065f46' }}>Bản nháp đã sẵn sàng</span>
                <a href="/admin/articles" style={{
                  marginLeft: 'auto', fontSize: '0.82rem', color: 'var(--color-crimson)',
                  textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  Tạo bài viết <ArrowRight size={12} />
                </a>
              </div>

              {/* Title */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tiêu đề</span>
                  {copyBtn(draft.title, 'title')}
                </div>
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>{draft.title}</p>
              </div>

              {/* Slug */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Slug gợi ý</span>
                  {copyBtn(draft.suggestedSlug, 'slug')}
                </div>
                <code style={{ fontSize: '0.82rem', color: 'var(--color-ink-light)', background: 'var(--color-bone)', padding: '0.2rem 0.5rem', borderRadius: 3 }}>{draft.suggestedSlug}</code>
              </div>

              {/* Summary */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tóm tắt</span>
                  {copyBtn(draft.summary, 'summary')}
                </div>
                <p style={{ fontSize: '0.9rem', color: 'var(--color-ink)', fontStyle: 'italic', margin: 0 }}>{draft.summary}</p>
              </div>

              {/* Content HTML */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nội dung (HTML)</span>
                  {copyBtn(draft.content, 'content')}
                </div>
                <div style={{
                  background: 'var(--color-bone)', borderRadius: 4, padding: '0.75rem',
                  fontFamily: 'var(--font-mono)', fontSize: '0.78rem', lineHeight: 1.6,
                  maxHeight: 200, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                  color: 'var(--color-ink)',
                }}>
                  {draft.content}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminPage>
  );
}
