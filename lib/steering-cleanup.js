import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Strips non-instructional boilerplate before content is pushed into AI
// Steering (Aj, 2026-07-19): cover pages, tables of contents, teacher
// information/instruction pages, terms of use, credits, and branding/
// copyright pages are noise as generation context and can actively pollute
// it. Keeps everything else verbatim -- this is a removal pass, not a
// rewrite, so real instructional content, activities, and text are
// preserved exactly as extracted.
//
// Extracted out of app/api/style-lab/resources/route.js so the new
// product-level steering push (app/api/products/[productId]/push-to-
// steering) shares this exact implementation instead of a second copy.
export async function cleanForSteering(text, title) {
  if (!text || text.length < 200) return text; // too short to bother -- avoid AI mangling short/edge-case content

  const prompt = `You are cleaning extracted PDF/web text before it is used as background context for AI content generation. Remove ONLY the following, if present, and nothing else:
- Cover page text (title-page-only content like a big title, subtitle, byline, or decorative cover text with no instructional value)
- Table of contents listings
- Teacher information / "how to use this resource" instruction pages
- Terms of use / copyright license / usage rights text
- Credits pages (font credits, clipart credits, "made by" attributions)
- Branding or copyright pages (seller logo/brand pages, "© [name/store]" copyright notices, watermark-style copyright text, TPT store branding)

Keep EVERYTHING else exactly as written, including all actual instructional content, activities, passages, questions, answer keys, and any other real educational material. Do not summarize, rewrite, or paraphrase anything you keep -- only remove the categories listed above. If none of those categories are present, return the text completely unchanged.

Document title: "${title || 'Untitled'}"

TEXT:
${text.slice(0, 18000)}

Respond with ONLY the cleaned text, no commentary, no markdown fences, no explanation of what you removed.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });
  const cleaned = response.content.find((b) => b.type === 'text')?.text || text;
  return cleaned.trim() || text;
}
