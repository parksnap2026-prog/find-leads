"use client";

import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Palette,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/cn";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

function ToolbarBtn({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg transition",
        active
          ? "bg-indigo-600 text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="mx-1 h-6 w-px bg-slate-200" />;
}

const MERGE_TAGS = [
  { label: "{{NAME}}", title: "Business name" },
  { label: "{{CITY}}", title: "City" },
  { label: "{{TYPE}}", title: "Business type" },
];

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write your outreach email…",
}: RichTextEditorProps) {
  const [showHtml, setShowHtml] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [textColor, setTextColor] = useState("#1e293b");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-indigo-600 underline" },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: false }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "<p></p>",
    editorProps: {
      attributes: {
        class: "rte-content min-h-[360px] px-5 py-4 text-[15px] leading-relaxed text-slate-800 outline-none",
      },
    },
    onUpdate({ editor: ed }) {
      onChange(ed.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (current !== value) {
      editor.commands.setContent(value || "<p></p>", { emitUpdate: false });
    }
  }, [editor, value]);

  function setLink() {
    if (!editor) return;
    if (!linkUrl.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: linkUrl.trim() }).run();
    }
    setShowLinkInput(false);
    setLinkUrl("");
  }

  function insertMergeTag(tag: string) {
    editor?.chain().focus().insertContent(tag).run();
  }

  function insertLogoPlaceholder() {
    editor
      ?.chain()
      .focus()
      .insertContent(
        '<p><img src="cid:logo_webpower" alt="Your logo" width="140" style="margin-top:12px" /></p>',
      )
      .run();
  }

  if (!editor) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
        <ToolbarBtn
          title="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Underline"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Strikethrough"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarBtn>

        <ToolbarDivider />

        <ToolbarBtn
          title="Heading 1"
          active={editor.isActive("heading", { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Heading 2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Heading 3"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarBtn>

        <ToolbarDivider />

        <ToolbarBtn
          title="Bullet list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Quote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </ToolbarBtn>

        <ToolbarDivider />

        <ToolbarBtn
          title="Align left"
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Align center"
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Align right"
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight className="h-4 w-4" />
        </ToolbarBtn>

        <ToolbarDivider />

        <ToolbarBtn
          title="Add link"
          active={editor.isActive("link")}
          onClick={() => {
            const prev = editor.getAttributes("link").href as string | undefined;
            setLinkUrl(prev ?? "");
            setShowLinkInput((v) => !v);
          }}
        >
          <Link2 className="h-4 w-4" />
        </ToolbarBtn>
        <label title="Text color" className="relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100">
          <Palette className="h-4 w-4" />
          <input
            type="color"
            value={textColor}
            className="absolute inset-0 cursor-pointer opacity-0"
            onChange={(e) => {
              setTextColor(e.target.value);
              editor.chain().focus().setColor(e.target.value).run();
            }}
          />
        </label>
        <ToolbarBtn
          title="Highlight"
          active={editor.isActive("highlight")}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
        >
          <Highlighter className="h-4 w-4" />
        </ToolbarBtn>

        <ToolbarDivider />

        <ToolbarBtn title="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn title="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 className="h-4 w-4" />
        </ToolbarBtn>

        <ToolbarDivider />

        <ToolbarBtn title="Insert logo placeholder" onClick={insertLogoPlaceholder}>
          <ImageIcon className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn
          title="View HTML source"
          active={showHtml}
          onClick={() => setShowHtml((v) => !v)}
        >
          <Code2 className="h-4 w-4" />
        </ToolbarBtn>
      </div>

      {/* Merge tags */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-white px-4 py-2">
        <span className="text-xs font-medium text-slate-400">Insert:</span>
        {MERGE_TAGS.map((tag) => (
          <button
            key={tag.label}
            type="button"
            title={tag.title}
            onClick={() => insertMergeTag(tag.label)}
            className="rounded-full bg-indigo-50 px-2.5 py-1 font-mono text-xs text-indigo-700 transition hover:bg-indigo-100"
          >
            {tag.label}
          </button>
        ))}
      </div>

      {/* Link input */}
      {showLinkInput && (
        <div className="flex items-center gap-2 border-b border-slate-100 bg-amber-50/50 px-4 py-2">
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://example.com"
            className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-indigo-400"
            onKeyDown={(e) => e.key === "Enter" && setLink()}
          />
          <button
            type="button"
            onClick={setLink}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => setShowLinkInput(false)}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Editor / HTML toggle */}
      {showHtml ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={18}
          className="w-full resize-y border-0 bg-slate-950 px-5 py-4 font-mono text-xs leading-relaxed text-emerald-300 outline-none"
          spellCheck={false}
        />
      ) : (
        <EditorContent editor={editor} />
      )}
    </div>
  );
}
