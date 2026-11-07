# Dilla Ride

A motorcycle ride system for Dilla City: a passenger app, a driver app, a backend (Supabase), and a web admin dashboard. Passengers request a ride, the nearest ready driver gets the request, payment is cash to the driver, and the platform takes a weekly commission. SOS alerts go to the admin team, which monitors them 24/7.

## Team

| Person | GitHub | Role | Folder |
| --- | --- | --- | --- |
| Naol (A) | @naol13 | Passenger app and the shared `core` module | `android/passenger`, `android/core` |
| Barkot (B) | @Barkoteee | Driver app | `android/driver` |
| Robel (C) | @robawon | Backend and contract owner | `supabase` |
| Natnael (D) | (add yours) | Admin dashboard, SOS board, and testing | `admin` |

## Repository layout

```
android/
  core/        shared library used by both apps (Naol owns; Naol and Barkot both review)
  passenger/   passenger app
  driver/      driver app
supabase/      Supabase backend: migrations, Edge Functions, seed data, config
admin/         web admin dashboard and the development test console
docs/          specification, master contract, workflow, and role files
```

## Start here

1. Read your role file in `docs/roles/`, then `docs/specification/`.
2. `docs/CONTRACT.md` is the rule book. Names, fields, functions, and error codes must match it exactly.
3. Read `CONTRIBUTING.md` for branches, pull requests, and reviews.
4. Phase 0 tasks are in `docs/PHASE0_TASKS.md`.

## Rules in one minute

- Work on your own branch. Open a pull request for every task.
- Never commit secrets (passwords, API keys, service account files, keystores).
- Money and ride status are decided only by the server.
- Need something that is not in the contract? Open a "Contract change request" issue. Do not invent it.
- Build the SOS feature and arrange the 24/7 rota before any pilot with real riders.
