// Builds src/lib/ai-students.json: fictional students, the ballot each one casts, and why.
// Each student is given a personality (grade, interests, two traits, sometimes a worry or a link to a candidate) and asked, through the Codex CLI, how they'd rank the candidates.
// Run with `npm run students` (needs `codex` logged in). `npm run students -- 10 /tmp/trial.json` makes a small trial.
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { candidates } from "../src/lib/elections.ts";
import { crowdIds, crowds, orders, seededRandom, sharedTraits } from "../src/lib/simulation.ts";

const MODEL = "gpt-6-luna";
const STUDENTS = Number(process.argv[2] ?? 500);
const OUTPUT = process.argv[3] ? new URL(process.argv[3], `file://${process.cwd()}/`) : new URL("../src/lib/ai-students.json", import.meta.url);
const PARALLEL = 8;
const MAX_WORDS = 25;

const names = ["Riya", "Arjun", "Ananya", "Vihaan", "Diya", "Ishaan", "Saanvi", "Reyansh", "Aditi", "Rohan", "Tara", "Dev", "Nisha", "Kiran", "Zara", "Aditya", "Pooja", "Yash", "Anika", "Siddharth", "Leela", "Neel", "Kavya", "Arnav", "Myra", "Om", "Sneha", "Krish", "Ira", "Dhruv", "Aisha", "Rahul", "Tanvi", "Varun", "Shreya", "Kunal", "Meghna", "Farhan", "Nandini", "Pranav", "Ritika", "Samar", "Jiya", "Aryan", "Prisha", "Manav", "Sana", "Vikram", "Avni", "Harsh"];
const grades = ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10"];
// About one student in ten is new, as in a real school.
const time = ["new this year", "here since nursery", "here since Class 1", "here since Class 2", "here since Class 3", "here since Class 4", "here for two years", "here for three years", "here for four years", "here for five years"];
const interests = ["plays football", "plays cricket", "loves chess", "draws and paints", "sings in the choir", "on the debate team", "learning to code", "always reading", "dances", "in the science club"];
// Balanced so no candidate gets a ready-made base: each kind of student leans towards one campaign, and some traits lean nowhere.
// Every trait is someone's main trait equally often; the second trait is any other one, so it can pull another way.
const traits = [...crowdIds.flatMap(id => crowds[id].traits), ...sharedTraits];
const concerns: Record<string, string> = {
  "Class 6": "just moved up to the middle-school block and finds it a bit overwhelming",
  "Class 7": "feels the older classes get all the fun events",
  "Class 9": "starting to worry about board exams next year",
  "Class 10": "has board exams this year",
};
// Some students know a candidate a little; two links for each candidate, one of them less flattering.
const links = [
  "older brother plays on Aarav's football team", "their house lost to Aarav's in the football cup and they're still a bit sore",
  "Meera got the broken fan in their classroom fixed", "Meera once told their class off for being noisy in the corridor",
  "Kabir tutored their older sister through maths", "has never actually spoken to Kabir",
];
// What a student would know or hear about each candidate. Only the AI sees this; the visible cards stay short.
const briefs: Record<string, string> = {
  A: "Funny and confident; talks to everyone from Class 6 to 12 and remembers names. Organised the inter-house football cup and got the canteen to add a cheap snack counter. Some teachers worry a fest would eat into study time.",
  B: "Organised and direct; class rep since Grade 9. Got the broken classroom fans fixed in Grade 10. Some juniors find her strict and a bit too serious.",
  C: "Quiet and patient; better one-to-one than on a stage. His tutoring club helped 40 juniors pass maths. Some say he is new, hardly knows the seniors, and goes shy at assemblies.",
};

const random = seededRandom(2026);
const pick = <T,>(items: T[]) => items[Math.floor(random() * items.length)];
function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

type Student = { name: string; profile: string; trait: string; facts: string[] };
const students: Student[] = shuffle(Array.from({ length: STUDENTS }, (_, i) => {
  const grade = pick(grades), trait = traits[i % traits.length];
  const second = pick(traits.filter(t => t !== trait));
  const facts = [grade, pick(time), pick(interests), trait, second];
  if (concerns[grade]) facts.push(concerns[grade]);
  if (random() < .3) facts.push(pick(links));
  return { name: pick(names), profile: facts.slice(0, 5).join(" · "), trait, facts };
}));
const names3 = candidates.map(c => c.name);
const schema = {
  type: "object", additionalProperties: false, required: ["bio", "first", "reason", "ranking"],
  properties: {
    bio: { type: "string" }, first: { type: "string", enum: names3 },
    reason: { type: "string" }, ranking: { type: "array", items: { type: "string", enum: names3 }, minItems: 3, maxItems: 3 },
  },
};

