import { test } from "node:test";
import assert from "node:assert/strict";
import { candidateIds, pairwise, positional, runoff, scenarios, score, withVisitor, type CandidateId } from "./elections.ts";
import { independenceExample, orderingExample, ratingGapExample } from "./voting-lessons.ts";

test("the ordering example has three individually consistent ballots but cyclic majorities", () => {
  for (const [first, second] of [["A", "B"], ["B", "C"], ["C", "A"]] as [CandidateId, CandidateId][]) {
    const result = pairwise(orderingExample, first, second);
    assert.equal(result.total, 3);
    assert.deepEqual(result.winners, [first]);
    assert.equal(result.counts[first], 2);
    assert.equal(result.counts[second], 1);
  }
});

test("Borda reverses Aarav and Meera when only Kabir's position changes", () => {
  const before = independenceExample(false);
  const after = independenceExample(true);
  assert.deepEqual(positional(before).counts, { A: 6, B: 7, C: 2 });
  assert.deepEqual(positional(after).counts, { A: 6, B: 4, C: 5 });
  before.forEach((group, i) => {
    assert.equal(group.count, after[i].count);
    assert.equal(group.ranking.indexOf("A") < group.ranking.indexOf("B"), after[i].ranking.indexOf("A") < after[i].ranking.indexOf("B"));
  });
});

test("reported score gaps can reverse the winner while each voter's order stays fixed", () => {
  const narrow = ratingGapExample(false);
  const wide = ratingGapExample(true);
  assert.deepEqual(score(narrow).counts, { A: 10, B: 15, C: 5 });
  assert.deepEqual(score(wide).counts, { A: 10, B: 7, C: 5 });
  assert.deepEqual(score(narrow).winners, ["B"]);
  assert.deepEqual(score(wide).winners, ["A"]);
  for (let i = 0; i < narrow.length; i++) {
    const order = (group: (typeof narrow)[number]) => [...candidateIds].sort((a, b) => group.scores[b] - group.scores[a]);
    assert.deepEqual(order(narrow[i]), order(wide[i]));
  }
});

test("every visitor ranking conserves 101 runoff ballots and adds three Borda points", () => {
  for (const first of candidateIds) for (const backup of candidateIds.filter(id => id !== first)) {
    const third = candidateIds.find(id => id !== first && id !== backup)!;
    const groups = withVisitor(scenarios.original.groups, [first, backup, third]);
    const result = runoff(groups);
    assert.deepEqual(result.winners, ["B"]);
    for (const round of result.rounds) assert.equal(Object.values(round.counts).reduce((a, b) => a + b, 0), 101);
    assert.equal(result.rounds[0].transfers?.[first === "C" ? backup : "B"], first === "C" ? backup === "B" ? 26 : 1 : 25);
    assert.equal(Object.values(positional(groups).counts).reduce((a, b) => a + b, 0), 303);
  }
});
