-- Basic biometric fields collected by a coach when creating an athlete account.
-- Nullable on every role; only ever populated for clients today.
alter table public.profiles
  add column age integer check (age is null or (age > 0 and age < 120)),
  add column sex text check (sex is null or sex in ('male', 'female', 'other')),
  add column height_cm numeric check (height_cm is null or (height_cm > 0 and height_cm < 300));
