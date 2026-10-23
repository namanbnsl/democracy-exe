"use client";

import { useEffect, useRef, useState } from "react";
import { Dices, Play, RotateCcw, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CandidateName, Ranking } from "@/components/election-visuals";
import { generateClass, judge, randomClass, seededRandom, type ClassDetail, type SimulatedElection, type VoterModel } from "@/lib/simulation";
import { candidateIds, nameOf, scenarios, type CandidateId } from "@/lib/elections";

export const SIMULATED_ELECTIONS = 1000;
// Each made-up school is the same size as the real election.
export const SIMULATED_VOTERS = scenarios.original.groups.reduce((sum, g) => sum + g.count, 0);
const COLUMNS = 40, CELL = 12, BATCH = 40;

// The AI students model stays in the library but is not offered here for now.
export type SchoolModel = Exclude<VoterModel, "ai">;
const models: Record<SchoolModel, { name: string; detail: string }> = {
  random: { name: "Random students", detail: "Every student ranks the three candidates in a completely random order." },
  spectrum: { name: "Students on a line", detail: "Students and candidates stand on a line from sports to studies. Each student ranks the closest candidate first." },
};
const methods = [
  { key: "plurality", name: "One name each", how: "Most first choices wins" },
  { key: "runoff", name: "Instant runoff", how: "Knock out last place, move their votes" },
  { key: "borda", name: "Points (Borda)", how: "2 points for 1st, 1 for 2nd" },
] as const;
const steps = ["Make up a school", "Count it three ways", "Repeat 1,000 times"];

type SimulationPhase = "pick" | "sample" | "running" | "done";

function Winner({ ids }: { ids: CandidateId[] }) {
  return ids.length === 1 ? <CandidateName id={ids[0]} portrait /> : <span className="fine-print">A tie</span>;
}

// Small pictures that explain each kind of school at a glance.
function ModelPicture({ model }: { model: SchoolModel }) {
  if (model === "random") return <svg viewBox="0 0 120 40" className="model-picture" aria-hidden="true">
    {Array.from({ length: 24 }, (_, i) => <circle key={i} cx={8 + (i % 12) * 9.5} cy={i < 12 ? 12 : 28} r="3.4" fill={`var(--candidate-${"abc"[(i * 7 + (i >> 2)) % 3]})`} />)}
  </svg>;
  const spots = [{ x: 30, id: "a" }, { x: 62, id: "b" }, { x: 96, id: "c" }];
  return <svg viewBox="0 0 120 40" className="model-picture" aria-hidden="true">
    <line x1="4" x2="116" y1="28" y2="28" className="spectrum-line" />
    {Array.from({ length: 22 }, (_, i) => { const x = 6 + i * 5.1; const near = spots.reduce((b, s) => Math.abs(s.x - x) < Math.abs(b.x - x) ? s : b); return <circle key={i} cx={x} cy={i % 2 ? 10 : 16} r="2.4" fill={`var(--candidate-${near.id})`} />; })}
    {spots.map(s => <circle key={s.id} cx={s.x} cy="28" r="5" fill={`var(--candidate-${s.id})`} stroke="var(--card)" strokeWidth="1.5" />)}
  </svg>;
}

