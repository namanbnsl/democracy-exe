"use client";

import { useEffect, useRef, useState } from "react";
import { GeistPixelSquare } from "geist/font/pixel";
import "./attract-screen.css";

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function Ballot({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 30" shapeRendering="crispEdges" aria-hidden="true">
    <path d="M2 2h20v26H2z" fill="#fffdf6" stroke="#1d2a4d" strokeWidth="2" />
    <path d="M5 7h4v4H5z" fill="var(--candidate-a)" /><path d="M5 13h4v4H5z" fill="var(--candidate-b)" /><path d="M5 19h4v4H5z" fill="var(--candidate-c)" />
    <path d="M11 8h8v2h-8zM11 14h8v2h-8zM11 20h8v2h-8z" fill="#1d2a4d" />
  </svg>;
}

// Digital rain on paper. The giant wordmark is built on a fine grid of solid ink cells with a hard shadow in a
// candidate colour. Every second or two a colour wave sweeps the rain and recolours the shadow.
const rainChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+=<>*#%@$&".split("");
// A big arrow pointer that wanders the screen on its own, like a demo running itself.
function GhostCursor({ ref }: { ref: React.Ref<SVGSVGElement> }) {
  const arrow = "M1 1v16l4-4 3 6 3-1-3-6h5z";
  return <svg ref={ref} className="ghost-cursor" viewBox="0 0 16 22" shapeRendering="crispEdges" aria-hidden="true">
    <path d={arrow} transform="translate(2 2)" fill="var(--title)" />
    <path d={arrow} fill="#fffdf6" stroke="#1d2a4d" strokeWidth="1.5" strokeLinejoin="miter" />
  </svg>;
}

function MatrixField({ wordRef, cursorRef }: { wordRef: React.RefObject<HTMLHeadingElement | null>; cursorRef: React.RefObject<SVGSVGElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const css = getComputedStyle(canvas);
    const font = `700 ${css.getPropertyValue("--font-geist-mono").trim() || "monospace"}`;
    // The grid already pixelates the word, so it is cut from a heavy solid face that survives the grid.
    const heavy = `900 100px ${css.getPropertyValue("--font-geist-sans").trim() || "sans-serif"}`;
    const rgb = (v: string) => { const h = css.getPropertyValue(v).trim().replace("#", ""); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
    const palette = [rgb("--candidate-a"), rgb("--candidate-b"), rgb("--candidate-c")];
    const ink = [29, 42, 77];
    // The rain runs on a grid of C-pixel cells; the word uses its own grid of W-pixel cells, fine enough to read.
    let C = 16, W = 8, w = 0, h = 0, cols = 0, rows = 0, wcols = 0, wrows = 0;
    let word = new Uint8Array(0);
    let mask = new Uint8Array(0), glyphs = new Uint8Array(0), hue = new Uint8Array(0);
    let drops: { col: number; head: number; speed: number; len: number }[] = [];
    let wave = { x: 0, y: 0, born: -1e5, tint: palette[0] }, shadow = palette[0], nextWave = 1200;
    const born = performance.now();
    const pointer = { x: -1e4, y: -1e4 };
    // The ghost glides along a gentle curve to a random spot, rests a moment, then picks another.
    const ghost = { x: -1e4, y: -1e4, from: [0, 0], via: [0, 0], to: [0, 0], start: 0, dur: 0, rest: 0 };
    const ghostLeg = (now: number) => {
      const [x, y] = ghost.to;
      // Long sweeps: the farthest of a few random spots, so each leg crosses a good part of the screen.
      let to = [x, y];
      for (let i = 0; i < 6; i++) {
        const p = [w * (.08 + Math.random() * .84), h * (.1 + Math.random() * .8)];
        if (Math.hypot(p[0] - x, p[1] - y) > Math.hypot(to[0] - x, to[1] - y)) to = p;
      }
      const dist = Math.hypot(to[0] - x, to[1] - y);
      const bend = (Math.random() - .5) * dist * .6;
      const mx = (x + to[0]) / 2, my = (y + to[1]) / 2;
      Object.assign(ghost, { from: [x, y], to, via: [mx - (to[1] - y) / (dist || 1) * bend, my + (to[0] - x) / (dist || 1) * bend], start: now, dur: 600 + dist * 1.3, rest: 250 + Math.random() * 1400 });
    };
    const moveGhost = (now: number) => {
      if (!ghost.dur) { ghost.to = [w * .7, h * .75]; ghostLeg(now); }
      const t = Math.min(1, (now - ghost.start) / ghost.dur);
      const e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const q = (i: number) => (1 - e) * (1 - e) * ghost.from[i] + 2 * (1 - e) * e * ghost.via[i] + e * e * ghost.to[i];
      ghost.x = q(0); ghost.y = q(1);
      if (cursorRef.current) cursorRef.current.style.transform = `translate(${ghost.x}px, ${ghost.y}px)`;
      if (now - ghost.start > ghost.dur + ghost.rest) ghostLeg(now);
    };
    const newDrop = (col: number, first = false) => ({ col, head: first ? Math.random() * rows : -Math.random() * rows * .5, speed: 9 + Math.random() * 34, len: 6 + Math.floor(Math.random() * 30) });

    const buildMask = () => {
      mask = new Uint8Array(cols * rows);
      word = new Uint8Array(wcols * wrows);
      const box = wordRef.current?.getBoundingClientRect();
      if (!box || !box.width) return;
      const off = document.createElement("canvas");
      off.width = w; off.height = h;
      const o = off.getContext("2d", { willReadFrequently: true })!;
      // Stacked, so each letter can be far bigger.
      const lines = ["democracy", ".exe"];
      o.font = heavy;
      const m = o.measureText("democracy");
      const tall = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
      const lineGap = .25;
      const size = Math.min(box.height / (tall * (lines.length + lineGap * (lines.length - 1))), box.width / Math.max(...lines.map(l => o.measureText(l).width))) * 100;
      o.font = heavy.replace("100px", `${size}px`);
      const ascent = m.actualBoundingBoxAscent * size / 100, lineHeight = tall * size / 100 * (1 + lineGap);
      const blockHeight = lineHeight * lines.length - tall * size / 100 * lineGap;
      const left = box.left + (box.width - o.measureText(lines[0]).width) / 2;
      // Lines share a left edge, so ".exe" sits under the start of "democracy".
      lines.forEach((line, i) => o.fillText(line, left, box.top + (box.height - blockHeight) / 2 + ascent + i * lineHeight));
      const data = o.getImageData(0, 0, w, h).data;
      // A word cell is set when the letters cover at least a third of it; rain stays out of any cell it touches.
      for (let r = 0; r < wrows; r++) for (let c = 0; c < wcols; c++) {
        let hits = 0;
        for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) {
          const x = Math.min(w - 1, Math.floor(c * W + (sx + .5) * W / 3)), y = Math.min(h - 1, Math.floor(r * W + (sy + .5) * W / 3));
          if (data[(y * w + x) * 4 + 3] > 110) hits++;
        }
        if (hits < 3) continue;
        word[r * wcols + c] = 1;
        const rc = Math.floor(c * W / C), rr = Math.floor(r * W / C);
        if (rc < cols && rr < rows) mask[rr * cols + rc] = 1;
      }
    };
    const layout = () => {
      const dpr = window.devicePixelRatio || 1;
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      C = 2 * Math.round(Math.max(8, Math.min(14, Math.min(w, h) / 90)));
      W = Math.max(4, Math.round(C / 4));
      cols = Math.ceil(w / C); rows = Math.ceil(h / C);
      wcols = Math.ceil(w / W); wrows = Math.ceil(h / W);
      glyphs = Uint8Array.from({ length: cols * rows }, () => Math.floor(Math.random() * rainChars.length));
      hue = Uint8Array.from({ length: cols }, () => Math.floor(Math.random() * 4));
      drops = Array.from({ length: cols * 2 }, (_, i) => newDrop(i % cols, true));
      buildMask();
    };

    const move = (e: PointerEvent) => { pointer.x = e.clientX; pointer.y = e.clientY; };
    const leave = () => { pointer.x = pointer.y = -1e4; };
    const waveAt = (x: number, y: number, now: number) => {
      const t = now - wave.born - Math.hypot(x - wave.x, y - wave.y) / 2;
      return t > 0 && t < 1500 ? 1 - t / 1500 : 0;
    };
    const mix = (a: number[], b: number[], g: number) => a.map((v, i) => Math.round(v + (b[i] - v) * g));
    const fill = (c: number[], a: number) => { ctx.fillStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`; };

    const draw = (now: number, dt: number) => {
      const age = now - born;
      if (age > nextWave) {
        const tint = palette[(palette.indexOf(shadow) + 1) % 3];
        wave = { x: Math.random() * w, y: Math.random() * h, born: now, tint };
        shadow = tint;
        nextWave = age + 1400 + Math.random() * 1000;
      }
      moveGhost(now);
      ctx.clearRect(0, 0, w, h);
      ctx.font = font.replace("700 ", `700 ${C - 1}px `);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (let i = 0; i < cols * rows * .004; i++) glyphs[Math.floor(Math.random() * glyphs.length)] = Math.floor(Math.random() * rainChars.length);
      if (Math.random() < .002) hue[Math.floor(Math.random() * cols)] = Math.floor(Math.random() * 4);

      // Faint static field, so the whole screen reads as code.
      fill(ink, .13);
      for (let i = 0; i < cols * rows; i++) if (!mask[i]) ctx.fillText(rainChars[glyphs[i]], (i % cols) * C + C / 2, Math.floor(i / cols) * C + C / 2);

      for (let j = 0; j < drops.length; j++) {
        const d = drops[j];
        d.head += d.speed * dt / 1000;
        if (d.head - d.len > rows) drops[j] = newDrop(d.col);
        const top = Math.floor(d.head);
        const base = hue[d.col] === 3 ? ink : palette[hue[d.col]];
        for (let k = 0; k <= d.len; k++) {
          const r = top - k;
          if (r < 0 || r >= rows) continue;
          const i = r * cols + d.col;
          const a = k === 0 ? 1 : Math.pow(1 - k / d.len, .9);
          if (mask[i]) continue;
          const x = d.col * C + C / 2, y = r * C + C / 2;
          const near = Math.min(Math.hypot(x - pointer.x, y - pointer.y), Math.hypot(x - ghost.x, y - ghost.y));
          fill(k === 0 ? ink : mix(base, wave.tint, waveAt(x, y, now)), near < 180 ? Math.min(1, a * 2) : a);
          ctx.fillText(rainChars[glyphs[i]], x, y);
        }
      }

      // The wordmark: a hard shadow first, then solid ink.
      const o = Math.max(4, Math.round(W * 1.2));
      for (let pass = 0; pass < 2; pass++) {
        fill(pass ? ink : shadow, 1);
        for (let i = 0; i < word.length; i++) if (word[i]) ctx.fillRect((i % wcols) * W + (pass ? 0 : o), Math.floor(i / wcols) * W + (pass ? 0 : o), W, W);
      }
    };

    const still = reducedMotion();
    let raf = 0, last = performance.now();
    // Reduced motion shows one settled frame.
    const paint = () => draw(performance.now() + 1e4, 0);
    const frame = (now: number) => {
      draw(now, Math.min(now - last, 50));
      last = now;
      raf = requestAnimationFrame(frame);
    };
    layout();
    document.fonts.ready.then(() => { buildMask(); if (still) paint(); });
    if (still) paint(); else raf = requestAnimationFrame(frame);
    const resize = () => { layout(); if (still) paint(); };
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerleave", leave);
    };
  }, [wordRef, cursorRef]);
  return <canvas ref={canvasRef} className="voter-field" aria-hidden="true" />;
}

export function AttractScreen({ onStart }: { onStart: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const zoomRef = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLHeadingElement>(null);
  const cursorRef = useRef<SVGSVGElement>(null);

  // Windows-style "maximise": an outline grows from the button to fill the screen.
  function start(box: DOMRect) {
    if (leaving) return;
    setLeaving(true);
    if (reducedMotion()) { onStart(); return; }
    const rect = (r: { left: number; top: number; width: number; height: number }) => ({ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    zoomRef.current?.animate([rect(box), rect({ left: 0, top: 0, width: window.innerWidth, height: window.innerHeight })], { duration: 420, easing: "cubic-bezier(.5, 0, .2, 1)", fill: "forwards" });
    window.setTimeout(onStart, 640);
  }

  return <div className={`attract ${GeistPixelSquare.variable}`} data-leaving={leaving} role="dialog" aria-modal="true" aria-label="democracy.exe">
    <MatrixField wordRef={wordRef} cursorRef={cursorRef} />
    <main className="attract-main">
      <h1 ref={wordRef} className="attract-word">democracy.exe</h1>
      <button type="button" className="attract-run" onClick={e => start(e.currentTarget.getBoundingClientRect())}>
        <Ballot className="run-ballot" />
        Cast your vote
        <span className="run-arrow" aria-hidden="true">→</span>
      </button>
    </main>
    <GhostCursor ref={cursorRef} />
    <div ref={zoomRef} className="attract-zoom" aria-hidden="true" />
  </div>;
}
