import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type QuizGenerationSettings = {
  difficulty: "easy" | "medium" | "hard";
  questionCount: 3 | 5;
  optionCount: 2 | 3 | 4;
};

export const defaultQuizGenerationSettings: QuizGenerationSettings = {
  difficulty: "medium",
  questionCount: 5,
  optionCount: 4,
};

type Preset = { label: string; description: string; settings: QuizGenerationSettings };

const presets: Preset[] = [
  { label: "Quick", description: "3 soal · 4 pilihan · Easy", settings: { difficulty: "easy", questionCount: 3, optionCount: 4 } },
  { label: "Standard", description: "5 soal · 4 pilihan · Medium", settings: defaultQuizGenerationSettings },
  { label: "Challenge", description: "5 soal · 4 pilihan · Hard", settings: { difficulty: "hard", questionCount: 5, optionCount: 4 } },
];

function ChoiceGroup<T extends string | number>({ label, value, choices, onChange }: { label: string; value: T; choices: Array<{ value: T; label: string }>; onChange: (value: T) => void }) {
  return <div>
    <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
    <div className="grid grid-cols-3 gap-2">
      {choices.map((choice) => <button key={String(choice.value)} type="button" onClick={() => onChange(choice.value)} className={`rounded-xl border px-3 py-2 text-xs transition-colors ${value === choice.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary/45 text-foreground hover:bg-secondary"}`}>{choice.label}</button>)}
    </div>
  </div>;
}

export function QuizGeneratorDialog({ open, settings, pending, hasMaterials, onOpenChange, onSettingsChange, onGenerate }: { open: boolean; settings: QuizGenerationSettings; pending: boolean; hasMaterials: boolean; onOpenChange: (open: boolean) => void; onSettingsChange: (settings: QuizGenerationSettings) => void; onGenerate: () => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="rounded-3xl border-border bg-card text-card-foreground sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="font-display text-3xl italic">Build a quiz</DialogTitle>
        <DialogDescription>Mulai dari preset, lalu atur level dan format soal kalau perlu.</DialogDescription>
      </DialogHeader>
      <div className="space-y-5 py-2">
        <div className="grid grid-cols-3 gap-2">
          {presets.map((preset) => <button key={preset.label} type="button" onClick={() => onSettingsChange(preset.settings)} className={`rounded-xl border p-2 text-left transition-colors ${JSON.stringify(settings) === JSON.stringify(preset.settings) ? "border-primary bg-primary/10" : "border-border bg-secondary/40 hover:bg-secondary"}`}><span className="block text-xs font-medium">{preset.label}</span><span className="mt-1 block font-mono text-[8px] leading-relaxed text-muted-foreground">{preset.description}</span></button>)}
        </div>
        <ChoiceGroup label="Difficulty" value={settings.difficulty} choices={[{ value: "easy", label: "Easy" }, { value: "medium", label: "Medium" }, { value: "hard", label: "Hard" }]} onChange={(difficulty) => onSettingsChange({ ...settings, difficulty })} />
        <ChoiceGroup label="Jumlah soal" value={settings.questionCount} choices={[{ value: 3, label: "3 soal" }, { value: 5, label: "5 soal" }]} onChange={(questionCount) => onSettingsChange({ ...settings, questionCount })} />
        <ChoiceGroup label="Pilihan per soal" value={settings.optionCount} choices={[{ value: 2, label: "A–B" }, { value: 3, label: "A–C" }, { value: 4, label: "A–D" }]} onChange={(optionCount) => onSettingsChange({ ...settings, optionCount })} />
        {!hasMaterials && <p className="rounded-xl border border-destructive/35 bg-destructive/10 p-3 text-xs leading-relaxed text-destructive">Tambahkan atau impor materi terlebih dahulu agar Quiz punya sumber belajar.</p>}
        <Button type="button" onClick={onGenerate} disabled={pending || !hasMaterials} className="w-full rounded-xl bg-primary text-primary-foreground">{pending ? "Generating…" : `Generate ${settings.questionCount} questions`}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
