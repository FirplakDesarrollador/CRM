-- Fix check_overdue_activities:
-- Send overdue activity notifications to the user assigned to the activity (a.user_id),
-- NOT to the opportunity owner (o.owner_user_id).
-- This ensures activities assigned to setters or other users do not trigger false
-- overdue alarms/notifications for advisors.

CREATE OR REPLACE FUNCTION public.check_overdue_activities()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    rule RECORD;
    activity RECORD;
    overdue_threshold TIMESTAMPTZ;
    days_config INTEGER;
BEGIN
    -- Get all active ACTIVITY_OVERDUE rules
    FOR rule IN 
        SELECT * FROM "CRM_NotificationRules" 
        WHERE type = 'ACTIVITY_OVERDUE' AND is_active = true
    LOOP
        -- Get days from config (default to 1 if not set)
        days_config := COALESCE((rule.config->>'days')::INTEGER, 1);
        
        -- Calculate the threshold date (now - days)
        overdue_threshold := NOW() - (days_config || ' days')::INTERVAL;
        
        -- Find all overdue activities that haven't been completed.
        -- Notification must go to the user assigned to the activity (a.user_id).
        FOR activity IN
            SELECT a.*, u.id as assigned_user_id
            FROM "CRM_Actividades" a
            LEFT JOIN "CRM_Usuarios" u ON a.user_id = u.id
            WHERE a.is_completed = false
            AND a.fecha_inicio <= overdue_threshold
            AND a.is_deleted = false
            AND a.user_id IS NOT NULL
            -- Don't create duplicate notifications for the same activity and user
            AND NOT EXISTS (
                SELECT 1 FROM "CRM_Notifications" n
                WHERE n.entity_id = a.id
                AND n.entity_type = 'ACTIVITY'
                AND n.type = 'ACTIVITY_OVERDUE'
                AND n.user_id = a.user_id
                AND n.created_at > NOW() - INTERVAL '24 hours'
            )
        LOOP
            -- Create notification for the user assigned to the activity
            IF activity.assigned_user_id IS NOT NULL AND 'SELLER' = ANY(rule.recipients) THEN
                IF 'APP' = ANY(rule.channels) THEN
                    INSERT INTO "CRM_Notifications" (user_id, type, title, message, entity_id, entity_type)
                    VALUES (
                        activity.assigned_user_id,
                        'ACTIVITY_OVERDUE',
                        'Actividad Vencida',
                        'La actividad "' || activity.asunto || '" está vencida desde hace ' || days_config || ' días',
                        activity.id,
                        'ACTIVITY'
                    );
                END IF;
            END IF;
        END LOOP;
    END LOOP;
END;
$function$;

-- Clean up existing false notifications where notification recipient is not the assigned user of the activity
DELETE FROM "CRM_Notifications" n
WHERE n.type = 'ACTIVITY_OVERDUE'
AND n.entity_type = 'ACTIVITY'
AND EXISTS (
    SELECT 1 FROM "CRM_Actividades" a
    WHERE a.id = n.entity_id
    AND a.user_id != n.user_id
);

