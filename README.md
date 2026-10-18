# democracy.exe

An interactive, single-laptop prefect election built with Next.js App Router, TypeScript, Tailwind CSS, and shadcn/ui (Radix Nova). A warm background, restrained blue accents, self-hosted Inter typography, and locally rendered candidate illustrations.

## Run

Use Node.js 22.18 or newer.

```sh
npm install
npm run dev
```

Open http://localhost:3000. For exhibition use:

```sh
npm run build
npm start
```

Fonts and illustrations are local. Once installed and built, the experience runs without an internet connection. The optional research links open external sources. There are no accounts, remote vote submissions, QR codes, or AI calls.

## Experience

Visitors choose a fictional prefect with two simple commitments: fair participation, student representation, or helping younger students. The first-choice count elects Aarav; removing Kabir then elects Meera without changing the prepared preferences. Visitors who chose Kabir explicitly name a backup before their vote transfers. The first lesson records no invented preferences and preserves all 101 votes.

After discovering the spoiler effect, visitors choose a first preference and a backup, preview their complete ballot, and count it using instant runoff. Borda then shows another way to use the same ranking. The initial vote is kept as a snapshot so later ranking edits do not rewrite the first lesson.

The guided flow continues through all five Arrow conditions, each with a small example and an optional question to discuss. The instant-runoff rounds are shown alongside the rule written as an algorithm, with the lines each round runs highlighted. A simulation chapter then runs 1,000 random elections of 101 students with a seeded Monte Carlo generator, under two voter models (uniformly random orders, or students and candidates on a one-dimensional spectrum). Visitors first generate and inspect a single pretend class step by step (including a picture of the spectrum model), then watch the computer repeat those steps. It counts how often there is no head-to-head winner and how often plurality, instant runoff and Borda disagree, and lets visitors inspect any single election. Score and approval voting live in the playground. Visitors finish by choosing what their voting rule should protect. The playground remains optional.

Each screen is a short title and a visual, with almost no text, because presenters explain it out loud. Each candidate card shows a portrait, the candidate’s name, one quality and three short policies. It contains no presenter script, visit timings, or decorative status badges.

The playground supports custom positional points, editable voter-group counts, explicit ratings, approval ballots, and a five-student example of strategic Borda reporting. The reset control starts a fresh session; refreshing also resets the experience. Playground edits are local previews and reset when leaving the playground.

## Verify

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

The 28 tests cover verified election fixtures, conservation of transferred ballots, all six possible visitor rankings, ties, strategic reporting, score and approval totals, invalid inputs, the guided majority-cycle, independence, and rating-gap examples, and the simulation: a repeatable seeded generator, the known ~9% cycle rate for random voters, and no cycles on a spectrum. Browser verification is recorded in `docs/verification.md`.

## Structure

- `src/lib/elections.ts`: validated, deterministic voting engine and prepared data.
- `src/lib/voting-lessons.ts`: small, explicit profiles for the guided fairness and rating examples.
- `src/components/election-experience.tsx`: guided visitor experience.
- `src/components/playground.tsx`: editable experiments.
- `src/components/election-visuals.tsx`: counts, ballots, and campaign details.
- `src/components/portrait.tsx`: local SVG portraits.
- `src/components/ui/`: shadcn components; button, toggle, and slider have small project customizations.
- `src/app/globals.css`: restrained desktop-inspired theme, layout, responsive behavior, and reduced-motion support.

The majority cycle illustrates an aggregation problem; it is not presented as a proof of Arrow's theorem. Arrow's claim is stated for complete, transitive collective rankings with unrestricted preferences, unanimity, independence of irrelevant alternatives, and non-dictatorship. Ratings and approvals use their own explicit ballot data rather than invented conversions from rankings.

## School context

The school setting references NPS Koramangala’s [Student Council and School Prefect](https://npskrm.com/investiture-2026-2027.html), checked on 2026-10-10. Khoj refers to this exhibition project. The three candidates, their proposed campaigns, and every ballot profile are invented for teaching; they do not represent actual students, school policy, polling, or election results. Numerical profiles are intentionally preserved to demonstrate the different voting outcomes.
