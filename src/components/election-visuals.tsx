"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Portrait } from "@/components/portrait";
import { candidateIds, nameOf, positional, type BallotGroup, type CandidateId, type Counts, type Result, type RunoffResult } from "@/lib/elections";

// Counts up (or down) to `value` so changes are easy to follow. Jumps straight there with reduced motion.
export function AnimatedNumber({ value, duration = 450 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { from.current = value; setShown(value); return; }
    const began = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - began) / duration);
      const next = Math.round(start + (value - start) * (1 - (1 - t) ** 3));
      from.current = next; setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return <>{shown.toLocaleString()}</>;
}

export function CandidateName({ id, portrait = false }: { id: CandidateId; portrait?: boolean }) {
  return <span className="candidate-name">{portrait ? <span className="mini-portrait"><Portrait id={id} small /></span> : <span className="candidate-dot" data-candidate={id} />}<span>{nameOf(id)}</span></span>;
}

export function Ranking({ ranking }: { ranking: CandidateId[] }) {
  return <span className="inline-ranking">{ranking.map((id, i) => <span key={id}><CandidateName id={id} />{i < ranking.length - 1 && <ArrowRight aria-hidden="true" />}</span>)}</span>;
}

export function BallotTable({ groups, visitor }: { groups: BallotGroup[]; visitor?: CandidateId[] | null }) {
  return <Accordion type="single" collapsible>
    <AccordionItem value="ballots"><AccordionTrigger>See all the ballots <span className="table-total">{groups.reduce((s, g) => s + g.count, 0)} pretend students{visitor ? " + you" : ""}</span></AccordionTrigger>
      <AccordionContent><p className="fine-print">Each row is a group of students who put the candidates in the same order.</p><div className="ballot-table-scroll"><table className="ballot-table"><thead><tr><th scope="col">Students</th><th scope="col">1st → 2nd → 3rd choice</th></tr></thead><tbody>{groups.map((group, i) => <tr key={i}><td>{group.count}</td><td><Ranking ranking={group.ranking} /></td></tr>)}{visitor && <tr><td>You · 1</td><td><Ranking ranking={visitor} /></td></tr>}</tbody></table></div><p className="fine-print">In instant runoff, each ballot counts for its highest choice who is still in the race.</p></AccordionContent>
    </AccordionItem>
  </Accordion>;
}

// With `majority`, bars show each share of all ballots.
// `moved` splits each bar into the candidate's own votes and votes that arrived from `movedFrom`.
// `taken` shows a new candidate pulling votes away: the others keep an empty outline of what they lost,
// and the newcomer's bar is built from the colours of the candidates it took them from.
export function CountChart({ result, unit = "votes", eligible = [...candidateIds], compact = false, majority = false, moved, movedFrom, taken }: { result: Result; unit?: string; eligible?: CandidateId[]; compact?: boolean; majority?: boolean; moved?: Counts; movedFrom?: CandidateId; taken?: { by: CandidateId; from: Counts } }) {
  const max = majority ? Math.max(1, result.total) : Math.max(1, ...eligible.map(id => result.counts[id]));
  const leaders = result.winners.length === 1 ? result.winners : [];
  const sources = taken ? eligible.filter(id => id !== taken.by && taken.from[id] > 0) : [];
  return <div className="count-chart" data-compact={compact} aria-label={`Election result in ${unit}`}>
    {eligible.map(id => <div className="count-row" key={id} data-candidate={id} data-leading={leaders.includes(id)}>
      <div className="count-label"><CandidateName id={id} portrait={!compact} /><span className="count-number"><AnimatedNumber value={result.counts[id]} duration={600} /> <span>{majority ? `${unit} (${Math.round(result.counts[id] / result.total * 100)}%)` : unit}</span></span></div>
      <div className="count-track">
        <div className="count-fill" data-candidate={id} data-taken={taken?.by === id || undefined} style={{ width: `${result.counts[id] / max * 100}%` }}>
          {moved && movedFrom && moved[id] > 0 && <span className="count-moved" data-candidate={movedFrom} style={{ width: `${moved[id] / result.counts[id] * 100}%` }} />}
          {taken?.by === id && sources.map(from => <span key={from} className="count-source" data-candidate={from} style={{ width: `${taken.from[from] / result.counts[id] * 100}%` }} />)}
        </div>
        {taken && taken.by !== id && taken.from[id] > 0 && <span className="count-taken" data-candidate={id} style={{ left: `${result.counts[id] / max * 100}%`, width: `${taken.from[id] / max * 100}%` }} />}
      </div>
      {moved && movedFrom && moved[id] > 0 && <p className="count-moved-note"><span className="count-moved-key" data-candidate={movedFrom} aria-hidden="true" />{moved[id]} of these came from {nameOf(movedFrom)}</p>}
      {taken && taken.by !== id && taken.from[id] > 0 && <p className="count-moved-note count-taken-note"><span className="count-taken-key" data-candidate={id} aria-hidden="true" />{taken.from[id]} taken by {nameOf(taken.by)}</p>}
      {taken?.by === id && <p className="count-moved-note">{sources.map(from => <span key={from} className="count-source-note"><span className="candidate-dot" data-candidate={from} aria-hidden="true" />{taken.from[from]} from {nameOf(from)}</span>)}</p>}
    </div>)}
  </div>;
}

