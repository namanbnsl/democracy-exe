"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Slider } from "@/components/ui/slider";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { BallotTable, CandidateName, Ranking, ResultCard } from "@/components/election-visuals";
import { approval, approvalGroups, blankCounts, candidateIds, condorcet, nameOf, positional, ratingGroups, scenarios, score, strategyGroups, withVisitor, type CandidateId, type Counts, type RatingGroup } from "@/lib/elections";

function RatingTable({ groups, unit }: { groups: RatingGroup[]; unit: string }) {
  return <Accordion type="single" collapsible><AccordionItem value="ratings"><AccordionTrigger>See all the {unit} ballots</AccordionTrigger><AccordionContent><table className="ballot-table"><thead><tr><th scope="col">Students</th>{candidateIds.map(id => <th scope="col" key={id}>{nameOf(id)}</th>)}</tr></thead><tbody>{groups.map((group, i) => <tr key={i}><td>{group.count}</td>{candidateIds.map(id => <td key={id}>{group.scores[id]}</td>)}</tr>)}</tbody></table></AccordionContent></AccordionItem></Accordion>;
}

export function Playground({ ballot, onReturn }: { ballot: CandidateId[] | null; onReturn: () => void }) {
  const [tab, setTab] = useState("points");
  const [scenario, setScenario] = useState("original");
  const [weights, setWeights] = useState([2, 1, 0]);
  const [population, setPopulation] = useState(scenarios.original.groups.map(group => group.count));
  const [ratings, setRatings] = useState<Counts>({ A: 5, B: 5, C: 5 });
  const [approved, setApproved] = useState<Counts>(blankCounts());
  const [strategic, setStrategic] = useState(false);
  const [ratingsStrategy, setRatingsStrategy] = useState(false);
  const groups = scenarios[scenario].groups.map((group, i) => ({ ...group, count: population[i] }));
  const current = withVisitor(groups, ballot);
  const pointResult = positional(current, weights);
  const condorcetWinner = condorcet(current);
  const preparedRatings = ratingGroups.map((group, i) => i === 0 && ratingsStrategy ? { ...group, scores: { A: 10, B: 0, C: 0 } } : group);
  const ratingResult = score([...preparedRatings, { count: 1, scores: ratings }]);
  const approvalResult = approval([...approvalGroups, { count: 1, scores: approved }]);
  const strategicResult = positional(strategyGroups(strategic));

  function changeScenario(value: string) {
    if (!value) return;
    setScenario(value); setPopulation(scenarios[value].groups.map(group => group.count));
  }

  return <>
    <div className="chapter-line"><span>Playground</span><Button variant="ghost" size="sm" onClick={onReturn}><ArrowLeft data-icon="inline-start" />Back to the election</Button></div>
    <div className="chapter-intro"><h1 className="chapter-question">How would you count the votes?</h1><p className="chapter-description">Change the rules and the voters, and watch the winner change. Every result is worked out live from your choices.</p></div>
    <Tabs value={tab} onValueChange={setTab}><TabsList variant="line" aria-label="Playground voting methods"><TabsTrigger value="points">Points</TabsTrigger><TabsTrigger value="ratings">Scores</TabsTrigger><TabsTrigger value="approval">Approval</TabsTrigger><TabsTrigger value="strategy">Tactical voting</TabsTrigger></TabsList>
      <TabsContent value="points">
        <div className="lab-toolbar"><ToggleGroup type="single" variant="outline" size="sm" value={scenario} onValueChange={changeScenario} aria-label="Playground class">{Object.entries(scenarios).map(([id, scenario]) => <ToggleGroupItem key={id} value={id}>{scenario.name}</ToggleGroupItem>)}</ToggleGroup><Button variant="ghost" size="sm" onClick={() => { setWeights([2, 1, 0]); setPopulation(scenarios[scenario].groups.map(g => g.count)); }}><RotateCcw data-icon="inline-start" />Reset rule</Button></div>
        <div className="lab-layout"><div className="lab-controls"><FieldGroup><FieldSet><FieldLegend>How many points is each place worth?</FieldLegend><FieldDescription>Every ballot gives these points to its 1st, 2nd and 3rd choice. Most points wins.</FieldDescription><FieldGroup>{weights.map((weight, i) => <Field key={i}><FieldLabel htmlFor={`points-${i}`}>{["First choice", "Second choice", "Third choice"][i]}<span className="field-value">{weight} {weight === 1 ? "point" : "points"}</span></FieldLabel><Slider id={`points-${i}`} aria-label={`${["First", "Second", "Third"][i]} choice points`} min={0} max={5} step={1} value={[weight]} onValueChange={([v]) => setWeights(prev => prev.map((w, j) => i === j ? v : w))} /></Field>)}</FieldGroup></FieldSet></FieldGroup><p className="fine-print">{weights.every(w => w === 0) ? "With zero points for everything, everyone ties." : weights[0] < weights[1] || weights[1] < weights[2] ? "Your rule gives a lower place more points than a higher one. Odd, but allowed. Watch what happens!" : "Try 1–0–0: that’s one-name voting. 2–1–0 is Borda."}</p></div><div className="live-result" aria-live="polite"><ResultCard method={`Your rule · ${weights.join("–")}`} result={pointResult} unit="points" description={`${pointResult.total} voters. ${ballot ? "Your ranking from the election is included." : "Finish the election to add your own ranking."}`} /><p className="fine-print">{condorcetWinner.length === 1 ? pointResult.winners.includes(condorcetWinner[0]) ? `${nameOf(condorcetWinner[0])} would also beat each other candidate one-on-one.` : `${nameOf(condorcetWinner[0])} would beat each other candidate one-on-one, but your rule doesn’t pick them.` : "No candidate beats every other candidate one-on-one here."}</p></div></div>
        <Accordion type="single" collapsible><AccordionItem value="electorate"><AccordionTrigger>Change how many students voted each way</AccordionTrigger><AccordionContent><FieldGroup>{groups.map((group, i) => <Field key={i}><FieldLabel htmlFor={`population-${i}`}><Ranking ranking={group.ranking} /><span className="field-value">{group.count} students</span></FieldLabel><Slider id={`population-${i}`} aria-label={`Students ranking ${group.ranking.map(nameOf).join(", ")}`} min={1} max={300} step={1} value={[group.count]} onValueChange={([v]) => setPopulation(old => old.map((n, j) => i === j ? v : n))} /></Field>)}</FieldGroup></AccordionContent></AccordionItem></Accordion>
        <BallotTable groups={groups} visitor={ballot} /><p className="fine-print">A rule that seems fair here might still go wrong in a different election.</p>
      </TabsContent>
      <TabsContent value="ratings">
        <p className="scenario-description">Give each candidate a score from 0 to 10. The 487 pretend students have given their own scores too.</p>
        <div className="lab-layout"><div className="lab-controls"><FieldGroup><FieldSet><FieldLegend>Your scores</FieldLegend><FieldDescription>Your scores are added as one more student.</FieldDescription><FieldGroup>{candidateIds.map(id => <Field key={id}><FieldLabel htmlFor={`rating-${id}`}><CandidateName id={id} /><span className="field-value">{ratings[id]} / 10</span></FieldLabel><Slider id={`rating-${id}`} aria-label={`Rate ${nameOf(id)}`} min={0} max={10} step={1} value={[ratings[id]]} onValueChange={([v]) => setRatings(old => ({ ...old, [id]: v }))} /></Field>)}</FieldGroup></FieldSet></FieldGroup></div><div className="live-result" aria-live="polite"><ResultCard method="Score voting · add up all the scores" result={ratingResult} unit="points" description="Highest total wins. But your 8 out of 10 might mean something different from someone else’s." /></div></div>
        <div className="experiment-control"><div><p>What if Aarav’s fans exaggerate?</p><p className="fine-print">184 students really score Aarav 10, Meera 8, Kabir 0. What if they pretend not to like Meera at all?</p></div><ToggleGroup type="single" value={ratingsStrategy ? "tactical" : "honest"} onValueChange={v => v && setRatingsStrategy(v === "tactical")} variant="outline" aria-label="Rating strategy"><ToggleGroupItem value="honest">Honest: 10, 8, 0</ToggleGroupItem><ToggleGroupItem value="tactical">Tactical: 10, 0, 0</ToggleGroupItem></ToggleGroup></div><p className="fine-print">{ratingsStrategy ? "Meera loses 1,472 points even though nobody likes her less. She only just beats Kabir now. A little more exaggeration and the winner would change." : "Scores show how strongly people feel, but they also tempt people to exaggerate."}</p><RatingTable groups={preparedRatings} unit="score" />
      </TabsContent>
      <TabsContent value="approval">
        <p className="scenario-description">Tick everyone you’d be happy to have as prefect. You can tick one, several, or none.</p>
        <div className="lab-layout"><div className="lab-controls"><FieldGroup><FieldSet><FieldLegend>Your approval ballot</FieldLegend><FieldDescription>Each candidate you tick gets one vote from you.</FieldDescription><FieldGroup>{candidateIds.map(id => <Field key={id} orientation="horizontal"><Checkbox id={`approval-${id}`} checked={approved[id] === 1} onCheckedChange={v => setApproved(old => ({ ...old, [id]: v === true ? 1 : 0 }))} /><FieldLabel htmlFor={`approval-${id}`}><CandidateName id={id} portrait /></FieldLabel></Field>)}</FieldGroup></FieldSet></FieldGroup><Button variant="ghost" size="sm" onClick={() => setApproved(blankCounts())}>Clear my ticks</Button></div><div className="live-result" aria-live="polite"><ResultCard method="Approval voting" result={approvalResult} unit="approvals" description="You can support more than one candidate. But a tick for your favourite counts the same as a tick for someone who’s just OK." /></div></div><p className="discovery">Where do you draw the line between “OK” and “not OK”? Different students draw it in different places.</p><RatingTable groups={approvalGroups} unit="approval" />
      </TabsContent>
      <TabsContent value="strategy">
        <p className="scenario-description">A tiny election: five students, counted with Borda points. Two of them are Aarav fans whose real order is Aarav → Meera → Kabir.</p>
        <div className="lab-layout"><div className="lab-controls"><p className="small-label">What they really think</p><Ranking ranking={["A", "B", "C"]} /><Separator /><p className="small-label">What they write on the ballot</p><ToggleGroup type="single" orientation="vertical" value={strategic ? "tactical" : "honest"} onValueChange={v => v && setStrategic(v === "tactical")} variant="outline" aria-label="Reported ranking"><ToggleGroupItem value="honest"><span>Honest</span><Ranking ranking={["A", "B", "C"]} /></ToggleGroupItem><ToggleGroupItem value="tactical"><span>Tactical</span><Ranking ranking={["A", "C", "B"]} /></ToggleGroupItem></ToggleGroup><p className="fine-print">They could put Meera last to help Aarav, even though that’s not what they really think.</p></div><div className="live-result" aria-live="polite"><ResultCard method="Borda count · 2–1–0" result={strategicResult} unit="points" description={strategic ? "Aarav wins! By putting Meera last, the two fans each took one point away from her." : "Meera wins when everyone is honest."} /></div></div><BallotTable groups={strategyGroups(strategic)} /><p className="discovery">Sometimes lying on your ballot can help your favourite win. This shows it can happen with Borda; it doesn’t mean every rule works this way.</p>
      </TabsContent>
    </Tabs><Separator className="chapter-separator" /><div className="chapter-footer"><p className="fine-print">You pick the rule. You also pick its problems.</p><Button variant="outline" onClick={onReturn}>Return to the election <ArrowRight data-icon="inline-end" /></Button></div>
  </>;
}
