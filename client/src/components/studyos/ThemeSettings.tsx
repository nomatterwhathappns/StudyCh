import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { usePalette, type StudyPalette } from "@/contexts/PaletteContext";
import { Palette, Shuffle } from "lucide-react";
import React, { useState } from "react";

export const paletteOptions: Array<{ id: StudyPalette; name: string; description: string; colors: string[] }> = [
  { id: "frosted-blue", name: "Frosted Blue", description: "Tema biru pastel yang sedang dipakai.", colors: ["#7BDFF2", "#B2F7EF", "#EFF7F6", "#F7D6E0", "#F2B5D4"] },
  { id: "vintage-rose", name: "Vintage Rose", description: "Preview dari Peach Glow, Cherry Rose, Vintage Grape, Khaki Beige, dan Light Bronze.", colors: ["#EFC69B", "#AF1B3F", "#473144", "#CCB69B", "#DF9B6D"] },
];

export function ThemeSettings({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const { palette, setPalette } = usePalette();

  const pick = (nextPalette: StudyPalette) => setPalette(nextPalette);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {compact ? <button type="button" className="study-icon-button" aria-label="Open theme settings"><Palette className="size-4" /></button> : <button type="button" className="study-theme-settings"><span className="flex size-8 items-center justify-center rounded-lg border border-border"><Palette className="size-3.5" /></span><span className="min-w-0 text-left"><small>Theme</small><strong>{palette === "vintage-rose" ? "Vintage Rose" : "Frosted Blue"}</strong></span><span className="ml-auto flex gap-0.5" aria-hidden="true">{paletteOptions.find((option) => option.id === palette)?.colors.slice(0, 3).map((color) => <i key={color} className="size-2.5 rounded-full border border-black/10" style={{ backgroundColor: color }} />)}</span></button>}
      </DialogTrigger>
      <DialogContent className="rounded-3xl border-border bg-card text-card-foreground sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl italic">Choose your theme</DialogTitle>
          <DialogDescription>Preview a palette instantly across StudyOS. This choice is stored only in this browser.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-3">
          {paletteOptions.map((option) => <button key={option.id} type="button" onClick={() => pick(option.id)} className={`rounded-2xl border p-3 text-left transition-colors ${palette === option.id ? "border-primary bg-primary/10" : "border-border bg-secondary/25 hover:bg-secondary/55"}`} aria-pressed={palette === option.id}>
            <span className="flex items-start justify-between gap-4"><span><strong className="block text-sm text-foreground">{option.name}</strong><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{option.description}</span></span><span className="flex shrink-0 overflow-hidden rounded-xl border border-black/10" aria-hidden="true">{option.colors.map((color) => <i key={color} className="h-8 w-5" style={{ backgroundColor: color }} />)}</span></span>
          </button>)}
        </div>
        <Button type="button" onClick={() => setOpen(false)} className="rounded-xl bg-primary text-primary-foreground">Done</Button>
      </DialogContent>
    </Dialog>
  );
}

export function ThemeShuffleButton() {
  const { palette, setPalette } = usePalette();
  const shuffleTheme = () => {
    const choices = paletteOptions.filter((option) => option.id !== palette);
    const next = choices[Math.floor(Math.random() * choices.length)];
    if (next) setPalette(next.id);
  };

  return <button type="button" onClick={shuffleTheme} className="study-theme-shuffle" aria-label="Shuffle theme" title="Shuffle theme"><Shuffle className="size-4" /></button>;
}