// Kabir's supporters, split by who they ranked next. Each segment is coloured by where those votes went.
export function KabirSplit({ split }: { split: Counts }) {
  const total = split.A + split.B;
  const goes = (["B", "A"] as CandidateId[]).filter(id => split[id] > 0);
  return <figure className="kabir-split" aria-label={`Kabir’s ${total} votes: ${split.B} went to Meera, ${split.A} went to Aarav`}>
    <figcaption><CandidateName id="C" portrait /><span>Kabir’s {total} votes had to go somewhere</span></figcaption>
    <div className="split-bar">{goes.map(id => <span key={id} data-candidate={id} style={{ width: `${split[id] / total * 100}%` }}>{Math.round(split[id] / total * 100)}%</span>)}</div>
    <div className="split-legend">{goes.map(id => <p key={id} data-candidate={id}><span className="candidate-dot" data-candidate={id} /><strong>{split[id]}</strong> ranked {nameOf(id)} next</p>)}</div>
  </figure>;
}

export function ResultCard({ result, method, description, unit = "votes", children }: { result: Result; method: string; description: string; unit?: string; children?: React.ReactNode }) {
  const outcome = result.winners.length === 1 ? `${nameOf(result.winners[0])} wins` : result.winners.length > 1 ? `${result.winners.map(nameOf).join(" & ")} tie` : "It’s a tie";
  return <Card><CardHeader><CardDescription>{method}</CardDescription><CardTitle>{outcome}</CardTitle></CardHeader><CardContent><CountChart result={result} unit={unit} compact /></CardContent><CardFooter><p className="fine-print">{description}</p>{children}</CardFooter></Card>;
}

export function BallotMap({ result }: { result: Result }) {
  const dots: CandidateId[] = candidateIds.flatMap(id => Array.from({ length: result.counts[id] }, () => id));
  return <div className="ballot-map-wrap"><svg viewBox="0 0 300 300" className="ballot-map" role="img" aria-label={`${result.total} votes: ${candidateIds.map(id => `${result.counts[id]} for ${nameOf(id)}`).join(", ")}`}>
    <circle cx="150" cy="150" r="142" fill="none" stroke="var(--border)" strokeWidth="1" />
    {dots.map((id, i) => {
      const angle = i * 2.399963;
      const radius = 11.3 * Math.sqrt(i + 1);
      return <circle key={i} cx={150 + radius * Math.cos(angle)} cy={150 + radius * Math.sin(angle)} r="6.4" fill={`var(--candidate-${id.toLowerCase()})`} />;
    })}
    <path d="M262 35l13-8m-9 17l19-1" stroke="var(--primary)" strokeWidth="2" fill="none" strokeLinecap="round" />
  </svg><p className="fine-print">One dot, one student.</p></div>;
}

