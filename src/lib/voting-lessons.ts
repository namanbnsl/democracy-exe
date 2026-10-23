import type { BallotGroup } from "./elections";

// Three students whose head-to-head majorities go round in a circle.
export const orderingExample: BallotGroup[] = [
  { count: 1, ranking: ["A", "B", "C"] },
  { count: 1, ranking: ["B", "C", "A"] },
  { count: 1, ranking: ["C", "A", "B"] },
];
