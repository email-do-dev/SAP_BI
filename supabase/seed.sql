-- Seed: create test users for Cypress E2E tests
-- This runs automatically on `supabase start` and `supabase db reset`

-- 1. Test user with 'diretoria' role
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token,
  raw_app_meta_data, raw_user_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'a1111111-1111-1111-1111-111111111111',
  'authenticated', 'authenticated',
  'test-diretoria@sapbi.local',
  crypt('Test@12345', gen_salt('bf')),
  now(), now(), now(),
  '', '', '', '',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Test Diretoria"}'
);

INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
) VALUES (
  'a1111111-1111-1111-1111-111111111111',
  'a1111111-1111-1111-1111-111111111111',
  jsonb_build_object('sub', 'a1111111-1111-1111-1111-111111111111', 'email', 'test-diretoria@sapbi.local'),
  'email',
  'a1111111-1111-1111-1111-111111111111',
  now(), now(), now()
);

-- Profile is auto-created by trigger, just add role
INSERT INTO public.user_roles (user_id, role)
VALUES ('a1111111-1111-1111-1111-111111111111', 'diretoria');

-- 2. Test user with 'comercial' role (limited, no diretoria)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token,
  raw_app_meta_data, raw_user_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'b2222222-2222-2222-2222-222222222222',
  'authenticated', 'authenticated',
  'test-comercial@sapbi.local',
  crypt('Test@12345', gen_salt('bf')),
  now(), now(), now(),
  '', '', '', '',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Test Comercial"}'
);

INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
) VALUES (
  'b2222222-2222-2222-2222-222222222222',
  'b2222222-2222-2222-2222-222222222222',
  jsonb_build_object('sub', 'b2222222-2222-2222-2222-222222222222', 'email', 'test-comercial@sapbi.local'),
  'email',
  'b2222222-2222-2222-2222-222222222222',
  now(), now(), now()
);

INSERT INTO public.user_roles (user_id, role)
VALUES ('b2222222-2222-2222-2222-222222222222', 'comercial');
