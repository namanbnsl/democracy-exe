"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { Portrait } from "@/components/portrait";
import { AlgorithmCard, BallotPiles, CandidateName, CountChart, PointsTable, Ranking } from "@/components/election-visuals";
import { SimulationLab } from "@/components/simulation-lab";
import { Playground } from "@/components/playground";
import { candidateIds, candidates, firstChoiceWithVisitor, nameOf, pairwise, positional, runoff, scenarios, withVisitor, type CandidateId } from "@/lib/elections";
import type { VoterModel } from "@/lib/simulation";
import { independenceExample, orderingExample } from "@/lib/voting-lessons";

const chapters = [
  { short: "Vote", title: "Who would you vote for?" },
  { short: "Count", title: "Who wins?" },
  { short: "Backup", title: "Now pick a second choice too" },
  { short: "Fairness", title: "Five fairness checks" },
  { short: "Simulate", title: "How often does this happen?" },
  { short: "Decide", title: "Which would you choose?" },
];

const conditions = [
  { name: "Every ballot counts", formal: "Unrestricted domain", explanation: "Students can rank the candidates in any order they honestly feel. The rule has to work for every possible mix of ballots, not just the easy ones.", question: "Could a rule just ignore unusual ballots?", answer: "No. Then some students wouldn’t really get a vote. A fair rule has to handle whatever ballots it’s given.", idea: "A fair rule can’t pick and choose which ballots to count." },
  { name: "No going in circles", formal: "Complete and transitive social ordering", explanation: "The result has to be a proper ranking. If the group puts Aarav above Meera, and Meera above Kabir, then Aarav must also be above Kabir.", question: "So who should win here?", answer: "There’s no clear answer. Each student’s own list makes sense. But when the majority decides each pair, the group’s list goes round in a circle. (This shows the problem; it isn’t a proof of Arrow’s theorem.)", idea: "Letting the majority decide each pair can go round in a circle." },
  { name: "If everyone agrees, the result agrees", formal: "Unanimity (weak Pareto)", explanation: "If every single student likes Aarav more than Meera, the result must also put Aarav above Meera.", question: "What if they disagree about Kabir?", answer: "It doesn’t matter. Everyone agreed on Aarav versus Meera, so the result must agree too.", idea: "When everyone agrees, the result should too." },
  { name: "Nobody is the boss", formal: "Non-dictatorship", explanation: "The rule can’t just copy one student’s ranking every time and ignore everybody else.", question: "If the winner matches my favourite once, am I the boss?", answer: "No. You’d only be the boss if the rule always followed you, no matter what everyone else wanted.", idea: "No single student should decide for everyone." },
  { name: "Other candidates can’t flip a pair", formal: "Independence of irrelevant alternatives", explanation: "Whether the group prefers Aarav or Meera should depend only on how students rank Aarav and Meera. Moving Kabir up or down shouldn’t flip it.", question: "Why is this a problem?", answer: "Only Kabir moved. Every student still ranks Aarav and Meera the same way, but the Borda result flipped. So Borda breaks this check.", idea: "Borda points can break this check." },
];

const decideOptions = [
  { id: "simple", name: "One name each", detail: "Simple, but a spoiler can change the result." },
  { id: "backups", name: "Rank your choices", detail: "Helps with spoilers, but no ranking rule is fair every time." },
  { id: "strength", name: "Give each candidate a score", detail: "Shows how much you like each one, but people can exaggerate." },
];

function CandidateChoices({ value, onChange, exclude, label }: { value: CandidateId | null; onChange: (id: CandidateId) => void; exclude?: CandidateId | null; label: string }) {
  return <ToggleGroup type="single" variant="ballot" size="ballot" orientation="vertical" value={value ?? ""} onValueChange={v => v && onChange(v as CandidateId)} className="preference-choices" aria-label={label}>
    {candidates.filter(c => c.id !== exclude).map(c => <ToggleGroupItem key={c.id} value={c.id} aria-label={`${label}: ${c.name}`}>
      <span className="mini-portrait"><Portrait id={c.id} small /></span>
      <span className="preference-person"><span>{c.name}</span><span>{c.quality}</span></span>
      <Check className="preference-check" aria-hidden="true" />
    </ToggleGroupItem>)}
  </ToggleGroup>;
}

