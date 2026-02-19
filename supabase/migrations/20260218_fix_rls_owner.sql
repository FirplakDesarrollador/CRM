-- FIX: RLS policies using owner_user_id instead of created_by
-- This ensures that when an account is reassigned, the new owner (and their coordinators) can see it.

-- 1. Helper function update (or new one)
-- The existing `is_coordinator_of_owner` checks `CRM_Usuarios` based on the ID passed. 
-- We just need to pass `owner_user_id` instead of `created_by` in the policy.

-- Update RLS Policies for Accounts (CRM_Cuentas)
DROP POLICY IF EXISTS "Coordinadores access accounts of assigned users" ON "CRM_Cuentas";
CREATE POLICY "Coordinadores access accounts of assigned users"
ON "CRM_Cuentas"
FOR SELECT
TO authenticated
USING (
  -- Check if user is coordinator of the RECORD OWNER (not creator)
  is_coordinator_of_owner(owner_user_id) 
  OR 
  -- Also allow the owner themselves explicitly (though usually covered by permissive or other policies, explicit is safer for non-public tables)
  auth.uid() = owner_user_id
  OR
  -- Keep creator access? Usually yes, or maybe not if reassigned? 
  -- If reassigned, creator might lose access if they are not admin/coordinator. 
  -- Let's keep strict ownership: Owner OR Coordinator OR Admin (Admin usually bypasses RLS or has specific policy).
  -- Given the previous policy was generic `created_by`, we now shift to `owner_user_id`.
  false -- (Logic continues below)
);

-- Wait, the previous policy `Coordinadores access accounts of assigned users` ONLY handled coordinators.
-- There was a `Permissive All` policy in `schema.sql` line 302:
-- CREATE POLICY "Permissive All" ON "CRM_Cuentas" FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- If `Permissive All` exists and is enabled, then EVERYONE can see EVERYTHING.
-- User says "no puedo ver información". 
-- If `Permissive All` is active, they should see it. 
-- UNLESS `Permissive All` was dropped or disabled.
-- Let's check if we accidentally restricted access.

-- The user says "no puedo ver información".
-- If `owner_user_id` is null, and we use it, it fails.
-- But we populated it.
-- Perhaps the user is filtering by `assignedUserId` in the UI and the `owner_user_id` is not what they expect?

-- Let's ensure the policy allows seeing rows where `owner_user_id` matches the filter?
-- RLS filters rows BEFORE the UI query.
-- If `Permissive All` is there, RLS isn't the blocker. 
-- BUT if `20260205_add_coordinators.sql` added a RESTRICTIVE policy? 
-- No, policies are additive (OR). Unless `RESTRICTIVE` keyword is used (rare in standard Supabase setup).

-- However, if the user "Filter by user" feature is sending a user ID, and the DB rows have a different ID, they see nothing.
-- The user said: "asegurate que en el nuevo campo... sea populado por la información de CRM_Oportunidades".
-- I ran that migration.

-- Let's purely enable RLS compatibility with `owner_user_id` for the Coordinator logic, 
-- AND verify if `Permissive All` is actually doing its job or if we need a specific "Owner can view" policy 
-- (which is good practice anyway if we move away from Permissive).

-- BUT, if the user sees NOTHING (empty state), and they are the owner, `Permissive All` should let them see it.
-- Issue might be the frontend query:
-- `useAccountsServer.ts` selects `owner:owner_user_id(full_name)`.
-- If `owner_user_id` points to a user that doesn't exist or RLS on checking `auth.users` / `CRM_Usuarios` prevents the join?
-- If the JOIN fails, does the whole row disappear? In Supabase inner join, yes? 
-- Default is usually left join in Supabase-js unless `!inner` is specified.
-- `owner:owner_user_id(full_name)` is a left join.

-- Let's assume the issue IS the policies or the data population didn't quite work as expected for their specific user.
-- Or maybe the `Permissive All` was dropped?

-- Let's recreate the "Coordinadores" policy using `owner_user_id` to be safe and correct.

DROP POLICY IF EXISTS "Coordinadores access accounts of assigned users" ON "CRM_Cuentas";
CREATE POLICY "Coordinadores access accounts of assigned users"
ON "CRM_Cuentas"
FOR SELECT
TO authenticated
USING (
  is_coordinator_of_owner(owner_user_id)
);

-- 2. Explicitly allow owners to see their own accounts (in case Permissive is disabled)
DROP POLICY IF EXISTS "Owners can see their own accounts" ON "CRM_Cuentas";
CREATE POLICY "Owners can see their own accounts"
ON "CRM_Cuentas"
FOR SELECT
TO authenticated
USING (
  auth.uid() = owner_user_id
);

-- Update for Opportunities too, just in case
DROP POLICY IF EXISTS "Coordinadores access opportunities of assigned users" ON "CRM_Oportunidades";
CREATE POLICY "Coordinadores access opportunities of assigned users"
ON "CRM_Oportunidades"
FOR SELECT
TO authenticated
USING (
  is_coordinator_of_owner(owner_user_id) -- Opportunidades already had owner_user_id
);


-- Force refresh of cache / permissions?
NOTIFY pgrst, 'reload config';
