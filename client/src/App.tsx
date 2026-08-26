import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { PaletteProvider } from "./contexts/PaletteContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import StudyWorkspace from "./pages/StudyWorkspace";
import NotFound from "./pages/NotFound";
import { Route, Switch } from "wouter";

function Router() {
  return <Switch><Route path="/" component={Home} /><Route path="/studych" component={StudyWorkspace} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="dark"><PaletteProvider><TooltipProvider><Toaster /><Router /></TooltipProvider></PaletteProvider></ThemeProvider></ErrorBoundary>;
}
