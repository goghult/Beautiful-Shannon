# Deployment guide

This document describes how to deploy the FinFlow frontend to Vercel and the recurring edge function to Supabase using GitHub Actions.

## Prerequisites
- A GitHub repository with this project pushed
- A Vercel account (free tier)
- A Supabase project (free tier)
- GitHub repository secrets set (see below)

## GitHub repository secrets
Add these secrets in GitHub > Settings > Secrets & variables > Actions:

- `VERCEL_TOKEN` — Personal token from Vercel (optional if you prefer Vercel's Git integration)
- `SUPABASE_ACCESS_TOKEN` — Supabase CLI access token (optional; used for automatic function deploys)
- `SUPABASE_PROJECT_REF` — Your Supabase project ref (project id)

## Vercel
1. In Vercel, create a new project and connect your GitHub repo.
2. Set these Environment Variables in Vercel (Project Settings):
   - `VITE_SUPABASE_URL` = `https://your-project-ref.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `your-anon-key`
3. Build settings (if not auto-detected):
   - Framework: `Vite`
   - Install: `npm install`
   - Build: `npm run build`
   - Output Directory: `dist`

Vercel will deploy automatically on pushes to `main` by default.

## Supabase Edge Function (generate-recurring)
1. Install Supabase CLI locally and log in:

```bash
npm i -g supabase
supabase login
```

2. Deploy the function manually:

```bash
npx supabase functions deploy generate-recurring --project-ref your_project_ref
```

3. Set the service role key (in Supabase settings) as a secret named `SUPABASE_SERVICE_ROLE_KEY` if you plan to call the function server-to-server.

## Using the GitHub Actions workflow
A workflow was added at `.github/workflows/deploy.yml`. It will:
- install and build the app
- deploy to Vercel using `VERCEL_TOKEN` (if provided)
- deploy the Supabase function using `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` (if provided)

To trigger a deploy manually, push to `main` or use the `Run workflow` button in the Actions tab.

## Local demo mode
If you don't want to configure Supabase, run locally and use "Try Local Demo Mode" from the Auth screen to test without a backend.

---

If you'd like, I can also:
- create a `netlify.toml` instead of `vercel.json`
- add a README badge showing deployment status
- prepare a one-click deploy button for Vercel

Tell me which next step you prefer.
