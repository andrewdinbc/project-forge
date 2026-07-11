import { NextRequest, NextResponse } from 'next/server';

// Mock data - replace with actual database query
const MOCK_PRODUCTS = [
  {
    id: '1',
    title: 'JavaScript Fundamentals Course',
    description: 'Learn the basics of JavaScript programming',
    price: 49.99,
    imageUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=200&h=200&fit=crop',
    category: 'courses',
  },
  {
    id: '2',
    title: 'React Advanced Patterns',
    description: 'Master advanced React patterns and hooks',
    price: 79.99,
    imageUrl: 'https://images.unsplash.com/photo-1633356122544-f134324ef6db?w=200&h=200&fit=crop',
    category: 'courses',
  },
  {
    id: '3',
    title: 'Next.js Full Stack Masterclass',
    description: 'Build full-stack applications with Next.js',
    price: 99.99,
    imageUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=200&h=200&fit=crop',
    category: 'courses',
  },
  {
    id: '4',
    title: 'TypeScript Pro Guide',
    description: 'Advanced TypeScript for production applications',
    price: 59.99,
    imageUrl: 'https://images.unsplash.com/photo-1633356122544-f134324ef6db?w=200&h=200&fit=crop',
    category: 'courses',
  },
  {
    id: '5',
    title: 'Web Design Fundamentals',
    description: 'Create beautiful, responsive websites',
    price: 44.99,
    imageUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=200&h=200&fit=crop',
    category: 'courses',
  },
  {
    id: '6',
    title: 'Database Design & SQL',
    description: 'Master database design and SQL queries',
    price: 69.99,
    imageUrl: 'https://images.unsplash.com/photo-1633356122544-f134324ef6db?w=200&h=200&fit=crop',
    category: 'courses',
  },
];

export async function GET(request: NextRequest) {
  try {
    // TODO: Replace with actual database query
    // const products = await db.products.findMany();
    
    return NextResponse.json(MOCK_PRODUCTS);
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