// Each pile is a group of identical ballots. The highlighted name is the one the ballot counts for right now.
export function BallotPiles({ groups, visitor, active }: { groups: BallotGroup[]; visitor?: CandidateId[] | null; active: CandidateId[] }) {
  const piles = [...groups.map(g => ({ label: `${g.count} ${g.count === 1 ? "student" : "students"}`, count: g.count, ranking: g.ranking, you: false })), ...(visitor ? [{ label: "You", count: 1, ranking: visitor, you: true }] : [])];
  return <ul className="ballot-piles" aria-label="Ballots">
    {piles.map((pile, i) => {
      const counted = pile.ranking.find(id => active.includes(id))!;
      const moved = counted !== pile.ranking[0];
      return <li key={i} className="ballot-pile" data-you={pile.you} data-moved={moved} data-stacked={pile.count > 1}>
        <span className="pile-label">{pile.label}</span>
        <ol className="pile-ranking">{pile.ranking.map((id, rank) => {
          const state = id === counted ? "counted" : active.includes(id) ? "waiting" : "out";
          return <li key={id} data-state={state} data-candidate={id}><span className="pile-rank">{["1st", "2nd", "3rd"][rank]}</span><span className="candidate-dot" data-candidate={id} /><span className="pile-name">{nameOf(id)}</span>{state === "out" && <span className="sr-only"> (knocked out)</span>}</li>;
        })}</ol>
        <span className="pile-goes">{moved ? `Now goes to ${nameOf(counted)}` : `Goes to ${nameOf(counted)}`}</span>
      </li>;
    })}
  </ul>;
}

// Borda: your own ballot shows how points are handed out, then every candidate's points are added up.
export function PointsExplainer({ groups, ballot, weights = [2, 1, 0] }: { groups: BallotGroup[]; ballot: CandidateId[] | null; weights?: number[] }) {
  const tally = (id: CandidateId, rank: number) => groups.reduce((sum, g) => sum + (g.ranking[rank] === id ? g.count : 0), 0);
  const result = positional(groups, weights);
  const winner = result.winners.length === 1 ? result.winners[0] : null;
  const order = [...candidateIds].sort((a, b) => result.counts[b] - result.counts[a]);
  const firstLeader = [...candidateIds].sort((a, b) => tally(b, 0) - tally(a, 0))[0];
  const places = ["1st", "2nd", "3rd"];
  return <div className="points-explainer">
    {ballot && <section className="points-rule" aria-label="How your ballot gives out points">
      <h2>Your ballot gives out points</h2>
      <ol className="points-ballot">{ballot.map((id, rank) => <li key={id} style={{ animationDelay: `${rank * 120}ms` }}>
        <span className="points-place">{places[rank]}</span><CandidateName id={id} portrait /><strong data-zero={weights[rank] === 0}>+{weights[rank]}</strong>
      </li>)}</ol>
    </section>}
    <table className="points-table">
      <caption className="sr-only">Points for each candidate from all {result.total} ballots</caption>
      <thead><tr><th scope="col">Candidate</th><th scope="col">1st choice</th><th scope="col">2nd choice</th><th scope="col">Points</th></tr></thead>
      <tbody>{order.map((id, i) => <tr key={id} data-winner={id === winner} style={{ animationDelay: `${300 + i * 90}ms` }}>
        <th scope="row"><CandidateName id={id} portrait /></th>
        <td>{tally(id, 0)} <span>× {weights[0]} = {tally(id, 0) * weights[0]}</span></td>
        <td>{tally(id, 1)} <span>× {weights[1]} = {tally(id, 1) * weights[1]}</span></td>
        <td><span className="points-sum">{id === winner && <Check className="points-check" aria-label="Winner" />}<strong><AnimatedNumber value={result.counts[id]} duration={700} /></strong></span></td>
      </tr>)}</tbody>
    </table>
    {winner && <p className="points-insight">{winner === firstLeader
      ? `${nameOf(winner)} has the most first choices and the most points.`
      : tally(winner, 1) > tally(firstLeader, 1)
        ? `${nameOf(firstLeader)} has the most first choices, but more students put ${nameOf(winner)} second. That’s enough to win on points.`
        : `${nameOf(winner)} wins on points.`}</p>}
  </div>;
}

