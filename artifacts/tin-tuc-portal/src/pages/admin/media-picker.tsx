/**
 * MediaPicker — modal grid of uploaded images.
 * Usage:
 *   <MediaPickerBtn onSelect={(url) => setField(url)} />
 * Renders a small button; clicking it opens the picker modal.
 */
import { useCallback, useEffect, useState } from 'react';
import { Image, X } from 'lucide-react';
import { useAdmin } from './layout';

type MediaFile = { key: string; url: string; size: number; updatedAt: string };

function fmtSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface MediaPickerProps {
  onSelect: (url: string) => void;
  label?: string;
}

export function MediaPickerBtn({ onSelect, label = 'Chọn từ Media' }: MediaPickerProps) {
  const { apiFetch } = useAdmin();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<MediaFile[]>('/media');
      setFiles(data);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const pick = (url: string) => {
    onSelect(url);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '0.3rem 0.7rem', borderRadius: 4,
          border: '1px solid #94a3b8', background: '#f8fafc',
          cursor: 'pointer', fontSize: '0.8rem', color: '#374151',
          fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
        }}
      >
        <Image size={13} /> {label}
      </button>

      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 200, display: 'flex', alignItems: 'flex-start',
            justifyContent: 'center', padding: '2rem 1rem', overflowY: 'auto',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div style={{ background: '#fff', borderRadius: 10, width: '100%', maxWidth: 780, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.25rem', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '1rem', fontWeight: 700 }}>
                Chọn ảnh từ Media
              </h2>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '1rem 1.25rem', minHeight: 200 }}>
              {loading ? (
                <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Đang tải…</p>
              ) : files.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>
                  Chưa có ảnh nào. Vào trang <strong>Media</strong> để upload ảnh trước.
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                  {files.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => pick(f.url)}
                      style={{
                        border: '2px solid transparent', borderRadius: 6, overflow: 'hidden',
                        cursor: 'pointer', background: '#f3f4f6', padding: 0,
                        transition: 'border-color 0.15s, transform 0.1s',
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-navy)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; }}
                    >
                      <div style={{ height: 110, overflow: 'hidden' }}>
                        <img
                          src={f.url}
                          alt=""
                          loading="lazy"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                        />
                      </div>
                      <div style={{ padding: '0.3rem 0.4rem', fontSize: '0.68rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {fmtSize(f.size)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid #e5e7eb', textAlign: 'right' }}>
              <button onClick={() => setOpen(false)} style={{ padding: '0.45rem 1rem', borderRadius: 4, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'var(--font-sans)' }}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
