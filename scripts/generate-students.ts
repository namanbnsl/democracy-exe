// Builds src/lib/ai-students.json: fictional students and how likely each is to cast each ranking.
// Run with `npm run students` after putting CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in .env.local.
import { writeFile } from "node:fs/promises";
import { candidates } from "../src/lib/elections.ts";
import { orders, seededRandom } from "../src/lib/simulation.ts";

const MODEL = "clef";
const STUDENTS = 500;
const PARALLEL = 8;

const grades = ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10"];
const time = ["new this year", "here since nursery"];
const interests = ["plays football", "plays cricket", "loves chess", "draws and paints", "sings in the choir", "on the debate team", "learning to code", "always reading", "dances", "in the science club"];
const traits = ["finds it hard to speak up", "loves organising things", "often left out of teams", "wants to be listened to", "struggles with homework", "cares most about fairness", "wants things to get done", "has lots of friends", "worries about making friends", "never makes the team"];

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
const name = (id: string) => candidates.find(c => c.id === id)!.name;

// Candidates and options are shuffled per student so list position doesn't favour anyone.
async function ask(profile: string) {
  const cards = shuffle(candidates).map(c => `${c.name}, "${c.quality}": ${c.policies.join("; ")}.`).join("\n");
  const keys = shuffle(orders.map(order => order.join("-")));
  const body = {
    model: MODEL,
    state: `A school student: ${profile}.\n\nThe candidates for school prefect:\n${cards}`,
    questions: { ranking: { type: "choice", instructions: "How would this student rank the three candidates, from most to least preferred?", criteria: Object.fromEntries(keys.map(key => [key, key.split("-").map(name).join(", then ")])) } },
  };
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/cloudflare/${MODEL}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    if (response.ok && json.success) {
      const probabilities: Record<string, number> = json.result.answers.ranking.probabilities;
      return { profile, p: orders.map(order => Number((probabilities[order.join("-")] ?? 0).toFixed(4))), tokens: json.result.usage.input_tokens as number };
    }
    if (attempt === 3) throw new Error(`Clef failed for "${profile}": ${JSON.stringify(json.errors ?? json)}`);
  }
}

if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_API_TOKEN) throw new Error("Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in .env.local.");
const results: Awaited<ReturnType<typeof ask>>[] = [];
let next = 0;
await Promise.all(Array.from({ length: PARALLEL }, async () => {
  while (next < profiles.length) {
    const i = next++;
    results[i] = await ask(profiles[i]);
  }
}));
const tokens = results.reduce((sum, r) => sum + r.tokens, 0);
await writeFile(new URL("../src/lib/ai-students.json", import.meta.url), JSON.stringify({ model: MODEL, students: results.map(({ profile, p }) => ({ profile, p })) }, null, 1) + "\n");
console.log(`Wrote ${results.length} students using ${tokens.toLocaleString()} input tokens.`);
