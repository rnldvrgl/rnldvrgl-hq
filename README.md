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
6. **Make the sign-in email include a 6-digit code.** Go to **Authentication → Emails** (called **Email Templates** in some dashboards). Open the **Magic link** template, delete everything in the **Body** box, paste this, and click **Save**:

    ```html
    <h2>Your rnldvrgl HQ code</h2>
    <p>Type this code on the HQ sign-in page:</p>
    <p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
    <p>Or <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email">click here to sign in</a>.</p>
    ```

    Do the same for the **Confirm signup** template, since your very first sign-in uses that one.

    Why: the default email only has a link, and that link fails if it opens in a different browser from the one you signed in from. The code works anywhere, and the new link works in any browser too.
7. Always open HQ at `http://localhost:3000`, not `127.0.0.1:3000`. They count as different sites, so a session from one doesn't carry over to the other.

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

This takes about 10 minutes. In Parts A–D you create a "Google app" so Google knows what HQ is. In Part E you press **Connect Google** inside HQ. You never copy a token by hand.

Use your **personal** Gmail for every step, not your work account. If you're signed in to several Google accounts, check the avatar in the top-right corner of each page.

#### Part A: Create the project (Google Cloud Console)

1. Open https://console.cloud.google.com and sign in with your personal Gmail. If it asks you to accept the Terms of Service, pick your country and click **Agree and continue**.
2. At the top left, next to the Google Cloud logo, click the **project picker** (it says "Select a project" or shows a project name). In the window that opens, click **New project** at the top right.
3. Type **rnldvrgl HQ** as the project name. Leave Location as "No organization". Click **Create**.
4. Wait about 10 seconds for the bell icon to show it's done. Then open the project picker again and click **rnldvrgl HQ** so it's the selected project. Its name should now show at the top of the page.

#### Part B: Turn on Gmail and Calendar

5. In the search bar at the top of the console, type **Gmail API** and click the result with that name. Click the blue **Enable** button.
6. Search again for **Google Calendar API**, click it, and click **Enable**.

#### Part C: Set up the sign-in screen (Google Auth Platform)

7. Search the top bar for **Google Auth Platform** and open it. You'll see "Google Auth Platform not configured yet". Click **Get started**.
8. The setup has four short steps:
   - **App information:** App name `rnldvrgl HQ`. User support email: pick your Gmail from the dropdown. Click **Next**.
   - **Audience:** choose **External**. Click **Next**.
   - **Contact information:** type your Gmail. Click **Next**.
   - **Finish:** tick the box to agree to the user data policy. Click **Continue**, then **Create**.
9. In the left menu, click **Audience**. Scroll to **Test users** and click **+ Add users**. Type your personal Gmail, then click **Save**. Only test users can sign in while the app is in Testing.
10. In the left menu, click **Data Access**, then **Add or remove scopes**. A panel slides in from the right. Scroll to the bottom to the box called **Manually add scopes**. Paste these three lines into it:

    ```
    https://www.googleapis.com/auth/gmail.readonly
    https://www.googleapis.com/auth/gmail.compose
    https://www.googleapis.com/auth/calendar.events
    ```

    Click **Add to table**, then **Update** at the bottom of the panel, then **Save** at the bottom of the page. Google will list the Gmail scopes under "restricted scopes"; that's expected.

#### Part D: Create the client ID and secret

11. In the left menu, click **Clients**, then **+ Create client**.
12. Set **Application type** to **Web application**. Set **Name** to `rnldvrgl HQ web`.
13. Under **Authorized redirect URIs**, click **+ Add URI** and paste:

    ```
    http://localhost:3000/api/google/callback
    ```

    You'll add your Vercel address here too in step 8. Leave "Authorized JavaScript origins" empty.
14. Click **Create**. A window shows your **Client ID** and **Client secret**. Copy both into `.env.local` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Also click **Download JSON** as a backup, because Google may not show the secret again.

#### Part E: Connect from inside HQ

15. Restart `npm run dev` so it picks up the new values. Open http://localhost:3000 and sign in.
16. Click **Connect Google** in the header. Pick your personal Gmail.
17. Google shows **"Google hasn't verified this app"**. That's normal for an app only you use. Click **Continue**. (On some screens it's **Advanced**, then **Go to rnldvrgl HQ (unsafe)**.)
18. On the permissions screen, **tick every checkbox** (read email, manage drafts, see and edit calendar events), then click **Continue**.
19. You land back in HQ with a "Google connected" message, and the header shows your Gmail address instead of the button.

#### About the 7-day limit

