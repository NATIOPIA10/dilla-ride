# Dilla Ride: Shared Technical Contract

**Contract version:** 1.3  |  **Date:** 23 October 2026  |  **Companion document:** Dilla Ride System Specification v2.0

This file is the single source of truth for names, data shapes, and server actions. The Android app, the backend (Firebase), and the admin dashboard must all follow it exactly. It sits in the repository at `docs/CONTRACT.md`.

Items marked **[PROPOSED]** are defaults that were not yet explicitly decided by the team. Confirm or change them in Phase 0, then remove the marker.

---

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
| Field names | camelCase (`pickupLocation`). |
| Enum values | UPPER_SNAKE_CASE strings (`DRIVER_ACCEPTED`). |
| Collection names | camelCase, plural (`rides`, `driverLocations`). |
| Document IDs | Firestore auto IDs, except: `users/{uid}`, `drivers/{uid}`, `driverLocations/{uid}` use the Firebase Auth uid; `payments/{rideId}` uses the ride ID; `weeklyStatements/{driverId_weekId}`. |
| Time | Firestore `Timestamp` (UTC). Field names end in `At`. Show times to users in Africa/Addis_Ababa. |
| Locations | Firestore `GeoPoint`. In function inputs, a location is `{ "lat": number, "lng": number }`. |
| Distance | Integer metres. Field names end in `Meters`. |
| Money | **[PROPOSED]** Integer **santim** (1 birr = 100 santim). Field names end in `Santim`. Screens show birr (`2000` santim is "20 birr"). |
| Phone numbers | E.164 format, for example `+2519XXXXXXXX`. |
| Language codes | `am` (Amharic), `en` (English). |
| Weeks | **[PROPOSED]** `weekId` is the ISO week in Africa/Addis_Ababa, for example `2026-W43`. ISO weeks run Monday to Sunday, matching the Sunday 23:59 cutoff. |
| Function style | Firebase **callable** functions. Success: returns `{ "ok": true, "data": { ... } }`. Failure: throws a Firebase `HttpsError` whose `details.errorCode` is one of the codes in Section 9. |
| Idempotency | Functions that create things take a client-generated `requestId` (UUID). Repeating the same `requestId` returns the original result and never creates a duplicate. |
| Firestore location | **[PROPOSED, DECIDE IN PHASE 0]** The Firestore location cannot be changed after creation. Choose the region closest to Dilla that Firebase offers, and use the same region for Cloud Functions. |
| Android apps | Two separate apps share one `core` library: `android/passenger` (passenger app), `android/driver` (driver app), `android/core` (shared code). See Section 14. There is no role lock; each app accepts only its own role. |
| Android package names | **[PROPOSED, DECIDE IN PHASE 0]** One package name per app. They cannot be changed after release. |

---

## 2. Enums

### 2.1 Roles and status

| Enum | Values |
| --- | --- |
| `Role` | `PASSENGER`, `DRIVER`, `ADMIN` |
| `UserStatus` | `ACTIVE`, `BLOCKED` |
| `DriverApproval` | `PENDING`, `APPROVED`, `REJECTED` |
| `DriverAvailability` | `OFFLINE`, `READY`, `ON_RIDE`, `PAYMENT_PENDING` |

The role is stored as a custom claim `role` on the Firebase Auth account. The `users/{uid}.role` field is only a read-only copy.

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

Only Cloud Functions change `rides.status`.

| From | To | Triggered by (function) | Extra condition |
| --- | --- | --- | --- |
| (new) | `REQUESTED` | `requestRide` | Passes all checks |
| `REQUESTED` | `SEARCHING` | server (immediately) | none |
| `SEARCHING` | `DRIVER_ACCEPTED` | `acceptOffer` (driver) | Offer still `OFFERED` and not expired |
| `SEARCHING` | `NO_DRIVER_FOUND` | `dispatchNext` | No eligible driver left, or `searchDeadlineAt` passed |
| `REQUESTED`, `SEARCHING`, `DRIVER_ACCEPTED`, `ARRIVED_AT_PICKUP` | `CANCELLED` | `cancelRide` (passenger) | none |
| `DRIVER_ACCEPTED`, `ARRIVED_AT_PICKUP` | `CANCELLED` | `cancelRide` (driver) | Reason is not `PASSENGER_NO_SHOW` |
| `DRIVER_ACCEPTED` | `ARRIVED_AT_PICKUP` | `markArrived` (driver) | none |
| `ARRIVED_AT_PICKUP` | `CANCELLED` (`PASSENGER_NO_SHOW`) | `cancelNoShow` (driver) | `now >= noShowAvailableAt` |
| `ARRIVED_AT_PICKUP` | `IN_PROGRESS` | `startRide` (driver) | Correct PIN |
| `IN_PROGRESS` | `COMPLETED` | `endRide` (driver) | none |
| `IN_PROGRESS` | `COMPLETED` (`completedBy: PASSENGER`) | `finishRideAsPassenger` | Driver is disconnected |
| `IN_PROGRESS` | `CANCELLED` | `closeStalledRide` (admin) | Safety or stalled cases only |
| any non-final state | `EXPIRED` | `stalledRideFlagger` / cleanup | Open longer than the stalled limit |

Final states: `COMPLETED`, `CANCELLED`, `NO_DRIVER_FOUND`, `EXPIRED`.

Driver availability transitions:

| Event | Result |
| --- | --- |
| `setReady` succeeds | `READY`, `wantsOnline = true` |
| `setOffline` | `OFFLINE`, `wantsOnline = false` |
| `acceptOffer` | `ON_RIDE`, `currentRideId` set |
| Ride completes (by `endRide` or `finishRideAsPassenger`) | `PAYMENT_PENDING`, `paymentLockRideId` set |
| Ride cancelled (driver was `ON_RIDE`) | `READY` if `wantsOnline`, else `OFFLINE`; `currentRideId` cleared |
| `confirmCashReceived` | `paymentLockRideId` cleared; `READY` if `wantsOnline`, else `OFFLINE` |
| Connection lost while `READY` | `OFFLINE` (`wantsOnline` stays `true`) |
| Connection returns, `wantsOnline` is `true`, availability is `OFFLINE`, no payment lock | `READY` |
| Connection lost or returns while `ON_RIDE` or `PAYMENT_PENDING` | No change (only `connected` is updated) |

---

## 4. Calculations

**Fare** (computed only on the server, using the active `fareConfigs` version):

```
rawSantim  = baseFareSantim + (distanceMeters / 1000) * pricePerKmSantim
fareSantim = ceilToWholeBirr( max(minimumFareSantim, rawSantim) )   // [PROPOSED] rounded up to a multiple of 100
```

- `distanceMeters` is the road distance from the map provider, avoiding banned roads where the provider supports it.
- The fare is fixed when the ride is requested. It never changes for that ride.

**Commission** (when the driver confirms cash received, and again if a dispute changes the fare):

```
commissionSantim = round( confirmedFareSantim * commissionPercent / 100 )
```

`commissionPercent` comes from the `fareConfigs` version stored on the ride. Default is 10.

**Dispatch (choosing the driver)**, run by `dispatchNext`:

1. Candidates: drivers with `availability == READY`, `approval == APPROVED`, user `status == ACTIVE`, `connected == true`, a `driverLocations.updatedAt` newer than `staleLocationSeconds`, not in the ride's `triedDriverIds`, and within `maxPickupDistanceMeters` of the pickup.
2. Sort by straight-line distance to the pickup. Take the nearest.
3. Create the offer, add the driver to `triedDriverIds`, set `currentOfferDriverId`, send the `RIDE_OFFER` push, and schedule `offerTimeout`.
4. If no candidate is left or `searchDeadlineAt` has passed, set the ride to `NO_DRIVER_FOUND`.

---

## 5. Config documents (admin-adjustable values)

Never hard-code these. Apps and functions read them.

### 5.1 `fareConfigs/{version}` (one document per version; never edited, only added)

| Field | Type | Notes |
| --- | --- | --- |
| `version` | number | 1, 2, 3, and so on. Also the document ID. |
| `baseFareSantim` | number | To be set (open item). |
| `pricePerKmSantim` | number | To be set (open item). |
| `minimumFareSantim` | number | Default `2000` (20 birr). Admin cannot go below `2000` unless `overrideValidation` is used. |
| `noShowWaitSeconds` | number | Default `120`. |
| `commissionPercent` | number | Default `10`. |
| `createdBy` | string | Admin uid. |
| `createdAt` | Timestamp | |

