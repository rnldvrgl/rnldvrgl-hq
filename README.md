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
7. **Optional: passkeys** (sign in with Face ID, Touch ID or Windows Hello). Go to **Authentication → Sign In / Providers**, turn on **Passkeys**, and set the relying party to your domain (`localhost` for local dev). Then sign in once with a password or a code, open **Settings → Account** in the office and press **Add a passkey on this device**. After that, **Sign in with a passkey** works on the login page.
8. Always open HQ at `http://localhost:3000`, not `127.0.0.1:3000`. They count as different sites, so a session from one doesn't carry over to the other.

### 3a. Free backups: Groq and Gemini (use these until Claude is ready)

While `ANTHROPIC_API_KEY` is empty, the office runs on free backups. Set up **Groq** (more generous free tier) and, optionally, **Gemini** as a second backup. When one hits its free-tier limit, that call moves to the next. The header badge shows which brain is active.

**Groq (recommended first)**

1. Go to https://console.groq.com, sign in (Google sign-in works), open **API Keys → Create API Key**, and copy it into `.env.local` as `GROQ_API_KEY`.
2. Leave `GROQ_MODEL` and `GROQ_SEARCH_MODEL` empty. HQ tries Groq's current models itself and remembers the first that works. Hunter and Rhea need web search, so for them it tries Groq's "compound" systems, then gpt-oss with Groq's browser search. If your account has none of those, their searches go to Gemini instead. To force a model, put a name from https://console.groq.com/docs/models in either setting.

**Gemini (second backup, optional)**

3. Go to https://aistudio.google.com/apikey → **Create API key** (personal Google account) → `GEMINI_API_KEY`. Leave `GEMINI_MODEL=gemini-3.8-flash`. Its Google Search grounding has a small daily free quota, which is why Gemini alone runs out quickly.

**Both**

4. Leave `BACKUP_ALLOW_PRIVATE=false`. Free tiers may use prompts to improve their products, so **Maya, Iggy and Dex** (email, calendar, private repos) wait for Claude and say so on their desk. Hunter, Rhea, Rev, Cal, Ring and cover letters all work on the backups.

| Brain | When it's used |
| --- | --- |
| Claude | `ANTHROPIC_API_KEY` is set |
| Groq, then Gemini | No Claude key, or Claude rejects the key / is out of credit (that call only, never for private desks). A backup at its limit passes the call to the next. |
| None | No keys set: desks show "No AI key yet" |

If every backup is at its limit, the desk says so and the next scheduled run tries again. Adding the Claude key (step 3b) ends the limits.

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

### 5. Keys for Maya, Iggy, Cal and Dex

Four desks read your own accounts, so they need keys of their own. Everyone else (Hunter, Ring, Rhea, Rev) works with just the AI key and Resend.