// Big portrait cards, matching the first screen.
function PortraitChoices({ value, onChange, exclude, label }: { value: CandidateId | null; onChange: (id: CandidateId) => void; exclude?: CandidateId; label: string }) {
  return <ToggleGroup type="single" variant="campaign" size="campaign" value={value ?? ""} onValueChange={v => v && onChange(v as CandidateId)} className="candidate-options portrait-choices" aria-label={label}>
    {candidates.map(c => <ToggleGroupItem key={c.id} value={c.id} disabled={c.id === exclude} data-out={c.id === exclude} aria-label={`${label}: ${c.name}`}>
      <span className="campaign-portrait"><Portrait id={c.id} /></span>
      <span className="campaign-heading"><span className="campaign-name">{c.name} {c.surname}</span>{c.id !== exclude && <span className="choice-circle">{value === c.id && <Check aria-hidden="true" />}</span>}</span>
      <span className="campaign-body"><span className="campaign-quality">{c.id === exclude ? "Dropped out" : c.quality}</span></span>
    </ToggleGroupItem>)}
  </ToggleGroup>;
}

function PreferenceExample({ orders }: { orders: CandidateId[][] }) {
  return <div className="preference-example">{orders.map((order, i) => <div key={i}><span className="example-person">Student {i + 1}</span><Ranking ranking={order} /></div>)}</div>;
}

function ArrowExample({ index, moved, onMove }: { index: number; moved: boolean; onMove: () => void }) {
  if (index === 0) return <div className="arrow-example-stack">
    <p className="example-caption">These two students disagree about almost everything.</p>
    <PreferenceExample orders={[["A", "B", "C"], ["C", "A", "B"]]} />
    <p className="example-conclusion">A fair rule must count both ballots.</p>
  </div>;
  if (index === 1) return <div className="arrow-example-stack">
    <p className="example-caption">Three students. Compare the candidates two at a time.</p>
    <PreferenceExample orders={orderingExample.map(g => g.ranking)} />
    <div className="pair-results">{([["A", "B"], ["B", "C"], ["C", "A"]] as [CandidateId, CandidateId][]).map(([a, b]) => {
      const result = pairwise(orderingExample, a, b);
      return <p key={a}><CandidateName id={a} /><span>beats</span><CandidateName id={b} /><span>{result.counts[a]} to {result.counts[b]}</span></p>;
    })}</div>
    <p className="example-conclusion">It goes round in a circle, like rock, paper, scissors.</p>
  </div>;
  if (index === 2) return <div className="arrow-example-stack">
    <p className="example-caption">All three students put Aarav above Meera.</p>
    <PreferenceExample orders={[["A", "B", "C"], ["A", "C", "B"], ["C", "A", "B"]]} />
    <p className="example-conclusion"><span>So the result must put</span><CandidateName id="A" /><span>above</span><CandidateName id="B" /></p>
  </div>;
  if (index === 3) return <div className="arrow-example-stack">
    <p className="example-caption">Three students, and a rule that always copies Student 1.</p>
    <PreferenceExample orders={[["A", "B", "C"], ["B", "C", "A"], ["C", "B", "A"]]} />
    <div className="copy-example"><p>The result</p><Ranking ranking={["A", "B", "C"]} /><p className="fine-print">Students 2 and 3 both put Aarav last. It makes no difference.</p></div>
  </div>;
  const groups = independenceExample(moved);
  const result = positional(groups);
  const leader = result.counts.A > result.counts.B ? "A" : "B";
  const other = leader === "A" ? "B" : "A";
  return <div className="arrow-example-stack">
    <p className="example-caption">Five students, counted with Borda points. Watch Aarav and Meera.</p>
    <div className="example-left"><div className="preference-example">{groups.map((g, i) => <div key={i}><span className="example-person">{g.count} students</span><Ranking ranking={g.ranking} /></div>)}</div><Button variant="outline" onClick={onMove}>{moved ? "Put Kabir back" : "Move Kabir up for the first 3 students"}</Button></div>
    <div className="pair-points"><div><CandidateName id="A" /><span>{result.counts.A} points</span></div><div><CandidateName id="B" /><span>{result.counts.B} points</span></div></div>
    <p className="example-conclusion">{moved ? `Now ${nameOf(leader)} is ahead, ${result.counts[leader]} to ${result.counts[other]}, but nobody changed their mind about Aarav and Meera.` : `${nameOf(leader)} is ahead of ${nameOf(other)}, ${result.counts[leader]} points to ${result.counts[other]}.`}</p>
  </div>;
}

