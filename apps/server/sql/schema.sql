create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  role text not null check (role in ('admin','staff','viewer')),
  created_at timestamptz not null default now()
);

create table if not exists sync_ops (
  op_id uuid primary key,
  applied_at_ms bigint not null
);

create table if not exists events (
  id uuid primary key,
  parent_event_id uuid,
  name text not null,
  description text,
  registration_mode text not null check (registration_mode in ('PRE_REGISTRATION','WALK_IN')),
  status text not null check (status in ('DRAFT','ACTIVE','CLOSED')),
  starts_at_ms bigint not null,
  ends_at_ms bigint,
  empowerment_id uuid,
  guru_id uuid,
  updated_at_ms bigint not null,
  deleted_at_ms bigint,
  server_modified_at_ms bigint not null
);
create index if not exists idx_events_server_modified_at_ms
  on events(server_modified_at_ms);

create table if not exists event_days (
  id uuid primary key,
  event_id uuid not null,
  day_number integer not null,
  date_ms bigint not null,
  updated_at_ms bigint not null,
  deleted_at_ms bigint,
  server_modified_at_ms bigint not null
);
create index if not exists idx_event_days_server_modified_at_ms
  on event_days(server_modified_at_ms);

create table if not exists event_attendees (
  id uuid primary key,
  event_id uuid not null,
  person_id uuid not null,
  registration_mode text not null check (registration_mode in ('PRE_REGISTRATION','WALK_IN')),
  registered_at_ms bigint,
  registered_by text,
  registered_for_day_id uuid,
  notes text,
  is_cancelled boolean not null default false,
  attendance_override_status text check (attendance_override_status in ('attended','not_attended')),
  attendance_override_note text,
  updated_at_ms bigint not null,
  deleted_at_ms bigint,
  server_modified_at_ms bigint not null
);
create index if not exists idx_event_attendees_server_modified_at_ms
  on event_attendees(server_modified_at_ms);

create table if not exists event_day_attendance (
  id uuid primary key,
  event_attendee_id uuid not null,
  event_day_id uuid not null,
  status text not null check (status in ('present','absent')),
  checked_in_at_ms bigint,
  checked_in_by text,
  updated_at_ms bigint not null,
  deleted_at_ms bigint,
  server_modified_at_ms bigint not null
);
create index if not exists idx_event_day_attendance_server_modified_at_ms
  on event_day_attendance(server_modified_at_ms);

create table if not exists persons (
  id uuid primary key,
  display_name text not null,
  first_name text not null,
  middle_name text,
  last_name text not null,
  gender text check (gender in ('male','female','other','prefer_not_to_say')),
  year_of_birth integer,
  email text,
  phone1 text,
  phone2 text,
  address text,
  country text,
  nationality text,
  language_preference text,
  notes text,
  person_code text,
  referred_by text,
  occupation text,
  person_type text check (person_type in ('interested','contact','attended_orientation')),
  title text check (title in ('dharma_dhar','sahayak_dharmacharya','sahayak_samathacharya','khenpo','dharmacharya')),
  refuge_name text,
  year_of_refuge integer,
  year_of_refuge_calendar_type text check (year_of_refuge_calendar_type in ('BS','AD')),
  is_sangha_member boolean not null default false,
  center_id uuid,
  is_krama_instructor boolean not null default false,
  krama_instructor_person_id uuid,
  photo_id uuid,
  updated_at_ms bigint not null,
  deleted_at_ms bigint,
  server_modified_at_ms bigint not null
);
create index if not exists idx_persons_server_modified_at_ms
  on persons(server_modified_at_ms);

create table if not exists groups (
  id uuid primary key,
  name text not null,
  description text,
  updated_at_ms bigint not null,
  deleted_at_ms bigint,
  server_modified_at_ms bigint not null
);
create index if not exists idx_groups_server_modified_at_ms
  on groups(server_modified_at_ms);

create table if not exists person_groups (
  id uuid primary key,
  group_id uuid not null,
  person_id uuid not null,
  joined_at_ms bigint,
  updated_at_ms bigint not null,
  deleted_at_ms bigint,
  server_modified_at_ms bigint not null
);
create index if not exists idx_person_groups_server_modified_at_ms
  on person_groups(server_modified_at_ms);

create table if not exists empowerments (
  id uuid primary key,
  name text not null,
  description text,
  class text,
  type text,
  form text,
  prerequisites text,
  major_empowerment boolean not null default false,
  updated_at_ms bigint not null,
  deleted_at_ms bigint,
  server_modified_at_ms bigint not null
);
create index if not exists idx_empowerments_server_modified_at_ms
  on empowerments(server_modified_at_ms);

create table if not exists gurus (
  id uuid primary key,
  name text not null,
  updated_at_ms bigint not null,
  deleted_at_ms bigint,
  server_modified_at_ms bigint not null
);
create index if not exists idx_gurus_server_modified_at_ms
  on gurus(server_modified_at_ms);

