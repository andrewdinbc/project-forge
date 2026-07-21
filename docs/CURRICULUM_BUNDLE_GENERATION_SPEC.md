# Curriculum → Year-Long Resource Bundle → TeacherAssist Storefront

Status: spec only, written 2026-07-20 at Aj's request. Not yet built.
Grounded against real code in `project-forge` (main, as of this commit), `lesson-planner`
(`docs/YEAR_PLAN_SEQUENCING_REFINED.md`), and `teacherassist-website`.

## What already exists (verified against code, not READMEs)

Project Forge is further along than its one-line README suggests. It already has:

- **30 generator APIs** (`app/api/worksheet-generators/*`) — crossword, word search, spelling
  list/test, quiz, flashcards, bingo, cipher wheels, reading passage, graphic organizer, math
  crosswords, mystery pictures, INB pieces, foldables, etc. Each is a standalone, human-operated
  dashboard tool today (`app/(dashboard)/dashboard/worksheet-generators/*`).
- **Full BC K-9 curriculum data already loaded** (`lib/curriculum-full-elaborations.js`) — Big
  Ideas, Content, and Ministry Elaborations for all 9 subject areas. This is the exact input a
  curriculum-driven generator would need, and it's already there.
- **A bundle/product data model** (`bundles`, `bundle_items`, `products`, `tpt_metadata` tables)
  with pricing fields (`bundle_price_usd`, `original_price_usd`, `bundle_discount`) already
  present on `bundles` — built for TPT, but the shape is reusable.
- **A copyright audit endpoint** (`app/api/copyright-audit/route.ts`) — should gate anything
  before it's listed for sale.
- **A `from-lesson-planner` bridge page** — but this is a *different* pipeline: it surfaces
  teacher-uploaded PDFs/URLs for manual review → AI Steering / manual TPT tagging. It is not an
  auto-generation pipeline and doesn't touch the 30 generators.

## What does not exist (also verified — zero hits for "stripe" or "checkout" in the repo)

1. **No auto-planner.** Nothing maps "this is a Grade 4 fractions unit" → "run spelling-list,
   crossword, quiz, graphic-organizer with these params." Every generator is a manual, one-at-a-
   time human tool today.
2. **No batch orchestration.** Nothing loops over a full year plan and calls generators
   unattended.
3. **No commerce.** The entire TPT flow is a checklist telling the teacher to log into TPT and
   upload manually (`lib/tpt-checklist.ts`, Brevo "bundle ready" email). `teacherassist-website`
   (optimizeyourfreedom.com) is a 10-file splash page — no products page, no cart, no payment.
   Selling directly *from* the TeacherAssist site is new infrastructure, not a wiring job.

## Proposed architecture (3 layers)

### Layer A — Bundle Auto-Planner (new, in project-forge)
Input: a teacher's Unit Priorities from lesson-planner (subject, grade, topic, and — once
`unit_support_plan.resources_needed` ships per the sequencing spec — the resource-type tags the
teacher already flagged) + `CURRICULUM_ELABORATIONS` for that subject/grade.
Output: a per-unit resource plan — which of the 30 generators to run, with what params (topic,
grade reading level, term/vocab lists pulled from curriculum content). Default mapping example:
a vocabulary-heavy ELA unit → spelling-list + spelling-test + word-search + crossword; a reading
unit → reading-passage + graphic-organizer + quiz; a math unit → math worksheet + math-riddle +
math-crossword. This mapping needs your review before it's hardcoded — it's a judgment call per
subject, not something to guess silently.

### Layer B — Batch Generation Orchestrator (new, in project-forge)
Loops the Auto-Planner's output across every unit in the year, calls the existing generator
routes server-side (no human clicking through 30 screens), assembles results into one `bundle`
per year via the *existing* `bundles`/`bundle_items` schema — no schema change needed here.
Runs `copyright-audit` before marking anything sellable.

### Layer C — Storefront (new, in teacherassist-website)
Public product/bundle listing + checkout. This is the piece with real financial stakes, so I'm
not picking a mechanism for you. Two realistic paths:
- **Stripe Checkout** — real card payment on your own site. New integration, needs your Stripe
  account connected; I can't create merchant/payment accounts or enter payment details myself.
- **License-key model** — reuse the exact `licence_keys` pattern already live for TeacherAssist
  BC/AB/ON (MORPH-/ALTA- prefixes, Supabase-backed), which sidesteps building a cart entirely.

Per your existing Tier 3 framework (`optimizeyourfreedom.com`, full ecosystem, ~annual plan),
these year-long bundles read as a Tier 3 product — flagging that assumption for confirmation
rather than assuming it.

## Footnote — unrelated but noticed while checking Vercel
`Vercel:list_projects` shows hyphen/underscore duplicate pairs for most projects
(`project-forge`/`project_forge`, `lesson-planner`/`lesson_planner`, `parent-portal`/
`parent_portal`, etc. — ~15 pairs). Matches the "five duplicates deleted" pattern from June;
looks like it's recurred. Not touching these now since it's outside this request — flagging so
it doesn't get discovered the hard way later.
