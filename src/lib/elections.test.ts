import { test } from "node:test";
import assert from "node:assert/strict";
import { firstChoiceWithVisitor, approval, approvalGroups, condorcet, pairwise, plurality, positional, ratingGroups, runoff, scenarios, score, strategyGroups, validateGroups, withVisitor, type BallotGroup } from "./elections.ts";

test("plurality counts the original first choices", () => {
  assert.deepEqual(plurality(scenarios.original.groups), { counts: { A: 40, B: 35, C: 25 }, winners: ["A"], total: 100 });
});
test("withdrawal preserves voters and redirects their preferences", () => {
  assert.deepEqual(plurality(scenarios.original.groups, ["A", "B"]), { counts: { A: 40, B: 60, C: 0 }, winners: ["B"], total: 100 });
});
test("runoff records the elimination and all transferred ballots", () => {
  const result = runoff(scenarios.original.groups);
  assert.deepEqual(result.winners, ["B"]);
  assert.equal(result.rounds.length, 2);
  assert.equal(result.rounds[0].eliminated, "C");
  assert.deepEqual(result.rounds[0].transfers, { A: 0, B: 25, C: 0 });
  assert.deepEqual(result.counts, { A: 40, B: 60, C: 0 });
  for (const round of result.rounds) assert.equal(Object.values(round.counts).reduce((a, b) => a + b), 100);
});
test("Borda awards 2, 1, 0 correctly", () => {
  assert.deepEqual(positional(scenarios.original.groups).counts, { A: 80, B: 135, C: 85 });
});
test("three methods produce three different winners in the disagreement fixture", () => {
  const groups = scenarios.disagreement.groups;
  assert.deepEqual(plurality(groups).winners, ["A"]);
  assert.deepEqual(runoff(groups).winners, ["B"]);
  assert.deepEqual(positional(groups).winners, ["C"]);
  assert.deepEqual(condorcet(groups), ["C"]);
});
test("the three different winners survive any one visitor ballot", () => {
  const rankings: BallotGroup["ranking"][] = [["A", "B", "C"], ["A", "C", "B"], ["B", "A", "C"], ["B", "C", "A"], ["C", "A", "B"], ["C", "B", "A"]];
  for (const ranking of rankings) {
    const groups = withVisitor(scenarios.disagreement.groups, ranking);
    assert.deepEqual(plurality(groups).winners, ["A"]);
    assert.deepEqual(runoff(groups).winners, ["B"]);
    assert.deepEqual(positional(groups).winners, ["C"]);
  }
});
test("the cycle has the correct head-to-head majorities and no Condorcet winner", () => {
  const groups = scenarios.cycle.groups;
  assert.deepEqual(pairwise(groups, "A", "B").counts, { A: 67, B: 33, C: 0 });
  assert.deepEqual(pairwise(groups, "B", "C").counts, { A: 0, B: 68, C: 32 });
  assert.deepEqual(pairwise(groups, "C", "A").counts, { A: 35, B: 0, C: 65 });
  assert.deepEqual(condorcet(groups), []);
});
test("a visitor counts as exactly one extra voter", () => {
  const original = structuredClone(scenarios.original.groups);
  const groups = withVisitor(original, ["C", "A", "B"]);
  assert.equal(plurality(groups).total, 101);
  assert.deepEqual(plurality(groups).counts, { A: 40, B: 35, C: 26 });
  assert.deepEqual(plurality(groups, ["A", "B"]).counts, { A: 41, B: 60, C: 0 });
  assert.deepEqual(original, scenarios.original.groups);
});
test("first-round majority requires no elimination", () => {
  const result = runoff([{ count: 60, ranking: ["A", "B", "C"] }, { count: 40, ranking: ["B", "C", "A"] }]);
  assert.equal(result.rounds.length, 1);
  assert.deepEqual(result.winners, ["A"]);
});
test("plurality and final runoff ties are displayed without arbitrary tiebreaks", () => {
  const groups: BallotGroup[] = [{ count: 50, ranking: ["A", "B", "C"] }, { count: 50, ranking: ["B", "A", "C"] }];
  assert.deepEqual(plurality(groups).winners, ["A", "B"]);
  assert.deepEqual(runoff(groups).winners, ["A", "B"]);
});
test("a tied elimination stops instead of silently selecting a candidate", () => {
  const result = runoff([{ count: 40, ranking: ["A", "B", "C"] }, { count: 30, ranking: ["B", "C", "A"] }, { count: 30, ranking: ["C", "B", "A"] }]);
  assert.deepEqual(result.eliminationTie, ["B", "C"]);
  assert.deepEqual(result.winners, []);
});
test("all-zero custom points produce a three-way tie", () => {
  assert.deepEqual(positional(scenarios.original.groups, [0, 0, 0]).winners, ["A", "B", "C"]);
});
test("first-only custom points reproduce plurality", () => {
  assert.deepEqual(positional(scenarios.original.groups, [1, 0, 0]), plurality(scenarios.original.groups));
});
test("ratings use explicit cardinal data", () => {
  assert.deepEqual(score(ratingGroups), { counts: { A: 400, B: 870, C: 530 }, winners: ["B"], total: 100 });
});
test("approval counts each approved candidate", () => {
  assert.deepEqual(approval(approvalGroups), { counts: { A: 40, B: 100, C: 60 }, winners: ["B"], total: 100 });
});
test("the strategic-ballot fixture changes the result while the genuine preference stays fixed", () => {
  assert.deepEqual(positional(strategyGroups(false)).counts, { A: 6, B: 7, C: 2 });
  assert.deepEqual(positional(strategyGroups(true)).counts, { A: 6, B: 5, C: 4 });
  assert.deepEqual(positional(strategyGroups(false)).winners, ["B"]);
  assert.deepEqual(positional(strategyGroups(true)).winners, ["A"]);
});
test("invalid rankings, counts, scales and withdrawals are rejected", () => {
  assert.throws(() => validateGroups([]));
  assert.throws(() => validateGroups([{ count: 1, ranking: ["A", "A", "B"] }]));
  assert.throws(() => validateGroups([{ count: 1.5, ranking: ["A", "B", "C"] }]));
  assert.throws(() => validateGroups([{ count: -1, ranking: ["A", "B", "C"] }]));
  assert.throws(() => validateGroups([{ count: 0, ranking: ["A", "B", "C"] }]));
  assert.throws(() => positional(scenarios.original.groups, [Infinity, 1, 0]));
  assert.throws(() => plurality(scenarios.original.groups, []));
  assert.throws(() => plurality(scenarios.original.groups, ["A", "A"]));
  assert.throws(() => pairwise(scenarios.original.groups, "A", "A"));
  assert.throws(() => score([{ count: 1, scores: { A: 11, B: 5, C: 0 } }]));
  assert.throws(() => approval([{ count: 1, scores: { A: 1, B: 0.5, C: 0 } }]));
});


test("first-choice visitors are counted without lower preferences", () => {
  for (const choice of ["A", "B", "C"] as const) {
    const counted = firstChoiceWithVisitor(scenarios.original.groups, choice)!;
    assert.equal(counted.total, 101);
    assert.equal(counted.counts[choice], plurality(scenarios.original.groups).counts[choice] + 1);
    assert.deepEqual(counted.winners, ["A"]);
  }
});
test("withdrawal requires an explicit backup only for the withdrawn visitor choice", () => {
  assert.equal(firstChoiceWithVisitor(scenarios.original.groups, "C", ["A", "B"]), null);
  for (const choice of ["A", "B"] as const) {
    const retained = firstChoiceWithVisitor(scenarios.original.groups, choice, ["A", "B"])!;
    const transferred = firstChoiceWithVisitor(scenarios.original.groups, "C", ["A", "B"], choice)!;
    assert.deepEqual(retained, transferred);
    assert.equal(transferred.total, 101);
    assert.equal(Object.values(transferred.counts).reduce((a, b) => a + b), 101);
    assert.deepEqual(transferred.winners, ["B"]);
  }
  assert.throws(() => firstChoiceWithVisitor(scenarios.original.groups, "C", ["A", "B"], "C"));
});
