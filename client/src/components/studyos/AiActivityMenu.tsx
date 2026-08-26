import { useSourceAiActivity } from "@/contexts/SourceAiActivityContext";
import { useStudyStore } from "@/store/useStudyStore";
import { ChevronUp, Loader2, Sparkles, X } from "lucide-react";
import React, { useEffect, useState } from "react";

export function AiActivityMenu() {
  const { tasks, cancelTask } = useSourceAiActivity();
  const sessions = useStudyStore((state) => state.sessions);
  const active = tasks.filter((task) => task.status === "pending");
  const [open, setOpen] = useState(false);

  useEffect(() => { if (!active.length) setOpen(false); }, [active.length]);
  if (!active.length) return null;

  return <div className="study-activity-menu">
    {open && <div className="study-activity-popover" role="status" aria-label="AI activities in progress">
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2"><span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">AI activity</span><span className="text-[10px] text-muted-foreground">{active.length} running</span></div>
      <div className="max-h-48 space-y-1 overflow-y-auto p-1.5">{active.map((task) => {
        const sessionName = sessions.find((session) => session.id === task.sessionId)?.name ?? "Study session";
        return <div key={task.id} className="flex items-center gap-2 rounded-lg px-2 py-2"><Loader2 className="size-3.5 shrink-0 animate-spin text-primary" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-foreground">{task.label}</p><p className="truncate text-[10px] text-muted-foreground">{sessionName}</p></div><button type="button" aria-label={`Cancel ${task.label}`} onClick={() => cancelTask(task.id)} className="study-activity-cancel"><X className="size-3.5" /></button></div>;
      })}</div>
    </div>}
    <button type="button" aria-label="AI activity" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="study-activity-trigger"><Sparkles className="size-3.5" /><span>{active.length} AI working</span><ChevronUp className={`size-3.5 transition-transform ${open ? "" : "rotate-180"}`} /></button>
  </div>;
}