export function ElectionExperience() {
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [mode, setMode] = useState<"tour" | "lab">("tour");
  const [favourite, setFavourite] = useState<CandidateId | null>(null);
  const [firstVote, setFirstVote] = useState<CandidateId | null>(null);
  const [withdrawn, setWithdrawn] = useState(false);
  const [withdrawalChoice, setWithdrawalChoice] = useState<CandidateId | null>(null);
  const [rankFirst, setRankFirst] = useState<CandidateId | null>(null);
  const [rankBackup, setRankBackup] = useState<CandidateId | null>(null);
  const [ballot, setBallot] = useState<CandidateId[] | null>(null);
  // 0: rank your choices, 1: round 1, 2: round 2, 3: the same ballots counted with points.
  const [rankStage, setRankStage] = useState(0);
  const [arrowIndex, setArrowIndex] = useState(0);
  const [arrowReached, setArrowReached] = useState(0);
  const [iiaMoved, setIiaMoved] = useState(false);
  const [simModel, setSimModel] = useState<VoterModel>("random");
  const [priority, setPriority] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [step, mode, arrowIndex]);

  function go(next: number) { setStep(next); setReached(r => Math.max(r, next)); setMode("tour"); }
  function reset() {
    setStep(0); setReached(0); setMode("tour"); setFavourite(null); setFirstVote(null); setWithdrawn(false); setWithdrawalChoice(null);
    setRankFirst(null); setRankBackup(null); setBallot(null); setRankStage(0);
    setArrowIndex(0); setArrowReached(0); setIiaMoved(false); setSimModel("random"); setPriority(""); setResetOpen(false);
  }
  function cast() {
    if (!favourite) return;
    setFirstVote(favourite); setWithdrawn(false); setWithdrawalChoice(null); setRankFirst(favourite); setRankBackup(null);
    setBallot(null); setRankStage(0);
    setArrowIndex(0); setArrowReached(0); setIiaMoved(false); setSimModel("random"); setPriority(""); setReached(1); go(1);
  }
  function countRanking() {
    if (!rankFirst || !rankBackup) return;
    setBallot([rankFirst, rankBackup, candidateIds.find(id => id !== rankFirst && id !== rankBackup)!]);
    setRankStage(1);
  }
  function next() {
    if (step === 0) cast();
    else if (step === 1 && !withdrawn) setWithdrawn(true);
    else if (step === 2 && rankStage === 0) countRanking();
    else if (step === 2 && rankStage < 3) setRankStage(rankStage + 1);
    else if (step === 3 && arrowIndex < conditions.length) {
      const index = arrowIndex + 1;
      setArrowIndex(index); setArrowReached(Math.max(arrowReached, index));
    } else if (step === chapters.length - 1) reset();
    else go(step + 1);
  }
  function back() {
    if (step === 3 && arrowIndex > 0) setArrowIndex(arrowIndex - 1);
    else if (step === 2 && rankStage > 0) setRankStage(rankStage - 1);
    else if (step === 1 && withdrawn) setWithdrawn(false);
    else go(step - 1);
  }

  const initialCount = firstChoiceWithVisitor(scenarios.original.groups, firstVote)!;
  const withdrawalCount = firstChoiceWithVisitor(scenarios.original.groups, firstVote, ["A", "B"], withdrawalChoice);
  const withdrawalWinner = withdrawalCount?.winners.length === 1 ? withdrawalCount.winners[0] : null;
  const rankGroups = withVisitor(scenarios.original.groups, ballot);
  const ranked = runoff(rankGroups);
  const firstRound = ranked.rounds[0];
  const finalRound = ranked.rounds[ranked.rounds.length - 1];
  const eliminated = firstRound.eliminated;
  const runoffWinner = ranked.winners.length === 1 ? ranked.winners[0] : null;
  const points = positional(rankGroups);
  const bordaWinner = points.winners.length === 1 ? points.winners[0] : null;
  const condition = conditions[arrowIndex];
  const arrowSummary = step === 3 && arrowIndex === conditions.length;
  const winnerText = (id: CandidateId | null) => id ? <CandidateName id={id} /> : "A tie";
  const canContinue = step === 0 ? !!favourite : step === 1 ? !withdrawn || !!withdrawalCount : step === 2 ? rankStage > 0 || (!!rankFirst && !!rankBackup) : true;
  const nextLabel = step === 0 ? favourite ? `Vote for ${nameOf(favourite)}` : "Pick a candidate" : step === 1 ? withdrawn ? withdrawalCount ? "Try ranking instead" : "Pick a candidate" : "What if Kabir drops out?" : step === 2 ? ["Count the votes", "Next round", "Count with points instead", "Which way is fair?"][rankStage] : step === 3 ? arrowSummary ? "Run a simulation" : arrowIndex === conditions.length - 1 ? "What Arrow proved" : "Next check" : step === 4 ? "Last step" : "Start a new election";
  const title = step === 1 ? (withdrawn ? withdrawalCount ? `Without Kabir, ${withdrawalWinner ? nameOf(withdrawalWinner) : "nobody"} wins` : "Kabir dropped out. Who gets your vote now?" : chapters[1].title)
    : step === 2 ? [chapters[2].title, "Round 1", "Round 2", "The same ballots, counted with points"][rankStage]
    : step === 3 ? arrowSummary ? "No ranking rule passes all five checks" : condition.name
    : chapters[step].title;

  return <div className="app-shell guided-app">
    <a className="skip-link" href="#experience">Skip to election</a>
    <header className="app-header">
      <span className="wordmark"><svg className="brand-icon" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4 4 39h13L30 16Z" fill="var(--candidate-a)" /><path d="m24 4 20 35H31L18 16Z" fill="var(--candidate-b)" /><path d="M4 39h40l-7-12H11Z" fill="var(--candidate-c)" /><path d="m24 4 20 35H4Z" fill="none" stroke="currentColor" strokeWidth="2" /></svg>democracy<span className="wordmark-extension">.exe</span></span>
      {mode === "tour" && <nav className="chapter-progress" aria-label="Chapters"><ol>{chapters.map((c, i) => <li key={c.short}><button type="button" aria-current={i === step ? "step" : undefined} data-done={i < step} disabled={i > reached || i === step} onClick={() => go(i)}><span className="chapter-number">{i < step ? <Check aria-hidden="true" /> : i + 1}</span><span className="chapter-short">{c.short}</span></button></li>)}</ol></nav>}
      <div className="header-actions">
        <Dialog><DialogTrigger asChild><Button variant="ghost" size="sm">About</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>democracy.exe</DialogTitle><DialogDescription>A made-up school election about what makes a vote fair.</DialogDescription></DialogHeader><p className="body-copy">Vote for a prefect, see how the way we count changes who wins, and discover why no voting rule is perfect.</p><p className="fine-print">The candidates, their promises and all the ballots are made up for teaching, set at NPS Koramangala. Your first vote joins 100 pretend students. The fairness and score examples use their own small groups. Your choices stay on this device, and refreshing the page starts again.</p><p className="fine-print">Arrow’s theorem is about rules that only use rankings. Scores give extra information, so they raise different fairness questions.</p><a className="source-link" href="https://plato.stanford.edu/entries/arrows-theorem/" target="_blank" rel="noreferrer">Read more about Arrow’s theorem <ArrowUpRight data-icon="inline-end" /></a><a className="source-link" href="https://npskrm.com/investiture-2026-2027.html" target="_blank" rel="noreferrer">NPS Koramangala’s Student Council <ArrowUpRight data-icon="inline-end" /></a></DialogContent></Dialog>
        {(step > 0 || mode === "lab") && <Dialog open={resetOpen} onOpenChange={setResetOpen}><DialogTrigger asChild><Button variant="ghost" size="icon" aria-label="Start again"><RotateCcw /></Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Start a new election?</DialogTitle><DialogDescription>This clears your choices so the next visitor can start fresh.</DialogDescription></DialogHeader><DialogFooter><DialogClose asChild><Button variant="outline">Keep going</Button></DialogClose><Button onClick={reset}>Start again</Button></DialogFooter></DialogContent></Dialog>}
      </div>
    </header>
    <div className="workspace"><main id="experience" ref={mainRef} tabIndex={-1} className="experience-main">
      {mode === "lab" ? <Playground ballot={ballot} onReturn={() => setMode("tour")} /> : <>
        <div className="chapter-intro"><h1 className="chapter-question">{title}</h1></div>
        <div className="tour-stage" data-step={step} key={`${step}-${arrowIndex}-${withdrawn && !!withdrawalCount}-${rankStage}`}>
          {step === 0 && <ToggleGroup type="single" variant="campaign" size="campaign" value={favourite ?? ""} onValueChange={v => setFavourite((v || null) as CandidateId | null)} className="candidate-options" aria-label="Choose your prefect">
            {candidates.map(c => <ToggleGroupItem key={c.id} value={c.id} aria-label={`Choose ${c.name}`} aria-describedby={`campaign-${c.id}`}>
              <span className="campaign-portrait"><Portrait id={c.id} /></span>
              <span className="campaign-heading"><span className="campaign-name">{c.name} {c.surname}</span><span className="choice-circle">{favourite === c.id && <Check aria-hidden="true" />}</span></span>
              <span className="campaign-body" id={`campaign-${c.id}`}>
                <span className="campaign-quality">{c.quality}</span>
                <span className="campaign-proposals">{c.policies.map(p => <span key={p}>{p}</span>)}</span>
              </span>
            </ToggleGroupItem>)}
          </ToggleGroup>}

          {step === 1 && <div className="stage" aria-live="polite">
            {withdrawn && !withdrawalCount ? <PortraitChoices value={withdrawalChoice} exclude="C" label="My vote now" onChange={id => { setWithdrawalChoice(id); setRankBackup(id); }} />
              : <CountChart majority result={withdrawn ? withdrawalCount! : initialCount} eligible={withdrawn ? ["A", "B"] : [...candidateIds]} />}
          </div>}

          {step === 2 && (rankStage === 0 ? <div className="stage rank-stage">
            <FieldSet><FieldLegend>First choice</FieldLegend><CandidateChoices value={rankFirst} label="My favourite" onChange={id => { setRankFirst(id); setRankBackup(null); }} /></FieldSet>
            <FieldSet><FieldLegend>Second choice</FieldLegend>{rankFirst ? <CandidateChoices value={rankBackup} exclude={rankFirst} label="My backup" onChange={setRankBackup} /> : <p className="note">Pick your first choice first.</p>}</FieldSet>
          </div> : <div className="stage round-stage" aria-live="polite">
            {rankStage < 3 ? <>
              <BallotPiles groups={scenarios.original.groups} visitor={ballot} active={rankStage === 1 ? firstRound.active : finalRound.active} />
              <div className="round-side">
                {rankStage === 1 ? <CountChart majority result={firstRound} eligible={firstRound.active} /> : <CountChart majority result={finalRound} eligible={finalRound.active} moved={firstRound.transfers} movedFrom={eliminated} />}
                <AlgorithmCard active={rankStage === 1 ? ranked.rounds.length > 1 ? [2, 4] : [2, 3] : [2, 3]} />
              </div>
            </> : <>
              <PointsTable groups={rankGroups} />
              <div className="round-side"><CountChart result={points} unit="points" /></div>
            </>}
          </div>)}

          {step === 3 && (arrowSummary ? <div className="stage">
            <ol className="arrow-promises">{conditions.map(c => <li key={c.formal}><span>{c.name}</span><span>{c.formal}</span></li>)}</ol>
          </div> : <div className="stage">
            <ArrowExample index={arrowIndex} moved={iiaMoved} onMove={() => setIiaMoved(v => !v)} />
          </div>)}

          {step === 4 && <div className="stage"><SimulationLab model={simModel} onModelChange={setSimModel} /></div>}

          {step === 5 && <div className="stage decide-stage">
            <ToggleGroup type="single" orientation="vertical" variant="ballot" size="ballot" className="election-priorities" value={priority} onValueChange={v => v && setPriority(v)} aria-label="Your election priority">
              {decideOptions.map(o => <ToggleGroupItem key={o.id} value={o.id}><span className="decide-name">{o.name}</span><span className="decide-tradeoff">{o.detail}</span></ToggleGroupItem>)}
            </ToggleGroup>
            {firstVote && ballot && <dl className="journey-recap">
              <div><dt>One name each</dt><dd>{winnerText(initialCount.winners.length === 1 ? initialCount.winners[0] : null)}</dd></div>
              <div><dt>Instant runoff</dt><dd>{winnerText(runoffWinner)}</dd></div>
              <div><dt>Borda count</dt><dd>{winnerText(bordaWinner)}</dd></div>
              <div><dt>Your ranking</dt><dd><Ranking ranking={ballot} /></dd></div>
            </dl>}
            <Button variant="ghost" size="sm" className="playground-link" onClick={() => setMode("lab")}>Try your own rules <ArrowUpRight data-icon="inline-end" /></Button>
          </div>}
        </div>
        <footer className="tour-footer">
          {step > 0 ? <Button variant="ghost" onClick={back}><ArrowLeft data-icon="inline-start" />Back</Button> : <span />}
          {step === 3 && <nav className="condition-progress" aria-label="Fairness checks">{conditions.map((c, i) => <button key={c.formal} aria-label={`Review ${c.name}`} aria-current={arrowIndex === i ? "step" : undefined} disabled={i > arrowReached} onClick={() => setArrowIndex(i)}><span className="sr-only">{c.name}</span></button>)}</nav>}
          <Button size="lg" disabled={!canContinue} onClick={next}>{nextLabel}<ArrowRight data-icon="inline-end" /></Button>
        </footer>
      </>}
    </main></div>
  </div>;
}
