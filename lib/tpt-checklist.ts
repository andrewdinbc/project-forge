export interface TPTUploadStep {
  id: string;
  title: string;
  description: string;
  instructions: string[];
  completed: boolean;
  metadata?: Record<string, string>;
}

export interface TPTChecklist {
  bundleId: string;
  bundleName: string;
  steps: TPTUploadStep[];
  generatedAt: string;
  preformattedMetadata: string;
}

export function createTPTChecklist(
  bundleId: string,
  bundleName: string,
  resourceCount: number,
  bundleUrl: string
): TPTChecklist {
  const generatedAt = new Date().toISOString();
  
  const preformattedMetadata = generateMetadata(
    bundleName,
    resourceCount,
    bundleUrl,
    generatedAt
  );

  const steps: TPTUploadStep[] = [
    {
      id: "1-prepare",
      title: "1. Prepare Your Files",
      description: "Organize and verify all bundle files are ready",
      instructions: [
        "Download your complete bundle from the link provided",
        "Extract all files to a single folder",
        "Verify file count matches: " + resourceCount + " resources",
        "Check for any corrupted or missing files",
        "Rename folder to: " + sanitizeFileName(bundleName),
      ],
      completed: false,
    },
    {
      id: "2-tpt-account",
      title: "2. Log Into Teachers Pay Teachers",
      description: "Access your TPT seller account",
      instructions: [
        "Go to www.teacherspayteachers.com",
        "Click 'Sell' in the top menu",
        "Log in with your seller account credentials",
        "Navigate to 'My Products' → 'Create New Product'",
      ],
      completed: false,
    },
    {
      id: "3-product-details",
      title: "3. Fill in Product Details",
      description: "Enter basic product information",
      instructions: [
        "Product Type: Select 'Bundle'",
        "Title: Copy from metadata below",
        "Description: Use the pre-formatted description from metadata",
        "Grade Level: Select appropriate grades",
        "Subject: Select relevant subjects",
      ],
      completed: false,
      metadata: {
        title: bundleName,
      },
    },
    {
      id: "4-pricing",
      title: "4. Set Pricing & Rights",
      description: "Configure price and licensing options",
      instructions: [
        "Price: Set your desired price point",
        "License Type: Select 'Single Classroom Use' (or Multi-Classroom as needed)",
        "Ensure checkbox: 'I own the copyright to this product'",
      ],
      completed: false,
    },
    {
      id: "5-metadata",
      title: "5. Add Pre-formatted Metadata",
      description: "Copy the metadata below into TPT's fields",
      instructions: [
        "Scroll to 'Additional Information' section",
        "Copy the entire metadata block below",
        "Paste into appropriate TPT fields",
        "Verify formatting is preserved",
      ],
      completed: false,
      metadata: {
        preformatted: preformattedMetadata,
      },
    },
    {
      id: "6-upload-files",
      title: "6. Upload Your Files",
      description: "Upload the bundle folder to TPT",
      instructions: [
        "Click 'Upload Files' button",
        "Select your prepared folder",
        "Wait for all files to finish uploading",
        "Verify file count in preview matches: " + resourceCount,
        "Check for any upload errors or warnings",
      ],
      completed: false,
    },
    {
      id: "7-preview",
      title: "7. Preview & Review",
      description: "Review how your bundle will appear to buyers",
      instructions: [
        "Click 'Preview' to see the product page",
        "Check title, description, and images display correctly",
        "Verify all files are listed in the preview",
        "Return to edit if any corrections are needed",
      ],
      completed: false,
    },
    {
      id: "8-publish",
      title: "8. Publish to Store",
      description: "Make your bundle live on TPT",
      instructions: [
        "Review the Publishing Checklist TPT provides",
        "Ensure all required fields are completed",
        "Click 'Publish to Store'",
        "Your bundle will go live within a few moments",
        "Keep the bundle URL for your records",
      ],
      completed: false,
      metadata: {
        bundleUrl: bundleUrl,
      },
    },
  ];

  return {
    bundleId,
    bundleName,
    steps,
    generatedAt,
    preformattedMetadata,
  };
}

function generateMetadata(
  bundleName: string,
  resourceCount: number,
  bundleUrl: string,
  generatedAt: string
): string {
  return `
BUNDLE METADATA (Copy & Paste into TPT)
Generated: ${generatedAt}
Bundle ID: ${bundleUrl}

TITLE:
${bundleName}

DESCRIPTION:
This comprehensive bundle contains ${resourceCount} carefully curated teaching resources designed to enhance classroom instruction and student engagement. All resources are ready-to-use and aligned with educational standards.

Key Features:
• ${resourceCount} complete resources included
• Ready-to-use lesson materials
• Editable formats available
• Aligned with educational standards
• Suitable for differentiated instruction

RESOURCE COUNT: ${resourceCount}

GRADE LEVELS: [Select appropriate]
SUBJECTS: [Select appropriate]
RESOURCE TYPES: [Select from: Lesson Plans, Worksheets, Activities, Assessments, etc.]

LICENSE:
Single Classroom Use (Standard)
All rights reserved. Purchaser may use for single classroom only.

---
End of Metadata
  `.trim();
}

function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 100);
}

export function formatChecklistForEmail(checklist: TPTChecklist): string {
  let content = `
TPT UPLOAD CHECKLIST
Bundle: ${checklist.bundleName}
Generated: ${new Date(checklist.generatedAt).toLocaleDateString()}

Your bundle is ready to upload to Teachers Pay Teachers. Follow these steps:

`;

  checklist.steps.forEach((step) => {
    content += `\n${step.title}\n${step.description}\n`;
    step.instructions.forEach((instruction) => {
      content += `  • ${instruction}\n`;
    });
  });

  content += `\n\nPRE-FORMATTED METADATA:\n${checklist.preformattedMetadata}\n`;

  return content;
}
