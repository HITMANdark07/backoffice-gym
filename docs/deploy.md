# Deploying BackOffice Gym

The site runs on Vercel (Mumbai, `bom1`) with Postgres on Supabase (Mumbai, `ap-south-1`). Everything that holds a password is entered in a dashboard by the owner; nothing secret is committed.

## 1. Supabase

1. Create a project in **South Asia (Mumbai)**. Save the database password in your password manager.
2. **Project Settings → Data API**: turn the Data API off (the site never uses it). If you keep it on, make sure `backoffice_gym` is not in "Exposed schemas". Row-level security is on for every table either way.
3. **Connect** (top bar) → **Connection string → URI**. You need two strings, each with your password filled in:
   - **Session pooler** (port 5432): for migrations. Append `?sslmode=require`.
   - **Transaction pooler** (port 6543): for the site. Append `?sslmode=no-verify` (encrypted; node-postgres does not ship Supabase's CA).

## 2. GitHub (migrations)

Repo **Settings → Secrets and variables → Actions → New repository secret**:

- `SUPABASE_MIGRATION_URL` = the session pooler string.

Then **Actions → migrate → Run workflow** on `main`. It applies every migration to Supabase; it also runs by itself whenever a push to `main` adds a migration.

## 3. Vercel

1. **Add New → Project → Import** `HITMANdark07/backoffice-gym`. Project name `backoffice-gym` (this gives `backoffice-gym.vercel.app`).
2. **Root Directory**: `apps/web`. Leave "Include files outside the root directory" on. Framework, install and build commands come from `apps/web/vercel.json`.
3. **Environment Variables** (Production):

   | Name | Value |
   |---|---|
   | `BACKOFFICE_GYM_DATABASE_URL` | the transaction pooler string |
   | `BACKOFFICE_GYM_DB_POOL_MAX` | `3` |
   | `BACKOFFICE_GYM_RATE_LIMIT` | `on` |
   | `NEXT_PUBLIC_SITE_URL` | `https://backoffice-gym.vercel.app` |

4. Deploy. A production build without `NEXT_PUBLIC_SITE_URL` fails on purpose.

If the name `backoffice-gym` is taken, use the URL Vercel gives you for `NEXT_PUBLIC_SITE_URL` and tell Claude, so the README and the portfolio link match.

## 4. Check it

`curl https://backoffice-gym.vercel.app/api/health` returns `{"ok":true,...}`. The daily cron in `vercel.json` calls the same endpoint to expire abandoned episodes and old rate-limit windows, which also keeps the free Supabase project from pausing.

## Troubleshooting

- **`prepared statement … already exists`** from the transaction pooler: switch `BACKOFFICE_GYM_DATABASE_URL` to the session pooler string with `?sslmode=no-verify` and keep the pool at 3.
- **`self-signed certificate in certificate chain`**: the runtime string has `sslmode=require`; use `sslmode=no-verify`.
- **429 responses while testing**: each address gets 30 episodes and 600 steps an hour.
