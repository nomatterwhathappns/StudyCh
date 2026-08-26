import { useStudyStore } from "@/store/useStudyStore";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type WatchTimerMode = "stopwatch" | "countdown";
type TimerState = { mode: WatchTimerMode; elapsedSeconds: number; durationSeconds: number; startedAt: number | null };
export type WatchTimerSnapshot = { mode: WatchTimerMode; seconds: number; elapsedSeconds: number; durationSeconds: number; running: boolean; completed: boolean };
type WatchTimerValue = {
  timerFor: (sessionId: string) => WatchTimerSnapshot;
  toggle: (sessionId: string) => void;
  reset: (sessionId: string) => void;
  setMode: (sessionId: string, mode: WatchTimerMode) => void;
  setCountdownDuration: (sessionId: string, durationSeconds: number) => void;
  pin: (sessionId: string, sessionName: string, sessionStudySeconds: number) => void;
};

const defaultTimer = (): TimerState => ({ mode: "stopwatch", elapsedSeconds: 0, durationSeconds: 25 * 60, startedAt: null });
const WatchTimerContext = createContext<WatchTimerValue | null>(null);

function liveElapsed(timer: TimerState | undefined, now: number) {
  if (!timer) return 0;
  return timer.elapsedSeconds + (timer.startedAt ? Math.floor((now - timer.startedAt) / 1000) : 0);
}

function snapshot(timer: TimerState | undefined, now: number): WatchTimerSnapshot {
  const value = timer ?? defaultTimer();
  const elapsedSeconds = liveElapsed(value, now);
  const completed = value.mode === "countdown" && elapsedSeconds >= value.durationSeconds;
  return {
    mode: value.mode,
    elapsedSeconds: value.mode === "countdown" ? Math.min(elapsedSeconds, value.durationSeconds) : elapsedSeconds,
    durationSeconds: value.durationSeconds,
    seconds: value.mode === "countdown" ? Math.max(0, value.durationSeconds - elapsedSeconds) : elapsedSeconds,
    running: !!value.startedAt && !completed,
    completed,
  };
}

export function WatchTimerProvider({ children }: { children: React.ReactNode }) {
  const addTimer = useStudyStore((state) => state.addTimer);
  const updateSession = useStudyStore((state) => state.updateSession);
  const [timers, setTimers] = useState<Record<string, TimerState>>({});
  const [now, setNow] = useState(() => Date.now());
  const hasRunningTimer = Object.values(timers).some((timer) => timer.startedAt !== null);

  useEffect(() => {
    if (!hasRunningTimer) return;
    const interval = window.setInterval(() => {
      const currentNow = Date.now();
      setNow(currentNow);
      setTimers((current) => Object.fromEntries(Object.entries(current).map(([sessionId, timer]) => {
        const done = timer.mode === "countdown" && timer.startedAt && liveElapsed(timer, currentNow) >= timer.durationSeconds;
        return [sessionId, done ? { ...timer, elapsedSeconds: timer.durationSeconds, startedAt: null } : timer];
      })));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [hasRunningTimer]);

  const value = useMemo<WatchTimerValue>(() => ({
    timerFor: (sessionId) => snapshot(timers[sessionId], now),
    toggle: (sessionId) => {
      const currentNow = Date.now();
      setNow(currentNow);
      setTimers((current) => {
        const timer = current[sessionId] ?? defaultTimer();
        const currentSnapshot = snapshot(timer, currentNow);
        if (timer.startedAt) return { ...current, [sessionId]: { ...timer, elapsedSeconds: currentSnapshot.elapsedSeconds, startedAt: null } };
        if (currentSnapshot.completed) return { ...current, [sessionId]: { ...timer, elapsedSeconds: 0, startedAt: currentNow } };
        return { ...current, [sessionId]: { ...timer, startedAt: currentNow } };
      });
    },
    reset: (sessionId) => setTimers((current) => ({ ...current, [sessionId]: { ...(current[sessionId] ?? defaultTimer()), elapsedSeconds: 0, startedAt: null } })),
    setMode: (sessionId, mode) => setTimers((current) => ({ ...current, [sessionId]: { ...(current[sessionId] ?? defaultTimer()), mode, elapsedSeconds: 0, startedAt: null } })),
    setCountdownDuration: (sessionId, durationSeconds) => setTimers((current) => ({ ...current, [sessionId]: { ...(current[sessionId] ?? defaultTimer()), mode: "countdown", durationSeconds: Math.max(60, durationSeconds), elapsedSeconds: 0, startedAt: null } })),
    pin: (sessionId, sessionName, sessionStudySeconds) => {
      const active = snapshot(timers[sessionId], Date.now());
      const studiedSeconds = active.mode === "countdown" ? active.elapsedSeconds : active.seconds;
      if (!studiedSeconds) return;
      addTimer({ sessionId, sessionName, seconds: studiedSeconds });
      updateSession(sessionId, { studySeconds: sessionStudySeconds + studiedSeconds });
      setTimers((current) => ({ ...current, [sessionId]: { ...(current[sessionId] ?? defaultTimer()), elapsedSeconds: 0, startedAt: null } }));
    },
  }), [addTimer, now, timers, updateSession]);

  return <WatchTimerContext.Provider value={value}>{children}</WatchTimerContext.Provider>;
}

export function useWatchTimer() {
  const value = useContext(WatchTimerContext);
  if (!value) throw new Error("useWatchTimer must be used inside WatchTimerProvider");
  return value;
}
