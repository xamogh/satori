export const LOCAL_DB_FILENAME = "satori.local.sqlite"

export const LOCAL_DB_SCHEMA_VERSION = 2

export const LOCAL_DB_PRAGMAS = [
  "journal_mode = WAL",
  "synchronous = NORMAL",
  "foreign_keys = ON",
] as const

export const LOCAL_DB_SCHEMA_SQL = `
create table if not exists sync_state (
  id integer primary key check (id = 1),
  cursor_ms integer
);
insert into sync_state (id, cursor_ms) values (1, null)
  on conflict(id) do nothing;

create table if not exists outbox (
  op_id text primary key,
  body_json text not null,
  created_at_ms integer not null
);

create table if not exists events (
  id text primary key,
  parent_event_id text,
  name text not null,
  description text,
  registration_mode text not null,
  status text not null,
  starts_at_ms integer not null,
  ends_at_ms integer,
  empowerment_id text,
  guru_id text,
  updated_at_ms integer not null,
  deleted_at_ms integer,
  server_modified_at_ms integer
);
create index if not exists idx_events_server_modified_at_ms
  on events(server_modified_at_ms);

create table if not exists event_days (
  id text primary key,
  event_id text not null,
  day_number integer not null,
  date_ms integer not null,
  updated_at_ms integer not null,
  deleted_at_ms integer,
  server_modified_at_ms integer
);
create index if not exists idx_event_days_server_modified_at_ms
  on event_days(server_modified_at_ms);

create table if not exists event_attendees (
  id text primary key,
  event_id text not null,
  person_id text not null,
  registration_mode text not null,
  registered_at_ms integer,
  registered_by text,
  registered_for_day_id text,
  notes text,
  is_cancelled integer not null,
  attendance_override_status text,
  attendance_override_note text,
  updated_at_ms integer not null,
  deleted_at_ms integer,
  server_modified_at_ms integer
);
create index if not exists idx_event_attendees_server_modified_at_ms
  on event_attendees(server_modified_at_ms);

create table if not exists event_day_attendance (
  id text primary key,
  event_attendee_id text not null,
  event_day_id text not null,
  status text not null,
  checked_in_at_ms integer,
  checked_in_by text,
  updated_at_ms integer not null,
  deleted_at_ms integer,
  server_modified_at_ms integer
);
create index if not exists idx_event_day_attendance_server_modified_at_ms
  on event_day_attendance(server_modified_at_ms);

create table if not exists persons (
  id text primary key,
  first_name text not null,
  middle_name text,
  last_name text not null,
  gender text,
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
  person_type text,
  title text,
  refuge_name text,
  year_of_refuge integer,
  year_of_refuge_calendar_type text,
  is_sangha_member integer not null,
  center_id text,
  is_krama_instructor integer not null,
  krama_instructor_person_id text,
  photo_id text,
  updated_at_ms integer not null,
  deleted_at_ms integer,
  server_modified_at_ms integer
);
create index if not exists idx_persons_server_modified_at_ms
  on persons(server_modified_at_ms);

create table if not exists groups (
  id text primary key,
  name text not null,
  description text,
  updated_at_ms integer not null,
  deleted_at_ms integer,
  server_modified_at_ms integer
);
create index if not exists idx_groups_server_modified_at_ms
  on groups(server_modified_at_ms);

create table if not exists person_groups (
  id text primary key,
  group_id text not null,
  person_id text not null,
  joined_at_ms integer,
  updated_at_ms integer not null,
  deleted_at_ms integer,
  server_modified_at_ms integer
);
create index if not exists idx_person_groups_server_modified_at_ms
  on person_groups(server_modified_at_ms);

create table if not exists empowerments (
  id text primary key,
  name text not null,
  description text,
  class text,
  type text,
  form text,
  prerequisites text,
  major_empowerment integer not null,
  updated_at_ms integer not null,
  deleted_at_ms integer,
  server_modified_at_ms integer
);
create index if not exists idx_empowerments_server_modified_at_ms
  on empowerments(server_modified_at_ms);

create table if not exists gurus (
  id text primary key,
  name text not null,
  updated_at_ms integer not null,
  deleted_at_ms integer,
  server_modified_at_ms integer
);
create index if not exists idx_gurus_server_modified_at_ms
  on gurus(server_modified_at_ms);

create table if not exists mahakrama_steps (
  id text primary key,
  step_id text not null,
  step_name text not null,
  sequence_number integer not null,
  group_id text not null,
  group_name text not null,
  description text,
  updated_at_ms integer not null,
  deleted_at_ms integer,
  server_modified_at_ms integer
);
create index if not exists idx_mahakrama_steps_server_modified_at_ms
  on mahakrama_steps(server_modified_at_ms);

create table if not exists mahakrama_history (
  id text primary key,
  person_id text not null,
  mahakrama_step_id text not null,
  start_date_ms integer not null,
  end_date_ms integer,
  status text not null,
  mahakrama_instructor_person_id text,
  completion_notes text,
  updated_at_ms integer not null,
  deleted_at_ms integer,
  server_modified_at_ms integer
);
create index if not exists idx_mahakrama_history_server_modified_at_ms
  on mahakrama_history(server_modified_at_ms);

create table if not exists photos (
  id text primary key,
  person_id text not null,
  mime_type text not null,
  bytes blob not null,
  updated_at_ms integer not null,
  deleted_at_ms integer,
  server_modified_at_ms integer
);
create index if not exists idx_photos_server_modified_at_ms
  on photos(server_modified_at_ms);
`
