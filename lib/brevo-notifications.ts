import { errorMessage } from './error-message';

interface BundleReadyNotification {
  teacherEmail: string;
  teacherName: string;
  bundleId: string;
  bundleName: string;
  resourceCount: number;
  bundleUrl: string;
  checklistUrl: string;
  downloadUrl: string;
}

const brevoApiKey = process.env.BREVO_API_KEY;

export async function sendBundleReadyNotification(
  notification: BundleReadyNotification
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    if (!brevoApiKey) {
      throw new Error("BREVO_API_KEY not configured");
    }

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: "Chalk & Circuit",
          email: "notifications@chalkandcircuit.com",
        },
        to: [
          {
            email: notification.teacherEmail,
            name: notification.teacherName,
          },
        ],
        subject: `Your Bundle is Ready: ${notification.bundleName}`,
        htmlContent: generateBundleReadyEmail(notification),
        textContent: generateBundleReadyEmailText(notification),
        tags: ["bundle-ready", "tpt-upload"],
        replyTo: {
          email: "support@chalkandcircuit.com",
          name: "Chalk & Circuit Support",
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Brevo API error: ${error.message}`);
    }

    const data = await response.json();
    return {
      success: true,
      messageId: data.messageId,
    };
  } catch (error) {
    const errorMessage = errorMessage(error);
    console.error("Brevo notification failed:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

function generateBundleReadyEmail(
  notification: BundleReadyNotification
): string {
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
      .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #ddd; }
      .bundle-info { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 4px; }
      .bundle-info h3 { margin-top: 0; color: #667eea; }
      .button { display: inline-block; padding: 12px 24px; margin: 10px 5px 10px 0; background: #667eea; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; }
      .secondary-button { background: #764ba2; }
      .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }
      .resource-count { font-size: 24px; font-weight: bold; color: #667eea; }
      ul { margin: 15px 0; padding-left: 20px; }
      li { margin: 8px 0; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🎉 Your Bundle is Ready!</h1>
        <p>Time to share your resources on Teachers Pay Teachers</p>
      </div>
      
      <div class="content">
        <p>Hi ${notification.teacherName},</p>
        
        <p>Great news! Your bundle has been packaged and is ready for upload to Teachers Pay Teachers.</p>
        
        <div class="bundle-info">
          <h3>${notification.bundleName}</h3>
          <p><strong>Bundle ID:</strong> ${notification.bundleId}</p>
          <p><strong>Resources Included:</strong> <span class="resource-count">${notification.resourceCount}</span></p>
        </div>
        
        <h3>Next Steps:</h3>
        <ul>
          <li>Download your complete bundle using the link below</li>
          <li>Follow the step-by-step TPT upload checklist</li>
          <li>Upload files and metadata to Teachers Pay Teachers</li>
          <li>Set your price and publish!</li>
        </ul>
        
        <div style="margin: 30px 0; text-align: center;">
          <a href="${notification.downloadUrl}" class="button">Download Bundle</a>
          <a href="${notification.checklistUrl}" class="button secondary-button">View Checklist</a>
        </div>
        
        <h3>Pre-formatted Metadata Included</h3>
        <p>Your checklist includes pre-formatted product metadata you can copy directly into TPT. This saves time and ensures consistency across your bundle listing.</p>
        
        <h3>Need Help?</h3>
        <p>The TPT upload checklist walks you through each step of the process. If you have questions about TPT's requirements or need support, reach out to our team.</p>
        
        <p style="margin-top: 30px;">Happy uploading!<br><strong>The Chalk & Circuit Team</strong></p>
        
        <div class="footer">
          <p>This is an automated notification from Chalk & Circuit. Please don't reply to this email.</p>
          <p>Need support? Contact: support@chalkandcircuit.com</p>
        </div>
      </div>
    </div>
  </body>
</html>
  `.trim();
}