While the app's status is **Testing**, Google ends the connection after 7 days. HQ notices this, shows the **Connect Google** button again, and Maya, Iggy and Cal pause with "Your Google connection expired". Reconnecting is steps 16–18 again, about 20 seconds.

To stop the weekly reconnect, publish the app: **Google Auth Platform → Audience → Publish app → Confirm**, then click **Connect Google** once more. You'll still see the "hasn't verified" warning, which is fine for personal use. If Google asks you to submit the app for verification and won't let you continue, stay in Testing and reconnect weekly.

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
4. In Google Cloud: **Google Auth Platform → Clients →** click `rnldvrgl HQ web` **→ Authorized redirect URIs → + Add URI** → `https://YOUR-APP.vercel.app/api/google/callback` **→ Save**. If you use the same Supabase project locally and live, you are already connected; otherwise open the live site and click **Connect Google** once.
5. After your first sign-in, turn off **Authentication → Providers → Email → Allow new users to sign up** so nobody else can create an account.

### 9. Start the office clock

1. Supabase → **Database → Extensions**: enable `pg_cron` and `pg_net`.
2. In the SQL Editor, run the commented `cron.schedule(...)` block at the bottom of `schema.sql` with your Vercel URL and `CRON_SECRET` filled in.
3. Check it under **Integrations → Cron**. Within 5 minutes Ring's desk should show a recent check.

Why Supabase and not Vercel Cron: Vercel's free plan only runs a cron once a day, and reminders need to fire every few minutes.

### 10. Tune your team

- **Names, desks, hours:** `lib/team.ts`
- **3D colours and room size:** `components/office/palette.ts`
- **Animations:** `components/office/Desk3D.tsx` (drop-in, typing, hop) and `Scene3D.tsx` (camera controls and the glide to a desk)
- **Job criteria and your CV:** `data/master-profile.json` (fill in the `TODO` screening answers)
- **Job boards:** `JOB_BOARDS` in `lib/employees/job-hunter.ts`
- **Research topics:** `RESEARCH_TOPICS` in `lib/employees/researcher.ts`
- **Adding a ninth employee:** add a file in `lib/employees/`, register it in `lib/employees/index.ts`, give it a desk in `lib/team.ts`, and add its id to the `insert into employees` line in `schema.sql`.

### 11. Install HQ on your iPhone

HQ is a web app you can install from Safari. Installed, it opens full screen from its own Home Screen icon, with a bottom tab bar (Office, Team, Reminders).

1. Open your Vercel URL in **Safari** on the iPhone and sign in.
2. Tap **Share → Add to Home Screen → Add**.
3. Open **HQ** from the Home Screen. You stay signed in; if you're ever sent to the login page, sign in again inside the app (the installed app keeps its own cookies, separate from Safari).

