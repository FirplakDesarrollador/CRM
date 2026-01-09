-- =============================================================================
-- SERVER SIDE SYNC LOGIC (Last Write Wins)
-- =============================================================================

-- 1. Payload Type
-- We expect a JSON payload like:
-- {
--   "table": "CRM_Cuentas",
--   "changes": [
--      { "id": "...", "field": "nombre", "value": "New", "ts": 123456789 }
--   ]
-- }

-- But since SQL is strict, let's make a generic function using dynamic SQL.

CREATE OR REPLACE FUNCTION process_field_updates(
    p_table_name TEXT,
    p_updates JSONB, -- Array of objects: { id, field, value, ts }
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_update JSONB;
    v_id UUID;
    v_field TEXT;
    v_value JSONB; -- Changed to JSONB for better casting
    v_ts BIGINT;
    
    v_current_row JSONB;
    v_current_metadata JSONB;
    v_last_ts BIGINT;
    
    v_results JSONB := '[]'::jsonb;
    v_success BOOLEAN;
    v_message TEXT;
    
    v_query TEXT;
    v_has_owner_col BOOLEAN;
    v_has_user_col BOOLEAN;
    v_insert_cols TEXT[];
    v_insert_placeholders TEXT[];
BEGIN
    -- 0. Check for common ownership columns so we can satisfy NOT NULL constraints on first insert
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = p_table_name 
        AND column_name = 'owner_user_id'
    ) INTO v_has_owner_col;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = p_table_name 
        AND column_name = 'user_id'
    ) INTO v_has_user_col;

    -- Loop through updates
    FOR v_update IN SELECT * FROM jsonb_array_elements(p_updates)
    LOOP
        v_id := (v_update->>'id')::UUID;
        v_field := v_update->>'field';
        v_value := v_update->'value'; -- Keep as JSONB
        v_ts := (v_update->>'ts')::BIGINT;
        
        v_success := FALSE;
        v_message := 'Skipped (Outdated)';

        -- 1. Fetch current row metadata
        EXECUTE format('SELECT to_jsonb(t) FROM %I t WHERE id = $1', p_table_name)
        INTO v_current_row
        USING v_id;

        IF v_current_row IS NULL THEN
            -- UPSERT LOGIC: If row doesn't exist, create it with this first field
            v_current_metadata := jsonb_build_object(v_field, v_ts);
            
            -- Construct dynamic INSERT columns and placeholders
            v_insert_cols := ARRAY['id', v_field, '_sync_metadata', 'created_by', 'updated_by'];
            v_insert_placeholders := ARRAY['$1', '($2#>>''{}'')::text', '$3', '$4', '$4'];

            -- Auto-fill ownership if not the field being updated
            IF v_has_owner_col AND v_field != 'owner_user_id' THEN
                v_insert_cols := v_insert_cols || 'owner_user_id';
                v_insert_placeholders := v_insert_placeholders || '$4';
            END IF;

            IF v_has_user_col AND v_field != 'user_id' THEN
                v_insert_cols := v_insert_cols || 'user_id';
                v_insert_placeholders := v_insert_placeholders || '$4';
            END IF;

            v_query := format(
                'INSERT INTO %I (%s) VALUES (%s)',
                p_table_name,
                array_to_string(v_insert_cols, ', '),
                array_to_string(v_insert_placeholders, ', ')
            );
            
            EXECUTE v_query USING v_id, v_value, v_current_metadata, p_user_id;

            v_success := TRUE;
            v_message := 'Created';
        ELSE
            v_current_metadata := COALESCE(v_current_row->'_sync_metadata', '{}'::jsonb);
            v_last_ts := COALESCE((v_current_metadata->>v_field)::BIGINT, 0);

            -- 2. LWW Check
            IF v_ts > v_last_ts THEN
                -- 3. Apply Update
                v_current_metadata := jsonb_set(v_current_metadata, ARRAY[v_field], to_jsonb(v_ts));
                
                v_query := format(
                    'UPDATE %I SET %I = ($1#>>''{}'')::text, _sync_metadata = $2, updated_at = NOW(), updated_by = $3 WHERE id = $4',
                    p_table_name, v_field
                );
                
                EXECUTE v_query USING v_value, v_current_metadata, p_user_id, v_id;
                
                v_success := TRUE;
                v_message := 'Updated';
            END IF;
        END IF;

        -- Log result
        v_results := v_results || jsonb_build_object(
            'id', v_id,
            'field', v_field,
            'success', v_success,
            'message', v_message
        );
    END LOOP;

    RETURN v_results;
END;
$$;
