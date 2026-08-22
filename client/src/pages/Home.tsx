import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PersonalAiSettings } from "@/components/studyos/PersonalAiSettings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { useStudyStore } from "@/store/useStudyStore";
import { compactKeyTermText, deriveStats, formatDuration, sessionVocabulary } from "@/lib/study-utils";
import { ArrowLeft, BookOpenText, Check, Clock3, FolderOpen, ImageUp, KeyRound, Loader2, Pin, Search, Settings2, Sparkles, Trash2, UserRound, X } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

type DashboardView = "profile" | "sessions" | "vocabulary";

export default function Home() {
  const [view, setView] = useState<DashboardView>("profile");
  const [location, setLocation] = useLocation();
  const { hydrated, hydrate, profile, sessions, timers, activeSessionId, setActiveSession, updateProfile, updateSession, deleteSession, deleteTimer, deleteVocabulary } = useStudyStore();

  useEffect(() => { void hydrate(); }, [hydrate]);

  if (!hydrated) return <div className="study-loading"><span>StudyOS</span><i>Loading your learning space</i></div>;

  return (
    <div className="study-dashboard min-h-screen bg-background text-foreground">
      <aside className="study-sidebar">
        <button type="button" onClick={() => setLocation("/studych")} className="study-back-button">
          <ArrowLeft className="size-4" /> <span>Back to study</span>
        </button>
        <div className="mt-14 px-2">
          <p className="study-kicker px-3">Your space</p>
          <nav className="mt-3 space-y-1">
            <SidebarNav icon={UserRound} label="Profile" active={view === "profile"} onClick={() => setView("profile")} />
            <SidebarNav icon={FolderOpen} label="Sessions" active={view === "sessions"} onClick={() => setView("sessions")} />
            <SidebarNav icon={BookOpenText} label="Key Terms" active={view === "vocabulary"} onClick={() => setView("vocabulary")} />
          </nav>
        </div>
        <div className="mt-auto px-2 pb-3">
          <PersonalAiSettings />
          <div className="mt-5 flex items-center gap-2 px-3 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-[#BA2D0B]" /> Secure AI workspace
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-5 sm:p-8 lg:p-10">
        {view === "profile" && <ProfileView profile={profile} sessions={sessions} timers={timers} activeSessionId={activeSessionId} onProfileUpdate={updateProfile} onDeleteTimer={deleteTimer} onOpenSession={(id) => { setActiveSession(id); setLocation("/studych"); }} />}
        {view === "sessions" && <SessionsView sessions={sessions} onTogglePin={(id, isPinned) => updateSession(id, { isPinned: !isPinned })} onDelete={(id) => { if (window.confirm("Delete this session and all of its study data?")) deleteSession(id); }} onOpen={(id) => { setActiveSession(id); setLocation("/studych"); }} />}
        {view === "vocabulary" && <VocabularyView sessions={sessions} onDelete={(sessionId, vocabId) => deleteVocabulary(sessionId, vocabId)} />}
      </main>
    </div>
  );
}

function SidebarNav({ icon: Icon, label, active, onClick }: { icon: typeof UserRound; label: string; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`study-nav-item ${active ? "is-active" : ""}`}><Icon className="size-4" /><span>{label}</span></button>;
}

