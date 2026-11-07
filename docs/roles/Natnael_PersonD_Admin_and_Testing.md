# Dilla Ride: Working Brief and Contract Slice

**Prepared for:** Natnael  |  **Team size:** 4 people  |  **Your role:** Person D, Admin dashboard and testing  |  **Contract version:** 2.0

> This file is a slice of the master contract (`Dilla_Ride_Shared_Contract.md`). **The master always wins** if the two ever differ. Never edit this slice. Send changes to the contract owner (Robel, Person C), who updates the master, and then a new slice is made.
>
> Section numbers match the master contract. Skipped numbers (4, 11) are not needed for your role. Inside a section, only the parts you need are shown.

**The team:** Naol (Person A): passenger app and `core`. Barkot (Person B): driver app. Robel (Person C): backend and contract owner. Natnael (Person D): admin dashboard and testing.

**How to use this file:** give it to your Claude at the start of every working session, together with the opener in Section 0. It contains your role brief, your tasks by phase, and the part of the contract you must follow exactly.

---

## Your role: Admin dashboard and testing

You build the web admin dashboard and you are the team's integration tester. Because you test everything, you are the one who finds the places where parts do not connect.

### You own
- `admin/`: the React and TypeScript admin dashboard. It writes only through the admin functions in Section 8.4 and reads the database directly (through the Supabase client) with the admin role.
- The test plan (Section 13), the test devices, the test report, and a weekly full-ride test across all parts.

### You depend on
- Robel (Person C) for the admin functions and the data, and Naol and Barkot (Persons A and B) (the passenger and driver apps) for the apps you test with.

### Others depend on you for
- A dashboard that can create and approve drivers, set fares, and define zones before the app is tested against those flows.
- The collected real data: official restricted places from the city traffic office, and real Dilla coordinates for test routes, gates, and drivers.
- Test results: a short report after each phase listing which Section 13 scenarios pass and which fail, and who owns each failure.

### You must not
- Write to the database directly for anything except reading. All admin changes go through functions so they are validated and logged.
- Change a name, field, enum, or error code. Send a contract change request to the contract owner.

