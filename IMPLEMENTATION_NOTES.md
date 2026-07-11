# TPT Upload Workflow + Brevo Notification Implementation

## Overview
This implementation provides a guided TPT upload checklist and Brevo email notifications when bundles are ready for upload to Teachers Pay Teachers.

## Components

### 1. TPT Checklist (`lib/tpt-checklist.ts`)
- **createTPTChecklist()** - Generates an 8-step checklist for TPT manual upload
- **formatChecklistForEmail()** - Formats checklist as downloadable text
- **generateMetadata()** - Creates pre-formatted product metadata teachers can copy-paste
- **sanitizeFileName()** - Ensures safe file naming

Steps covered:
1. Prepare files locally
2. Log into TPT account
3. Fill product details
4. Set pricing & rights
5. Add pre-formatted metadata
6. Upload files
7. Preview product
8. Publish to store

### 2. Brevo Notifications (`lib/brevo-notifications.ts`)

#### sendBundleReadyNotification()
- Sends professional HTML email when bundle is ready
- Includes download and checklist links
- Formatted metadata preview
- Call to action buttons

#### sendBundleErrorNotification()
- Sends error notification to teacher
- Includes error details and support contact

Features:
- HTML and plain text versions
- Custom Brevo tags for email filtering
- Reply-to support email address

### 3. API Endpoints

#### GET `/api/bundles/[bundleId]/checklist`
- Retrieves TPT checklist for a bundle
- Query params:
  - `format=text` - Returns downloadable text file
  - (no format) - Returns JSON checklist object

#### POST `/api/bundles/[bundleId]/notify-ready`
- Triggers "bundle ready" email notification
- Updates bundle status in database to "ready"
- Logs notification send time

#### POST `/api/bundles/[bundleId]/notify-error`
- Triggers error notification email
- Request body: `{ "error": "Error message" }`
- Updates bundle status to "error" with error details

### 4. React Component (`components/tpt-upload-checklist.tsx`)

Features:
- Interactive step tracking
- Progress bar
- Copy-to-clipboard metadata
- Collapsible/expandable steps
- Bundle info summary
- Download checklist button
- Pro tips section

## Setup

### Environment Variables
