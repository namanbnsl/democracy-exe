"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { Portrait } from "@/components/portrait";
import { CandidateName, CountChart, KabirSplit, PointsTable, Ranking } from "@/components/election-visuals";
import { SimulationLab } from "@/components/simulation-lab";
import { Playground } from "@/components/playground";
import { candidateIds, candidates, firstChoiceWithVisitor, nameOf, plurality, positional, runoff, scenarios, withVisitor, type CandidateId, type Counts } from "@/lib/elections";
import type { VoterModel } from "@/lib/simulation";

const chapters = [
  { short: "Vote", title: "Who should be School Prefect?" },
  { short: "Count", title: "Who wins?" },
  { short: "Rank", title: "Now rank your top two" },
  { short: "Simulate", title: "Does the way we count really matter?" },
  { short: "Decide", title: "How should our school count its votes?" },
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
  // 0: rank your choices, 1: the same ballots counted with points.
  const [rankStage, setRankStage] = useState(0);
  const [simModel, setSimModel] = useState<VoterModel>("random");
  const [priority, setPriority] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [step, mode]);

  function go(next: number) { setStep(next); setReached(r => Math.max(r, next)); setMode("tour"); }
  function reset() {
    setStep(0); setReached(0); setMode("tour"); setFavourite(null); setFirstVote(null); setWithdrawn(false); setWithdrawalChoice(null);
    setRankFirst(null); setRankBackup(null); setBallot(null); setRankStage(0);
    setSimModel("random"); setPriority(""); setResetOpen(false);
  }
  function cast() {
    if (!favourite) return;
    setFirstVote(favourite); setWithdrawn(false); setWithdrawalChoice(null); setRankFirst(favourite); setRankBackup(null);
    setBallot(null); setRankStage(0);
    setSimModel("random"); setPriority(""); setReached(1); go(1);
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
    else if (step === chapters.length - 1) reset();
    else go(step + 1);
  }
  function back() {
    if (step === 2 && rankStage > 0) setRankStage(rankStage - 1);
    else if (step === 1 && withdrawn) setWithdrawn(false);
    else go(step - 1);
  }

  const initialCount = firstChoiceWithVisitor(scenarios.original.groups, firstVote)!;
  const withdrawalCount = firstChoiceWithVisitor(scenarios.original.groups, firstVote, ["A", "B"], withdrawalChoice);
  const withdrawalWinner = withdrawalCount?.winners.length === 1 ? withdrawalCount.winners[0] : null;
  const rankGroups = withVisitor(scenarios.original.groups, ballot);
  const ranked = runoff(rankGroups);
  const runoffWinner = ranked.winners.length === 1 ? ranked.winners[0] : null;
  const points = positional(rankGroups);
  const bordaWinner = points.winners.length === 1 ? points.winners[0] : null;
  // Where Kabir's supporters go when he drops out, including the visitor's own backup.
  const kabirSplit: Counts = plurality(scenarios.original.groups.filter(g => g.ranking[0] === "C"), ["A", "B"]).counts;
  if (firstVote === "C" && withdrawalChoice) kabirSplit[withdrawalChoice] += 1;
  const winnerText = (id: CandidateId | null) => id ? <CandidateName id={id} /> : "A tie";
  const leader = initialCount.winners.length === 1 ? initialCount.winners[0] : null;
  const share = (id: CandidateId) => Math.round(initialCount.counts[id] / initialCount.total * 100);
  const bordaMargin = bordaWinner ? points.counts[bordaWinner] - Math.max(...candidateIds.filter(id => id !== bordaWinner).map(id => points.counts[id])) : 0;
  const canContinue = step === 0 ? !!favourite : step === 1 ? !withdrawn || !!withdrawalCount : step === 2 ? rankStage > 0 || (!!rankFirst && !!rankBackup) : true;
  const nextLabel = step === 0 ? favourite ? `Vote for ${nameOf(favourite)}` : "Pick a candidate" : step === 1 ? withdrawn ? withdrawalCount ? "Try ranking instead" : "Pick a candidate" : "What if Kabir drops out?" : step === 2 ? ["Count with points", "Does this happen often?"][rankStage] : step === 3 ? "Choose a method" : "Start a new election";
  const title = step === 1 ? (withdrawn ? withdrawalCount ? `Kabir’s votes split, and ${withdrawalWinner ? `${nameOf(withdrawalWinner)} wins` : "it’s a tie"}` : "Kabir drops out. Who gets your vote now?" : leader ? `${nameOf(leader)} wins with only ${share(leader)}% of the vote` : "It’s a tie")
    : step === 2 ? [chapters[2].title, bordaWinner ? `With points, ${nameOf(bordaWinner)} wins by ${bordaMargin}` : "With points, it’s a tie"][rankStage]
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
        <div className="tour-stage" data-step={step} key={`${step}-${withdrawn && !!withdrawalCount}-${rankStage}`}>
          {step === 0 && <ToggleGroup type="single" variant="campaign" size="campaign" value={favourite ?? ""} onValueChange={v => setFavourite((v || null) as CandidateId | null)} className="candidate-options" aria-label="Choose your prefect">
            {candidates.map(c => <ToggleGroupItem key={c.id} value={c.id} aria-label={`Choose ${c.name}`} aria-describedby={`campaign-${c.id}`}>
              <span className="campaign-portrait"><Portrait id={c.id} /></span>
              <span className="campaign-heading"><span className="campaign-name">{c.name} {c.surname}</span><span className="choice-circle">{favourite === c.id && <Check aria-hidden="true" />}</span></span>
              <span className="campaign-body" id={`campaign-${c.id}`}>
                <span className="campaign-grade">Grade {c.grade}</span>
                <span className="campaign-quality">{c.quality}</span>
                <span className="campaign-slogan">“{c.slogan}”</span>
                <span className="campaign-traits"><span data-trait="plus">{c.strength}</span><span data-trait="minus">{c.weakness}</span></span>
                <span className="campaign-proposals">{c.policies.map(p => <span key={p}>{p}</span>)}</span>
              </span>
            </ToggleGroupItem>)}
          </ToggleGroup>}

          {step === 1 && <div className="stage" aria-live="polite">
            {withdrawn && !withdrawalCount ? <PortraitChoices value={withdrawalChoice} exclude="C" label="My vote now" onChange={id => { setWithdrawalChoice(id); setRankBackup(id); }} />
              : withdrawn ? <div className="split-stage"><KabirSplit split={kabirSplit} /><CountChart majority result={withdrawalCount!} eligible={["A", "B"]} moved={kabirSplit} movedFrom="C" /></div>
              : <CountChart majority result={initialCount} eligible={[...candidateIds]} />}
          </div>}

          {step === 2 && (rankStage === 0 ? <div className="stage rank-stage">
            <FieldSet><FieldLegend>First choice</FieldLegend><CandidateChoices value={rankFirst} label="My favourite" onChange={id => { setRankFirst(id); setRankBackup(null); }} /></FieldSet>
            <FieldSet><FieldLegend>Second choice</FieldLegend>{rankFirst ? <CandidateChoices value={rankBackup} exclude={rankFirst} label="My backup" onChange={setRankBackup} /> : <p className="note">Pick your first choice first.</p>}</FieldSet>
          </div> : <div className="stage round-stage" aria-live="polite">
            <PointsTable groups={rankGroups} />
            <div className="round-side"><CountChart result={points} unit="points" /></div>
          </div>)}

          {step === 3 && <div className="stage"><SimulationLab model={simModel} onModelChange={setSimModel} /></div>}

          {step === 4 && <div className="stage decide-stage">
            <ToggleGroup type="single" orientation="vertical" variant="ballot" size="ballot" className="election-priorities" value={priority} onValueChange={v => v && setPriority(v)} aria-label="Your election priority">
              {decideOptions.map(o => <ToggleGroupItem key={o.id} value={o.id}><span className="decide-name">{o.name}</span><span className="decide-tradeoff">{o.detail}</span></ToggleGroupItem>)}
            </ToggleGroup>
            {firstVote && ballot && <dl className="journey-recap">
              <div><dt>One name each</dt><dd>{winnerText(initialCount.winners.length === 1 ? initialCount.winners[0] : null)}</dd></div>
              <div><dt>Instant runoff</dt><dd>{winnerText(runoffWinner)}</dd></div>
              <div><dt>Points (Borda)</dt><dd>{winnerText(bordaWinner)}</dd></div>
              <div><dt>Your ranking</dt><dd><Ranking ranking={ballot} /></dd></div>
            </dl>}
            <Button variant="ghost" size="sm" className="playground-link" onClick={() => setMode("lab")}>Try your own rules <ArrowUpRight data-icon="inline-end" /></Button>
          </div>}
        </div>
        <footer className="tour-footer">
          {step > 0 ? <Button variant="ghost" onClick={back}><ArrowLeft data-icon="inline-start" />Back</Button> : <span />}
          <Button size="lg" disabled={!canContinue} onClick={next}>{nextLabel}<ArrowRight data-icon="inline-end" /></Button>
        </footer>
      </>}
    </main></div>
  </div>;
}
