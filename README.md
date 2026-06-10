# AI Lead Bundle — Backend Server

Express server that serves the compiled frontend with live Stripe + Supabase integration.
No frontend files are modified on disk — all patches are applied in memory at serve time.

## Setup (one time)

### 1. Install dependencies
```
npm install
```

### 2. Set up Supabase tables
- Go to https://supabase.com/dashboard → your project → SQL Editor
- Paste and run the contents of `schema.sql`

### 3. Configure Stripe webhook (for local testing)
Install Stripe CLI: https://stripe.com/docs/stripe-cli
```
stripe listen --forward-to localhost:3001/api/webhook
```
Copy the webhook signing secret it gives you and update `STRIPE_WEBHOOK_SECRET` in `.env`.

### 4. Run
```
npm start          # production
npm run dev        # auto-restart on file change (requires nodemon)
```

Open http://localhost:3001

---

## What the server does

| What | How |
|------|-----|
| Serves frontend | Static files from `FRONTEND_DIR` |
| Patches Supabase | Replaces mocked client with real CDN client |
| Patches Checkout | Replaces stub with real `fetch /api/create-checkout` call |
| Stripe Checkout | `POST /api/create-checkout` → creates session → returns URL → frontend redirects |
| Stripe Webhook | `POST /api/webhook` → updates order status in Supabase |
| Log order | `POST /api/log-order` → console log (extend as needed) |
| Leads | `POST /api/leads` → saves to Supabase leads table |

## Known missing pages

These pages are referenced in the frontend bundle but their JS chunks are absent from this build:

- `/dfy-checkout`
- `/dfy-one-time`
- `/book-a-call`
- `/access`
- `/control-center`

The server returns empty modules for missing chunks so the app doesn't crash.
Get the full source from Lovable.dev to restore these pages.

## Going live

1. Change `SITE_URL` in `.env` to your production domain
2. Replace `sk_test_` → `sk_live_` Stripe key
3. Update `STRIPE_WEBHOOK_SECRET` with the live webhook secret from Stripe dashboard
4. Deploy to any Node.js host (Railway, Render, Fly.io, VPS)