function generateBundleReadyEmailText(
  notification: BundleReadyNotification
): string {
  return `
YOUR BUNDLE IS READY!

Hi ${notification.teacherName},

Your bundle has been packaged and is ready for upload to Teachers Pay Teachers.

Bundle: ${notification.bundleName}
Bundle ID: ${notification.bundleId}
Resources Included: ${notification.resourceCount}

NEXT STEPS:
1. Download your complete bundle
2. Follow the step-by-step TPT upload checklist
3. Upload files and metadata to Teachers Pay Teachers
4. Set your price and publish!

Download Bundle: ${notification.downloadUrl}
View Checklist: ${notification.checklistUrl}

Pre-formatted Metadata Included
Your checklist includes pre-formatted product metadata you can copy directly into TPT.

Need Help?
The TPT upload checklist walks you through each step. If you have questions, contact our team.

Happy uploading!
The Chalk & Circuit Team

---
This is an automated notification from Chalk & Circuit.
Contact: support@chalkandcircuit.com
  `.trim();
}

export async function sendBundleErrorNotification(
  teacherEmail: string,
  teacherName: string,
  bundleName: string,
  errorMessage: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    if (!brevoApiKey) {
      throw new Error("BREVO_API_KEY not configured");
    }

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: "Chalk & Circuit",
          email: "notifications@chalkandcircuit.com",
        },
        to: [
          {
            email: teacherEmail,
            name: teacherName,
          },
        ],
        subject: `Bundle Processing Issue: ${bundleName}`,
        htmlContent: generateErrorEmail(
          teacherName,
          bundleName,
          errorMessage
        ),
        textContent: generateErrorEmailText(
          teacherName,
          bundleName,
          errorMessage
        ),
        tags: ["bundle-error", "tpt-upload"],
        replyTo: {
          email: "support@chalkandcircuit.com",
          name: "Chalk & Circuit Support",
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Brevo API error: ${error.message}`);
    }

    const data = await response.json();
    return {
      success: true,
      messageId: data.messageId,
    };
  } catch (error) {
    const errorMessage = errorMessage(error);
    console.error("Brevo error notification failed:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

function generateErrorEmail(
  teacherName: string,
  bundleName: string,
  errorMessage: string
): string {
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: #f44336; color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
      .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #ddd; }
      .error-box { background: #ffebee; border-left: 4px solid #f44336; padding: 15px; border-radius: 4px; margin: 20px 0; }
      .button { display: inline-block; padding: 12px 24px; background: #2196F3; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; }
      .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>⚠️ Bundle Processing Issue</h1>
      </div>
      
      <div class="content">
        <p>Hi ${teacherName},</p>
        
        <p>We encountered an issue while processing your bundle: <strong>${bundleName}</strong></p>
        
        <div class="error-box">
          <p><strong>Error Details:</strong></p>
          <p>${errorMessage}</p>
        </div>
        
        <p>Our team has been notified and is working on a resolution. In the meantime:</p>
        <ul>
          <li>Review the error details above</li>
          <li>Check that all your resources are properly formatted</li>
          <li>Contact our support team for immediate assistance</li>
        </ul>
        
        <div style="margin: 30px 0; text-align: center;">
          <a href="mailto:support@chalkandcircuit.com?subject=Bundle%20Error%20-%20${encodeURIComponent(bundleName)}" class="button">Contact Support</a>
        </div>
        
        <p>We apologize for any inconvenience and appreciate your patience.</p>
        
        <div class="footer">
          <p>The Chalk & Circuit Team</p>
          <p>Contact: support@chalkandcircuit.com</p>
        </div>
      </div>
    </div>
  </body>
</html>
  `.trim();
}

function generateErrorEmailText(
  teacherName: string,
  bundleName: string,
  errorMessage: string
): string {
  return `
BUNDLE PROCESSING ISSUE

Hi ${teacherName},

We encountered an issue while processing your bundle: ${bundleName}

ERROR DETAILS:
${errorMessage}

Our team has been notified and is working on a resolution.

NEXT STEPS:
1. Review the error details above
2. Check that all your resources are properly formatted
3. Contact our support team for immediate assistance

Contact Support: support@chalkandcircuit.com

We apologize for any inconvenience and appreciate your patience.

The Chalk & Circuit Team
  `.trim();
}
