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
  title text not null,
  description text,
  starts_at_ms bigint not null,
  ends_at_ms bigint,
  updated_at_ms bigint not null,
  deleted_at_ms bigint,
  server_modified_at_ms bigint not null
);
create index if not exists idx_events_server_modified_at_ms
  on events(server_modified_at_ms);

create table if not exists persons (
  id uuid primary key,
  display_name text not null,
  email text,
  phone text,
  photo_id uuid,
  updated_at_ms bigint not null,
  deleted_at_ms bigint,
  server_modified_at_ms bigint not null
);
create index if not exists idx_persons_server_modified_at_ms
  on persons(server_modified_at_ms);

create table if not exists registrations (
  id uuid primary key,
  event_id uuid not null,
  person_id uuid not null,
  status text not null check (status in ('registered','cancelled')),
  updated_at_ms bigint not null,
  deleted_at_ms bigint,
  server_modified_at_ms bigint not null
);
create index if not exists idx_registrations_server_modified_at_ms
  on registrations(server_modified_at_ms);

create table if not exists attendance (
  id uuid primary key,
  event_id uuid not null,
  person_id uuid not null,
  date text not null,
  status text not null check (status in ('present','absent')),
  updated_at_ms bigint not null,
  deleted_at_ms bigint,
  server_modified_at_ms bigint not null
);
create index if not exists idx_attendance_server_modified_at_ms
  on attendance(server_modified_at_ms);

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