### Admin dashboard requirements
- Screens: Overview (online drivers, active rides, today's totals); Drivers (create, approve, block, status chip); Rides (search, filters, Stalled rides list); Payments and disputes (passenger phone number shown only in a dispute, resolve form with a note); Fares and settings (confirm step, blocks values below the minimum unless overridden); Map tool for zones and meeting points; Weekly statements; Audit log.
- Driver status chip: show "Ready" when `availability == READY`; "On ride" when `ON_RIDE`; "Payment pending" when `PAYMENT_PENDING`; "No signal" when `wantsOnline == true` and `connected == false` (including `ON_RIDE` with no signal); otherwise "Offline".
- Stalled rides list: rides where `stalled == true`.
- Show times in Africa/Addis_Ababa. Show money in birr (santim divided by 100).

### Test console (development only)
Because the passenger app and the driver app are built by different people, neither can complete a full ride alone. You build a small page in `admin/` (route `/dev`, enabled only in the local Supabase and the test project, never in production) that lets you act as the missing side:
- Sign in as a chosen test passenger or driver.
- Call the Section 8 functions for that role (passenger: `estimateFare`, `requestRide`, `cancelRide`, `finishRideAsPassenger`; driver: `setReady`, `acceptOffer`, `markArrived`, `startRide`, `endRide`, `confirmCashReceived`).
- Set a driver's location (writes `driver_locations`) and simulate the heartbeat stopping and resuming.
- Show the live ride, offer, and payment documents.
This lets Naol (Person A) and Barkot (Person B) test against a working "other side" from Phase 2 on.

### SOS board (safety critical, 24/7)
The admin team monitors SOS alerts around the clock. Build this first and keep it simple and reliable.
- A persistent banner and a **loud, repeating alarm** while any alert is `OPEN`, until an operator acknowledges it. The dashboard must be usable on a phone or a desk screen that stays open.
- Alert detail: map with the latest location and the trail (`track`), the ride snapshot, both people's names and phone numbers as tap-to-call links, the emergency numbers from settings as tap-to-call links, and the time since the alert started.
- Actions: Acknowledge; Resolve with an outcome and a required note; show when the user tapped "I am safe" (it does not close the alert).
- SOS history with filters, and the audit trail.
- Settings: emergency numbers and operations phones. The `opsPhoneNumbers` list is updated at every shift change (first is primary, others are backup).
- Staffing: at least one operator on duty at all times with a phone that receives the SOS SMS. The duty rota is kept outside the app. Tell the team if there are hours nobody can cover.
- Run a weekly SOS test (T32 and the SMS) and record the result.

### Testing responsibilities
- Keep a device matrix: 2 or 3 phone models drivers actually use. Test background location, battery limits, silent mode, and the full-screen alert on each.
- Keep the shared seed data (see the backend brief) current.
- Run the Section 13 scenarios at the end of every phase. A phase is done only when its scenarios pass.
- Once a week, run one full ride across all parts.
- During the pilot, track SMS delivery, battery use, and Supabase, FCM, and SMS costs against the spending limit.

### Your tasks by phase

| Phase | Your tasks | Joint test (Section 13) |
| --- | --- | --- |
| 0 Setup | Create the repository folders and the shared sample data; collect the official restricted-places list and real Dilla coordinates; set up the device matrix. | none |
| 1 Accounts | Admin login; create and approve drivers; fare editing screens; settings screen. | T01, T02, T03, T24, T25, T31 |
| 2 Core ride | Rides list; map tool for restricted areas, banned roads, and meeting points; **test console** (below); write the test steps for each ride path. | T04, T05, T06, T07, T12, T22, T29 |
| 3 Matching and alerts | **SOS board** (live alarm, map, call links, acknowledge, resolve), SOS settings (emergency numbers, operations phones). Extend the test console with driver location, heartbeat, and SOS simulation; test on 2 or 3 phone brands for battery limits, silent mode, and the full-screen alert. | T08, T09, T10, T11, T21, T23, T30, T32 to T36, T38, T39 |
| 4 Payment and disconnects | Dispute screen with phone numbers and resolve form; run airplane-mode and phone-off tests. | T13 to T20 |
| 5 Operations | Weekly statements, audit log, stalled rides, and SOS history screens; check weekly boundaries; weekly SOS SMS test. | T26, T27, T28, T37, T40 |
| 6 Pilot | Run the pilot checks: SMS delivery, battery use, costs against the budget alert; keep the issue list. | all |

---

# Contract sections for your role

## 0. Instructions for any AI assistant (and for people)

Paste this section at the start of every working session.

1. This contract is authoritative. Use every name, field, enum value, function name, and error code **exactly as written** (same spelling and capitalization).
2. Build only the part you were asked to build. Do not edit another person's part.
3. If you need something that is not in this contract (a new field, a new function, a new error), **do not invent it silently**. Stop and write a "Contract change request" (what, why, which parts are affected), and give it to the contract owner.
4. If you must assume how another part behaves, list the assumption at the end of your answer so the owner of that part can check it.
5. Never put money, ride-status, or payment logic in the app. The server decides; apps only send requests and show results.
6. Never hard-code fare values, timeouts, or limits. Read them from the config documents (Section 5).

Suggested session opener:

> "I am building the [passenger app / driver app / backend / admin dashboard] for Dilla Ride. Follow docs/CONTRACT.md exactly. Ask before changing it. Today I am working on: [task]."

---

## 1. Conventions

| Topic | Rule |
| --- | --- |
| Backend | **Supabase**: Postgres (with PostGIS), Auth, Realtime, Edge Functions, and scheduled jobs (pg_cron). Push alerts are delivered with Firebase Cloud Messaging (FCM); this needs only a free Firebase project and no Firebase billing. |
| Tables and columns | snake_case (`ride_id`). Kotlin and TypeScript models map to these names (for example with `@SerialName`). |
| Enum values | UPPER_SNAKE_CASE strings (`DRIVER_ACCEPTED`), stored as Postgres enum types. |
| Logical function names | camelCase as in Section 8 (`acceptOffer`). Each is implemented as a Postgres RPC function or an Edge Function; Section 8.0 gives the real names. |
| IDs | `uuid`, generated by Postgres. Exceptions: `profiles.id`, `drivers.id`, and `driver_locations.driver_id` equal the Supabase Auth user id; `payments.ride_id` and `ride_pins.ride_id` equal the ride id; `weekly_statements` uses `(driver_id, week_id)`. |
| Time | `timestamptz` (UTC). Column names end in `_at`. Show times to users in Africa/Addis_Ababa. |
| Locations | PostGIS `geography(Point, 4326)`. In function inputs and outputs, a location is `{ "lat": number, "lng": number }`. |
| Distance | Integer metres. Column names end in `_meters`. |
| Money | **[PROPOSED]** Integer **santim** (1 birr = 100 santim). Column names end in `_santim`. Screens show birr (`2000` santim is "20 birr"). |
| Phone numbers | E.164 format, for example `+2519XXXXXXXX`. |
| Language codes | `am` (Amharic), `en` (English). |
| Weeks | **[PROPOSED]** `week_id` is the ISO week in Africa/Addis_Ababa, for example `2026-W43`. ISO weeks run Monday to Sunday, matching the Sunday 23:59 cutoff. |
| How apps call the server | RPC: `supabase.rpc('accept_offer', { ride_id })` with named arguments (the snake_case input fields). Edge Functions: `POST` with a JSON body. Success returns the output fields shown in Section 8. |
| Errors | `{ "error_code": "...", "details": { } }` using the codes in Section 9. |
| Idempotency | Functions that create things take a client-generated `request_id` (UUID). Repeating the same `request_id` returns the original result and never creates a duplicate. |
| Supabase region | **[PROPOSED, DECIDE IN PHASE 0]** The project region cannot be changed after creation. Choose the region closest to Dilla that Supabase offers. |
| Supabase plan | **[PROPOSED]** Free plan while building. A free project pauses after 7 days without activity and has no backups, so plan a Pro project (needs a payment method) before real riders use the app, or keep a keep-alive job and weekly manual backups meanwhile. |
| Android apps | Two separate apps share one `core` library: `android/passenger`, `android/driver`, `android/core`. See Section 14. No role lock; each app accepts only its own role. |
| Android package names | **[PROPOSED, DECIDE IN PHASE 0]** One package name per app. They cannot be changed after release. |
| Client libraries | **[PROPOSED]** Android: supabase-kt. Admin dashboard: supabase-js. |

---

## 2. Enums

### 2.1 Roles and status

| Enum | Values |
| --- | --- |
| `Role` | `PASSENGER`, `DRIVER`, `ADMIN` |
| `UserStatus` | `ACTIVE`, `BLOCKED` |
| `DriverApproval` | `PENDING`, `APPROVED`, `REJECTED` |
| `DriverAvailability` | `OFFLINE`, `READY`, `ON_RIDE`, `PAYMENT_PENDING` |

The source of truth is `profiles.role`. A Supabase Auth **Custom Access Token hook** copies it into the login token as the claim `user_role`, and row-level security policies and the apps read that claim. Clients cannot change it.

### 2.2 Rides and offers

| Enum | Values |
| --- | --- |
| `RideStatus` | `REQUESTED`, `SEARCHING`, `DRIVER_ACCEPTED`, `ARRIVED_AT_PICKUP`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `NO_DRIVER_FOUND`, `EXPIRED` |
| `OfferStatus` | `OFFERED`, `ACCEPTED`, `REJECTED`, `TIMED_OUT`, `CANCELLED` (**[PROPOSED]** used when the ride ends while an offer is open) |
| `CancelledBy` | `PASSENGER`, `DRIVER`, `ADMIN`, `SYSTEM` |
| `CancelReason` | `PASSENGER_CHANGED_MIND`, `DRIVER_UNAVAILABLE`, `PASSENGER_NO_SHOW`, `SAFETY`, `OTHER` |
| `CompletedBy` | `DRIVER`, `PASSENGER` |

### 2.3 Payments and disputes

| Enum | Values |
| --- | --- |
| `PaymentStatus` | `PENDING_DRIVER_CONFIRMATION`, `PAID`, `DISPUTED` |
| `DisputeType` | `PASSENGER_REPORT`, `DRIVER_DIFFERENCE` |
| `DisputeStatus` | `OPEN`, `RESOLVED` |
| `DisputeOutcome` | `FULL_FARE_CONFIRMED`, `REDUCED_FARE_CONFIRMED`, `DRIVER_AT_FAULT` |
| `StatementStatus` | `UNPAID`, `PAID` |

### 2.4 Zones

| Enum | Values |
| --- | --- |
| `ZoneType` | `AREA` (motorcycles cannot enter, for example the university), `ROAD` (road segment banned for motorcycles) |

### 2.5 Safety and SOS

| Enum | Values |
| --- | --- |
| `SosStatus` | `OPEN`, `ACKNOWLEDGED`, `RESOLVED` |
| `SosRaisedBy` | `PASSENGER`, `DRIVER`, `SYSTEM` |
| `SosTrigger` | `USER_BUTTON`, `SAFETY_CHECK_NO_RESPONSE`, `LONG_STOP`, `DISCONNECT_TIMEOUT` |
| `SosOutcome` | `SAFE`, `POLICE_CONTACTED`, `AMBULANCE_CONTACTED`, `FALSE_ALARM`, `OTHER` |

---

## 3. Ride state machine (server rules)

Only the server (database functions) changes `rides.status`.

| From | To | Triggered by (function) | Extra condition |
| --- | --- | --- | --- |
| (new) | `REQUESTED` | `requestRide` | Passes all checks |
| `REQUESTED` | `SEARCHING` | server (immediately) | none |
| `SEARCHING` | `DRIVER_ACCEPTED` | `acceptOffer` (driver) | Offer still `OFFERED` and not expired |
| `SEARCHING` | `NO_DRIVER_FOUND` | `dispatchNext` | No eligible driver left, or `search_deadline_at` passed |
| `REQUESTED`, `SEARCHING`, `DRIVER_ACCEPTED`, `ARRIVED_AT_PICKUP` | `CANCELLED` | `cancelRide` (passenger) | none |
| `DRIVER_ACCEPTED`, `ARRIVED_AT_PICKUP` | `CANCELLED` | `cancelRide` (driver) | Reason is not `PASSENGER_NO_SHOW` |
| `DRIVER_ACCEPTED` | `ARRIVED_AT_PICKUP` | `markArrived` (driver) | none |
| `ARRIVED_AT_PICKUP` | `CANCELLED` (`PASSENGER_NO_SHOW`) | `cancelNoShow` (driver) | `now >= no_show_available_at` |
| `ARRIVED_AT_PICKUP` | `IN_PROGRESS` | `startRide` (driver) | Correct PIN |
| `IN_PROGRESS` | `COMPLETED` | `endRide` (driver) | none |
| `IN_PROGRESS` | `COMPLETED` (`completed_by: PASSENGER`) | `finishRideAsPassenger` | Driver is disconnected |
| `IN_PROGRESS` | `CANCELLED` | `closeStalledRide` (admin) | Safety or stalled cases only |
| any non-final state | `EXPIRED` | `stalledRideFlagger` / cleanup | Open longer than the stalled limit |

Final states: `COMPLETED`, `CANCELLED`, `NO_DRIVER_FOUND`, `EXPIRED`.

Driver availability transitions:

| Event | Result |
| --- | --- |
| `setReady` succeeds | `READY`, `wants_online = true` |
| `setOffline` | `OFFLINE`, `wants_online = false` |
| `acceptOffer` | `ON_RIDE`, `current_ride_id` set |
| Ride completes (by `endRide` or `finishRideAsPassenger`) | `PAYMENT_PENDING`, `payment_lock_ride_id` set |
| Ride cancelled (driver was `ON_RIDE`) | `READY` if `wants_online`, else `OFFLINE`; `current_ride_id` cleared |
| `confirmCashReceived` | `payment_lock_ride_id` cleared; `READY` if `wants_online`, else `OFFLINE` |
| Connection lost while `READY` | `OFFLINE` (`wants_online` stays `true`) |
| Connection returns, `wants_online` is `true`, availability is `OFFLINE`, no payment lock | `READY` |
| Connection lost or returns while `ON_RIDE` or `PAYMENT_PENDING` | No change (only `connected` is updated) |

---

## 5. Config documents (admin-adjustable values)

Never hard-code these. Apps and functions read them. Arrays and maps are stored as `jsonb` or Postgres arrays.

### 5.1 `fare_configs` (one row per version; never edited, only added)

| Field | Type | Notes |
| --- | --- | --- |
| `version` | number | 1, 2, 3, and so on. Also the document ID. |
| `base_fare_santim` | number | To be set (open item). |
| `price_per_km_santim` | number | To be set (open item). |
| `minimum_fare_santim` | number | Default `2000` (20 birr). Admin cannot go below `2000` unless `override_validation` is used. |
| `no_show_wait_seconds` | number | Default `120`. |
| `commission_percent` | number | Default `10`. |
| `created_by` | string | Admin uid. |
| `created_at` | Timestamp | |

### 5.2 `settings` (a single row, `id = 1`)

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `active_fare_config_version` | number | 1 | Which `fare_configs` version new rides use. |
| `offer_timeout_seconds` | number | 25 | Time a driver has to answer an offer (20 to 30). |
| `search_timeout_seconds` | number | 180 | **[PROPOSED]** Total time to find a driver before `NO_DRIVER_FOUND`. |
| `max_pickup_distance_meters` | number | 5000 | **[PROPOSED]** Search radius for drivers. |
| `stale_location_seconds` | number | 300 | Drivers with older locations are skipped (status unchanged). |
| `move_threshold_meters` | number | 200 | Driver app sends a location after moving this far. |
| `ready_reminder_hours` | number | 12 | Reminder after this long as `READY`. |
| `stalled_ride_hours` | number | 12 | Rides open this long appear in the admin stalled list. |
| `max_pin_attempts` | number | 5 | **[PROPOSED]** |
| `otp_expiry_seconds` | number | 300 | **[PROPOSED]** Set in the Supabase Auth settings; listed here for reference. |
| `otp_max_requests_per_hour` | number | 3 | **[PROPOSED]** Per phone number. |
| `otp_max_verify_attempts` | number | 5 | **[PROPOSED]** Handled by Supabase Auth; listed here for reference. |
| `emergency_numbers` | map | `{ police: "991", ambulance: "907", fire: "939", traffic_police: "945" }` | **[PROPOSED]** Confirm with the Dilla police station and a local clinic or Red Cross. Apps open the phone dialer with these. |
| `ops_phone_numbers` | string[] | none | Operations phones that receive SOS SMS. First is primary, the rest are backup. The admin updates this at every shift change. |
| `sos_hold_seconds` | number | 3 | **[PROPOSED]** Press and hold time for the SOS button. |
| `sos_cancel_countdown_seconds` | number | 5 | **[PROPOSED]** Time to cancel after the hold. |
| `sos_location_interval_seconds` | number | 10 | **[PROPOSED]** Location updates while an SOS is open. |
| `sos_escalation_seconds` | number | 120 | **[PROPOSED]** If an alert is still `OPEN`, notify all backup phones, and repeat at this interval (up to 5 times). |
| `safety_check_response_seconds` | number | 60 | **[PROPOSED]** Time to answer "Are you OK?". |
| `long_stop_minutes` | number | 10 | **[PROPOSED]** No driver location update during `IN_PROGRESS` for this long triggers a safety check. |
| `disconnect_alert_minutes` | number | 15 | **[PROPOSED]** Driver disconnected during `IN_PROGRESS` for this long triggers a safety check. |
| `updated_by`, `updated_at` | string, Timestamp | | |

---

## 6. Database tables (Postgres)

All tables are in the `public` schema. **Row Level Security (RLS) is enabled on every table** with deny-by-default policies (Section 7.2). `?` after a type means the column may be `null`. Postgres enum types are named like the enums in Section 2 in snake_case (`ride_status`, `driver_availability`, and so on).

### 6.1 `profiles`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. Equals the Supabase Auth user id. |
| `role` | `Role` | Source of the `user_role` token claim. Server only. |
| `name` | text | Client may edit. |
| `phone` | text | E.164. Not editable. |
| `language` | `am` or `en` | Client may edit. |
| `status` | `UserStatus` | Server only. |
| `fcm_token` | text? | Client may edit. |
| `active_ride_id` | uuid? | Passengers only. Set by `requestRide`, cleared when the ride reaches a final state. Server only. The passenger app reads it on start to reopen the current ride. |
| `active_sos_id` | uuid? | Set by `triggerSos`, cleared when the alert is `RESOLVED`. Server only. |
| `emergency_contacts` | jsonb | Array of up to 2 `{ "name": text, "phone": text }`. Written only by `saveEmergencyContacts`. Readable by the user and admins. |
| `created_at`, `updated_at` | timestamptz | |

### 6.2 `drivers`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. Equals `profiles.id`. |
| `approval` | `DriverApproval` | Admin via `approveDriver`. |
| `license_number` | text | |
| `plate`, `model`, `color` | text | Motorcycle details. |
| `photo_url` | text? | |
| `availability` | `DriverAvailability` | Server only. |
| `wants_online` | boolean | `true` after `setReady`, `false` after `setOffline`. Decides whether to return to `READY`. |
| `connected` | boolean | Set by the presence job and by `driverHeartbeat` (Section 7.1). |
| `last_seen_at` | timestamptz? | |
| `current_ride_id` | uuid? | |
| `payment_lock_ride_id` | uuid? | Set while cash is not yet confirmed. Blocks `setReady` and offers. |
| `ready_reminder_sent_at` | timestamptz? | |
| `last_ready_at` | timestamptz? | When `READY` started. |
| `rating_average` | numeric | |
| `rating_count` | integer | |
| `created_at`, `updated_at` | timestamptz | |

### 6.3 `driver_locations` and `driver_presence`

`driver_locations` is kept separate because it changes most often. `driver_presence` is **not** part of the Realtime publication, so heartbeats do not create Realtime messages.

| Table | Column | Type | Notes |
| --- | --- | --- | --- |
| `driver_locations` | `driver_id` | uuid | Primary key. |
| | `location` | geography(Point) | GiST index. |
| | `heading` | real? | Degrees, optional. |
| | `updated_at` | timestamptz | |
| `driver_presence` | `driver_id` | uuid | Primary key. |
| | `last_seen_at` | timestamptz | Written only by `driverHeartbeat`. |

The driver app writes its own `driver_locations` row directly after moving `move_threshold_meters`, only while `READY` or `ON_RIDE` (enforced by an RLS policy).

### 6.4 `rides`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `passenger_id` | uuid | |
| `driver_id` | uuid? | Set on accept. |
| `status` | `RideStatus` | |
| `pickup_location`, `destination_location` | geography(Point) | |
| `pickup_address`, `destination_address` | text | |
| `pickup_meeting_point_id`, `destination_meeting_point_id` | uuid? | |
| `distance_meters` | integer | |
| `fare_santim` | integer | Fixed at request time. |
| `fare_config_version` | integer | The version used for this ride. |
| `request_id` | uuid | Unique. Idempotency key from the client. |
| `previous_ride_id` | uuid? | **[PROPOSED]** Set when the passenger searched again after a driver cancelled. |
| `tried_driver_ids` | uuid[] | Drivers already offered this ride. |
| `current_offer_driver_id` | uuid? | |
| `search_deadline_at` | timestamptz | |
| `driver_snapshot` | jsonb? | `{ name, plate, model, color, rating_average, photo_url }` copied on accept. |
| `passenger_snapshot` | jsonb? | `{ name }` copied on accept. |
| `contact` | jsonb? | `{ driver_phone, passenger_phone }`. Added only after accept. |
| `driver_connected` | boolean? | Mirror for the passenger app. Drives the Finish ride button. |
| `last_driver_location` | jsonb? | `{ lat, lng, updated_at }`. Saved when the driver disconnects mid-ride. |
| `no_show_available_at` | timestamptz? | `arrived_at + no_show_wait_seconds`. |
| `created_at`, `accepted_at`, `arrived_at`, `started_at`, `completed_at`, `cancelled_at` | timestamptz? | |
| `cancelled_by` | `CancelledBy`? | |
| `cancel_reason` | `CancelReason`? | |
| `completed_by` | `CompletedBy`? | |
| `passenger_rating_of_driver` | smallint? | 1 to 5, **[PROPOSED]** |
| `stalled` | boolean | Set by `stalledRideFlagger`. |
| `safety_check` | jsonb? | `{ reason: SosTrigger, sent_at, expires_at, answered_at?, ok? }`. Set by `safetyMonitor`. |

### 6.7 `payments`

| Column | Type | Notes |
| --- | --- | --- |
| `ride_id` | uuid | Primary key. |
| `driver_id`, `passenger_id` | uuid | |
| `fare_santim` | integer | Full fare from the ride. |
| `confirmed_fare_santim` | integer | Starts equal to `fare_santim`. Changed only by `resolveDispute`. |
| `status` | `PaymentStatus` | See rules below. |
| `commission_percent` | numeric | Copied from the fare config of the ride. |
| `commission_santim` | integer | Based on `confirmed_fare_santim`. |
| `week_id` | text | Week of completion. |
| `driver_confirmed_at` | timestamptz? | |
| `difference` | jsonb? | `{ reported_received_santim, reason, reported_at }` |
| `dispute_id` | uuid? | |
| `created_at`, `updated_at` | timestamptz | |

Payment status rules:
- Created as `PENDING_DRIVER_CONFIRMATION` when the ride becomes `COMPLETED`.
- `confirmCashReceived` sets `PAID`, unless a dispute is open on this ride, then `DISPUTED`.
- Opening a dispute after the driver confirmed sets `DISPUTED`. Before the driver confirmed, the status stays `PENDING_DRIVER_CONFIRMATION` and `dispute_id` is set.
- `resolveDispute` sets `PAID`.
- The ride counts at the full fare until the dispute is resolved.

### 6.8 `disputes`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `ride_id`, `driver_id`, `passenger_id` | uuid | |
| `type` | `DisputeType` | |
| `raised_by` | `PASSENGER` or `DRIVER` | |
| `reported_received_santim` | integer? | For `DRIVER_DIFFERENCE`. |
| `reason` | text | |
| `passenger_phone`, `driver_phone` | text | For the admin verification call. Admin read only. |
| `status` | `DisputeStatus` | |
| `outcome` | `DisputeOutcome`? | |
| `confirmed_fare_santim` | integer? | Set on resolution. |
| `admin_note` | text? | |
| `resolved_by` | uuid? | |
| `created_at`, `resolved_at` | timestamptz | |

### 6.9 `restricted_zones`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `name` | text | |
| `type` | `ZoneType` | |
| `geom` | geography | Polygon when `type = AREA`; LineString when `type = ROAD`. GiST index. |
| `buffer_meters` | integer? | For `ROAD`. **[PROPOSED]** default 15. |
| `active` | boolean | |
| `updated_by` | uuid | |
| `updated_at` | timestamptz | |

### 6.10 `meeting_points`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `name` | text | For example "University main gate". |
| `location` | geography(Point) | |
| `zone_id` | uuid | The zone it serves. |
| `active` | boolean | |

### 6.11 `weekly_statements`

| Column | Type | Notes |
| --- | --- | --- |
| `driver_id`, `week_id` | uuid, text | Together the primary key. |
| `week_start_at`, `week_end_at` | timestamptz | Monday 00:00 to Sunday 23:59:59, Addis Ababa time. |
| `ride_count` | integer | |
| `total_fares_santim` | integer | |
| `commission_santim` | integer | |
| `adjustments_santim` | integer | **[PROPOSED]** Dispute corrections that arrive after the statement was paid are added to the next unpaid statement. |
| `status` | `StatementStatus` | |
| `closed_at`, `paid_at` | timestamptz? | |
| `marked_paid_by` | uuid? | |

### 6.12 `audit_logs`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `actor_id` | uuid | |
| `actor_role` | `Role` | |
| `action` | text | Function name, for example `updateFareConfig`. |
| `target` | text | Table and row id. |
| `before`, `after` | jsonb? | |
| `created_at` | timestamptz | |

### 6.14 `sos_alerts` and `sos_track`

`sos_alerts`:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `request_id` | uuid | Idempotency key. |
| `ride_id` | uuid? | Null when raised without a ride (for example a `READY` driver). |
| `raised_by_user_id` | uuid? | Null when raised by the system. |
| `raised_by` | `SosRaisedBy` | |
| `trigger` | `SosTrigger` | |
| `status` | `SosStatus` | |
| `location` | geography(Point) | Latest known location. |
| `location_updated_at` | timestamptz | |
| `ride_snapshot` | jsonb? | `{ passenger_name, passenger_phone, driver_name, driver_phone, plate, model, color, ride_status, pickup_address, destination_address }` copied at creation. |
| `contacts_notified_at` | timestamptz? | When the user's emergency contacts were sent an SMS. |
| `ops_notified_at` | timestamptz? | When the first operations SMS and dashboard alert were sent. |
| `escalated_at` | timestamptz? | Last escalation to backup phones. |
| `escalation_count` | integer | |
| `user_marked_safe_at` | timestamptz? | Set by `markSosSafe`. Does not close the alert. |
| `acknowledged_by`, `acknowledged_at` | uuid?, timestamptz? | |
| `resolved_by`, `resolved_at` | uuid?, timestamptz? | |
| `outcome` | `SosOutcome`? | |
| `admin_note` | text? | Required to resolve. |
| `created_at` | timestamptz | |

`sos_track`: `(id uuid, sos_id uuid, location geography(Point), at timestamptz)`, one row per `updateSosLocation`. The trail is for the admin and for later review.

Access: the base `sos_alerts` table is admin only. The person who raised an alert reads it through the view `my_sos_alerts`, which excludes `admin_note`. Nobody can write the table directly. `sos_track` is admin read only.

---

## 7. Connection detection and direct client access

### 7.3 What each app listens to (Realtime, no polling)

Apps subscribe with Supabase Realtime (Postgres Changes). Realtime respects RLS. Each app instance uses one connection; the Free plan allows about 200 at once, so unsubscribe when a screen or role no longer needs a subscription.

| App | Listens to |
| --- | --- |
| Passenger | `profiles` row (for `active_ride_id`); `rides` row of the active ride; `ride_pins` row once the ride is accepted; `driver_locations` row of the assigned driver while the ride is active; `restricted_zones` and `meeting_points` for the map. |
| Driver | `drivers` row; `offers` where `driver_id` is the user and `status = OFFERED`; the `rides` row of `current_ride_id`; the `payments` row of `payment_lock_ride_id`; `restricted_zones` for the red map layer. The `RIDE_OFFER` push wakes the app, and the subscription provides the data. |
| Admin dashboard | `drivers` and `driver_locations` (overview); `rides`; `payments`; `disputes`; `weekly_statements`; `audit_logs`; config tables; **`sos_alerts` where `status != RESOLVED` (the SOS board, with a loud alarm while any alert is `OPEN`)** and `sos_track` for an open alert. |
| Passenger and driver apps (SOS) | `profiles` row for `active_sos_id`; the view `my_sos_alerts` (own alert) while an SOS is open. |

Apps must never poll on a timer.

---

## 8. Server actions (Supabase RPC and Edge Functions)

Every function checks the caller's role (from the `user_role` token claim), checks the caller is not `BLOCKED`, checks the current status of the objects involved, runs its writes in one database transaction, and is safe to repeat. Inputs and outputs below use snake_case. Unless stated, the output is the JSON object shown under "Output".

### 8.0 Implementation map

RPC functions are Postgres functions (`security definer`, using `auth.uid()` and the token role) called with `supabase.rpc(name, args)`. Edge Functions are called with `supabase.functions.invoke(name, { body })`.

| Logical name | Kind | Real name |
| --- | --- | --- |
| `completeProfile` | RPC | `complete_profile` |
| `estimateFare` | Edge | `estimate-fare` (calls the map provider) |
| `requestRide` | Edge | `request-ride` (calls the map provider, then the RPC `create_ride`) |
| `cancelRide` | RPC | `cancel_ride` |
| `finishRideAsPassenger` | RPC | `finish_ride_as_passenger` |
| `reportProblem` | RPC | `report_problem` |
| `rateDriver` | RPC | `rate_driver` |
| `setReady` | RPC | `set_ready` |
| `setOffline` | RPC | `set_offline` |
| `driverHeartbeat` | RPC | `driver_heartbeat` |
| `acceptOffer` | RPC | `accept_offer` |
| `rejectOffer` | RPC | `reject_offer` |
| `markArrived` | RPC | `mark_arrived` |
| `startRide` | RPC | `start_ride` |
| `cancelNoShow` | RPC | `cancel_no_show` |
| `endRide` | RPC | `end_ride` |
| `confirmCashReceived` | RPC | `confirm_cash_received` |
| `reportDifference` | RPC | `report_difference` |
| `triggerSos`, `updateSosLocation`, `markSosSafe`, `answerSafetyCheck`, `saveEmergencyContacts` | RPC | `trigger_sos`, `update_sos_location`, `mark_sos_safe`, `answer_safety_check`, `save_emergency_contacts` |
| `createDriver` | Edge | `create-driver` (uses the Auth admin API) |
| `blockUser` | Edge | `block-user` (bans the Auth user and updates the profile) |
| `approveDriver`, `updateFareConfig`, `updateSettings`, `saveRestrictedZone`, `saveMeetingPoint`, `resolveDispute`, `closeStalledRide`, `markCommissionPaid`, `acknowledgeSos`, `resolveSos` | RPC | the snake_case version of the name |

Edge Functions used by the system (not called by apps directly): `send-sms-hook` (Auth Send SMS hook), `send-push` (FCM), `notify-ops-of-sos`. Secrets (SMS provider key, map key, FCM service account, hook secret) are stored as Supabase secrets, never in the repository or an app.

### 8.4 Admin functions (caller role: `ADMIN`)

Every admin function writes an `audit_logs` entry (`before` and `after`).

| Function | Input | Output | Errors |
| --- | --- | --- | --- |
| `createDriver` | `{ name, phone, login_id, temporary_password, license_number, motorcycle:{plate,model,color} }` | `{ uid }` | `PHONE_ALREADY_USED`, `LOGIN_ID_TAKEN`, `INVALID_PHONE` |
| `approveDriver` | `{ uid, approval: DriverApproval }` | `{ approval }` | `NOT_A_DRIVER` |
| `blockUser` | `{ uid, blocked: boolean, reason }` | `{ status }` | `USER_NOT_FOUND` |
| `updateFareConfig` | `{ base_fare_santim, price_per_km_santim, minimum_fare_santim, no_show_wait_seconds, commission_percent, confirm: true, override_validation?: boolean }` | `{ version }` | `CONFIRMATION_REQUIRED`, `MINIMUM_FARE_TOO_LOW`, `PRICE_PER_KM_INVALID` |
| `updateSettings` | any subset of the `settings` fields | `{ updated_at }` | `INVALID_VALUE` |
| `saveRestrictedZone` | `{ zone_id?, name, type, polygon? or line?, buffer_meters?, active }` | `{ zone_id }` | `INVALID_GEOMETRY` |
| `saveMeetingPoint` | `{ point_id?, name, location, zone_id, active }` | `{ point_id }` | `ZONE_NOT_FOUND` |
| `resolveDispute` | `{ dispute_id, outcome: DisputeOutcome, confirmed_fare_santim?, admin_note }` | `{ status }` | `DISPUTE_NOT_FOUND`, `DISPUTE_ALREADY_RESOLVED`, `INVALID_AMOUNT` |
| `closeStalledRide` | `{ ride_id, note }` | `{ status }` | `RIDE_NOT_FOUND`, `INVALID_RIDE_STATE` |
| `markCommissionPaid` | `{ statement_id }` | `{ status }` | `STATEMENT_NOT_FOUND`, `STATEMENT_ALREADY_PAID` |
| `acknowledgeSos` | `{ sos_id }` | `{ status }` | `SOS_NOT_FOUND`, `SOS_ALREADY_RESOLVED` |
| `resolveSos` | `{ sos_id, outcome: SosOutcome, admin_note }` | `{ status }` | `SOS_NOT_FOUND`, `SOS_ALREADY_RESOLVED`, `NOTE_REQUIRED` |

`resolveDispute` with `REDUCED_FARE_CONFIRMED` sets `confirmed_fare_santim`, recalculates `commission_santim`, sets payment `PAID`, and updates the weekly statement (or `adjustments_santim` of the next unpaid statement if that week is already paid).

### 8.5 Safety and SOS functions (caller role: `PASSENGER` or `DRIVER` unless stated)

**`triggerSos`**
- Input: `{ "request_id": string, "ride_id": string?, "location": {lat,lng} }`
- Output: `{ "sos_id": string }`
- Preconditions: user is `ACTIVE`. If `ride_id` is given, the caller is its passenger or driver and the ride is `DRIVER_ACCEPTED`, `ARRIVED_AT_PICKUP`, or `IN_PROGRESS`. A driver may also raise an SOS with no ride. If the user already has an open alert, that alert is returned.
- Does: creates the alert with `ride_snapshot`, sets `profiles.active_sos_id`, and triggers `notifyOpsOfSos` and `sosEscalation` (Section 10). Sends the SMS to the user's emergency contacts if any.
- Errors: `SOS_ALREADY_OPEN` (includes `details.sos_id`), `INVALID_RIDE_STATE`, `NOT_RIDE_PARTICIPANT`, `USER_BLOCKED`

**`updateSosLocation`**
- Input: `{ "sos_id": string, "location": {lat,lng} }`. Output: `{ "ok": true }`
- Only the person who raised the alert, while it is not `RESOLVED`. Updates `location` and adds a `track` entry. Rate limited (about one per `sos_location_interval_seconds`).
- Errors: `SOS_NOT_FOUND`, `SOS_ALREADY_RESOLVED`, `RATE_LIMITED`, `NOT_RIDE_PARTICIPANT`

**`markSosSafe`**
- Input: `{ "sos_id": string }`. Output: `{ "ok": true }`
- Sets `user_marked_safe_at` and notifies the operators ("user says they are safe"). **The alert stays open until an operator resolves it**, so a person cannot be pressured into cancelling.
- Errors: `SOS_NOT_FOUND`, `SOS_ALREADY_RESOLVED`

**`answerSafetyCheck`**
- Input: `{ "ride_id": string, "ok": boolean }`. Output: `{ "ok": true }`
- `ok: true` clears the safety check. `ok: false` raises an SOS with trigger `USER_BUTTON`.
- Errors: `NO_ACTIVE_SAFETY_CHECK`, `NOT_RIDE_PARTICIPANT`

**`saveEmergencyContacts`**
- Input: `{ "contacts": [ { "name": string, "phone": string } ] }` (at most 2). Output: `{ "ok": true }`
- Replaces the user's contacts. Errors: `TOO_MANY_CONTACTS`, `INVALID_PHONE`

---

## 9. Error codes

Errors come back as `{ "error_code": "...", "details": { } }`. An RPC function raises a Postgres exception whose message is the error code and whose detail is the JSON details (PostgREST returns them in `message` and `details`). An Edge Function returns the HTTP status below with the JSON body. Apps decide their message from `error_code`, never from the English text.

| `error_code` | HTTP status | Meaning |
| --- | --- | --- |
| `UNAUTHENTICATED` | 401 | Not signed in. |
| `PERMISSION_DENIED` | 403 | Wrong role. |
| `USER_BLOCKED` | 403 | The account is blocked. |
| `NOT_RIDE_PARTICIPANT` | 403 | Caller is not the passenger or driver of this ride. |
| `INVALID_PHONE`, `NAME_REQUIRED`, `INVALID_AMOUNT`, `INVALID_REASON`, `INVALID_VALUE`, `INVALID_GEOMETRY` | 400 | Bad input. |
| `RATE_LIMITED` | 429 | Too many requests. |
| `OTP_INVALID`, `OTP_EXPIRED`, `OTP_ATTEMPTS_EXCEEDED` | 400 | Returned by Supabase Auth. The app maps the Auth error to these codes. |
| `PHONE_IS_DRIVER` | 403 | The phone number belongs to a driver account (from the Before User Created hook). |
| `SMS_SEND_FAILED` | 503 | The SMS provider could not send (from the Send SMS hook). |
| `RIDE_NOT_FOUND`, `OFFER_NOT_FOUND`, `USER_NOT_FOUND`, `DISPUTE_NOT_FOUND`, `STATEMENT_NOT_FOUND`, `ZONE_NOT_FOUND` | 404 | Missing document. |
| `ACTIVE_RIDE_EXISTS` | 409 | The user already has an active ride. |
| `INVALID_RIDE_STATE` | 409 | The ride status does not allow this action. |
| `RIDE_NO_LONGER_AVAILABLE` | 409 | Ride already taken, cancelled, or ended. |
| `OFFER_EXPIRED` | 410 | Offer time ran out. |
| `DRIVER_NOT_APPROVED`, `DRIVER_NOT_READY`, `NOT_A_DRIVER` | 409 | Driver state problems. |
| `PAYMENT_LOCKED` | 409 | Driver must confirm cash first. `details.ride_id`. |
| `CANNOT_GO_OFFLINE_NOW` | 409 | Driver is on a ride. |
| `DRIVER_STILL_CONNECTED` | 409 | Passenger cannot finish yet. |
| `PIN_INVALID` | 409 | Wrong PIN. `details.attempts_left`. |
| `PIN_ATTEMPTS_EXCEEDED` | 429 | Too many wrong PINs. |
| `NO_SHOW_WAIT_NOT_OVER` | 409 | `details.seconds_left`. |
| `PICKUP_IN_RESTRICTED_ZONE`, `DESTINATION_IN_RESTRICTED_ZONE`, `PICKUP_ON_BANNED_ROAD`, `DESTINATION_ON_BANNED_ROAD` | 409 | `details.suggested_meeting_points`. |
| `FARE_CHANGED` | 409 | `details.new_fare_santim`. |
| `ROUTE_NOT_AVAILABLE` | 503 | The map provider could not route. |
| `PAYMENT_ALREADY_CONFIRMED`, `DISPUTE_ALREADY_OPEN`, `DISPUTE_ALREADY_RESOLVED`, `STATEMENT_ALREADY_PAID`, `ALREADY_RATED` | 409 | Repeated action. |
| `CONFIRMATION_REQUIRED`, `MINIMUM_FARE_TOO_LOW`, `PRICE_PER_KM_INVALID` | 409 | Admin fare rules. |
| `PHONE_ALREADY_USED`, `LOGIN_ID_TAKEN` | 409 | Driver creation conflicts. |
| `SOS_ALREADY_OPEN` | 409 | The user already has an open alert. `details.sos_id`. |
| `SOS_NOT_FOUND` | 404 | Missing alert. |
| `SOS_ALREADY_RESOLVED` | 409 | The alert is closed. |
| `NOTE_REQUIRED` | 400 | An operator note is required to resolve. |
| `TOO_MANY_CONTACTS` | 400 | More than 2 emergency contacts. |
| `NO_ACTIVE_SAFETY_CHECK` | 409 | No safety check is waiting for an answer. |

---

## 10. Automatic jobs (no button)

Jobs are database triggers, scheduled database jobs (**pg_cron**, which runs in UTC), or Edge Functions called from them.

| Job | Trigger | What it does |
| --- | --- | --- |
| `dispatchNext` | Postgres function `dispatch_next(ride_id)`, called by `create_ride`, `reject_offer`, `offerTimeout`, and a driver's `cancel_ride` | Runs the dispatch steps in Section 4, then sends the `RIDE_OFFER` push through `send-push`. Ends the search with `NO_DRIVER_FOUND` if needed. |
| `offerTimeout` | pg_cron every 5 seconds (**[PROPOSED]**: confirm that sub-minute schedules are available on your plan; otherwise use Supabase Queues with delayed messages) | Finds offers still `OFFERED` past `expires_at`, sets `TIMED_OUT`, and calls `dispatch_next`. Does not change the driver's availability. |
| `presenceSync` | pg_cron every 15 seconds | Applies the connection rules in Section 7.1 to drivers whose last heartbeat is older than 90 seconds: mirrors `connected = false` to `drivers`; `READY` drivers become `OFFLINE`; for `ON_RIDE`, sets the ride's `driver_connected = false` and saves `last_driver_location`; sends `DRIVER_DISCONNECTED` to the passenger. (Reconnects are handled by `driverHeartbeat`.) |
| `readyReminder` | pg_cron every 15 minutes | Sends `READY_REMINDER` to drivers `READY` for `ready_reminder_hours` or more, once per period. Does not change status. |
| `stalledRideFlagger` | pg_cron hourly | Sets `stalled = true` on rides open for `stalled_ride_hours`. Such rides appear in the admin list and may later become `EXPIRED`. |
| `weeklyStatement` | pg_cron Sunday 23:59 Africa/Addis_Ababa, which is **Sunday 20:59 UTC** | Totals the week's payments per driver, sets `closed_at`, status `UNPAID`. |
| `notifyOnRideChange` | Database trigger on `rides` update, calling `send-push` through `pg_net` | Sends the push for the new status (Section 11) to the passenger or driver. |
| `notifyOpsOfSos` | Database trigger on `sos_alerts` insert, calling the Edge Function `notify-ops-of-sos` | Sounds the alarm on the admin dashboard (the SOS board subscription) and sends an SMS to the **primary** `ops_phone_numbers` entry with the name, plate, and a map link. Sets `ops_notified_at`. Sends the SMS to the user's emergency contacts. If SMS fails, retries and logs the failure; the dashboard alarm and push still go out. |
| `sosEscalation` | pg_cron every 15 seconds | For alerts still `OPEN` past `sos_escalation_seconds` since creation or the last escalation, sends an SMS to **all** `ops_phone_numbers`, sets `escalated_at`, and increments `escalation_count` (up to 5 times). Stops once the alert is acknowledged. |
| `safetyMonitor` | pg_cron every minute | For rides `IN_PROGRESS`: if the driver has not sent a location for `long_stop_minutes` while connected, or has been disconnected for `disconnect_alert_minutes`, sends a `SAFETY_CHECK` to both people and sets `rides.safety_check`. |
| `safetyCheckTimeout` | pg_cron every 15 seconds | If no one answered by `safety_check.expires_at`, raises an SOS with trigger `SAFETY_CHECK_NO_RESPONSE` (or the original reason). |

Keep-alive and backups while on the Free plan: a scheduled request every few days so the project does not pause, and a weekly `pg_dump` saved outside Supabase.

---

## 12. Change process and change log

**Changing this contract**
1. Anyone may propose a change by writing a "Contract change request" (what, why, which parts are affected).
2. The contract owner (one named person) reviews it, updates this file, and raises the version number.
3. Announce the new version to everyone. Each person updates their AI session by pasting the new file.
4. Do not change names, fields, or enums in only one part.

**Adding to an enum or a function is "minor" (1.1, 1.2). Renaming or removing anything is "major" (2.0)** and needs everyone's agreement.

**Items to confirm in Phase 0 (remove the PROPOSED marker when agreed)**
- Money stored in santim with fares rounded up to whole birr
- Supabase region, and the plan (Free while building; Pro before real riders)
- Heartbeat every 30 seconds and the 90-second disconnect threshold; pg_cron sub-minute schedules
- Sign-in codes through the Send SMS hook (Infobip or a local provider), and the driver login email format
- `search_timeout_seconds`, `max_pickup_distance_meters`, `max_pin_attempts`, SMS limits
- Road `buffer_meters` for banned roads
- `estimateFare` and `rateDriver` functions
- `previous_ride_id` for "Find another driver"
- `setOffline` allowed during `PAYMENT_PENDING`
- Offer status `CANCELLED`
- `adjustments_santim` for disputes after a statement is paid
- SOS defaults: emergency numbers, hold and cancel times, escalation time, safety-check thresholds, and who staffs the 24/7 operations phones

**Change log**
| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 23 Oct 2026 | First version, based on System Specification v2.0. |
| 1.1 | 23 Oct 2026 | Added `users.active_ride_id`; added `ride_id` and `driver_id` to offers; added Section 7.3 (listeners), 7.4 (indexes), and Section 13 (integration test scenarios). |
| 1.2 | 29 Oct 2026 | Team of 4. Two separate Android apps (passenger and driver) with a shared `core` module; no role lock; channel ownership; test T31; added Section 14. |
| 1.3 | 29 Oct 2026 | Emergency SOS and incident response, monitored by the admin team 24/7: enums (2.5), settings, `sos_alerts`, emergency contacts, functions (8.5, plus `acknowledgeSos` and `resolveSos`), jobs, push types, tests T32 to T40, and Section 15. |
| 2.0 | 5 Nov 2026 | **Backend changed from Firebase to Supabase** (Postgres, Auth, Realtime, Edge Functions, pg_cron). Tables replace collections; RPC and Edge Functions replace Cloud Functions; row-level security replaces security rules; sign-in codes use the Send SMS hook; connection detection uses a 30-second heartbeat (`driverHeartbeat`, `driver_presence`); `completeProfile` added; field names are snake_case; push stays on FCM. Ride, fare, payment, SOS, and screen rules are unchanged. |

---

## 13. Integration test scenarios (shared acceptance checks)

Run these on the local Supabase (Docker) first, then on real phones. "Phase" is the earliest phase where the scenario can pass. A phase is done only when its scenarios pass.

| ID | Phase | Scenario | Expected result |
| --- | --- | --- | --- |
| T01 | 1 | New passenger: phone sign-in (code sent through the Send SMS hook), then `completeProfile` with a name | `profiles` row exists, token claim `user_role` is `PASSENGER`, the passenger is signed in. |
| T02 | 1 | Request more codes than the hourly limit for one number; enter wrong codes | The request is refused with `RATE_LIMITED`; wrong codes are refused by Supabase Auth and the app shows the mapped error. |
| T03 | 1 | Admin `createDriver`; driver logs in; `setReady` before approval; driver phone used for passenger phone sign-in | Driver must change password; `DRIVER_NOT_APPROVED`; `PHONE_IS_DRIVER`. |
| T04 | 2 | `estimateFare` for a very short trip and for a longer trip | Short trip is 2000 santim (20 birr); longer trip follows the formula, rounded up to whole birr. |
| T05 | 2 | Admin changes fares while a ride is active; new request uses a stale `expected_fare_santim` | Active ride keeps its fare and version; new request returns `FARE_CHANGED` with `new_fare_santim`. |
| T06 | 2 | Full ride: request, offer, accept, arrived, PIN, start, end, cash received | Ride `COMPLETED`; payment `PAID`; commission is 10% of the fare; driver back to `READY`. |
| T07 | 2 | Enter the wrong PIN repeatedly | `PIN_INVALID` with `attempts_left`, then `PIN_ATTEMPTS_EXCEEDED`; ride stays `ARRIVED_AT_PICKUP`. |
| T08 | 3 | Three `READY` drivers at different distances; first rejects, second ignores the offer | Nearest gets the offer; reject moves to next; 25-second timeout moves on; all fail gives `NO_DRIVER_FOUND`. |
| T09 | 3 | Driver accepts after the offer expired; double-tap on Accept | `OFFER_EXPIRED`; only one `acceptOffer` succeeds. |
| T10 | 3 | Driver cancels after accepting; passenger taps "Find another driver" | Ride `CANCELLED` (`DRIVER`); new ride created with `previous_ride_id`; that driver is not offered again. |
| T11 | 3 | `markArrived`, then `cancelNoShow` at 60 seconds and at 120 seconds | `NO_SHOW_WAIT_NOT_OVER` with `seconds_left`; then `CANCELLED` with `PASSENGER_NO_SHOW`; driver back to `READY`. |
| T12 | 2 | Passenger cancels in `SEARCHING`, `DRIVER_ACCEPTED`, `ARRIVED_AT_PICKUP`; tries in `IN_PROGRESS` | Cancel works in the first three; `INVALID_RIDE_STATE` in `IN_PROGRESS`; open offers become `CANCELLED`. |
| T13 | 4 | After `endRide`, driver tries `setReady`; then `confirmCashReceived` | Driver is `PAYMENT_PENDING`, gets `PAYMENT_LOCKED`, receives no offers; after confirming, `READY` and receives the next offer. |
| T14 | 4 | Driver `reportDifference` (received 50 of 70 birr); admin resolves `REDUCED_FARE_CONFIRMED` at 50 | Dispute `OPEN`, commission stays on 70 until resolved; then recalculated on 50; audit log entry exists. |
| T15 | 4 | Passenger `reportProblem` after the ride | Dispute created; ride stays `COMPLETED`; admin sees both phone numbers. |
| T16 | 4 | Driver `READY`, turn on airplane mode; later reconnect. Repeat after the driver tapped "Go offline" | Becomes `OFFLINE` within about 90 seconds (three missed heartbeats) and gets no offers; on reconnect returns to `READY` only if `wants_online` was `true`. |
| T17 | 4 | Driver loses connection during `IN_PROGRESS`; passenger taps Finish; driver reconnects | Passenger sees `DRIVER_DISCONNECTED` and Finish; ride `COMPLETED` with `completed_by: PASSENGER`; driver opens on Receive payment; after confirming, `READY`. |
| T18 | 4 | Driver loses connection during `IN_PROGRESS` and reconnects before the passenger finishes | Finish button disappears; driver app reopens the same ride and continues; ride still `IN_PROGRESS`. |
| T19 | 4 | Passenger taps Finish at the same moment the driver reconnects and taps End ride | Exactly one completion; no duplicate payment or commission; the other app updates. |
| T20 | 4 | Driver phone powered off mid-ride, later restarted | Ride stays `IN_PROGRESS`; on restart the app opens straight on the active ride or on Receive payment. |
| T21 | 3 | Driver `READY` with the screen locked; send an offer; move 250 m | Long loud alert and full-screen request appear; location updates continue (one write after 200 m). |
| T22 | 2 | Pickup inside the university area; then choose a gate meeting point | `PICKUP_IN_RESTRICTED_ZONE` with suggested gates; request succeeds from the gate; fare is to the gate. |
| T23 | 2, 3 | Destination on a banned road; driver enters a banned road | `DESTINATION_ON_BANNED_ROAD` with suggestions; driver app shows a warning only, nothing is flagged. |
| T24 | 1 | Admin blocks a passenger and a driver | `requestRide` returns `USER_BLOCKED`; the driver cannot `setReady`. |
| T25 | 1 | Security checks (RLS): passenger reads another ride's PIN; driver reads the PIN; passenger updates ride status; passenger reads `disputes`; call without sign-in; any call using the wrong role | All refused (`PERMISSION_DENIED` or an empty result from RLS; `UNAUTHENTICATED` when not signed in). |
| T26 | 5 | A ride stays `IN_PROGRESS` past the stalled limit (shorten the limit in the local Supabase) | `stalled = true`; appears in the admin list; admin `closeStalledRide` works. |
| T27 | 5 | Complete rides before and after Sunday 23:59 Addis Ababa time; run `weeklyStatement`; `markCommissionPaid` | Rides fall in the correct `week_id`; statement totals match payments; status changes to `PAID`. |
| T28 | 5 | Driver stays `READY` for the reminder period | `READY_REMINDER` sent once; status unchanged. |
| T29 | 2 | Send `requestRide` twice with the same `request_id`; call `confirmCashReceived` twice | One ride; one commission; second call returns the existing result or `PAYMENT_ALREADY_CONFIRMED`. |
| T30 | 3 | Count writes for a moving driver, a parked driver, and an offline driver | Location rows change only after 200 m of movement; heartbeats are sent every 30 seconds only while `READY` or `ON_RIDE`; an offline driver sends nothing. |
| T31 | 1 | A driver's phone number requests a code in the passenger app; a passenger account signs in to the driver app | Passenger app gets `PHONE_IS_DRIVER`; the driver app refuses the wrong role, shows a clear message, and signs out. |
| T32 | 3 | Passenger holds the SOS button during `IN_PROGRESS` | Alert appears on the admin board with a loud alarm within a few seconds; operations SMS is sent; the user's screen shows call buttons for police, ambulance, and operations. |
| T33 | 3 | Driver raises an SOS during a ride, and again while `READY` with no ride | Both create alerts (`ride_id` null for the second); same admin alarm and SMS. |
| T34 | 3 | Short press on SOS; hold then cancel inside the countdown | No alert is created in either case. |
| T35 | 3 | Operator acknowledges, then resolves with and without a note; user taps "I'm safe" first | `OPEN` to `ACKNOWLEDGED` to `RESOLVED`; resolve without a note gives `NOTE_REQUIRED`; "I'm safe" notifies the operator but the alert stays open until resolved; audit entries exist. |
| T36 | 3 | No operator acknowledges within the escalation time | SMS goes to all backup phones; `escalated_at` set; repeats until acknowledged, then stops. |
| T37 | 5 | A ride stops for the long-stop time; user answers OK; repeat with no answer | `SAFETY_CHECK` push; OK clears it; no answer raises an SOS with the right trigger. |
| T38 | 3 | SOS with the phone in airplane mode | SOS screen offers the dialer buttons and a pre-filled SMS to the operations number; when the internet returns the alert is created and the location trail continues. |
| T39 | 3 | Security: another user reads an SOS alert; a user reads `admin_note` or the `track` trail; a client writes an alert directly | All refused. |
| T40 | 5 | Save two emergency contacts, then raise an SOS | Both contacts receive an SMS with the name, plate, and location link; a third contact is refused with `TOO_MANY_CONTACTS`. |

---

## 14. Android project structure and ownership (two apps)

### 14.1 Layout

```
android/
  core/        shared library module (used by both apps)
  passenger/   passenger app
  driver/      driver app
supabase/      backend: migrations, Edge Functions, seed data, config
admin/         web admin dashboard
docs/          specification, contract, role files
```

The two apps depend on `core` only. They never depend on each other.

### 14.2 What goes in `core`

| Item | Notes |
| --- | --- |
| `contract` package | Kotlin enums and data classes generated from Sections 2 and 6 (exact names). |
| `ContractFunctions` | One interface with one method per function in Section 8 (exact names), with a **real** Supabase implementation and a **fake** implementation with sample data. Each app uses only its own subset. |
| Error mapping | Converts `details.error_code` (Section 9) into app messages (Amharic and English). |
| Map components | Map view, restricted-zone layer, meeting points, route display. **[PROPOSED]** |
| Theme and shared UI | Colors, typography, buttons, loading and error views. |
| Translations | Shared Amharic and English strings. |
| Helpers | Addis Ababa time formatting, birr formatting (santim to birr), geohash, distance. |
| Supabase client | Client initialization (project URL and anon key from build config), session handling, and Realtime setup. |
| Safety (SOS) | Shared SOS button (press and hold, then a cancel countdown), the SOS screen (call buttons, "I'm safe", offline fallback), the safety check dialog, and the emergency contacts screen. |

### 14.3 Ownership rules

- **Passenger app:** owned by the passenger-app person. **Driver app:** owned by the driver-app person.
- **`core`:** **[PROPOSED]** owned by the passenger-app person. **Every change to `core` is reviewed by both app owners** before merging, and must not break either app's build. Add a build check that compiles both apps on every pull request.
- Code used by only one app stays in that app. Move it to `core` only when both apps need it.
- Nobody changes a contract name inside `core` without a contract change request.

### 14.4 Roles and sign-in per app

| App | Accepts role | Sign-in | If the wrong role signs in |
| --- | --- | --- | --- |
| Passenger app | `PASSENGER` | Phone number and SMS code (Supabase Auth `signInWithOtp` and `verifyOtp`, then `completeProfile`) | Show a "wrong app" message and sign out. |
| Driver app | `DRIVER` | Login ID and password from the admin | Show a "wrong app" message and sign out. |

After every sign-in, each app reads the `user_role` claim and checks it.

### 14.5 Supabase, push, and distribution

- One Supabase project for the pilot. The apps hold only the project URL and the anon key. The service role key is never in an app.
- For push notifications, create a Firebase project on the no-cost plan and register **two Android apps** in it (each with its own package name and its own `google-services.json`). It is used only for FCM tokens and delivery.
- Pilot distribution: install the APK files directly. Later, two Play Store listings.
- Notification channels follow Section 11 (channel ownership).

### 14.6 What each app uses

| App | Direct writes (Section 7.2) | Functions called |
| --- | --- | --- |
| Passenger app | `profiles` (own row): `name`, `language`, `fcm_token` | `completeProfile`, `estimateFare`, `requestRide`, `cancelRide`, `finishRideAsPassenger`, `reportProblem`, `rateDriver`, `triggerSos`, `updateSosLocation`, `markSosSafe`, `answerSafetyCheck`, `saveEmergencyContacts` |
| Driver app | `profiles` (own row): `name`, `language`, `fcm_token`; `driver_locations` (own row) | `setReady`, `setOffline`, `driverHeartbeat`, `acceptOffer`, `rejectOffer`, `markArrived`, `startRide`, `cancelNoShow`, `cancelRide`, `endRide`, `confirmCashReceived`, `reportDifference`, `triggerSos`, `updateSosLocation`, `markSosSafe`, `answerSafetyCheck`, `saveEmergencyContacts` |

---

## 15. Emergency SOS and incident response

### 15.1 Purpose and limits

The app lets a passenger or driver raise an emergency alert that goes to the **admin operations team, which monitors alerts 24 hours a day, 7 days a week**. The app does **not** dispatch police or medical services by itself. The operator decides whether to contact them. Automatic connection to law enforcement needs an official agreement and is out of scope for the pilot. Users are told plainly that the app does not replace calling emergency services directly.

### 15.2 Triggers

| Trigger | `SosTrigger` | How |
| --- | --- | --- |
| SOS button | `USER_BUTTON` | Press and hold for `sos_hold_seconds`, then a `sos_cancel_countdown_seconds` countdown in which the user can cancel. Available in both apps during an active ride; drivers can also use it while `READY`. |
| Long stop | `LONG_STOP` | Driver location unchanged for `long_stop_minutes` during `IN_PROGRESS`. First a safety check ("Are you OK?"), and an alert only if there is no answer. |
| Long disconnect | `DISCONNECT_TIMEOUT` | Driver disconnected for `disconnect_alert_minutes` during `IN_PROGRESS`. Same safety check. |
| No answer to a safety check | `SAFETY_CHECK_NO_RESPONSE` | `safety_check_response_seconds` pass with no answer. |

Not in this version: route-deviation detection, and a public live-tracking link for contacts.

### 15.3 What happens when an alert is raised

1. The server creates `sos_alerts/{id}` with a snapshot of the ride and both people's names and phone numbers.
2. `notifyOpsOfSos` sounds the alarm on the admin dashboard and sends an SMS to the primary operations phone.
3. If the user has emergency contacts, they receive an SMS with the name, plate, and a map link.
4. The user's screen shows buttons: **Call police, Call ambulance, Call operations, I'm safe** (numbers from `settings`). The user's location is sent every `sos_location_interval_seconds`.
5. If no operator acknowledges within `sos_escalation_seconds`, `sosEscalation` sends an SMS to every operations phone, and repeats.
6. Without internet, the screen falls back to the dialer buttons and a pre-filled SMS to the operations number.

### 15.4 Operator protocol (24/7)

1. **Acknowledge** the alert (`acknowledgeSos`). Target: within `sos_escalation_seconds`.
2. **Call the person** who raised it, then the other person in the ride.
3. Decide: contact police (991) or ambulance (907) using the details and live location, or confirm that all is well.
4. **Resolve** the alert (`resolveSos`) with an outcome and a written note. A note is always required.
5. "I'm safe" from the user is a signal only. The operator still calls and resolves the alert.
6. Everything is saved in `sos_alerts` and `audit_logs`.

### 15.5 Staffing, privacy, and consent

- At least one operator must be on duty at all times with a phone that receives the SMS. The admin updates `ops_phone_numbers` at every shift change. The duty rota is kept outside the app.
- If nobody can be on duty, do not run the service during those hours.
- At sign-up, users agree to location sharing for safety. Decide how long alert data is kept and who may see it (only admins).
- Test the SMS path regularly (for example weekly) so a failure is not found during a real emergency.

### 15.6 Ownership

| Part | Owner |
| --- | --- |
| SOS functions, jobs, SMS, escalation, rules | Backend |
| SOS screen, button, safety dialog, contacts screen (shared in `core`) | Passenger app owner; driver app owner reviews |
| SOS board, history, settings screens | Admin |
| Tests T32 to T40 | Admin and testing |
