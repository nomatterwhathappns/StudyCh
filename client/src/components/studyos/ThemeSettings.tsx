import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { usePalette, type StudyPalette } from "@/contexts/PaletteContext";
import { Palette, Shuffle } from "lucide-react";
import React, { useState } from "react";

const paletteOptions: Array<{ id: StudyPalette; name: string; description: string; colors: string[] }> = [
  { id: "frosted-blue", name: "Frosted Blue", description: "Tema biru pastel yang sedang dipakai.", colors: ["#7BDFF2", "#B2F7EF", "#EFF7F6", "#F7D6E0", "#F2B5D4"] },
  { id: "midnight-blue", name: "Midnight Blue", description: "Tema gelap dari Black, Carbon Black, Chocolate Plum, Taupe Grey, dan Light Blue.", colors: ["#070707", "#28231C", "#513B3C", "#655356", "#C1EEFF"] },
  { id: "lilac-sky", name: "Lilac Sky", description: "Tema biru-lilac dari Icy Blue, Wisteria Blue, Periwinkle, Cornflower Blue, dan Deep Lilac.", colors: ["#A0DDFF", "#758ECD", "#C1CEFE", "#7189FF", "#624CAB"] },
  { id: "ocean-depths", name: "Ocean Depths", description: "Tema navy-teal dari Prussian Blue, Space Indigo, Dusk Blue, Tropical Teal, dan Neon Ice.", colors: ["#0B132B", "#1C2541", "#3A506B", "#5BC0BE", "#6FFFE9"] },
  { id: "fuchsia-noir", name: "Fuchsia Noir", description: "Powder Blush dan Fuchsia Plum di atas Midnight Violet.", colors: ["#DAA89B", "#AE847E", "#2C0E37", "#690375", "#CB429F"] },
  { id: "tea-olive", name: "Tea Olive", description: "Tema terang hijau lembut dari Tea Green dan Dark Khaki.", colors: ["#D0F1BF", "#B6D7B9", "#9ABD97", "#646536", "#483D03"] },
  { id: "sapphire-blush", name: "Sapphire Blush", description: "Blue Slate dan Dusty Mauve dengan Pink Orchid yang lembut.", colors: ["#1E3231", "#485665", "#8E7C93", "#D0A5C0", "#F6C0D0"] },
  { id: "grape-rose", name: "Grape Rose", description: "Sapphire biru dengan Plum dan Grapefruit Pink yang terang.", colors: ["#272727", "#2B50AA", "#FF9FE5", "#FFD4D4", "#FF858D"] },
  { id: "ink-berry", name: "Ink Berry", description: "Sky Reflection dan Soft Periwinkle dengan aksen Neon Ice.", colors: ["#8FBFE0", "#7C77B9", "#1D8A99", "#0BC9CD", "#14FFF7"] },
  { id: "forest-blush", name: "Forest Blush", description: "Atomic Tangerine dan Peach Glow bertemu Baltic Blue.", colors: ["#FF6B35", "#F7C59F", "#EFEFD0", "#004E89", "#1A659E"] },
  { id: "noir-saffron", name: "Noir Saffron", description: "Pale Sky dan Neon Ice kontras dengan Burgundy serta Ink Black.", colors: ["#C1CFDA", "#20A4F3", "#59F8E8", "#941C2F", "#03191E"] },
  { id: "grape-soda", name: "Grape Soda", description: "Honeydew sebagai aksen terang di atas ungu gelap yang kaya.", colors: ["#E2FCEF", "#9B287B", "#5C164E", "#402039", "#170F11"] },
  { id: "velvet-orchid", name: "Velvet Orchid", description: "Velvet Orchid, Berry Blush, dan white dengan dasar gelap.", colors: ["#631D76", "#9E4770", "#FBFBFB", "#2E2532", "#201A23"] },
  { id: "dusk-grape", name: "Dusk Grape", description: "Vintage Grape menuju Dusk Blue dan Gunmetal yang tenang.", colors: ["#30292F", "#413F54", "#5F5AA2", "#355691", "#3F4045"] },
];

export function ThemeSettings({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const { palette, setPalette } = usePalette();

  const pick = (nextPalette: StudyPalette) => setPalette(nextPalette);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {compact ? <button type="button" className="study-icon-button" aria-label="Open theme settings"><Palette className="size-4" /></button> : <button type="button" className="study-theme-settings"><span className="flex size-8 items-center justify-center rounded-lg border border-border"><Palette className="size-3.5" /></span><span className="min-w-0 text-left"><small>Theme</small><strong>{paletteOptions.find((option) => option.id === palette)?.name ?? "Frosted Blue"}</strong></span><span className="ml-auto flex gap-0.5" aria-hidden="true">{paletteOptions.find((option) => option.id === palette)?.colors.slice(0, 3).map((color) => <i key={color} className="size-2.5 rounded-full border border-black/10" style={{ backgroundColor: color }} />)}</span></button>}
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto rounded-3xl border-border bg-card text-card-foreground sm:max-w-lg">
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