### 5.2 `settings/current` (single document)

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `activeFareConfigVersion` | number | 1 | Which `fareConfigs` version new rides use. |
| `offerTimeoutSeconds` | number | 25 | Time a driver has to answer an offer (20 to 30). |
| `searchTimeoutSeconds` | number | 180 | **[PROPOSED]** Total time to find a driver before `NO_DRIVER_FOUND`. |
| `maxPickupDistanceMeters` | number | 5000 | **[PROPOSED]** Search radius for drivers. |
| `staleLocationSeconds` | number | 300 | Drivers with older locations are skipped (status unchanged). |
| `moveThresholdMeters` | number | 200 | Driver app sends a location after moving this far. |
| `readyReminderHours` | number | 12 | Reminder after this long as `READY`. |
| `stalledRideHours` | number | 12 | Rides open this long appear in the admin stalled list. |
| `maxPinAttempts` | number | 5 | **[PROPOSED]** |
| `otpExpirySeconds` | number | 300 | **[PROPOSED]** |
| `otpMaxRequestsPerHour` | number | 3 | **[PROPOSED]** Per phone number. |
| `otpMaxVerifyAttempts` | number | 5 | **[PROPOSED]** |
| `emergencyNumbers` | map | `{ police: "991", ambulance: "907", fire: "939", trafficPolice: "945" }` | **[PROPOSED]** Confirm with the Dilla police station and a local clinic or Red Cross. Apps open the phone dialer with these. |
| `opsPhoneNumbers` | string[] | none | Operations phones that receive SOS SMS. First is primary, the rest are backup. The admin updates this at every shift change. |
| `sosHoldSeconds` | number | 3 | **[PROPOSED]** Press and hold time for the SOS button. |
| `sosCancelCountdownSeconds` | number | 5 | **[PROPOSED]** Time to cancel after the hold. |
| `sosLocationIntervalSeconds` | number | 10 | **[PROPOSED]** Location updates while an SOS is open. |
| `sosEscalationSeconds` | number | 120 | **[PROPOSED]** If an alert is still `OPEN`, notify all backup phones, and repeat at this interval (up to 5 times). |
| `safetyCheckResponseSeconds` | number | 60 | **[PROPOSED]** Time to answer "Are you OK?". |
| `longStopMinutes` | number | 10 | **[PROPOSED]** No driver location update during `IN_PROGRESS` for this long triggers a safety check. |
| `disconnectAlertMinutes` | number | 15 | **[PROPOSED]** Driver disconnected during `IN_PROGRESS` for this long triggers a safety check. |
| `updatedBy`, `updatedAt` | string, Timestamp | | |

---

## 6. Firestore collections

`?` after a type means the field may be `null`.

### 6.1 `users/{uid}`

| Field | Type | Notes |
| --- | --- | --- |
| `role` | `Role` | Read-only copy of the custom claim. |
| `name` | string | Client may edit. |
| `phone` | string | E.164. Not editable. |
| `language` | `am` or `en` | Client may edit. |
| `status` | `UserStatus` | Server only. |
| `fcmToken` | string? | Client may edit. |
| `activeRideId` | string? | Passengers only. Set by `requestRide`, cleared when the ride reaches a final state. Server only. The passenger app reads it on start to reopen the current ride. |
| `activeSosId` | string? | Set by `triggerSos`, cleared when the alert is `RESOLVED`. Server only. The app reads it on start to reopen the SOS screen. |
| `emergencyContacts` | array? | Up to 2 entries `{ name: string, phone: string }`. Written only by `saveEmergencyContacts`. Readable by the user and admins. |
| `createdAt`, `updatedAt` | Timestamp | |

### 6.2 `drivers/{uid}`

| Field | Type | Notes |
| --- | --- | --- |
| `approval` | `DriverApproval` | Admin via `approveDriver`. |
| `licenseNumber` | string | |
| `motorcycle` | map | `{ plate: string, model: string, color: string }` |
| `photoUrl` | string? | |
| `availability` | `DriverAvailability` | Server only. |
| `wantsOnline` | boolean | `true` after `setReady`, `false` after `setOffline`. Used to decide whether to return to `READY`. |
| `connected` | boolean | Mirrored from Realtime Database presence. |
| `lastSeenAt` | Timestamp? | |
| `currentRideId` | string? | |
| `paymentLockRideId` | string? | Set while cash is not yet confirmed. Blocks `setReady` and offers. |
| `readyReminderSentAt` | Timestamp? | |
| `lastReadyAt` | Timestamp? | When `READY` started. |
| `ratingAverage` | number | |
| `ratingCount` | number | |
| `createdAt`, `updatedAt` | Timestamp | |

### 6.3 `driverLocations/{uid}`

Kept separate because it changes most often.

| Field | Type | Notes |
| --- | --- | --- |
| `location` | GeoPoint | |
| `geohash` | string | For nearby lookups. |
| `heading` | number? | Degrees, optional. |
| `updatedAt` | Timestamp | |

The driver app writes this document directly. It sends a new location after moving `moveThresholdMeters`, only while `READY` or `ON_RIDE`.

### 6.4 `rides/{rideId}`

| Field | Type | Notes |
| --- | --- | --- |
| `passengerId` | string | |
| `driverId` | string? | Set on accept. |
| `status` | `RideStatus` | |
| `pickup` | map | `{ location: GeoPoint, address: string, meetingPointId: string? }` |
| `destination` | map | `{ location: GeoPoint, address: string, meetingPointId: string? }` |
| `distanceMeters` | number | |
| `fareSantim` | number | Fixed at request time. |
| `fareConfigVersion` | number | The version used for this ride. |
| `requestId` | string | Idempotency key from the client. |
| `previousRideId` | string? | **[PROPOSED]** Set when the passenger searched again after a driver cancelled. |
| `triedDriverIds` | string[] | Drivers already offered this ride. |
| `currentOfferDriverId` | string? | |
| `searchDeadlineAt` | Timestamp | |
| `driverSnapshot` | map? | `{ name, plate, model, color, ratingAverage, photoUrl }` copied on accept. |
| `passengerSnapshot` | map? | `{ name }` copied on accept. |
| `contact` | map? | `{ driverPhone, passengerPhone }`. Added only after accept. |
| `driverConnected` | boolean? | Mirror for the passenger app. Drives the Finish ride button. |
| `lastDriverLocation` | map? | `{ location: GeoPoint, updatedAt: Timestamp }`. Saved when the driver disconnects mid-ride. |
| `noShowAvailableAt` | Timestamp? | `arrivedAt + noShowWaitSeconds`. |
| `createdAt`, `acceptedAt`, `arrivedAt`, `startedAt`, `completedAt`, `cancelledAt` | Timestamp? | |
| `cancelledBy` | `CancelledBy`? | |
| `cancelReason` | `CancelReason`? | |
| `completedBy` | `CompletedBy`? | |
| `passengerRatingOfDriver` | number? | 1 to 5, **[PROPOSED]** |
| `stalled` | boolean | Set by `stalledRideFlagger`. |
| `safetyCheck` | map? | `{ reason: SosTrigger, sentAt: Timestamp, expiresAt: Timestamp, answeredAt: Timestamp?, ok: boolean? }`. Set by `safetyMonitor`. |

### 6.5 `rides/{rideId}/offers/{driverId}`

| Field | Type | Notes |
| --- | --- | --- |
| `rideId` | string | Copy of the parent ride ID (needed for collection group queries). |
| `driverId` | string | Same as the document ID. |
| `status` | `OfferStatus` | |
| `distanceToPickupMeters` | number | |
| `offeredAt`, `expiresAt` | Timestamp | |
| `respondedAt` | Timestamp? | |

### 6.6 `rides/{rideId}/private/pin`

| Field | Type | Notes |
| --- | --- | --- |
| `pin` | string | 4 digits. Readable only by the passenger. The driver can never read it. |
| `failedAttempts` | number | |

### 6.7 `payments/{rideId}`

