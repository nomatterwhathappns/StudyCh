import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { KeyRound, Loader2, Settings2, Trash2 } from "lucide-react";
import React, { useEffect, useState } from "react";

type ProviderModel = "gpt-5-mini" | "claude-haiku-4-5" | "gemini-3-flash-preview";

function displayError(error: unknown) {
  return error instanceof Error ? error.message : "StudyOS could not update your Gemini key. Please try again.";
}

export function PersonalAiSettings() {
  const [open, setOpen] = useState(false);
  const [model, setModel] = useState<ProviderModel>(() => (localStorage.getItem("studyos_ai_model") as ProviderModel | null) ?? "gpt-5-mini");
  const [responseStyle, setResponseStyle] = useState(() => localStorage.getItem("studyos_ai_style") ?? "Balanced");
  const [apiKey, setApiKey] = useState("");
  const [notice, setNotice] = useState("");
  const utils = trpc.useUtils();
  const gemini = trpc.study.personalGeminiStatus.useQuery(undefined, { enabled: open && model === "gemini-3-flash-preview", staleTime: 30_000 });
  const saveGeminiKey = trpc.study.savePersonalGeminiKey.useMutation({
    onSuccess: async (data) => {
      setApiKey("");
      setNotice(`Gemini key saved securely · ending ${data.keySuffix}`);
      await utils.study.personalGeminiStatus.invalidate();
    },
    onError: (error) => setNotice(displayError(error)),
  });
  const removeGeminiKey = trpc.study.removePersonalGeminiKey.useMutation({
    onSuccess: async () => {
      setNotice("Saved Gemini key removed.");
      await utils.study.personalGeminiStatus.invalidate();
    },
    onError: (error) => setNotice(displayError(error)),
  });

  useEffect(() => {
    if (!open) {
      setApiKey("");
      setNotice("");
    }
  }, [open]);

  const geminiSelected = model === "gemini-3-flash-preview";
  const configured = gemini.data?.configured === true;
  const pending = saveGeminiKey.isPending || removeGeminiKey.isPending;
  const saveSettings = () => {
    localStorage.setItem("studyos_ai_model", model);
    localStorage.setItem("studyos_ai_style", responseStyle);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="study-ai-settings">
          <span className="flex size-8 items-center justify-center rounded-lg border border-border"><KeyRound className="size-3.5" /></span>
          <span className="min-w-0 text-left"><small>AI settings</small><strong>StudyOS AI</strong></span>
          <Settings2 className="ml-auto size-3.5 text-muted-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto rounded-3xl border-border bg-card text-card-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl italic">AI settings</DialogTitle>
          <DialogDescription>Choose a model and response style. A Gemini key is encrypted per account on the server and is never returned to this browser.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="ai-model">Model</Label>
            <select id="ai-model" value={model} onChange={(event) => setModel(event.target.value as ProviderModel)} className="h-10 rounded-xl border border-border bg-secondary px-3 text-sm outline-none">
              <option value="gpt-5-mini">StudyOS AI gateway · GPT-5 mini</option>
              <option value="claude-haiku-4-5">StudyOS AI gateway · Claude Haiku</option>
              <option value="gemini-3-flash-preview">Google · Gemini 3.6 Flash (personal key)</option>
            </select>
          </div>

          {geminiSelected && (
            <div className="grid gap-3 rounded-2xl border border-border bg-secondary/35 p-3">
              <div className="text-xs leading-relaxed">
                <strong className="block text-foreground">{gemini.isLoading ? "Checking your saved Gemini key…" : configured ? `Personal Gemini key connected · ending ${gemini.data?.keySuffix}` : "Add your Gemini API key"}</strong>
                <p className="mt-1 text-muted-foreground">Paste a Google AI Studio Gemini key here once. It is encrypted server-side, never saved in browser storage, and can be replaced or removed at any time.</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="personal-gemini-key">Gemini API key</Label>
                <Input id="personal-gemini-key" type="password" autoComplete="new-password" spellCheck={false} value={apiKey} onChange={(event) => { setApiKey(event.target.value); setNotice(""); }} placeholder={configured ? "Paste a new key to replace the saved one" : "AIza…"} className="rounded-xl border-border bg-background font-mono text-xs" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" disabled={!apiKey.trim() || pending} onClick={() => saveGeminiKey.mutate({ apiKey: apiKey.trim() })} className="rounded-xl bg-primary text-primary-foreground">
                  {saveGeminiKey.isPending ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <KeyRound className="mr-2 size-3.5" />}{configured ? "Replace key" : "Save key"}
                </Button>
                {configured && <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => removeGeminiKey.mutate()} className="rounded-xl border-border text-muted-foreground hover:text-destructive"><Trash2 className="mr-2 size-3.5" />Remove key</Button>}
              </div>
              {notice && <p role="status" className={`rounded-xl px-3 py-2 text-xs leading-relaxed ${saveGeminiKey.isError || removeGeminiKey.isError ? "bg-destructive/15 text-[#FFE1EC]" : "bg-primary/20 text-foreground"}`}>{notice}</p>}
              <p className="text-[11px] leading-relaxed text-muted-foreground">The label beneath each assistant response shows the actual AI route used. If Gemini is unavailable, StudyOS shows when a fallback is used instead.</p>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="response-style">Response speed</Label>
            <select id="response-style" value={responseStyle === "Concise" ? "Fast" : responseStyle === "Detailed" ? "Deep" : responseStyle} onChange={(event) => setResponseStyle(event.target.value)} className="h-10 rounded-xl border border-border bg-secondary px-3 text-sm outline-none">
              <option value="Fast">Fast · quick, focused answers</option>
              <option value="Balanced">Balanced · clear everyday study help</option>
              <option value="Deep">Deep · longer, thorough explanations</option>
            </select>
            <p className="text-[11px] leading-relaxed text-muted-foreground">Fast sends a smaller source context and uses a shorter answer budget. Deep preserves more context for difficult material.</p>
          </div>
        </div>
        <Button onClick={saveSettings} className="rounded-xl bg-primary text-primary-foreground">Save settings</Button>
      </DialogContent>
    </Dialog>
  );
}
