-- Add 'producao' role to app_role enum
-- Must be in its own transaction before policies that reference it
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'producao';