| Field | Type | Notes |
| --- | --- | --- |
| `rideId`, `driverId`, `passengerId` | string | |
| `fareSantim` | number | Full fare from the ride. |
| `confirmedFareSantim` | number | Starts equal to `fareSantim`. Changed only by `resolveDispute`. |
| `status` | `PaymentStatus` | See rules below. |
| `commissionPercent` | number | Copied from the fare config of the ride. |
| `commissionSantim` | number | Based on `confirmedFareSantim`. |
| `weekId` | string | Week of completion. |
| `driverConfirmedAt` | Timestamp? | |
| `difference` | map? | `{ reportedReceivedSantim: number, reason: string, reportedAt: Timestamp }` |
| `disputeId` | string? | |
| `createdAt`, `updatedAt` | Timestamp | |

Payment status rules:
- Created as `PENDING_DRIVER_CONFIRMATION` when the ride becomes `COMPLETED`.
- `confirmCashReceived` sets `PAID`, unless a dispute is open on this ride, then `DISPUTED`.
- Opening a dispute after the driver confirmed sets `DISPUTED`. Before the driver confirmed, the status stays `PENDING_DRIVER_CONFIRMATION` and `disputeId` is set.
- `resolveDispute` sets `PAID`.
- The ride counts at the full fare until the dispute is resolved.

### 6.8 `disputes/{disputeId}`

| Field | Type | Notes |
| --- | --- | --- |
| `rideId`, `driverId`, `passengerId` | string | |
| `type` | `DisputeType` | |
| `raisedBy` | `PASSENGER` or `DRIVER` | |
| `reportedReceivedSantim` | number? | For `DRIVER_DIFFERENCE`. |
| `reason` | string | |
| `passengerPhone`, `driverPhone` | string | For the admin verification call. Admin read only. |
| `status` | `DisputeStatus` | |
| `outcome` | `DisputeOutcome`? | |
| `confirmedFareSantim` | number? | Set on resolution. |
| `adminNote` | string? | |
| `resolvedBy` | string? | |
| `createdAt`, `resolvedAt` | Timestamp | |

### 6.9 `restrictedZones/{zoneId}`

| Field | Type | Notes |
| --- | --- | --- |
| `name` | string | |
| `type` | `ZoneType` | |
| `polygon` | GeoPoint[]? | Used when `type == AREA`. |
| `line` | GeoPoint[]? | Used when `type == ROAD`. |
| `bufferMeters` | number? | For `ROAD`. **[PROPOSED]** default 15. |
| `active` | boolean | |
| `updatedBy`, `updatedAt` | string, Timestamp | |

### 6.10 `meetingPoints/{pointId}`

| Field | Type | Notes |
| --- | --- | --- |
| `name` | string | For example "University main gate". |
| `location` | GeoPoint | |
| `zoneId` | string | The zone it serves. |
| `active` | boolean | |

### 6.11 `weeklyStatements/{driverId_weekId}`

| Field | Type | Notes |
| --- | --- | --- |
| `driverId`, `weekId` | string | |
| `weekStartAt`, `weekEndAt` | Timestamp | Monday 00:00 to Sunday 23:59:59, Addis Ababa time. |
| `rideCount` | number | |
| `totalFaresSantim` | number | |
| `commissionSantim` | number | |
| `adjustmentsSantim` | number | **[PROPOSED]** Dispute corrections that arrive after the statement was paid are added to the next unpaid statement. |
| `status` | `StatementStatus` | |
| `closedAt`, `paidAt` | Timestamp? | |
| `markedPaidBy` | string? | |

### 6.12 `auditLogs/{logId}`

| Field | Type | Notes |
| --- | --- | --- |
| `actorId` | string | |
| `actorRole` | `Role` | |
| `action` | string | Function name, for example `updateFareConfig`. |
| `target` | string | Document path. |
| `before`, `after` | map? | |
| `createdAt` | Timestamp | |

### 6.13 `otpRequests/{phoneHash}` (server only)

`codeHash`, `expiresAt`, `verifyAttempts`, `requestTimestamps` (array, for the hourly limit), `lastSentAt`. No client access at all.

### 6.14 `sosAlerts/{sosId}`

| Field | Type | Notes |
| --- | --- | --- |
| `requestId` | string | Idempotency key. |
| `rideId` | string? | Null when raised without a ride (for example a `READY` driver). |
| `raisedByUserId` | string? | Null when raised by the system. |
| `raisedBy` | `SosRaisedBy` | |
| `trigger` | `SosTrigger` | |
| `status` | `SosStatus` | |
| `location` | GeoPoint | Latest known location. |
| `locationUpdatedAt` | Timestamp | |
| `rideSnapshot` | map? | `{ passengerName, passengerPhone, driverName, driverPhone, plate, model, color, rideStatus, pickupAddress, destinationAddress }` copied at creation. |
| `contactsNotifiedAt` | Timestamp? | When the user's emergency contacts were sent an SMS. |
| `opsNotifiedAt` | Timestamp? | When the first operations SMS and dashboard alert were sent. |
| `escalatedAt` | Timestamp? | Last escalation to backup phones. |
| `escalationCount` | number | |
| `userMarkedSafeAt` | Timestamp? | Set by `markSosSafe`. Does not close the alert. |
| `acknowledgedBy`, `acknowledgedAt` | string?, Timestamp? | |
| `resolvedBy`, `resolvedAt` | string?, Timestamp? | |
| `outcome` | `SosOutcome`? | |
| `adminNote` | string? | Required to resolve. |
| `createdAt` | Timestamp | |

Subcollection `sosAlerts/{sosId}/track/{pointId}`: `{ location: GeoPoint, at: Timestamp }`, one entry per `updateSosLocation`. The trail is for the admin and for later review.

Access: the person who raised the alert may read their own alert document except `adminNote`, and nobody can write it directly. Admins read everything. The `track` subcollection is admin read only.

---

## 7. Realtime Database presence and direct client access

### 7.1 Presence

Path: `/presence/{driverUid}` with `{ "connected": boolean, "lastChangedAt": serverTimestamp }`.

The driver app, after login, sets `connected = true` and registers `onDisconnect` to set `connected = false`. The function `presenceSync` reacts to changes (Section 10).

### 7.2 What clients may write directly

Everything else goes through functions.

| Client | Allowed direct writes |
| --- | --- |
| Passenger app | `users/{ownUid}`: `name`, `language`, `fcmToken` only. |
| Driver app | `users/{ownUid}`: `name`, `language`, `fcmToken` only. `driverLocations/{ownUid}` only while `availability` is `READY` or `ON_RIDE`. Realtime Database `/presence/{ownUid}`. |
| Admin dashboard | None. All admin changes go through functions so they are validated and logged. |

All reads follow the security rules in the specification, Section 12.

### 7.3 What each app listens to (real-time listeners, no polling)

| App | Listens to |
| --- | --- |
| Passenger | `users/{uid}` (for `activeRideId`); `rides/{activeRideId}`; `rides/{id}/private/pin` once the ride is accepted; `driverLocations/{driverId}` while the ride is active; `restrictedZones` and `meetingPoints` for the map. |
| Driver | `drivers/{uid}`; collection group `offers` where `driverId == uid` and `status == OFFERED`; `rides/{currentRideId}`; `payments/{paymentLockRideId}`; `restrictedZones` for the red map layer. Push `RIDE_OFFER` wakes the app, the listener provides the data. |
| Admin dashboard | `drivers` and `driverLocations` (overview); `rides`; `payments`; `disputes`; `weeklyStatements`; `auditLogs`; config documents; **`sosAlerts` where `status != RESOLVED` (the SOS board, with a loud alarm while any alert is `OPEN`)** and `sosAlerts/{id}/track` for an open alert. |
| Passenger and driver apps (SOS) | `users/{uid}` for `activeSosId`; `sosAlerts/{activeSosId}` (own alert) while an SOS is open. |

Apps must never poll on a timer. Stop listeners when the screen or role no longer needs them (this keeps read costs low).

### 7.4 Required Firestore indexes (owner: backend, file `firestore.indexes.json`)

| Collection | Fields | Used for |
| --- | --- | --- |
| collection group `offers` | `driverId` ASC, `status` ASC | Driver offer listener |
| `rides` | `status` ASC, `createdAt` DESC | Admin rides list |
| `rides` | `stalled` ASC, `createdAt` DESC | Admin stalled list |
| `rides` | `passengerId` ASC, `createdAt` DESC | Passenger history |
| `rides` | `driverId` ASC, `createdAt` DESC | Driver history |
| `payments` | `driverId` ASC, `weekId` ASC | Driver earnings and statements |
| `payments` | `status` ASC, `createdAt` DESC | Admin payments list |
| `disputes` | `status` ASC, `createdAt` DESC | Admin dispute queue |
| `drivers` | `availability` ASC | Admin overview |
| `sosAlerts` | `status` ASC, `createdAt` DESC | Admin SOS board |

