// Builds public/portraits/: one flat illustrated portrait per candidate and per AI student name.
// Each image is drawn through the Codex CLI's image generation, then shrunk to webp.
// Run with `npm run portraits` (needs `codex` logged in).
// Existing portraits are kept, so a rerun only fills gaps; `npm run portraits -- Riya Kabir` redraws just those.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const OUT = new URL("../public/portraits/", import.meta.url).pathname;
const PARALLEL = 6;

const style = "Flat geometric illustration built from simple shapes, like a modern editorial avatar set: solid flat colours, no outlines, minimal facial features, dot eyes. Not anime, not manga: small simple eyes, realistic Indian facial features and proportions, no glossy highlights in the hair";

// Candidates are in Grade 12. Their posters are tall, with empty space above the head for the slogan.
const candidates = [
  { file: "aarav", who: "Aarav, a 17-year-old Indian boy, football captain, cocky and cheerful, light-brown skin, tousled black hair, laughing mid-sentence, head turned three-quarters, white school shirt with sleeves rolled up and navy tie loosened, a whistle on a cord round his neck", backdrop: "soft sky blue (#b9d9fa)" },
  { file: "meera", who: "Meera, a 17-year-old Indian girl, class representative since Grade 9, serious but kind, dark brown skin, black hair in two neat buns, a small knowing smile, holding a clipboard to her chest, white school shirt and navy tie with a prefect badge", backdrop: "soft pink (#f6c7d9)" },
  { file: "kabir", who: "Kabir, a 17-year-old Indian boy who runs a peer tutoring club, warm and thoughtful, medium-brown skin, neat short black hair, round glasses, chin resting on one hand, navy school sweater over a white collar", backdrop: "soft lavender (#ded3fc)" },
].map(c => ({ ...c, tall: true }));

// One face per name in scripts/generate-students.ts. Students are in Classes 6 to 10, so about 11 to 15.
const girls: Record<string, string> = {
  Riya: "light-brown skin, long black hair in a high ponytail, bright smile", Ananya: "medium-brown skin, shoulder-length wavy hair, small gold stud earrings",
  Diya: "brown skin, two long plaits with red ribbons, cheerful", Saanvi: "light skin, straight black bob with a fringe, curious look",
  Aditi: "dark brown skin, curly hair tied back, rectangular glasses", Tara: "medium skin, short pixie-cut hair, playful grin",
  Nisha: "brown skin, neat side parting and a low bun, calm expression", Zara: "light-brown skin, long wavy hair over one shoulder, confident smile",
  Pooja: "dark skin, single long plait, a small bindi, warm smile", Anika: "medium-brown skin, hair in two puffs, round glasses",
  Leela: "brown skin, long braided hair with jasmine flowers, gentle smile", Kavya: "light-brown skin, half-up hair with a clip, shy smile",
  Myra: "fair skin, curly shoulder-length hair with a headband, lively look", Sneha: "medium skin, straight hair in a low ponytail, freckles, friendly",
  Ira: "dark brown skin, very short natural curls, big earnest eyes", Aisha: "light-brown skin, a soft navy hijab, warm smile",
  Tanvi: "brown skin, wavy hair with a fringe, thin-framed glasses", Shreya: "medium-brown skin, two short pigtails, sporty, a little sweaty from a game",
  Meghna: "dark skin, long hair in a thick braid, thoughtful look", Nandini: "light skin, wavy hair tucked behind ears, small nose stud, polite smile",
  Ritika: "medium skin, high bun with loose strands, energetic grin", Jiya: "brown skin, chin-length straight hair, big round glasses",
  Prisha: "light-brown skin, long straight hair with a hairband, dreamy look", Sana: "medium-brown skin, a soft grey hijab, quiet smile",
  Avni: "dark brown skin, curly hair in a side ponytail, laughing",
};
const boys: Record<string, string> = {
  Arjun: "medium-brown skin, short spiky hair, confident grin", Vihaan: "light skin, side-swept hair, dimples",
  Ishaan: "brown skin, curly black hair, cheeky smile", Reyansh: "fair skin, neat short hair, tiny gap-toothed smile",
  Rohan: "medium skin, messy hair, football-player energy", Dev: "dark brown skin, buzz cut, calm half-smile",
  Kiran: "light-brown skin, wavy hair falling over his forehead, quiet look", Aditya: "brown skin, side parting, thin glasses, serious",
  Yash: "medium-brown skin, short hair with a cowlick, big grin", Siddharth: "light-brown skin, tidy hair, square glasses, bookish",
  Neel: "dark skin, short curly hair, friendly smile", Arnav: "fair skin, floppy fringe, curious eyes",
  Om: "brown skin, very short hair, round face, shy smile", Krish: "medium skin, spiky gelled hair, mischievous look",
  Dhruv: "light-brown skin, short wavy hair, sporty wristband visible, grinning", Rahul: "dark brown skin, neat crew cut, relaxed smile",
  Varun: "medium-brown skin, swept-back hair, thoughtful", Kunal: "light skin, longish hair tucked behind ears, shy, looking slightly down",
  Farhan: "light-brown skin, short curly hair, warm smile", Pranav: "brown skin, side parting, round glasses, earnest",
  Samar: "medium skin, short hair, headphones around his neck, easygoing", Aryan: "fair skin, tousled hair, confident smirk",
  Manav: "dark skin, short hair with a fade, laughing", Vikram: "medium-brown skin, thick eyebrows, neat hair, determined look",
  Harsh: "brown skin, curly fringe, braces on his teeth, big smile",
};
// Outfits and poses cycle at different lengths, so neighbours rarely match.
const outfits = ["white school shirt and navy tie", "navy school sweater over a white collar", "white school shirt with an ID card on a lanyard", "house-colour sports T-shirt", "white school shirt with the top button undone and tie loosened"];
const poses = ["head tilted to one side", "head turned three-quarters, glancing at the viewer", "facing the viewer straight on", "looking off to one side", "leaning forward slightly", "chin up, shoulders back", "one hand raised in a small wave"];
const students = [
  ...Object.entries(girls).map(([name, face]) => `${name}, a 13-year-old Indian schoolgirl, ${face}`),
  ...Object.entries(boys).map(([name, face]) => `${name}, a 13-year-old Indian schoolboy, ${face}`),
].map((who, i) => ({ file: who.split(",")[0].toLowerCase(), tall: false, who: `${who}, ${outfits[i % outfits.length]}, ${poses[i % poses.length]}`, backdrop: "plain soft warm cream (#f3ead8)" }));

