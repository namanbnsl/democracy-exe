"use client";

import { useEffect, useState } from "react";
import { AttractScreen } from "@/components/attract-screen";
import { ElectionExperience } from "@/components/election-experience";
import { Button } from "@/components/ui/button";

const idleMs = 2 * 60 * 1000;
// A visitor who is only reading gets this long to say they are still there.
const warnMs = 20 * 1000;

// Shows the attract screen on load and after a quiet spell, then hands the next visitor a fresh election.
export function Kiosk() {
  const [idle, setIdle] = useState(true);
  const [session, setSession] = useState(0);
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    if (idle) return;
    let warnTimer = 0, tick = 0;
    const wake = () => {
      window.clearTimeout(warnTimer); window.clearInterval(tick);
      setLeft(null);
      warnTimer = window.setTimeout(() => {
        const end = Date.now() + warnMs;
        setLeft(warnMs / 1000);
        tick = window.setInterval(() => {
          const seconds = Math.ceil((end - Date.now()) / 1000);
          if (seconds > 0) { setLeft(seconds); return; }
          window.clearInterval(tick);
          setLeft(null); setIdle(true); setSession(s => s + 1);
        }, 250);
      }, idleMs - warnMs);
    };
    // Pointer movement alone counts, so someone reading with a hand on the mouse is never cut off.
    const events = ["pointerdown", "pointermove", "keydown", "wheel", "scroll", "touchstart"] as const;
    events.forEach(e => window.addEventListener(e, wake, { passive: true, capture: true }));
    wake();
    return () => { window.clearTimeout(warnTimer); window.clearInterval(tick); events.forEach(e => window.removeEventListener(e, wake, { capture: true })); };
  }, [idle]);

  return <>
    <div inert={idle}><ElectionExperience key={session} /></div>
    {left !== null && <div className="idle-warning" role="alertdialog" aria-live="assertive" aria-label="Still there?">
      <p><strong>Still there?</strong> Starting over for the next visitor in {left}s.</p>
      <Button size="lg">Keep going</Button>
    </div>}
    {idle && <AttractScreen onStart={() => setIdle(false)} />}
  </>;
}
