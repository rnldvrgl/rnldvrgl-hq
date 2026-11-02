# rnldvrgl HQ

Your private headquarters: eight AI employees in a 3D isometric office. Each desk has a person, a name tag with an icon, and a status lamp. Click a desk and the camera glides over; read their latest report, run them now, or pause them.

**Stack:** Next.js 15 · React Three Fiber + drei (3D office) · GSAP (all motion) · Zustand (state) · shadcn/ui + Tailwind v4 (panels) · react-responsive (layout and 3D quality per screen) · Supabase · Claude API.

**Motion (GSAP):** desks drop in on load · camera glides to the desk you pick · employees type and their screens flicker while working · a little hop when a job finishes · panels and the team list stagger in. All of it switches off when your device asks for reduced motion.

**Responsive (react-responsive):** desktop gets a side panel, shadows and full-resolution 3D; tablets and phones get a bottom sheet and lighter rendering. The 3D palette follows your light/dark setting. Devices without WebGL get a flat isometric SVG version of the same office.

| Desk | Name | What they do | When (Manila) |
| --- | --- | --- | --- |
| Chief of Staff | Maya | Emails a morning brief: calendar, unread mail, reminders, job pipeline | Weekdays 7:30 AM |
| Inbox Triage | Iggy | Sorts new Gmail, saves reply **drafts**, adds interview invites as **tentative** events | Weekdays 9 AM, 1 PM, 5 PM |
| Job Hunter | Hunter | Searches 13 job boards for remote mid-level React/Next.js roles at ₱40k+, scores them | Weekdays 7:45 AM |
| Reminder Bot | Ring | Emails each reminder on time; repeats daily, weekdays or weekly | Every 5 minutes |
| Scheduler | Cal | Previews tomorrow, flags clashes, lists free blocks | Daily 6 PM |
| Researcher | Rhea | Weekly digest on Next.js, React, GSAP and the remote job market | Monday 8 AM |
| Dev Assistant | Dex | Summarises open GitHub PRs and issues involving you | Weekdays 10 AM |
| Weekly Reviewer | Rev | Friday recap of the team's week and next week's priorities | Friday 5 PM |

**Lamps:** grey idle · blue working · amber needs you · red error · faded desk = paused.

**What it never does:** send email, apply to jobs, log in to job sites, or accept invites. It drafts and suggests; you click send.

---

## How it fits together

```
Supabase pg_cron ──every 5 min──▶ /api/tick ──▶ Reminder Bot + the one most-overdue employee
                                                     │
                       Claude API (web search) ◀─────┤──▶ Gmail / Calendar / GitHub
                                                     ▼
                                   Supabase tables ──▶ the office UI (polls /api/state)
                                                     └──▶ Resend email to you
```

Everything runs on free tiers except the Claude API (pay as you go).

---

## Setup, step by step

### 1. Create the repo

```bash
git init rnldvrgl-hq && cd rnldvrgl-hq
# copy these files in, then:
npm install
npm run ui            # generates the shadcn components into components/ui
cp .env.example .env.local
```

`npm run ui` runs `shadcn add` for the 11 components the office uses (button, badge, card, sheet, select, input, label, separator, scroll-area, tabs, sonner). `components.json` is already configured, so there's no `shadcn init` step. Commit the generated `components/ui` folder.

Push it to a **new private GitHub repo** on your personal account.

### 2. Supabase (database + login)

1. Create a project at supabase.com (or reuse the one from your portfolio).
2. **SQL Editor** → paste `supabase/schema.sql` → Run. This creates the tables and your 8 employees.
3. **Project Settings → API**: copy the URL, `anon` key and `service_role` key into `.env.local`.
4. **Authentication → URL Configuration**: set Site URL to `http://localhost:3000` for now, and add `http://localhost:3000/auth/callback` to Redirect URLs.
5. Set `OWNER_EMAIL` to your email. Only that address can open the office.

### 3a. Gemini backup (free, use this until Claude is ready)

While `ANTHROPIC_API_KEY` is empty, the office runs on Google's free Gemini API. The header badge shows which brain is active.

1. Go to https://aistudio.google.com/apikey → **Create API key** (personal Google account) → `GEMINI_API_KEY`.
2. Leave `GEMINI_MODEL=gemini-3.8-flash`. Google Search grounding is built in, so Hunter and Rhea can still search the web.
3. Leave `BACKUP_ALLOW_PRIVATE=false`. Google may use free-tier prompts to improve its products, so **Maya, Iggy and Dex** (email, calendar, private repos) wait for Claude and say so on their desk. Hunter, Rhea, Rev, Cal, Ring and cover letters all work on the backup.

| Brain | When it's used |
| --- | --- |
| Claude | `ANTHROPIC_API_KEY` is set |
| Gemini backup | No Claude key, or Claude rejects the key / is out of credit (that call only, never for private desks) |
| None | Neither key set: desks show "No AI key yet" |

The free tier has daily limits. If Gemini hits one, the desk shows it and the next day's runs continue.

### 3b. Claude API (free with Max, via monthly API credits)

The app needs an API key; a claude.ai login can't be used by a deployed app. But **Max includes $100 of API credits a month**, which covers this office comfortably.

1. On claude.ai (your **personal** Max account): **Settings → Billing → API credits → Link organization**, and create a new Console organization for the office. You need to have been on Max for 7 days.
2. In that organization on console.anthropic.com → **API Keys** → create a key → `ANTHROPIC_API_KEY`. Calls with this key draw from the monthly credits first.
3. Credits don't roll over, and when they run out requests stop until next month unless you add paid credits. **Billing → Limits** lets you cap spend if you do add any.
4. `CLAUDE_MODEL` defaults to `claude-sonnet-5-5`, a good balance of cost and quality.

