export type Role = 'PASSENGER' | 'DRIVER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'BLOCKED';
export type DriverApproval = 'PENDING' | 'APPROVED' | 'REJECTED';
export type DriverAvailability = 'OFFLINE' | 'READY' | 'ON_RIDE' | 'PAYMENT_PENDING';

export type RideStatus =
  | 'REQUESTED'
  | 'SEARCHING'
  | 'DRIVER_ACCEPTED'
  | 'ARRIVED_AT_PICKUP'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_DRIVER_FOUND'
  | 'EXPIRED';

export type OfferStatus = 'OFFERED' | 'ACCEPTED' | 'REJECTED' | 'TIMED_OUT' | 'CANCELLED';
export type CancelledBy = 'PASSENGER' | 'DRIVER' | 'ADMIN' | 'SYSTEM';
export type CancelReason =
  | 'PASSENGER_CHANGED_MIND'
  | 'DRIVER_UNAVAILABLE'
  | 'PASSENGER_NO_SHOW'
  | 'SAFETY'
  | 'OTHER';
export type CompletedBy = 'DRIVER' | 'PASSENGER';

export type PaymentStatus = 'PENDING_DRIVER_CONFIRMATION' | 'PAID' | 'DISPUTED';
export type DisputeType = 'PASSENGER_REPORT' | 'DRIVER_DIFFERENCE';
export type DisputeStatus = 'OPEN' | 'RESOLVED';
export type DisputeOutcome = 'FULL_FARE_CONFIRMED' | 'REDUCED_FARE_CONFIRMED' | 'DRIVER_AT_FAULT';
export type StatementStatus = 'UNPAID' | 'PAID';

export type ZoneType = 'AREA' | 'ROAD';

export type SosStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
export type SosRaisedBy = 'PASSENGER' | 'DRIVER' | 'SYSTEM';
export type SosTrigger =
  | 'USER_BUTTON'
  | 'SAFETY_CHECK_NO_RESPONSE'
  | 'LONG_STOP'
  | 'DISCONNECT_TIMEOUT';
export type SosOutcome = 'SAFE' | 'POLICE_CONTACTED' | 'AMBULANCE_CONTACTED' | 'FALSE_ALARM' | 'OTHER';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface EmergencyContact {
  name: string;
  phone: string;
}

export interface Profile {
  id: string;
  role: Role;
  name: string;
  phone: string;
  language: 'am' | 'en';
  status: UserStatus;
  fcm_token: string | null;
  active_ride_id: string | null;
  active_sos_id: string | null;
  emergency_contacts: EmergencyContact[] | null;
  created_at: string;
  updated_at: string;
}

export interface Driver {
  id: string;
  login_id: string;
  approval: DriverApproval;
  license_number: string;
  plate: string;
  model: string;
  color: string;
  photo_url: string | null;
  availability: DriverAvailability;
  wants_online: boolean;
  connected: boolean;
  last_seen_at: string | null;
  current_ride_id: string | null;
  payment_lock_ride_id: string | null;
  ready_reminder_sent_at: string | null;
  last_ready_at: string | null;
  rating_average: number;
  rating_count: number;
  created_at: string;
  updated_at: string;
}

export interface DriverLocation {
  driver_id: string;
  location: LatLng;
  heading: number | null;
  updated_at: string;
}

