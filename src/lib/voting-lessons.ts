import type { BallotGroup, RatingGroup } from "./elections";

// Small, separate examples for the conditions and rating lesson.
export const orderingExample: BallotGroup[] = [
  { count: 1, ranking: ["A", "B", "C"] },
  { count: 1, ranking: ["B", "C", "A"] },
  { count: 1, ranking: ["C", "A", "B"] },
];

export function independenceExample(moved: boolean): BallotGroup[] {
  return [
    { count: 3, ranking: moved ? ["A", "C", "B"] : ["A", "B", "C"] },
    { count: 2, ranking: ["B", "C", "A"] },
  ];
}

export function ratingGapExample(wide: boolean): RatingGroup[] {
  return [
    { count: 1, scores: { A: 10, B: wide ? 1 : 9, C: 0 } },
    { count: 1, scores: { A: 0, B: 6, C: 5 } },
  ];
}
