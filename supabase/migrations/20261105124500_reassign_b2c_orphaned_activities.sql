-- Reassign 121 B2C activities to either the Setter or the Opportunity Owner:
-- 1. Setter activities (16): '30 setter', '2. 30 setter', '3. 30 setter', 'calificar lead'
--    -> Assigned to Christian Alvarez Roman ('73036b7a-3562-4e2a-b532-c27e666772ed')
-- 2. Commercial follow-up activities (105): 'Nueva Actividad', 'SEGUIMIENTO', 'Llamada Telefónica', etc.
--    -> Assigned to the respective Opportunity Owner (o.owner_user_id)

-- Step 1: Reassign Setter activities to Christian Alvarez Roman
UPDATE "CRM_Actividades" a
SET 
  user_id = '73036b7a-3562-4e2a-b532-c27e666772ed',
  updated_at = NOW()
FROM "CRM_Oportunidades" o
LEFT JOIN "CRM_Cuentas" c ON o.account_id = c.id
WHERE a.opportunity_id = o.id
  AND a.is_deleted = false
  AND (c.canal_id = 'PROPIO' OR o.setter IS NOT NULL)
  AND a.is_completed = false
  AND a.user_id IS NOT NULL
  AND a.user_id != o.owner_user_id
  AND a.user_id NOT IN ('73036b7a-3562-4e2a-b532-c27e666772ed', 'f361d4e5-d937-4668-913a-a4359658d6f4')
  AND (a.asunto ILIKE '%setter%' OR a.asunto ILIKE '%calificar%lead%');

-- Step 2: Reassign Commercial follow-up activities to the Opportunity Owner
UPDATE "CRM_Actividades" a
SET 
  user_id = o.owner_user_id,
  updated_at = NOW()
FROM "CRM_Oportunidades" o
LEFT JOIN "CRM_Cuentas" c ON o.account_id = c.id
WHERE a.opportunity_id = o.id
  AND a.is_deleted = false
  AND (c.canal_id = 'PROPIO' OR o.setter IS NOT NULL)
  AND a.is_completed = false
  AND a.user_id IS NOT NULL
  AND a.user_id != o.owner_user_id
  AND a.user_id NOT IN ('73036b7a-3562-4e2a-b532-c27e666772ed', 'f361d4e5-d937-4668-913a-a4359658d6f4')
  AND NOT (a.asunto ILIKE '%setter%' OR a.asunto ILIKE '%calificar%lead%')
  AND o.owner_user_id IS NOT NULL;

