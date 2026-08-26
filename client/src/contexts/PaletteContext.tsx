import React, { createContext, useContext, useEffect, useState } from "react";

export type StudyPalette = "frosted-blue" | "vintage-rose";

type PaletteContextValue = {
  palette: StudyPalette;
  setPalette: (palette: StudyPalette) => void;
};

const STORAGE_KEY = "studyos_theme_palette";
const PaletteContext = createContext<PaletteContextValue | undefined>(undefined);

function storedPalette(): StudyPalette {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "frosted-blue" ? "frosted-blue" : "vintage-rose";
}

export function PaletteProvider({ children }: { children: React.ReactNode }) {
  const [palette, setPalette] = useState<StudyPalette>(storedPalette);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.palette = palette;
    localStorage.setItem(STORAGE_KEY, palette);
  }, [palette]);

  return <PaletteContext.Provider value={{ palette, setPalette }}>{children}</PaletteContext.Provider>;
}

export function usePalette() {
  const context = useContext(PaletteContext);
  if (!context) throw new Error("usePalette must be used within PaletteProvider");
  return context;
}
