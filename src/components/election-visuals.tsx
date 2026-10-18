"use client";

import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Portrait } from "@/components/portrait";
import { candidateIds, candidates, nameOf, type BallotGroup, type CandidateId, type Counts, type Result } from "@/lib/elections";

export function CampaignDetails({ id, onChoose }: { id: CandidateId; onChoose?: (id: CandidateId) => void }) {
  const candidate = candidates.find(c => c.id === id)!;
  return <Dialog>
    <DialogTrigger asChild><Button variant="ghost" size="sm" className="manifesto-trigger">Read {candidate.name}’s manifesto <ArrowUpRight data-icon="inline-end" /></Button></DialogTrigger>
    <DialogContent className="manifesto" data-candidate={id}>
      <DialogHeader className="manifesto-header">
        <span className="manifesto-portrait"><Portrait id={id} small /></span>
        <span><DialogTitle>{candidate.name} {candidate.surname}</DialogTitle><DialogDescription>{candidate.classLine}</DialogDescription></span>
      </DialogHeader>
      <p className="manifesto-slogan">{candidate.slogan}</p>
      <p className="manifesto-about">{candidate.about}</p>
      <div className="manifesto-traits"><TraitChips traits={candidate.traits} /><span className="fine-print">Fun fact: {candidate.funFact}</span></div>
      <p className="manifesto-section">My manifesto</p>
      <ol className="manifesto-pledges">{candidate.pledges.map(p => <li key={p.title}><strong>{p.title}</strong><span>{p.how}</span></li>)}</ol>
      <p className="manifesto-section">Being honest</p>
      <p className="fine-print manifesto-honest">{candidate.tradeoff}</p>
      {onChoose && <DialogFooter><DialogClose asChild><Button onClick={() => onChoose(id)}><Check data-icon="inline-start" />Pick {candidate.name}</Button></DialogClose></DialogFooter>}
    </DialogContent>
  </Dialog>;
}

export function TraitChips({ traits }: { traits: string[] }) {
  return <span className="trait-chips">{traits.map(t => <span key={t}>{t}</span>)}</span>;
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

// With `majority`, bars show each share of all ballots and mark the halfway line.
// `moved` splits each bar into the candidate's own votes and votes that arrived from `movedFrom`.
export function CountChart({ result, unit = "votes", eligible = [...candidateIds], compact = false, majority = false, moved, movedFrom }: { result: Result; unit?: string; eligible?: CandidateId[]; compact?: boolean; majority?: boolean; moved?: Counts; movedFrom?: CandidateId }) {
  const max = majority ? Math.max(1, result.total) : Math.max(1, ...eligible.map(id => result.counts[id]));
  const leaders = result.winners.length === 1 ? result.winners : [];
  return <div className="count-chart" data-compact={compact} data-majority={majority} aria-label={`Election result in ${unit}`}>
    {eligible.map(id => <div className="count-row" key={id} data-candidate={id} data-leading={leaders.includes(id)}>
      <div className="count-label"><CandidateName id={id} portrait={!compact} /><span className="count-number">{result.counts[id]} <span>{majority ? `${unit} · ${Math.round(result.counts[id] / result.total * 100)}%` : unit}</span></span></div>
      <div className="count-track"><div className="count-fill" data-candidate={id} style={{ width: `${result.counts[id] / max * 100}%` }}>{moved && movedFrom && moved[id] > 0 && <span className="count-moved" data-candidate={movedFrom} style={{ width: `${moved[id] / result.counts[id] * 100}%` }} />}</div>{majority && <span className="majority-line" aria-hidden="true" />}</div>
      {moved && movedFrom && moved[id] > 0 && <p className="count-moved-note"><span className="count-moved-key" data-candidate={movedFrom} aria-hidden="true" />{result.counts[id] - moved[id]} first-choice votes + {moved[id]} moved from {nameOf(movedFrom)}</p>}
    </div>)}
    {majority && <p className="majority-legend"><span aria-hidden="true" />Majority line: {Math.floor(result.total / 2) + 1} of {result.total} votes is more than half</p>}
  </div>;
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
        <span className="pile-goes">{moved ? <>moved to <strong>{nameOf(counted)}</strong></> : <>counts for <strong>{nameOf(counted)}</strong></>}</span>
      </li>;
    })}
  </ul>;
}

// Borda working: each candidate's 1st- and 2nd-choice ballots, times their points.
export function PointsTable({ groups, weights = [2, 1, 0] }: { groups: BallotGroup[]; weights?: number[] }) {
  const tally = (id: CandidateId, rank: number) => groups.reduce((sum, g) => sum + (g.ranking[rank] === id ? g.count : 0), 0);
  return <div className="ballot-table-scroll"><table className="points-table">
    <thead><tr><th scope="col">Candidate</th><th scope="col">1st choices × {weights[0]}</th><th scope="col">2nd choices × {weights[1]}</th><th scope="col">Points</th></tr></thead>
    <tbody>{candidateIds.map(id => {
      const first = tally(id, 0), second = tally(id, 1);
      return <tr key={id}><th scope="row"><CandidateName id={id} /></th><td>{first} × {weights[0]} = {first * weights[0]}</td><td>{second} × {weights[1]} = {second * weights[1]}</td><td>{first * weights[0] + second * weights[1]}</td></tr>;
    })}</tbody>
  </table></div>;
}

const runoffSteps = [
  { code: "instantRunoff(ballots):", depth: 0 },
  { code: "repeat:", depth: 1 },
  { code: "count each ballot for its top choice still running", depth: 2 },
  { code: "if someone has over half → they win, stop", depth: 2 },
  { code: "otherwise → knock out last place", depth: 2 },
];

// Instant runoff written as an algorithm. `active` marks the lines the current round has just run.
export function AlgorithmCard({ active = [], label }: { active?: number[]; label?: string }) {
  return <figure className="algorithm-card">
    <figcaption><span>Algorithm</span>{label && <span className="algorithm-label">{label}</span>}</figcaption>
    <ol>{runoffSteps.map((step, i) => <li key={i} data-active={active.includes(i)} style={{ paddingLeft: `${step.depth * 18 + 12}px` }}><code>{step.code}</code></li>)}</ol>
  </figure>;
}
