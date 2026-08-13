import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import { useEffect, useCallback, useRef, useState } from 'react';
import { MediaPickerBtn } from '@/pages/admin/media-picker';

// ── Toolbar button ──────────────────────────────────────────────────────────
function Btn({
  active, disabled, onClick, title, children,
}: {
  active?: boolean; disabled?: boolean; onClick: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={`rte-btn${active ? ' rte-btn--active' : ''}${disabled ? ' rte-btn--disabled' : ''}`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="rte-divider" aria-hidden="true" />;
}

// ── Image insert panel ──────────────────────────────────────────────────────
function ImagePanel({ onInsert, onClose }: { onInsert: (url: string) => void; onClose: () => void }) {
  const [url, setUrl] = useState('');
  return (
    <div className="rte-insert-panel">
      <span className="rte-insert-panel-label">Chèn ảnh</span>
      <input
        autoFocus
        className="rte-insert-input"
        type="url"
        placeholder="https://…"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && url) { onInsert(url); }
          if (e.key === 'Escape') { onClose(); }
        }}
      />
      <MediaPickerBtn onSelect={(u) => { setUrl(u); onInsert(u); }} label="Media" />
      <button
        type="button"
        className="rte-insert-ok"
        disabled={!url}
        onMouseDown={(e) => { e.preventDefault(); if (url) onInsert(url); }}
      >Chèn</button>
      <button type="button" className="rte-insert-cancel" onMouseDown={(e) => { e.preventDefault(); onClose(); }}>✕</button>
    </div>
  );
}

// ── Video insert panel ──────────────────────────────────────────────────────
function VideoPanel({ onInsert, onClose }: { onInsert: (url: string) => void; onClose: () => void }) {
  const [url, setUrl] = useState('');
  return (
    <div className="rte-insert-panel">
      <span className="rte-insert-panel-label">Nhúng video</span>
      <input
        autoFocus
        className="rte-insert-input"
        type="url"
        placeholder="https://youtube.com/watch?v=… hoặc URL khác"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && url) { onInsert(url); }
          if (e.key === 'Escape') { onClose(); }
        }}
      />
      <button
        type="button"
        className="rte-insert-ok"
        disabled={!url}
        onMouseDown={(e) => { e.preventDefault(); if (url) onInsert(url); }}
      >Chèn</button>
      <button type="button" className="rte-insert-cancel" onMouseDown={(e) => { e.preventDefault(); onClose(); }}>✕</button>
    </div>
  );
}

// ── Main editor ─────────────────────────────────────────────────────────────
interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

type Panel = 'image' | 'video' | null;

export function RichEditor({ value, onChange, placeholder = 'Nhập nội dung bài viết…' }: RichEditorProps) {
  const lastEmittedRef = useRef<string>(value);
  const [panel, setPanel] = useState<Panel>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
      Image.configure({ allowBase64: false, HTMLAttributes: { class: 'rte-image' } }),
      Youtube.configure({ controls: true, nocookie: true, HTMLAttributes: { class: 'rte-youtube' } }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      lastEmittedRef.current = html;
      onChange(html);
    },
    editorProps: {
      attributes: { class: 'rte-content', spellcheck: 'true' },
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (value === lastEmittedRef.current) return;
    lastEmittedRef.current = value;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [value, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL liên kết:', prev ?? 'https://');
    if (url === null) return;
    if (url === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const insertImage = useCallback((url: string) => {
    if (!editor || !url) return;
    editor.chain().focus().setImage({ src: url }).run();
    setPanel(null);
  }, [editor]);

  const insertVideo = useCallback((url: string) => {
    if (!editor || !url) return;
    editor.commands.setYoutubeVideo({ src: url, width: 640, height: 360 });
    editor.commands.focus();
    setPanel(null);
  }, [editor]);

  const togglePanel = (p: Panel) => setPanel((prev) => (prev === p ? null : p));

  if (!editor) return null;

  const can = editor.can().chain().focus();

  return (
    <div className="rte-wrap">
      {/* ── Toolbar ── */}
      <div className="rte-toolbar" role="toolbar" aria-label="Thanh định dạng">

        {/* History */}
        <Btn title="Hoàn tác (Ctrl+Z)" disabled={!can.undo().run()} onClick={() => editor.chain().focus().undo().run()}>↩</Btn>
        <Btn title="Làm lại (Ctrl+Y)" disabled={!can.redo().run()} onClick={() => editor.chain().focus().redo().run()}>↪</Btn>

        <Divider />

        {/* Paragraph / headings */}
        <Btn title="Văn bản thường" active={editor.isActive('paragraph')} onClick={() => editor.chain().focus().setParagraph().run()}>¶</Btn>
        <Btn title="Tiêu đề 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Btn>
        <Btn title="Tiêu đề 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</Btn>
        <Btn title="Tiêu đề 4" active={editor.isActive('heading', { level: 4 })} onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}>H4</Btn>

        <Divider />

        {/* Inline marks */}
        <Btn title="In đậm (Ctrl+B)" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></Btn>
        <Btn title="In nghiêng (Ctrl+I)" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></Btn>
        <Btn title="Gạch dưới (Ctrl+U)" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></Btn>
        <Btn title="Gạch ngang" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></Btn>
        <Btn title="Code inline" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>{'<>'}</Btn>

        <Divider />

        {/* Lists */}
        <Btn title="Danh sách dấu chấm" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>• —</Btn>
        <Btn title="Danh sách đánh số" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</Btn>

        <Divider />

        {/* Alignment */}
        <Btn title="Căn trái" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>⬅</Btn>
        <Btn title="Căn giữa" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>↔</Btn>
        <Btn title="Căn phải" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>⮕</Btn>
        <Btn title="Căn đều" active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()}>☰</Btn>

        <Divider />

        {/* Extras */}
        <Btn title="Trích dẫn" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>"</Btn>
        <Btn title="Khối code" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>{'{ }'}</Btn>
        <Btn title="Đường ngang" onClick={() => editor.chain().focus().setHorizontalRule().run()}>—</Btn>
        <Btn title="Liên kết" active={editor.isActive('link')} onClick={setLink}>🔗</Btn>

        <Divider />

        {/* Media */}
        <Btn title="Chèn ảnh" active={panel === 'image'} onClick={() => togglePanel('image')}>🖼</Btn>
        <Btn title="Nhúng video (YouTube…)" active={panel === 'video'} onClick={() => togglePanel('video')}>▶</Btn>

        <Divider />

        <Btn title="Xóa định dạng" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}>✕</Btn>
      </div>

      {/* ── Insert panels ── */}
      {panel === 'image' && <ImagePanel onInsert={insertImage} onClose={() => setPanel(null)} />}
      {panel === 'video' && <VideoPanel onInsert={insertVideo} onClose={() => setPanel(null)} />}

      {/* ── Editing area ── */}
      <EditorContent editor={editor} className="rte-editor-wrap" />
    </div>
  );
}
