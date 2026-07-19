import { NextRequest, NextResponse } from 'next/server';
import { analyzeResourcePage } from '@/lib/style-lab-vision';

export const maxDuration = 120;

// Pixlr-style visual analysis of a Style Lab resource page. See
// lib/style-lab-vision.ts for the actual logic, shared with bulk-analyze.
// POST { userId, resourceId, page?, refresh? }
export async function POST(request: NextRequest) {
  try {
    const { userId, resourceId, page = 1, refresh = false } = (await request.json()) || {};
    if (!userId || !resourceId) {
      return NextResponse.json({ error: 'userId and resourceId are required' }, { status: 400 });
    }
    const { cached, analysis } = await analyzeResourcePage(userId, resourceId, page, refresh);
    return NextResponse.json({ ok: true, cached, analysis });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message === 'Resource not found' ? 404 : message.includes('no PDF file') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
