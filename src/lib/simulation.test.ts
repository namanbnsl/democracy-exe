import { test } from "node:test";
import assert from "node:assert/strict";
import { orderingExample } from "./voting-lessons.ts";
import { scenarios } from "./elections.ts";
import { aiStudentPool, generateClass, judge, randomClass, seededRandom, simulate } from "./simulation.ts";

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
