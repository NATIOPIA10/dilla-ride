-- Migration 2: users and drivers tables (contract Sections 6.1 and 6.2).
-- Column names are the contract's camelCase names in snake_case.

-- Sets updated_at to the current time whenever a row is updated.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 6.1 users: one row per account. The id is the sign-in account id.
create table users (
  id uuid primary key references auth.users (id) on delete cascade,
  role app_role not null,                      -- read-only copy; the real role lives in the account's app metadata
  name text not null,
  phone text not null unique
    check (phone ~ '^\+[1-9][0-9]{7,14}$'),    -- E.164, for example +2519XXXXXXXX
  language text not null
    check (language in ('am', 'en')),
  status user_status not null default 'ACTIVE',
  fcm_token text,
  active_ride_id uuid,                         -- foreign key added when the rides table exists
  active_sos_id uuid,                          -- foreign key added when the sosAlerts table exists
  emergency_contacts jsonb                     -- up to 2 entries { name, phone }
    check (
      emergency_contacts is null
      or (jsonb_typeof(emergency_contacts) = 'array'
          and jsonb_array_length(emergency_contacts) <= 2)
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep users.updated_at current on every update.
create trigger users_set_updated_at
  before update on users
  for each row execute function set_updated_at();

-- 6.2 drivers: one row per driver. Same id as the matching users row.
create table drivers (
  id uuid primary key references users (id) on delete cascade,
  login_id text not null unique,               -- see the note below the code
  approval driver_approval not null default 'PENDING',
  license_number text not null,
  motorcycle jsonb not null                    -- { plate, model, color }
    check (motorcycle ? 'plate' and motorcycle ? 'model' and motorcycle ? 'color'),
  photo_url text,
  availability driver_availability not null default 'OFFLINE',
  wants_online boolean not null default false,
  connected boolean not null default false,    -- mirrored from presence
  last_seen_at timestamptz,
  current_ride_id uuid,                        -- foreign key added with the rides table
  payment_lock_ride_id uuid,                   -- foreign key added with the rides table
  ready_reminder_sent_at timestamptz,
  last_ready_at timestamptz,
  rating_average numeric not null default 0,
  rating_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep drivers.updated_at current on every update.
create trigger drivers_set_updated_at
  before update on drivers
  for each row execute function set_updated_at();

-- Index for the admin overview (contract Section 7.4: drivers by availability).
create index drivers_availability_idx on drivers (availability);

-- Lock both tables for apps until the access rules are written.
alter table users enable row level security;
alter table drivers enable row level security;