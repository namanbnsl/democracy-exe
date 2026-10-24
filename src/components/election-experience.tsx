"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { Portrait } from "@/components/portrait";
import { CandidateName, CountChart, PointsExplainer, Ranking, RunoffWalkthrough } from "@/components/election-visuals";
import { SimulationLab } from "@/components/simulation-lab";
import { candidateIds, candidates, firstChoiceWithVisitor, nameOf, runoff, scenarios, withVisitor, type CandidateId } from "@/lib/elections";
import type { VoterModel } from "@/lib/simulation";

const chapters = [
  { short: "Vote", title: "Who should be School Prefect?" },
  { short: "Count", title: "Who wins?" },
  { short: "Rank", title: "Now rank your top two" },
  { short: "Simulate", title: "Does the way we count really matter?" },
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

export function ElectionExperience() {
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [favourite, setFavourite] = useState<CandidateId | null>(null);
  const [firstVote, setFirstVote] = useState<CandidateId | null>(null);
  const [kabirEntered, setKabirEntered] = useState(false);
  const [rankFirst, setRankFirst] = useState<CandidateId | null>(null);
  const [rankBackup, setRankBackup] = useState<CandidateId | null>(null);
  const [ballot, setBallot] = useState<CandidateId[] | null>(null);
  // Rank a ballot, follow instant runoff, then count the same ballot with points.
  const [rankStage, setRankStage] = useState(0);
  const [simModel, setSimModel] = useState<VoterModel>("random");
  const [resetOpen, setResetOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
    stageRef.current?.scrollTo({ top: 0 });
  }, [step, kabirEntered, rankStage]);

  function go(next: number) { setStep(next); setReached(r => Math.max(r, next)); }
  function reset() {
    setStep(0); setReached(0); setFavourite(null); setFirstVote(null); setKabirEntered(false);
    setRankFirst(null); setRankBackup(null); setBallot(null); setRankStage(0);
    setSimModel("random"); setResetOpen(false);
  }
  function cast() {
    if (!favourite) return;
    setFirstVote(favourite); setKabirEntered(false); setRankFirst(favourite); setRankBackup(null);
    setBallot(null); setRankStage(0);
    setSimModel("random"); setReached(1); go(1);
  }
  function countRanking() {
    if (!rankFirst || !rankBackup) return;
    setBallot([rankFirst, rankBackup, candidateIds.find(id => id !== rankFirst && id !== rankBackup)!]);
    setRankStage(1);
  }
  function next() {
    if (step === 0) cast();
    else if (step === 1 && !kabirEntered) setKabirEntered(true);
    else if (step === 2 && rankStage === 0) countRanking();
    else if (step === 2 && rankStage === 1) setRankStage(2);
    else if (step === chapters.length - 1) setResetOpen(true);
    else go(step + 1);
  }
  function back() {
    if (step === 2 && rankStage > 0) setRankStage(rankStage - 1);
    else if (step === 1 && kabirEntered) setKabirEntered(false);
    else go(step - 1);
  }

  const initialCount = firstChoiceWithVisitor(scenarios.original.groups, firstVote)!;
  const twoCandidateCount = firstChoiceWithVisitor(scenarios.original.groups, firstVote, ["A", "B"])!;
  // The votes each side loses when Kabir joins are exactly the ones he picks up.
  const kabirTook = { A: twoCandidateCount.counts.A - initialCount.counts.A, B: twoCandidateCount.counts.B - initialCount.counts.B, C: 0 };
  const rankGroups = withVisitor(scenarios.original.groups, ballot);
  const ranked = runoff(rankGroups);
  const canContinue = step === 0 ? !!favourite : step === 2 ? rankStage > 0 || (!!rankFirst && !!rankBackup) : true;
  const nextLabel = step === 0 ? favourite ? `Vote for ${nameOf(favourite)}` : "Pick a candidate"
    : step === 1 ? kabirEntered ? "Try ranking" : "Kabir joins the race"
    : step === 2 ? ["Count my ranking", "Count with points", "Try more elections"][rankStage]
    : "Start again";
  const title = step === 1 ? "Can a new candidate change the winner?"
    : step === 2 ? ["Now rank your top two", "Instant runoff", "Points (Borda)"][rankStage]
    : chapters[step].title;

  return <div className="app-shell guided-app">
    <a className="skip-link" href="#experience">Skip to election</a>
    <header className="app-header">
      <span className="wordmark"><svg className="brand-icon" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4 4 39h13L30 16Z" fill="var(--candidate-a)" /><path d="m24 4 20 35H31L18 16Z" fill="var(--candidate-b)" /><path d="M4 39h40l-7-12H11Z" fill="var(--candidate-c)" /><path d="m24 4 20 35H4Z" fill="none" stroke="currentColor" strokeWidth="2" /></svg>democracy<span className="wordmark-extension">.exe</span></span>
      <nav className="chapter-progress" aria-label="Chapters"><ol>{chapters.map((c, i) => <li key={c.short}><button type="button" aria-current={i === step ? "step" : undefined} data-done={i < step} disabled={i > reached || i === step} onClick={() => go(i)}><span className="chapter-number">{i < step ? <Check aria-hidden="true" /> : i + 1}</span><span className="chapter-short">{c.short}</span></button></li>)}</ol></nav>
      <div className="header-actions">
        <Dialog open={resetOpen} onOpenChange={setResetOpen}><DialogTrigger asChild><Button variant="ghost" size="icon" aria-label="Start again" disabled={step === 0 && !favourite}><RotateCcw /></Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Start a new election?</DialogTitle><DialogDescription>This clears your choices so the next visitor can start fresh.</DialogDescription></DialogHeader><DialogFooter><DialogClose asChild><Button variant="outline">Keep going</Button></DialogClose><Button onClick={reset}>Start again</Button></DialogFooter></DialogContent></Dialog>
      </div>
    </header>
    <div className="workspace"><main id="experience" ref={mainRef} tabIndex={-1} className="experience-main">
        <div className="chapter-intro"><h1 className="chapter-question">{title}</h1></div>
        <div className="tour-stage" ref={stageRef} data-step={step}><div className="stage-enter" key={`${step}-${rankStage}`}>
          {step === 0 && <ToggleGroup type="single" variant="campaign" size="campaign" value={favourite ?? ""} onValueChange={v => setFavourite((v || null) as CandidateId | null)} className="candidate-options" aria-label="Choose your prefect">
            {candidates.filter(c => c.id !== "C").map(c => <ToggleGroupItem key={c.id} value={c.id} aria-label={`Choose ${c.name}`} aria-describedby={`campaign-${c.id}`}>
              <span className="campaign-portrait"><Portrait id={c.id} /><span className="campaign-slogan">“{c.slogan}”</span></span>
              <span className="campaign-heading"><span className="campaign-name">{c.name} {c.surname}</span><span className="choice-circle">{favourite === c.id && <Check aria-hidden="true" />}</span></span>
              <span className="campaign-body" id={`campaign-${c.id}`}>
                <span className="campaign-grade">Grade {c.grade}</span>
                <span className="campaign-quality">{c.quality}</span>
                <span className="campaign-traits"><span data-trait="plus">{c.strength}</span><span data-trait="minus">{c.weakness}</span></span>
                <span className="campaign-proposals">{c.policies.map(p => <span key={p}>{p}</span>)}</span>
              </span>
            </ToggleGroupItem>)}
          </ToggleGroup>}

          {step === 1 && <div className="spoiler-story" aria-live="polite">
            <div className="story-chapter"><h2>{kabirEntered ? "With Kabir" : "Without Kabir"}</h2><span className="story-electorate">{twoCandidateCount.total} voters · one name each</span></div>
            <div className="story-grid">
              <section className="story-results" aria-label={kabirEntered ? "After Kabir joins" : "Before Kabir joins"}>
                <p className="result-signal" key={String(kabirEntered)} data-signal={kabirEntered ? "bad" : "good"}>{kabirEntered ? "Winner changed: Aarav wins" : "Meera wins"}</p>
                <CountChart majority result={kabirEntered ? initialCount : twoCandidateCount} eligible={kabirEntered ? [...candidateIds] : ["A", "B"]} taken={kabirEntered ? { by: "C", from: kabirTook } : undefined} />
              </section>
              <aside className="story-explainer" key={String(kabirEntered)}>
                {kabirEntered ? <><h2 className="story-candidate"><span className="mini-portrait"><Portrait id="C" small /></span>Kabir Sen</h2><p>Runs the peer tutoring club.</p><p>136 students now choose Kabir.</p><div className="entry-flows"><p><strong>89</strong><span>from Meera’s side</span><ArrowRight aria-hidden="true" /><CandidateName id="C" /></p><p><strong>47</strong><span>from Aarav’s side</span><ArrowRight aria-hidden="true" /><CandidateName id="C" /></p></div><p className="fine-print">Kabir doesn’t win. But Meera loses enough votes for Aarav to take the lead. That’s the <strong>spoiler effect</strong>.</p></>
                  : <><div className="story-pair"><CandidateName id="A" portrait /><span>vs</span><CandidateName id="B" portrait /></div><h2>One name on each ballot</h2><p>Meera has more than half the votes, so she wins.</p></>}
              </aside>
            </div>
          </div>}

          {step === 2 && (rankStage === 0 ? <div className="stage rank-stage">
            <div className="rank-card"><FieldSet><FieldLegend>First choice</FieldLegend><CandidateChoices value={rankFirst} label="My favourite" onChange={id => { setRankFirst(id); setRankBackup(null); }} /></FieldSet></div>
            <div className="rank-card"><FieldSet><FieldLegend>Second choice</FieldLegend>{rankFirst ? <CandidateChoices value={rankBackup} exclude={rankFirst} label="My backup" onChange={setRankBackup} /> : <p className="note">Pick your first choice first.</p>}</FieldSet></div>
            <p className="ranking-preview">Your ballot: {rankFirst ? <Ranking ranking={rankBackup ? [rankFirst, rankBackup, candidateIds.find(id => id !== rankFirst && id !== rankBackup)!] : [rankFirst]} /> : "Waiting for your first choice"}</p>
          </div> : rankStage === 1 ? <RunoffWalkthrough result={ranked} /> : <div className="stage points-stage" aria-live="polite"><PointsExplainer groups={rankGroups} ballot={ballot} /></div>)}

          {step === 3 && <div className="stage"><SimulationLab model={simModel} onModelChange={setSimModel} /></div>}

        </div></div>
        <footer className="tour-footer">
          <Button variant="ghost" disabled={step === 0} onClick={back}><ArrowLeft data-icon="inline-start" />Back</Button>
          <Button size="lg" variant={step === chapters.length - 1 ? "outline" : "default"} disabled={!canContinue} onClick={next}>{nextLabel}{step === chapters.length - 1 ? <RotateCcw data-icon="inline-end" /> : <ArrowRight data-icon="inline-end" />}</Button>
        </footer>
    </main></div>
  </div>;
}