| Desk | Reads | Keys in `.env.local` | AI |
|---|---|---|---|
| **Maya** (morning brief) | Gmail (unread count), Calendar (today) | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` | Waits for `ANTHROPIC_API_KEY` (private data) |
| **Iggy** (inbox triage) | Gmail (reads new mail, saves reply drafts) | the same three Google keys | Waits for `ANTHROPIC_API_KEY` (private data) |
| **Cal** (tomorrow's calendar) | Calendar | the same three Google keys | Works on the Gemini backup too |
| **Dex** (GitHub PRs and issues) | GitHub | `GITHUB_TOKEN`, `GITHUB_USERNAME` (step 6) | Waits for `ANTHROPIC_API_KEY` (private repos) |

Maya and Cal email you, so they also need the Resend keys from step 4. If a key is missing, that desk shows the error on its panel and the others keep working.

#### 5a. Google (Gmail + Calendar) for Maya, Iggy and Cal

About 10 minutes. In Parts A–D you create a small "Google app" that belongs to you. In Part E you sign in to it once and copy out a **refresh token**, the long-lived key HQ uses to read your mail and calendar.

Use your **personal** Gmail for every step, not your work account. If you're signed in to several Google accounts, check the avatar in the top-right corner of each page.

**Part A: Create the project (Google Cloud Console)**

1. Open https://console.cloud.google.com and sign in with your personal Gmail. If it asks you to accept the Terms of Service, pick your country and click **Agree and continue**.
2. At the top left, next to the Google Cloud logo, click the **project picker** ("Select a project", or a project name). In the window that opens, click **New project** at the top right.
3. Type **rnldvrgl HQ** as the project name. Leave Location as "No organization". Click **Create**.
4. Wait about 10 seconds for the bell icon to show it's done. Open the project picker again and click **rnldvrgl HQ**, so its name shows at the top of the page.

**Part B: Turn on Gmail and Calendar**

5. In the search bar at the top, type **Gmail API**, click the result with that name, and click **Enable**.
6. Search for **Google Calendar API**, click it, and click **Enable**.

**Part C: Set up the sign-in screen (Google Auth Platform)**

7. Search the top bar for **Google Auth Platform** and open it. You'll see "Google Auth Platform not configured yet". Click **Get started**.
8. Fill in the four short steps:
   - **App information:** App name `rnldvrgl HQ`. User support email: your Gmail. Click **Next**.
   - **Audience:** **External**. Click **Next**.
   - **Contact information:** your Gmail. Click **Next**.
   - **Finish:** tick the box to agree to the user data policy, click **Continue**, then **Create**.
9. In the left menu, click **Audience**. Under **Test users**, click **+ Add users**, type your personal Gmail and click **Save**. Only test users can sign in while the app is in Testing.
10. In the left menu, click **Data Access**, then **Add or remove scopes**. In the panel that slides in, scroll to **Manually add scopes** and paste these three lines:

    ```
    https://www.googleapis.com/auth/gmail.readonly
    https://www.googleapis.com/auth/gmail.compose
    https://www.googleapis.com/auth/calendar.events
    ```

    Click **Add to table**, then **Update**, then **Save** at the bottom of the page. Google lists the Gmail scopes under "restricted scopes"; that's expected.

**Part D: Create the client ID and secret**

11. In the left menu, click **Clients**, then **+ Create client**.
12. Set **Application type** to **Web application** and **Name** to `rnldvrgl HQ web`.
13. Under **Authorized redirect URIs**, click **+ Add URI** and paste exactly:

    ```
    https://developers.google.com/oauthplayground
    ```

    (That's Google's own token tool, used once in Part E. Leave "Authorized JavaScript origins" empty.)
14. Click **Create**. Copy the **Client ID** and **Client secret** into `.env.local` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Click **Download JSON** too, as a backup: Google may not show the secret again.

**Part E: Get the refresh token (`GOOGLE_REFRESH_TOKEN`)**

15. Open https://developers.google.com/oauthplayground.
16. Click the **gear icon** (top right). Tick **Use your own OAuth credentials**, paste your Client ID and Client secret, and close the panel. Leave "Access type" on **Offline**.
17. In the box on the left under **Step 1**, at the bottom ("Input your own scopes"), paste the same three scopes separated by spaces:

    ```
    https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/calendar.events
    ```

    Click **Authorize APIs**.
18. Pick your personal Gmail. Google shows **"Google hasn't verified this app"**. That's normal for an app only you use: click **Continue** (or **Advanced → Go to rnldvrgl HQ (unsafe)**). On the permissions screen, **tick every checkbox** and click **Continue**.
19. You're back in the Playground at **Step 2**. Click **Exchange authorization code for tokens**.
20. The Playground now jumps ahead to **Step 3 (Configure request to API)** and folds Step 2 shut. **You don't need Step 3**: it's only for trying API calls. Click the **Step 2** heading on the left to open it again, then copy the **Refresh token** (it starts with `1//`) into `.env.local` as `GOOGLE_REFRESH_TOKEN`. Ignore the access token: it expires in an hour, and HQ makes fresh ones itself. If the Refresh token box is empty, open the gear icon, check **Use your own OAuth credentials** is ticked with your client ID and secret, and redo steps 17–19.
21. Restart `npm run dev`. Open Maya's desk and press **Run now**. Her report should mention today's events and your unread count. If it says "Google token refresh failed", the refresh token or the client values don't match: redo steps 15–20.

On Vercel, add the same three values under **Settings → Environment Variables** and redeploy (step 8).

**About the 7-day limit**

