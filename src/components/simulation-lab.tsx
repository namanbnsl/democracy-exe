"use client";

import { useEffect, useRef, useState } from "react";
import { Dices, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CandidateName, Ranking } from "@/components/election-visuals";
import { generateClass, judge, randomClass, seededRandom, type ClassDetail, type Outcome, type SimulatedElection, type VoterModel } from "@/lib/simulation";
import { candidateIds, nameOf, pairwise, type BallotGroup, type CandidateId } from "@/lib/elections";

export const SIMULATED_ELECTIONS = 1000;
export const SIMULATED_VOTERS = 101;
const COLUMNS = 40, CELL = 12, BATCH = 40;

export const outcomeLabels: Record<Outcome, string> = { agree: "The rules agree", disagree: "The rules disagree", circle: "No clear winner" };
const models: Record<VoterModel, string> = { random: "Random voters", spectrum: "Voters on a scale" };

type SimulationPhase = "intro" | "sample" | "running" | "done";

function Winner({ ids }: { ids: CandidateId[] }) {
  return ids.length === 1 ? <CandidateName id={ids[0]} /> : <span className="fine-print">A tie</span>;
}

function HeadToHead({ groups }: { groups: BallotGroup[] }) {
  return <ul className="inspect-pairs">{([["A", "B"], ["B", "C"], ["C", "A"]] as [CandidateId, CandidateId][]).map(([a, b]) => {
    const result = pairwise(groups, a, b);
    const [win, lose] = result.counts[a] > result.counts[b] ? [a, b] : [b, a];
    return <li key={a + b}><CandidateName id={win} /><span>beats</span><CandidateName id={lose} /><span className="pair-score">{result.counts[win]}–{result.counts[lose]}</span></li>;
  })}</ul>;
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
  return <svg className="spectrum-picture" viewBox="0 0 480 122" role="img" aria-label={`${students.length} students on a line. ${candidateIds.map(id => `${nameOf(id)} sits at ${Math.round(spots[id] * 100)}%`).join(", ")}.`}>
    <text x="16" y="120" className="spectrum-end">quiet</text><text x="464" y="120" textAnchor="end" className="spectrum-end">loud</text>
    <line x1="16" x2="464" y1="62" y2="62" className="spectrum-line" />
    {students.map((p, i) => <circle key={i} cx={x(p)} cy={10 + (i * 37 % 13) * 3.3} r="3" fill={`var(--candidate-${nearest(p).toLowerCase()})`} opacity=".75" />)}
    {candidateIds.map(id => <g key={id}><circle cx={x(spots[id])} cy="62" r="8" fill={`var(--candidate-${id.toLowerCase()})`} stroke="var(--card)" strokeWidth="2" /><text x={x(spots[id])} y={82 + row[id]! * 13} textAnchor="middle" className="spectrum-name">{nameOf(id)}</text></g>)}
  </svg>;
}

function ElectionCard({ title, election, detail }: { title: string; election: SimulatedElection; detail?: ClassDetail }) {
  const total = election.groups.reduce((sum, g) => sum + g.count, 0);
  return <div className="inspect-card" data-outcome={election.outcome}>
    <p className="inspect-title">{title}</p>
    <ol className="sim-steps">
      <li><p className="sim-step-title">How {total} students voted</p>
        {detail?.spots && detail.students ? <SpectrumPicture spots={detail.spots} students={detail.students} /> : null}
        <ul className="inspect-ballots">{election.groups.map(g => <li key={g.ranking.join()}><span>{g.count}</span><Ranking ranking={g.ranking} /></li>)}</ul>
      </li>
      <li><p className="sim-step-title">Who wins</p>
        <dl className="inspect-winners">
          <div><dt>One name each</dt><dd><Winner ids={election.winners.plurality} /></dd></div>
          <div><dt>Instant runoff</dt><dd><Winner ids={election.winners.runoff} /></dd></div>
          <div><dt>Borda count</dt><dd><Winner ids={election.winners.borda} /></dd></div>
        </dl>
      </li>
      <li><p className="sim-step-title">Head to head</p>
        <HeadToHead groups={election.groups} />
      </li>
    </ol>
    <p className="sim-verdict"><span className="stat-key" data-outcome={election.outcome} aria-hidden="true" /><span>{outcomeLabels[election.outcome]}</span></p>
  </div>;
}

function Stats({ counts, total }: { counts: Record<Outcome, number>; total: number }) {
  const percent = (n: number) => total ? `${(n / total * 100).toFixed(1)}%` : "–";
  return <div className="simulation-stats" aria-live="polite">
    {(["circle", "disagree", "agree"] as Outcome[]).map(outcome => <div key={outcome} data-outcome={outcome}>
      <span className="stat-key" aria-hidden="true" />
      <span className="stat-label">{outcomeLabels[outcome]}</span>
      <span className="stat-value">{counts[outcome].toLocaleString()} <span>{percent(counts[outcome])}</span></span>
    </div>)}
  </div>;
}

function ResultsGrid({ runs, selected, onSelect }: { runs: SimulatedElection[]; selected: number | null; onSelect: (index: number) => void }) {
  const rows = Math.ceil(SIMULATED_ELECTIONS / COLUMNS);
  const counts = { agree: 0, disagree: 0, circle: 0 };
  for (const run of runs) counts[run.outcome]++;
  return <div className="simulation-grid-wrap">
    <svg className="simulation-grid" viewBox={`0 0 ${COLUMNS * CELL} ${rows * CELL}`} role="img" aria-label={`${runs.length} elections: ${counts.circle} circles, ${counts.disagree} disagreements, ${counts.agree} agreements`}>
      {Array.from({ length: SIMULATED_ELECTIONS }, (_, i) => {
        const run = runs[i];
        return <rect key={i} x={(i % COLUMNS) * CELL + 1} y={Math.floor(i / COLUMNS) * CELL + 1} width={CELL - 2} height={CELL - 2} rx="2" data-outcome={run?.outcome ?? "empty"} data-selected={selected === i} onClick={run ? () => onSelect(i) : undefined} />;
      })}
    </svg>
  </div>;
}

