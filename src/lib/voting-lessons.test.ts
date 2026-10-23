import { test } from "node:test";
import assert from "node:assert/strict";
import { candidateIds, firstChoiceWithVisitor, pairwise, positional, runoff, scenarios, withVisitor, type CandidateId } from "./elections.ts";
import { orderingExample } from "./voting-lessons.ts";

test("the spoiler story changes the winner when Kabir enters, with the same 488 voters", () => {
  for (const vote of ["A", "B"] as const) {
    const before = firstChoiceWithVisitor(scenarios.original.groups, vote, ["A", "B"])!;
    const after = firstChoiceWithVisitor(scenarios.original.groups, vote)!;
    assert.deepEqual(before.winners, ["B"]);
    assert.deepEqual(after.winners, ["A"]);
    assert.equal(before.total, 488);
    assert.equal(after.total, before.total);
    assert.equal(before.counts.A - after.counts.A, 47);
    assert.equal(before.counts.B - after.counts.B, 89);
    assert.equal(after.counts.C, 136);
    assert.ok(before.counts.B > before.total / 2);
    assert.ok(after.counts.A < after.total / 2);
  }
});

test("the ordering example has three individually consistent ballots but cyclic majorities", () => {
  for (const [first, second] of [["A", "B"], ["B", "C"], ["C", "A"]] as [CandidateId, CandidateId][]) {
    const result = pairwise(orderingExample, first, second);
    assert.equal(result.total, 3);
    assert.deepEqual(result.winners, [first]);
    assert.equal(result.counts[first], 2);
    assert.equal(result.counts[second], 1);
  }
});

test("every visitor ranking conserves 488 runoff ballots and adds three Borda points", () => {
  for (const first of candidateIds) for (const backup of candidateIds.filter(id => id !== first)) {
    const third = candidateIds.find(id => id !== first && id !== backup)!;
    const groups = withVisitor(scenarios.original.groups, [first, backup, third]);
    const result = runoff(groups);
    assert.deepEqual(result.winners, ["B"]);
    for (const round of result.rounds) assert.equal(Object.values(round.counts).reduce((a, b) => a + b, 0), 488);
    // Kabir's 136 supporters split 89 to Meera and 47 to Aarav; a Kabir-first visitor joins their backup.
    const extra = (id: CandidateId) => first === "C" && backup === id ? 1 : 0;
    assert.deepEqual(result.rounds[0].transfers, { A: 47 + extra("A"), B: 89 + extra("B"), C: 0 });
    assert.equal(Object.values(positional(groups).counts).reduce((a, b) => a + b, 0), 1464);
  }
});