---

## 8. Server actions (callable Cloud Functions)

Every function: checks the caller's role, checks the caller is not `BLOCKED`, checks the current status of the objects involved, runs its writes in one transaction, and is safe to repeat. Unless stated, a success response is `{ "ok": true, "data": { ... } }`.

### 8.1 Sign-in (passenger)

**`sendOtp`** (caller: anyone, not signed in)
- Input: `{ "phone": "+2519..." }`
- Output: `{ "expiresInSeconds": number }`
- Does: limits requests per phone number, creates a code, stores it hashed with an expiry in `otpRequests`, sends it through Infobip.
- Errors: `INVALID_PHONE`, `RATE_LIMITED`, `PHONE_IS_DRIVER`, `SMS_SEND_FAILED`

**`verifyOtp`** (caller: anyone, not signed in)
- Input: `{ "phone": string, "code": string, "name": string? }` (`name` required for a new user)
- Output: `{ "customToken": string, "isNewUser": boolean }`. The app signs in with the custom token.
- Does: checks the code and the attempt limit, creates `users/{uid}` with role `PASSENGER` for a new user, sets the role claim.
- Errors: `OTP_INVALID`, `OTP_EXPIRED`, `OTP_ATTEMPTS_EXCEEDED`, `USER_BLOCKED`, `PHONE_IS_DRIVER`, `NAME_REQUIRED`

Driver sign-in does not use these. Drivers sign in with the email or username and password created by the admin (Firebase Auth). After the first login the app asks for a new password.

### 8.2 Passenger functions (caller role: `PASSENGER`)

**`estimateFare`** (does not create anything)
- Input: `{ "pickup": {lat,lng}, "destination": {lat,lng} }`
- Output: `{ "distanceMeters": number, "fareSantim": number, "fareConfigVersion": number, "pickupIssue": ZoneIssue?, "destinationIssue": ZoneIssue? }`
- `ZoneIssue` = `{ "code": "IN_RESTRICTED_ZONE" | "ON_BANNED_ROAD", "zoneName": string, "suggestedMeetingPoints": [ { "id": string, "name": string, "location": {lat,lng}, "distanceMeters": number } ] }`
- Errors: `ROUTE_NOT_AVAILABLE`

**`requestRide`**
- Input: `{ "requestId": string, "pickup": {lat,lng,address,meetingPointId?}, "destination": {lat,lng,address,meetingPointId?}, "expectedFareSantim": number, "previousRideId": string? }`
- Output: `{ "rideId": string, "fareSantim": number }`
- Does: checks the user has no active ride, runs the zone checks on pickup and destination, gets the road distance, computes the fare, creates the ride as `REQUESTED` then `SEARCHING`, sets `searchDeadlineAt`, sets `users/{uid}.activeRideId`, and starts `dispatchNext`. The PIN is created later, when a driver accepts. If `previousRideId` is given, the earlier driver is added to `triedDriverIds`.
- Errors: `USER_BLOCKED`, `ACTIVE_RIDE_EXISTS`, `PICKUP_IN_RESTRICTED_ZONE`, `DESTINATION_IN_RESTRICTED_ZONE`, `PICKUP_ON_BANNED_ROAD`, `DESTINATION_ON_BANNED_ROAD` (these four include `details.suggestedMeetingPoints`), `FARE_CHANGED` (includes `details.newFareSantim`; the app asks the passenger to confirm again), `ROUTE_NOT_AVAILABLE`

**`cancelRide`** (also usable by the driver, see 8.3)
- Input: `{ "rideId": string, "reason": CancelReason }`
- Output: `{ "status": "CANCELLED" }`
- Passenger may cancel in `REQUESTED`, `SEARCHING`, `DRIVER_ACCEPTED`, `ARRIVED_AT_PICKUP`. Closes any open offer (`CANCELLED`). If the driver was `ON_RIDE`, the driver returns to `READY` (if `wantsOnline`) or `OFFLINE`.
- Errors: `RIDE_NOT_FOUND`, `NOT_RIDE_PARTICIPANT`, `INVALID_RIDE_STATE`, `INVALID_REASON`

**`finishRideAsPassenger`**
- Input: `{ "rideId": string }`
- Output: `{ "status": "COMPLETED" }`
- Precondition: ride is `IN_PROGRESS` and the driver is disconnected (`drivers.connected == false`).
- Does: sets `COMPLETED`, `completedBy: PASSENGER`, `completedAt`; creates `payments/{rideId}`; sets the driver to `PAYMENT_PENDING` with `paymentLockRideId`.
- Errors: `RIDE_NOT_FOUND`, `NOT_RIDE_PARTICIPANT`, `INVALID_RIDE_STATE`, `DRIVER_STILL_CONNECTED`

**`reportProblem`**
- Input: `{ "rideId": string, "reason": string }`
- Output: `{ "disputeId": string }`
- Precondition: ride is `COMPLETED`, caller is its passenger. Creates a `PASSENGER_REPORT` dispute with the phone numbers for the admin.
- Errors: `RIDE_NOT_FOUND`, `NOT_RIDE_PARTICIPANT`, `INVALID_RIDE_STATE`, `DISPUTE_ALREADY_OPEN`

**`rateDriver`** **[PROPOSED]**
- Input: `{ "rideId": string, "stars": 1..5 }`. Ride must be `COMPLETED`. Updates the driver's rating. Error: `ALREADY_RATED`.

### 8.3 Driver functions (caller role: `DRIVER`)

**`setReady`**
- Input: none. Output: `{ "availability": "READY" }`
- Preconditions: `approval == APPROVED`, user `ACTIVE`, no active ride, no `paymentLockRideId`.
- Does: sets `READY`, `wantsOnline = true`, `lastReadyAt`.
- Errors: `DRIVER_NOT_APPROVED`, `USER_BLOCKED`, `PAYMENT_LOCKED` (includes `details.rideId`), `ACTIVE_RIDE_EXISTS`

**`setOffline`**
- Input: none. Output: `{ "availability": "OFFLINE" | "PAYMENT_PENDING" }`
- Allowed when `READY`, `OFFLINE`, or `PAYMENT_PENDING` (**[PROPOSED]**: in `PAYMENT_PENDING` it only sets `wantsOnline = false`, so the driver goes `OFFLINE` instead of `READY` after confirming cash). Sets `wantsOnline = false`.
- Errors: `CANNOT_GO_OFFLINE_NOW` (when `ON_RIDE`)

**`acceptOffer`**
- Input: `{ "rideId": string }`. Output: `{ "rideId": string }`
- Preconditions: the driver's offer is `OFFERED` and not expired; ride is `SEARCHING`; driver is `READY`.
- Does (one transaction): ride becomes `DRIVER_ACCEPTED`; sets `driverId`, `driverSnapshot`, `passengerSnapshot`, `contact`, `acceptedAt`; creates `private/pin`; offer `ACCEPTED`; driver `ON_RIDE` with `currentRideId`.
- Errors: `OFFER_EXPIRED`, `RIDE_NO_LONGER_AVAILABLE`, `DRIVER_NOT_READY`

**`rejectOffer`**
- Input: `{ "rideId": string }`. Offer becomes `REJECTED`, then `dispatchNext` runs. Errors: `OFFER_NOT_FOUND`, `OFFER_EXPIRED`

**`markArrived`**
- Input: `{ "rideId": string }`. Output: `{ "noShowAvailableAt": Timestamp }`
- Precondition: ride `DRIVER_ACCEPTED`, caller is its driver. Sets `ARRIVED_AT_PICKUP`, `arrivedAt`, `noShowAvailableAt`.
- Errors: `RIDE_NOT_FOUND`, `NOT_RIDE_PARTICIPANT`, `INVALID_RIDE_STATE`

**`startRide`**
- Input: `{ "rideId": string, "pin": string }`. Output: `{ "status": "IN_PROGRESS" }`
- Precondition: ride `ARRIVED_AT_PICKUP`. Checks the PIN on the server and counts failed attempts.
- Errors: `PIN_INVALID` (includes `details.attemptsLeft`), `PIN_ATTEMPTS_EXCEEDED`, `INVALID_RIDE_STATE`, `NOT_RIDE_PARTICIPANT`

