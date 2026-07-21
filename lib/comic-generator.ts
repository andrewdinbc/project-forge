// lib/comic-generator.ts (Aj, 2026-07-21): "Classroom Current Events
// Periodical" Schema's comic-book-style branch -- a black-and-white,
// cheap-to-print comic reader generator usable for ANY subject, in two
// story modes:
//   - 'topic': a standalone comic-book article on a subject/topic of choice
//   - 'weekly': curates this actual school week's Daily Planner subjects
//     (via daily_plans) plus assemblies/guest speakers/special events (via
//     calendar_events) into ONE cross-subject narrative "weekly reader"
//     comic -- see app/api/comic-generator/generate/route.ts for the
//     digest query, this file only knows about already-formatted context.
//
// ...and two art modes (2026-07-21, per Aj: "I do not have to AI generate
// all of this... I suspect it will become rather costly"):
//   - 'full': every panel gets a fresh AI-illustrated scene (original
//     behavior, most visual variety, costs one image-gen call per panel).
//   - 'cast': panels reuse a small pre-generated REUSABLE character library
//     (5 characters x 4 poses, generated once, stored in library_parts,
//     category='comic-character') -- Fox Fable/Owl Professor/Robot Scout
//     (Math Mastery's existing mascots, restyled into this B&W comic look
//     via reference-image-guided generation so the character design stays
//     the same) plus two new original student characters, Kai and Zoe, for
//     weekly-reader narratives. Zero AI image calls per generation in cast
//     mode -- the AI script step just PICKS characters+poses from the
//     catalog, and the panel embeds already-generated cached images. This
//     is the actual cost lever: pay once for the cast, reuse indefinitely.
//
// Panels are real vector geometry (borders, caption boxes, speech
// bubbles) drawn with pdf-lib, same approach as lib/foldable-shapes.ts.

import { rgb } from 'pdf-lib';
import { wrapLines } from './worksheet-pdf';

export const PAGE_W = 612; // US Letter portrait
export const PAGE_H = 792;

export interface ComicDialogueLine {
  speaker: string;
  line: string;
}

export interface ComicPanelScript {
  sceneDescription: string;
  caption?: string;
  dialogue?: ComicDialogueLine[];
}

export interface ComicScript {
  title: string;
  panels: ComicPanelScript[];
  literacyQuestions: string[];
}

