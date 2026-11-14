# Lead Desk — telecaller CRM

A free web app where the caller works through the UAE lead list, logs every call, books meetings and tags the manager or developer on questions. The manager watches progress on a live dashboard. It tracks activity, not hours.

**Stack (all free):** React + Vite · Supabase (database, logins, live updates) · Vercel or Netlify (hosting) · Google Calendar links for meeting invites.

---

## What's inside

| Page | Who uses it | What it does |
|---|---|---|
| **Dashboard** | Manager | Calls today vs. daily target, connected / interested / meetings booked / meetings done (today, 7 or 30 days, per person), calls-per-day chart, call outcomes, pipeline, list coverage per category, follow-ups due, upcoming meetings, live activity feed |
| **Calling** | Caller | One lead at a time: Call / WhatsApp / Email buttons → pick outcome (keys **1–8**) → note + follow-up → next lead. Three queues: *Follow-ups due*, *Retry no-answers* (next day, up to 4 tries), *New leads*. Filter by category, emirate or mobile only |
| **Leads** | Everyone | Search (company, phone, email, contact), filter by category tab, status, emirate, has mobile/email, starred or follow-up due. Export CSV |
| **Lead panel** | Everyone | Contacts, status, follow-up, contact person, notes, full history, meetings, company info |
| **Calendar** | Everyone | Month view of meetings (purple/green), follow-up calls (orange, red if overdue) and calls logged per day. Click a day for its agenda; each meeting has an "Add to Google Calendar" link |
| **Meetings** | Caller + Manager | Upcoming / needs outcome / past. Mark Done, No-show, Rescheduled or Cancelled with notes. Re-send invites |
| **Updates (on every lead)** | Everyone | monday.com-style thread per lead. Type `@` (or click a name chip) to tag a teammate; calls, status changes and meetings appear in the same thread |
| **Inbox** | Everyone | Everything you were @tagged on. Reply (goes back into the lead's thread and tags the sender) or mark done. Orange badge in the menu |
| **Import** | Manager | Upload any .xlsx. Each tab becomes a category. Duplicates are skipped. Rank/score columns are ignored |
| **Team & settings** | Manager | Names and roles, daily call target, emails always invited to meetings, WhatsApp/email templates |

**Statuses:** New → No answer → Call back → Interested → Meeting scheduled → Meeting done → Proposal sent → Won, plus Not interested / Wrong number (these leave the queue).

**Meeting invites (free):** after booking, **Send Google Calendar invite** opens the caller's Google Calendar pre-filled with time, client email, the manager's email (from settings) and lead details. The caller clicks **Save → Send** and Google emails the invite. A Google Meet link is one click there. An `.ics` file is also available for Outlook.

---

## 1. Try it locally (demo mode, no setup)

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173. With no Supabase keys the app runs in **demo mode**: data stays in this browser, and you pick Manager / Caller / Developer to try each view. Load leads on the Import page by uploading `uae_leads_combined.xlsx`.

(Developer shortcut: `npm run demo-data -- "path/to/uae_leads_combined.xlsx"` creates `public/demo/leads.json` so the Import page can load it with one click. That folder is git-ignored and stripped from builds.)

---

## 2. Go live for the team (about 15 minutes, free)

### a) Supabase (database + logins)
1. Create a free account at https://supabase.com → **New project** (region: closest to UAE, e.g. *Mumbai* or *Frankfurt*).
2. **SQL Editor → New query** → paste all of [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
3. **Authentication → Sign In / Providers → Email**: turn **off** "Allow new users to sign up", so only people you add can log in.
4. **Authentication → Users → Add user → Create new user** for each person (manager, caller, developer). Use their email and a password and tick **Auto Confirm**.
5. Make yourself manager: in **SQL Editor** run
   ```sql
   update profiles set role = 'admin', name = 'Your Name' where email = 'you@yourcompany.com';
   update profiles set role = 'dev', name = 'Developer Name' where email = 'dev@yourcompany.com';
   ```
   (Everyone else defaults to *Caller*. Names and roles can also be changed later in **Team & settings**.)
6. **Project Settings → API**: copy the **Project URL** and the **anon public** key.

### b) Code on GitHub
Create a **private** GitHub repository and push this folder. `.gitignore` already excludes `.env`, `node_modules`, `*.xlsx` and demo data, so lead data is never committed.

### c) Hosting on Vercel (or Netlify)
1. https://vercel.com → sign in with GitHub → **Add New → Project** → pick the repo. Vercel detects Vite automatically.
2. **Environment Variables**: add
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon public key
3. **Deploy**. You get a URL like `https://lead-desk-xyz.vercel.app`. Every `git push` redeploys.

(Netlify works the same way: build command `npm run build`, publish directory `dist`, same two variables.)

### d) First login
Log in as manager → the app opens the **Import** page → upload `uae_leads_combined.xlsx` → 3,887 leads in 3 categories. Then go to **Team & settings** and set the daily call target and your email under "Always invite to meetings".

---

## 3. The caller's email
The caller needs one email address to send meeting invites and follow-ups from:
- **Best:** a mailbox or alias on your company domain if your mail plan includes extra users or aliases.
- **Free:** a new Gmail account (e.g. `yourcompany.sales@gmail.com`). Google Calendar and Meet come with it.

The caller stays signed in to that Google account in the same browser as Lead Desk, so **Send Google Calendar invite** sends from it. Use the same address as their Lead Desk login.

---

## Notes
- **Free-tier limits:** Supabase free gives 500 MB database (this list uses about 5 MB) and pauses a project after 7 days with **no** activity. Daily calling keeps it awake. Vercel's free tier is more than enough.
- **Times** are stored in UTC and shown in each person's local time (Dubai for the caller).
- **Security:** only logged-in team members can read or write data (row-level security). Public sign-up is off. The anon key is safe to expose in the browser.
- **Backups:** Leads → Export CSV any time.

## Project layout
```
src/
  lib/constants.js     statuses, call outcomes, default settings
  lib/mapping.js       Excel → lead mapping (shared by importer & script)
  lib/db/              supabase.js (team mode) · local.js (demo mode)
  lib/store.jsx        app state + actions (logCall, scheduleMeeting, tag…)
  components/          lead panel, call/meeting/tag forms, charts
  pages/               Dashboard, Calling, Leads, Meetings, Inbox, Import, Settings
supabase/schema.sql    database tables, security, live updates
```
