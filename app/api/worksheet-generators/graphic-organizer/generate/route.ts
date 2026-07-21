import { NextRequest, NextResponse } from 'next/server';
import { newWorksheetDoc, loadBundleTheme, uploadWorksheetPdf, asciiSafeFilename} from '@/lib/worksheet-pdf';
import { drawBoxesLayout, drawColumnsLayout, drawRadialLayout, drawVennLayout, drawChainLayout, drawQuadrantLayout, drawTreeLayout } from '@/lib/graphic-organizer-pdf';
import { findOrganizer } from '@/lib/graphic-organizer-catalog';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

const admin: any = supabaseAdmin;

export async function POST(request: NextRequest) {
  try {
    const { userId, organizerKey, content, task, title, bundleId } = (await request.json()) || {};
    if (!userId || !organizerKey) return NextResponse.json({ error: 'userId and organizerKey are required' }, { status: 400 });
    const tool = findOrganizer(organizerKey);
    if (!tool) return NextResponse.json({ error: 'Unknown organizer type' }, { status: 400 });

    const { doc, helv, helvBold } = await newWorksheetDoc();
    const theme = await loadBundleTheme(admin, userId, bundleId);
    const docTitle = title?.trim() || tool.label;
    const subtitle = task?.trim() ? `Topic: ${task.trim()}` : undefined;
    const ctx = { doc, helv, helvBold, title: docTitle, subtitle, theme };

    if (tool.layout === 'boxes') await drawBoxesLayout(ctx, tool.slots, content);
    else if (tool.layout === 'columns') await drawColumnsLayout(ctx, tool.columns, content);
    else if (tool.layout === 'radial') await drawRadialLayout(ctx, tool.center, tool.slots, content);
    else if (tool.layout === 'venn') await drawVennLayout(ctx, tool.a, tool.b, tool.both, content);
    else if (tool.layout === 'chain') await drawChainLayout(ctx, tool.count, content);
    else if (tool.layout === 'quadrant') await drawQuadrantLayout(ctx, tool.center, tool.slots, content);
    else if (tool.layout === 'tree') await drawTreeLayout(ctx, tool.label.replace(/ \(.*\)/, ''), tool.levels, content);
    else return NextResponse.json({ error: `Unknown layout: ${tool.layout}` }, { status: 400 });

    const bytes = await doc.save();
    const fileUrl = await uploadWorksheetPdf(admin, userId, bytes, 'graphic-organizer', `${docTitle}.pdf`);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${asciiSafeFilename(docTitle)}.pdf"`, 'X-File-Url': encodeURIComponent(fileUrl) },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