// The reusable cast catalog. characterId values are the stable keys used
// both in library_parts.source_id ("comic-cast:<characterId>:<pose>") and
// in the AI's cast-mode script JSON. Keep in sync with the actual rows in
// library_parts (category='comic-character') -- this const is the prompt-
// facing description of what's available, the DB rows are the real asset
// lookup, fetched live in the API route so new poses/characters can be
// added later without a code change on the lookup side.
export const COMIC_CAST_CATALOG: { id: string; name: string; type: 'mascot' | 'student' | 'brand_mascot' | 'adult' | 'pet' | 'teen' | 'folklore'; description: string; poses: string[] }[] = [
  { id: 'fox-fable', name: 'Fox Fable', type: 'mascot', description: 'a clever, encouraging fox mascot (reused from Math Mastery) -- v2 art: illustrated with a background scene (cozy study nook)', poses: ['base', 'happy', 'thinking', 'pointing', 'waving', 'surprised', 'walking', 'sitting'] },
  { id: 'owl-professor', name: 'Owl Professor', type: 'mascot', description: 'a wise, bespectacled owl mascot who explains things (reused from Math Mastery)', poses: ['base', 'happy', 'thinking', 'pointing'] },
  { id: 'robot-scout', name: 'Robot Scout', type: 'mascot', description: 'a helpful, curious robot mascot (reused from Math Mastery)', poses: ['base', 'happy', 'thinking', 'pointing'] },
  { id: 'kai', name: 'Kai', type: 'student', description: 'an original student character -- curious, curly hair, glasses, backpack -- v2 art: illustrated with a background scene (schoolyard)', poses: ['base', 'happy', 'thinking', 'pointing', 'waving', 'surprised', 'walking', 'sitting'] },
  { id: 'zoe', name: 'Zoe', type: 'student', description: 'an original student character -- determined, braided hair, favorite jacket', poses: ['base', 'happy', 'thinking', 'pointing'] },
  { id: 'chip', name: 'Chip', type: 'brand_mascot', description: 'the Chalk & Circuit brand mascot -- a friendly circuit-board character (reused across all Chalk & Circuit products, not just one subject)', poses: ['base', 'happy', 'thinking', 'pointing'] },
  { id: 'ms-diaz', name: 'Ms. Diaz', type: 'adult', description: 'an original teacher character -- warm, approachable, glasses and cardigan, good for classroom/assembly scenes needing an adult', poses: ['base', 'happy', 'thinking', 'pointing'] },
  { id: 'remy', name: 'Remy Rabbit', type: 'mascot', description: 'a quick-witted, energetic rabbit mascot -- good for fast-paced or excited story beats', poses: ['base', 'happy', 'thinking', 'pointing'] },
  { id: 'leo', name: 'Leo', type: 'student', description: 'an original student character -- glasses, tousled brown hair, gray zip-up hoodie', poses: ['base', 'happy', 'thinking', 'pointing'] },
  { id: 'maya', name: 'Maya', type: 'student', description: 'an original student character -- shoulder-length brown hair, gray zip-up hoodie', poses: ['base', 'happy', 'thinking', 'pointing'] },
  { id: 'andre', name: 'Andre', type: 'student', description: 'an original student character -- glasses, dark hair, gray zip-up hoodie', poses: ['base', 'happy', 'thinking', 'pointing'] },
  { id: 'mei', name: 'Mei', type: 'student', description: 'an original student character -- shoulder-length dark hair, patterned top', poses: ['base', 'happy', 'thinking', 'pointing'] },
  { id: 'byte', name: 'Byte', type: 'mascot', description: 'a warm, caring robot mascot with a heart symbol on its chest -- distinct personality from Robot Scout, good for encouraging/emotional-support moments', poses: ['base', 'happy', 'thinking', 'pointing'] },
  { id: 'biscuit', name: 'Biscuit', type: 'pet', description: 'a cheerful, loyal West Highland Terrier dog', poses: ['base', 'happy', 'thinking', 'pointing'] },
  { id: 'rusty', name: 'Rusty', type: 'pet', description: 'a scrappy, adventurous Cairn Terrier dog', poses: ['base', 'happy', 'thinking', 'pointing'] },
  { id: 'snowball', name: 'Snowball', type: 'pet', description: 'a calm, dignified Persian cat', poses: ['base', 'happy', 'thinking', 'pointing'] },
  { id: 'mochi', name: 'Mochi', type: 'pet', description: 'a clever, curious Siamese cat', poses: ['base', 'happy', 'thinking', 'pointing'] },
  { id: 'bramble', name: 'Bramble', type: 'pet', description: 'a gentle, hardworking everyday horse', poses: ['base', 'happy', 'thinking', 'pointing'] },
  { id: 'duchess', name: 'Duchess', type: 'pet', description: 'a proud, elegant show horse dressed for competition with ribbons', poses: ['base', 'happy', 'thinking', 'pointing'] },
  { id: 'daniel', name: 'Daniel', type: 'adult', description: 'an original adult character -- casual denim jacket, warm approachable demeanor, good for a parent/community-member role', poses: ['base', 'happy', 'thinking', 'pointing'] },
  { id: 'sarah', name: 'Sarah', type: 'adult', description: 'an original adult character -- casual denim jacket, warm approachable demeanor, good for a parent/community-member role', poses: ['base', 'happy', 'thinking', 'pointing'] },
  { id: 'tyler', name: 'Tyler', type: 'teen', description: 'an original teenage character -- hoodie, cargo pants, good for older-grade content or an "older sibling/mentor" role', poses: ['base', 'happy', 'thinking', 'pointing'] },
  { id: 'nadia', name: 'Nadia', type: 'teen', description: 'an original teenage character -- hoodie, dark jeans, good for older-grade content or an "older sibling/mentor" role', poses: ['base', 'happy', 'thinking', 'pointing'] },
  { id: 'hisao', name: 'Hisao', type: 'folklore', description: 'a wise elder turtle in traditional Japanese kimono, carries a fan and scroll -- patient, scholarly, good for storytelling/mythology/world cultures topics or a "wise mentor" role', poses: ['base', 'happy', 'thinking', 'pointing'] },
  { id: 'ren', name: 'Ren', type: 'folklore', description: 'a clever fox in traditional Japanese kimono and sedge hat -- resourceful, good-natured trickster energy, good for storytelling/mythology/world cultures topics', poses: ['base', 'happy', 'thinking', 'pointing'] },
  { id: 'yoru', name: 'Yoru', type: 'folklore', description: 'a quiet, observant raven in traditional Japanese kimono -- a message-bearer/messenger role, good for storytelling/mythology/world cultures topics', poses: ['base', 'happy', 'thinking', 'pointing'] },
  { id: 'kaito', name: 'Kaito', type: 'folklore', description: 'a warm, welcoming wolf in traditional Japanese kimono and sedge hat -- a guide/leader role, good for storytelling/mythology/world cultures topics', poses: ['base', 'happy', 'thinking', 'pointing'] },
  { id: 'takeshi', name: 'Takeshi', type: 'folklore', description: 'a young samurai warrior in traditional armor -- energetic, brave, heroic-adventure energy, good for storytelling/mythology/world cultures/Japanese-history topics -- v2 art: illustrated with the original mountain/village/bamboo background scene', poses: ['base', 'happy', 'thinking', 'pointing', 'waving', 'surprised', 'walking', 'sitting'] },
  { id: 'sakura', name: 'Sakura', type: 'folklore', description: 'a young samurai warrior in traditional armor (teen female counterpart to Takeshi) -- focused, determined, good for storytelling/mythology/world cultures/Japanese-history topics', poses: ['base', 'happy', 'thinking', 'pointing'] },
  { id: 'momo', name: 'Momo', type: 'folklore', description: 'a Cairn Terrier dog, loyal companion to Takeshi and Sakura -- good for storytelling/mythology/world cultures topics', poses: ['base', 'happy', 'thinking', 'pointing'] },
  { id: 'mizu', name: 'Mizu', type: 'folklore', description: 'a friendly Asian-style dragon, companion/guide to Takeshi and Sakura -- good for storytelling/mythology/world cultures topics, especially anything involving water, weather, or good fortune', poses: ['base', 'happy', 'thinking', 'pointing'] },
];

