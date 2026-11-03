import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, Image, Trash2, Upload, Wrench } from 'lucide-react';
import { AdminPage, Btn, useAdmin } from './layout';

type MediaFile = {
  key: string;
  url: string;
  size: number;
  updatedAt: string;
  contentType: string;
};

type MediaListResponse = {
  items: MediaFile[];
  totalBytes: number;
  pendingUploads: number;
};

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminMedia() {
  const { apiFetch, token } = useAdmin();
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [totalBytes, setTotalBytes] = useState(0);
  const [pendingUploads, setPendingUploads] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<MediaListResponse | MediaFile[]>('/media');
      if (Array.isArray(data)) {
        setFiles(data);
        setTotalBytes(data.reduce((sum, f) => sum + (f.size || 0), 0));
        setPendingUploads(0);
      } else {
        setFiles(data.items ?? []);
        setTotalBytes(data.totalBytes ?? 0);
        setPendingUploads(data.pendingUploads ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { load(); }, [load]);

  const MAX_SIZE = 10 * 1024 * 1024;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Chỉ hỗ trợ ảnh (jpg, png, gif, webp…). Vui lòng chọn file ảnh.');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    if (file.size > MAX_SIZE) {
      alert(`Ảnh quá lớn (${(file.size / 1024 / 1024).toFixed(1)} MB). Dung lượng tối đa là 10 MB.`);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      await new Promise<{ servingURL: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch {
              reject(new Error('Phản hồi không hợp lệ từ máy chủ.'));
            }
          } else {
            let msg = `Upload thất bại (mã lỗi: ${xhr.status}).`;
            try {
              const errJson = JSON.parse(xhr.responseText);
              if (errJson.error) msg = errJson.error;
            } catch { /* ignore */ }
            reject(new Error(msg));
          }
        };
        xhr.onerror = () => reject(new Error('Mất kết nối khi đang upload. Kiểm tra mạng và thử lại.'));
        xhr.ontimeout = () => reject(new Error('Upload quá thời gian. Vui lòng thử lại.'));
        xhr.timeout = 120000;
        xhr.open('POST', '/api/admin/media/upload');
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.setRequestHeader('X-Admin-Token', token);
        xhr.send(file);
      });

      await load();
    } catch (err) {
      alert(`Upload thất bại: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm('Xóa ảnh này? Không thể khôi phục.')) return;
    const uuid = key.replace(/^uploads\//, '');
    await apiFetch(`/media/uploads/${uuid}`, { method: 'DELETE' });
    setFiles((prev) => prev.filter((f) => f.key !== key));
  };

  const handleCleanup = async () => {
    if (!confirm('Dọn các object upload quá 24 giờ không còn được bài viết, banner hoặc sự kiện tham chiếu?')) return;
    setCleaning(true);
    try {
      const res = await apiFetch<{ deletedCount: number; deletedBytes: number }>('/media/cleanup', {
        method: 'POST',
        body: JSON.stringify({ olderThanHours: 24 }),
      });
      await load();
      alert(`Đã dọn ${res.deletedCount} file (${fmtSize(res.deletedBytes)}).`);
    } catch (err) {
      alert(`Không thể dọn media: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCleaning(false);
    }
  };

  const copyURL = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <AdminPage title="Quản lý Media">
      {/* Upload bar */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <Btn onClick={() => fileRef.current?.click()} disabled={uploading}>
          <Upload size={14} /> {uploading ? `Đang upload… ${progress}%` : 'Upload ảnh'}
        </Btn>
        <Btn variant="secondary" onClick={handleCleanup} disabled={uploading || cleaning}>
          <Wrench size={14} /> {cleaning ? 'Đang dọn…' : 'Dọn file mồ côi'}
        </Btn>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleUpload}
        />
        {uploading && (
          <div style={{ flex: 1, minWidth: 200, background: '#e5e7eb', borderRadius: 4, height: 6 }}>
            <div style={{ width: `${progress}%`, background: 'var(--color-navy)', height: '100%', borderRadius: 4, transition: 'width 0.2s' }} />
          </div>
        )}
        <span style={{ fontSize: '0.8rem', color: 'var(--color-ink-light)', marginLeft: 'auto' }}>
          {files.length} ảnh · {fmtSize(totalBytes)} đang dùng{pendingUploads > 0 && ` · ${pendingUploads} upload đang chờ`}
        </span>
      </div>

      {/* Grid */}
      {loading ? (
        <p style={{ color: 'var(--color-ink-light)', fontSize: '0.85rem' }}>Đang tải…</p>
      ) : files.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-ink-light)' }}>
          <Image size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p>Chưa có ảnh nào. Nhấn "Upload ảnh" để bắt đầu.</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 12,
        }}>
          {files.map((f) => (
            <div key={f.key} style={{
              background: '#fff', borderRadius: 8, overflow: 'hidden',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)', position: 'relative',
            }}>
              {/* Thumbnail */}
              <div style={{ width: '100%', height: 140, overflow: 'hidden', background: '#f3f4f6', position: 'relative' }}>
                <img
                  src={f.url}
                  alt=""
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
              {/* Meta */}
              <div style={{ padding: '0.5rem 0.6rem' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-ink-light)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.key.split('/').pop()}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{fmtSize(f.size)} · {fmtDate(f.updatedAt)}</div>
                {/* Actions */}
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  <button
                    title={copied === f.url ? '✓ Đã copy!' : 'Copy URL'}
                    onClick={() => copyURL(f.url)}
                    style={{ flex: 1, padding: '0.3rem', borderRadius: 4, border: '1px solid #e5e7eb', background: copied === f.url ? '#d1fae5' : '#f9fafb', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, color: copied === f.url ? '#065f46' : '#374151' }}
                  >
                    <Copy size={11} /> {copied === f.url ? 'Đã copy' : 'Copy URL'}
                  </button>
                  <button
                    title="Xóa ảnh"
                    onClick={() => handleDelete(f.key)}
                    style={{ padding: '0.3rem 0.5rem', borderRadius: 4, border: '1px solid #fca5a5', background: '#fff5f5', cursor: 'pointer', color: '#dc2626', display: 'flex', alignItems: 'center' }}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
