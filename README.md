# KSS WhatsApp Notifications

A full-stack WhatsApp Business notification platform built for **KSS Interiors**. It lets the KSS team manage WhatsApp templates, contacts, bulk campaigns, and single notifications, and exposes a documented public API so the KSS CRM can trigger WhatsApp messages programmatically.

The app ships with a safe **Mock / Demo mode** that simulates the entire Meta WhatsApp Business Cloud API — account connection, template approval, message sending, and delivery status progression (sent → delivered → read) — so it is fully usable and demonstrable without real Meta credentials. A **Live mode** implementation is also included for production use once real credentials are supplied.

## Features

- **Authentication** — JWT-based sessions, bcrypt password hashing, protected routes.
- **Dashboard** — account status, template/message/campaign summary cards, a 14-day delivery chart, recent campaigns and notifications.
- **WhatsApp Account** — connect/reconnect, test connection, view WABA ID, phone number ID, quality rating.
- **Settings → WhatsApp Config** — store Meta App ID/Secret, WABA ID, Phone Number ID, Access Token, and Webhook Verify Token server-side only; secrets are masked after saving and never returned in plain text.
- **Templates** — full builder (header/body/footer/buttons, variable syntax `{{1}}`), live WhatsApp-style preview, submit for approval, mock Meta sync with realistic approve/reject/pending outcomes, duplicate/edit/delete.
- **Contacts** — CRUD, tags, source tracking, and a CSV import wizard (upload → map columns → preview → validate → import → summary with a downloadable invalid-records report).
- **Send Notification** — single message send using an approved template with live preview.
- **Campaigns** — a 5-step wizard (details → audience → template → variable mapping → review), executed by an in-process async batch queue that updates campaign/recipient/notification records as it runs, with a live-updating detail page (stats, delivery chart, recipient table).
- **Notifications / Logs** — searchable, filterable delivery log for every message sent (single, campaign, or API).
- **Public API (`/api/v1/*`)** — API-key authenticated (never JWT), rate-limited per key, zod-validated, used by the CRM to send messages and manage contacts/campaigns without ever seeing Meta credentials.
- **API Key Management** — generate (shown once), regenerate, enable/disable, revoke; only a hash is stored server-side.
- **In-app API Documentation** — endpoint reference with cURL, JavaScript, and PHP examples.
- **Webhooks** — Meta-compatible `GET/POST /api/webhooks/whatsapp`, idempotent status processing (dedupe via a `WebhookEvent` table so replayed events never double-apply).
- **Audit Log** — every key action (login, template lifecycle, campaign lifecycle, API key lifecycle, account connect) is recorded with user, action, description, and timestamp.
- **PWA** — installable, offline app-shell, manifest + service worker via `vite-plugin-pwa`.

## Architecture

```
┌─────────────────────┐        HTTPS/JSON        ┌──────────────────────────┐
│   React + Vite PWA   │  ───────────────────────▶ │   Express + TypeScript   │
│  (apps/frontend)     │ ◀───────────────────────  │   API (apps/backend)     │
└─────────────────────┘                            └──────────────┬───────────┘
                                                                    │ Prisma ORM
                                                                    ▼
                                                          ┌───────────────────┐
                                                          │   PostgreSQL 16    │
                                                          │ (docker-compose)   │
                                                          └───────────────────┘

Backend internals:
  routes/*            → Express routers (JWT-protected app API + API-key-protected /api/v1/*)
  middleware/          → requireAuth (JWT), requireApiKey, error handler
  services/whatsapp/   → WhatsAppService interface, MockWhatsAppService, MetaWhatsAppService
                          (selected at runtime by META_MODE)
  services/campaignQueue → in-process async batch queue for campaign sends
  services/notificationEvents → idempotent delivery-status event application
                          (shared by both the webhook route and the mock simulator)
```

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, a small shadcn/ui-style component library (Radix UI primitives + class-variance-authority), React Router, TanStack Query, lucide-react, Recharts, vite-plugin-pwa.
- **Backend**: Node.js, Express, TypeScript, Zod validation, express-rate-limit, bcryptjs, jsonwebtoken.
- **Database**: PostgreSQL + Prisma ORM.
- **Testing**: Vitest (+ supertest for route-level tests).

