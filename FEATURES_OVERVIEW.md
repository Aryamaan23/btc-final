# Beyond the Classroom - Feature Documentation

Last updated: April 2026

## 1. Product Overview

Beyond the Classroom is a responsive React + Vite website for showcasing organizational impact, programs, media, and student publications. It includes a public-facing experience and an editor-only workspace for managing case-study content.

Primary goals:
- Present organizational mission and trust signals clearly.
- Publish and maintain student case studies as structured, readable articles.
- Support direct engagement through contact and partner pathways.
- Keep deployment production-safe for SPA routing on Vercel.

## 2. User Roles

- **Public visitor**
  - Browses pages, reads case studies, downloads attached documents, and submits contact/newsletter forms.
- **Editor (authorized)**
  - Logs in to the editor workspace, uploads case studies with files, and deletes published entries.

## 3. Public Website Features

### 3.1 Global Navigation and Layout
- Responsive top navigation with desktop and mobile behavior.
- Route-based page rendering with smooth transitions and lazy loading.
- Shared footer with social and contact pathways.
- Accessibility support such as skip-to-content behavior.

### 3.2 Home Experience
- Hero and narrative-led sections for mission storytelling.
- Program and impact highlights (snapshots, collaborations, action hub).
- Visual-first content blocks for credibility and engagement.

### 3.3 About Experience
- Mission, vision, and organizational context.
- Team and mentor-focused sections.
- Timeline and leadership/message-focused content flows.

### 3.4 Programs Experience
- Program overview plus dedicated detail pages for key initiatives.
- Program-specific storytelling blocks and visual assets.

### 3.5 Media Experience
- Embedded/social-rich media presentation.
- Structured content grouping for easier browsing.

### 3.6 Publications Experience
- Publications hub with featured case-study cards.
- Individual article pages at `/publications/:id`.
- Reader actions:
  - Read article on-page.
  - Download original uploaded file.
  - Download optional attachments.

## 4. Editor Workspace Features

Editor route: `/publications/editor`

### 4.1 Authentication
- Editor login form (username/password).
- Server-side credential verification through API.
- Frontend auth state stored for UI behavior continuity.

### 4.2 Upload Flow
- Required metadata:
  - Title
  - Student name
  - Program name
  - Summary
  - Main document
- Optional multiple attachments.
- File(s) are encoded client-side and uploaded through the case-study API.
- On success:
  - Form resets
  - Success feedback is shown
  - Published list refreshes

### 4.3 Content Management
- Published case studies are visible in the same workspace.
- Editors can delete a publication with confirmation.
- Delete action updates published lists after completion.

## 5. Publication Deletion and Not-Found Handling

This project now includes graceful handling for deleted publication URLs.

- If an article ID is missing (for example, after editor deletion), the app redirects user flow to:
  - `/publications?publicationDeleted=1`
- The Publications page displays a red alert card indicating the publication was deleted.
- Users remain in-app instead of hitting an unbranded dead end.

Why this matters:
- Improves user trust and continuity.
- Provides explicit context instead of generic "not found" behavior.

## 6. API and Data Capabilities

### 6.1 API Surface
- `/api/contact`
  - Handles contact/newsletter submissions.
  - Validates payload and returns structured success/error responses.
- `/api/case-studies`
  - Supports list, upload, auth, delete, and download behavior.

### 6.2 Data and File Handling
- Case-study metadata and files are persisted via backend integration.
- Download links are generated for original files and attachments.
- Local development includes mock API behavior for faster testing.

## 7. Deployment and Routing (Vercel)

### 7.1 Build and Output
- Build command: `npm run build:skip-check`
- Output directory: `dist`

### 7.2 SPA Rewrite Requirement
- Client routes (for example `/publications/:id`) require SPA fallback rewriting to `index.html`.
- `vercel.json` includes rewrite logic so direct deep-link requests are resolved by React Router rather than Vercel platform 404.
- Rewrite is scoped to avoid interfering with API paths and static assets.

### 7.3 Caching Headers
- Static assets and images are configured with cache headers for performance.
- HTML remains revalidatable for fresh deploy behavior.

## 8. Security and Access Controls (Current State)

- Server-side checks gate editor-only operations (upload/delete/auth).
- Frontend auth state is a UX aid, not a security boundary.
- Operational security still depends on backend credential validation and safe secret handling.

## 9. Quality and Engineering Practices

- TypeScript-based type safety across app/services.
- Componentized architecture with reusable common UI layer.
- Lazy loading and route-level splitting for performance.
- Basic test coverage exists in services/components areas.

## 10. Known Constraints

- Editor login currently behaves as a simple credential-gated flow rather than tokenized sessions with expiry.
- Full anti-abuse controls (rate limiting/captcha/lockout) should be strengthened in production.
- Build verification requires local TypeScript dependency availability (`tsc`).

## 11. Recommended Refinements (Next Phase)

Priority recommendations:
- Introduce token-based editor sessions (short-lived access + refresh strategy).
- Add brute-force protections and request rate limiting for auth and write endpoints.
- Add structured audit logging for upload/delete operations.
- Add analytics instrumentation for publication reads/downloads and conversion CTAs.
- Add content governance docs for editor operations (naming, file standards, publishing checklist).

## 12. Quick Feature Checklist

- [x] Responsive multi-page public website
- [x] Publications hub and dynamic article pages
- [x] Editor login, upload, list, and delete workflow
- [x] Case-study file and attachment downloads
- [x] Contact/newsletter API flow
- [x] Vercel SPA rewrite support for deep routes
- [x] Deleted-publication redirect + red in-app alert handling

