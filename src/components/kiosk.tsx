"use client";

import { useEffect, useState } from "react";
import { AttractScreen } from "@/components/attract-screen";
import { ElectionExperience } from "@/components/election-experience";

const idleMs = 2 * 60 * 1000;

// Shows the attract screen on load and after a quiet spell, then hands the next visitor a fresh election.
export function Kiosk() {
  const [idle, setIdle] = useState(true);
  const [session, setSession] = useState(0);

  useEffect(() => {
    if (idle) return;
    let timer = 0;
    const wake = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { setIdle(true); setSession(s => s + 1); }, idleMs);
    };
    const events = ["pointerdown", "pointermove", "keydown", "wheel", "scroll", "touchstart"] as const;
    events.forEach(e => window.addEventListener(e, wake, { passive: true, capture: true }));
    wake();
    return () => { window.clearTimeout(timer); events.forEach(e => window.removeEventListener(e, wake, { capture: true })); };
  }, [idle]);

  return <>
    <div inert={idle}><ElectionExperience key={session} /></div>
    {idle && <AttractScreen onStart={() => setIdle(false)} />}
  </>;
}