create table if not exists mahakrama_steps (
  id uuid primary key,
  step_id text not null,
  step_name text not null,
  sequence_number integer not null,
  group_id text not null,
  group_name text not null,
  description text,
  updated_at_ms bigint not null,
  deleted_at_ms bigint,
  server_modified_at_ms bigint not null
);
create index if not exists idx_mahakrama_steps_server_modified_at_ms
  on mahakrama_steps(server_modified_at_ms);

create table if not exists mahakrama_history (
  id uuid primary key,
  person_id uuid not null,
  mahakrama_step_id uuid not null,
  start_date_ms bigint not null,
  end_date_ms bigint,
  status text not null,
  mahakrama_instructor_person_id uuid,
  completion_notes text,
  updated_at_ms bigint not null,
  deleted_at_ms bigint,
  server_modified_at_ms bigint not null
);
create index if not exists idx_mahakrama_history_server_modified_at_ms
  on mahakrama_history(server_modified_at_ms);

create table if not exists photos (
  id uuid primary key,
  person_id uuid not null,
  mime_type text not null,
  bytes bytea not null,
  updated_at_ms bigint not null,
  deleted_at_ms bigint,
  server_modified_at_ms bigint not null
);
create index if not exists idx_photos_server_modified_at_ms
  on photos(server_modified_at_ms);

-- Schema upgrades for existing installs
alter table if exists events
  add column if not exists parent_event_id uuid,
  add column if not exists name text,
  add column if not exists description text,
  add column if not exists registration_mode text default 'WALK_IN' check (registration_mode in ('PRE_REGISTRATION','WALK_IN')),
  add column if not exists status text default 'DRAFT' check (status in ('DRAFT','ACTIVE','CLOSED')),
  add column if not exists starts_at_ms bigint default 0,
  add column if not exists ends_at_ms bigint,
  add column if not exists empowerment_id uuid,
  add column if not exists guru_id uuid,
  add column if not exists updated_at_ms bigint default 0,
  add column if not exists deleted_at_ms bigint,
  add column if not exists server_modified_at_ms bigint default 0;

alter table if exists event_days
  add column if not exists event_id uuid,
  add column if not exists day_number integer,
  add column if not exists date_ms bigint default 0,
  add column if not exists updated_at_ms bigint default 0,
  add column if not exists deleted_at_ms bigint,
  add column if not exists server_modified_at_ms bigint default 0;

alter table if exists event_attendees
  add column if not exists event_id uuid,
  add column if not exists person_id uuid,
  add column if not exists registration_mode text default 'WALK_IN' check (registration_mode in ('PRE_REGISTRATION','WALK_IN')),
  add column if not exists registered_at_ms bigint,
  add column if not exists registered_by text,
  add column if not exists registered_for_day_id uuid,
  add column if not exists notes text,
  add column if not exists is_cancelled boolean not null default false,
  add column if not exists attendance_override_status text check (attendance_override_status in ('attended','not_attended')),
  add column if not exists attendance_override_note text,
  add column if not exists updated_at_ms bigint default 0,
  add column if not exists deleted_at_ms bigint,
  add column if not exists server_modified_at_ms bigint default 0;

alter table if exists event_day_attendance
  add column if not exists event_attendee_id uuid,
  add column if not exists event_day_id uuid,
  add column if not exists status text default 'absent' check (status in ('present','absent')),
  add column if not exists checked_in_at_ms bigint,
  add column if not exists checked_in_by text,
  add column if not exists updated_at_ms bigint default 0,
  add column if not exists deleted_at_ms bigint,
  add column if not exists server_modified_at_ms bigint default 0;

alter table if exists persons
  add column if not exists display_name text,
  add column if not exists first_name text,
  add column if not exists middle_name text,
  add column if not exists last_name text,
  add column if not exists gender text check (gender in ('male','female','other','prefer_not_to_say')),
  add column if not exists year_of_birth integer,
  add column if not exists email text,
  add column if not exists phone1 text,
  add column if not exists phone2 text,
  add column if not exists address text,
  add column if not exists country text,
  add column if not exists nationality text,
  add column if not exists language_preference text,
  add column if not exists notes text,
  add column if not exists person_code text,
  add column if not exists referred_by text,
  add column if not exists occupation text,
  add column if not exists person_type text check (person_type in ('interested','contact','attended_orientation')),
  add column if not exists title text check (title in ('dharma_dhar','sahayak_dharmacharya','sahayak_samathacharya','khenpo','dharmacharya')),
  add column if not exists refuge_name text,
  add column if not exists year_of_refuge integer,
  add column if not exists year_of_refuge_calendar_type text check (year_of_refuge_calendar_type in ('BS','AD')),
  add column if not exists is_sangha_member boolean not null default false,
  add column if not exists center_id uuid,
  add column if not exists is_krama_instructor boolean not null default false,
  add column if not exists krama_instructor_person_id uuid,
  add column if not exists photo_id uuid,
  add column if not exists updated_at_ms bigint default 0,
  add column if not exists deleted_at_ms bigint,
  add column if not exists server_modified_at_ms bigint default 0;

update persons
set display_name = trim(both ' ' from concat_ws(' ', first_name, middle_name, last_name))
where display_name is null;

alter table if exists persons
  alter column display_name set not null;