It needs a connection to work (there's no offline mode), and the 3D office uses less detail on phones to save battery.

### 12. Sync your iPhone Reminders

Apple doesn't offer a web API for Reminders, so an iOS **Shortcut** does the syncing. Each time it runs, it sends your open iPhone reminders to HQ and adds HQ's reminders to your iPhone:

- New reminders on your iPhone (with a due date) appear in HQ with an **iPhone** badge. Complete or delete them on the iPhone, and they disappear from HQ on the next sync. Ring doesn't email these, since your iPhone already alerts you.
- Reminders you add in HQ are added to your iPhone once. If you complete a one-off reminder on the iPhone, HQ marks it done. Each new occurrence of a repeating HQ reminder is sent over again.
- Reminders are matched by **title + due time**, because Shortcuts can't read a reminder's ID. Renaming one or changing its time on either side counts as a new reminder.
- Reminders without a due date are skipped.

**One-time setup**

1. **Database:** in Supabase → SQL Editor, run the `-- iPhone Reminders sync` block from `supabase/schema.sql` (it's safe to run on your existing database).
2. **Token:** create one with `openssl rand -hex 32`, add it as `SHORTCUTS_TOKEN` in `.env.local` and in Vercel, and redeploy.
3. **The Shortcut:** in the Shortcuts app, tap **+**, name it `HQ Sync`, and add these actions in order:
   1. **Find Reminders** → add the filter **Is Completed** is **false**.
   2. **Repeat with Each** item in *Reminders*. Inside the loop, add:
      - **Format Date**: tap *Date* and pick *Repeat Item → Due Date*. Set *Date Format* to **ISO 8601** and turn on **Include ISO 8601 Time**.
      - **Text**: `Formatted Date|Repeat Item → Title` (the two variables with a `|` between them, no spaces).
   3. After *End Repeat*: **Combine Text** → *Repeat Results*, combined with **New Lines**.
   4. **Get Contents of URL**:
      - URL: `https://YOUR-APP.vercel.app/api/reminders/sync`
      - Method: **POST**
      - Headers: `Authorization` = `Bearer YOUR_SHORTCUTS_TOKEN`
      - Request Body: **JSON**, with one **Text** field `items` = *Combined Text*.
   5. **Get Dictionary Value**: get the value for `to_add` in *Contents of URL*.
   6. **Repeat with Each** item in *Dictionary Value*. Inside the loop, add:
      - **Get Dictionary Value** `title` from *Repeat Item*.
      - **Get Dictionary Value** `due_text` from *Repeat Item* (it looks like `November 3, 2026 at 7:30 PM`).
      - **Add New Reminder**: the title value, in your default list. Turn on *Remind Me* **At Time**, and set the time to the `due_text` value.
4. Run it once from the Shortcuts app and allow access to Reminders and to your HQ URL when iOS asks.
5. **Run it automatically:** Shortcuts → **Automation → +** → **App** → choose **Reminders** → **Is Closed** → **Run Immediately** → `HQ Sync`. HQ then catches up every time you close the Reminders app. You can also add a **Time of Day** automation (for example 7:00 AM) so reminders added in HQ reach your iPhone even on days you don't open Reminders.

**If it doesn't sync:** run `HQ Sync` by hand in the Shortcuts app and read the result. `unauthorized` means the token in the header doesn't match `SHORTCUTS_TOKEN` (check the `Bearer ` prefix). A `400` means the `items` field is missing or isn't Text.

---

## A day in the office

The 3D office follows Manila time, so every screen shows the same moment:

| When | What happens |
|---|---|
| 6 AM–11:30 AM | Morning light: a warm sunrise in the windows, then bright day. |
| 7:00 AM | Everyone walks in from the street and sits down. |
| 7–8 AM, 12–1 PM, 6–7 PM | Ben the janitor mops the aisles (wet-floor sign out). |
| 11:30 AM–1 PM | Lunch: the brightest part of the day. |
| 1 PM–6 PM | Afternoon: golden light, sunset from about 5:20 PM. |
| 5:40 PM | Today's trash duty walks round every bin and takes the bag out to the big bin outside. The team takes turns, one per day. |
| 7 PM | Idle employees go home. Anyone working, waiting for you or showing an error stays at their desk. |
| Night | City lights in the windows, office lights on, screens off on empty desks. |
| Through the day | Ronald gets up now and then (every half hour from 9:30 AM to 4:30 PM, and at random), walks the floor and looks over people's shoulders, sometimes via the coffee machine. |

The ACs run 8 AM–7 PM on the floor and 7:30 AM–10:30 PM in the corner office.

Use the clock button at the top left of the office to jump to any of these moments. It keeps ticking from there; **Back to live** returns to now. Change the times in `lib/office-clock.ts`.

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
| "That sign-in link didn't work" | Type the 6-digit code instead of clicking the link. If the email has no code, redo step 2.6. The message in brackets is Supabase's exact reason. |
| "That code is wrong or has expired" | Use the code from the **newest** email; each new code cancels the old one. Codes last 1 hour by default. |
| Desk lamp red | Open the desk; the report shows the error. Fix the env var, then **Run now**. |
| **Connect Google** shows again / "Google connection expired" | Normal after 7 days in Testing. Click it and reconnect, or publish the app (step 5, "About the 7-day limit"). |
| Google says `redirect_uri_mismatch` | The address in step 13 (or deploy step 4) must match exactly, including `http` vs `https` and no trailing slash. |
| Google says "Access blocked: app has not completed verification" | Your Gmail isn't on the test user list. Redo step 9. |
| "Google didn't return a long-lived sign-in" | Remove rnldvrgl HQ at myaccount.google.com/permissions, then click Connect Google again. |
| No emails arrive | With `onboarding@resend.dev`, `EMAIL_TO` must be your Resend sign-up email. |
| Nobody runs on schedule | Check Supabase → Integrations → Cron for failed runs; the URL or secret is usually wrong. |
| Office shows the flat SVG, not 3D | The browser has WebGL turned off or unsupported. Enable hardware acceleration. |
| `Cannot find module '@/components/ui/…'` | Run `npm run ui`. |
| Maya, Iggy or Dex say "Waiting for your Claude key" | Expected on the Gemini backup. Add `ANTHROPIC_API_KEY` and redeploy. |
| `Gemini free tier limit reached` | Wait for the daily reset, or add the Claude key. |
| Desk stuck on "working" | It frees itself after 10 minutes; check Vercel → Logs for a timeout. |
| Name tags or status bubbles missing after `npm install` | Delete `.next` and restart `npm run dev`. The build cache doesn't notice the drei patch changing. |
