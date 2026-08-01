-- pgTAP test: verify RLS isolation between two users
-- NOTE: This test requires pgTAP extension and must run locally via supabase test db
-- It creates temporary auth users and verifies cross-user access is blocked.
BEGIN;
SELECT plan(6);

-- Setup: create two test users in auth.users
INSERT INTO auth.users (id, email, instance_id, aud, role, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'usera@test.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', crypt('password123', gen_salt('bf')), now(), now(), now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'userb@test.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', crypt('password123', gen_salt('bf')), now(), now(), now());

-- Create profile for user A
INSERT INTO public.profiles (id, full_name, timezone) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'User A', 'America/Bogota');
INSERT INTO public.profiles (id, full_name, timezone) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'User B', 'America/Bogota');

-- Create a cycle for user A
INSERT INTO public.cycles (id, user_id, name, start_date, end_date, status)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Cycle A', '2026-01-01', '2026-03-31', 'active');

-- Create a category for user A
INSERT INTO public.categories (id, user_id, name, color, position)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Work A', '#2563EB', 0);

-- Switch to authenticated role as User B
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}';

-- User B should NOT see User A's profile
SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')::integer,
  0,
  'User B cannot read User A profile'
);

-- User B should NOT see User A's cycles
SELECT is(
  (SELECT count(*) FROM public.cycles WHERE user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')::integer,
  0,
  'User B cannot read User A cycles'
);

-- User B should NOT see User A's categories
SELECT is(
  (SELECT count(*) FROM public.categories WHERE user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')::integer,
  0,
  'User B cannot read User A categories'
);

-- User B cannot INSERT with User A's user_id
SELECT throws_ok(
  $$INSERT INTO public.cycles (user_id, name, start_date, end_date, status) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Stolen', '2026-01-01', '2026-03-31', 'active')$$,
  NULL,
  'User B cannot insert cycle with User A user_id'
);

-- User B cannot UPDATE User A's category
SELECT is(
  (SELECT count(*) FROM public.categories WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd')::integer,
  0,
  'User B cannot see User A category to update it'
);

-- User B cannot DELETE User A's cycle
SELECT is(
  (SELECT count(*) FROM public.cycles WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc')::integer,
  0,
  'User B cannot see User A cycle to delete it'
);

SELECT * FROM finish();
ROLLBACK;
