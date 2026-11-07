# How we work

## Branches
- `main` is always working. Nobody pushes to it directly.
- Branch names: `naol/passenger-signin`, `barkot/driver-ready-button`, `robel/send-otp`, `natnael/admin-drivers`. Use your name, a slash, and a short task name.

## Commits
- Small, clear messages in the present tense: `Add sendOtp function`, `Fix PIN attempts counter`.
- Commit often. One task per branch.

## Pull requests
1. Open a pull request into `main` for every finished task. Fill in the template.
2. Get it reviewed by the right people:

| Change | Reviewed by |
| --- | --- |
| `android/core` | Both Naol and Barkot (and Robel if it changes contract models or function wrappers) |
| Passenger app | Barkot (Robel if it calls a function in a new way) |
| Driver app | Naol (Robel if it calls a function in a new way) |
| `supabase` | Natnael (tests) and Naol or Barkot (whichever app uses the function) |
| `admin` | Robel |
| `docs/CONTRACT.md` | Robel edits it; everyone is told of every new version |

3. Merge only after approval. Delete the branch afterwards.
4. Be able to explain your pull request in 3 sentences, even if Claude wrote the code.

## The contract
- `docs/CONTRACT.md` is the single source of truth. The master always wins.
- Only Robel edits it. To ask for a change, open a "Contract change request" issue. Robel answers within one day, updates the contract, raises the version number, and tells everyone.
- When the contract changes, the four role files in `docs/roles/` are regenerated. Do not edit them by hand.

## Secrets (never commit these)
- Passwords, API keys (SMS provider, maps), the Supabase service role key and database password, FCM service account files, `.env` files, signing keystores.
- The apps may contain only the Supabase project URL and the public anon key (kept in local config).
- `google-services.json` is ignored by default. Get it from Robel (the Firebase project used for push) and keep it local.
- If a secret is committed by mistake, tell Robel at once so it can be rotated.

## Working with Claude
Start every session with your role file attached and this opener:

> I am building the [passenger app / driver app / backend / admin dashboard] for Dilla Ride. Follow my attached file exactly and ask before changing it. Today I am working on: [one task].

- One task per session.
- Ask Claude to list its assumptions about other parts, and send them to the right person.
- Never paste secrets into a chat.

## Daily and weekly
- Daily message to the group: Done / Next / Blocked.
- Weekly: one full ride on two real phones (passenger app and driver app), with Natnael recording the result.
- End of every phase: run the test scenarios for that phase (T01 to T40 in the contract).
