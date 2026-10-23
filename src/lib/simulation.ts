import { candidateIds, condorcet, plurality, positional, runoff, type BallotGroup, type CandidateId } from "./elections";
import aiStudents from "./ai-students.json";

// "random": every student picks one of the six orders at random.
// "spectrum": students and candidates sit on a line; students prefer whoever is closest.
// "ai": students come from a pool where an LLM was given each made-up student and the candidate cards,
// and said how that student would rank them and why (see scripts/generate-students.ts).
export type VoterModel = "random" | "spectrum" | "ai";
export type Outcome = "agree" | "disagree" | "circle";
export type SimulatedElection = {
  groups: BallotGroup[];
  outcome: Outcome;
  winners: { plurality: CandidateId[]; runoff: CandidateId[]; borda: CandidateId[] };
  // tie: some method ends in a tie. sameWinner: all three pick the same single winner.
  tie: boolean;
  sameWinner: boolean;
  headToHead: CandidateId | null;
};

export const orders: CandidateId[][] = [["A", "B", "C"], ["A", "C", "B"], ["B", "A", "C"], ["B", "C", "A"], ["C", "A", "B"], ["C", "B", "A"]];

// Mulberry32: a tiny seeded generator, so the same seed always replays the same run.
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// `order` indexes `orders`; `reason` is why the student put their first choice first.
export type AiStudent = { name: string; profile: string; order: number; reason: string };
export const aiStudentPool: AiStudent[] = aiStudents.students;

export function judge(groups: BallotGroup[]): SimulatedElection {
  const winners = { plurality: plurality(groups).winners, runoff: runoff(groups).winners, borda: positional(groups).winners };
  const head = condorcet(groups);
  const picks = new Set(Object.values(winners).map(w => w.length === 1 ? w[0] : "tie"));
  const outcome: Outcome = head.length === 0 ? "circle" : picks.size > 1 ? "disagree" : "agree";
  const tie = picks.has("tie");
  return { groups, outcome, winners, tie, sameWinner: !tie && picks.size === 1, headToHead: head.length === 1 ? head[0] : null };
}

// Schools seed, seed + 1, ... counted one after another, as the 1,000-school view does.
export function simulate(seed: number, elections: number, voters: number, model: VoterModel): SimulatedElection[] {
  return Array.from({ length: elections }, (_, i) => judge(makeSchool(seed + i, voters, model).groups));
}

// Keep the visible working tied to the same counters that decide the winners.
export function explainElection(groups: BallotGroup[]) {
  const firstChoices = plurality(groups);
  const secondChoices = { A: 0, B: 0, C: 0 };
  for (const group of groups) secondChoices[group.ranking[1]] += group.count;
  return {
    firstChoices,
    secondChoices,
    runoff: runoff(groups),
    points: positional(groups),
  };
}

// One school for the playground. The same seed always gives the same students, and a smaller
// school is the first part of a bigger one, so dragging the size slider only adds or removes students.
// `spots` overrides where the candidates stand on the line.
// AI profiles are sampled independently from the pool. Sampling with replacement keeps
// schools varied even when their size approaches or exceeds the number of profiles.
export type SchoolStudent = { order: number; position?: number; student?: number };
export type School = { groups: BallotGroup[]; students: SchoolStudent[]; spots?: Record<CandidateId, number> };

export function rankFrom(spots: Record<CandidateId, number>, position: number) {
  const ranking = [...candidateIds].sort((x, y) => Math.abs(spots[x] - position) - Math.abs(spots[y] - position));
  return orders.findIndex(order => order.join() === ranking.join());
}

export function makeSchool(seed: number, voters: number, model: VoterModel, spots?: Record<CandidateId, number>): School {
  if (!Number.isSafeInteger(voters) || voters < 1) throw new Error("A school needs at least one voter.");
  if (model === "ai" && !aiStudentPool.length) throw new Error("No AI students yet. Run npm run students.");
  const random = seededRandom(seed);
  // Keep candidates apart so their names stay readable on the line.
  const drawn = { A: .08 + random() * .84, B: .08 + random() * .84, C: .08 + random() * .84 };
  const stand = spots ?? drawn;
  const students: SchoolStudent[] = [];
  for (let i = 0; i < voters; i++) {
    if (model === "random") students.push({ order: Math.floor(random() * orders.length) });
    else if (model === "ai") {
      const student = Math.floor(random() * aiStudentPool.length);
      students.push({ order: aiStudentPool[student].order, student });
    } else { const position = random(); students.push({ order: rankFrom(stand, position), position }); }
  }
  const counts = orders.map(() => 0);
  for (const student of students) counts[student.order]++;
  const groups = orders.map((ranking, i) => ({ count: counts[i], ranking })).filter(group => group.count > 0);
  return model === "spectrum" ? { groups, students, spots: stand } : { groups, students };
}