export function RunoffWalkthrough({ result }: { result: RunoffResult }) {
  const [roundIndex, setRoundIndex] = useState(0);
  const index = Math.min(roundIndex, result.rounds.length - 1);
  const round = result.rounds[index];
  const previous = result.rounds[index - 1];
  const winner = !round.eliminated && result.winners.length === 1 ? result.winners[0] : null;
  return <div className="runoff-walkthrough">
    <ToggleGroup type="single" variant="outline" size="lg" spacing={0} value={String(index)} onValueChange={value => value && setRoundIndex(Number(value))} aria-label="Instant runoff round" className="round-selector">
      {result.rounds.map((_, i) => <ToggleGroupItem key={i} value={String(i)}>{i === result.rounds.length - 1 ? "Final count" : "First count"}</ToggleGroupItem>)}
    </ToggleGroup>
    <div className="runoff-grid" aria-live="polite">
      <section className="runoff-count" aria-label={`Round ${index + 1} votes`}>
        <p className="result-signal" data-signal={winner ? "good" : "neutral"}>{round.eliminated ? `${nameOf(round.eliminated)} is last and is out` : winner ? `${nameOf(winner)} wins with more than half` : "The count ends in a tie"}</p>
        <CountChart result={round} eligible={round.active} majority moved={previous?.transfers} movedFrom={previous?.eliminated} />
      </section>
      <aside className="runoff-explainer">
        <h2>{previous?.eliminated ? "Their backups now count" : "Does anyone have more than half?"}</h2>
        <p>{round.eliminated ? `Not yet. ${nameOf(round.eliminated)} has the fewest first choices. Each of those ballots moves to its next choice still in the race.` : winner ? `Every ballot still counts once. ${nameOf(winner)} now has ${round.counts[winner]} of ${round.total} votes.` : "Tied candidates need a separate tie-break rule."}</p>
        {previous?.transfers && previous.eliminated && <div className="transfer-summary"><span>{nameOf(previous.eliminated)}’s ballots move:</span>{round.active.map(id => <p key={id}><strong>+{previous.transfers![id]}</strong><ArrowRight aria-hidden="true" /><CandidateName id={id} /></p>)}</div>}
        <AlgorithmCard active={round.eliminated ? [2, 4] : [2, 3]} />
      </aside>
    </div>
  </div>;
}

const runoffSteps = [
  { code: "instantRunoff(ballots):", depth: 0 },
  { code: "repeat:", depth: 1 },
  { code: "count each ballot for its highest choice still in the race", depth: 2 },
  { code: "if someone has more than half, they win", depth: 2 },
  { code: "otherwise, knock out whoever is last", depth: 2 },
];

// Instant runoff written as an algorithm. `active` marks the lines the current round has just run.
export function AlgorithmCard({ active = [], label }: { active?: number[]; label?: string }) {
  return <figure className="algorithm-card">
    {label && <figcaption>{label}</figcaption>}
    <ol>{runoffSteps.map((step, i) => <li key={i} data-active={active.includes(i)} style={{ paddingLeft: `${step.depth * 18 + 12}px` }}><code>{step.code}</code></li>)}</ol>
  </figure>;
}
