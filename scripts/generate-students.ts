// Builds src/lib/ai-students.json: fictional students, the ballot each one casts, and why.
// Each student is given a personality and asked, through the Codex CLI, how they'd rank the candidates.
// Run with `npm run students` (needs `codex` logged in). `npm run students -- 10 /tmp/trial.json` makes a small trial.
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { candidates } from "../src/lib/elections.ts";
import { orders, seededRandom } from "../src/lib/simulation.ts";

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
// Balanced so no candidate gets a ready-made base: some traits lean towards one candidate's campaign, some lean nowhere.
const traits = [
  "finds it hard to speak up", "struggles with homework", "worries about making friends", "often left out of teams",
  "likes rules and order", "thinks leaders need experience", "gets annoyed when nothing changes", "wants things to get done", "hates the queue at the water tap", "wants a quiet spot to read at lunch",
  "wants the school to win trophies", "lives for the school fest", "complains about the canteen", "has lots of friends", "thinks school is boring",
  "cares most about fairness", "wants to be listened to", "loves organising things",
];

const random = seededRandom(2026);
function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const profiles = shuffle(grades.flatMap(g => time.flatMap(t => interests.flatMap(i => traits.map(r => [g, t, i, r].join(" · ")))))).slice(0, STUDENTS);
const students = profiles.map(profile => ({ name: names[Math.floor(random() * names.length)], profile }));
const schema = {
  type: "object", additionalProperties: false, required: ["first", "reason", "ranking"],
  properties: { first: { type: "string", enum: candidates.map(c => c.name) }, reason: { type: "string" }, ranking: { type: "array", items: { type: "string", enum: candidates.map(c => c.name) }, minItems: 3, maxItems: 3 } },
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
async function ask(student: { name: string; profile: string }) {
  const cards = shuffle(candidates).map(c => `${c.name} (${c.quality}). Slogan: "${c.slogan}". Promises: ${c.policies.join("; ")}. Strength: ${c.strength}. Weakness: ${c.weakness}.`).join("\n");
  const prompt = `You are ${student.name}, a school student: ${student.profile}.

The candidates for school prefect:
${cards}

Decide who this student would vote for first, the way they really would: a real kid thinking about what matters to them, not the answer a teacher would like.
Give one short reason (at most 20 words) for that first choice, in the student's own voice: simple words, first person. No need to mention the others, and never be mean about anyone.
Then rank all three candidates from most to least preferred, starting with that first choice.
Never contradict the student's details (for example, don't say they are new if they aren't, or name a hobby they don't have), but only mention a detail if it is why they vote that way.
Answer only with the JSON. Do not run any commands.`;
  const dir = await mkdtemp(join(tmpdir(), "students-"));
  try {
    await writeFile(join(dir, "schema.json"), JSON.stringify(schema));
    for (let attempt = 1; ; attempt++) {
      try {
        await codex(dir, prompt);
        const { first, ranking, reason } = JSON.parse(await readFile(join(dir, "out.json"), "utf8")) as { first: string; ranking: string[]; reason: string };
        // The reason is written for `first`, so it must top the ranking.
        if (ranking[0] !== first) throw new Error(`Reason is for ${first} but ranking starts with ${ranking[0]}`);
        const ids = ranking.map(name => candidates.find(c => c.name === name)?.id);
        const order = orders.findIndex(o => o.join() === ids.join());
        if (order < 0) throw new Error(`Bad ranking ${ranking.join(", ")}`);
        if (!reason.trim() || reason.split(/\s+/).length > MAX_WORDS) throw new Error(`Bad reason "${reason}"`);
        return { ...student, order, reason: reason.trim() };
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