export interface CastPanelScript {
  characters: { characterId: string; pose: string }[];
  caption?: string;
  dialogue?: ComicDialogueLine[];
}

export interface CastComicScript {
  title: string;
  panels: CastPanelScript[];
  literacyQuestions: string[];
}

export function buildCastComicScriptPrompt(opts: {
  mode: 'topic' | 'weekly';
  subject?: string;
  topic?: string;
  gradeLevel: string;
  panelCount: number;
  weeklyContext?: string;
  curriculumBlock?: string;
  steeringContext?: string;
}): string {
  const { mode, subject, topic, gradeLevel, panelCount, weeklyContext, curriculumBlock, steeringContext } = opts;
  const castDescriptions = COMIC_CAST_CATALOG.map((c) => `- "${c.id}" (${c.name}): ${c.description}. Available poses: ${c.poses.join(', ')}.`).join('\n');

  const base = mode === 'weekly'
    ? `You are writing a SHORT COMIC-BOOK-STYLE SCRIPT for a Grade ${gradeLevel} classroom "weekly reader" comic. Weave together, as ONE light narrative, everything really happening this week per the digest below -- each subject's topic and each special event should show up as a real story beat.\n\nThis week's digest:\n${weeklyContext}`
    : `You are writing a SHORT COMIC-BOOK-STYLE SCRIPT that teaches Grade ${gradeLevel} students about a real subject topic through a narrative story with characters, not a dry list of facts.\n\nSubject: ${subject}\nTopic: ${topic}`;

  const groundingBlock = [
    curriculumBlock ? `${curriculumBlock}` : '',
    steeringContext ? `Aj's steering guidance (writing style/pedagogy preferences to follow):\n${steeringContext}` : '',
  ].filter(Boolean).join('\n\n');

  return `${base}
${groundingBlock ? `\n${groundingBlock}\n\nGround the story's factual content in the curriculum info above where relevant -- don't just use general topic knowledge if a specific Big Idea, content point, or elaboration applies.\n` : ''}
IMPORTANT: this comic uses a FIXED, PRE-DRAWN cast -- you cannot invent new characters or scenes. Every panel must use ONLY the characters below, and for each character used in a panel you must pick one of their available poses:
${castDescriptions}

Guidance: There are now six student characters available (Kai, Zoe, Leo, Maya, Andre, Mei) and two teen characters (Tyler, Nadia) -- pick 2-3 as this issue's recurring protagonists, matching age to the grade level (younger students for younger grades, Tyler/Nadia for upper-grade content) rather than always defaulting to the same characters, so different comics naturally feature different casts over time. The mascots (Fox Fable, Owl Professor, Robot Scout, Remy Rabbit, Byte) make the most sense popping in when a specific subject needs an explainer/helper moment -- e.g. Owl Professor for a tricky concept, Fox Fable for an encouraging nudge, Robot Scout for something logical/methodical, Remy Rabbit for a fast-paced or energetic beat, Byte for an encouraging/emotional-support moment. The adult characters (Ms. Diaz the teacher, Daniel and Sarah) fit naturally in classroom, assembly, or family scenes, or any moment that calls for adult guidance. Chip (the Chalk & Circuit brand mascot) is a nice choice for a "welcome" or "wrap-up" panel since it's not tied to any one subject. The pet characters (Biscuit and Rusty the dogs, Snowball and Mochi the cats, Bramble the horse, Duchess the show horse) are great for a class-pet, animal-themed, or "bring your pet to show and tell" story beat, or any topic that's naturally about animals. The folklore characters (Hisao the turtle, Ren the fox, Yoru the raven, Kaito the wolf -- all in traditional Japanese dress) are a visually distinct set best reserved for storytelling, mythology, world cultures, or folktale-structure topics (e.g. Language Arts narrative units, Social Studies world cultures) rather than mixed into everyday modern-day school scenes -- when a topic calls for them, they can carry a whole story on their own without the modern-day cast. Within that same folklore set, Takeshi and Sakura (young samurai warriors) with their companions Momo (dog) and Mizu (dragon) form their own adventure-story sub-cast, well suited to a hero's-journey or quest-structured narrative -- they can appear together with Hisao/Ren/Yoru/Kaito or carry their own separate story. You don't have to use every character. Use 1-2 characters per panel (characters interacting works well).

HARD RULE (Aj, 2026-07-21): never use the same characterId+pose combination twice across this whole comic. If a character appears in multiple panels, give them a DIFFERENT pose each time that matches that panel's emotional beat -- e.g. a character who is "thinking" in panel 2 should not also be "thinking" in panel 5; pick "pointing" or "surprised" or whatever actually fits panel 5 instead. Track which characterId+pose pairs you've already used as you write each panel and do not repeat any of them.

Write exactly ${panelCount} panels telling one coherent short story start-to-finish (a setup, a small complication or question, a resolution that lands on the real content). Each panel needs:
- "characters": array of 1-2 {"characterId": one of the ids above, "pose": one of that character's available poses}. Pick the pose that matches the emotional beat (e.g. "thinking" when puzzling something out, "happy" for a resolution, "pointing" when explaining/teaching).
- "caption": OPTIONAL short narrator caption box text (empty string if not needed).
- "dialogue": array of {"speaker": character name, "line": short spoken line under 15 words, grade-${gradeLevel}-appropriate}, 0-2 per panel.

Then write "literacyQuestions": exactly 4 short reading-response questions mixing recall, personal connection, and inference/opinion prompts, grade-${gradeLevel}-appropriate.

Also write "title": a short, fun title for this comic issue.

Respond with ONLY valid JSON, no prose, no markdown fences:
{
  "title": string,
  "panels": [{"characters": [{"characterId": string, "pose": string}], "caption": string, "dialogue": [{"speaker": string, "line": string}]}],
  "literacyQuestions": [string]
}`;
}

