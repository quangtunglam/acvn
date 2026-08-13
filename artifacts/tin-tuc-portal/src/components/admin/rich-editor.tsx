import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useCallback } from 'react';

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

// ── Main editor ─────────────────────────────────────────────────────────────
interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichEditor({ value, onChange, placeholder = 'Nhập nội dung bài viết…' }: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: { class: 'rte-content', spellcheck: 'true' },
    },
  });

  // Sync value from outside (e.g. when switching articles)
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() === value) return;
    editor.commands.setContent(value, false);
  }, [value, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL liên kết:', prev ?? 'https://');
    if (url === null) return;
    if (url === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

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
        <Btn title="Xóa định dạng" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}>✕</Btn>
      </div>

      {/* ── Editing area ── */}
      <EditorContent editor={editor} className="rte-editor-wrap" />
    </div>
  );
}