**`cancelNoShow`**
- Input: `{ "rideId": string }`. Output: `{ "status": "CANCELLED" }`
- Precondition: ride `ARRIVED_AT_PICKUP` and `now >= noShowAvailableAt`. Sets `CANCELLED`, `cancelledBy: DRIVER`, `cancelReason: PASSENGER_NO_SHOW`. No fee. Counts toward the no-show flags.
- Errors: `NO_SHOW_WAIT_NOT_OVER` (includes `details.secondsLeft`), `INVALID_RIDE_STATE`, `NOT_RIDE_PARTICIPANT`

**`cancelRide`** (driver use)
- Same as 8.2, allowed for the driver in `DRIVER_ACCEPTED` and `ARRIVED_AT_PICKUP`, but the reason cannot be `PASSENGER_NO_SHOW` (use `cancelNoShow`). The passenger app then offers "Find another driver", which calls `requestRide` with `previousRideId`.

**`endRide`**
- Input: `{ "rideId": string }`. Output: `{ "status": "COMPLETED" }`
- Precondition: ride `IN_PROGRESS`, caller is its driver. Does the same as `finishRideAsPassenger` but with `completedBy: DRIVER`.
- Errors: `RIDE_NOT_FOUND`, `NOT_RIDE_PARTICIPANT`, `INVALID_RIDE_STATE`

**`confirmCashReceived`**
- Input: `{ "rideId": string }`. Output: `{ "availability": "READY" | "OFFLINE" }`
- Precondition: ride `COMPLETED`, payment `PENDING_DRIVER_CONFIRMATION`, caller is its driver. The driver never sends an amount.
- Does: payment `PAID` (or `DISPUTED` if a dispute is open); computes the commission; adds to the weekly statement; clears `paymentLockRideId` and `currentRideId`; sets `READY` if `wantsOnline`, else `OFFLINE`.
- Errors: `RIDE_NOT_FOUND`, `NOT_RIDE_PARTICIPANT`, `INVALID_RIDE_STATE`, `PAYMENT_ALREADY_CONFIRMED`

**`reportDifference`**
- Input: `{ "rideId": string, "receivedSantim": number, "reason": string }`. Output: `{ "disputeId": string }`
- Precondition: ride `COMPLETED`, caller is its driver, `0 <= receivedSantim < fareSantim`. The full fare stays recorded.
- Errors: `INVALID_AMOUNT`, `DISPUTE_ALREADY_OPEN`, `INVALID_RIDE_STATE`, `NOT_RIDE_PARTICIPANT`

### 8.4 Admin functions (caller role: `ADMIN`)

Every admin function writes an `auditLogs` entry (`before` and `after`).

| Function | Input | Output | Errors |
| --- | --- | --- | --- |
| `createDriver` | `{ name, phone, loginId, temporaryPassword, licenseNumber, motorcycle:{plate,model,color} }` | `{ uid }` | `PHONE_ALREADY_USED`, `LOGIN_ID_TAKEN`, `INVALID_PHONE` |
| `approveDriver` | `{ uid, approval: DriverApproval }` | `{ approval }` | `NOT_A_DRIVER` |
| `blockUser` | `{ uid, blocked: boolean, reason }` | `{ status }` | `USER_NOT_FOUND` |
| `updateFareConfig` | `{ baseFareSantim, pricePerKmSantim, minimumFareSantim, noShowWaitSeconds, commissionPercent, confirm: true, overrideValidation?: boolean }` | `{ version }` | `CONFIRMATION_REQUIRED`, `MINIMUM_FARE_TOO_LOW`, `PRICE_PER_KM_INVALID` |
| `updateSettings` | any subset of the `settings/current` fields | `{ updatedAt }` | `INVALID_VALUE` |
| `saveRestrictedZone` | `{ zoneId?, name, type, polygon? or line?, bufferMeters?, active }` | `{ zoneId }` | `INVALID_GEOMETRY` |
| `saveMeetingPoint` | `{ pointId?, name, location, zoneId, active }` | `{ pointId }` | `ZONE_NOT_FOUND` |
| `resolveDispute` | `{ disputeId, outcome: DisputeOutcome, confirmedFareSantim?, adminNote }` | `{ status }` | `DISPUTE_NOT_FOUND`, `DISPUTE_ALREADY_RESOLVED`, `INVALID_AMOUNT` |
| `closeStalledRide` | `{ rideId, note }` | `{ status }` | `RIDE_NOT_FOUND`, `INVALID_RIDE_STATE` |
| `markCommissionPaid` | `{ statementId }` | `{ status }` | `STATEMENT_NOT_FOUND`, `STATEMENT_ALREADY_PAID` |
| `acknowledgeSos` | `{ sosId }` | `{ status }` | `SOS_NOT_FOUND`, `SOS_ALREADY_RESOLVED` |
| `resolveSos` | `{ sosId, outcome: SosOutcome, adminNote }` | `{ status }` | `SOS_NOT_FOUND`, `SOS_ALREADY_RESOLVED`, `NOTE_REQUIRED` |

`resolveDispute` with `REDUCED_FARE_CONFIRMED` sets `confirmedFareSantim`, recalculates `commissionSantim`, sets payment `PAID`, and updates the weekly statement (or `adjustmentsSantim` of the next unpaid statement if that week is already paid).

### 8.5 Safety and SOS functions (caller role: `PASSENGER` or `DRIVER` unless stated)

**`triggerSos`**
- Input: `{ "requestId": string, "rideId": string?, "location": {lat,lng} }`
- Output: `{ "sosId": string }`
- Preconditions: user is `ACTIVE`. If `rideId` is given, the caller is its passenger or driver and the ride is `DRIVER_ACCEPTED`, `ARRIVED_AT_PICKUP`, or `IN_PROGRESS`. A driver may also raise an SOS with no ride. If the user already has an open alert, that alert is returned.
- Does: creates the alert with `rideSnapshot`, sets `users.activeSosId`, and triggers `notifyOpsOfSos` and `sosEscalation` (Section 10). Sends the SMS to the user's emergency contacts if any.
- Errors: `SOS_ALREADY_OPEN` (includes `details.sosId`), `INVALID_RIDE_STATE`, `NOT_RIDE_PARTICIPANT`, `USER_BLOCKED`

**`updateSosLocation`**
- Input: `{ "sosId": string, "location": {lat,lng} }`. Output: `{ "ok": true }`
- Only the person who raised the alert, while it is not `RESOLVED`. Updates `location` and adds a `track` entry. Rate limited (about one per `sosLocationIntervalSeconds`).
- Errors: `SOS_NOT_FOUND`, `SOS_ALREADY_RESOLVED`, `RATE_LIMITED`, `NOT_RIDE_PARTICIPANT`

**`markSosSafe`**
- Input: `{ "sosId": string }`. Output: `{ "ok": true }`
- Sets `userMarkedSafeAt` and notifies the operators ("user says they are safe"). **The alert stays open until an operator resolves it**, so a person cannot be pressured into cancelling.
- Errors: `SOS_NOT_FOUND`, `SOS_ALREADY_RESOLVED`

**`answerSafetyCheck`**
- Input: `{ "rideId": string, "ok": boolean }`. Output: `{ "ok": true }`
- `ok: true` clears the safety check. `ok: false` raises an SOS with trigger `USER_BUTTON`.
- Errors: `NO_ACTIVE_SAFETY_CHECK`, `NOT_RIDE_PARTICIPANT`

**`saveEmergencyContacts`**
- Input: `{ "contacts": [ { "name": string, "phone": string } ] }` (at most 2). Output: `{ "ok": true }`
- Replaces the user's contacts. Errors: `TOO_MANY_CONTACTS`, `INVALID_PHONE`

---

## 9. Error codes

Errors are thrown as Firebase `HttpsError` with a general `code` and `details.errorCode` set to one of the values below. Apps decide their message from `details.errorCode`, never from the English text.