// A single reusable B&W line-art suffix for comic panels specifically --
// distinct from lib/design-assets-gen.ts's LINE_ART_STYLE_SUFFIX (which is
// tuned for a full-bleed coloring-page illustration) because a comic panel
// needs to compose cleanly INSIDE a drawn border rather than fight it, and
// benefits from dynamic "comic framing" language a coloring page doesn't.
export const COMIC_PANEL_STYLE_SUFFIX =
  ', black and white comic book panel illustration, clean bold ink outlines, no shading, no color, no gradients, high contrast line art, dynamic comic framing, designed to print clearly on a black and white printer, no text or speech bubbles in the image itself';

export function buildComicScriptPrompt(opts: {
  mode: 'topic' | 'weekly';
  subject?: string;
  topic?: string;
  gradeLevel: string;
  panelCount: number;
  weeklyContext?: string;
  curriculumBlock?: string;
  steeringContext?: string;
}): string {
  const { mode, subject, topic, gradeLevel, panelCount, weeklyContext, curriculumBlock, steeringContext } = opts;

  const base = mode === 'weekly'
    ? `You are writing a SHORT COMIC-BOOK-STYLE SCRIPT for a Grade ${gradeLevel} classroom "weekly reader" comic. Weave together, as ONE light narrative (two or three recurring student characters moving through their actual school week), everything really happening this week per the digest below -- each subject's topic and each special event (assembly, guest speaker, etc.) should show up as a real story beat that actually teaches or references that content, not a random list bolted together.\n\nThis week's digest:\n${weeklyContext}`
    : `You are writing a SHORT COMIC-BOOK-STYLE SCRIPT that teaches Grade ${gradeLevel} students about a real subject topic through a narrative story with characters, not a dry list of facts.\n\nSubject: ${subject}\nTopic: ${topic}`;

  const groundingBlock = [
    curriculumBlock ? `${curriculumBlock}` : '',
    steeringContext ? `Aj's steering guidance (writing style/pedagogy preferences to follow):\n${steeringContext}` : '',
  ].filter(Boolean).join('\n\n');

  return `${base}
${groundingBlock ? `\n${groundingBlock}\n\nGround the story's factual content in the curriculum info above where relevant -- don't just use general topic knowledge if a specific Big Idea, content point, or elaboration applies.\n` : ''}
Write exactly ${panelCount} panels that tell one coherent short story start-to-finish (a setup, a small complication or question, a resolution that lands on the real content). Each panel needs:
- "sceneDescription": a vivid, concrete visual description of what's happening in THIS SINGLE panel (characters, setting, action) -- written as an image-generation prompt for a black-and-white line-art illustrator. Do not mention any real, named public figure or any existing copyrighted character. Invent simple, friendly original characters (name two or three recurring ones once and reuse them across panels) rather than existing copyrighted characters.
- "caption": OPTIONAL short narrator caption box text (use an empty string if not needed for this panel).
- "dialogue": array of {"speaker": short character name, "line": short spoken line, grade-${gradeLevel}-appropriate} -- 0 to 2 lines per panel, each line under 15 words so it fits a speech bubble. Use an empty array if this panel is silent.

Then write "literacyQuestions": exactly 4 short reading-response questions a teacher could hand out after reading the comic -- a mix of recall ("What happened when...?"), personal connection ("Has something like this ever happened to you?"), and inference/opinion ("Why do you think...?") style questions, grade-${gradeLevel}-appropriate.

Also write "title": a short, fun title for this comic issue.

Respond with ONLY valid JSON, no prose, no markdown fences:
{
  "title": string,
  "panels": [{"sceneDescription": string, "caption": string, "dialogue": [{"speaker": string, "line": string}]}],
  "literacyQuestions": [string]
}`;
}

