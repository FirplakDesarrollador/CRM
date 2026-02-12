-- 1. Create Notification Rules Table
CREATE TABLE "CRM_NotificationRules" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    type VARCHAR NOT NULL CHECK (type IN ('INACTIVE_CLIENT', 'BUDGET_MISS', 'NEW_ACCOUNT', 'NEW_OPPORTUNITY')),
    config JSONB DEFAULT '{}'::jsonb,
    recipients TEXT[] DEFAULT '{}', -- Array of roles: 'SELLER', 'COORDINATOR'
    channels TEXT[] DEFAULT '{}', -- Array of channels: 'APP', 'EMAIL', 'TEAMS'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- 2. Create Notifications Table (Persisted History)
CREATE TABLE "CRM_Notifications" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    type VARCHAR NOT NULL, -- same enum/values as rules + others
    title VARCHAR NOT NULL,
    message TEXT,
    entity_id UUID,
    entity_type VARCHAR, -- 'ACCOUNT', 'OPPORTUNITY', etc.
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS Policies
ALTER TABLE "CRM_NotificationRules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CRM_Notifications" ENABLE ROW LEVEL SECURITY;

-- Rules: Admins/Coordinators can manage, Everyone can read (for client-side checks)
CREATE POLICY "Manage Rules" ON "CRM_NotificationRules"
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM "CRM_Usuarios"
            WHERE id = auth.uid() AND role IN ('ADMIN', 'COORDINADOR')
        )
    );

CREATE POLICY "Read Rules" ON "CRM_NotificationRules"
    FOR SELECT
    TO authenticated
    USING (true);

-- Notifications: Users can only see their own
CREATE POLICY "Users see own notifications" ON "CRM_Notifications"
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "System/Admin insert notifications" ON "CRM_Notifications"
    FOR INSERT
    TO authenticated
    WITH CHECK (true); -- Allow triggers/functions to insert

CREATE POLICY "Users update own notifications" ON "CRM_Notifications"
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid()); -- mainly for marking as read

-- 4. Triggers for Automatic Notifications
-- Function to handle New Account Assignment
CREATE OR REPLACE FUNCTION handle_new_account_assignment() RETURNS TRIGGER AS $$
DECLARE
    rule RECORD;
    recipient_id UUID;
BEGIN
    -- Only trigger if owner changed and checks 'NEW_ACCOUNT' rule
    IF (TG_OP = 'UPDATE' AND OLD.created_by IS DISTINCT FROM NEW.created_by) OR (TG_OP = 'INSERT' AND NEW.created_by IS NOT NULL) THEN
        
        -- Find active rule for NEW_ACCOUNT
        SELECT * INTO rule FROM "CRM_NotificationRules" WHERE type = 'NEW_ACCOUNT' AND is_active = true LIMIT 1;
        
        IF FOUND THEN
            -- Notify Seller (The new owner)
            IF 'SELLER' = ANY(rule.recipients) THEN
                recipient_id := NEW.created_by;
                
                -- APP Notification
                IF 'APP' = ANY(rule.channels) THEN
                    INSERT INTO "CRM_Notifications" (user_id, type, title, message, entity_id, entity_type)
                    VALUES (
                        recipient_id,
                        'NEW_ACCOUNT',
                        'Nueva Cuenta Asignada',
                        'Se te ha asignado la cuenta: ' || NEW.nombre,
                        NEW.id,
                        'ACCOUNT'
                    );
                END IF;
                
                -- TODO: Handle EMAIL / TEAMS via Edge Functions (async) if needed
            END IF;
            
            -- Notify Coordinator (Logic to find coordinator?)
            -- For now, let's keep it simple to Seller as requested in examples ("Notificar al vendedor o coordinador")
             -- If we need to notify coordinator, we need a way to link user -> coordinator. 
             -- Assuming 'created_by' is the seller.
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for Accounts
DROP TRIGGER IF EXISTS trg_notify_account_assignment ON "CRM_Cuentas";
CREATE TRIGGER trg_notify_account_assignment
AFTER INSERT OR UPDATE ON "CRM_Cuentas"
FOR EACH ROW EXECUTE FUNCTION handle_new_account_assignment();


-- Function to handle New Opportunity Assignment
CREATE OR REPLACE FUNCTION handle_new_opportunity_assignment() RETURNS TRIGGER AS $$
DECLARE
    rule RECORD;
    recipient_id UUID;
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.owner_user_id IS DISTINCT FROM NEW.owner_user_id) OR (TG_OP = 'INSERT') THEN
         -- Find active rule
        SELECT * INTO rule FROM "CRM_NotificationRules" WHERE type = 'NEW_OPPORTUNITY' AND is_active = true LIMIT 1;
        
        IF FOUND THEN
            -- Notify Seller
            IF 'SELLER' = ANY(rule.recipients) THEN
                recipient_id := NEW.owner_user_id;

                IF 'APP' = ANY(rule.channels) THEN
                    INSERT INTO "CRM_Notifications" (user_id, type, title, message, entity_id, entity_type)
                    VALUES (
                        recipient_id,
                        'NEW_OPPORTUNITY',
                        'Nueva Oportunidad Asignada',
                        'Se te ha asignado la oportunidad: ' || NEW.nombre,
                        NEW.id,
                        'OPPORTUNITY'
                    );
                END IF;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for Opportunities
DROP TRIGGER IF EXISTS trg_notify_opportunity_assignment ON "CRM_Oportunidades";
CREATE TRIGGER trg_notify_opportunity_assignment
AFTER INSERT OR UPDATE ON "CRM_Oportunidades"
FOR EACH ROW EXECUTE FUNCTION handle_new_opportunity_assignment();

-- 5. Seed Default Rules
INSERT INTO "CRM_NotificationRules" (name, type, config, recipients, channels)
VALUES 
('Cliente Inactivo (90 días)', 'INACTIVE_CLIENT', '{"days": 90}', '{SELLER}', '{APP}'),
('Nueva Cuenta Asignada', 'NEW_ACCOUNT', '{}', '{SELLER}', '{APP}'),
('Nueva Oportunidad Asignada', 'NEW_OPPORTUNITY', '{}', '{SELLER}', '{APP}');
