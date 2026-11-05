-- Migration 1: PostGIS extension and enum types (contract Section 2).
-- Enum values are copied exactly from the contract.

-- PostGIS adds the "geography" type and distance queries for locations.
create extension if not exists postgis with schema extensions;

-- 2.1 Roles and status
create type app_role as enum ('PASSENGER', 'DRIVER', 'ADMIN');
create type user_status as enum ('ACTIVE', 'BLOCKED');
create type driver_approval as enum ('PENDING', 'APPROVED', 'REJECTED');
create type driver_availability as enum ('OFFLINE', 'READY', 'ON_RIDE', 'PAYMENT_PENDING');

-- 2.2 Rides and offers
create type ride_status as enum (
  'REQUESTED', 'SEARCHING', 'DRIVER_ACCEPTED', 'ARRIVED_AT_PICKUP',
  'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_DRIVER_FOUND', 'EXPIRED'
);
create type offer_status as enum ('OFFERED', 'ACCEPTED', 'REJECTED', 'TIMED_OUT', 'CANCELLED');
create type cancelled_by as enum ('PASSENGER', 'DRIVER', 'ADMIN', 'SYSTEM');
create type cancel_reason as enum (
  'PASSENGER_CHANGED_MIND', 'DRIVER_UNAVAILABLE', 'PASSENGER_NO_SHOW', 'SAFETY', 'OTHER'
);
create type completed_by as enum ('DRIVER', 'PASSENGER');

-- 2.3 Payments and disputes
create type payment_status as enum ('PENDING_DRIVER_CONFIRMATION', 'PAID', 'DISPUTED');
create type dispute_type as enum ('PASSENGER_REPORT', 'DRIVER_DIFFERENCE');
create type dispute_status as enum ('OPEN', 'RESOLVED');
create type dispute_outcome as enum ('FULL_FARE_CONFIRMED', 'REDUCED_FARE_CONFIRMED', 'DRIVER_AT_FAULT');
create type statement_status as enum ('UNPAID', 'PAID');

-- 2.4 Zones
create type zone_type as enum ('AREA', 'ROAD');

-- 2.5 Safety and SOS
create type sos_status as enum ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');
create type sos_raised_by as enum ('PASSENGER', 'DRIVER', 'SYSTEM');
create type sos_trigger as enum (
  'USER_BUTTON', 'SAFETY_CHECK_NO_RESPONSE', 'LONG_STOP', 'DISCONNECT_TIMEOUT'
);
create type sos_outcome as enum ('SAFE', 'POLICE_CONTACTED', 'AMBULANCE_CONTACTED', 'FALSE_ALARM', 'OTHER');