function truncateLines(lines: string[], max: number): string[] {
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  kept[max - 1] = kept[max - 1].replace(/\s*\S*$/, '') + '...';
  return kept;
}

export function drawComicCoverPage(page: any, opts: {
  width: number; height: number; title: string; subtitle: string; grade: string | number; font: any; boldFont: any;
}) {
  const { width, height, title, subtitle, grade, font, boldFont } = opts;
  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: rgb(0, 0, 0), borderWidth: 3, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 24, y: height - 140, width: width - 48, height: 116, borderColor: rgb(0, 0, 0), borderWidth: 2, color: rgb(0, 0, 0) });

  const titleLines = wrapLines(title.toUpperCase(), boldFont, 30, width - 100);
  const startY = height - 60;
  titleLines.slice(0, 3).forEach((line: string, i: number) => {
    const w = boldFont.widthOfTextAtSize(line, 30);
    page.drawText(line, { x: (width - w) / 2, y: startY - i * 34, size: 30, font: boldFont, color: rgb(1, 1, 1) });
  });

  const subLines = wrapLines(subtitle, font, 13, width - 140);
  subLines.slice(0, 2).forEach((line: string, i: number) => {
    const w = font.widthOfTextAtSize(line, 13);
    page.drawText(line, { x: (width - w) / 2, y: height - 200 - i * 18, size: 13, font, color: rgb(0, 0, 0) });
  });

  const gradeText = `Grade ${grade}  |  Comic Reader`;
  const gw = font.widthOfTextAtSize(gradeText, 11);
  page.drawText(gradeText, { x: (width - gw) / 2, y: 60, size: 11, font, color: rgb(0.3, 0.3, 0.3) });

  // Simple burst/star accents around the title block, purely decorative
  // vector shapes (no image call needed for the cover).
  const starPositions = [[60, height - 170], [width - 90, height - 170], [60, 100], [width - 90, 100]];
  starPositions.forEach(([sx, sy]) => {
    page.drawText('*', { x: sx, y: sy, size: 22, font: boldFont, color: rgb(0, 0, 0) });
  });
}