While the app's status is **Testing**, Google expires the refresh token after 7 days, and Maya, Iggy and Cal show "Google token refresh failed (400)". Repeat steps 15–20 for a new token, then update it in `.env.local` and on Vercel.

To stop the weekly refresh, publish the app: **Google Auth Platform → Audience → Publish app → Confirm**, then get a new refresh token once more (steps 15–20). You'll still see the "hasn't verified" warning, which is fine for personal use. If Google asks you to submit the app for verification and won't let you continue, stay in Testing and refresh weekly.

### 6. GitHub for Dex

About 3 minutes. Dex only reads: it lists open pull requests and issues that involve you.

1. Sign in at https://github.com and open https://github.com/settings/personal-access-tokens/new (or **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**).
2. **Token name:** `rnldvrgl HQ`. **Expiration:** 90 days or longer (you'll set a calendar reminder to rotate it).
3. **Resource owner:** your account (`rnldvrgl`). **Repository access:** **All repositories**, or **Only select repositories** if you'd rather limit it.
4. Under **Permissions → Repository permissions**, set **Issues: Read-only** and **Pull requests: Read-only**. (**Metadata: Read-only** is added automatically.) Leave everything else at **No access**.
5. Click **Generate token** and copy it (it starts with `github_pat_`). GitHub shows it only once.
6. In `.env.local`: `GITHUB_TOKEN=` the token, and `GITHUB_USERNAME=rnldvrgl` (your GitHub username, used to find work that involves you).
7. Restart `npm run dev`, open Dex's desk and press **Run now**. On Vercel, add both values and redeploy.

If Dex says `GitHub 401`, the token expired or was pasted wrong; generate a new one. `GitHub 422` usually means `GITHUB_USERNAME` is misspelled.

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
4. Running employees can take a few minutes (web research), so the routes that run them ask for up to 300 s (`maxDuration = 300` in `app/api/tick` and `app/api/employees/[id]`). That's the Hobby plan's limit with Fluid Compute (on by default for new projects). If a deploy complains about it, turn on **Settings → Functions → Fluid Compute**.
5. Add the Google and GitHub keys from steps 5 and 6 (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GITHUB_TOKEN`, `GITHUB_USERNAME`) to the Vercel environment variables too. The same refresh token works locally and live.
6. After your first sign-in, turn off **Authentication → Providers → Email → Allow new users to sign up** so nobody else can create an account.

### 9. Start the office clock

1. Supabase → **Database → Extensions**: enable `pg_cron` and `pg_net`.
2. In the SQL Editor, run the commented `cron.schedule(...)` block at the bottom of `schema.sql` with your Vercel URL and `CRON_SECRET` filled in.
3. Check it under **Integrations → Cron**. Within 5 minutes Ring's desk should show a recent check.

Why Supabase and not Vercel Cron: Vercel's free plan only runs a cron once a day, and reminders need to fire every few minutes.

### 10. Tune your team

- **Your name, the city, employee names, default look and colour style:** `hq.config.ts` (see "Make a copy for someone else")
- **Desks, hours:** `lib/team.ts`
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

The 3D office is in Mabalacat City, Pampanga and follows Philippine time, so every screen shows the same moment:

| When | What happens |
|---|---|
| 6 AM–11:30 AM | Morning light: a warm sunrise in the windows, then bright day. |
| 7:00 AM | Everyone walks in from the street and sits down. |
| 7–8 AM, 12–1 PM, 6–7 PM | The janitor mops the aisles (wet-floor sign out). |
| 9:00 AM (weekdays) | Stand-up: anyone who isn't busy gathers in the circle at the front, Ronald leads, and Maya's morning brief pops up on the screen. |
| 11:50 AM | A delivery rider pulls up at the kerb on a scooter and walks lunch up the covered walkway to the door. |
| 12:00–12:55 PM | Lunch: anyone who isn't busy eats at the dining table by the pantry. |
| 2:00–2:15 PM (weekdays) | Team sync: anyone who isn't busy sits around the table in the glass meeting room. |
| 1 PM–6 PM | Afternoon: golden light, sunset from about 5:20 PM. |
| All day | Anyone idle hangs out in the roofed vape gazebo at the back of the lot; when work comes in they walk back to their desk. Anyone showing an error goes to Ronald's office and waits on the sofa for help. |
| 5:30 PM | Everyone empties their desk bin into the main bin by the entrance. |
| 5:40 PM | Today's trash duty takes the main bin's bag out to the dumpster outside. The team takes turns, one per day. |
| 7 PM | Idle employees walk home, each to their own house on the street behind the office (out to the sidewalk, up the side street, in at their gate); they walk back in the morning. Anyone working, waiting for you or showing an error stays at their desk. The boss walks out to the car at 8 PM and drives home to the big house behind the office (backing out of the carport, down the main road, up the side street, into the garage), and drives back in at 8 AM. All four times are in Settings → Daily routine → Office hours. |
| Night | City lights in the windows, office lights on, screens off on empty desks, the fairy lights along the walls glowing. |
| 5–9 AM | With the sound on, the pandesal vendor goes by now and then: two honks of the bulb horn and "Pandesal! Mainit pa!" |
| Sept 16 – Jan 6 | Christmas season: parols at every gate and shop, Christmas lights on the fences and awnings, a tree in the lounge. Fireworks over the town from 11:30 PM on New Year's Eve. |
| Other holidays | Chinese New Year (red lanterns, fireworks at night), Valentine's Day (hearts at every gate, heart garlands across the street, heart balloons out front, a lit heart frame in the park), Holy Week (the penitensya: hooded penitents with bamboo whips and wooden crosses behind the carroza of the Santo Entierro, devotees with candles, cars crawling behind the procession in the far lane; a pabasa tent by the barangay hall; purple bunting and candles), the May fiesta (banderitas across the street), Independence Day (flags May 28 – June 30, fireworks on the 12th) and Undas (jack-o'-lanterns and candles). The list, with each one's next date and a **Preview** button, is in Settings → Holidays; dates are in `lib/holidays.ts`. |
| Through the day | Ronald gets up now and then (every half hour from 9:30 AM to 4:30 PM, and at random), walks the floor and looks over people's shoulders, sometimes via the coffee machine. When someone finishes a report, a sheet of paper flies to his in-tray. |

The office has a cozy wing on its left, **the Den**, open through a bookcase divider: library walls with a rolling ladder, a fireplace, an L-shaped sofa on a big rug, globe pendants, a reading nook, a hanging egg chair, bean bags round a board game and a hammock. The boss's car is one of six (Settings → Boss → Car): hot hatch, pink mini, SUV, pickup, sports coupé or electric; "Match the boss" picks the Type R for him and the mini for her.

Around the office is a small Filipino town. Along the street: shophouses with the family's home upstairs (a panaderia, carinderia, labada, kapihan and hardware), a sari-sari store, and Jollibee, McDonald's, Mercury Drug, 7-Eleven and, past the hardware, a Starbucks with its terrace. Behind the office, two side streets lead to two residential streets lined with houses (every employee has one, painted in their colour with a floating name badge saying whether they're home, Settings → Show → House name badges; Ronald's is the big modern two-storey with a garage right behind the office): hollow-block walls, GI roofs, window grills, gated fences, carports with tricycles, water tanks, clotheslines, power lines, a basketball hoop, and roosters and hens by the road that crow at dawn (you hear it with the office sound on). Across the street: a Shell and a Petron station, the TODA tricycle terminal, the barangay court, a parking lot, a park, the barangay hall (portico, balcony, red hip roof, a Barangay Health Station wing, a waiting shed) and Republic Central Colleges (classroom wings with open corridors, a covered court, the flagpole, its name over the gate), where students go in before class and come out at lunch and after class. Street lamps light every street, and white crossing lights with the blue pedestrian sign stand over both zebras. Jeepneys, tricycles, motorbikes and cars drive the streets with their lights on after dark and follow the **traffic lights** at both junctions: they stop on red, stop on amber when they can, queue behind each other and pull away on green. **People walk the sidewalks** (students in uniform at the school rush, office workers, joggers at dawn, neighbours on errands), keep to the right, cross the main road only at the zebra on the walk signal, and open umbrellas in the rain. How many is up to you (Settings → Performance → People walking outside; 0 turns them off). and pandesal vendors are out on the sidewalks from 5 AM to 7 PM. At night the 24-hour places, gas stations, court and signs stay lit, shops light up until 10 PM and homes in the evening. The ground and streets reach far past the town, so zooming out never shows an edge. **Tap any building** (a shop, a gas station, a house, the court) for a card with what it is, its hours and whether it's open; the sari-sari store's card can send the boss for a snack.

Outside the entrance, a polycarbonate carport covers the boss's parking bay, a second bay with the team's scooters and a bike, and the walkway to the street; the vape gazebo at the back of the lot has its own roof, a bench and a lamp. Rain stops at both roofs, so nobody gets wet. Inside, the team floor is warm and cozy: fairy lights along the walls, a polaroid wall of the team, macramé planters, a jute rug at the stand-up circle.

The big TV shows today's numbers, a 7-day chart of finished (and failed) runs, what each employee is doing right now, and what's playing on Spotify. **Tap the TV** for a big, readable copy of it in a TV frame, with each employee's latest summary (tap one to open their desk).

Tap the boss's car out front for its headlights, engine and lock. With the office sound on you hear it: the starter cranking, the engine catching and idling, the remote-lock chirps. The lunch rider's scooter pulls up and rides off at 11:50 AM, and now and then a jeepney honks down the street. When the team has finished reports every day for a week, a cake with seven candles appears on the dining table.

The windows look out over Mabalacat towards Mount Arayat, with its live weather (from Open-Meteo, no key needed, refreshed every 10 minutes): clear, partly cloudy, cloudy, rain or storm, decided from the last 15 minutes of measured rain and the cloud cover (the forecast's weather code alone is often wrong). Hover the weather pill to see the exact condition, e.g. "Partly cloudy, feels like 36°C". Rain falls wherever you're looking, with splashes and wet streets; storms add lightning. The ground stays wet and puddles linger for about 15 minutes after the rain stops. Strong wind (from the live gusts; the label says "Windy", "Gale-force winds" or "Typhoon winds") slants the rain and sways the trees. The ACs run 8 AM–7 PM on the floor and 7:30 AM–10:30 PM in the corner office.

Use the clock and weather buttons at the top left of the office to preview any of these. They keep ticking from there; **Back to live** returns to now. Change the times in `lib/office-clock.ts`.

**In the office's top-right corner:**

- **Sound:** mute / unmute the office ambience: room tone and the aircon, keyboards at the desks you zoom in on, birds by day, roosters at dawn, crickets at night, rain, storms and thunder, cars and jeepneys going by, the pandesal vendor's bulb horn, the boss's car and the lunch rider's scooter, and fireworks on fiesta nights. These are real recordings, all CC0 (sources in `public/sounds/CREDITS.md`), loaded the first time you turn the sound on.
- **Music:** Spotify (see "Spotify in the office").
- **Boss** (crown): send the boss on a vape break, a walk down the street, a snack run to the sari-sari store, a coffee, or a round of the office. **Back to the desk** ends it early.
- **Settings** (sliders), saved on this device:
  - **Appearance:** colour style (Ocean, Rosé, Sunset, Forest, Lavender or Graphite; the office's furnishings change with it), and light, dark or system.
  - **Performance:** presets (Full, Balanced, Battery saver), low-power rendering (no shadows, 1× resolution, 30 fps), **auto battery saver** (steps down by itself when the view keeps running under 25 fps, and says so) animation (Full or Minimal: no idle animation, traffic, smoke or rain particles, 12 fps) and how many people walk outside. The active preset is lit in its own colour: green for Full, blue for Balanced, amber for Battery saver.
  - **Show in the office:** turn off the neighbourhood, traffic, street vendors, trees, pets, weather effects, street lights, vape smoke or name bubbles on slower devices.
  - **Daily routine:** switch off the stand-up, team sync, lunch, binning trash, the trash run, the commute, the janitor, breaks when idle, or going to the boss for help. Off means they stay at their desks.
  - **Boss:** the look (him: street style; her: soft street style with long wavy hair and a skirt), the corner office's style (Match the boss, Executive, Gaming, Cozy, Minimal, Creator studio or Filipino heritage; "Match the boss" is executive for him and cozy for her), and whether the boss walks around on their own.
  - **Sound:** office music through the speakers and subwoofer under the big TV during office hours (8 AM – 7 PM), in one of six styles, all generated live (no audio files): Cozy lo-fi, Café jazz, Bossa nova, Calm piano, Night drive (synthwave) and 8-bit arcade. Pick one here or under **Music → Office radio**. It only plays when the office sound is on (and pauses while Spotify plays); the woofer cone pumps on the kick. **Who-needs-you chimes:** each employee has their own three-note tune (on a music-box note) that plays the moment they start needing you. **Volume:** a slider for each kind of sound (office radio, office hum, keyboards, rain & thunder, street & nature, fireworks, alerts) and one for all of it, 0–150 %; tap a channel's speaker icon to mute just that. The same sliders are under **Music → Office sound volumes**.
  - **Holidays:** every holiday the town decorates for, when it is next, and a **Preview** of its look right now (at its best hour; the chip over the office ends it).
  - **Account:** add or remove passkeys for this device, and **Sign out**.

**Moving around:** drag to pan, pinch or scroll to zoom. To turn the view, right-drag with a mouse or drag with two fingers on a phone, or tap the **Turn** button (bottom right, above Reset view), which swings the view across its range in steps.

The lightning button at the bottom right is a shortcut for low-power rendering.

## Make a copy for someone else

HQ is built to be cloned for another person (a different boss, team names, city and accounts):

1. Fork or copy the repo, then edit **`hq.config.ts`**:
   - `owner.name`: their first name (used in the app and in the AI prompts, e.g. "sign as …").
   - `owner.handle`: the short name on the office sign and the header.
   - `owner.look`: `"him"` or `"her"`.
   - `owner.office`: the corner office's default style, `"auto"`, `"executive"`, `"gaming"`, `"cozy"`, `"minimal"`, `"studio"` or `"heritage"`.
   - `appName` / `shortName`.
   - `style`: `"ocean"`, `"rose"`, `"sunset"`, `"forest"`, `"lavender"` or `"graphite"`.
   - `login`: the sign-in page's `tagline` (under "Good morning, …"), and its `backdrop`: `"street"` (the office's street at this hour in their city) or `"aurora"` (soft colour fields in the colour style); and `askAgain`, when to ask for the sign-in again after HQ is closed: `"phones"` (the default: phones and tablets; each time you open the app or a new tab you sign in again, handy with a passkey), `"always"` (every device) or `"never"` (stay signed in for weeks). The greeting, the app name, the city, the team and the colours on the sign-in page all come from this file too.
   - `city`: the name, clock label and latitude / longitude for the weather.
   - `town`: `barangay` (the name on the barangay hall) and `realBrands`. Set `realBrands` to `false` for a copy you publish: the signs then show made-up names instead of Jollibee, McDonald's, Shell, Petron, 7-Eleven, Mercury Drug and Starbucks, whose names are their owners' trademarks.
   - `car`: the plate and badge.
   - `teamNames`: rename any employee, e.g. `{ "chief-of-staff": "Bea", "researcher": "Nico" }`.
   - `janitorName`.
2. Replace `data/master-profile.json` with their CV and job criteria.
3. Give them their own accounts: a new Supabase project (step 2), their own AI keys (step 3), Resend with their email (step 4), their Google and GitHub keys (steps 5 and 6), and a new Vercel project (step 8) with all of those as environment variables. Nothing is shared between copies.
4. The office runs on Philippine time. Another time zone needs `MANILA_OFFSET_MS` in `lib/time.ts` and `Asia/Manila` in the clock formatting and the weather URL changed.

## Friends: an HQ each (invite-only)

One deployment hosts many HQs: yours (the founder HQ) and one per friend you invite. Each HQ has its own office, team, reminders, jobs, names and settings, and its own keys and connections. Nobody can see another HQ's data, and friends never touch your keys, mail or calendar.

**Set up once:**
1. Back up your database: `npm run db:backup` saves every table as JSON under `~/hq-backups/<date-time>` (through Supabase's API with your `.env.local` keys; no database password, Docker or pg_dump needed, and it works on the free plan, which has no downloadable backups). `npm run db:restore -- ~/hq-backups/<folder>` puts it back (rows from before this migration are given your HQ). Then run `supabase/multi-hq.sql` in the SQL Editor (after `schema.sql`). It adds an `hq_id` to every table and moves all your existing rows into your HQ. It's safe to re-run. **Deploy the new code only after running it**: the app now filters every query by HQ.
2. Add `HQ_SECRET_KEY` to `.env.local` and Vercel: any long random string (`openssl rand -base64 32`). It encrypts each HQ's keys in the `hq_secrets` table. Keep it safe: if it changes, saved keys can't be read and have to be added again.
3. In Google Cloud (the OAuth client from the Google steps above), add `https://YOUR-APP.vercel.app/api/connect/google/callback` (and `http://localhost:3000/api/connect/google/callback`) under **Authorized redirect URIs**. While the app is in Testing, add each friend's Google account under **Audience → Test users** (up to 100).
4. Email: Resend only delivers to addresses other than yours once you've verified a domain (Resend → Domains) and set `EMAIL_FROM` to it. Until then, friends' reminder and brief emails won't arrive (everything in the office still works).

**Inviting:** Settings → Friends → **Make link** (optionally for one email). Only your HQ can make invite links for now. The link works once, for 7 days. Your friend opens it, enters their email, gets their HQ, and signs in with a 6-digit code sent to that email. Public sign-up stays off: accounts only come from invites.

**Hiring in a friend's HQ:** employees start work once their HQ has connected what they need (Settings → Connections). Until then their desk shows **Not hired yet**, with what's missing.

| Employee | Needs |
|---|---|
| Chief of Staff, Inbox Triage | Claude (or the free AI allowed to read private data) + Google |
| Scheduler | an AI key + Google |
| Dev Assistant | Claude (or the free AI allowed to read private data) + GitHub |
| Job Hunter | an AI key + **About you** (their CV) |
| Researcher, Weekly Reviewer | an AI key |
| Reminder Bot | nothing |

Any one AI key is enough for most desks. The desks that read private data (mail, calendar, private repos) need Claude, or the HQ's own permission for the free AI to read it (a switch in Connections). **About you** is each friend's CV, filled in under Connections: the Job Hunter and cover letters use it, never yours (yours stays `data/master-profile.json`). Gemini (Google AI Studio) and Groq have free tiers, so a friend's HQ costs you nothing. Keys are stored encrypted; Settings only ever shows their last 4 characters. Your HQ keeps using your environment variables, and anything you save in Connections takes precedence over them.

**The 5-minute tick** calls itself once per HQ, in parallel, so every HQ's work gets its own function and time limit. If you create one of the optional tables later (push notifications, Spotify, names), run `supabase/multi-hq.sql` again afterwards to give it its `hq_id`.

## Spotify in the office

The **Music** button (top-right of the office, under the sound button) is a Spotify remote: see what's playing on any of your devices (song, artist, cover, progress), pause or skip, change the volume, start one of your playlists, **choose where it plays** (this HQ tab, your phone, a speaker or TV with Spotify Connect, like the Spotify app's device picker; tap **Playing on … → Device**), or read the **lyrics**, which scroll along with the song. While Spotify plays, the office speakers' woofers pump along and HQ's own office radio goes quiet.

A small **now-playing card** floats in the bottom-left corner of the office. It grows for a few seconds whenever the song changes, so you can see what just came on, then shrinks back to the cover and title. Tap it to keep it open, with controls and the line being sung right now.

1. Create an app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard). Tick **Web API** and **Web Playback SDK**.
2. Add the redirect URIs `http://localhost:3000/spotify/callback` and `https://<your-app>.vercel.app/spotify/callback`.
3. Run the `spotify_auth` block at the end of `supabase/schema.sql` in Supabase → SQL Editor (once).
4. Put its Client ID in `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` (`.env.local` and Vercel), redeploy, then press **Music → Connect Spotify** on any one device.

