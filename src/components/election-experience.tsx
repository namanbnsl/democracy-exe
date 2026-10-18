"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Lightbulb, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";
import { Portrait } from "@/components/portrait";
import { AlgorithmCard, BallotPiles, BallotTable, CampaignDetails, CandidateName, CountChart, PointsTable, Ranking, TraitChips } from "@/components/election-visuals";
import { SimulationLab, outcomeReason, type SimulationSummary } from "@/components/simulation-lab";
import { Playground } from "@/components/playground";
import { candidateIds, candidates, firstChoiceWithVisitor, nameOf, pairwise, positional, runoff, scenarios, withVisitor, type CandidateId } from "@/lib/elections";
import type { VoterModel } from "@/lib/simulation";
import { independenceExample, orderingExample } from "@/lib/voting-lessons";

const chapters = [
  { short: "Vote", title: "Who would you vote for?", description: "Three students want to be School Prefect. Get to know them, then pick one." },
  { short: "Count", title: "Who wins the vote?", description: "Your vote is added to 100 pretend students. Each student picks just one name." },
  { short: "Backup", title: "What if you could pick a backup?", description: "This time, choose your favourite and a second choice." },
  { short: "Fairness", title: "Can we design a perfectly fair rule?", description: "Five things we’d want from any fair voting rule, one at a time." },
  { short: "Simulate", title: "How often does it go wrong?", description: "Let a computer run 1,000 pretend elections and keep score." },
  { short: "Decide", title: "So, what makes a vote fair?", description: "Every voting rule protects some things and gives up others. What matters most to you?" },
];

const conditions = [
  { name: "Every ballot counts", formal: "Unrestricted domain", explanation: "Students can rank the candidates in any order they honestly feel. The rule has to work for every possible mix of ballots, not just the easy ones.", question: "Could a rule just ignore unusual ballots?", answer: "No. Then some students wouldn’t really get a vote. A fair rule has to handle whatever ballots it’s given.", idea: "A fair rule can’t pick and choose which ballots to count." },
  { name: "No going in circles", formal: "Complete and transitive social ordering", explanation: "The result has to be a proper ranking. If the group puts Aarav above Meera, and Meera above Kabir, then Aarav must also be above Kabir.", question: "So who should win here?", answer: "There’s no clear answer. Each student’s own list makes sense. But when the majority decides each pair, the group’s list goes round in a circle. (This shows the problem; it isn’t a proof of Arrow’s theorem.)", idea: "Letting the majority decide each pair can go round in a circle." },
  { name: "If everyone agrees, the result agrees", formal: "Unanimity (weak Pareto)", explanation: "If every single student likes Aarav more than Meera, the result must also put Aarav above Meera.", question: "What if they disagree about Kabir?", answer: "It doesn’t matter. Everyone agreed on Aarav versus Meera, so the result must agree too.", idea: "When everyone agrees, the result should too." },
  { name: "Nobody is the boss", formal: "Non-dictatorship", explanation: "The rule can’t just copy one student’s ranking every time and ignore everybody else.", question: "If the winner matches my favourite once, am I the boss?", answer: "No. You’d only be the boss if the rule always followed you, no matter what everyone else wanted.", idea: "No single student should decide for everyone." },
  { name: "Other candidates can’t flip a pair", formal: "Independence of irrelevant alternatives", explanation: "Whether the group prefers Aarav or Meera should depend only on how students rank Aarav and Meera. Moving Kabir up or down shouldn’t flip it.", question: "Why is this a problem?", answer: "Only Kabir moved. Every student still ranks Aarav and Meera the same way, but the Borda result flipped. So Borda breaks this check.", idea: "Borda points can break this check." },
];

function KeyIdea({ children }: { children: ReactNode }) {
  return <p className="key-idea"><Lightbulb aria-hidden="true" /><span><strong>Big idea:</strong> {children}</span></p>;
}

