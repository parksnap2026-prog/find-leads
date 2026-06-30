# Find Leads — deployment guide

## Vercel (app hosting)

**Ready now** for a preview/staging deploy with local file storage.

1. Push this repo and import the **`web`** folder as the Vercel project root (or set Root Directory to `web`).
2. Set environment variables from `.env.example`:
   - `AUTH_SECRET` — long random string (required)
   - `NEXT_PUBLIC_APP_URL` — your production URL, e.g. `https://find-leads.vercel.app`
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD` — first admin seed
   - `GOOGLE_PLACES_API_KEY` — optional, for Google search
3. Deploy. Build command: `npm run build` (see `vercel.json`).

**Important:** Vercel serverless has **no persistent disk**. With `STORAGE_PROVIDER=local`, user data under `data/` is **lost on redeploy**. For production you must switch to Firebase (below) or another database + object storage.

## Firebase (data + files)

**Scaffold is in place** — rules and env vars are defined; the app still uses **local files** until `STORAGE_PROVIDER=firebase` and the adapter is wired.

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com).
2. Enable **Firestore** and **Storage**.
3. Create a service account key (Project settings → Service accounts → Generate new private key).
4. Set in Vercel (or `.env.local`):

```
STORAGE_PROVIDER=firebase
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

5. Deploy rules from `web/`:

```bash
cd web
firebase use your-project-id
firebase deploy --only firestore:rules,storage
```

6. Implement Firestore/Storage adapters in `src/lib/db/firebase.ts` (stub today).

## Logo (email)

- Logo is stored **per user** at `data/users/{userId}/logo.png`.
- Upload in **Settings → Email logo** (admin account).
- Previews load via `/api/logo/data` (data URL); sent mail attaches the same file with CID `logo_webpower`.
- On Vercel with local storage, upload logo **after each deploy** until Firebase storage is connected.

## Pre-deploy checklist

- [ ] `npm run build` passes locally
- [ ] `AUTH_SECRET` set in production
- [ ] `NEXT_PUBLIC_APP_URL` matches live domain
- [ ] SMTP settings saved for admin user
- [ ] Email logo uploaded under admin account
- [ ] Template saved (Free Demo Website)
- [ ] Test email sends with logo visible
- [ ] Plan Firebase migration before relying on production data on Vercel

## Local run

```bash
cd web
npm install
cp .env.example .env.local
npm run dev
```

Default admin (from `.env.example`): `admin@mybusinessesleads.com` / `MBLAdmin2026!`