// Draws up to 6 panels (2 cols x 3 rows) on one page: bordered panel with
// either a single full-scene AI illustration (full art mode) or 1-2
// reusable cast character cutouts laid out side by side (cast mode)
// fitted inside, an optional caption box in the top-left corner, and up
// to 2 stacked speech bubbles along the bottom -- classic comic-strip
// composition, kept simple and high-contrast so it photocopies/prints
// well.
export function drawComicPage(page: any, panels: { images: any[]; caption?: string; dialogue?: ComicDialogueLine[] }[], opts: {
  width: number; height: number; font: any; boldFont: any; issueTitle: string; pageLabel: string;
}) {
  const { width, height, font, boldFont, issueTitle, pageLabel } = opts;
  const margin = 28;
  const headerH = 26;

  page.drawText(issueTitle, { x: margin, y: height - 20, size: 11, font: boldFont, color: rgb(0, 0, 0) });
  const labelW = font.widthOfTextAtSize(pageLabel, 9);
  page.drawText(pageLabel, { x: width - margin - labelW, y: height - 20, size: 9, font, color: rgb(0.35, 0.35, 0.35) });
  page.drawLine({ start: { x: margin, y: height - headerH - 2 }, end: { x: width - margin, y: height - headerH - 2 }, thickness: 1, color: rgb(0, 0, 0) });

  const cols = 2;
  const rows = 3;
  const gap = 10;
  const gridTop = height - headerH - margin;
  const gridBottom = margin;
  const gridLeft = margin;
  const gridRight = width - margin;
  const cellW = (gridRight - gridLeft - gap * (cols - 1)) / cols;
  const cellH = (gridTop - gridBottom - gap * (rows - 1)) / rows;

  panels.slice(0, cols * rows).forEach((p, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = gridLeft + col * (cellW + gap);
    const yTop = gridTop - row * (cellH + gap);
    const yBottom = yTop - cellH;

    page.drawRectangle({ x, y: yBottom, width: cellW, height: cellH, borderColor: rgb(0, 0, 0), borderWidth: 2.5, color: rgb(1, 1, 1) });

    const inset = 5;
    const images = (p.images || []).filter(Boolean);
    if (images.length > 0) {
      try {
        // Split the panel width evenly across 1-2 character images so two
        // characters in one panel sit side by side rather than overlapping.
        const slotW = (cellW - inset * 2) / images.length;
        images.forEach((img: any, imgIdx: number) => {
          const dims = img.scale(1);
          const availW = slotW - 4;
          const availH = cellH - inset * 2;
          const scale = Math.min(availW / dims.width, availH / dims.height);
          const drawW = dims.width * scale;
          const drawH = dims.height * scale;
          const slotX = x + inset + imgIdx * slotW;
          page.drawImage(img, {
            x: slotX + (slotW - drawW) / 2,
            y: yBottom + (cellH - drawH) / 2,
            width: drawW,
            height: drawH,
          });
        });
      } catch { /* fall through to blank panel -- caption/dialogue still render */ }
    } else {
      // No image available (generation failed for this panel) -- draw a
      // light diagonal placeholder pattern rather than leaving it looking
      // broken, so the comic still reads as intentional.
      page.drawLine({ start: { x: x + inset, y: yBottom + inset }, end: { x: x + cellW - inset, y: yTop - inset }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
      page.drawLine({ start: { x: x + inset, y: yTop - inset }, end: { x: x + cellW - inset, y: yBottom + inset }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
    }

    if (p.caption && p.caption.trim()) {
      const capSize = 7;
      const capW = cellW * 0.72;
      let capLines = wrapLines(p.caption, font, capSize, capW - 10);
      capLines = truncateLines(capLines, 3);
      const capH = capLines.length * (capSize + 2) + 6;
      page.drawRectangle({ x: x + 4, y: yTop - 4 - capH, width: capW, height: capH, color: rgb(1, 1, 1), borderColor: rgb(0, 0, 0), borderWidth: 1 });
      capLines.forEach((line: string, li: number) => {
        page.drawText(line, { x: x + 9, y: yTop - 4 - capSize - 4 - li * (capSize + 2), size: capSize, font, color: rgb(0, 0, 0) });
      });
    }

    const dlg = (p.dialogue || []).filter((d) => d.line && d.line.trim()).slice(0, 2);
    let bubbleY = yBottom + inset;
    dlg.forEach((d) => {
      const text = `${d.speaker}: ${d.line}`;
      const bSize = 6.5;
      const bubbleW = cellW - inset * 2;
      let lines = wrapLines(text, font, bSize, bubbleW - 10);
      lines = truncateLines(lines, 3);
      const bubbleH = lines.length * (bSize + 2) + 6;
      page.drawRectangle({ x: x + inset, y: bubbleY, width: bubbleW, height: bubbleH, color: rgb(1, 1, 1), borderColor: rgb(0, 0, 0), borderWidth: 1 });
      // small pointer tail so it reads as a speech bubble, not a caption box
      page.drawSvgPath(`M 0 0 L 8 0 L 0 -8 Z`, {
        x: x + inset + 14, y: bubbleY, color: rgb(1, 1, 1), borderColor: rgb(0, 0, 0), borderWidth: 1,
      });
      lines.forEach((line: string, li: number) => {
        page.drawText(line, { x: x + inset + 5, y: bubbleY + bubbleH - bSize - 4 - li * (bSize + 2), size: bSize, font, color: rgb(0, 0, 0) });
      });
      bubbleY += bubbleH + 5;
    });
  });
}

export function drawLiteracyQuestionsPage(page: any, questions: string[], opts: {
  width: number; height: number; font: any; boldFont: any; title: string;
}) {
  const { width, height, font, boldFont, title } = opts;
  const margin = 54;
  page.drawText('Comic Reader Response Questions', { x: margin, y: height - 60, size: 18, font: boldFont, color: rgb(0.11, 0.21, 0.34) });
  page.drawText(title, { x: margin, y: height - 82, size: 11, font, color: rgb(0.4, 0.4, 0.4) });
  page.drawLine({ start: { x: margin, y: height - 92 }, end: { x: width - margin, y: height - 92 }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });

  let y = height - 130;
  const qList = (questions && questions.length ? questions : ['What happened in this comic?', 'Has something like this ever happened to you?', 'Why do you think the characters made that choice?', 'What do you think happens next?']);
  qList.slice(0, 6).forEach((q, i) => {
    const lines = wrapLines(`${i + 1}. ${q}`, boldFont, 12, width - margin * 2);
    lines.forEach((line: string, li: number) => {
      page.drawText(line, { x: margin, y, size: 12, font: li === 0 ? boldFont : font, color: rgb(0, 0, 0) });
      y -= 16;
    });
    // three ruled response lines per question
    for (let r = 0; r < 3; r++) {
      y -= 16;
      page.drawLine({ start: { x: margin + 14, y }, end: { x: width - margin, y }, thickness: 0.75, color: rgb(0.6, 0.6, 0.6) });
    }
    y -= 20;
  });
}