function CandidateChoices({ value, onChange, exclude, label }: { value: CandidateId | null; onChange: (id: CandidateId) => void; exclude?: CandidateId | null; label: string }) {
  return <ToggleGroup type="single" variant="ballot" size="ballot" orientation="vertical" value={value ?? ""} onValueChange={v => v && onChange(v as CandidateId)} className="preference-choices" aria-label={label}>
    {candidates.filter(c => c.id !== exclude).map(c => <ToggleGroupItem key={c.id} value={c.id} aria-label={`${label}: ${c.name}`}>
      <span className="mini-portrait"><Portrait id={c.id} small /></span>
      <span className="preference-person"><span>{c.name}</span><span>{c.ballotLine}</span></span>
      <Check className="preference-check" aria-hidden="true" />
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
    <p className="example-caption">Three students. Compare the candidates two at a time: who do most students prefer?</p>
    <PreferenceExample orders={orderingExample.map(g => g.ranking)} />
    <div className="pair-results">{([["A", "B"], ["B", "C"], ["C", "A"]] as [CandidateId, CandidateId][]).map(([a, b]) => {
      const result = pairwise(orderingExample, a, b);
      return <p key={a}><CandidateName id={a} /><span>beats</span><CandidateName id={b} /><span>{result.counts[a]} students to {result.counts[b]}</span></p>;
    })}</div>
    <p className="example-conclusion">It’s a circle, like rock–paper–scissors. Every candidate loses to someone!</p>
  </div>;
  if (index === 2) return <div className="arrow-example-stack">
    <p className="example-caption">All three students put Aarav above Meera.</p>
    <PreferenceExample orders={[["A", "B", "C"], ["A", "C", "B"], ["C", "A", "B"]]} />
    <p className="example-conclusion"><span>So the result must put</span><CandidateName id="A" /><span>above</span><CandidateName id="B" /></p>
  </div>;
  if (index === 3) return <div className="arrow-example-stack">
    <PreferenceExample orders={[["A", "B", "C"], ["B", "C", "A"], ["C", "B", "A"]]} />
    <div className="copy-example"><p>Imagine a rule that always copies Student 1:</p><Ranking ranking={["A", "B", "C"]} /><p className="fine-print">Students 2 and 3 both put Aarav last, but it makes no difference. That’s not fair.</p></div>
  </div>;
  const groups = independenceExample(moved);
  const result = positional(groups);
  const leader = result.counts.A > result.counts.B ? "A" : "B";
  const other = leader === "A" ? "B" : "A";
  return <div className="arrow-example-stack">
    <p className="example-caption">Five students, counted with Borda points: 2 for 1st choice, 1 for 2nd. Watch Aarav and Meera.</p>
    <div className="preference-example">{groups.map((g, i) => <div key={i}><span className="example-person">{g.count} students</span><Ranking ranking={g.ranking} /></div>)}</div>
    <div className="pair-points"><div><CandidateName id="A" /><span>{result.counts.A} points</span></div><div><CandidateName id="B" /><span>{result.counts.B} points</span></div></div>
    <p className="example-conclusion">{moved ? `Now ${nameOf(leader)} is ahead, ${result.counts[leader]} to ${result.counts[other]}, but nobody changed their mind about Aarav versus Meera!` : `${nameOf(leader)} is ahead of ${nameOf(other)}, ${result.counts[leader]} points to ${result.counts[other]}.`}</p>
    <Button variant="outline" onClick={onMove}>{moved ? "Put Kabir back" : "Move Kabir up for the first 3 students"}</Button>
  </div>;
}

export function ElectionExperience() {
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [mode, setMode] = useState<"tour" | "lab">("tour");
  const [favourite, setFavourite] = useState<CandidateId | null>(null);
  const [firstVote, setFirstVote] = useState<CandidateId | null>(null);
  const [prediction, setPrediction] = useState<CandidateId | null>(null);
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
  const [simSummary, setSimSummary] = useState<SimulationSummary | null>(null);
  const [priority, setPriority] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [step, mode, arrowIndex]);

  function go(next: number) { setStep(next); setReached(r => Math.max(r, next)); setMode("tour"); }
  function reset() {
    setStep(0); setReached(0); setMode("tour"); setFavourite(null); setFirstVote(null); setPrediction(null); setWithdrawn(false); setWithdrawalChoice(null);
    setRankFirst(null); setRankBackup(null); setBallot(null); setRankStage(0);
    setArrowIndex(0); setArrowReached(0); setIiaMoved(false); setSimModel("random"); setSimSummary(null); setPriority(""); setResetOpen(false);
  }
  function cast() {
    if (!favourite) return;
    setFirstVote(favourite); setPrediction(null); setWithdrawn(false); setWithdrawalChoice(null); setRankFirst(favourite); setRankBackup(null);
    setBallot(null); setRankStage(0);
    setArrowIndex(0); setArrowReached(0); setIiaMoved(false); setSimModel("random"); setSimSummary(null); setPriority(""); setReached(1); go(1);
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
  const needed = Math.floor(ranked.total / 2) + 1;
  const points = positional(rankGroups);
  const bordaWinner = points.winners.length === 1 ? points.winners[0] : null;
  // Finishing order: runoff by the round each candidate lasted to, Borda by points.
  const runoffOrder = [...candidateIds].sort((a, b) => ranked.rounds.filter(r => r.active.includes(b)).length - ranked.rounds.filter(r => r.active.includes(a)).length || finalRound.counts[b] - finalRound.counts[a]);
  const bordaOrder = [...candidateIds].sort((a, b) => points.counts[b] - points.counts[a]);
  const transferList = eliminated && firstRound.transfers ? candidateIds.filter(id => firstRound.transfers![id] > 0).map(id => `${firstRound.transfers![id]} to ${nameOf(id)}`) : [];
  const condition = conditions[arrowIndex];
  const arrowSummary = step === 3 && arrowIndex === conditions.length;
  const leaderVotes = Math.max(...candidateIds.map(id => initialCount.counts[id]));
  const leader = initialCount.winners[0];
  const yourNextChoice = ballot && eliminated ? ballot.find(id => id !== eliminated)! : null;
  const winnerText = (id: CandidateId | null) => id ? <CandidateName id={id} /> : "A tie";
  const canContinue = step === 0 ? !!favourite : step === 1 ? !withdrawn || !!withdrawalCount : step === 2 ? rankStage > 0 || (!!rankFirst && !!rankBackup) : true;
  const nextLabel = step === 0 ? favourite ? `Vote for ${nameOf(favourite)}` : "Pick a candidate" : step === 1 ? withdrawn ? "Try a better ballot" : "What if Kabir drops out?" : step === 2 ? ["Add my ballot and count", "Knock out last place", "Try counting with points", "Which way is fairest?"][rankStage] : step === 3 ? arrowSummary ? "Run a simulation" : arrowIndex === conditions.length - 1 ? "What did Arrow prove?" : "Next check" : step === 4 ? "Make your choice" : "Start a new election";
  const heading = step === 1 && withdrawn ? withdrawalCount ? [`Kabir drops out, and now ${withdrawalWinner ? nameOf(withdrawalWinner) : "nobody"} wins`, "Nobody changed their mind. The only change is that Kabir left the race."] : ["Kabir drops out", "Your favourite has left the race."] : arrowSummary ? ["No ranking rule can pass all five checks, every time", "Economist Kenneth Arrow proved this in 1951. It’s called Arrow’s impossibility theorem."] : [chapters[step].title, chapters[step].description];

  return <div className="app-shell guided-app">
    <a className="skip-link" href="#experience">Skip to election</a>
    <header className="app-header">
      <span className="wordmark"><svg className="brand-icon" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4 4 39h13L30 16Z" fill="var(--candidate-a)" /><path d="m24 4 20 35H31L18 16Z" fill="var(--candidate-b)" /><path d="M4 39h40l-7-12H11Z" fill="var(--candidate-c)" /><path d="m24 4 20 35H4Z" fill="none" stroke="currentColor" strokeWidth="2" /></svg>democracy<span className="wordmark-extension">.exe</span></span>
      {mode === "tour" && <nav className="chapter-progress" aria-label="Chapters"><ol>{chapters.map((c, i) => <li key={c.short}><button type="button" aria-current={i === step ? "step" : undefined} data-done={i < step} disabled={i > reached || i === step} onClick={() => go(i)}><span className="chapter-number">{i < step ? <Check aria-hidden="true" /> : i + 1}</span><span className="chapter-short">{c.short}</span></button></li>)}</ol></nav>}
      <div className="header-actions">
        <Dialog><DialogTrigger asChild><Button variant="ghost" size="sm">About</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>democracy.exe</DialogTitle><DialogDescription>A pretend school election that asks: what makes a vote fair?</DialogDescription></DialogHeader><p className="body-copy">Vote for a prefect, see how the way we count changes who wins, and discover why no voting rule is perfect.</p><p className="fine-print">The candidates, their promises and all the ballots are made up for teaching, set at NPS Koramangala. Your first vote joins 100 pretend students. The fairness and score examples use their own small groups. Your choices stay on this device, and refreshing the page starts again.</p><p className="fine-print">Arrow’s theorem is about rules that only use rankings. Scores give extra information, so they raise different fairness questions.</p><a className="source-link" href="https://plato.stanford.edu/entries/arrows-theorem/" target="_blank" rel="noreferrer">Read more about Arrow’s theorem <ArrowUpRight data-icon="inline-end" /></a><a className="source-link" href="https://npskrm.com/investiture-2026-2027.html" target="_blank" rel="noreferrer">NPS Koramangala’s Student Council <ArrowUpRight data-icon="inline-end" /></a></DialogContent></Dialog>
        {(step > 0 || mode === "lab") && <Dialog open={resetOpen} onOpenChange={setResetOpen}><DialogTrigger asChild><Button variant="ghost" size="icon" aria-label="Start again"><RotateCcw /></Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Start a new election?</DialogTitle><DialogDescription>This clears your choices so the next visitor can start fresh.</DialogDescription></DialogHeader><DialogFooter><DialogClose asChild><Button variant="outline">Keep going</Button></DialogClose><Button onClick={reset}>Start again</Button></DialogFooter></DialogContent></Dialog>}
      </div>
    </header>
    <div className="workspace"><main id="experience" ref={mainRef} tabIndex={-1} className="experience-main">
      {mode === "lab" ? <Playground ballot={ballot} onReturn={() => setMode("tour")} /> : <>
        <div className="chapter-intro"><h1 className="chapter-question">{heading[0]}</h1><p className="chapter-description">{heading[1]}</p></div>
        <div className="tour-stage" data-step={step} key={`${step}-${arrowIndex}-${withdrawn && !!withdrawalCount}-${rankStage}`}>
          {step === 0 && <ToggleGroup type="single" variant="campaign" size="campaign" value={favourite ?? ""} onValueChange={v => setFavourite((v || null) as CandidateId | null)} className="candidate-options" aria-label="Choose your prefect">
            {candidates.map(c => <div key={c.id} className="candidate-slot" data-candidate={c.id}>
              <ToggleGroupItem value={c.id} aria-label={`Choose ${c.name}`} aria-describedby={`campaign-${c.id}`}>
                <span className="campaign-portrait"><Portrait id={c.id} /></span>
                <span className="campaign-heading"><span className="campaign-name">{c.name} {c.surname}</span><span className="choice-circle">{favourite === c.id && <Check aria-hidden="true" />}</span></span>
                <span className="campaign-focus">{c.classLine}</span>
                <span className="campaign-body" id={`campaign-${c.id}`}>
                  <span className="campaign-slogan">{c.slogan}</span>
                  <TraitChips traits={c.traits} />
                  <span className="candidate-quote">“{c.quote}”</span>
                  <span className="campaign-proposals">{c.pledges.map(p => <span key={p.title}>{p.title}</span>)}</span>
                </span>
              </ToggleGroupItem>
              <CampaignDetails id={c.id} onChoose={setFavourite} />
            </div>)}
          </ToggleGroup>}

          {step === 1 && <div className="lesson-layout">
            <section className="lesson-activity" aria-label="Election result" aria-live="polite">
              {withdrawn && !withdrawalCount ? <FieldGroup><FieldSet><FieldLegend>You voted for Kabir, but he has dropped out. Who gets your vote now?</FieldLegend><CandidateChoices value={withdrawalChoice} exclude="C" label="My vote now" onChange={id => { setWithdrawalChoice(id); setRankBackup(id); }} /></FieldSet></FieldGroup> : <CountChart majority result={withdrawn ? withdrawalCount! : initialCount} eligible={withdrawn ? ["A", "B"] : [...candidateIds]} />}
              {withdrawn && withdrawalCount && <p className="transfer-caption">All 25 pretend students who voted for Kabir liked Meera second best, so their votes move to her. {firstVote === "C" ? `Your vote moves to ${nameOf(withdrawalChoice!)}.` : `Your vote stays with ${nameOf(firstVote!)}.`}</p>}
            </section>
            <div className="lesson-explanation">
              {!withdrawn ? <>
                <h2>Most votes, but not most students</h2>
                <p>{nameOf(leader)} is in front with {leaderVotes} votes. But {initialCount.total - leaderVotes} of the {initialCount.total} students voted for someone else.</p>
                <p>More than half is called a <strong>majority</strong>. Nobody has one.</p>
                <div className="prediction"><p>Kabir is in last place. What if he drops out? <strong>Make a guess:</strong> who would win then?</p><ToggleGroup type="single" variant="outline" value={prediction ?? ""} onValueChange={v => setPrediction((v || null) as CandidateId | null)} aria-label="Your prediction">{(["A", "B"] as CandidateId[]).map(id => <ToggleGroupItem key={id} value={id}><CandidateName id={id} /></ToggleGroupItem>)}</ToggleGroup></div>
                <KeyIdea>Getting the most votes doesn’t mean most people chose you.</KeyIdea>
              </> : !withdrawalCount ? <>
                <h2>Your vote needs a new home</h2>
                <p>Kabir isn’t running any more. Pick who you’d vote for instead, and we’ll count again.</p>
              </> : <>
                <h2>Kabir was a spoiler</h2>
                {prediction && <p className="prediction-result" data-correct={prediction === withdrawalWinner}>{prediction === withdrawalWinner ? `You guessed ${nameOf(prediction)}. You were right!` : `You guessed ${nameOf(prediction)}. Surprised? Kabir’s voters liked Meera more than Aarav.`}</p>}
                <p>Kabir couldn’t win, but he took votes that would have gone to Meera. A candidate who changes the result without winning is called a <strong>spoiler</strong>.</p>
                <KeyIdea>A candidate who can’t win can still change who wins.</KeyIdea>
                <BallotTable groups={scenarios.original.groups} />
              </>}
            </div>
          </div>}

          {step === 2 && <div className="lesson-layout">
            {rankStage === 0 ? <>
              <div className="lesson-activity preference-editor"><FieldGroup><FieldSet><FieldLegend>1. Your favourite</FieldLegend><CandidateChoices value={rankFirst} label="My favourite" onChange={id => { setRankFirst(id); setRankBackup(null); }} /></FieldSet><FieldSet><FieldLegend>2. Your backup, if your favourite is knocked out</FieldLegend>{rankFirst ? <CandidateChoices value={rankBackup} exclude={rankFirst} label="My backup" onChange={setRankBackup} /> : <p className="fine-print">Pick your favourite first.</p>}</FieldSet></FieldGroup></div>
              <div className="lesson-explanation">
                <h2>Why a backup helps</h2>
                <p>Kabir’s voters liked Meera second, but a one-name ballot couldn’t say so. A <strong>ranked ballot</strong> can. If your favourite is knocked out, your vote moves to your backup.</p>
                <p>The counting rule is called <strong>instant runoff</strong>. Like any counting rule, it’s an <strong>algorithm</strong>: exact steps that a person or a computer can follow.</p>
                <AlgorithmCard />
                <KeyIdea>A backup isn’t an extra vote. It’s where your one vote goes next.</KeyIdea>
              </div>
            </> : <>
              <section className="lesson-activity" aria-label={rankStage === 3 ? "Counting with points" : `Round ${rankStage}`} aria-live="polite">
                <ol className="stage-steps" aria-label="Counting steps">{["Your ballot", "Round 1", "Round 2", "Points"].map((label, i) => <li key={label} data-done={i < rankStage} aria-current={i === rankStage ? "step" : undefined}>{label}</li>)}</ol>
                {rankStage < 3 ? <>
                  <p className="activity-heading">The ballots</p>
                  <BallotPiles groups={scenarios.original.groups} visitor={ballot} active={rankStage === 1 ? firstRound.active : finalRound.active} />
                  <p className="activity-heading">The count</p>
                  {rankStage === 1 ? <CountChart majority result={firstRound} eligible={firstRound.active} /> : <CountChart majority result={finalRound} eligible={finalRound.active} moved={firstRound.transfers} movedFrom={eliminated} />}
                </> : <>
                  <p className="activity-heading">Working out the points</p>
                  <PointsTable groups={rankGroups} />
                  <p className="fine-print">3rd choices get 0 points, so they’re not shown.</p>
                  <p className="activity-heading">The result</p>
                  <CountChart result={points} unit="points" />
                </>}
              </section>
              <div className="lesson-explanation">
                {rankStage === 1 ? <>
                  <p className="eyebrow">Instant runoff · Round 1</p>
                  <h2>Count everyone’s favourite</h2>
                  <p>To win you need more than half: <strong>{needed} of {ranked.total}</strong>. {ranked.rounds.length > 1 && eliminated ? <>Nobody has that, so last place, <strong>{nameOf(eliminated)}</strong>, is knocked out.</> : `${runoffWinner ? nameOf(runoffWinner) : "Nobody"} already has it.`}</p>
                  <AlgorithmCard active={ranked.rounds.length > 1 ? [2, 4] : [2, 3]} label="Round 1" />
                  <KeyIdea>Knocked-out ballots aren’t thrown away. They move to their next choice.</KeyIdea>
                </> : rankStage === 2 ? <>
                  <p className="eyebrow">Instant runoff · Round 2</p>
                  <h2>{eliminated ? `${nameOf(eliminated)}’s ballots move to their backup` : "The final count"}</h2>
                  <p>{eliminated && (transferList.length === 1 ? `All ${firstRound.counts[eliminated]} of ${nameOf(eliminated)}’s ballots move to ${nameOf(candidateIds.find(id => firstRound.transfers![id] > 0)!)}. ` : `${nameOf(eliminated)}’s ballots move: ${transferList.join(" and ")}. `)}{runoffWinner ? <>{nameOf(runoffWinner)} now has <strong>{finalRound.counts[runoffWinner]} of {ranked.total}</strong>, more than half, so {nameOf(runoffWinner)} wins.</> : "It’s a tie."}</p>
                  {ballot && eliminated && <p className="fine-print">{ballot[0] === eliminated ? `Your ballot moved too, to ${nameOf(yourNextChoice!)}.` : `Your ballot stayed with ${nameOf(ballot[0])}, who is still in the race.`}</p>}
                  <AlgorithmCard active={[2, 3]} label="Round 2" />
                  <KeyIdea>{runoffWinner && withdrawalWinner === runoffWinner ? "Same winner as when Kabir dropped out, but nobody had to quit. The backups told us what his voters wanted." : "A vote for someone who can’t win isn’t wasted. It moves on to your backup."}</KeyIdea>
                </> : <>
                  <p className="eyebrow">Another way to count</p>
                  <h2>Same ballots, counted with points</h2>
                  <p><strong>Borda</strong> has no rounds: 2 points for a 1st choice, 1 for a 2nd. Most points wins. {bordaWinner ? `${nameOf(bordaWinner)} wins${bordaWinner === runoffWinner ? " again" : ""}.` : "It’s a tie."}</p>
                  {runoffOrder[1] !== bordaOrder[1] && <p>But 2nd place changes. Instant runoff knocked {nameOf(runoffOrder[2])} out first. With points, {nameOf(bordaOrder[1])} beats {nameOf(bordaOrder[2])}, thanks to all those 2nd choices.</p>}
                  <KeyIdea>The same ballots can give different results, depending on how you count them. So which way is fair?</KeyIdea>
                </>}
              </div>
            </>}
          </div>}

          {step === 3 && (arrowSummary ? <div className="lesson-layout">
            <ol className="arrow-promises">{conditions.map(c => <li key={c.formal}><span>{c.name}</span><span>{c.formal}</span></li>)}</ol>
            <div className="lesson-explanation"><h2>What Arrow proved</h2><p>With three or more candidates and at least two voters, every rule that only uses rankings fails at least one of these checks for some set of ballots.</p><KeyIdea>There is no perfect ranking rule. Every rule has to give something up.</KeyIdea><p>Arrow tells us problems <em>can</em> happen. Next, we’ll ask a computer how <em>often</em> they do.</p></div>
          </div> : <div className="lesson-layout">
            <section className="lesson-activity" aria-label={condition.name}><ArrowExample index={arrowIndex} moved={iiaMoved} onMove={() => setIiaMoved(v => !v)} /></section>
            <div className="lesson-explanation"><p className="eyebrow">Fairness check {arrowIndex + 1} of {conditions.length}</p><h2>{condition.name}</h2><p className="condition-formal">Official name: {condition.formal}</p><p>{condition.explanation}</p><KeyIdea>{condition.idea}</KeyIdea><Accordion type="single" collapsible key={arrowIndex}><AccordionItem value="understand"><AccordionTrigger>Think about it: {condition.question}</AccordionTrigger><AccordionContent><p>{condition.answer}</p></AccordionContent></AccordionItem></Accordion></div>
          </div>)}

          {step === 4 && <div className="lesson-layout">
            <section className="lesson-activity" aria-label="Simulation"><SimulationLab model={simModel} onModelChange={setSimModel} onProgress={setSimSummary} /></section>
            <div className="lesson-explanation" aria-live="polite">
              <p className="eyebrow">Computer science · Simulation</p>
              {!simSummary || simSummary.phase === "intro" ? <>
                <h2>What is a simulation?</h2>
                <p>We can’t hold 1,000 real school elections. But a computer can make up 1,000 <em>pretend</em> classes in under a second, count every one, and keep score. That kind of computer experiment is called a <strong>simulation</strong>.</p>
                <p>It’s a way to ask: if Arrow says rules <em>can</em> go wrong, how <em>often</em> do they?</p>
                <p>Let’s start with just one class, so you can see every step.</p>
                <KeyIdea>A simulation is an experiment you run on a computer instead of in real life.</KeyIdea>
              </> : simSummary.phase === "sample" && simSummary.sample ? <>
                <h2>That’s one pretend election</h2>
                <p>The computer made up the students, counted their ballots three ways, and checked every pair one-on-one. {outcomeReason(simSummary.sample)}</p>
                <p>How did it make up the students? {simSummary.model === "random" ? "It picked each student’s order at random. Real students don’t choose like that, but it’s a simple starting guess." : "It placed everyone on a line and had each student rank candidates from nearest to furthest. That’s a different guess about how people choose."} A guess like this is called a <strong>model</strong>.</p>
                <p>One class could just be lucky or unlucky. To find out what’s <em>usual</em>, we repeat the same steps many times.</p>
                <KeyIdea>Each pretend class becomes one coloured square. Then we count the colours.</KeyIdea>
              </> : simSummary.phase === "running" ? <>
                <h2>Repeating the steps…</h2>
                <p>The computer is doing exactly what you saw, over and over: make up a class, count it, colour a square.</p>
              </> : simSummary.model === "random" ? <>
                <h2>About 1 in {Math.max(1, Math.round(simSummary.done / Math.max(1, simSummary.counts.circle)))} classes has no clear winner</h2>
                <p><span className="inline-key" data-outcome="circle" />Red squares are circles, like rock–paper–scissors. Every candidate loses to someone one-on-one.</p>
                <p><span className="inline-key" data-outcome="disagree" />In another {Math.round(simSummary.counts.disagree / simSummary.done * 100)}%, the three counting rules didn’t agree on a winner.</p>
                <p>Press <strong>Run again</strong>: the numbers wobble a little, because the classes are random, but they stay close. The more elections we run, the steadier the answer.</p>
                <p>Then try <strong>Students on a spectrum</strong>. What do you think will change?</p>
                <KeyIdea>A simulation can’t prove a rule is fair. It estimates how often problems happen, for one model of voters.</KeyIdea>
              </> : <>
                <h2>{simSummary.counts.circle === 0 ? "On a spectrum, the circles disappear" : "Fewer circles on a spectrum"}</h2>
                <p>When everyone lines up on one scale, there’s always a candidate who beats everyone one-on-one.</p>
                <p>But the rules disagree even <em>more</em> often than with random students: {Math.round(simSummary.counts.disagree / simSummary.done * 100)}% of the time. One-name voting is the worst at picking the candidate who beats everyone one-on-one, often someone in the middle. Click a yellow square to see one.</p>
                <KeyIdea>Change the model of voters, and the answer changes. Simulations are only as good as their guesses about people.</KeyIdea>
              </>}
            </div>
          </div>}

          {step === 5 && <div className="lesson-layout">
            <FieldGroup><FieldSet><FieldLegend>I want a voting rule that…</FieldLegend><ToggleGroup type="single" orientation="vertical" variant="ballot" size="ballot" className="election-priorities" value={priority} onValueChange={v => v && setPriority(v)} aria-label="Your election priority"><ToggleGroupItem value="simple">is simple: everyone picks one name</ToggleGroupItem><ToggleGroupItem value="backups">uses backup choices</ToggleGroupItem><ToggleGroupItem value="strength">lets me show how much I like each one</ToggleGroupItem></ToggleGroup></FieldSet>
              {firstVote && ballot && <div className="journey-recap"><p className="eyebrow">Your election</p><dl>
                <div><dt>You voted for</dt><dd><CandidateName id={firstVote} portrait /></dd></div>
                <div><dt>Your ranking</dt><dd><Ranking ranking={ballot} /></dd></div>
                <div><dt>Winner: one name each</dt><dd>{winnerText(initialCount.winners.length === 1 ? initialCount.winners[0] : null)}</dd></div>
                <div><dt>Winner: instant runoff</dt><dd>{winnerText(runoffWinner)}</dd></div>
                <div><dt>Winner: points (Borda)</dt><dd>{winnerText(bordaWinner)}</dd></div>
              </dl></div>}
            </FieldGroup>
            <div className="lesson-explanation" aria-live="polite"><h2>{priority ? "What you gain, and what you give up" : "There’s no perfect answer"}</h2><p>{priority === "simple" ? <>That’s called <strong>plurality</strong> voting, the one we started with. It’s quick and easy to understand. But you saw the catch: a spoiler like Kabir can change who wins.</> : priority === "backups" ? <>That’s <strong>ranked</strong> voting, like instant runoff or Borda. It can help with spoilers. But Arrow showed that no ranking rule can pass every fairness check, every time.</> : priority === "strength" ? <>That’s <strong>score</strong> voting: give each candidate a score out of 10. Arrow’s theorem doesn’t cover it, because it isn’t just a ranking. But people use scores differently, and some might exaggerate to help their favourite.</> : "Pick one to see what you’d gain and what you’d give up."}</p><KeyIdea>Every voting rule is a trade-off.</KeyIdea><Button variant="outline" onClick={() => setMode("lab")}>Try your own rules in the playground <ArrowUpRight data-icon="inline-end" /></Button></div>
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
