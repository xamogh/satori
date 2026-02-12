-- Dev-only admin user for local login.
-- email: seeded.admin@satori.local
-- password: SatoriDev#2026
insert into users (email, password_hash, role)
values (
  'seeded.admin@satori.local',
  'scrypt$16384$8$1$P1yEoC42AS5YY48wDsJZyw==$BQo5VsJDtx/yAmKXvCpmVrLEbJeOxbKaG5TNV6fJIEs=',
  'admin'
)
on conflict (email) do nothing;
