import { NextRequest, NextResponse } from 'next/server';
import { addComponent, getProductComponents } from '@/lib/product-components';

export async function GET(
  _request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const components = await getProductComponents(params.productId);
    return NextResponse.json({ success: true, components });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const body = await request.json();
    const { category, label, page_start, page_end, notes, sort_order } = body;

    if (!category || !label || page_start == null || page_end == null) {
      return NextResponse.json(
        { error: 'category, label, page_start, and page_end are required' },
        { status: 400 }
      );
    }
    if (page_end < page_start) {
      return NextResponse.json({ error: 'page_end must be >= page_start' }, { status: 400 });
    }

    const component = await addComponent(params.productId, {
      category,
      label,
      page_start,
      page_end,
      notes,
      sort_order,
    });

    return NextResponse.json({ success: true, component }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
