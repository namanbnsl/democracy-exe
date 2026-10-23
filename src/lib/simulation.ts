import { candidateIds, condorcet, plurality, positional, runoff, type BallotGroup, type CandidateId } from "./elections";
import aiStudents from "./ai-students.json";

// "random": every student picks one of the six orders at random.
// "spectrum": students and candidates sit on a line; students prefer whoever is closest.
// "ai": students come from a pool where Clef read each made-up profile and the candidate cards
// and gave a probability for each of the six orders (see scripts/generate-students.ts).
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

export const aiStudentPool: { profile: string; p: number[] }[] = aiStudents.students;

// Positions (0 to 1) are only filled in for the spectrum model; voters only for the ai model.
export type AiVoter = { student: number; order: number };
export type ClassDetail = { groups: BallotGroup[]; spots?: Record<CandidateId, number>; students?: number[]; voters?: AiVoter[] };

function pickOrder(p: number[], roll: number) {
  let sum = 0;
  for (let i = 0; i < p.length; i++) if (roll < (sum += p[i])) return i;
  return p.length - 1;
}

export function generateClass(random: () => number, voters: number, model: VoterModel): ClassDetail {
  if (!Number.isSafeInteger(voters) || voters < 1) throw new Error("A class needs at least one voter.");
  if (model === "ai" && !aiStudentPool.length) throw new Error("No AI students yet. Run npm run students.");
  const counts = orders.map(() => 0);
  const spots = { A: random(), B: random(), C: random() };
  const students: number[] = [];
  const picked: AiVoter[] = [];
  for (let i = 0; i < voters; i++) {
    if (model === "random") counts[Math.floor(random() * orders.length)]++;
    else if (model === "ai") {
      const student = Math.floor(random() * aiStudentPool.length);
      const order = pickOrder(aiStudentPool[student].p, random());
      counts[order]++;
      picked.push({ student, order });
    } else {
      const me = random();
      students.push(me);
      const ranking = [...candidateIds].sort((x, y) => Math.abs(spots[x] - me) - Math.abs(spots[y] - me));
      counts[orders.findIndex(order => order.join() === ranking.join())]++;
    }
  }
  const groups = orders.map((ranking, i) => ({ count: counts[i], ranking })).filter(group => group.count > 0);
  return model === "spectrum" ? { groups, spots, students } : model === "ai" ? { groups, voters: picked } : { groups };
}

export function randomClass(random: () => number, voters: number, model: VoterModel): BallotGroup[] {
  return generateClass(random, voters, model).groups;
}

export function judge(groups: BallotGroup[]): SimulatedElection {
  const winners = { plurality: plurality(groups).winners, runoff: runoff(groups).winners, borda: positional(groups).winners };
  const head = condorcet(groups);
  const picks = new Set(Object.values(winners).map(w => w.length === 1 ? w[0] : "tie"));
  const outcome: Outcome = head.length === 0 ? "circle" : picks.size > 1 ? "disagree" : "agree";
  const tie = picks.has("tie");
  return { groups, outcome, winners, tie, sameWinner: !tie && picks.size === 1, headToHead: head.length === 1 ? head[0] : null };
}

export function simulate(random: () => number, elections: number, voters: number, model: VoterModel): SimulatedElection[] {
  return Array.from({ length: elections }, () => judge(randomClass(random, voters, model)));
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
export type SchoolStudent = { order: number; position?: number };
export type School = { groups: BallotGroup[]; students: SchoolStudent[]; spots?: Record<CandidateId, number> };

export function rankFrom(spots: Record<CandidateId, number>, position: number) {
  const ranking = [...candidateIds].sort((x, y) => Math.abs(spots[x] - position) - Math.abs(spots[y] - position));
  return orders.findIndex(order => order.join() === ranking.join());
}

export function makeSchool(seed: number, voters: number, model: "random" | "spectrum", spots?: Record<CandidateId, number>): School {
  const random = seededRandom(seed);
  // Keep candidates apart so their names stay readable on the line.
  const drawn = { A: .08 + random() * .84, B: .08 + random() * .84, C: .08 + random() * .84 };
  const stand = spots ?? drawn;
  const students: SchoolStudent[] = [];
  for (let i = 0; i < voters; i++) {
    if (model === "random") students.push({ order: Math.floor(random() * orders.length) });
    else { const position = random(); students.push({ order: rankFrom(stand, position), position }); }
  }
  const counts = orders.map(() => 0);
  for (const student of students) counts[student.order]++;
  const groups = orders.map((ranking, i) => ({ count: counts[i], ranking })).filter(group => group.count > 0);
  return model === "spectrum" ? { groups, students, spots: stand } : { groups, students };
}
