"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent } from "react";
import { ArrowRight, ChevronDown, Dices, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AnimatedNumber, CandidateName } from "@/components/election-visuals";
import { Portrait, StudentPortrait } from "@/components/portrait";
import { aiStudentPool, explainElection, judge, makeSchool, orders, type AiStudent, type School, type SimulatedElection, type VoterModel } from "@/lib/simulation";
import { candidateIds, nameOf, scenarios, type CandidateId, type Counts } from "@/lib/elections";
import "./simulation-lab.css";

export const SIMULATED_ELECTIONS = 1000;
export const SIMULATED_VOTERS = scenarios.original.groups.reduce((sum, group) => sum + group.count, 0);
const BATCH = 25;
const MIN_STUDENTS = 3;
const MAX_STUDENTS = 1000;
type Phase = "ready" | "running" | "done";

const shade = (election: SimulatedElection) => election.tie ? "tie" : String(election.sameWinner);
const changedWinner = (election: SimulatedElection) => !election.tie && !election.sameWinner;
const colour = (id: CandidateId) => `var(--candidate-${id.toLowerCase()})`;
const single = (winners: CandidateId[]) => winners.length === 1 ? winners[0] : null;

// Tiny hash so each student keeps the same height on the line.
const jitter = (i: number) => ((i * 2654435761) >>> 0) / 4294967296;

// Pictures are drawn on a 560-wide canvas, short enough that the playground fits one screen.
// Tall screens (a vertical display) have room for taller pictures.
const W = 560;
const tallScreen = "(orientation: portrait) and (min-width: 700px)";
function useTallScreen() {
  return useSyncExternalStore(changed => {
    const query = window.matchMedia(tallScreen);
    query.addEventListener("change", changed);
    return () => query.removeEventListener("change", changed);
  }, () => window.matchMedia(tallScreen).matches, () => false);
}

// A student is dimmed when another ballot order or another first choice is being pointed at.
const dimmed = (order: number, hovered: number | null, first: CandidateId | null) => (hovered !== null && hovered !== order) || (first !== null && first !== orders[order][0]);

// The ballot of the student under the pointer, placed over their dot.
function Tip({ order, x, y, w, h }: { order: number; x: number; y: number; w: number; h: number }) {
  return <div className="pg-tip" style={{ left: `${x / w * 100}%`, top: `${y / h * 100}%` }} data-below={y / h < .25} aria-hidden="true">
    <span className="pg-order">{orders[order].map((id, rank) => <span key={id}>{rank > 0 && <ArrowRight />}<i style={{ background: colour(id) }} />{nameOf(id)}</span>)}</span>
  </div>;
}

