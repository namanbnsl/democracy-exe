import { candidateIds, condorcet, plurality, positional, runoff, type BallotGroup, type CandidateId } from "./elections";

// "random": every student picks one of the six orders at random.
// "spectrum": students and candidates sit on a line; students prefer whoever is closest.
export type VoterModel = "random" | "spectrum";
export type Outcome = "agree" | "disagree" | "circle";
export type SimulatedElection = {
  groups: BallotGroup[];
  outcome: Outcome;
  winners: { plurality: CandidateId[]; runoff: CandidateId[]; borda: CandidateId[] };
  headToHead: CandidateId | null;
};

const orders: CandidateId[][] = [["A", "B", "C"], ["A", "C", "B"], ["B", "A", "C"], ["B", "C", "A"], ["C", "A", "B"], ["C", "B", "A"]];

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

// Positions (0 to 1) are only filled in for the spectrum model.
export type ClassDetail = { groups: BallotGroup[]; spots?: Record<CandidateId, number>; students?: number[] };

export function generateClass(random: () => number, voters: number, model: VoterModel): ClassDetail {
  if (!Number.isSafeInteger(voters) || voters < 1) throw new Error("A class needs at least one voter.");
  const counts = orders.map(() => 0);
  const spots = { A: random(), B: random(), C: random() };
  const students: number[] = [];
  for (let i = 0; i < voters; i++) {
    if (model === "random") counts[Math.floor(random() * orders.length)]++;
    else {
      const me = random();
      students.push(me);
      const ranking = [...candidateIds].sort((x, y) => Math.abs(spots[x] - me) - Math.abs(spots[y] - me));
      counts[orders.findIndex(order => order.join() === ranking.join())]++;
    }
  }
  const groups = orders.map((ranking, i) => ({ count: counts[i], ranking })).filter(group => group.count > 0);
  return model === "spectrum" ? { groups, spots, students } : { groups };
}

export function randomClass(random: () => number, voters: number, model: VoterModel): BallotGroup[] {
  return generateClass(random, voters, model).groups;
}

export function judge(groups: BallotGroup[]): SimulatedElection {
  const winners = { plurality: plurality(groups).winners, runoff: runoff(groups).winners, borda: positional(groups).winners };
  const head = condorcet(groups);
  const picks = new Set(Object.values(winners).map(w => w.length === 1 ? w[0] : "tie"));
  const outcome: Outcome = head.length === 0 ? "circle" : picks.size > 1 ? "disagree" : "agree";
  return { groups, outcome, winners, headToHead: head.length === 1 ? head[0] : null };
}

export function simulate(random: () => number, elections: number, voters: number, model: VoterModel): SimulatedElection[] {
  return Array.from({ length: elections }, () => judge(randomClass(random, voters, model)));
}
