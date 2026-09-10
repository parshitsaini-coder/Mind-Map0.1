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

## 3b. Create the `trade_analysis` table (optional — Trade Analysis feature)

The Trade Analysis feature works entirely offline (localStorage) without
this — this table just adds the same cross-device cloud sync the mind map
gets above. Same idea, its own table:

```sql
create table public.trade_analysis (
  user_id uuid primary key references auth.users(id) on delete cascade,
  trades jsonb not null default '[]',
  validation_rules jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

alter table public.trade_analysis enable row level security;

create policy "Users can view own trade data"
  on public.trade_analysis for select
  using (auth.uid() = user_id);

create policy "Users can insert own trade data"
  on public.trade_analysis for insert
  with check (auth.uid() = user_id);

create policy "Users can update own trade data"
  on public.trade_analysis for update
  using (auth.uid() = user_id);
```

## 3c. Create the `live_shares` table (optional — Live share links)

The toolbar's Share button offers two kinds of link: **One-time** (the
existing behaviour — the whole map is encoded into the URL itself, works
without this table) and **Live** (a short link backed by this table — the
owner keeps editing, and anyone with the link sees the latest version on
their next refresh, until it expires or the owner ends it).

```sql
create table public.live_shares (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id text not null,
  nodes jsonb not null default '[]',
  edges jsonb not null default '[]',
  checklists jsonb not null default '[]',
  trades jsonb not null default '[]',
  validation_rules jsonb not null default '[]',
  expires_at timestamptz,
  ended_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, project_id)
);

alter table public.live_shares enable row level security;

create policy "Owner manages own live shares"
  on public.live_shares for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Visitors never get a direct SELECT policy on this table — that would let
-- anyone with the anon key list/dump every user's live shares. Instead they
-- read through this function, which only ever returns the one row whose id
-- they already have (and hides it once expired/ended).
create or replace function public.get_live_share(share_id text)
returns table (
  nodes jsonb, edges jsonb, checklists jsonb, trades jsonb,
  validation_rules jsonb, expires_at timestamptz, ended_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select nodes, edges, checklists, trades, validation_rules, expires_at, ended_at
  from public.live_shares
  where id = share_id;
$$;

grant execute on function public.get_live_share(text) to anon, authenticated;
```

Creating a live link requires being signed in (it needs somewhere to write
to), so the Live Link tab in the share modal prompts sign-in if needed. The
One-time tab keeps working for anyone with no login and no setup at all.

## 3d. Enable Google sign-in (optional — "Continue with Google" button)

The login panel's Google button calls Supabase's built-in Google OAuth
provider — no extra code needed, just flip it on:

1. **Authentication → Providers → Google** in the Supabase dashboard, toggle
   it on.
2. You'll need a Google OAuth Client ID + secret from the
   [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   (OAuth consent screen + "Web application" credentials). Supabase's
   provider page shows you the exact **Authorized redirect URI** to paste
   into the Google Cloud credentials — copy it from there.
3. Paste the Google Client ID and Client Secret into the Supabase provider
   settings and save.

Until this is turned on, clicking "Continue with Google" will show a
Supabase error toast (e.g. "provider is not enabled") — email/password
login and signup keep working either way.

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
automatically the next time they log in on any device/browser. If you also
created the `trade_analysis` table from step 3b, their trade log and
validation rules sync the same way.

If the keys are missing, the app doesn't break — the account button just
shows a note that cloud save isn't connected yet, and everything keeps
working locally.