// Each student is a dot coloured by their favourite: the nearest candidate.
function SpectrumPicture({ spots, students }: { spots: Record<CandidateId, number>; students: number[] }) {
  const x = (p: number) => 16 + p * 448;
  const nearest = (p: number) => candidateIds.reduce((best, id) => Math.abs(spots[id] - p) < Math.abs(spots[best] - p) ? id : best, candidateIds[0]);
  // Close candidates get their names on a second row so they don't overlap.
  const row: Partial<Record<CandidateId, number>> = {};
  const lastX = [-Infinity, -Infinity, -Infinity];
  for (const id of [...candidateIds].sort((a, b) => spots[a] - spots[b])) {
    const r = lastX.findIndex(end => x(spots[id]) - end >= 56);
    row[id] = r === -1 ? 2 : r;
    lastX[row[id]!] = x(spots[id]);
  }
  return <svg className="spectrum-picture" viewBox="0 0 480 122" role="img" aria-label={`${students.length} students on a line. ${candidateIds.map(id => `${nameOf(id)} stands at ${Math.round(spots[id] * 100)}%`).join(", ")}.`}>
    <text x="16" y="120" className="spectrum-end">Sports &amp; fun</text><text x="464" y="120" textAnchor="end" className="spectrum-end">Studies &amp; exams</text>
    <line x1="16" x2="464" y1="62" y2="62" className="spectrum-line" />
    {students.map((p, i) => <circle key={i} cx={x(p)} cy={8 + (i * 37 % 15) * 3} r="2.2" fill={`var(--candidate-${nearest(p).toLowerCase()})`} opacity=".7" />)}
    {candidateIds.map(id => <g key={id}><circle cx={x(spots[id])} cy="62" r="8" fill={`var(--candidate-${id.toLowerCase()})`} stroke="var(--card)" strokeWidth="2" /><text x={x(spots[id])} y={82 + row[id]! * 13} textAnchor="middle" className="spectrum-name">{nameOf(id)}</text></g>)}
  </svg>;
}

const shade = (election: SimulatedElection) => election.tie ? "tie" : String(election.sameWinner);
const changedWinner = (election: SimulatedElection) => !election.tie && !election.sameWinner;

function Verdict({ election }: { election: SimulatedElection }) {
  const first = election.winners.plurality;
  return <p className="sim-verdict" data-same={shade(election)}>{election.tie
    ? <>At least one method ends in a tie, so we can’t compare winners.</>
    : election.sameWinner
    ? <>All three methods pick {nameOf(first[0])}. The counting method didn’t matter.</>
    : <>Different methods, different winners. The counting method changed the result.</>}</p>;
}

function ElectionCard({ title, election, detail }: { title: string; election: SimulatedElection; detail?: ClassDetail }) {
  const total = election.groups.reduce((sum, g) => sum + g.count, 0);
  const biggest = Math.max(...election.groups.map(g => g.count));
  return <div className="inspect-card" data-same={shade(election)}>
    <p className="inspect-title">{title}</p>
    <div className="sim-steps">
      <section><p className="sim-step-title"><span>1</span>How {total} students voted</p>
        {detail?.spots && detail.students ? <SpectrumPicture spots={detail.spots} students={detail.students} /> : null}
        <ul className="inspect-ballots">{[...election.groups].sort((a, b) => b.count - a.count).map(g => <li key={g.ranking.join()}><span>{g.count}</span><Ranking ranking={g.ranking} /><span className="ballot-bar" style={{ width: `${g.count / biggest * 100}%` }} /></li>)}</ul>
      </section>
      <section><p className="sim-step-title"><span>2</span>Count the same ballots three ways</p>
        <ul className="method-results">{methods.map(m => <li key={m.key}><div><p>{m.name}</p><p className="fine-print">{m.how}</p></div><Winner ids={election.winners[m.key]} /></li>)}</ul>
        <Verdict election={election} />
      </section>
    </div>
  </div>;
}

function ResultsGrid({ runs, selected, onSelect }: { runs: SimulatedElection[]; selected: number | null; onSelect: (index: number) => void }) {
  const rows = Math.ceil(SIMULATED_ELECTIONS / COLUMNS);
  const changed = runs.filter(changedWinner).length;
  return <div className="simulation-grid-wrap">
    <svg className="simulation-grid" viewBox={`0 0 ${COLUMNS * CELL} ${rows * CELL}`} role="img" aria-label={`${runs.length} elections: in ${changed} the counting method changed the winner`}>
      {Array.from({ length: SIMULATED_ELECTIONS }, (_, i) => {
        const run = runs[i];
        return <rect key={i} x={(i % COLUMNS) * CELL + 1} y={Math.floor(i / COLUMNS) * CELL + 1} width={CELL - 2} height={CELL - 2} rx="2" data-same={run ? shade(run) : "empty"} data-selected={selected === i} onClick={run ? () => onSelect(i) : undefined} />;
      })}
    </svg>
  </div>;
}

