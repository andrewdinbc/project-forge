import { NextRequest, NextResponse } from "next/server";
import { sendBundleErrorNotification } from "@/lib/brevo-notifications";

export async function POST(
  request: NextRequest,
  { params }: { params: { bundleId: string } }
) {
  try {
    const bundleId = params.bundleId;
    const { error: errorMessage } = await request.json();

    if (!errorMessage) {
      return NextResponse.json(
        { error: "Error message required" },
        { status: 400 }
      );
    }

    // Get bundle and teacher data from database
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Database configuration missing" },
        { status: 500 }
      );
    }

    // Fetch bundle with teacher info
    const bundleResponse = await fetch(
      `${supabaseUrl}/rest/v1/bundles?id=eq.${bundleId}&select=*,user:user_id(email,first_name,last_name)`,
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
    const teacher = bundle.user;

    if (!teacher || !teacher.email) {
      return NextResponse.json(
        { error: "Teacher email not found" },
        { status: 400 }
      );
    }

    // Send error notification
    const result = await sendBundleErrorNotification(
      teacher.email,
      `${teacher.first_name || ""} ${teacher.last_name || ""}`.trim() || "Teacher",
      bundle.name,
      errorMessage
    );

    if (!result.success) {
      console.error("Error notification send failed:", result.error);
      return NextResponse.json(
        { error: "Failed to send error notification", details: result.error },
        { status: 500 }
      );
    }

    // Update bundle status in database
    await fetch(`${supabaseUrl}/rest/v1/bundles?id=eq.${bundleId}`, {
      method: "PATCH",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "error",
        error_message: errorMessage,
        error_at: new Date().toISOString(),
      }),
    });

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      message: "Error notification sent",
    });
  } catch (error) {
    console.error("Error notification error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      {
        error: "Failed to send error notification",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
