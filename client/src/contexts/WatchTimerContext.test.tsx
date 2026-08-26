// @vitest-environment jsdom
import React from "react";
import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/store/useStudyStore", () => {
  const state = { addTimer: vi.fn(), updateSession: vi.fn() };
  const useStudyStore = Object.assign((selector?: (value: typeof state) => unknown) => selector ? selector(state) : state, { getState: () => state });
  return { useStudyStore };
});

import { WatchTimerProvider, useWatchTimer } from "./WatchTimerContext";

function TimerPanel({ visible }: { visible: boolean }) {
  const timer = useWatchTimer();
  if (!visible) return null;
  return <button type="button" onClick={() => timer.toggle("session-a")}>Start timer</button>;
}

function TimerStatus() {
  const timer = useWatchTimer().timerFor("session-a");
  return <p>{`${timer.mode}:${timer.seconds}:${timer.running ? "running" : "paused"}`}</p>;
}

function CountdownPanel({ visible }: { visible: boolean }) {
  const timer = useWatchTimer();
  if (!visible) return null;
  return <><button type="button" onClick={() => timer.setCountdownDuration("session-a", 60)}>Set one minute</button><button type="button" onClick={() => timer.toggle("session-a")}>Start countdown</button></>;
}

describe("Watch timer provider", () => {
  afterEach(() => vi.useRealTimers());

  it("continues counting when the Watch panel unmounts", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-26T18:00:00Z"));
    const ui = render(<WatchTimerProvider><TimerPanel visible /><TimerStatus /></WatchTimerProvider>);
    fireEvent.click(ui.getByRole("button", { name: "Start timer" }));

    act(() => vi.advanceTimersByTime(2_000));
    expect(ui.getByText("stopwatch:2:running")).toBeTruthy();

    ui.rerender(<WatchTimerProvider><TimerPanel visible={false} /><TimerStatus /></WatchTimerProvider>);
    act(() => vi.advanceTimersByTime(3_000));

    expect(ui.getByText("stopwatch:5:running")).toBeTruthy();
  });

  it("counts down after Watch closes and stops at zero", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-26T18:00:00Z"));
    const ui = render(<WatchTimerProvider><CountdownPanel visible /><TimerStatus /></WatchTimerProvider>);
    fireEvent.click(ui.getByRole("button", { name: "Set one minute" }));
    fireEvent.click(ui.getByRole("button", { name: "Start countdown" }));

    act(() => vi.advanceTimersByTime(20_000));
    expect(ui.getByText("countdown:40:running")).toBeTruthy();

    ui.rerender(<WatchTimerProvider><CountdownPanel visible={false} /><TimerStatus /></WatchTimerProvider>);
    act(() => vi.advanceTimersByTime(40_000));
    expect(ui.getByText("countdown:0:paused")).toBeTruthy();
  });
});
