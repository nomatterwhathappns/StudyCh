import { Button } from "@/components/ui/button";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { ArrowLeft, Bold, ChevronDown, Code2, Italic, Link2, Redo2, Trash2, Undo2 } from "lucide-react";
import { useEffect } from "react";
import type { StudyNote } from "@/lib/study-types";

type NoteEditorProps = {
  note: StudyNote;
  onBack: () => void;
  onRename: (name: string) => void;
  onContentChange: (content: string) => void;
  onDelete: () => void;
};

export function NoteEditor({ note, onBack, onRename, onContentChange, onDelete }: NoteEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit, Link.configure({ openOnClick: false, autolink: true })],
    content: note.content,
    editorProps: { attributes: { class: "study-note-content focus:outline-none" } },
    onUpdate: ({ editor }) => onContentChange(editor.getHTML()),
  });

  useEffect(() => {
    if (editor && editor.getHTML() !== note.content) editor.commands.setContent(note.content, { emitUpdate: false });
  }, [editor, note.id, note.content]);

  const setLink = () => {
    const previousUrl = editor?.getAttributes("link").href as string | undefined;
    const url = window.prompt("Paste a link URL", previousUrl ?? "https://");
    if (!editor || url === null) return;
    if (!url.trim()) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  if (!editor) return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Opening note…</div>;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to notes" className="rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground">
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Watch / Notes</p>
          <input
            value={note.name}
            onChange={(event) => onRename(event.target.value)}
            className="mt-1 w-full bg-transparent font-display text-lg italic text-foreground outline-none placeholder:text-muted-foreground"
            aria-label="Note title"
          />
        </div>
        <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Delete note" className="rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="my-4 flex flex-wrap gap-1 rounded-2xl border border-border bg-secondary/50 p-1.5">
        <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}><Undo2 className="size-3.5" /></ToolbarButton>
        <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}><Redo2 className="size-3.5" /></ToolbarButton>
        <span className="mx-1 w-px bg-border" />
        <select
          value={editor.isActive("heading", { level: 2 }) ? "h2" : editor.isActive("heading", { level: 3 }) ? "h3" : "paragraph"}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "h2") editor.chain().focus().toggleHeading({ level: 2 }).run();
            else if (value === "h3") editor.chain().focus().toggleHeading({ level: 3 }).run();
            else editor.chain().focus().setParagraph().run();
          }}
          className="h-8 rounded-lg bg-transparent px-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground outline-none"
          aria-label="Text style"
        >
          <option value="paragraph">Body</option>
          <option value="h2">Heading</option>
          <option value="h3">Subheading</option>
        </select>
        <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="size-3.5" /></ToolbarButton>
        <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="size-3.5" /></ToolbarButton>
        <ToolbarButton label="Add link" active={editor.isActive("link")} onClick={setLink}><Link2 className="size-3.5" /></ToolbarButton>
        <ToolbarButton label="Inline code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}><Code2 className="size-3.5" /></ToolbarButton>
        <ToolbarButton label="Code block" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><ChevronDown className="size-3.5" /></ToolbarButton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function ToolbarButton({ label, onClick, active, disabled, children }: { label: string; onClick: () => void; active?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`flex size-8 items-center justify-center rounded-lg transition-colors ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-card hover:text-foreground"} disabled:opacity-35`}
    >
      {children}
    </button>
  );
}
