# GroundWork CRM

Real estate lead pipeline CRM with a power dialer, tasks, KPI dashboard and timesheet.
Built with React, Vite and Tailwind CSS. Data lives in a shared Supabase database, so
every signed-in user sees the same leads, campaigns, call results and timesheet — updated
live for everyone.

## One-time Supabase setup

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. In the SQL editor, run `supabase/schema.sql` from this repo. This creates the
   `crm_state` table, locks it down with Row Level Security so only signed-in users can
   read/write it, and turns on Realtime so changes sync live across users.
3. In **Authentication -> Providers**, make sure **Email** is enabled.
4. In **Authentication -> Users**, click **Add user** to create an account for each of
   your teammates (email + password). There's no public sign-up screen — accounts are
   created here by whoever administers the workspace.
5. In **Project Settings -> API**, copy the **Project URL** and the **anon public** key.

## Configure the app

Copy `.env.example` to `.env` and fill in the two values from step 5:

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

## Run locally

**Prerequisites:** Node.js 20.19+ or 22.12+

```bash
npm install
npm run dev
```

You'll land on a login screen — sign in with one of the accounts you created in Supabase.

## Deploying (Vercel)

Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables in your
Vercel project settings (Project -> Settings -> Environment Variables), then redeploy.
Everyone who logs in, on any device, will see and edit the same shared data.

## Build

```bash
npm run build
```

Output goes to `dist/`.

## Notes

- All leads, campaigns, call-result counts, follow-up KPIs and timesheet punches are
  shared across every signed-in user in real time.
- Daily task completion state (checking off a task on the task board) is still kept
  per-browser only, same as before — it was never persisted across reloads even in the
  original localStorage version.
- To add or remove someone's access, add/remove them in Supabase under
  **Authentication -> Users**. No code changes needed.