export interface Ride {
  id: string;
  passenger_id: string;
  driver_id: string | null;
  status: RideStatus;
  pickup_location: LatLng;
  destination_location: LatLng;
  pickup_address: string;
  destination_address: string;
  pickup_meeting_point_id: string | null;
  destination_meeting_point_id: string | null;
  distance_meters: number;
  fare_santim: number;
  fare_config_version: number;
  request_id: string;
  previous_ride_id: string | null;
  tried_driver_ids: string[];
  current_offer_driver_id: string | null;
  search_deadline_at: string;
  driver_snapshot: {
    name: string;
    plate: string;
    model: string;
    color: string;
    rating_average: number;
    photo_url: string | null;
  } | null;
  passenger_snapshot: {
    name: string;
  } | null;
  contact: {
    driver_phone: string;
    passenger_phone: string;
  } | null;
  driver_connected: boolean | null;
  last_driver_location: { lat: number; lng: number; updated_at: string } | null;
  no_show_available_at: string | null;
  created_at: string;
  accepted_at: string | null;
  arrived_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancelled_by: CancelledBy | null;
  cancel_reason: CancelReason | null;
  completed_by: CompletedBy | null;
  passenger_rating_of_driver: number | null;
  stalled: boolean;
  safety_check: {
    reason: SosTrigger;
    sent_at: string;
    expires_at: string;
    answered_at?: string | null;
    ok?: boolean | null;
  } | null;
}

export interface Offer {
  ride_id: string;
  driver_id: string;
  status: OfferStatus;
  distance_to_pickup_meters: number;
  offered_at: string;
  expires_at: string;
  responded_at: string | null;
}

export interface RidePin {
  ride_id: string;
  pin: string;
  failed_attempts: number;
}

