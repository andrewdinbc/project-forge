import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';
import { createResource } from '@/lib/style-lab';
import { incrementGenerationCount } from '@/lib/schema-lab';
import { generateImageBuffer } from '@/lib/design-assets-gen';
import { buildComicScriptPrompt, drawComicCoverPage, drawComicPage, drawLiteracyQuestionsPage, COMIC_PANEL_STYLE_SUFFIX, PAGE_W, PAGE_H } from '@/lib/comic-generator';
import { sanitizeAiJsonText } from '@/lib/worksheet-pdf';

const admin: any = supabaseAdmin;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 300;

// Comic Book Article / Weekly Reader Generator (Aj, 2026-07-21): the
// comic-book-style branch of the "Classroom Current Events Periodical"
// schema. POST { userId, mode, gradeLevel, ... } -> ONE assembled,
// printable, black-and-white comic PDF with real vector panel borders +
// speech bubbles (lib/comic-generator.ts), AI-generated B&W line-art
// illustrations per panel (lib/design-assets-gen.ts), and a closing
// literacy response questions page.
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
  const subjectContent = Array.from(bySubject.entries()).map(([subject, topics]) => ({ subject, topics: Array.from(topics) }));

  const { data: events, error: eventsErr } = await admin
    .from('calendar_events')
    .select('event_date, title')
    .eq('user_id', lessonPlannerUserId)
    .gte('event_date', weekStart)
    .lte('event_date', weekEnd)
    .order('event_date', { ascending: true });
  if (eventsErr) throw new Error(`calendar_events query failed: ${eventsErr.message}`);

  return { subjectContent, events: events || [] };
}

function formatWeeklyContext(digest: { subjectContent: { subject: string; topics: string[] }[]; events: { event_date: string; title: string }[] }): string {
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
      schemaId,
    } = body || {};

    if (!userId || !mode || !gradeLevel) {
      return NextResponse.json({ error: 'userId, mode, and gradeLevel are required' }, { status: 400 });
    }
    if (mode !== 'topic' && mode !== 'weekly') {
      return NextResponse.json({ error: 'mode must be "topic" or "weekly"' }, { status: 400 });
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

    const scriptPrompt = buildComicScriptPrompt({ mode, subject, topic, gradeLevel, panelCount: count, weeklyContext });
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

    // Generate all panel images in parallel so total wall-clock time is one
    // image call's latency, not panelCount times that. Best-effort: a
    // failed panel renders as a blank bordered box (see drawComicPage)
    // rather than failing the whole comic over one bad image call.
    const panelImageResults = await Promise.all(
      script.panels.map((p: any) =>
        generateImageBuffer({
          prompt: `${p.sceneDescription}${COMIC_PANEL_STYLE_SUFFIX}`,
          provider: imageProvider,
        }).catch((e: any) => ({ error: errorMessage(e) }))
      )
    );

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
      embeddedPanels.push({ image: embedded, caption: p.caption, dialogue: p.dialogue });
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
        ? `Comic-style weekly reader generated from the Daily Planner + Calendar for the week of ${weekStart} to ${weekEnd}.`
        : `Comic-style article generated for ${subject}, topic "${topic}", grade ${gradeLevel}.`,
    });

    if (schemaId) {
      try { await incrementGenerationCount(userId, schemaId); } catch { /* non-fatal */ }
    }

    return NextResponse.json({
      ok: true,
      title: script.title,
      pdfUrl: pdfUrlData.publicUrl,
      savedResourceId: saved.id,
      panelCount: embeddedPanels.length,
      failedPanels,
      literacyQuestions: script.literacyQuestions,
      digestUsed: mode === 'weekly' ? digestUsed : undefined,
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