const only = process.argv.slice(2).map(name => name.toLowerCase());
const jobs = [...candidates, ...students].filter(job => only.length ? only.includes(job.file) : !existsSync(join(OUT, `${job.file}.webp`)));

function codex(dir: string, prompt: string) {
  return new Promise<void>((resolve, reject) => {
    // stdin must be closed, or codex waits for more input.
    const child = spawn("codex", ["exec", "--ephemeral", "--skip-git-repo-check", "-s", "workspace-write", prompt], { cwd: dir, stdio: ["ignore", "ignore", "pipe"] });
    let errors = "";
    child.stderr.on("data", chunk => errors += chunk);
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve() : reject(new Error(errors.slice(-500))));
  });
}

async function draw(job: (typeof jobs)[number]) {
  const frame = job.tall
    ? "A tall 2:3 portrait, 1024 by 1536 pixels. Waist up, the figure fills the lower two thirds and the full width; the top third is plain empty background."
    : "A square portrait. Head and upper chest, the face large and in the upper half of the frame.";
  const prompt = `Use your image generation tool to draw a portrait of a fictional person: ${job.who}.
Style: ${style}. ${frame}
Plain flat ${job.backdrop} background. No text, no border, no other people.
Save the final image as portrait.png in the current directory. Do not do anything else.`;
  const dir = await mkdtemp(join(tmpdir(), "portrait-"));
  try {
    for (let attempt = 1; ; attempt++) {
      try {
        await codex(dir, prompt);
        const [w, h] = job.tall ? [640, 960] : [256, 256];
        await sharp(join(dir, "portrait.png")).resize(w, h, { fit: "cover" }).webp({ quality: 82 }).toFile(join(OUT, `${job.file}.webp`));
        return;
      } catch (error) {
        if (attempt === 2) throw new Error(`Codex failed for ${job.file}: ${(error as Error).message}`);
      }
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

await mkdir(OUT, { recursive: true });
let next = 0, done = 0;
await Promise.all(Array.from({ length: PARALLEL }, async () => {
  while (next < jobs.length) {
    const job = jobs[next++];
    try { await draw(job); } catch (error) { console.error(`\n${(error as Error).message}`); }
    process.stdout.write(`\r${++done} of ${jobs.length}`);
  }
}));
console.log(`\nDone. Portraits are in ${OUT}`);
