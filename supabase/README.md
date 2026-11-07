# Backend (Supabase)

Owner: Robel. Contains the database migrations, the Edge Functions, the seed data, and the Supabase config.

```
supabase/
  migrations/   SQL migration files (tables, enums, indexes, RLS policies, RPC functions, cron jobs)
  functions/    Edge Functions (estimate-fare, request-ride, create-driver, block-user, send-push, notify-ops-of-sos, send-sms-hook)
  seed.sql      shared sample data for the local Supabase
  config.toml   local Supabase configuration
```

Role file: `docs/roles/Robel_PersonC_Backend.md`. The whole contract (`docs/CONTRACT.md`) applies.

Run it locally with the Supabase CLI and Docker (`supabase start`). Never change the database by hand without a migration.

Never commit secrets: the service role key, the database password, the SMS provider key, the map key, the FCM service account file, or the SMS hook secret. Use Supabase secrets.
