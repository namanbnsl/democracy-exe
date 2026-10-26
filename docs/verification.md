# Verification

## AI playground — 2026-10-23

- Generated 1,500 fictional student profiles (500, then 1,000 more with a second seed) with GPT-6-Luna at medium reasoning. Each has a first name, a personality (class, interests, two traits, sometimes a worry or a link to a candidate), a short bio, a complete ranking, and a reason of at most 25 words. Candidate background beyond the visible cards is given only to the generator. First choices: Aarav 579, Meera 487, Kabir 434; 146 students are new this year.
- AI schools draw profiles without repeating one until its kind runs out, preserving each profile's generated ranking and reason. Each school first draws its own mix of the three kinds of student the traits were written for (Caring, Get it done, Sporty; a Dirichlet(3, 3, 3) draw), so some schools are sportier and some more caring. Seeds replay exactly, and reducing the student slider preserves the start of the larger school.
- With seed 2026, 1,000 AI schools of 487 students give 349 changed winners, 26 ties, and 625 schools with the same winner across all three counts. First choices most often pick Aarav (about 68%); runoff is close between Aarav and Kabir (about 41% and 37%) and points most often pick Kabir (about 50%); Meera wins about 14–21%. No school of 487 repeats a profile. These are fictional model outputs, not survey results.
- The playground opens on seed 5961, where both voter models give three different winners under the three counts. The "On a line" voter model was removed.
- All 38 tests, TypeScript, and ESLint pass, including profile-to-ballot consistency, varying AI school totals, seeded replay, no repeated profiles, transfers, and slider stability.
- The production build passes. The first restricted build stalled during compilation; rerunning outside the process sandbox completed successfully without configuration changes.
- T3 browser checks covered the AI toggle, hover cards, the 1,000-school run, percentage totals, and opening School 17 from the results grid. The selected school preserves AI mode and its 487-student size.
- Student cards and the 1,000-school panel fit above the footer at 1280×800 and 1366×768. A 390×844 check found no horizontal overflow. No application console errors were observed.
- The README uses the supplied logo and contains only a short overview, setup, generation, and check commands, with no school-specific references.

## Earlier verification

Checked on 2026-10-11 with Node.js 24.21.0 and the T3 collaborative browser.

## Automated checks

- All 23 tests pass. They cover election fixtures, transfers, ties, all six visitor rankings, score and approval totals, strategic reporting, input validation, and the new guided examples.
- TypeScript and ESLint pass.
- The standard `npm run build` production build passes with Turbopack. A webpack production build also passed before the final semantic heading adjustment.
- The initial sandboxed build received empty output from Next.js’s TypeScript subprocess. Running the build outside the restricted process sandbox resolved this without changing application configuration or disabling checks.

## Guided journey

The main flow is candidates → first-choice vote and spoiler → ranking and counting → all five Arrow conditions → rating gaps → choosing a priority. The playground is optional at the end.

Browser verification covered:

- Candidate cards show a personality, a quote, and two promises. Cast vote is disabled until a candidate is selected.
- Choosing Kabir gives Aarav 40, Meera 35, Kabir 26. Withdrawal requires an explicit visitor backup before continuing. Choosing Aarav as backup gives Aarav 41 and Meera 60, preserving 101 ballots.
- Choosing Meera gives Aarav 40, Meera 36, Kabir 25. Withdrawal gives Aarav 40 and Meera 61 without inventing a visitor backup.
- Transfer copy explicitly explains the shared backup in the prepared example and that voters can choose different backups. Inspect the ballots explains the grouped rows and why a Meera → Kabir → Aarav ballot would transfer to Kabir only if Meera left while Kabir remained. Browser rechecked the withdrawal caption, expanded ballot explanation, and unchanged closed-accordion footer position.
- Ranking offers explicit first-choice and backup selections, followed by a complete ballot preview. Changing the first choice clears the backup. Counting remains disabled until both choices are present.
- A Kabir → Aarav → Meera ballot transfers to Aarav. Instant runoff ends at Aarav 41, Meera 60. Borda gives Aarav 81, Meera 135, Kabir 87.
- Later ranking edits do not rewrite the original first-choice snapshot. A visitor who originally chose Meera still sees 40/36/25 when returning from an edited Kabir-first ranking.
- All five Arrow conditions are reachable in sequence: unrestricted domain, social ordering, unanimity, non-dictatorship, and independence of irrelevant alternatives. Previously visited conditions can be reviewed.
- The three-student cycle has three 2–1 pairwise majorities.
- Moving Kabir in the five-student Borda example keeps each student’s Aarav–Meera order unchanged but changes the group comparison from Meera 7 / Aarav 6 to Aarav 6 / Meera 4.
- Arrow’s summary states the ranking-only scope, at least three options, a finite electorate of at least two people, and the guarantee over every possible preference profile. The cycle is described as an illustration, not a proof.
- Ratings start with totals 10/15/5 and Meera winning. Changing Student 1’s reported scores from 10/9/0 to 10/1/0 gives totals 10/7/5 and Aarav winning, without changing either student’s order.
- The final priority selection gives a relevant trade-off. The optional playground receives the confirmed ranked ballot and returns to the final guided screen.
- Cancelling reset preserves progress. Confirming reset clears choices and returns to candidates with Cast disabled. The final New election action also resets the experience.

## Layout and content

Desktop checks at 1280×800 and 1366×768 confirmed a consistent activity-and-explanation layout. Candidate cards and primary navigation fit the laptop viewport. The footer remains at the same position across the main closed-accordion screens. Opening optional detail can naturally extend the page.

Mobile checks at 390×844 covered candidate cards, first-choice results, and ranking controls: readable text, clear selection, and no horizontal overflow. Inter loads locally. No application console errors were observed; the initial attempt to open port 3001 failed because the active development server was on port 3000.

The main app contains no presenter script, timing labels, decorative badges, or uppercase section labels. Fictional teaching data and external sources are explained in About. Scores use explicit separate ballots, not conversions from rankings. Choices stay local and reset on refresh.
