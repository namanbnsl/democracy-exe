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

Visitors choose a School Prefect from three fictional Grade 12 candidates, each with a role, slogan, strength, weakness and three promises. 487 students from across the school have already voted, and every possible ranking has some voters. On first choices Aarav wins with only 38%. When Kabir drops out, a split bar shows where his votes go: most go to Meera, some to Aarav, and Meera wins. Visitors who chose Kabir name their own backup first.

Visitors then rank their top two and count the same ballots with points (Borda). The simulation asks one question: does the way we count change who wins? It makes up a school of 487 students (random, or standing on a line from sports to studies), counts it three ways, then repeats this 1,000 times and reports how often the winner changed. Visitors finish by choosing how their school should count. The playground remains optional.

Arrow's impossibility theorem is covered on the exhibition board, not in the app.

Each screen is a short title and a visual, with almost no text, because presenters explain it out loud.

## Verify

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

The tests cover verified election fixtures, conservation of transferred ballots, all six possible visitor rankings, ties, strategic reporting, score and approval totals, invalid inputs, a three-student majority cycle, and the simulation: a repeatable seeded generator, the known ~9% cycle rate for random voters, no cycles on a spectrum, and ties kept apart from changed winners. Browser verification is recorded in `docs/verification.md`.

## Structure

- `src/lib/elections.ts`: validated, deterministic voting engine and prepared data.
- `src/lib/voting-lessons.ts`: a three-student majority cycle used by the tests.
- `src/lib/simulation.ts` and `src/components/simulation-lab.tsx`: the 1,000-election simulation.
- `src/components/election-experience.tsx`: guided visitor experience.
- `src/components/playground.tsx`: editable experiments.
- `src/components/election-visuals.tsx`: counts, ballots, and campaign details.
- `src/components/portrait.tsx`: local SVG portraits.
- `src/components/ui/`: shadcn components; button, toggle, and slider have small project customizations.
- `src/app/globals.css`: restrained desktop-inspired theme, layout, responsive behavior, and reduced-motion support.

The majority cycle illustrates an aggregation problem; it is not presented as a proof of Arrow's theorem. Arrow's claim is stated for complete, transitive collective rankings with unrestricted preferences, unanimity, independence of irrelevant alternatives, and non-dictatorship. Ratings and approvals use their own explicit ballot data rather than invented conversions from rankings.

## School context

The school setting references NPS Koramangala’s [Student Council and School Prefect](https://npskrm.com/investiture-2026-2027.html), checked on 2026-10-10. Khoj refers to this exhibition project. The three candidates, their campaigns, and every ballot profile are invented for teaching; they do not represent actual students, school policy, polling, or election results. Numerical profiles are intentionally preserved to demonstrate the different voting outcomes.
