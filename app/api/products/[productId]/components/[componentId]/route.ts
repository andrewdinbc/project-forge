import { NextRequest, NextResponse } from 'next/server';
import { updateComponent, deleteComponent } from '@/lib/product-components';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { productId: string; componentId: string } }
) {
  try {
    const body = await request.json();
    const component = await updateComponent(params.componentId, body);
    return NextResponse.json({ success: true, component });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { productId: string; componentId: string } }
) {
  try {
    await deleteComponent(params.componentId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
