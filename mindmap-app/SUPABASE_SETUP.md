# Online accounts + cloud save — Supabase setup

This app can save each user's mind map online (real email + password login,
with email confirmation) using [Supabase](https://supabase.com) — a free,
open-source backend (no Firebase). Without this setup, the app still works
fine locally (saved in the browser's localStorage) — it just won't sync
across devices or log anyone in.

## 1. Create a free Supabase project

1. Go to https://supabase.com → sign up → **New Project**.
2. Pick any name/region, set a database password (you won't need it again;
   Supabase manages this for you), and wait ~2 minutes for it to spin up.

## 2. Keep email confirmation on (recommended)

People sign up with their **real email + password**, so Supabase should send
them a confirmation link before they can log in — this is the default:

1. In your project: **Authentication → Providers → Email**.
2. Make sure **"Confirm email"** is **ON** (it is by default — no change
   needed unless someone turned it off).

That's it for a quick start — Supabase's built-in email sender works out of
the box for testing, but it's rate-limited and emails can land in spam. For a
real launch, set up a custom SMTP provider so confirmation/reset emails are
reliable:

1. **Project Settings → Auth → SMTP Settings**.
2. Enable **Custom SMTP** and enter the credentials from any provider (e.g.
   Resend, Postmark, SendGrid, Amazon SES — most have a free tier).
3. Save, then send yourself a test signup to confirm it arrives.

You can also customize the confirmation email's subject/body under
**Authentication → Email Templates → Confirm signup**.

## 3. Create the `maps` table

Go to **SQL Editor** in your Supabase project, paste this in, and run it:

```sql
create table public.maps (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nodes jsonb not null default '[]',
  edges jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

alter table public.maps enable row level security;

create policy "Users can view own map"
  on public.maps for select
  using (auth.uid() = user_id);

create policy "Users can insert own map"
  on public.maps for insert
  with check (auth.uid() = user_id);

create policy "Users can update own map"
  on public.maps for update
  using (auth.uid() = user_id);
```

This gives every signed-up user exactly one row for their map, and Row Level
Security makes sure nobody can read or write anyone else's row — even though
the same public API key is shared by the whole app.

## 4. Get your API keys

**Project Settings → API**. You need two values:
- **Project URL** (looks like `https://xxxxx.supabase.co`)
- **anon public** key (a long JWT-looking string — this one is *meant* to be
  public, it's safe to ship in the frontend; the row-level-security policies
  above are what actually keep data private)

## 5. Add the keys to the app

**Local development:** copy `.env.example` to `.env` in the project root and
fill in the two values:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

**Vercel (production):** Project → **Settings → Environment Variables** →
add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with the same values,
then redeploy (or just push — it'll pick them up on the next build).

## That's it

Once the keys are set, the **account icon** in the top-right of the toolbar
lets people sign up with **name + email + password**. After signing up they
see a "check your inbox" screen, click the confirmation link Supabase
emailed them, then come back and log in with their email + password. Their
map auto-saves to Supabase a second or two after every edit, and loads back
automatically the next time they log in on any device/browser.

If the keys are missing, the app doesn't break — the account button just
shows a note that cloud save isn't connected yet, and everything keeps
working locally.