export function ProfileView({ profile, sessions, timers, onProfileUpdate, onDeleteTimer, onOpenSession }: { profile: { name: string; avatar?: string }; sessions: ReturnType<typeof useStudyStore.getState>["sessions"]; timers: ReturnType<typeof useStudyStore.getState>["timers"]; activeSessionId: string | null; onProfileUpdate: (profile: Partial<{ name: string; avatar?: string }>) => void; onDeleteTimer: (id: string) => void; onOpenSession: (id: string) => void }) {
  const stats = useMemo(() => deriveStats(sessions, timers), [sessions, timers]);
  const favorites = sessions.filter((session) => session.isPinned);
  return (
    <section className="mx-auto max-w-7xl">
      <PageHeader title="Profile" action={<ProfileEditor profile={profile} onSave={onProfileUpdate} />} />
      <div className="study-profile-card mt-8">
        <ProfileAvatar profile={profile} size="lg" />
        <div className="min-w-0">
          <h2 className="font-display text-3xl italic tracking-tight sm:text-4xl">{profile.name || "Learner"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Your quiet place to learn with intention.</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={FolderOpen} label="Total sessions" value={stats.totalSessions.toString()} />
        <StatCard icon={Clock3} label="Study time" value={formatDuration(stats.totalStudySeconds)} />
        <StatCard icon={Sparkles} label="Avg. quiz score" value={stats.averageQuizScore ? `${stats.averageQuizScore}%` : "—"} />
        <StatCard icon={BookOpenText} label="Total key terms" value={stats.totalVocabulary.toString()} />
      </div>
      <div className="mt-8 grid gap-5 xl:grid-cols-2">
        <div className="study-section-card min-h-[310px]">
          <div className="flex items-center justify-between"><h3 className="font-display text-2xl italic">Timer History</h3><Clock3 className="size-4 text-muted-foreground" /></div>
          {timers.length ? <ScrollArea className="mt-5 h-[226px] pr-3"><div className="space-y-2">{timers.map((entry) => <div key={entry.id} className="study-list-row"><div className="min-w-0"><p className="truncate text-sm text-foreground">{entry.sessionName}</p><p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{new Date(entry.pinnedAt).toLocaleDateString()}</p></div><span className="font-mono text-xs text-muted-foreground">{formatDuration(entry.seconds)}</span><button type="button" onClick={() => onDeleteTimer(entry.id)} aria-label={`Delete ${entry.sessionName} timer entry`} className="study-icon-button text-muted-foreground hover:text-[#BA2D0B]"><Trash2 className="size-3.5" /></button></div>)}</div></ScrollArea> : <EmptyState text="No pinned study time yet." />}
        </div>
        <div className="study-section-card min-h-[310px]">
          <div className="flex items-center justify-between"><h3 className="font-display text-2xl italic">Favorite Sessions</h3><Pin className="size-4 text-muted-foreground" /></div>
          {favorites.length ? <div className="mt-5 space-y-2">{favorites.map((session) => <button key={session.id} type="button" onClick={() => onOpenSession(session.id)} className="study-favorite-row"><span className="size-1.5 rounded-full bg-[#BA2D0B]" /><span className="truncate">{session.name}</span><ArrowLeft className="ml-auto size-3.5 rotate-180 text-muted-foreground" /></button>)}</div> : <EmptyState text="Pin a session to keep it close." />}
        </div>
      </div>
    </section>
  );
}

function SessionsView({ sessions, onTogglePin, onDelete, onOpen }: { sessions: ReturnType<typeof useStudyStore.getState>["sessions"]; onTogglePin: (id: string, isPinned: boolean) => void; onDelete: (id: string) => void; onOpen: (id: string) => void }) {
  return <section className="mx-auto max-w-7xl"><PageHeader title="Sessions" /><p className="mt-2 text-sm text-muted-foreground">Create a new session from your study workspace, then return here to organize it.</p>{sessions.length ? <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{sessions.map((session) => <article key={session.id} className="study-session-card"><button type="button" onClick={() => onOpen(session.id)} className="absolute inset-0 text-left" aria-label={`Open ${session.name}`} /><div className="relative z-10 flex items-start justify-between gap-3 pointer-events-none"><div className="min-w-0"><h2 className="truncate font-display text-2xl italic">{session.name}</h2><p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{session.description || `${session.materials.length} source${session.materials.length === 1 ? "" : "s"} · ${session.vocabulary.length} terms`}</p></div><button type="button" onClick={(event) => { event.stopPropagation(); onTogglePin(session.id, session.isPinned); }} className={`study-icon-button pointer-events-auto ${session.isPinned ? "text-[#BA2D0B]" : "text-muted-foreground"}`} aria-label={session.isPinned ? "Unfavorite session" : "Favorite session"}><Pin className={`size-4 ${session.isPinned ? "fill-current" : ""}`} /></button></div><div className="relative z-10 mt-8 flex items-center justify-between pointer-events-none"><span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{new Date(session.createdAt).toLocaleDateString()}</span><button type="button" onClick={(event) => { event.stopPropagation(); onDelete(session.id); }} className="study-icon-button pointer-events-auto text-muted-foreground hover:text-[#BA2D0B]" aria-label={`Delete ${session.name}`}><Trash2 className="size-3.5" /></button></div></article>)}</div> : <div className="study-empty-large mt-8">— <span>Start in the study workspace to create your first session.</span></div>}</section>;
}

function VocabularyView({ sessions, onDelete }: { sessions: ReturnType<typeof useStudyStore.getState>["sessions"]; onDelete: (sessionId: string, vocabId: string) => void }) {
  const [query, setQuery] = useState("");
  const entries = useMemo(() => sessionVocabulary(sessions).filter((entry) => `${entry.term} ${entry.definition}`.toLowerCase().includes(query.toLowerCase().trim())), [query, sessions]);
  return <section className="mx-auto max-w-7xl"><PageHeader title="Key Terms" action={<div className="study-search"><Search className="size-4" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search key terms" aria-label="Search key terms" /></div>} />{entries.length ? <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{entries.map((entry) => <article key={entry.id} className="study-vocab-card"><div className="flex items-start justify-between gap-2"><h2 className="font-display text-2xl italic">{compactKeyTermText(entry.term, 80)}</h2><div className="flex items-center gap-1"><span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{entry.sessionName}</span><button type="button" onClick={() => onDelete(entry.sessionId, entry.id)} className="study-icon-button size-7 text-muted-foreground hover:text-[#BA2D0B]" aria-label={`Delete ${entry.term}`}><Trash2 className="size-3.5" /></button></div></div><div className="my-4 h-px bg-border" /><p className="text-sm leading-relaxed text-muted-foreground">{compactKeyTermText(entry.definition, 180)}</p>{(entry.context || entry.example) && <details className="mt-4 rounded-xl border border-border bg-secondary/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground"><summary className="cursor-pointer font-mono text-[9px] uppercase tracking-[0.12em] text-primary">More context</summary>{entry.context && <p className="mt-2">{compactKeyTermText(entry.context, 150)}</p>}{entry.example && <p className="mt-2">{compactKeyTermText(entry.example, 150)}</p>}</details>}</article>)}</div> : <div className="study-empty-large mt-8">— <span>{query ? "No key terms match this search." : "Key terms saved from your sources will appear here."}</span></div>}</section>;
}

function PageHeader({ title, action }: { title: string; action?: React.ReactNode }) { return <header className="flex items-center justify-between gap-4"><h1 className="font-display text-4xl italic tracking-tight sm:text-5xl">{title}</h1>{action}</header>; }
function StatCard({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) { return <article className="study-stat-card"><Icon className="size-4 text-[#BA2D0B]" /><p className="mt-7 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p><p className="mt-2 font-display text-3xl italic tracking-tight">{value}</p></article>; }
function EmptyState({ text }: { text: string }) { return <div className="flex h-[220px] items-center justify-center text-center font-display text-lg italic text-muted-foreground"><span>— {text}</span></div>; }

function ProfileAvatar({ profile, size = "sm" }: { profile: { name: string; avatar?: string }; size?: "sm" | "lg" }) {
  const sizeClass = size === "lg" ? "size-20 sm:size-24" : "size-9";
  return profile.avatar ? <img src={profile.avatar} alt="Profile" className={`${sizeClass} shrink-0 rounded-full border border-border object-cover`} /> : <div className={`${sizeClass} study-avatar shrink-0`} aria-label="Profile avatar">{(profile.name || "L").slice(0, 1).toUpperCase()}</div>;
}

export function ProfileEditor({ profile, onSave }: { profile: { name: string; avatar?: string }; onSave: (patch: Partial<{ name: string; avatar?: string }>) => void }) {
  const [open, setOpen] = useState(false); const [name, setName] = useState(profile.name); const [preview, setPreview] = useState<string | undefined>(); const [fileName, setFileName] = useState(""); const [error, setError] = useState("");
  const uploadAvatar = trpc.study.uploadAvatar.useMutation();
  useEffect(() => { if (open) { setName(profile.name); setPreview(undefined); setFileName(""); setError(""); } }, [open, profile]);
  const chooseImage = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) { setError("Choose a PNG or JPG image."); event.target.value = ""; return; } if (file.size > 1_500_000) { setError("Your PNG or JPG must be smaller than 1.5 MB."); event.target.value = ""; return; } const reader = new FileReader(); reader.onload = () => { if (typeof reader.result === "string") { setPreview(reader.result); setFileName(file.name); setError(""); } }; reader.onerror = () => setError("StudyOS could not read that image. Please try another PNG or JPG."); reader.readAsDataURL(file); };
  const saveProfile = async () => { try { const avatar = preview ? (await uploadAvatar.mutateAsync({ imageDataUrl: preview })).url : profile.avatar; onSave({ name: name.trim() || "Learner", avatar }); setOpen(false); } catch (reason) { setError(reason instanceof Error ? reason.message : "Profile image upload failed. Please try again."); } };
  const displayedAvatar = preview ?? profile.avatar;
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline" size="sm" className="rounded-xl border-border bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"><Settings2 className="mr-2 size-3.5" />Edit profile</Button></DialogTrigger><DialogContent className="rounded-3xl border-border bg-card text-card-foreground sm:max-w-md"><DialogHeader><DialogTitle className="font-display text-3xl italic">Profile details</DialogTitle><DialogDescription>Set your name and upload a PNG or JPG profile photo for your StudyOS workspace.</DialogDescription></DialogHeader><div className="grid gap-4 py-3"><div className="grid gap-2"><Label htmlFor="profile-name">Name</Label><Input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} className="rounded-xl border-border bg-secondary" /></div><div className="grid gap-2"><Label htmlFor="profile-avatar">Profile photo</Label><div className="flex items-center gap-4 rounded-2xl border border-dashed border-border bg-secondary/40 p-3"><ProfileAvatar profile={{ name, avatar: displayedAvatar }} size="lg" /><div className="min-w-0 flex-1"><Input id="profile-avatar" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" onChange={chooseImage} className="h-auto cursor-pointer border-0 bg-transparent p-0 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-medium file:text-primary-foreground hover:file:bg-primary/90" /><p className="mt-2 text-xs text-muted-foreground">PNG or JPG · maximum 1.5 MB{fileName ? ` · ${fileName}` : ""}</p></div><ImageUp className="size-4 shrink-0 text-muted-foreground" /></div>{error && <p role="alert" className="text-xs text-[#BA2D0B]">{error}</p>}</div></div><Button onClick={() => void saveProfile()} disabled={uploadAvatar.isPending} className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">{uploadAvatar.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />}{uploadAvatar.isPending ? "Uploading image…" : "Save changes"}</Button></DialogContent></Dialog>;
}

function AiSettings() {
  const [open, setOpen] = useState(false); const [model, setModel] = useState(() => localStorage.getItem("studyos_ai_model") ?? "gpt-5-mini"); const [responseStyle, setResponseStyle] = useState(() => localStorage.getItem("studyos_ai_style") ?? "Balanced");
  const gemini = trpc.study.googleGeminiStatus.useQuery(undefined, { staleTime: 60_000 }); const geminiReady = gemini.data?.configured === true;
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><button type="button" className="study-ai-settings"><span className="flex size-8 items-center justify-center rounded-lg border border-border"><KeyRound className="size-3.5" /></span><span className="min-w-0 text-left"><small>AI settings</small><strong>StudyOS AI</strong></span><Settings2 className="ml-auto size-3.5 text-muted-foreground" /></button></DialogTrigger><DialogContent className="rounded-3xl border-border bg-card text-card-foreground sm:max-w-md"><DialogHeader><DialogTitle className="font-display text-3xl italic">AI settings</DialogTitle><DialogDescription>Choose a provider model and response style. API keys remain only on the server and are never displayed or saved in your browser.</DialogDescription></DialogHeader><div className="grid gap-4 py-4"><div className="grid gap-2"><Label htmlFor="ai-model">Provider model</Label><select id="ai-model" value={model} onChange={(event) => setModel(event.target.value)} className="h-10 rounded-xl border border-border bg-secondary px-3 text-sm outline-none"><option value="gpt-5-mini">OpenAI · GPT-5 mini</option><option value="claude-haiku-4-5">Anthropic · Claude Haiku</option><option value="gemini-3-flash-preview">Google · Gemini 3.6 Flash (your key)</option></select></div>{model === "gemini-3-flash-preview" && <div className={`rounded-xl border p-3 text-xs leading-relaxed ${geminiReady ? "border-[#6E7650]/60 bg-[#6E7650]/10 text-foreground" : "border-[#BA2D0B]/40 bg-[#BA2D0B]/10 text-foreground"}`}><strong className="block">{gemini.isLoading ? "Checking Google Gemini…" : geminiReady ? "Google Gemini is connected" : "Google Gemini key is not configured"}</strong><p className="mt-1 text-muted-foreground">For local VS Code, create a `.env` file in the project root and set `GOOGLE_GENERATIVE_AI_API_KEY=your_key`, then restart the server. Never paste a key into this dialog.</p></div>}<div className="grid gap-2"><Label htmlFor="response-style">Response profile</Label><select id="response-style" value={responseStyle} onChange={(event) => setResponseStyle(event.target.value)} className="h-10 rounded-xl border border-border bg-secondary px-3 text-sm outline-none"><option>Balanced</option><option>Concise</option><option>Detailed</option></select></div></div><Button onClick={() => { localStorage.setItem("studyos_ai_model", model); localStorage.setItem("studyos_ai_style", responseStyle); setOpen(false); }} className="rounded-xl bg-primary text-primary-foreground">Save settings</Button></DialogContent></Dialog>;
}
