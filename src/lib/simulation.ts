import { condorcet, plurality, positional, runoff, type BallotGroup, type CandidateId } from "./elections";
import aiStudents from "./ai-students.json";

// "random": every student picks one of the six orders at random.
// "ai": students come from a pool where an LLM was given each made-up student and the candidate cards,
// and said how that student would rank them and why (see scripts/generate-students.ts).
export type VoterModel = "random" | "ai";
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
// `trait` is the student's main trait, which decides their kind; `bio` is a one-line caption the AI wrote.
export type AiStudent = { name: string; profile: string; trait: string; bio: string; order: number; reason: string };
export const aiStudentPool: AiStudent[] = aiStudents.students;

// The kinds of student the personality traits were written for; scripts/generate-students.ts builds
// every profile from these. Each AI school mixes the kinds in its own proportions, so some schools are
// sportier and some more studious, while every student keeps the vote and reason the AI gave them.
export const crowds = {
  carers: { label: "Caring", traits: ["finds it hard to speak up", "struggles with homework", "worries about making friends", "often left out of teams"] },
  doers: { label: "Get it done", traits: ["likes rules and order", "thinks leaders need experience", "gets annoyed when nothing changes", "wants things to get done", "hates the queue at the water tap", "wishes the library stayed open at lunch"] },
  sporty: { label: "Sporty", traits: ["wants the school to win trophies", "lives for the school fest", "complains about the canteen", "has lots of friends", "thinks school is boring"] },
};
// Traits that belong to no kind; these students turn up in every school in the same share.
export const sharedTraits = ["cares most about fairness", "wants to be listened to", "loves organising things"];
export type Crowd = keyof typeof crowds;
export const crowdIds = Object.keys(crowds) as Crowd[];
const SHARED = sharedTraits.length / (sharedTraits.length + crowdIds.reduce((sum, id) => sum + crowds[id].traits.length, 0));

export const crowdOf = (student: AiStudent): Crowd | null => crowdIds.find(id => crowds[id].traits.includes(student.trait)) ?? null;
const poolByCrowd = [...crowdIds, null].map(id => aiStudentPool.flatMap((student, i) => crowdOf(student) === id ? [i] : []));

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
// An AI school never picks the same profile twice until its kind has run out; only then are profiles reused.
export type SchoolStudent = { order: number; student?: number };
// `mix` is each kind's share of an AI school, leaving out the students who belong to no kind.
export type School = { groups: BallotGroup[]; students: SchoolStudent[]; mix?: Record<Crowd, number> };

export function makeSchool(seed: number, voters: number, model: VoterModel): School {
  if (!Number.isSafeInteger(voters) || voters < 1) throw new Error("A school needs at least one voter.");
  if (model === "ai" && !aiStudentPool.length) throw new Error("No AI students yet. Run npm run students.");
  const random = seededRandom(seed);
  // A random mix of the three kinds, usually varied but rarely one kind alone (a Dirichlet(3, 3, 3) draw).
  const weights = crowdIds.map(() => Array.from({ length: 3 }, () => -Math.log(1 - random())).reduce((a, b) => a + b));
  const total = weights.reduce((sum, w) => sum + w, 0);
  const mix = Object.fromEntries(crowdIds.map((id, i) => [id, weights[i] / total])) as Record<Crowd, number>;
  const shares = [...crowdIds.map(id => mix[id] * (1 - SHARED)), SHARED];
  // One deck per kind, dealt a card at a time (a lazy shuffle), so each new student is the same whatever the school size.
  const decks = poolByCrowd.map(pool => ({ cards: [...pool], dealt: 0 }));
  const students: SchoolStudent[] = [];
  for (let i = 0; i < voters; i++) {
    if (model === "random") students.push({ order: Math.floor(random() * orders.length) });
    else if (model === "ai") {
      let roll = random(), kind = 0;
      while (kind < shares.length - 1 && roll >= shares[kind]) roll -= shares[kind++];
      const deck = decks[kind];
      if (deck.dealt === deck.cards.length) deck.dealt = 0;
      const j = deck.dealt + Math.floor(random() * (deck.cards.length - deck.dealt));
      [deck.cards[deck.dealt], deck.cards[j]] = [deck.cards[j], deck.cards[deck.dealt]];
      const student = deck.cards[deck.dealt++];
      students.push({ order: aiStudentPool[student].order, student });
    }
  }
  const counts = orders.map(() => 0);
  for (const student of students) counts[student.order]++;
  const groups = orders.map((ranking, i) => ({ count: counts[i], ranking })).filter(group => group.count > 0);
  return model === "ai" ? { groups, students, mix } : { groups, students };
}
