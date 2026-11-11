# Catalyst 1.0 · Demo Day: investor interest app

Mobile-first web app for **Catalyst 1.0 Demo Day (16 Nov)**, hosted by **RTIH Visakhapatnam** in association with
**RTIH Anantapuramu** and **RTIH Tirupati**: 21 startups pitching to 20+ VC funds.
It works on phones, tablets and laptops, and is hosted free on GitHub Pages.

- **Investors** open one event link, enter name / fund / contact once, then tap **Request pitch deck**, **Request a
  meeting today** or **Request a meeting after the event** on any startup. Every tap saves instantly and can be withdrawn.
- **Live VC board** shows which funds expressed interest in each startup, updating in real time, with a clear
  "expressions of interest only, not an investment decision or commitment" disclaimer.
- **RTIH organisers** get a separate, sign-in-protected dashboard: a real-time request feed, pitch queue control
  (reorder, *Now pitching*, *Next*), approve meetings with room and time, share decks, and **explicitly notify** the
  one investor concerned. Nothing is ever sent to founders automatically. There are no ratings, scores or rejection options.

## Two modes

| | Demo mode | Live mode (use this for the event) |
|---|---|---|
| Setup | none | ~15 min, free Supabase project |
| Data | this browser only (syncs across tabs) | one shared database for every phone |
| Real time | across tabs on one device | across all devices |
| Organiser login | passcode `catalyst` | email + password, allow-listed |

The app runs in demo mode until the two Supabase variables below are set. Demo mode ships with **fictional sample
startups and funds** so you can try every screen.

## Go-live checklist (live mode)

1. **Create a Supabase project** at <https://supabase.com> (free tier; pick the *Mumbai* region).
2. **Create the database:** *SQL Editor → New query*, paste all of [`supabase/schema.sql`](supabase/schema.sql), then **Run**.
   It is safe to re-run.
3. **Turn on investor sign-in:** *Authentication → Sign In / Providers →* enable **Allow anonymous sign-ins**.
   (Investors never see a login; this gives each device a private session.)
   **Then raise the rate limit:** *Authentication → Rate Limits →* set *anonymous sign-ins per hour* to at least
   **500**. The default is 30 per hour **per IP address**, and every phone on the venue Wi-Fi shares one IP.
4. **Add organisers:** for each RTIH team member:
   - *Authentication → Users → Add user → Create new user*, enter email + password, tick **Auto Confirm User**.
   - *SQL Editor:* `insert into public.organisers (email, name) values ('name@rtih.in', 'Name');`
5. **Connect the site:** *Project Settings → API*, copy the **Project URL** and the **anon public** key. Then in this
   GitHub repo, open *Settings → Secrets and variables → Actions → **Variables***, add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`, and re-run *Actions → Deploy to GitHub Pages → Run workflow*. Or from a terminal:
   ```sh
   gh variable set VITE_SUPABASE_URL --body "https://xxxx.supabase.co"
   gh variable set VITE_SUPABASE_ANON_KEY --body "eyJ..."
   gh workflow run "Deploy to GitHub Pages"
   ```
   The demo-mode banner disappears once live.
6. **Load the startups:** open `…/#/organiser` → **Pitch queue → Import list**. Paste the shared startup sheet
   (copy cells from Google Sheets/Excel, including the header row). Columns are matched by name; download the
   **Template** for the full list. Put each startup's deck link in the `deck_url` column; it stays private to organisers.
7. **Settings:** check event details, the **meeting rooms** list and the **participating funds** list (suggested to
   investors so names match on the live board).
8. **Print the event QR code:** *Settings → Show / download QR code*. One code for the whole event.
9. **Dry run:** register as an investor on your phone, request something, and approve and notify it from a laptop.
   Free Supabase projects pause after a week without activity, so open the site the day before the event, and
   delete your test investor afterwards (*Investors → Remove*).

## Event-day flow

1. Investor scans the event QR → enters details once → sees all startups in pitch order, with *Now pitching* pinned on top.
2. Taps actions. Each shows a "request received" confirmation and goes straight to the organiser feed.
3. Organiser (**Requests** page) sees investor, fund, startup and action in real time →
   **Approve…** (pick room + time) or **Share deck…** (deck link pre-filled) → **Approve & notify investor**
   (or save first and notify later).
4. Only that investor sees the room/time or deck link under **My requests**, with a live alert. Optional **Email** /
   **WhatsApp** buttons open a pre-written message if you also want to send it through another channel.
5. **Pitch queue → Next startup** advances the *Now pitching* banner on every investor's phone.
6. **Overview** shows the totals, and **Live board (projector)** gives a full-screen board for the hall.
7. Export CSVs any time from Requests, Meetings and Investors.

## Privacy (enforced in the database)

Row-level security in [`supabase/schema.sql`](supabase/schema.sql) enforces this, not just the UI:

- Investor contact details: organisers and that investor only.
- Individual requests: organisers and that investor only.
- Room, time, deck links: organisers only, and the one investor once an organiser sends the notice.
- Live board: fund name per startup only, visible to registered investors and organisers.
- Startup contacts and deck links: organisers only.
- Organiser access: confirmed email on the `organisers` allow-list.

**Personal links** (shown under *My requests → Use another device*, and per investor on the organiser
*Investors* page) let an investor continue on another device without retyping. Anyone holding the link can act as
that investor, so share it privately.

## Decisions from the requirements doc, and what the app supports

| Decision | Supported options | Default |
|---|---|---|
| How approved-meeting notifications reach investors | In-site alert (real time) + optional pre-filled email / WhatsApp, organiser-triggered | In-site |
| Which organisers get access, how they sign in | Email + password, allow-list table | Add emails in Supabase |
| Shared link vs individual links | One shared link with identify-once **and** optional personal links | Shared link |
| Meeting rooms | Fixed list in Settings, with optional free-text "Other" | Both on |
| One-pagers and decks | One-pager fields (+ optional public PDF link) per startup; decks are private links released per approved request | Import via CSV |

Automatic emails would need an email service (e.g. Resend) and a server function. They are not included, because
the requirements leave notification control with organisers.

## Development

```sh
npm install
npm run dev          # http://localhost:5173  (demo mode)
cp .env.example .env # add Supabase URL + anon key for live mode
npm run build        # type-check + production build into dist/
```

Stack: React 18, TypeScript, Vite, Tailwind CSS, Supabase (Postgres, anonymous + password auth, realtime).
Routing uses hash URLs (`/#/startups`), so GitHub Pages needs no server configuration.

Theme: black background, poster pink, Silkscreen pixel type, sparkles, circuit texture and the Vizag lighthouse,
matching the Catalyst 1.0 poster. Logos live in `public/brand/` (the RTIH logos were lifted from the poster at about
340 px wide; drop in higher-resolution transparent PNGs with the same file names to sharpen them). The colour scales in `tailwind.config.js` are inverted for the dark theme (see the
note at the top of that file).