export function SimulationLab({ model, onModelChange }: { model: VoterModel; onModelChange: (model: VoterModel) => void }) {
  const [phase, setPhase] = useState<SimulationPhase>("intro");
  const [sample, setSample] = useState<{ election: SimulatedElection; detail: ClassDetail } | null>(null);
  const [runs, setRuns] = useState<SimulatedElection[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const frame = useRef<number | null>(null);

  useEffect(() => () => { if (frame.current) cancelAnimationFrame(frame.current); }, []);

  const counts = { agree: 0, disagree: 0, circle: 0 };
  for (const run of runs) counts[run.outcome]++;

  function stop() { if (frame.current) cancelAnimationFrame(frame.current); frame.current = null; }
  function makeSample(nextModel = model) {
    stop();
    const detail = generateClass(seededRandom(Date.now()), SIMULATED_VOTERS, nextModel);
    setSample({ election: judge(detail.groups), detail }); setRuns([]); setSelected(null); setPhase("sample");
  }
  // The sample class becomes square #1; the computer makes the rest.
  function start(withSample: boolean) {
    stop();
    const random = seededRandom(Date.now() + 1);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const all: SimulatedElection[] = withSample && sample ? [sample.election] : [];
    if (!withSample) setSample(null);
    setSelected(null); setRuns([...all]); setPhase("running");
    const tick = () => {
      const size = reduced ? SIMULATED_ELECTIONS : BATCH;
      for (let i = 0; i < size && all.length < SIMULATED_ELECTIONS; i++) all.push(judge(randomClass(random, SIMULATED_VOTERS, model)));
      setRuns([...all]);
      if (all.length < SIMULATED_ELECTIONS) frame.current = requestAnimationFrame(tick);
      else { setPhase("done"); frame.current = null; }
    };
    frame.current = requestAnimationFrame(tick);
  }
  function changeModel(value: string) {
    if (!value || value === model) return;
    onModelChange(value as VoterModel);
    if (phase === "intro") return;
    makeSample(value as VoterModel);
  }
  function showFirst(outcome: Outcome) {
    const index = runs.findIndex(run => run.outcome === outcome);
    if (index >= 0) setSelected(index);
  }

  const picked = selected !== null ? runs[selected] : null;

  return <div className="simulation">
    <div className="simulation-controls">
      <ToggleGroup type="single" variant="outline" size="sm" value={model} onValueChange={changeModel} disabled={phase === "running"} aria-label="How the voters choose">{(Object.keys(models) as VoterModel[]).map(id => <ToggleGroupItem key={id} value={id}>{models[id]}</ToggleGroupItem>)}</ToggleGroup>
      {phase === "done" && <Button variant="outline" size="sm" onClick={() => start(false)}><RotateCcw data-icon="inline-start" />Run again</Button>}
    </div>

    {phase === "intro" && <div className="sim-results">
      <div><ResultsGrid runs={[]} selected={null} onSelect={() => {}} /><p className="note simulation-caption">Each square will be one election.</p></div>
      <div className="sim-side"><Stats counts={{ agree: 0, disagree: 0, circle: 0 }} total={0} /><Button size="lg" onClick={() => makeSample()}><Dices data-icon="inline-start" />Try one election</Button></div>
    </div>}

    {phase === "sample" && sample && <>
      <ElectionCard title="Election 1" election={sample.election} detail={sample.detail} />
      <div className="sim-actions">
        <Button variant="ghost" size="sm" onClick={() => makeSample()}><Dices data-icon="inline-start" />Try another</Button>
        <Button onClick={() => start(true)}><Play data-icon="inline-start" />Run {SIMULATED_ELECTIONS.toLocaleString()} elections</Button>
      </div>
    </>}

    {(phase === "running" || phase === "done") && <>
      <div className="sim-results"><div>
      <ResultsGrid runs={runs} selected={selected} onSelect={setSelected} />
      <p className="note simulation-caption">Each square is one election.</p>
      </div><div className="sim-side">
      <Stats counts={counts} total={runs.length} />

      {phase === "done" && <div className="inspect-actions">
          <Button variant="outline" size="sm" disabled={!counts.circle} onClick={() => showFirst("circle")}>Show one with no clear winner</Button>
          <Button variant="outline" size="sm" disabled={!counts.disagree} onClick={() => showFirst("disagree")}>Show one where they disagree</Button>
      </div>}
      </div></div>
      {phase === "done" && picked && <ElectionCard key={selected} title={`Election ${selected! + 1}`} election={picked} detail={selected === 0 && sample ? sample.detail : undefined} />}

      <Accordion type="single" collapsible><AccordionItem value="code"><AccordionTrigger>See the code</AccordionTrigger><AccordionContent>
        <pre className="code-block"><code>{`for (let i = 0; i < 1000; i++) {
  // 1. Make up a class of 101 students
  const ballots = randomClass(random, 101, "${model}");

  // 2. Count the same ballots three ways
  const a = plurality(ballots).winners;
  const b = runoff(ballots).winners;
  const c = positional(ballots).winners; // Borda points

  // 3–4. Check one-on-one, then colour the square
  if (condorcet(ballots).length === 0) circles++;      // red
  else if (!sameWinner(a, b, c)) disagreements++;      // yellow
  else agreements++;                                   // grey
}`}</code></pre>
        <p className="note">This is called a Monte Carlo simulation.</p>
      </AccordionContent></AccordionItem></Accordion>
    </>}
  </div>;
}
