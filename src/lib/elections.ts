export const candidateIds = ["A", "B", "C"] as const;
export type CandidateId = (typeof candidateIds)[number];
export type Counts = Record<CandidateId, number>;
export type BallotGroup = { count: number; ranking: CandidateId[] };
export type RatingGroup = { count: number; scores: Counts };
export type Result = { counts: Counts; winners: CandidateId[]; total: number };
export type RunoffRound = Result & { active: CandidateId[]; eliminated?: CandidateId; transfers?: Counts };
export type RunoffResult = Result & { rounds: RunoffRound[]; eliminationTie: CandidateId[] };

// School context comes from npskrm.com; these campaigns and ballots are invented.
export const candidates = [
  { id: "A" as const, name: "Aarav", surname: "Shah", quality: "Fair-minded organiser", policies: ["Open trials for house teams", "A fair-turns rota", "Spots for first-timers"] },
  { id: "B" as const, name: "Meera", surname: "Rao", quality: "Listens and follows through", policies: ["Suggestion box in every class", "Monthly updates", "Weekly open hour"] },
  { id: "C" as const, name: "Kabir", surname: "Sen", quality: "Makes everyone feel welcome", policies: ["Buddies for new students", "A friendly bench", "Homework club"] },
];

export const scenarios: Record<string, { name: string; description: string; groups: BallotGroup[] }> = {
  original: { name: "This election", description: "Aarav leads on first choices. Most students still prefer Meera to Aarav.", groups: [{ count: 40, ranking: ["A", "B", "C"] }, { count: 35, ranking: ["B", "C", "A"] }, { count: 25, ranking: ["C", "B", "A"] }] },
  disagreement: { name: "Another cohort", description: "The same 100 students elect three different prefects under three counting rules.", groups: [{ count: 40, ranking: ["A", "C", "B"] }, { count: 33, ranking: ["B", "C", "A"] }, { count: 27, ranking: ["C", "B", "A"] }] },
  cycle: { name: "A divided cohort", description: "Every candidate wins one head-to-head contest and loses another.", groups: [{ count: 35, ranking: ["A", "B", "C"] }, { count: 33, ranking: ["B", "C", "A"] }, { count: 32, ranking: ["C", "A", "B"] }] },
};

export const ratingGroups: RatingGroup[] = [
  { count: 40, scores: { A: 10, B: 8, C: 0 } },
  { count: 35, scores: { A: 0, B: 10, C: 8 } },
  { count: 25, scores: { A: 0, B: 8, C: 10 } },
];
export const approvalGroups: RatingGroup[] = [
  { count: 40, scores: { A: 1, B: 1, C: 0 } },
  { count: 35, scores: { A: 0, B: 1, C: 1 } },
  { count: 25, scores: { A: 0, B: 1, C: 1 } },
];
export const strategyGroups = (strategic: boolean): BallotGroup[] => [
  { count: 2, ranking: ["B", "A", "C"] },
  { count: 1, ranking: ["C", "B", "A"] },
  { count: 2, ranking: strategic ? ["A", "C", "B"] : ["A", "B", "C"] },
];

export const blankCounts = (): Counts => ({ A: 0, B: 0, C: 0 });
export const nameOf = (id: CandidateId) => candidates.find(c => c.id === id)!.name;

export function validateGroups(groups: BallotGroup[]) {
  if (!groups.length) throw new Error("At least one ballot group is needed.");
  for (const group of groups) {
    if (!Number.isSafeInteger(group.count) || group.count < 0) throw new Error("Voter counts must be non-negative whole numbers.");
    if (group.ranking.length !== 3 || new Set(group.ranking).size !== 3 || group.ranking.some(id => !candidateIds.includes(id))) throw new Error("Each ballot must rank all three candidates exactly once.");
  }
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  if (!Number.isSafeInteger(total) || total === 0) throw new Error("An election needs at least one voter.");
  return total;
}

function result(counts: Counts, total: number, eligible: readonly CandidateId[] = candidateIds): Result {
  const max = Math.max(...eligible.map(id => counts[id]));
  return { counts, total, winners: eligible.filter(id => counts[id] === max) };
}

export function withVisitor(groups: BallotGroup[], ranking: CandidateId[] | null): BallotGroup[] {
  return ranking ? [...groups, { count: 1, ranking: [...ranking] }] : groups.map(group => ({ ...group, ranking: [...group.ranking] }));
}