function codex(dir: string, prompt: string) {
  return new Promise<void>((resolve, reject) => {
    // stdin must be closed, or codex waits for more input.
    const child = spawn("codex", ["exec", "-m", MODEL, "-c", 'model_reasoning_effort="medium"', "--ephemeral", "--skip-git-repo-check", "-s", "read-only", "--output-schema", "schema.json", "-o", "out.json", prompt], { cwd: dir, stdio: ["ignore", "ignore", "pipe"] });
    let errors = "";
    child.stderr.on("data", chunk => errors += chunk);
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve() : reject(new Error(errors.slice(-500))));
  });
}

// Candidates are shuffled per student so list position doesn't favour anyone.
async function ask(student: Student) {
  const cards = shuffle(candidates).map(c => `${c.name} (${c.quality}). Slogan: "${c.slogan}". Promises: ${c.policies.join("; ")}. Strength: ${c.strength}. Weakness: ${c.weakness}. Around school: ${briefs[c.id]}`).join("\n");
  const prompt = `You are ${student.name}, a school student. About you: ${student.facts.join("; ")}.

The candidates for school prefect:
${cards}

First write a one-line bio of ${student.name} like a yearbook caption: at most 20 words, third person, warm and specific. Pick the one or two details that say the most about them; don't list everything, and don't start with their name or class. Don't mention the election.
Decide who this student would vote for first, the way they really would: a real kid weighing what matters to them, not the answer a teacher would like.
Give one short reason (at most 20 words) for that first choice, in the student's own voice: simple words, first person. No need to mention the others, and never be mean about anyone.
Then rank all three candidates from most to least preferred, starting with that first choice.
Never contradict the student's details (for example, don't say they are new if they aren't, or name a hobby they don't have), but only mention a detail if it matters.
Answer only with the JSON. Do not run any commands.`;
  const dir = await mkdtemp(join(tmpdir(), "students-"));
  try {
    await writeFile(join(dir, "schema.json"), JSON.stringify(schema));
    for (let attempt = 1; ; attempt++) {
      try {
        await codex(dir, prompt);
        const { bio, first, ranking, reason } = JSON.parse(await readFile(join(dir, "out.json"), "utf8")) as { bio: string; first: string; ranking: string[]; reason: string };
        // The reason is written for `first`, so it must top the ranking.
        if (ranking[0] !== first) throw new Error(`Reason is for ${first} but ranking starts with ${ranking[0]}`);
        const ids = ranking.map(name => candidates.find(c => c.name === name)?.id);
        const order = orders.findIndex(o => o.join() === ids.join());
        if (order < 0) throw new Error(`Bad ranking ${ranking.join(", ")}`);
        if (!reason.trim() || reason.split(/\s+/).length > MAX_WORDS) throw new Error(`Bad reason "${reason}"`);
        if (!bio.trim() || bio.split(/\s+/).length > 30) throw new Error(`Bad bio "${bio}"`);
        return { name: student.name, profile: student.profile, trait: student.trait, bio: bio.trim(), order, reason: reason.trim() };
      } catch (error) {
        if (attempt === 3) throw new Error(`Codex failed for "${student.profile}": ${(error as Error).message}`);
      }
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const answers: (Awaited<ReturnType<typeof ask>> | undefined)[] = [];
let next = 0, done = 0;
// A student who keeps failing is skipped rather than losing the whole run.
await Promise.all(Array.from({ length: PARALLEL }, async () => {
  while (next < students.length) {
    const i = next++;
    try { answers[i] = await ask(students[i]); } catch (error) { console.error(`\n${(error as Error).message}`); }
    process.stdout.write(`\r${++done} of ${students.length}`);
  }
}));
const results = answers.filter(answer => answer !== undefined);
await writeFile(OUTPUT, JSON.stringify({ model: MODEL, students: results }, null, 1) + "\n");
const firsts = candidates.map(c => `${c.name} ${results.filter(r => orders[r.order][0] === c.id).length}`).join(", ");
console.log(`\nWrote ${results.length} students to ${OUTPUT.pathname}. First choices: ${firsts}.`);
