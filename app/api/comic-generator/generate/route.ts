import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';
import { createResource, buildSteeringContext } from '@/lib/style-lab';
import { incrementGenerationCount } from '@/lib/schema-lab';
import { generateImageBuffer } from '@/lib/design-assets-gen';
import { buildComicScriptPrompt, buildCastComicScriptPrompt, drawComicCoverPage, drawComicPage, drawLiteracyQuestionsPage, COMIC_PANEL_STYLE_SUFFIX, COMIC_CAST_CATALOG, PAGE_W, PAGE_H } from '@/lib/comic-generator';
import { sanitizeAiJsonText } from '@/lib/worksheet-pdf';
import { CURRICULUM_ELABORATIONS, ELABORATIONS_SUBJECT_MAP } from '@/lib/curriculum-full-elaborations';

const admin: any = supabaseAdmin;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 300;

const BC_ALIASES = ['bc', 'british columbia', 'british columbia, canada'];

// Standing process (Aj, 2026-07-21): "always should be, start with bc
// curriculum, next steering documents then make it in the comic book
// magazine style generator" -- every comic generation, topic or weekly,
// now grounds its AI script in (1) the official BC curriculum content for
// the subject+grade if available (same CURRICULUM_ELABORATIONS data and
// BC-detection pattern inb-generator.ts uses), then (2) Aj's steering
// documents (buildSteeringContext), before the script-writing prompt even
// runs. This isn't a one-off for this dinosaur comic -- it's the new
// default sequence for this whole generator going forward.
function buildCurriculumBlockForSubject(subject: string, gradeLevel: string, jurisdiction: string): string {
  const jur = (jurisdiction || 'British Columbia, Canada').trim();
  const isBC = BC_ALIASES.includes(jur.toLowerCase());
  if (!isBC) {
    return `Jurisdiction: ${jur}. Use general knowledge of ${jur}'s official curriculum standards for ${subject}, Grade ${gradeLevel}. Stay conservative rather than inventing specific standard codes you're not confident about.`;
  }
  const subjectKey = (ELABORATIONS_SUBJECT_MAP as any)[subject];
  const curriculumGrade = subjectKey ? (CURRICULUM_ELABORATIONS as any)[subjectKey]?.[gradeLevel] : null;
  if (!curriculumGrade) {
    return `No structured BC curriculum data found for ${subject} Grade ${gradeLevel} -- use general grade-appropriate BC curriculum knowledge.`;
  }
  const elaborationLines = (curriculumGrade.elaborations || [])
    .slice(0, 4)
    .map((e: any) => `${e.term}: ${e.detail}`)
    .join(' | ');
  return `Official BC Curriculum for ${subject}, Grade ${gradeLevel}:\nBig Ideas: ${curriculumGrade.bigIdeas.join(' | ')}\nContent: ${curriculumGrade.content.join(' | ')}${elaborationLines ? `\nKey elaborations: ${elaborationLines}` : ''}`;
}