export interface Payment {
  ride_id: string;
  driver_id: string;
  passenger_id: string;
  fare_santim: number;
  confirmed_fare_santim: number;
  status: PaymentStatus;
  commission_percent: number;
  commission_santim: number;
  week_id: string;
  driver_confirmed_at: string | null;
  difference: {
    reported_received_santim: number;
    reason: string;
    reported_at: string;
  } | null;
  dispute_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Dispute {
  id: string;
  ride_id: string;
  driver_id: string;
  passenger_id: string;
  type: DisputeType;
  raised_by: 'PASSENGER' | 'DRIVER';
  reported_received_santim: number | null;
  reason: string;
  passenger_phone: string;
  driver_phone: string;
  status: DisputeStatus;
  outcome: DisputeOutcome | null;
  confirmed_fare_santim: number | null;
  admin_note: string | null;
  resolved_by: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface RestrictedZone {
  id: string;
  name: string;
  type: ZoneType;
  points: LatLng[];
  buffer_meters: number | null;
  active: boolean;
  updated_by: string;
  updated_at: string;
}

export interface MeetingPoint {
  id: string;
  name: string;
  location: LatLng;
  zone_id: string;
  active: boolean;
}

export interface WeeklyStatement {
  driver_id: string;
  week_id: string;
  week_start_at: string;
  week_end_at: string;
  ride_count: number;
  total_fares_santim: number;
  commission_santim: number;
  adjustments_santim: number;
  status: StatementStatus;
  closed_at: string | null;
  paid_at: string | null;
  marked_paid_by: string | null;
}

export interface AuditLog {
  id: string;
  actor_id: string;
  actor_role: Role;
  action: string;
  target: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
}

export interface FareConfig {
  version: number;
  base_fare_santim: number;
  price_per_km_santim: number;
  minimum_fare_santim: number;
  no_show_wait_seconds: number;
  commission_percent: number;
  created_by: string;
  created_at: string;
}

export interface Settings {
  id: number;
  active_fare_config_version: number;
  offer_timeout_seconds: number;
  search_timeout_seconds: number;
  max_pickup_distance_meters: number;
  stale_location_seconds: number;
  move_threshold_meters: number;
  ready_reminder_hours: number;
  stalled_ride_hours: number;
  max_pin_attempts: number;
  otp_expiry_seconds: number;
  otp_max_requests_per_hour: number;
  otp_max_verify_attempts: number;
  emergency_numbers: {
    police: string;
    ambulance: string;
    fire: string;
    traffic_police: string;
  };
  ops_phone_numbers: string[];
  sos_hold_seconds: number;
  sos_cancel_countdown_seconds: number;
  sos_location_interval_seconds: number;
  sos_escalation_seconds: number;
  safety_check_response_seconds: number;
  long_stop_minutes: number;
  disconnect_alert_minutes: number;
  updated_by: string;
  updated_at: string;
}

export interface SosAlert {
  id: string;
  request_id: string;
  ride_id: string | null;
  raised_by_user_id: string | null;
  raised_by: SosRaisedBy;
  trigger: SosTrigger;
  status: SosStatus;
  location: LatLng;
  location_updated_at: string;
  ride_snapshot: {
    passenger_name: string | null;
    passenger_phone: string | null;
    driver_name: string | null;
    driver_phone: string | null;
    plate: string | null;
    model: string | null;
    color: string | null;
    ride_status: RideStatus | null;
    pickup_address: string | null;
    destination_address: string | null;
  } | null;
  contacts_notified_at: string | null;
  ops_notified_at: string | null;
  escalated_at: string | null;
  escalation_count: number;
  user_marked_safe_at: string | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  outcome: SosOutcome | null;
  admin_note: string | null;
  created_at: string;
}

export interface SosTrackPoint {
  id: string;
  sos_id: string;
  location: LatLng;
  at: string;
}

export type ContractErrorCode =
  | 'UNAUTHENTICATED'
  | 'PERMISSION_DENIED'
  | 'USER_BLOCKED'
  | 'NOT_RIDE_PARTICIPANT'
  | 'INVALID_PHONE'
  | 'NAME_REQUIRED'
  | 'INVALID_AMOUNT'
  | 'INVALID_REASON'
  | 'INVALID_VALUE'
  | 'INVALID_GEOMETRY'
  | 'RATE_LIMITED'
  | 'RIDE_NOT_FOUND'
  | 'OFFER_NOT_FOUND'
  | 'USER_NOT_FOUND'
  | 'DISPUTE_NOT_FOUND'
  | 'STATEMENT_NOT_FOUND'
  | 'ZONE_NOT_FOUND'
  | 'ACTIVE_RIDE_EXISTS'
  | 'INVALID_RIDE_STATE'
  | 'RIDE_NO_LONGER_AVAILABLE'
  | 'OFFER_EXPIRED'
  | 'DRIVER_NOT_APPROVED'
  | 'DRIVER_NOT_READY'
  | 'NOT_A_DRIVER'
  | 'PAYMENT_LOCKED'
  | 'CANNOT_GO_OFFLINE_NOW'
  | 'DRIVER_STILL_CONNECTED'
  | 'PIN_INVALID'
  | 'PIN_ATTEMPTS_EXCEEDED'
  | 'NO_SHOW_WAIT_NOT_OVER'
  | 'PICKUP_IN_RESTRICTED_ZONE'
  | 'DESTINATION_IN_RESTRICTED_ZONE'
  | 'PICKUP_ON_BANNED_ROAD'
  | 'DESTINATION_ON_BANNED_ROAD'
  | 'FARE_CHANGED'
  | 'PAYMENT_ALREADY_CONFIRMED'
  | 'DISPUTE_ALREADY_OPEN'
  | 'DISPUTE_ALREADY_RESOLVED'
  | 'STATEMENT_ALREADY_PAID'
  | 'CONFIRMATION_REQUIRED'
  | 'MINIMUM_FARE_TOO_LOW'
  | 'PRICE_PER_KM_INVALID'
  | 'PHONE_ALREADY_USED'
  | 'LOGIN_ID_TAKEN'
  | 'SOS_ALREADY_OPEN'
  | 'SOS_NOT_FOUND'
  | 'SOS_ALREADY_RESOLVED'
  | 'NOTE_REQUIRED'
  | 'TOO_MANY_CONTACTS'
  | 'NO_ACTIVE_SAFETY_CHECK';

export class ContractError extends Error {
  error_code: ContractErrorCode;
  details: Record<string, unknown>;

  constructor(error_code: ContractErrorCode, details: Record<string, unknown> = {}) {
    super(error_code);
    this.name = 'ContractError';
    this.error_code = error_code;
    this.details = details;
  }
}