## Folder Structure

```
KSS Whatsapp Integration/
├── apps/
│   ├── backend/
│   │   ├── prisma/
│   │   │   ├── schema.prisma        # Data model
│   │   │   └── seed.ts              # Demo data seed script
│   │   ├── src/
│   │   │   ├── config/env.ts
│   │   │   ├── lib/                 # prisma client, jwt, audit helper
│   │   │   ├── middleware/          # auth, apiKey, errorHandler
│   │   │   ├── routes/              # app routes + routes/v1 (public API)
│   │   │   ├── services/            # WhatsApp service layer, campaign queue, webhooks
│   │   │   ├── utils/               # phone, template, apiKey, mask helpers
│   │   │   └── __tests__/           # Vitest test suite
│   │   └── package.json
│   └── frontend/
│       ├── src/
│       │   ├── components/ui/       # Button, Card, Dialog, Table, Select, Tabs, etc.
│       │   ├── components/shared/   # StatusBadge, Pagination, ConfirmDialog, ...
│       │   ├── components/layout/   # Sidebar, Topbar, BottomNav, AppLayout
│       │   ├── pages/               # one folder per feature area
│       │   └── lib/                 # api client, types, auth context, utils
│       └── package.json
├── docker-compose.yml                # Postgres for local dev
└── package.json                      # npm workspaces root
```

## Getting Started

### Prerequisites

- Node.js 18+
- Docker Desktop (recommended) **or** a local PostgreSQL 16 instance

### 1. Install dependencies

```bash
npm install
```

This installs dependencies for the root workspace plus both `apps/backend` and `apps/frontend`.

### 2. Configure environment variables

```bash
cp apps/backend/.env.example apps/backend/.env
```

