import { useStudyStore } from "@/store/useStudyStore";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type TimerState = { accumulatedSeconds: number; startedAt: number | null };
type WatchTimerValue = {
  timerFor: (sessionId: string) => { seconds: number; running: boolean };
  toggle: (sessionId: string) => void;
  reset: (sessionId: string) => void;
  pin: (sessionId: string, sessionName: string, sessionStudySeconds: number) => void;
};

const WatchTimerContext = createContext<WatchTimerValue | null>(null);

function elapsedSeconds(timer: TimerState | undefined, now: number) {
  if (!timer) return 0;
  return timer.accumulatedSeconds + (timer.startedAt ? Math.floor((now - timer.startedAt) / 1000) : 0);
}

export function WatchTimerProvider({ children }: { children: React.ReactNode }) {
  const addTimer = useStudyStore((state) => state.addTimer);
  const updateSession = useStudyStore((state) => state.updateSession);
  const [timers, setTimers] = useState<Record<string, TimerState>>({});
  const [now, setNow] = useState(() => Date.now());
  const hasRunningTimer = Object.values(timers).some((timer) => timer.startedAt !== null);

  useEffect(() => {
    if (!hasRunningTimer) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [hasRunningTimer]);

  const value = useMemo<WatchTimerValue>(() => ({
    timerFor: (sessionId) => {
      const timer = timers[sessionId];
      return { seconds: elapsedSeconds(timer, now), running: !!timer?.startedAt };
    },
    toggle: (sessionId) => {
      const currentNow = Date.now();
      setNow(currentNow);
      setTimers((current) => {
        const timer = current[sessionId] ?? { accumulatedSeconds: 0, startedAt: null };
        if (timer.startedAt) return { ...current, [sessionId]: { accumulatedSeconds: elapsedSeconds(timer, currentNow), startedAt: null } };
        return { ...current, [sessionId]: { ...timer, startedAt: currentNow } };
      });
    },
    reset: (sessionId) => setTimers((current) => ({ ...current, [sessionId]: { accumulatedSeconds: 0, startedAt: null } })),
    pin: (sessionId, sessionName, sessionStudySeconds) => {
      const seconds = elapsedSeconds(timers[sessionId], Date.now());
      if (!seconds) return;
      addTimer({ sessionId, sessionName, seconds });
      updateSession(sessionId, { studySeconds: sessionStudySeconds + seconds });
      setTimers((current) => ({ ...current, [sessionId]: { accumulatedSeconds: 0, startedAt: null } }));
    },
  }), [addTimer, now, timers, updateSession]);

  return <WatchTimerContext.Provider value={value}>{children}</WatchTimerContext.Provider>;
}

export function useWatchTimer() {
  const value = useContext(WatchTimerContext);
  if (!value) throw new Error("useWatchTimer must be used inside WatchTimerProvider");
  return value;
}