function SchoolPicture({ school, model, hovered, first, picked, onPick, onMove }: { school: School; model: VoterModel; hovered: number | null; first: CandidateId | null; picked: number; onPick: (index: number) => void; onMove: (spots: Record<CandidateId, number>) => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<CandidateId | null>(null);
  const [tip, setTip] = useState<number | null>(null);
  const tall = useTallScreen();
  const H = tall ? 320 : 240;
  const n = school.students.length;

  if (model !== "spectrum") {
    // A block of dots, one per student, grouped by how they ranked the candidates.
    // AI students leave room under the dots for the student card.
    const ai = model === "ai", h = ai ? (tall ? 150 : 88) : H;
    const sorted = school.students.map((student, i) => ({ ...student, i })).sort((a, b) => a.order - b.order || a.i - b.i);
    const cell = Math.min(34, Math.sqrt(W * (h - 10) / n));
    const columns = Math.max(1, Math.floor(W / cell));
    const rows = Math.ceil(n / columns);
    const size = Math.min(W / columns, (h - 10) / rows, 34);
    const left = (W - columns * size) / 2;
    const place = new Map(sorted.map((student, slot) => [student.i, slot]));
    const at = (i: number) => { const slot = place.get(i)!; return { x: left + (slot % columns + .5) * size, y: 5 + (Math.floor(slot / columns) + .5) * size }; };
    const tipAt = tip !== null && tip < n && !ai ? at(tip) : null;
    return <div className="pg-picture-wrap" onPointerLeave={() => setTip(null)}><svg viewBox={`0 0 ${W} ${h}`} className="pg-picture" role="img" aria-label={ai ? `${n} AI-imagined students, grouped by how they ranked the candidates.` : `${n} students, each ranking the candidates at random.`}>
      {school.students.map((student, i) => {
        const { x, y } = at(i);
        return <circle key={i} className="pg-dot" r={size * .36} style={{ transform: `translate(${x}px, ${y}px)`, fill: colour(orders[student.order][0]) }} data-dim={dimmed(student.order, hovered, first)}
          data-picked={ai && picked === i} onPointerEnter={() => ai ? onPick(i) : setTip(i)} />;
      })}
    </svg>{tipAt && <Tip order={school.students[tip!].order} x={tipAt.x} y={tipAt.y} w={W} h={h} />}</div>;
  }

  const spots = school.spots!;
  const pad = 22, line = tall ? 256 : 196;
  const x = (position: number) => pad + position * (W - 2 * pad);
  // Stack names in rows when candidates stand close together.
  const rows: Partial<Record<CandidateId, number>> = {};
  const ends = [-Infinity, -Infinity, -Infinity];
  for (const id of [...candidateIds].sort((a, b) => spots[a] - spots[b])) {
    const row = ends.findIndex(end => x(spots[id]) - end >= 58);
    rows[id] = row < 0 ? 2 : row;
    ends[rows[id]!] = x(spots[id]);
  }
  function positionAt(clientX: number) {
    const box = svg.current!.getBoundingClientRect();
    const sx = (clientX - box.left) / box.width * W;
    return Math.max(0, Math.min(1, (sx - pad) / (W - 2 * pad)));
  }
  function down(event: PointerEvent<SVGGElement>, id: CandidateId) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(id);
  }
  function move(event: PointerEvent<SVGGElement>, id: CandidateId) {
    if (dragging === id) onMove({ ...spots, [id]: positionAt(event.clientX) });
  }
  function key(event: KeyboardEvent<SVGGElement>, id: CandidateId) {
    const step = { ArrowLeft: -.02, ArrowRight: .02, ArrowDown: -.02, ArrowUp: .02, PageDown: -.1, PageUp: .1 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    onMove({ ...spots, [id]: Math.max(0, Math.min(1, spots[id] + step)) });
  }
  const height = line + 40 + Math.max(...Object.values(rows) as number[]) * 18;
  const y = (i: number) => 12 + jitter(i) * (line - 30);
  return <div className="pg-picture-wrap" onPointerLeave={() => setTip(null)}><svg ref={svg} viewBox={`0 0 ${W} ${height}`} className="pg-picture" data-dragging={!!dragging} aria-label={`${n} students on a line from sports and fun to studies and exams.`}>
    <line x1={pad} x2={W - pad} y1={line} y2={line} className="pg-line" />
    {school.students.map((student, i) => <circle key={i} className="pg-dot" r={n > 400 ? 2.6 : n > 120 ? 3.4 : 4.6} style={{ transform: `translate(${x(student.position!)}px, ${y(i)}px)`, fill: colour(orders[student.order][0]) }} data-dim={dimmed(student.order, hovered, first)} onPointerEnter={() => !dragging && setTip(i)} />)}
    {candidateIds.map(id => <g key={id} className="pg-handle" data-active={dragging === id} role="slider" tabIndex={0} aria-label={`Move ${nameOf(id)}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(spots[id] * 100)} aria-valuetext={`${nameOf(id)} is ${Math.round(spots[id] * 100)}% of the way to studies and exams`}
      onPointerDown={event => down(event, id)} onPointerMove={event => move(event, id)} onPointerUp={() => setDragging(null)} onPointerCancel={() => setDragging(null)} onKeyDown={event => key(event, id)}
      style={{ transform: `translateX(${x(spots[id])}px)` }}>
      <line x1="0" x2="0" y1={line} y2={line + 14 + rows[id]! * 18} className="pg-handle-stem" />
      <circle cy={line} r="26" className="pg-handle-hit" />
      <circle cy={line} r="13" fill={colour(id)} className="pg-handle-knob" />
      <text y={line + 4.5} textAnchor="middle" className="pg-handle-letter">{nameOf(id)[0]}</text>
      <text y={line + 30 + rows[id]! * 18} textAnchor="middle" className="pg-handle-name">{nameOf(id)}</text>
    </g>)}
  </svg>{tip !== null && tip < n && !dragging && <Tip order={school.students[tip].order} x={x(school.students[tip].position!)} y={y(tip)} w={W} h={height} />}</div>;
}

// Dot colour is the student's first choice. Pointing at a colour picks out those students.
function Key({ school, first, onFirst }: { school: School; first: CandidateId | null; onFirst: (id: CandidateId | null) => void }) {
  const counts = Object.fromEntries(candidateIds.map(id => [id, school.groups.filter(group => group.ranking[0] === id).reduce((sum, group) => sum + group.count, 0)]));
  return <div className="pg-key" onMouseLeave={() => onFirst(null)}>
    <span>Dot colour = first choice</span>
    <ul>{candidateIds.map(id => <li key={id} tabIndex={0} data-active={first === id} onMouseEnter={() => onFirst(id)} onFocus={() => onFirst(id)} onBlur={() => onFirst(null)}>
      <i style={{ background: colour(id) }} />{nameOf(id)}<b><AnimatedNumber value={counts[id]} duration={250} /></b>
    </li>)}</ul>
  </div>;
}

// One AI student: who they are, how they ranked the candidates, and why.
function StudentCard({ student }: { student: AiStudent }) {
  const order = orders[student.order];
  return <figure className="pg-student" aria-live="polite">
    <span className="pg-student-face"><StudentPortrait name={student.name} /></span>
    <figcaption><strong>{student.name}</strong><span className="pg-order" aria-label={order.map(nameOf).join(", then ")}>{order.map((id, rank) => <span key={id}>{rank > 0 && <ArrowRight aria-hidden="true" />}<i style={{ background: colour(id) }} />{nameOf(id)}</span>)}</span></figcaption>
    <span className="pg-profile">{student.profile}</span>
    <blockquote>“{student.reason}”</blockquote>
  </figure>;
}

function OrderList({ school, hovered, onHover }: { school: School; hovered: number | null; onHover: (order: number | null) => void }) {
  const counts = orders.map((_, i) => school.groups.find(group => group.ranking.join() === orders[i].join())?.count ?? 0);
  return <ul className="pg-orders" aria-label="How the students ranked the candidates" onMouseLeave={() => onHover(null)}>
    {orders.map((order, i) => <li key={i} data-empty={counts[i] === 0} data-hovered={hovered === i} onMouseEnter={() => onHover(i)} onFocus={() => onHover(i)} onBlur={() => onHover(null)} tabIndex={0}>
      <strong><AnimatedNumber value={counts[i]} duration={250} /></strong>
      <span className="pg-order" aria-label={order.map(nameOf).join(", then ")}>{order.map((id, rank) => <span key={id}>{rank > 0 && <ArrowRight aria-hidden="true" />}<i style={{ background: colour(id) }} />{nameOf(id)}</span>)}</span>
    </li>)}
  </ul>;
}

function Numbers({ counts, ids, winner }: { counts: Counts; ids: CandidateId[]; winner: CandidateId | null }) {
  return <span className="pg-numbers">{[...ids].sort((a, b) => counts[b] - counts[a]).map(id => <span key={id} data-winner={id === winner}><i style={{ background: colour(id) }} />{nameOf(id)} <b><AnimatedNumber value={counts[id]} duration={300} /></b></span>)}</span>;
}

function Winner({ winners }: { winners: CandidateId[] }) {
  const id = single(winners);
  return <span className="pg-winner" key={winners.join()}>{id ? <><span className="mini-portrait"><Portrait id={id} small /></span>{nameOf(id)}</> : <span className="pg-tie">Tie</span>}</span>;
}

// Shows only the winner until opened; the numbers and working sit underneath.
function Method({ name, rule, winners, summary, working }: { name: string; rule: string; winners: CandidateId[]; summary: React.ReactNode; working: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <li className="pg-method" data-open={open}>
    <button type="button" className="pg-method-head" aria-expanded={open} onClick={() => setOpen(!open)}>
      <span className="pg-method-name">{name}<ChevronDown aria-hidden="true" /></span>
      <Winner winners={winners} />
    </button>
    <div className="pg-working" hidden={!open}><p className="pg-rule">{rule}</p><div className="pg-method-summary">{summary}</div>{working}</div>
  </li>;
}

function Methods({ school, election }: { school: School; election: SimulatedElection }) {
  const working = explainElection(school.groups);
  const rounds = working.runoff.rounds;
  const total = working.firstChoices.total;
  const verdict = election.tie ? "One of the methods ends in a tie." : election.sameWinner ? `All three pick ${nameOf(election.winners.plurality[0])}.` : "Same ballots, different winners.";
  return <div className="pg-results">
    <p className="pg-verdict" data-same={shade(election)} aria-live="polite"><i aria-hidden="true" />{verdict}</p>
    <ul className="pg-methods">
      <Method name="One name each" rule="Only first choices count. Most votes wins." winners={working.firstChoices.winners}
        summary={<Numbers counts={working.firstChoices.counts} ids={[...candidateIds]} winner={single(working.firstChoices.winners)} />}
        working={null} />
      <Method name="Instant runoff" rule="Knock out whoever is last and move their votes to each ballot’s next choice, until someone has more than half." winners={working.runoff.winners}
        summary={working.runoff.eliminationTie.length ? <span className="pg-note">{working.runoff.eliminationTie.map(nameOf).join(" and ")} tie for last</span> : null}
        working={<ol className="pg-rounds">{rounds.map((round, i) => <li key={i}>
          <span className="pg-round-label">{i === 0 ? "First choices" : "After moving votes"}</span>
          <Numbers counts={round.counts} ids={round.active} winner={!round.eliminated ? single(round.winners) : null} />
          {round.eliminated && round.transfers && <span className="pg-note">{nameOf(round.eliminated)}’s {round.counts[round.eliminated]} votes move: {round.active.filter(id => id !== round.eliminated).map(id => `+${round.transfers![id]} ${nameOf(id)}`).join(", ")}</span>}
          {!round.eliminated && single(round.winners) && <span className="pg-note">{nameOf(single(round.winners)!)} has more than half of {total}.</span>}
        </li>)}</ol>} />
      <Method name="Points" rule="1st choice gets 2 points, 2nd choice gets 1." winners={working.points.winners}
        summary={null}
        working={<ul className="pg-sums">{[...candidateIds].sort((a, b) => working.points.counts[b] - working.points.counts[a]).map(id => <li key={id}><CandidateName id={id} /><span>{(working.points.counts[id] - working.secondChoices[id]) / 2} × 2 + {working.secondChoices[id]} × 1 = <b>{working.points.counts[id]}</b></span></li>)}</ul>} />
    </ul>
  </div>;
}

function ResultsGrid({ runs, loaded, onSelect, disabled }: { runs: SimulatedElection[]; loaded: number | null; onSelect: (index: number) => void; disabled: boolean }) {
  const [focused, setFocused] = useState(0);
  const grid = useRef<HTMLDivElement>(null);
  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const columns = Number(getComputedStyle(grid.current!).getPropertyValue("--pg-columns"));
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns, Home: -index, End: runs.length - 1 - index };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const next = Math.max(0, Math.min(runs.length - 1, index + moves[event.key]));
    setFocused(next);
    grid.current?.querySelector<HTMLButtonElement>(`[data-school="${next}"]`)?.focus();
  }
  return <div ref={grid} className="pg-grid" aria-label="1,000 schools. Use arrow keys to move and Enter to open one.">
    {Array.from({ length: SIMULATED_ELECTIONS }, (_, index) => {
      const run = runs[index];
      const label = run ? `School ${index + 1}: ${run.tie ? "a tie" : run.sameWinner ? "same winner" : "different winners"}` : `School ${index + 1}: not counted yet`;
      return <button key={index} type="button" data-school={index} data-same={run ? shade(run) : "empty"} data-loaded={loaded === index} disabled={!run || disabled} tabIndex={index === focused && !disabled ? 0 : -1} aria-label={label} title={label} onFocus={() => setFocused(index)} onKeyDown={event => move(event, index)} onClick={() => onSelect(index)} />;
    })}
  </div>;
}

export function SimulationLab({ model, onModelChange }: { model: VoterModel; onModelChange: (model: VoterModel) => void }) {
  const kind = model;
  const [size, setSize] = useState(SIMULATED_VOTERS);
  // A fixed first seed keeps the server render and hydration identical.
  const [seed, setSeed] = useState(42);
  const [spots, setSpots] = useState<Record<CandidateId, number> | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [first, setFirst] = useState<CandidateId | null>(null);
  const [picked, setPicked] = useState(0);
  const [phase, setPhase] = useState<Phase>("ready");
  const [runs, setRuns] = useState<SimulatedElection[]>([]);
  const [runSeed, setRunSeed] = useState(0);
  const [loaded, setLoaded] = useState<number | null>(null);
  const frame = useRef<number | null>(null);
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);

  const school = useMemo(() => makeSchool(seed, size, kind, spots ?? undefined), [seed, size, kind, spots]);
  const election = useMemo(() => judge(school.groups), [school]);
  const student = Math.min(picked, school.students.length - 1);
  const [showBallots, setShowBallots] = useState(false);
  const [view, setView] = useState<"one" | "many">("one");

  function stop() { if (frame.current !== null) cancelAnimationFrame(frame.current); frame.current = null; }
  function clearRuns() { stop(); setRuns([]); setPhase("ready"); setLoaded(null); }
  function shuffle() { setSeed(Date.now() >>> 0); setSpots(null); setLoaded(null); }
  function changeModel(value: string) {
    if (!value || value === kind) return;
    onModelChange(value as VoterModel);
    setSpots(null); clearRuns();
  }
  function changeSize(value: number) { setSize(value); clearRuns(); }
  function start() {
    stop();
    const base = Date.now() >>> 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const all: SimulatedElection[] = [];
    setRunSeed(base); setLoaded(null); setRuns([]); setPhase("running");
    const tick = () => {
      for (let i = 0; i < (reduced ? SIMULATED_ELECTIONS : BATCH) && all.length < SIMULATED_ELECTIONS; i++) all.push(judge(makeSchool(base + all.length, size, kind).groups));
      setRuns([...all]);
      if (all.length < SIMULATED_ELECTIONS) frame.current = requestAnimationFrame(tick);
      else {
        frame.current = null; setPhase("done");
      }
    };
    frame.current = requestAnimationFrame(tick);
  }
  function open(index: number) {
    setSeed((runSeed + index) >>> 0); setSpots(null); setLoaded(index); setView("one");
  }

  const changed = runs.filter(changedWinner).length;
  const ties = runs.filter(run => run.tie).length;
  const percent = (count: number) => `${(100 * count / Math.max(1, runs.length)).toFixed(1)}%`;

  return <div className="playground">
    <div className="pg-controls">
      <ToggleGroup type="single" variant="outline" spacing={0} value={view} onValueChange={value => value && setView(value as "one" | "many")} className="pg-view" aria-label="View">
        <ToggleGroupItem value="one">One school</ToggleGroupItem>
        <ToggleGroupItem value="many">1,000 schools</ToggleGroupItem>
      </ToggleGroup>
      <label className="pg-size"><span>Students</span>
        <input type="range" min={MIN_STUDENTS} max={MAX_STUDENTS} value={size} disabled={phase === "running"} onChange={event => changeSize(Number(event.target.value))} aria-valuetext={`${size} students`} style={{ "--fill": `${(size - MIN_STUDENTS) / (MAX_STUDENTS - MIN_STUDENTS) * 100}%` } as React.CSSProperties} />
        <output>{size.toLocaleString()}</output>
      </label>
      <ToggleGroup type="single" variant="outline" spacing={0} value={kind} onValueChange={changeModel} disabled={phase === "running"} className="pg-model" aria-label="How students choose">
        <ToggleGroupItem value="random">Random</ToggleGroupItem>
        <ToggleGroupItem value="spectrum">On a line</ToggleGroupItem>
        <ToggleGroupItem value="ai">AI students</ToggleGroupItem>
      </ToggleGroup>
    </div>

    {view === "one" ? <div className="pg-board" key="one">
      <section className="pg-school" aria-label="The school">
        <div className="pg-head"><h3>{loaded !== null ? `School ${loaded + 1} of 1,000` : "Your school"}</h3>
          <div className="pg-head-actions">
            <button type="button" className="pg-link" aria-pressed={showBallots} onClick={() => setShowBallots(!showBallots)}>{showBallots ? "See students" : "See ballots"}</button>
            <Button variant="outline" size="sm" onClick={shuffle}><Dices data-icon="inline-start" />New students</Button>
          </div>
        </div>
        {showBallots ? <OrderList school={school} hovered={hovered} onHover={setHovered} /> : <>
          <SchoolPicture school={school} model={kind} hovered={hovered} first={first} picked={student} onPick={setPicked} onMove={next => { setSpots(next); setLoaded(null); }} />
          {kind === "spectrum" && <div className="pg-axis"><span>Sports &amp; fun</span><span className="pg-hint">Drag the candidates</span><span>Studies &amp; exams</span></div>}
          <Key school={school} first={first} onFirst={setFirst} />
          {kind === "ai" && <>
            <StudentCard student={aiStudentPool[school.students[student].student!]} />
            <p className="pg-hint">Point at a dot to hear why. Imagined by an AI, not real students.</p>
          </>}
        </>}
      </section>
      <section className="pg-count" aria-label="Three ways to count">
        <div className="pg-head"><h3>Who wins?</h3></div>
        <Methods school={school} election={election} />
      </section>
    </div> : <section className="pg-thousand" key="many" aria-label="1,000 schools">
      <ResultsGrid runs={runs} loaded={loaded} disabled={phase !== "done"} onSelect={open} />
      <div className="pg-thousand-side">
        <p className="pg-big" aria-live="polite">{phase === "ready" ? <span className="pg-big-hint">Make 1,000 schools like yours and count each one three ways.</span>
          : <><strong><AnimatedNumber value={changed} duration={phase === "done" ? 700 : 120} /></strong><span>of {phase === "done" ? "1,000" : runs.length.toLocaleString()} schools picked different winners</span></>}</p>
        <ul className="pg-legend">
          <li><span data-same="false" />Different winners{runs.length > 0 && <b>{percent(changed)}</b>}</li>
          <li><span data-same="true" />Same winner{runs.length > 0 && <b>{percent(runs.length - changed - ties)}</b>}</li>
          <li><span data-same="tie" />Tie{runs.length > 0 && <b>{percent(ties)}</b>}</li>
        </ul>
        <Button size="lg" onClick={start} disabled={phase === "running"}>{phase === "done" ? <><RotateCcw data-icon="inline-start" />Run again</> : <><Play data-icon="inline-start" />Run 1,000 schools</>}</Button>
        {phase === "done" && <p className="pg-hint">Click a square to open that school.</p>}
      </div>
    </section>}
  </div>;
}
