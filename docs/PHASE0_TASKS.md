# Phase 0: Setup checklist

Done when: the services work, the budget alert is on, all four computers run the local Supabase, and the open decisions are settled and written into the contract.

## Everyone
- [ ] GitHub account; added to the repository
- [ ] Read your role file, then the specification
- [ ] Kickoff meeting attended

## Natnael (D)
- [ ] Repository created, files added, `main` protected (or the team rule agreed, see the note at the end)
- [ ] Shared sample data prepared (admin, 2 passengers, 4 drivers, fare config, one area zone with 2 gates, one banned road)
- [ ] Official restricted-places list collected from the city traffic office
- [ ] Real Dilla coordinates collected (gates, test routes, driver start points)
- [ ] Driver phone models listed; device matrix started
- [ ] Admin project created in `admin/` (login and drivers screen started)

## Robel (C)
- [ ] Supabase project created on the Free plan; region chosen
- [ ] PostGIS, pg_cron, and pg_net enabled; Auth set up
- [ ] Auth hooks created: Send SMS, Custom Access Token (`user_role`), Before User Created
- [ ] No-cost Firebase project created for push (FCM); both Android apps registered
- [ ] Local Supabase running (Docker); teammates added as team members (not Owners)
- [ ] SMS provider account opened; price per SMS to Ethiopia written down; a local provider quote requested
- [ ] Sign-in flow started (Send SMS hook and `completeProfile`)

## Naol (A)
- [ ] `android/passenger` project and `android/core` skeleton created (with Barkot)
- [ ] Contract models and `ContractFunctions` (with a fake version) started
- [ ] Map provider test led: 2 or 3 providers on 5 to 10 real Dilla routes; result written down

## Barkot (B)
- [ ] `android/driver` project created; helped with the `core` skeleton
- [ ] Foreground location service prototype tested on a real phone
- [ ] Helped with the map provider test

## Decisions to write into the contract
- [ ] Contract owner confirmed (Robel by default)
- [ ] Supabase region and plan (Free while building; Pro before real riders)
- [ ] Two Android package names
- [ ] Map provider
- [ ] Base fare and price per km (minimum fare is 20 birr)
- [ ] SMS provider and price (Infobip or a local provider)
- [ ] Heartbeat every 30 seconds and the 90-second disconnect threshold; whether pg_cron supports sub-minute schedules
- [ ] SOS: 24/7 rota, operations phone numbers, backup number, emergency numbers confirmed with the Dilla police station
- [ ] The values marked [PROPOSED] in the contract (list at the end of Section 12)
- [ ] Role files regenerated after the contract changes

## Branch protection note
Branch protection and rulesets on **private** repositories need a paid GitHub plan (Pro, Team, or Enterprise); on the Free plan they work only for public repositories. If you cannot enable them, agree the rule "nobody pushes to `main`, everything goes through a pull request with one approval" and follow it by habit, or upgrade the plan.
