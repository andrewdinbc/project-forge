import { NextRequest, NextResponse } from 'next/server';
import { getComponentsForProducts } from '@/lib/product-components';
import { errorMessage } from '@/lib/error-message';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('productIds');
    if (!idsParam) {
      return NextResponse.json({ error: 'productIds query param is required (comma-separated)' }, { status: 400 });
    }
    const productIds = idsParam.split(',').filter(Boolean);
    const components = await getComponentsForProducts(productIds);
    return NextResponse.json({ success: true, components });
  } catch (error) {
    const message = errorMessage(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