export function plurality(groups: BallotGroup[], active: CandidateId[] = [...candidateIds]): Result {
  const total = validateGroups(groups);
  if (!active.length || new Set(active).size !== active.length || active.some(id => !candidateIds.includes(id))) throw new Error("Choose at least one distinct candidate.");
  const counts = blankCounts();
  for (const group of groups) counts[group.ranking.find(id => active.includes(id))!] += group.count;
  return result(counts, total, active);
}

// Add one first-choice ballot without inventing lower preferences.
// A withdrawn visitor choice needs an explicitly supplied fallback.
export function firstChoiceWithVisitor(groups: BallotGroup[], firstChoice: CandidateId | null, active: CandidateId[] = [...candidateIds], fallback: CandidateId | null = null): Result | null {
  const prepared = plurality(groups, active);
  if (firstChoice === null) return prepared;
  if (!candidateIds.includes(firstChoice)) throw new Error("Choose a valid candidate.");
  const choice = active.includes(firstChoice) ? firstChoice : fallback;
  if (choice === null) return null;
  if (!active.includes(choice)) throw new Error("The fallback must still be running.");
  const counts = { ...prepared.counts };
  counts[choice] += 1;
  return result(counts, prepared.total + 1, active);
}

export function positional(groups: BallotGroup[], weights: number[] = [2, 1, 0]): Result {
  const total = validateGroups(groups);
  if (weights.length !== 3 || weights.some(w => !Number.isFinite(w) || w < 0)) throw new Error("Supply three non-negative finite point values.");
  const counts = blankCounts();
  for (const group of groups) group.ranking.forEach((id, i) => { counts[id] += group.count * weights[i]; });
  return result(counts, total);
}

export function runoff(groups: BallotGroup[]): RunoffResult {
  const total = validateGroups(groups);
  let active = [...candidateIds];
  const rounds: RunoffRound[] = [];
  while (active.length) {
    const counted = plurality(groups, active);
    const round: RunoffRound = { ...counted, active: [...active] };
    rounds.push(round);
    if (counted.winners.some(id => counted.counts[id] > total / 2) || active.length <= 2) return { ...counted, rounds, eliminationTie: [] };
    const low = Math.min(...active.map(id => counted.counts[id]));
    const bottom = active.filter(id => counted.counts[id] === low);
    if (bottom.length > 1) return { ...counted, winners: [], rounds, eliminationTie: bottom };
    const eliminated = bottom[0];
    round.eliminated = eliminated;
    active = active.filter(id => id !== eliminated);
    round.transfers = blankCounts();
    for (const group of groups) {
      if (group.ranking.find(id => round.active.includes(id)) === eliminated) round.transfers[group.ranking.find(id => active.includes(id))!] += group.count;
    }
  }
  throw new Error("Unable to count election.");
}

export function pairwise(groups: BallotGroup[], a: CandidateId, b: CandidateId): Result {
  const total = validateGroups(groups);
  if (a === b || !candidateIds.includes(a) || !candidateIds.includes(b)) throw new Error("Choose two different candidates.");
  const counts = blankCounts();
  for (const group of groups) counts[group.ranking.indexOf(a) < group.ranking.indexOf(b) ? a : b] += group.count;
  return result(counts, total, [a, b]);
}

export function condorcet(groups: BallotGroup[]): CandidateId[] {
  validateGroups(groups);
  return candidateIds.filter(a => candidateIds.every(b => a === b || pairwise(groups, a, b).winners.length === 1 && pairwise(groups, a, b).winners[0] === a));
}

export function score(groups: RatingGroup[], max = 10): Result {
  if (!groups.length || !Number.isFinite(max) || max <= 0) throw new Error("Supply ratings and a positive scale.");
  const counts = blankCounts();
  let total = 0;
  for (const group of groups) {
    if (!Number.isSafeInteger(group.count) || group.count < 0 || candidateIds.some(id => !Number.isFinite(group.scores[id]) || group.scores[id] < 0 || group.scores[id] > max)) throw new Error("Ratings must fall within the stated scale, and counts must be whole numbers.");
    total += group.count;
    for (const id of candidateIds) counts[id] += group.count * group.scores[id];
  }
  if (!Number.isSafeInteger(total) || total === 0) throw new Error("An election needs at least one voter.");
  return result(counts, total);
}

export function approval(groups: RatingGroup[]): Result {
  if (groups.some(group => candidateIds.some(id => ![0, 1].includes(group.scores[id])))) throw new Error("Approval choices must be 0 or 1.");
  return score(groups, 1);
}