| `details.errorCode` | Firebase `code` | Meaning |
| --- | --- | --- |
| `UNAUTHENTICATED` | `unauthenticated` | Not signed in. |
| `PERMISSION_DENIED` | `permission-denied` | Wrong role. |
| `USER_BLOCKED` | `permission-denied` | The account is blocked. |
| `NOT_RIDE_PARTICIPANT` | `permission-denied` | Caller is not the passenger or driver of this ride. |
| `INVALID_PHONE`, `NAME_REQUIRED`, `INVALID_AMOUNT`, `INVALID_REASON`, `INVALID_VALUE`, `INVALID_GEOMETRY` | `invalid-argument` | Bad input. |
| `RATE_LIMITED` | `resource-exhausted` | Too many requests. |
| `OTP_INVALID`, `OTP_EXPIRED`, `OTP_ATTEMPTS_EXCEEDED` | `failed-precondition` | Code problems. |
| `PHONE_IS_DRIVER` | `failed-precondition` | The phone number belongs to a driver account. |
| `SMS_SEND_FAILED` | `unavailable` | Infobip could not send. |
| `RIDE_NOT_FOUND`, `OFFER_NOT_FOUND`, `USER_NOT_FOUND`, `DISPUTE_NOT_FOUND`, `STATEMENT_NOT_FOUND`, `ZONE_NOT_FOUND` | `not-found` | Missing document. |
| `ACTIVE_RIDE_EXISTS` | `failed-precondition` | The user already has an active ride. |
| `INVALID_RIDE_STATE` | `failed-precondition` | The ride status does not allow this action. |
| `RIDE_NO_LONGER_AVAILABLE` | `failed-precondition` | Ride already taken, cancelled, or ended. |
| `OFFER_EXPIRED` | `deadline-exceeded` | Offer time ran out. |
| `DRIVER_NOT_APPROVED`, `DRIVER_NOT_READY`, `NOT_A_DRIVER` | `failed-precondition` | Driver state problems. |
| `PAYMENT_LOCKED` | `failed-precondition` | Driver must confirm cash first. `details.rideId`. |
| `CANNOT_GO_OFFLINE_NOW` | `failed-precondition` | Driver is on a ride. |
| `DRIVER_STILL_CONNECTED` | `failed-precondition` | Passenger cannot finish yet. |
| `PIN_INVALID` | `failed-precondition` | Wrong PIN. `details.attemptsLeft`. |
| `PIN_ATTEMPTS_EXCEEDED` | `resource-exhausted` | Too many wrong PINs. |
| `NO_SHOW_WAIT_NOT_OVER` | `failed-precondition` | `details.secondsLeft`. |
| `PICKUP_IN_RESTRICTED_ZONE`, `DESTINATION_IN_RESTRICTED_ZONE`, `PICKUP_ON_BANNED_ROAD`, `DESTINATION_ON_BANNED_ROAD` | `failed-precondition` | `details.suggestedMeetingPoints`. |
| `FARE_CHANGED` | `failed-precondition` | `details.newFareSantim`. |
| `ROUTE_NOT_AVAILABLE` | `unavailable` | The map provider could not route. |
| `PAYMENT_ALREADY_CONFIRMED`, `DISPUTE_ALREADY_OPEN`, `DISPUTE_ALREADY_RESOLVED`, `STATEMENT_ALREADY_PAID`, `ALREADY_RATED` | `already-exists` | Repeated action. |
| `CONFIRMATION_REQUIRED`, `MINIMUM_FARE_TOO_LOW`, `PRICE_PER_KM_INVALID` | `failed-precondition` | Admin fare rules. |
| `PHONE_ALREADY_USED`, `LOGIN_ID_TAKEN` | `already-exists` | Driver creation conflicts. |
| `SOS_ALREADY_OPEN` | `already-exists` | The user already has an open alert. `details.sosId`. |
| `SOS_NOT_FOUND` | `not-found` | Missing alert. |
| `SOS_ALREADY_RESOLVED` | `failed-precondition` | The alert is closed. |
| `NOTE_REQUIRED` | `invalid-argument` | An operator note is required to resolve. |
| `TOO_MANY_CONTACTS` | `invalid-argument` | More than 2 emergency contacts. |
| `NO_ACTIVE_SAFETY_CHECK` | `failed-precondition` | No safety check is waiting for an answer. |

---

## 10. Automatic jobs (no button)

| Job | Trigger | What it does |
| --- | --- | --- |
| `dispatchNext` | Called by `requestRide`, `rejectOffer`, `offerTimeout`, and `cancelRide` of a driver | Runs the dispatch steps in Section 4. Ends the search with `NO_DRIVER_FOUND` if needed. |
| `offerTimeout` | Task queue, scheduled when an offer is created, runs at `expiresAt` | If the offer is still `OFFERED`, sets `TIMED_OUT` and calls `dispatchNext`. Does not change the driver's availability. |
| `presenceSync` | Realtime Database change at `/presence/{uid}` | Mirrors `connected` and `lastSeenAt` to `drivers`. On disconnect: `READY` drivers become `OFFLINE`; if `ON_RIDE`, sets the ride's `driverConnected = false` and saves `lastDriverLocation`. On reconnect: sets `driverConnected = true`; applies the return-to-`READY` rule from Section 3. |
| `readyReminder` | Scheduled (every 15 minutes) | Sends `READY_REMINDER` to drivers `READY` for `readyReminderHours` or more, once per period. Does not change status. |
| `stalledRideFlagger` | Scheduled (hourly) | Sets `stalled = true` on rides open for `stalledRideHours`. Such rides appear in the admin list and may later become `EXPIRED`. |
| `weeklyStatement` | Scheduled, Sunday 23:59 Africa/Addis_Ababa | Totals the week's payments per driver, sets `closedAt`, status `UNPAID`. |
| `notifyOnRideChange` | Firestore trigger on `rides` update | Sends the push for the new status (Section 11) to the passenger or driver. |
| `notifyOpsOfSos` | Firestore trigger when a `sosAlerts` document is created | Sends the alarm to the admin dashboard and an SMS (Infobip) to the **primary** `opsPhoneNumbers` entry with the name, plate, and a map link of the location. Sets `opsNotifiedAt`. If SMS fails, retries and logs the failure; the dashboard alarm and push still go out. |
| `sosEscalation` | Task queue, scheduled at alert creation and every `sosEscalationSeconds` | If the alert is still `OPEN`, sends an SMS to **all** `opsPhoneNumbers`, sets `escalatedAt`, and increments `escalationCount` (up to 5 times). Stops once the alert is acknowledged. |
| `safetyMonitor` | Scheduled (every minute) | For rides `IN_PROGRESS`: if the driver has not sent a location for `longStopMinutes` while connected, or has been disconnected for `disconnectAlertMinutes`, sends a `SAFETY_CHECK` to both people and sets `rides.safetyCheck`. |
| `safetyCheckTimeout` | Task queue, at `safetyCheck.expiresAt` | If no one answered, raises an SOS with trigger `SAFETY_CHECK_NO_RESPONSE` (or the original reason). |

---

## 11. Push notifications (Firebase Cloud Messaging)

All pushes are **data messages with high priority**. The app builds the visible notification itself from the data fields.

Common fields: `type`, `rideId` (when relevant).

| `type` | To | Extra fields | Notes |
| --- | --- | --- | --- |
| `RIDE_OFFER` | Driver | `pickupAddress`, `distanceToPickupMeters`, `fareSantim`, `expiresAtMillis` | Opens the full-screen request screen with the looping alert. |
| `RIDE_ACCEPTED` | Passenger | `driverName`, `plate` | |
| `DRIVER_ARRIVED` | Passenger | `noShowAvailableAtMillis` | |
| `RIDE_STARTED` | Passenger | | |
| `RIDE_COMPLETED` | Both | `fareSantim` | |
| `RIDE_CANCELLED` | Both | `cancelledBy`, `cancelReason` | |
| `NO_DRIVER_FOUND` | Passenger | | |
| `DRIVER_DISCONNECTED` | Passenger | | Shows the Finish ride button. |
| `READY_REMINDER` | Driver | | After 12 hours as `READY`. |
| `SAFETY_CHECK` | Both | `reason`, `expiresAtMillis` | Channel `safety_alerts`. Shows "Are you OK?" with OK and Not OK. |
| `SOS_ACKNOWLEDGED` | The person who raised it | | "An operator is looking at your alert." |
| `SOS_RESOLVED` | The person who raised it | | |

