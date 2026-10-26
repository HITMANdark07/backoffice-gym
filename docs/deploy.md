# Deploying BackOffice Gym

The site runs on Vercel (Mumbai, `bom1`) with Postgres on Supabase (Mumbai, `ap-south-1`). Everything that holds a password is entered in a dashboard by the owner; nothing secret is committed.

**How a deploy happens.** A push to `main` runs the `ci` workflow. When it passes, the `deploy` workflow applies any new migrations to Supabase and then calls Vercel's deploy hook, so code never goes live before the tables it needs. Vercel's own git deploys are off for `main` (`apps/web/vercel.json`); pull requests still get preview deployments.

## 1. Supabase

1. Create a project in **South Asia (Mumbai)**. Save the database password in your password manager.
2. **Project Settings → Data API**: turn the Data API off (the site never uses it). If you keep it on, make sure `backoffice_gym` is not in "Exposed schemas". Row-level security is on for every table either way.
3. **Connect** (top bar) → **Connection string → URI**. You need two strings, each with your password filled in. Both must use the same `postgres.<ref>` user that Supabase shows: it owns the tables, and row-level security lets only the owner through.
   - **Session pooler** (port 5432): for migrations. Append `?sslmode=require`.
   - **Transaction pooler** (port 6543): for the site. Append `?sslmode=no-verify`. This only encrypts; step 4 adds certificate checking.
4. **Database → Settings → SSL Configuration → Download certificate**. Keep the file for the Vercel step.

## 2. GitHub

Repo **Settings → Secrets and variables → Actions → Secrets tab → New repository secret** (the Variables tab does not work for these):

| Name | Value |
|---|---|
| `SUPABASE_MIGRATION_URL` | the session pooler string |
| `VERCEL_DEPLOY_HOOK_URL` | the deploy hook URL from step 3.4 |

For a brand-new database, run **Actions → migrate → Run workflow** on `main` once before the first deploy.

## 3. Vercel

1. **Add New → Project → Import** `HITMANdark07/backoffice-gym`. Project name `backoffice-gym`. Vercel picks the address; this project got `backoffice-gym-eight.vercel.app` because `backoffice-gym.vercel.app` was taken.
2. **Root Directory**: `apps/web`. Leave "Include files outside the root directory" on. The framework and build command come from `apps/web/vercel.json`; Vercel installs with pnpm from the repo's lockfile.
3. **Settings → Environment Variables** (Production):

   | Name | Type | Value |
   |---|---|---|
   | `BACKOFFICE_GYM_DATABASE_URL` | Secret | the transaction pooler string |
   | `BACKOFFICE_GYM_DB_CA_CERT` | Secret | the whole downloaded certificate file, from `-----BEGIN CERTIFICATE-----` to `-----END CERTIFICATE-----` |
   | `CRON_SECRET` | Secret | any long random string; Vercel's cron sends it to `/api/cron/cleanup` |
   | `BACKOFFICE_GYM_DB_POOL_MAX` | Config | `3` |
   | `BACKOFFICE_GYM_RATE_LIMIT` | Config | `on` |
   | `NEXT_PUBLIC_SITE_URL` | Config | `https://backoffice-gym-eight.vercel.app` (a `NEXT_PUBLIC_` value is visible in the browser, so Vercel only allows Config) |
   | `ENABLE_EXPERIMENTAL_COREPACK` | Config | `1` (installs with the exact pnpm in `package.json`, 10.33.0) |

4. **Settings → Git → Deploy Hooks**: create a hook named `github` for branch `main`, and save its URL as the GitHub secret `VERCEL_DEPLOY_HOOK_URL`.
5. Deploy: **Actions → deploy → Run workflow** on `main`, or push to `main`. A production build without `NEXT_PUBLIC_SITE_URL` fails on purpose.

Changing an environment variable needs a new deploy to take effect: run the deploy workflow again, or **Deployments → ⋯ → Redeploy**.

## Upgrading a live deployment

For a deployment set up before the deploy workflow existed, in this order:

1. Vercel: add `CRON_SECRET` (Secret). Without it the daily cleanup is refused and logs `CRON_SECRET is not set`.
2. Vercel: create the deploy hook (step 3.4), and add it to GitHub as `VERCEL_DEPLOY_HOOK_URL`. Check that `SUPABASE_MIGRATION_URL` is on the Secrets tab too.
3. Push or merge to `main`, or run **Actions → deploy → Run workflow**. Vercel's Deployments page should show a new production build started by the hook. If it does not, Vercel is not building hook deploys with git deploys of `main` turned off: remove the `git` block from `apps/web/vercel.json` to go back to Vercel deploying on push.
4. Check `/api/health`, then add `BACKOFFICE_GYM_DB_CA_CERT` and redeploy. If `/api/health` then returns 503 with a certificate error in the logs, delete the variable and redeploy.

## 4. Check it

- `curl https://backoffice-gym-eight.vercel.app/api/health` returns `{"ok":true}` after a read-only database check, or 503 when the database is unreachable.
- The daily cron in `vercel.json` calls `/api/cron/cleanup` with `CRON_SECRET` to expire abandoned episodes and old rate-limit windows, which also keeps the free Supabase project from pausing. Any other caller gets 401.

## Troubleshooting

- **503 from the API**: the cause is in Vercel → **Logs**, as an `[api] … failed:` line.
- **`self-signed certificate in certificate chain`** or **`unable to verify the first certificate`**: `BACKOFFICE_GYM_DB_CA_CERT` doesn't match the certificate the database presents. Check that you pasted the whole file. To go back to encryption without verification, delete that variable and redeploy.
- **`prepared statement … already exists`** from the transaction pooler: switch `BACKOFFICE_GYM_DATABASE_URL` to the session pooler string with `?sslmode=no-verify` and set `BACKOFFICE_GYM_DB_POOL_MAX` to `1`. The session pooler holds one database connection per client, and the free plan allows few of them.
- **The deploy workflow says it was skipped or not deployed**: check that both GitHub secrets are on the Secrets tab.
- **429 responses while testing**: each IPv4 address, or each IPv6 /64 network, gets 30 episodes and 600 steps an hour.