### 4. Resend (emails to you)

1. resend.com → create an API key → `RESEND_API_KEY`.
2. Leave `EMAIL_FROM=rnldvrgl HQ <onboarding@resend.dev>` while testing. That sender can only email the address you signed up to Resend with, so sign up with your personal Gmail.
3. Later, verify a domain in Resend to send from your own address.

### 5. Google (Gmail + Calendar), personal account only

1. console.cloud.google.com → new project "rnldvrgl HQ".
2. **APIs & Services → Library**: enable **Gmail API** and **Google Calendar API**.
3. **OAuth consent screen**: External, add yourself as a test user.
4. **Credentials → Create OAuth client ID** → Web application → add redirect URI `https://developers.google.com/oauthplayground`.
5. Open the OAuth Playground → gear icon → "Use your own OAuth credentials" → paste the client ID and secret.
6. Authorise these scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.compose` (drafts only; the app never calls send)
   - `https://www.googleapis.com/auth/calendar.events`
7. Exchange the code for tokens and copy the **refresh token** → `GOOGLE_REFRESH_TOKEN`.

> While the consent screen is in "Testing", Google expires refresh tokens after 7 days. Publish the app (no review needed for a personal app with you as the only user) so it keeps working.

### 6. GitHub

github.com → Settings → Developer settings → **Fine-grained token** → read-only access to Issues, Pull requests and Metadata on your repos → `GITHUB_TOKEN`. Set `GITHUB_USERNAME=rnldvrgl`.

### 7. Run it locally

```bash
openssl rand -hex 32   # paste into CRON_SECRET
npm run dev
```

Open http://localhost:3000 → sign in with the email link → click a desk → **Run now**. Try Ring first (add a reminder two minutes out), then Hunter.

To fake the 5-minute clock locally:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/tick
```

### 8. Deploy to Vercel

1. vercel.com → **Add New Project** → import the repo.
2. Add every variable from `.env.local` under **Settings → Environment Variables**. Change `APP_URL` to the Vercel URL.
3. Deploy, then in Supabase **Authentication → URL Configuration** add `https://YOUR-APP.vercel.app` and `https://YOUR-APP.vercel.app/auth/callback`.
4. After your first sign-in, turn off **Authentication → Providers → Email → Allow new users to sign up** so nobody else can create an account.

### 9. Start the office clock

1. Supabase → **Database → Extensions**: enable `pg_cron` and `pg_net`.
2. In the SQL Editor, run the commented `cron.schedule(...)` block at the bottom of `schema.sql` with your Vercel URL and `CRON_SECRET` filled in.
3. Check it under **Integrations → Cron**. Within 5 minutes Ring's desk should show a recent check.

Why Supabase and not Vercel Cron: Vercel's free plan only runs a cron once a day, and reminders need to fire every few minutes.

### 10. Tune your team

- **Names, desks, hours:** `lib/team.ts`
- **3D colours and room size:** `components/office/palette.ts`
- **Animations:** `components/office/Desk3D.tsx` (drop-in, typing, hop) and `Scene3D.tsx` (camera glide)
- **Job criteria and your CV:** `data/master-profile.json` (fill in the `TODO` screening answers)
- **Job boards:** `JOB_BOARDS` in `lib/employees/job-hunter.ts`
- **Research topics:** `RESEARCH_TOPICS` in `lib/employees/researcher.ts`
- **Adding a ninth employee:** add a file in `lib/employees/`, register it in `lib/employees/index.ts`, give it a desk in `lib/team.ts`, and add its id to the `insert into employees` line in `schema.sql`.

---

## Costs (rough, per month)

| Item | Estimate |
| --- | --- |
| Claude API tokens | ~$3–8 with Sonnet at this schedule (covered by Max's $100 monthly API credits) |
| Claude web searches (Hunter, Rhea, cover letters) | ~120 searches × $10 per 1,000 ≈ $1.20 |
| Vercel Hobby, Supabase Free, Resend Free, Google APIs | $0 |

## Security notes

- Every page and API route checks that the signed-in user is `OWNER_EMAIL`. `/api/tick` checks `CRON_SECRET`.
- Supabase Row Level Security is on with no public policies; only the server's service-role key reads data.
- Job posts and emails are treated as untrusted text. Claude's replies are validated with zod before anything is saved.
- Keep this on personal accounts, not your employer's.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Desk lamp red | Open the desk; the report shows the error. Fix the env var, then **Run now**. |
| `Google token refresh failed` | Re-create `GOOGLE_REFRESH_TOKEN` (step 5) and publish the consent screen. |
| No emails arrive | With `onboarding@resend.dev`, `EMAIL_TO` must be your Resend sign-up email. |
| Nobody runs on schedule | Check Supabase → Integrations → Cron for failed runs; the URL or secret is usually wrong. |
| Office shows the flat SVG, not 3D | The browser has WebGL turned off or unsupported. Enable hardware acceleration. |
| `Cannot find module '@/components/ui/…'` | Run `npm run ui`. |
| Maya, Iggy or Dex say "Waiting for your Claude key" | Expected on the Gemini backup. Add `ANTHROPIC_API_KEY` and redeploy. |
| `Gemini free tier limit reached` | Wait for the daily reset, or add the Claude key. |
| Desk stuck on "working" | It frees itself after 10 minutes; check Vercel → Logs for a timeout. |