Notes:
- **Connect once, every device has it.** The sign-in (PKCE, no client secret) is kept on the server in the `spotify_auth` table, and each signed-in device gets short-lived access tokens from `/api/spotify`. A device that was connected before this keeps working: its old browser sign-in is moved to the server the first time it loads. **Disconnect Spotify on all devices** removes it everywhere.
- Playback control is a Spotify **Premium** feature. With Premium, each device's HQ tab also shows up as a Spotify device ("<app name> · iPhone", "· Mac", …), so music can play from the office itself. On Spotify Free you can still see what's playing.
- Lyrics come from [LRCLIB](https://lrclib.net), a free, open lyrics database (Spotify's API has no lyrics). Most songs have lyrics timed to the music; some only have plain text, and a few have none.
- While your Spotify app is in development mode, only the accounts you add under the app's **User Management** can connect.
- Spotify doesn't share a song's beat with new apps, so the woofers pulse at a steady ~100 BPM rather than the song's own tempo.

## Push notifications on your iPhone

When an employee needs you (or hits an error), HQ can ping your phone like any app. It uses Web Push, which works on iPhone (iOS 16.4 or later) **only in HQ installed on the Home Screen**, and in desktop Chrome, Edge, Firefox and Safari.

1. **Make the keys** (once):
   ```bash
   npx web-push generate-vapid-keys
   ```
2. **Add them** to `.env.local` and to Vercel → Settings → Environment Variables, then redeploy:
   ```
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=<Public Key>
   VAPID_PRIVATE_KEY=<Private Key>
   VAPID_SUBJECT=mailto:you@example.com
   ```
3. **Create the table**: in Supabase → SQL Editor, run the `-- Push notifications` block at the end of `supabase/schema.sql` (safe to run again).
4. **On your iPhone**:
   - Open your HQ URL in Safari → Share → **Add to Home Screen** (if you haven't already).
   - Open HQ **from the Home Screen icon**. Push doesn't work in a Safari tab.
   - Go to the Team tab and tap **Enable** under Notifications, then **Allow**.
   - Tap **Test** to check that one arrives.
5. Do the same on any other device you want pinged. Each device is subscribed separately; **Turn off** removes just that one.

You'll get one notification per desk (a newer one replaces the older), and tapping it opens HQ. If notifications stop arriving, turn them off and on again; devices the push service reports as gone are removed automatically.

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
| Maya, Iggy or Cal say "Google token refresh failed (400)" | The refresh token expired (every 7 days while the Google app is in Testing) or doesn't match the client. Get a new one (step 5, Part E), or publish the app ("About the 7-day limit"). |
| Google says `redirect_uri_mismatch` | The client's redirect URI (step 13) must be exactly `https://developers.google.com/oauthplayground`, and the gear panel must use that same client. |
| Google says "Access blocked: app has not completed verification" | Your Gmail isn't on the test user list. Redo step 9. |
| Dex says `GitHub 401` or `422` | The token expired or was pasted wrong (401), or `GITHUB_USERNAME` is misspelled (422). See step 6. |
| The Playground shows no refresh token | Check "Access type: Offline" in the gear panel. Then remove rnldvrgl HQ at myaccount.google.com/permissions and authorize again. |
| No emails arrive | With `onboarding@resend.dev`, `EMAIL_TO` must be your Resend sign-up email. |
| Nobody runs on schedule | Check Supabase → Integrations → Cron for failed runs; the URL or secret is usually wrong. |
| Office shows the flat SVG, not 3D | The browser has WebGL turned off or unsupported. Enable hardware acceleration. |
| `Cannot find module '@/components/ui/…'` | Run `npm run ui`. |
| Maya, Iggy or Dex say "Waiting for your Claude key" | Expected on the Gemini backup. Add `ANTHROPIC_API_KEY` and redeploy. |
| `Gemini free tier limit reached` / `Groq free tier limit reached` | Add the other backup (step 3a) so calls move over, wait for the reset, or add the Claude key. |
| Desk stuck on "working" | A run stops itself after 4 minutes and becomes an error, so the employee goes to the boss's office for help. A run that was cut off mid-way (redeploy, function time limit) is marked as an error about 5½ minutes after it started, the next time the office loads. Then check Vercel → Logs, and **Run now** to retry. |
| Every desk errors with "Every free backup is at its limit" | The free AI quotas are used up for the day. The employees wait in the boss's office; add the other backup or the Claude key, or wait for the reset. |
