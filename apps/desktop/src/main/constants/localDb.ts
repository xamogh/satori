export const LOCAL_DB_FILENAME = "satori.local.sqlite"

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
  title text not null,
  description text,
  starts_at_ms integer not null,
  ends_at_ms integer,
  updated_at_ms integer not null,
  deleted_at_ms integer,
  server_modified_at_ms integer
);
create index if not exists idx_events_server_modified_at_ms
  on events(server_modified_at_ms);

create table if not exists persons (
  id text primary key,
  display_name text not null,
  email text,
  phone text,
  photo_id text,
  updated_at_ms integer not null,
  deleted_at_ms integer,
  server_modified_at_ms integer
);
create index if not exists idx_persons_server_modified_at_ms
  on persons(server_modified_at_ms);

create table if not exists registrations (
  id text primary key,
  event_id text not null,
  person_id text not null,
  status text not null,
  updated_at_ms integer not null,
  deleted_at_ms integer,
  server_modified_at_ms integer
);
create index if not exists idx_registrations_server_modified_at_ms
  on registrations(server_modified_at_ms);

create table if not exists attendance (
  id text primary key,
  event_id text not null,
  person_id text not null,
  date text not null,
  status text not null,
  updated_at_ms integer not null,
  deleted_at_ms integer,
  server_modified_at_ms integer
);
create index if not exists idx_attendance_server_modified_at_ms
  on attendance(server_modified_at_ms);

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