Android notification channels (created once; a channel's sound cannot be changed afterwards, so finalize the sound file before launch):

| Channel ID | Importance | Sound | Used for |
| --- | --- | --- | --- |
| `ride_offers` | HIGH (maximum) | long custom sound `ride_request` | `RIDE_OFFER` |
| `ride_updates` | DEFAULT | default | Passenger and driver status updates |
| `reminders` | DEFAULT | default | `READY_REMINDER` |
| `driver_online` | LOW | none | The foreground service notification "You are online" |
| `safety_alerts` | HIGH (maximum) | distinct alert sound | `SAFETY_CHECK`, `SOS_ACKNOWLEDGED`, `SOS_RESOLVED` |

Channel ownership: `ride_offers`, `reminders`, and `driver_online` exist only in the driver app. `ride_updates` and `safety_alerts` exist in both apps (each app creates its own copy).

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
- Firestore and Functions region
- `searchTimeoutSeconds`, `maxPickupDistanceMeters`, `maxPinAttempts`, OTP limits
- Road `bufferMeters` for banned roads
- `estimateFare` and `rateDriver` functions
- `previousRideId` for "Find another driver"
- `setOffline` allowed during `PAYMENT_PENDING`
- Offer status `CANCELLED`
- `adjustmentsSantim` for disputes after a statement is paid
- SOS defaults: emergency numbers, hold and cancel times, escalation time, safety-check thresholds, and who staffs the 24/7 operations phones

**Change log**
| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 23 Oct 2026 | First version, based on System Specification v2.0. |
| 1.1 | 23 Oct 2026 | Added `users.activeRideId`; added `rideId` and `driverId` to offers; added Section 7.3 (listeners), 7.4 (indexes), and Section 13 (integration test scenarios). |
| 1.2 | 29 Oct 2026 | Team of 4. Two separate Android apps (passenger and driver) with a shared `core` module; no role lock; channel ownership; test T31; added Section 14. |
| 1.3 | 29 Oct 2026 | Emergency SOS and incident response, monitored by the admin team 24/7: enums (2.5), settings, `sosAlerts`, emergency contacts, functions (8.5, plus `acknowledgeSos` and `resolveSos`), jobs, push types, tests T32 to T40, and Section 15. |

---

## 13. Integration test scenarios (shared acceptance checks)

Run these on the Firebase emulators first, then on real phones. "Phase" is the earliest phase where the scenario can pass. A phase is done only when its scenarios pass.

| ID | Phase | Scenario | Expected result |
| --- | --- | --- | --- |
| T01 | 1 | New passenger: `sendOtp`, then `verifyOtp` with a name | `users` document created, role claim `PASSENGER`, signed in with the custom token. |
| T02 | 1 | Request 4 codes in an hour for one number; enter 6 wrong codes | 4th request gives `RATE_LIMITED`; wrong codes end in `OTP_ATTEMPTS_EXCEEDED`. |
| T03 | 1 | Admin `createDriver`; driver logs in; `setReady` before approval; driver phone used in `sendOtp` | Driver must change password; `DRIVER_NOT_APPROVED`; `PHONE_IS_DRIVER`. |
| T04 | 2 | `estimateFare` for a very short trip and for a longer trip | Short trip is 2000 santim (20 birr); longer trip follows the formula, rounded up to whole birr. |
| T05 | 2 | Admin changes fares while a ride is active; new request uses a stale `expectedFareSantim` | Active ride keeps its fare and version; new request returns `FARE_CHANGED` with `newFareSantim`. |
| T06 | 2 | Full ride: request, offer, accept, arrived, PIN, start, end, cash received | Ride `COMPLETED`; payment `PAID`; commission is 10% of the fare; driver back to `READY`. |
| T07 | 2 | Enter the wrong PIN repeatedly | `PIN_INVALID` with `attemptsLeft`, then `PIN_ATTEMPTS_EXCEEDED`; ride stays `ARRIVED_AT_PICKUP`. |
| T08 | 3 | Three `READY` drivers at different distances; first rejects, second ignores the offer | Nearest gets the offer; reject moves to next; 25-second timeout moves on; all fail gives `NO_DRIVER_FOUND`. |
| T09 | 3 | Driver accepts after the offer expired; double-tap on Accept | `OFFER_EXPIRED`; only one `acceptOffer` succeeds. |
| T10 | 3 | Driver cancels after accepting; passenger taps "Find another driver" | Ride `CANCELLED` (`DRIVER`); new ride created with `previousRideId`; that driver is not offered again. |
| T11 | 3 | `markArrived`, then `cancelNoShow` at 60 seconds and at 120 seconds | `NO_SHOW_WAIT_NOT_OVER` with `secondsLeft`; then `CANCELLED` with `PASSENGER_NO_SHOW`; driver back to `READY`. |
| T12 | 2 | Passenger cancels in `SEARCHING`, `DRIVER_ACCEPTED`, `ARRIVED_AT_PICKUP`; tries in `IN_PROGRESS` | Cancel works in the first three; `INVALID_RIDE_STATE` in `IN_PROGRESS`; open offers become `CANCELLED`. |
| T13 | 4 | After `endRide`, driver tries `setReady`; then `confirmCashReceived` | Driver is `PAYMENT_PENDING`, gets `PAYMENT_LOCKED`, receives no offers; after confirming, `READY` and receives the next offer. |
| T14 | 4 | Driver `reportDifference` (received 50 of 70 birr); admin resolves `REDUCED_FARE_CONFIRMED` at 50 | Dispute `OPEN`, commission stays on 70 until resolved; then recalculated on 50; audit log entry exists. |
| T15 | 4 | Passenger `reportProblem` after the ride | Dispute created; ride stays `COMPLETED`; admin sees both phone numbers. |
| T16 | 4 | Driver `READY`, turn on airplane mode; later reconnect. Repeat after the driver tapped "Go offline" | Becomes `OFFLINE` within about a minute and gets no offers; on reconnect returns to `READY` only if `wantsOnline` was `true`. |
| T17 | 4 | Driver loses connection during `IN_PROGRESS`; passenger taps Finish; driver reconnects | Passenger sees `DRIVER_DISCONNECTED` and Finish; ride `COMPLETED` with `completedBy: PASSENGER`; driver opens on Receive payment; after confirming, `READY`. |
| T18 | 4 | Driver loses connection during `IN_PROGRESS` and reconnects before the passenger finishes | Finish button disappears; driver app reopens the same ride and continues; ride still `IN_PROGRESS`. |
| T19 | 4 | Passenger taps Finish at the same moment the driver reconnects and taps End ride | Exactly one completion; no duplicate payment or commission; the other app updates. |
| T20 | 4 | Driver phone powered off mid-ride, later restarted | Ride stays `IN_PROGRESS`; on restart the app opens straight on the active ride or on Receive payment. |
| T21 | 3 | Driver `READY` with the screen locked; send an offer; move 250 m | Long loud alert and full-screen request appear; location updates continue (one write after 200 m). |
| T22 | 2 | Pickup inside the university area; then choose a gate meeting point | `PICKUP_IN_RESTRICTED_ZONE` with suggested gates; request succeeds from the gate; fare is to the gate. |
| T23 | 2, 3 | Destination on a banned road; driver enters a banned road | `DESTINATION_ON_BANNED_ROAD` with suggestions; driver app shows a warning only, nothing is flagged. |
| T24 | 1 | Admin blocks a passenger and a driver | `requestRide` returns `USER_BLOCKED`; the driver cannot `setReady`. |
| T25 | 1 | Security checks: passenger reads another ride's PIN; driver reads the PIN; passenger writes ride status; passenger reads `disputes`; call without sign-in | All refused (`PERMISSION_DENIED` or rules denial; `UNAUTHENTICATED` when not signed in). |
| T26 | 5 | A ride stays `IN_PROGRESS` past the stalled limit (shorten the limit in the emulator) | `stalled = true`; appears in the admin list; admin `closeStalledRide` works. |
| T27 | 5 | Complete rides before and after Sunday 23:59 Addis Ababa time; run `weeklyStatement`; `markCommissionPaid` | Rides fall in the correct `weekId`; statement totals match payments; status changes to `PAID`. |
| T28 | 5 | Driver stays `READY` for the reminder period | `READY_REMINDER` sent once; status unchanged. |
| T29 | 2 | Send `requestRide` twice with the same `requestId`; call `confirmCashReceived` twice | One ride; one commission; second call returns the existing result or `PAYMENT_ALREADY_CONFIRMED`. |
| T30 | 3 | Count writes for a moving driver, a parked driver, and an offline driver | Writes happen only after 200 m of movement and only while `READY` or `ON_RIDE`; offline driver writes nothing. |
| T31 | 1 | A driver's phone number requests a code in the passenger app; a passenger account signs in to the driver app | Passenger app gets `PHONE_IS_DRIVER`; the driver app refuses the wrong role, shows a clear message, and signs out. |
| T32 | 3 | Passenger holds the SOS button during `IN_PROGRESS` | Alert appears on the admin board with a loud alarm within a few seconds; operations SMS is sent; the user's screen shows call buttons for police, ambulance, and operations. |
| T33 | 3 | Driver raises an SOS during a ride, and again while `READY` with no ride | Both create alerts (`rideId` null for the second); same admin alarm and SMS. |
| T34 | 3 | Short press on SOS; hold then cancel inside the countdown | No alert is created in either case. |
| T35 | 3 | Operator acknowledges, then resolves with and without a note; user taps "I'm safe" first | `OPEN` to `ACKNOWLEDGED` to `RESOLVED`; resolve without a note gives `NOTE_REQUIRED`; "I'm safe" notifies the operator but the alert stays open until resolved; audit entries exist. |
| T36 | 3 | No operator acknowledges within the escalation time | SMS goes to all backup phones; `escalatedAt` set; repeats until acknowledged, then stops. |
| T37 | 5 | A ride stops for the long-stop time; user answers OK; repeat with no answer | `SAFETY_CHECK` push; OK clears it; no answer raises an SOS with the right trigger. |
| T38 | 3 | SOS with the phone in airplane mode | SOS screen offers the dialer buttons and a pre-filled SMS to the operations number; when the internet returns the alert is created and the location trail continues. |
| T39 | 3 | Security: another user reads an SOS alert; a user reads `adminNote` or the `track` trail; a client writes an alert directly | All refused. |
| T40 | 5 | Save two emergency contacts, then raise an SOS | Both contacts receive an SMS with the name, plate, and location link; a third contact is refused with `TOO_MANY_CONTACTS`. |

---

## 14. Android project structure and ownership (two apps)

### 14.1 Layout

```
android/
  core/        shared library module (used by both apps)
  passenger/   passenger app
  driver/      driver app
functions/     backend
admin/         web admin dashboard
docs/          specification, contract, role files
```

The two apps depend on `core` only. They never depend on each other.

### 14.2 What goes in `core`

| Item | Notes |
| --- | --- |
| `contract` package | Kotlin enums and data classes generated from Sections 2 and 6 (exact names). |
| `ContractFunctions` | One interface with one method per function in Section 8 (exact names), with a **real** Firebase implementation and a **fake** implementation with sample data. Each app uses only its own subset. |
| Error mapping | Converts `details.errorCode` (Section 9) into app messages (Amharic and English). |
| Map components | Map view, restricted-zone layer, meeting points, route display. **[PROPOSED]** |
| Theme and shared UI | Colors, typography, buttons, loading and error views. |
| Translations | Shared Amharic and English strings. |
| Helpers | Addis Ababa time formatting, birr formatting (santim to birr), geohash, distance. |
| Firebase setup | Initialization and App Check. |
| Safety (SOS) | Shared SOS button (press and hold, then a cancel countdown), the SOS screen (call buttons, "I'm safe", offline fallback), the safety check dialog, and the emergency contacts screen. |

### 14.3 Ownership rules

- **Passenger app:** owned by the passenger-app person. **Driver app:** owned by the driver-app person.
- **`core`:** **[PROPOSED]** owned by the passenger-app person. **Every change to `core` is reviewed by both app owners** before merging, and must not break either app's build. Add a build check that compiles both apps on every pull request.
- Code used by only one app stays in that app. Move it to `core` only when both apps need it.
- Nobody changes a contract name inside `core` without a contract change request.

### 14.4 Roles and sign-in per app

| App | Accepts role | Sign-in | If the wrong role signs in |
| --- | --- | --- | --- |
| Passenger app | `PASSENGER` | Phone number and SMS code (`sendOtp`, `verifyOtp`) | Show a "wrong app" message and sign out. |
| Driver app | `DRIVER` | Login ID and password from the admin | Show a "wrong app" message and sign out. |

After every sign-in, each app reads the role claim and checks it.

### 14.5 Firebase and distribution

- Register **two Android apps** in the same Firebase project, each with its own package name, its own `google-services.json`, and its own App Check provider.
- Pilot distribution: install the APK files directly. Later, two Play Store listings.
- Notification channels follow Section 11 (channel ownership).

### 14.6 What each app uses

| App | Direct writes (Section 7.2) | Functions called |
| --- | --- | --- |
| Passenger app | `users/{ownUid}`: `name`, `language`, `fcmToken` | `sendOtp`, `verifyOtp`, `estimateFare`, `requestRide`, `cancelRide`, `finishRideAsPassenger`, `reportProblem`, `rateDriver`, `triggerSos`, `updateSosLocation`, `markSosSafe`, `answerSafetyCheck`, `saveEmergencyContacts` |
| Driver app | `users/{ownUid}`: `name`, `language`, `fcmToken`; `driverLocations/{ownUid}`; Realtime Database `/presence/{ownUid}` | `setReady`, `setOffline`, `acceptOffer`, `rejectOffer`, `markArrived`, `startRide`, `cancelNoShow`, `cancelRide`, `endRide`, `confirmCashReceived`, `reportDifference`, `triggerSos`, `updateSosLocation`, `markSosSafe`, `answerSafetyCheck`, `saveEmergencyContacts` |

---

## 15. Emergency SOS and incident response

### 15.1 Purpose and limits

The app lets a passenger or driver raise an emergency alert that goes to the **admin operations team, which monitors alerts 24 hours a day, 7 days a week**. The app does **not** dispatch police or medical services by itself. The operator decides whether to contact them. Automatic connection to law enforcement needs an official agreement and is out of scope for the pilot. Users are told plainly that the app does not replace calling emergency services directly.

### 15.2 Triggers

| Trigger | `SosTrigger` | How |
| --- | --- | --- |
| SOS button | `USER_BUTTON` | Press and hold for `sosHoldSeconds`, then a `sosCancelCountdownSeconds` countdown in which the user can cancel. Available in both apps during an active ride; drivers can also use it while `READY`. |
| Long stop | `LONG_STOP` | Driver location unchanged for `longStopMinutes` during `IN_PROGRESS`. First a safety check ("Are you OK?"), and an alert only if there is no answer. |
| Long disconnect | `DISCONNECT_TIMEOUT` | Driver disconnected for `disconnectAlertMinutes` during `IN_PROGRESS`. Same safety check. |
| No answer to a safety check | `SAFETY_CHECK_NO_RESPONSE` | `safetyCheckResponseSeconds` pass with no answer. |

Not in this version: route-deviation detection, and a public live-tracking link for contacts.

### 15.3 What happens when an alert is raised

1. The server creates `sosAlerts/{id}` with a snapshot of the ride and both people's names and phone numbers.
2. `notifyOpsOfSos` sounds the alarm on the admin dashboard and sends an SMS to the primary operations phone.
3. If the user has emergency contacts, they receive an SMS with the name, plate, and a map link.
4. The user's screen shows buttons: **Call police, Call ambulance, Call operations, I'm safe** (numbers from `settings/current`). The user's location is sent every `sosLocationIntervalSeconds`.
5. If no operator acknowledges within `sosEscalationSeconds`, `sosEscalation` sends an SMS to every operations phone, and repeats.
6. Without internet, the screen falls back to the dialer buttons and a pre-filled SMS to the operations number.

### 15.4 Operator protocol (24/7)

1. **Acknowledge** the alert (`acknowledgeSos`). Target: within `sosEscalationSeconds`.
2. **Call the person** who raised it, then the other person in the ride.
3. Decide: contact police (991) or ambulance (907) using the details and live location, or confirm that all is well.
4. **Resolve** the alert (`resolveSos`) with an outcome and a written note. A note is always required.
5. "I'm safe" from the user is a signal only. The operator still calls and resolves the alert.
6. Everything is saved in `sosAlerts` and `auditLogs`.

### 15.5 Staffing, privacy, and consent

- At least one operator must be on duty at all times with a phone that receives the SMS. The admin updates `opsPhoneNumbers` at every shift change. The duty rota is kept outside the app.
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
