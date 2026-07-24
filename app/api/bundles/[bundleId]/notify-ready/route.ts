import { NextRequest, NextResponse } from "next/server";
import { sendBundleReadyNotification, sendBundleErrorNotification } from "@/lib/brevo-notifications";
import { errorMessageOr } from '@/lib/error-message';

export async function POST(
  request: NextRequest,
  { params }: { params: { bundleId: string } }
) {
  try {
    const bundleId = params.bundleId;

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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      return NextResponse.json(
        { error: "App URL not configured" },
        { status: 500 }
      );
    }

    // Send notification
    const result = await sendBundleReadyNotification({
      teacherEmail: teacher.email,
      teacherName: `${teacher.first_name || ""} ${teacher.last_name || ""}`.trim() || "Teacher",
      bundleId: bundle.id,
      bundleName: bundle.name,
      resourceCount: bundle.resource_count || 0,
      bundleUrl: `${appUrl}/bundles/${bundle.id}`,
      checklistUrl: `${appUrl}/api/bundles/${bundle.id}/checklist?format=text`,
      downloadUrl: `${appUrl}/api/bundles/${bundle.id}/download`,
    });

    if (!result.success) {
      console.error("Notification send failed:", result.error);
      return NextResponse.json(
        { error: "Failed to send notification", details: result.error },
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
        status: "ready",
        notified_at: new Date().toISOString(),
      }),
    });

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      message: "Bundle ready notification sent",
    });
  } catch (error) {
    console.error("Notification error:", error);
    const errorMessage =
      errorMessageOr(error, "Unknown error occurred");

    return NextResponse.json(
      {
        error: "Failed to send notification",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