// Comic Book Article / Weekly Reader Generator (Aj, 2026-07-21): the
// comic-book-style branch of the "Classroom Current Events Periodical"
// schema. POST { userId, mode, artMode, gradeLevel, ... } -> ONE
// assembled, printable, black-and-white comic PDF with real vector panel
// borders + speech bubbles (lib/comic-generator.ts) and a closing literacy
// response questions page.
//
// mode 'topic': { subject, topic } -- a standalone comic-book article on
// any subject, any grade.
//
// mode 'weekly': { weekStart, weekEnd, lessonPlannerUserId? } -- curates
// what's ACTUALLY happening that school week straight from lesson-planner's
// own tables (daily_plans for subject/topic content, calendar_events for
// assemblies/guest speakers/special events) into one narrative comic. This
// reads those tables directly rather than over an HTTP cross-app call --
// lesson-planner and project-forge share one Supabase project
// (bxsrnamtutxjzglyqmhc), so a same-DB query is simpler and more reliable
// than adding a secret-gated fetch + a new required env var. Defaults
// lessonPlannerUserId to the Forge userId since Aj's account is the same
// UUID across both apps.
//
// artMode 'full' (default): every panel gets a fresh AI-illustrated scene.
// artMode 'cast' (2026-07-21, per Aj -- avoid AI-generating everything,
// cost concern): panels reuse the pre-generated character library
// (library_parts, category='comic-character') -- Fox Fable/Owl Professor/
// Robot Scout (Math Mastery's mascots, restyled once into this B&W comic
// look) plus new original students Kai and Zoe. The AI script step only
// PICKS characterId+pose per panel from the fixed catalog; the route looks
// up the matching cached image URL and embeds it directly -- ZERO image-
// gen API calls per generation, only the one Claude call for the script.
async function fetchCastImageMap(userId: string): Promise<Record<string, string>> {
  const { data, error } = await admin
    .from('library_parts')
    .select('source_id, file_url')
    .eq('user_id', userId)
    .eq('kind', 'image')
    .eq('category', 'comic-character');
  if (error) throw new Error(`library_parts (comic-character) query failed: ${error.message}`);
  const map: Record<string, string> = {};
  for (const row of data || []) {
    // source_id is "comic-cast:<characterId>:<pose>" -- key by "<characterId>:<pose>"
    const parts = String(row.source_id || '').split(':');
    if (parts.length === 3 && parts[0] === 'comic-cast') map[`${parts[1]}:${parts[2]}`] = row.file_url;
  }
  return map;
}

