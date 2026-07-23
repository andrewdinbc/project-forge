import { NextRequest, NextResponse } from "next/server";
import { createTPTChecklist, formatChecklistForEmail } from "@/lib/tpt-checklist";
import { errorMessage } from '@/lib/error-message';

export async function GET(
  request: NextRequest,
  { params }: { params: { bundleId: string } }
) {
  try {
    const bundleId = params.bundleId;

    // Get bundle data from database
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Database configuration missing" },
        { status: 500 }
      );
    }

    const bundleResponse = await fetch(
      `${supabaseUrl}/rest/v1/bundles?id=eq.${bundleId}`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Accept: "application/json",
        },
      }
    );

    if (!bundleResponse.ok) {
      return NextResponse.json(
        { error: "Bundle not found" },
        { status: 404 }
      );
    }

    const bundles = await bundleResponse.json();
    if (!bundles || bundles.length === 0) {
      return NextResponse.json(
        { error: "Bundle not found" },
        { status: 404 }
      );
    }

    const bundle = bundles[0];

    // Generate checklist
    const checklist = createTPTChecklist(
      bundle.id,
      bundle.name,
      bundle.resource_count || 0,
      `${process.env.NEXT_PUBLIC_APP_URL}/bundles/${bundle.id}`
    );

    // Respond with checklist or formatted text based on query
    const format = request.nextUrl.searchParams.get("format");

    if (format === "text") {
      return new NextResponse(formatChecklistForEmail(checklist), {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="tpt-checklist-${bundleId}.txt"`,
        },
      });
    }

    return NextResponse.json(checklist);
  } catch (error) {
    console.error("Checklist generation error:", error);
    return NextResponse.json(
      {
        error: errorMessage(error),
      },
      { status: 500 }
    );
  }
}