The defaults work out of the box with the bundled `docker-compose.yml` and mock WhatsApp mode. See [Environment Variables](#environment-variables) below for details.

### 3. Start PostgreSQL

```bash
docker compose up -d
```

This starts a Postgres 16 container on `localhost:5432` with database `kss_whatsapp`, user `kss`, password `kss_password` (matches the default `DATABASE_URL` in `.env.example`).

If you'd rather use a local PostgreSQL install, just point `DATABASE_URL` at it instead.

### 4. Run migrations and seed the database

```bash
npm run prisma:migrate -w apps/backend -- --name init
npm run seed -w apps/backend
```

The seed script creates:
- 1 admin user (`admin@kssinteriors.com` / `Admin@123`)
- 1 connected demo WhatsApp account
- 10 templates relevant to an interior design business, in mixed approval states
- 42 contacts with realistic Indian names and phone numbers
- 5 campaigns in various states (draft, processing, completed, partially completed)
- 130+ notifications with varied delivery statuses

### 5. Start the app

```bash
npm run dev
```

This runs the backend on **http://localhost:4000** and the frontend on **http://localhost:5173** (with `/api` proxied to the backend) concurrently.

Log in with `admin@kssinteriors.com` / `Admin@123`.

### Production build

```bash
npm run build
```

Builds the backend (`tsc`) to `apps/backend/dist` and the frontend (`vite build`) to `apps/frontend/dist`.

## Environment Variables

All variables live in `apps/backend/.env` (see `apps/backend/.env.example`):

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | Backend port (default `4000`) |
| `CLIENT_ORIGIN` | Frontend origin for CORS (default `http://localhost:5173`) |
| `JWT_SECRET` | Secret used to sign session tokens |
| `JWT_EXPIRES_IN` | Session token lifetime (default `8h`) |
| `META_MODE` | `mock` (default, fully simulated) or `live` (real Meta Cloud API calls) |
| `META_APP_ID` / `META_APP_SECRET` | Meta app credentials (live mode only) |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Your WABA ID (live mode only) |
| `WHATSAPP_PHONE_NUMBER_ID` | Your WhatsApp phone number ID (live mode only) |
| `WHATSAPP_ACCESS_TOKEN` | Meta system-user access token (live mode only) |
| `WEBHOOK_VERIFY_TOKEN` | Token Meta's webhook verification challenge must match |

## Mock vs. Live WhatsApp Mode

The backend selects an implementation of the `WhatsAppService` interface at runtime based on `META_MODE`:

- **`MockWhatsAppService`** (default) — simulates account connection, template submission (weighted random approve/reject/pending outcomes with realistic rejection reasons), and message sending (a small random failure rate). After a successful send, `scheduleMockDeliveryProgression()` uses `setTimeout` to simulate the same `sent → delivered → read` (or a late failure) progression that would normally arrive via Meta webhooks — routed through the exact same idempotent `applyDeliveryEvent()` function the real webhook handler uses, so the code path is identical to production. The UI always clearly labels mock mode so it's never mistaken for a real connection.
- **`MetaWhatsAppService`** — calls the real Meta Graph API (`graph.facebook.com/v20.0`) using the configured access token, phone number ID, and WABA ID.

Switch modes by changing `META_MODE` and restarting the backend.

## Public API for the CRM

All endpoints are under `/api/v1/*` and require an API key (generated from **API Integration** in the app) as a bearer token — **never** a JWT, and Meta credentials are never exposed at this layer.

```bash
curl -X POST http://localhost:4000/api/v1/whatsapp/send \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "919876543210",
    "template": "quotation_ready",
    "language": "en_US",
    "variables": { "1": "Aarav", "2": "Modular Kitchen", "3": "1,45,000" }
  }'
```

Response:

```json
{ "success": true, "messageId": "wamid.mock.xxxxxxxx", "status": "SENT" }
```

Only **approved** templates can be used to send — enforced server-side, not just in the UI. Other endpoints: `GET /api/v1/templates`, `GET/POST /api/v1/contacts`, `POST /api/v1/campaigns`, `GET /api/v1/notifications`. Requests are rate-limited per API key (60/minute by default) and return structured errors: `{ "success": false, "error": { "code", "message" } }`. Full docs with JavaScript and PHP examples are available in-app under **API Integration → Documentation**.

## Webhooks

- `GET /api/webhooks/whatsapp` — responds to Meta's `hub.challenge` verification handshake using `WEBHOOK_VERIFY_TOKEN`.
- `POST /api/webhooks/whatsapp` — processes delivery status events. Every event is deduplicated against a unique `eventKey` in the `WebhookEvent` table before being applied, so replayed webhook deliveries never double-update a notification or a campaign's counters.

## Testing

```bash
npm run test -w apps/backend
```

The suite (Vitest) covers: password hashing and JWT sessions, template name/variable validation, phone number normalization/validation, the API key middleware, the `/api/v1/whatsapp/send` approved-template business rule, campaign creation rules (approved template required, invalid phone numbers filtered out), and webhook delivery-event idempotency. Prisma is mocked at the module boundary so these run without a live database connection.

## PWA Installation

Once the frontend is running, open it in Chrome/Edge and use the browser's "Install App" prompt (or the install icon in the address bar) to install KSS WhatsApp Notifications as a standalone app. It works offline for the app shell thanks to the generated service worker.

## Known Gaps / Notes

- `MetaWhatsAppService` is a real Meta Graph API integration but has not been exercised against a live Meta account as part of this build — verify against your own WABA before using `META_MODE=live` in production.
- CSV import parsing is a minimal client-side parser suitable for straightforward CSV files; it does not handle quoted commas/newlines inside fields.
- The in-process campaign queue is intentionally simple (batched `setImmediate`-style processing with a short delay between batches) rather than a durable job queue like BullMQ/Redis — sufficient for demo/single-instance use, called out in the spec as an acceptable approach.