// daily_plans rows are seeded lazily -- only created when the teacher
// actually opens the Daily Planner for that specific date (see
// lesson-planner's app/api/daily-plan/route.js GET handler). That means a
// week nobody has clicked into day-by-day yet has zero daily_plans rows
// even though the Year Timeline already knows what's SUPPOSED to be
// covered. Same week-number math lesson-planner itself uses
// (lib/assessment-types.js currentInstructionalWeek, lib/daily-plan.js
// activeUnitForSubjectThisWeek), reimplemented here read-only so this
// fallback finds the same answer the teacher would see in-app.
function weekNumberForDate(schoolOpeningDate: string, targetDate: string): number | null {
  if (!schoolOpeningDate) return null;
  const start = new Date(schoolOpeningDate);
  const target = new Date(targetDate);
  const diffDays = Math.floor((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return null;
  return Math.max(1, Math.floor(diffDays / 7) + 1);
}

async function fetchTimelineFallback(lessonPlannerUserId: string, weekStart: string, weekEnd: string) {
  const { data: inv } = await admin
    .from('teacher_inventories')
    .select('school_calendar_summary')
    .eq('user_id', lessonPlannerUserId)
    .maybeSingle();
  const openingDate = inv?.school_calendar_summary?.schoolOpeningDate;
  if (!openingDate) return [];

  const startWeek = weekNumberForDate(openingDate, weekStart);
  const endWeek = weekNumberForDate(openingDate, weekEnd);
  if (!startWeek) return [];
  const lo = startWeek;
  const hi = endWeek || startWeek;

  const { data: units, error } = await admin
    .from('timeline_units')
    .select('subject, unit_name, start_week, end_week')
    .eq('user_id', lessonPlannerUserId);
  if (error || !units) return [];

  // A unit is "active" this week if its [start_week, end_week] range
  // overlaps [lo, hi] at all, not just an exact match -- a multi-week unit
  // spanning into this week still counts as being covered this week.
  const active = units.filter((u: any) => u.start_week <= hi && u.end_week >= lo);
  const bySubject = new Map<string, Set<string>>();
  for (const u of active) {
    if (!bySubject.has(u.subject)) bySubject.set(u.subject, new Set());
    bySubject.get(u.subject)!.add(u.unit_name);
  }
  return Array.from(bySubject.entries()).map(([subject, topics]) => ({ subject, topics: Array.from(topics) }));
}

async function fetchWeeklyDigest(lessonPlannerUserId: string, weekStart: string, weekEnd: string) {
  const { data: plans, error: plansErr } = await admin
    .from('daily_plans')
    .select('plan_date, blocks')
    .eq('user_id', lessonPlannerUserId)
    .gte('plan_date', weekStart)
    .lte('plan_date', weekEnd);
  if (plansErr) throw new Error(`daily_plans query failed: ${plansErr.message}`);

  const bySubject = new Map<string, Set<string>>();
  for (const plan of plans || []) {
    for (const block of plan.blocks || []) {
      if (!block || block.fixed || !block.content || !block.subject) continue;
      if (!bySubject.has(block.subject)) bySubject.set(block.subject, new Set());
      bySubject.get(block.subject)!.add(block.content);
    }
  }
  let subjectContent = Array.from(bySubject.entries()).map(([subject, topics]) => ({ subject, topics: Array.from(topics) }));
  let subjectSource: 'daily_plans' | 'timeline_units_fallback' | 'none' = subjectContent.length ? 'daily_plans' : 'none';

  // Nothing seeded in Daily Planner for this range yet -- fall back to
  // what the Year Timeline says is scheduled, so weekly mode still has
  // real content the FIRST time it's ever run for a given week, not just
  // after the teacher has clicked into every individual day.
  if (subjectContent.length === 0) {
    const fallback = await fetchTimelineFallback(lessonPlannerUserId, weekStart, weekEnd);
    if (fallback.length) {
      subjectContent = fallback;
      subjectSource = 'timeline_units_fallback';
    }
  }

  const { data: events, error: eventsErr } = await admin
    .from('calendar_events')
    .select('event_date, title')
    .eq('user_id', lessonPlannerUserId)
    .gte('event_date', weekStart)
    .lte('event_date', weekEnd)
    .order('event_date', { ascending: true });
  if (eventsErr) throw new Error(`calendar_events query failed: ${eventsErr.message}`);

  return { subjectContent, subjectSource, events: events || [] };
}

function formatWeeklyContext(digest: { subjectContent: { subject: string; topics: string[] }[]; subjectSource?: string; events: { event_date: string; title: string }[] }): string {
  const subjLines = digest.subjectContent.length
    ? digest.subjectContent.map((s) => `- ${s.subject}: ${s.topics.join('; ')}`).join('\n')
    : '(no subject content found in the Daily Planner for this date range yet)';
  const eventLines = digest.events.length
    ? digest.events.map((e) => `- ${e.event_date}: ${e.title}`).join('\n')
    : '(no special events found on the Calendar for this date range)';
  return `Subjects covered this week (from the Daily Planner):\n${subjLines}\n\nSpecial events this week (assemblies, guest speakers, etc., from the Calendar):\n${eventLines}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId, mode, subject, topic, gradeLevel,
      panelCount = 6, imageProvider = 'gemini',
      weekStart, weekEnd, lessonPlannerUserId,
      schemaId, artMode = 'full', jurisdiction = 'British Columbia, Canada',
    } = body || {};

    if (!userId || !mode || !gradeLevel) {
      return NextResponse.json({ error: 'userId, mode, and gradeLevel are required' }, { status: 400 });
    }
    if (mode !== 'topic' && mode !== 'weekly') {
      return NextResponse.json({ error: 'mode must be "topic" or "weekly"' }, { status: 400 });
    }
    if (artMode !== 'full' && artMode !== 'cast') {
      return NextResponse.json({ error: 'artMode must be "full" or "cast"' }, { status: 400 });
    }
    if (mode === 'topic' && (!subject || !topic)) {
      return NextResponse.json({ error: 'subject and topic are required for topic mode' }, { status: 400 });
    }
    if (mode === 'weekly' && (!weekStart || !weekEnd)) {
      return NextResponse.json({ error: 'weekStart and weekEnd (YYYY-MM-DD) are required for weekly mode' }, { status: 400 });
    }
    const count = Math.max(4, Math.min(8, Number(panelCount) || 6));

    let weeklyContext: string | undefined;
    let digestUsed: any = null;
    if (mode === 'weekly') {
      digestUsed = await fetchWeeklyDigest(lessonPlannerUserId || userId, weekStart, weekEnd);
      weeklyContext = formatWeeklyContext(digestUsed);
    }

    // Step 1 of the standing process: BC curriculum grounding. Topic mode
    // grounds against the one subject given; weekly mode grounds against
    // every subject in the digest (usually 2-3), each looked up
    // separately since a cross-subject week has no single "the" subject.
    let curriculumBlock: string;
    if (mode === 'topic') {
      curriculumBlock = buildCurriculumBlockForSubject(subject, gradeLevel, jurisdiction);
    } else {
      const subjects: string[] = (digestUsed?.subjectContent || []).map((s: any) => s.subject);
      curriculumBlock = subjects.length
        ? subjects.map((s) => buildCurriculumBlockForSubject(s, gradeLevel, jurisdiction)).join('\n\n')
        : `No subjects found for this week yet, so no curriculum lookup to run -- see the digest above.`;
    }

    // Step 2 of the standing process: Aj's steering documents. Best-effort
    // -- a steering fetch failure shouldn't block generation, same
    // fallback pattern inb-generator.ts uses.
    const steeringContext = await buildSteeringContext(userId).catch(() => '');

    // Step 3: hand both grounding blocks to the comic script prompt.
    const scriptPrompt = artMode === 'cast'
      ? buildCastComicScriptPrompt({ mode, subject, topic, gradeLevel, panelCount: count, weeklyContext, curriculumBlock, steeringContext })
      : buildComicScriptPrompt({ mode, subject, topic, gradeLevel, panelCount: count, weeklyContext, curriculumBlock, steeringContext });
    const scriptResp = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2200,
      messages: [{ role: 'user', content: scriptPrompt }],
    });
    const textBlock = scriptResp.content.find((b: any) => b.type === 'text') as any;
    const rawScript = (textBlock?.text || '').replace(/```json|```/g, '').trim();
    let script: any;
    try {
      script = JSON.parse(rawScript);
    } catch {
      const match = rawScript.match(/\{[\s\S]*\}/);
      script = match ? JSON.parse(match[0]) : null;
    }
    if (!script || !Array.isArray(script.panels) || script.panels.length === 0) {
      return NextResponse.json({ error: 'Could not parse the generated comic script -- try again' }, { status: 502 });
    }
    // Sanitize every generated string (title, captions, dialogue, scene
    // descriptions, literacy questions) in one pass so downstream
    // page.drawText calls never choke on a smart quote/em dash pdf-lib's
    // base WinAnsi font can't encode -- same choke point inb-generator.ts
    // uses for AI JSON content.
    script = sanitizeAiJsonText(script);

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const coverPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
    drawComicCoverPage(coverPage, {
      width: PAGE_W, height: PAGE_H, title: script.title,
      subtitle: mode === 'weekly' ? `Week of ${weekStart}` : `${subject}: ${topic}`,
      grade: gradeLevel, font, boldFont,
    });

    const embeddedPanels: any[] = [];
    let failedPanels = 0;

    if (artMode === 'cast') {
      // Zero AI image calls: look up each panel's chosen character+pose in
      // the cached library and embed that image directly. An invalid/
      // hallucinated characterId or pose (shouldn't happen given the fixed
      // catalog in the prompt, but AI output is never 100% guaranteed) is
      // best-effort skipped rather than failing the whole comic.
      const castMap = await fetchCastImageMap(userId);
      const validIds = new Set(COMIC_CAST_CATALOG.map((c) => c.id));
      for (const p of script.panels) {
        const chars = Array.isArray(p.characters) ? p.characters.filter((c: any) => validIds.has(c.characterId)) : [];
        const images: any[] = [];
        for (const c of chars.slice(0, 2)) {
          const url = castMap[`${c.characterId}:${c.pose}`] || castMap[`${c.characterId}:base`];
          if (!url) continue;
          try {
            const res = await fetch(url);
            const buf = Buffer.from(await res.arrayBuffer());
            images.push(await pdfDoc.embedPng(buf));
          } catch { /* skip this character image, panel still renders caption/dialogue */ }
        }
        if (images.length === 0) failedPanels++;
        embeddedPanels.push({ images, caption: p.caption, dialogue: p.dialogue });
      }
    } else {
      // Generate all panel images in parallel so total wall-clock time is
      // one image call's latency, not panelCount times that. Best-effort:
      // a failed panel renders as a blank bordered box (see drawComicPage)
      // rather than failing the whole comic over one bad image call.
      const panelImageResults = await Promise.all(
        script.panels.map((p: any) =>
          generateImageBuffer({
            prompt: `${p.sceneDescription}${COMIC_PANEL_STYLE_SUFFIX}`,
            provider: imageProvider,
          }).catch((e: any) => ({ error: errorMessage(e) }))
        )
      );
      for (let i = 0; i < script.panels.length; i++) {
        const p = script.panels[i];
        const imgResult: any = panelImageResults[i];
        let embedded: any = null;
        if (imgResult && !imgResult.error && imgResult.buffer) {
          try {
            embedded = imgResult.contentType === 'image/jpeg' ? await pdfDoc.embedJpg(imgResult.buffer) : await pdfDoc.embedPng(imgResult.buffer);
          } catch { embedded = null; }
        }
        if (!embedded) failedPanels++;
        embeddedPanels.push({ images: embedded ? [embedded] : [], caption: p.caption, dialogue: p.dialogue });
      }
    }

    const panelsPerPage = 6;
    const pageCount = Math.ceil(embeddedPanels.length / panelsPerPage);
    for (let pg = 0; pg < pageCount; pg++) {
      const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      drawComicPage(page, embeddedPanels.slice(pg * panelsPerPage, (pg + 1) * panelsPerPage), {
        width: PAGE_W, height: PAGE_H, font, boldFont, issueTitle: script.title, pageLabel: `Page ${pg + 1} of ${pageCount}`,
      });
    }

    const qPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
    drawLiteracyQuestionsPage(qPage, script.literacyQuestions || [], { width: PAGE_W, height: PAGE_H, font, boldFont, title: script.title });

    const pdfBytes = await pdfDoc.save();
    const basePath = `${userId}/comic-generated/${Date.now()}`;
    const { error: pdfUpErr } = await admin.storage.from('design-assets').upload(`${basePath}.pdf`, Buffer.from(pdfBytes), { contentType: 'application/pdf', upsert: true });
    if (pdfUpErr) throw new Error(`PDF storage upload failed: ${pdfUpErr.message}`);
    const { data: pdfUrlData } = admin.storage.from('design-assets').getPublicUrl(`${basePath}.pdf`);

    const saved = await createResource(userId, {
      subject: mode === 'weekly' ? 'Weekly Comic Reader' : subject,
      source_type: 'pdf',
      origin: 'schema_generated',
      title: script.title,
      file_url: pdfUrlData.publicUrl,
      original_text: mode === 'weekly'
        ? `Comic-style weekly reader generated from the Daily Planner + Calendar for the week of ${weekStart} to ${weekEnd}. (art mode: ${artMode})`
        : `Comic-style article generated for ${subject}, topic "${topic}", grade ${gradeLevel}. (art mode: ${artMode})`,
    });

    if (schemaId) {
      try { await incrementGenerationCount(userId, schemaId); } catch { /* non-fatal */ }
    }

    return NextResponse.json({
      ok: true,
      title: script.title,
      artMode,
      pdfUrl: pdfUrlData.publicUrl,
      savedResourceId: saved.id,
      panelCount: embeddedPanels.length,
      failedPanels,
      literacyQuestions: script.literacyQuestions,
      digestUsed: mode === 'weekly' ? digestUsed : undefined,
      groundingUsed: {
        curriculumBlock,
        steeringContextLength: (steeringContext || '').length,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