export function SimulationLab({ model, onModelChange }: { model: VoterModel; onModelChange: (model: VoterModel) => void }) {
  const school: SchoolModel = model === "spectrum" ? "spectrum" : "random";
  const [phase, setPhase] = useState<SimulationPhase>("pick");
  const [sample, setSample] = useState<{ election: SimulatedElection; detail: ClassDetail } | null>(null);
  const [runs, setRuns] = useState<SimulatedElection[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  // The share of changed winners for each kind of school the visitor has run, to compare.
  const [finished, setFinished] = useState<Partial<Record<SchoolModel, number>>>({});
  const frame = useRef<number | null>(null);

  useEffect(() => () => { if (frame.current) cancelAnimationFrame(frame.current); }, []);

  const changed = runs.filter(changedWinner).length;
  const ties = runs.filter(run => run.tie).length;
  const other: SchoolModel = school === "random" ? "spectrum" : "random";

  function stop() { if (frame.current) cancelAnimationFrame(frame.current); frame.current = null; }
  function makeSample(next = school) {
    stop();
    const detail = generateClass(seededRandom(Date.now()), SIMULATED_VOTERS, next);
    setSample({ election: judge(detail.groups), detail }); setRuns([]); setSelected(null); setPhase("sample");
  }
  // The sample school becomes square #1; the computer makes the rest.
  function start() {
    stop();
    const random = seededRandom(Date.now() + 1);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const all: SimulatedElection[] = sample ? [sample.election] : [];
    setSelected(null); setRuns([...all]); setPhase("running");
    const tick = () => {
      const size = reduced ? SIMULATED_ELECTIONS : BATCH;
      for (let i = 0; i < size && all.length < SIMULATED_ELECTIONS; i++) all.push(judge(randomClass(random, SIMULATED_VOTERS, school)));
      setRuns([...all]);
      if (all.length < SIMULATED_ELECTIONS) frame.current = requestAnimationFrame(tick);
      else {
        setPhase("done"); frame.current = null;
        setFinished(old => ({ ...old, [school]: all.filter(changedWinner).length }));
      }
    };
    frame.current = requestAnimationFrame(tick);
  }
  function changeModel(value: string) {
    if (!value || value === school) return;
    onModelChange(value as SchoolModel);
    if (phase !== "pick") makeSample(value as SchoolModel);
  }
  function showChanged() {
    const index = runs.findIndex(changedWinner);
    if (index >= 0) setSelected(index);
  }

  const picked = selected !== null ? runs[selected] : null;
  const activeStep = phase === "pick" ? 0 : phase === "sample" ? 1 : 2;
  const percent = (n: number) => `${Math.round(n / SIMULATED_ELECTIONS * 100)}%`;

  return <div className="simulation">
    <ol className="sim-path" aria-label="How the simulation works">{steps.map((label, i) => <li key={label} data-state={i < activeStep ? "done" : i === activeStep ? "current" : "next"}><span>{i + 1}</span>{label}</li>)}</ol>

    <div className="sim-models">
      <p className="small-label">What are the students like?</p>
      <ToggleGroup type="single" variant="ballot" size="ballot" value={school} onValueChange={changeModel} disabled={phase === "running"} className="model-options" aria-label="What the students are like">
        {(Object.keys(models) as SchoolModel[]).map(id => <ToggleGroupItem key={id} value={id}><ModelPicture model={id} /><span className="decide-name">{models[id].name}</span><span className="decide-tradeoff">{models[id].detail}</span></ToggleGroupItem>)}
      </ToggleGroup>
    </div>

    {phase === "pick" && <div className="sim-actions"><span className="fine-print">We’ll make up a school of {SIMULATED_VOTERS} students like this, then count its votes.</span><Button size="lg" onClick={() => makeSample()}><Dices data-icon="inline-start" />Make up a school</Button></div>}

    {phase === "sample" && sample && <>
      <ElectionCard title="A made-up school" election={sample.election} detail={sample.detail} />
      <div className="sim-actions">
        <Button variant="ghost" size="sm" onClick={() => makeSample()}><Shuffle data-icon="inline-start" />Make up another</Button>
        <Button size="lg" onClick={start}><Play data-icon="inline-start" />Repeat {SIMULATED_ELECTIONS.toLocaleString()} times</Button>
      </div>
    </>}

    {(phase === "running" || phase === "done") && <>
      <div className="sim-results">
        <div>
          <ResultsGrid runs={runs} selected={selected} onSelect={setSelected} />
          <p className="sim-legend"><span><span className="stat-key" data-same="false" aria-hidden="true" />Method changed the winner</span><span><span className="stat-key" data-same="true" aria-hidden="true" />Same winner every way</span><span><span className="stat-key" data-same="tie" aria-hidden="true" />A tie</span><span className="fine-print">Each square is one school. Click one to look inside.</span></p>
        </div>
        <div className="sim-side" aria-live="polite">
          {phase === "running" ? <p className="sim-progress">Counting school {runs.length.toLocaleString()} of {SIMULATED_ELECTIONS.toLocaleString()}…</p> : <>
            <p className="sim-headline"><strong>{percent(changed)}</strong><span>of schools would get a <em>different prefect</em> depending on how the votes are counted.</span></p>
            <p className="fine-print">{changed.toLocaleString()} out of {SIMULATED_ELECTIONS.toLocaleString()} made-up elections.{ties ? ` ${ties} ended in a tie and aren’t counted.` : ""}</p>
            {finished[other] !== undefined && <div className="sim-compare">{(Object.keys(models) as SchoolModel[]).map(id => <div key={id} data-current={id === school}><span>{models[id].name}</span><span className="compare-track"><span style={{ width: percent(finished[id]!) }} /></span><span>{percent(finished[id]!)}</span></div>)}</div>}
            <div className="inspect-actions">
              <Button variant="outline" size="sm" disabled={!changed} onClick={showChanged}>Show one that changed</Button>
              <Button variant="outline" size="sm" onClick={() => changeModel(other)}>Try {models[other].name.toLowerCase()}</Button>
              <Button variant="ghost" size="sm" onClick={() => makeSample()}><RotateCcw data-icon="inline-start" />Start again</Button>
            </div>
          </>}
        </div>
      </div>
      {phase === "done" && picked && <ElectionCard key={selected} title={`School ${selected! + 1}`} election={picked} detail={selected === 0 && sample ? sample.detail : undefined} />}

      <Accordion type="single" collapsible><AccordionItem value="code"><AccordionTrigger>See the code</AccordionTrigger><AccordionContent>
        <pre className="code-block"><code>{`for (let school = 1; school <= 1000; school++) {
  // 1. Make up a school of ${SIMULATED_VOTERS} students
  const ballots = randomClass(random, ${SIMULATED_VOTERS}, "${school}");

  // 2. Count the same ballots three ways
  const a = plurality(ballots).winners;
  const b = runoff(ballots).winners;
  const c = positional(ballots).winners; // points

  // 3. Colour the square
  if (anyTie(a, b, c)) ties++;           // white
  else if (sameWinner(a, b, c)) same++;  // grey
  else changed++;                        // yellow
}`}</code></pre>
        <p className="note">Repeating a random experiment many times to see how often something happens is called a Monte Carlo simulation.</p>
      </AccordionContent></AccordionItem></Accordion>
    </>}
  </div>;
}
