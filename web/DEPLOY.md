# Find Leads — deployment guide

## Vercel (app hosting)

1. Push this repo and import it with **Root Directory** set to `web`.
2. Set environment variables (see [Environment variables](#environment-variables) below).
3. Deploy. Build command: `npm run build` (see `vercel.json`).

## Lead enrichment (manual control)

Guess websites, Check social, and Find emails **only run on rows you select** in the results table — never the full search list. Each action is capped at **20 selected rows** per click.

## Data storage model

| Data | Where it lives |
|------|----------------|
| Search history | Firestore when `STORAGE_PROVIDER=firebase`, else local JSON |
| Call activity (called / uncalled audit) | Firestore when firebase enabled, else local JSON |
| Call state (which leads were called) | Firestore when firebase enabled, else local JSON |
| Email send logs | Firestore when firebase enabled, else `email_logs.json` |
| Users, templates, SMTP, logos | Local files |

With `STORAGE_PROVIDER=local` on Vercel, **all** local data is lost on redeploy. Enable Firebase for history and call activity at minimum.

## Firebase setup

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. Enable **Firestore** (Native mode).
3. Project settings → Service accounts → **Generate new private key**.
4. Set env vars in Vercel (see below) and set `STORAGE_PROVIDER=firebase`.
5. Deploy security rules:

```bash
cd web
firebase use your-project-id
firebase deploy --only firestore:rules
```

Firestore collections (created automatically on first write):

```
users/{userId}/searchHistory/{entryId}
users/{userId}/callActivity/{entryId}
users/{userId}/emailLogs/{entryId}
users/{userId}/prefs/callLog
```

Client access is denied in `firestore.rules` — only the server (Admin SDK) reads/writes.

## Environment variables

### Required (all deployments)

| Variable | Example | Purpose |
|----------|---------|---------|
| `AUTH_SECRET` | long random string | Session signing |
| `NEXT_PUBLIC_APP_URL` | `https://find-leads.vercel.app` | Links in emails |
| `ADMIN_EMAIL` | `admin@example.com` | First admin account |
| `ADMIN_PASSWORD` | strong password | First admin password |

### Firebase (production persistence for history & calls)

| Variable | Where to find it |
|----------|------------------|
| `STORAGE_PROVIDER` | Set to `firebase` |
| `FIREBASE_PROJECT_ID` | Firebase console → Project settings |
| `FIREBASE_CLIENT_EMAIL` | Service account JSON → `client_email` |
| `FIREBASE_PRIVATE_KEY` | Service account JSON → `private_key` (paste with `\n` for newlines) |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Same as `FIREBASE_PROJECT_ID` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Project settings → Web API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |

### Optional

| Variable | Purpose |
|----------|---------|
| `GOOGLE_PLACES_API_KEY` | Google Places search (paid API) |
| `SCRAPE_DEEP_FALLBACK` | `false` to disable Jina deep scrape |
| `JINA_API_KEY` | Higher Jina rate limits |

Verify after deploy: `GET /api/health` — check `firebaseActivity: true`.

## Logo (email)

- Logo is stored per user at `data/users/{userId}/logo.png`.
- Upload in **Settings → Email logo**.
- On Vercel without persistent disk, re-upload after each deploy.

## Pre-deploy checklist

- [ ] `npm run build` passes locally
- [ ] `AUTH_SECRET` set in production
- [ ] `NEXT_PUBLIC_APP_URL` matches live domain
- [ ] `STORAGE_PROVIDER=firebase` + Firebase env vars for production
- [ ] SMTP settings saved for admin user
- [ ] Test search → select rows → guess/scrape on selection only
- [ ] Test email sends; email logs appear in Activity

## Local run

```bash
cd web
npm install
cp .env.example .env.local
npm run dev
```

Default admin (from `.env.example`): `admin@mybusinessesleads.com` / `MBLAdmin2026!`
