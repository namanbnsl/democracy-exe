import { test } from "node:test";
import assert from "node:assert/strict";
import { orderingExample } from "./voting-lessons.ts";
import { scenarios } from "./elections.ts";
import { aiStudentPool, explainElection, generateClass, judge, makeSchool, randomClass, rankFrom, seededRandom, simulate } from "./simulation.ts";

test("the seeded generator repeats exactly and stays in [0, 1)", () => {
  const a = seededRandom(42), b = seededRandom(42);
  for (let i = 0; i < 1000; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
});

test("a random class has the requested number of voters", () => {
  for (const model of ["random", "spectrum", "ai"] as const) {
    const groups = randomClass(seededRandom(7), 101, model);
    assert.equal(groups.reduce((sum, g) => sum + g.count, 0), 101);
  }
});

test("judge spots a circle and an agreement", () => {
  assert.equal(judge(orderingExample).outcome, "circle");
  const lopsided = judge([{ count: 60, ranking: ["B", "A", "C"] }, { count: 41, ranking: ["A", "B", "C"] }]);
  assert.equal(lopsided.outcome, "agree");
  assert.equal(lopsided.headToHead, "B");
  assert.equal(judge(scenarios.original.groups).outcome, "disagree");
  assert.equal(judge(scenarios.original.groups).sameWinner, false);
  assert.equal(lopsided.sameWinner, true);
});

test("random classes produce circles at roughly the known rate of about 9%", () => {
  const runs = simulate(seededRandom(2026), 3000, 101, "random");
  const rate = runs.filter(r => r.outcome === "circle").length / runs.length;
  assert.ok(rate > 0.06 && rate < 0.12, `circle rate ${rate}`);
});

test("classes on a spectrum never produce a circle", () => {
  const runs = simulate(seededRandom(11), 2000, 101, "spectrum");
  assert.equal(runs.filter(r => r.outcome === "circle").length, 0);
  assert.ok(runs.every(r => r.headToHead !== null));
});

test("every AI student has a probability for each of the six orders", () => {
  assert.ok(aiStudentPool.length > 0);
  for (const student of aiStudentPool) {
    assert.equal(student.p.length, 6);
    assert.ok(Math.abs(student.p.reduce((a, b) => a + b, 0) - 1) < 0.01, student.profile);
  }
});

test("an AI class repeats with the same seed and records who cast each ballot", () => {
  const a = generateClass(seededRandom(3), 101, "ai"), b = generateClass(seededRandom(3), 101, "ai");
  assert.deepEqual(a, b);
  assert.equal(a.voters?.length, 101);
});

test("a tie under any method is kept apart from a changed winner", () => {
  const tied = judge([{ count: 50, ranking: ["A", "B", "C"] }, { count: 50, ranking: ["B", "A", "C"] }]);
  assert.equal(tied.tie, true);
  assert.equal(tied.sameWinner, false);
});


test("the displayed working explains first choices, transfers and points", () => {
  const working = explainElection(scenarios.original.groups);
  assert.deepEqual(working.firstChoices.counts, { A: 184, B: 167, C: 136 });
  assert.deepEqual(working.secondChoices, { A: 145, B: 201, C: 141 });
  assert.deepEqual(working.points.counts, { A: 513, B: 535, C: 413 });
  assert.equal(working.runoff.rounds[0].eliminated, "C");
  assert.deepEqual(working.runoff.rounds[0].transfers, { A: 47, B: 89, C: 0 });
  assert.deepEqual(working.runoff.rounds[1].counts, { A: 231, B: 256, C: 0 });
});

test("working shows a first-round majority without inventing transfers", () => {
  const working = explainElection([{ count: 60, ranking: ["B", "A", "C"] }, { count: 41, ranking: ["A", "B", "C"] }]);
  assert.equal(working.runoff.rounds.length, 1);
  assert.equal(working.runoff.rounds[0].eliminated, undefined);
  assert.equal(working.runoff.rounds[0].transfers, undefined);
  assert.deepEqual(working.runoff.winners, ["B"]);
});

test("working keeps a last-place tie distinct from an elimination", () => {
  const working = explainElection([{ count: 4, ranking: ["A", "B", "C"] }, { count: 3, ranking: ["B", "C", "A"] }, { count: 3, ranking: ["C", "B", "A"] }]);
  assert.deepEqual(working.runoff.eliminationTie, ["B", "C"]);
  assert.deepEqual(working.runoff.winners, []);
  assert.equal(working.runoff.rounds[0].transfers, undefined);
});

test("all displayed arithmetic and transfers match seeded school results", () => {
  for (const model of ["random", "spectrum"] as const) {
    for (const election of simulate(seededRandom(23), 100, 487, model)) {
      const working = explainElection(election.groups);
      assert.deepEqual(working.firstChoices.winners, election.winners.plurality);
      assert.deepEqual(working.runoff.winners, election.winners.runoff);
      assert.deepEqual(working.points.winners, election.winners.borda);
      for (const id of ["A", "B", "C"] as const) assert.equal(working.firstChoices.counts[id] * 2 + working.secondChoices[id], working.points.counts[id]);
      for (let index = 0; index < working.runoff.rounds.length - 1; index++) {
        const round = working.runoff.rounds[index];
        assert.equal(Object.values(round.transfers!).reduce((sum, count) => sum + count, 0), round.counts[round.eliminated!]);
        for (const id of working.runoff.rounds[index + 1].active) assert.equal(working.runoff.rounds[index + 1].counts[id], round.counts[id] + round.transfers![id]);
      }
    }
  }
});

test("a smaller playground school is the start of a bigger one", () => {
  for (const model of ["random", "spectrum"] as const) {
    const big = makeSchool(9, 400, model), small = makeSchool(9, 150, model);
    assert.deepEqual(small.students, big.students.slice(0, 150));
    assert.equal(small.groups.reduce((sum, group) => sum + group.count, 0), 150);
  }
});

test("moving a candidate on the line re-ranks the same students", () => {
  const school = makeSchool(4, 300, "spectrum");
  const moved = makeSchool(4, 300, "spectrum", { A: .1, B: .5, C: .9 });
  assert.deepEqual(moved.students.map(s => s.position), school.students.map(s => s.position));
  for (const student of moved.students) assert.equal(student.order, rankFrom({ A: .1, B: .5, C: .9 }, student.position!));
});
