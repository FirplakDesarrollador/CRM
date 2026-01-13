-- =============================================================================
-- FIX 3: process_field_updates - Robust parameter mapping
-- =============================================================================

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
    v_value JSONB;
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
BEGIN
    -- 0. Check for common ownership columns
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = p_table_name AND column_name = 'owner_user_id'
    ) INTO v_has_owner_col;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = p_table_name AND column_name = 'user_id'
    ) INTO v_has_user_col;

    -- Loop through updates
    FOR v_update IN SELECT * FROM jsonb_array_elements(p_updates)
    LOOP
        v_id := (v_update->>'id')::UUID;
        v_field := v_update->>'field';
        v_value := v_update->'value';
        v_ts := (v_update->>'ts')::BIGINT;
        
        v_success := FALSE;
        v_message := 'Skipped (Outdated)';

        -- 1. Fetch current row metadata
        EXECUTE format('SELECT to_jsonb(t) FROM %I t WHERE id = $1', p_table_name)
        INTO v_current_row
        USING v_id;

        IF v_current_row IS NULL THEN
            -- UPSERT with type-aware conversion
            v_current_metadata := jsonb_build_object(v_field, v_ts);
            
            -- Build dynamic INSERT
            -- $1: v_id, $2: v_value, $3: v_current_metadata, $4: p_user_id
            v_query := format(
                'INSERT INTO %1$I (id, %2$I, _sync_metadata, created_by, updated_by %3$s %4$s) 
                 VALUES ($1, (jsonb_populate_record(NULL::%1$I, jsonb_build_object(%2$L, $2))).%2$I, $3, $4, $4 %5$s %6$s)',
                p_table_name,
                v_field,
                CASE WHEN v_has_owner_col AND v_field != 'owner_user_id' THEN ', owner_user_id' ELSE '' END,
                CASE WHEN v_has_user_col AND v_field != 'user_id' THEN ', user_id' ELSE '' END,
                CASE WHEN v_has_owner_col AND v_field != 'owner_user_id' THEN ', $4' ELSE '' END,
                CASE WHEN v_has_user_col AND v_field != 'user_id' THEN ', $4' ELSE '' END
            );
            
            EXECUTE v_query USING v_id, v_value, v_current_metadata, p_user_id;
            v_success := TRUE;
            v_message := 'Created';
        ELSE
            v_current_metadata := COALESCE(v_current_row->'_sync_metadata', '{}'::jsonb);
            v_last_ts := COALESCE((v_current_metadata->>v_field)::BIGINT, 0);

            IF v_ts > v_last_ts THEN
                -- 3. Apply Update
                v_current_metadata := jsonb_set(v_current_metadata, ARRAY[v_field], to_jsonb(v_ts));
                
                -- Dynamic UPDATE
                -- $1: v_value, $2: v_current_metadata, $3: p_user_id, $4: v_id
                v_query := format(
                    'UPDATE %1$I SET %2$I = (jsonb_populate_record(NULL::%1$I, jsonb_build_object(%2$L, $1))).%2$I, _sync_metadata = $2 %3$s %4$s WHERE id = $4',
                    p_table_name, 
                    v_field,
                    CASE WHEN v_field != 'updated_at' AND v_field != 'created_at' THEN ', updated_at = NOW()' ELSE '' END,
                    CASE WHEN v_field != 'updated_by' AND v_field != 'created_by' THEN ', updated_by = $3' ELSE '' END
                );
                
                EXECUTE v_query USING v_value, v_current_metadata, p_user_id, v_id;
                v_success := TRUE;
                v_message := 'Updated';
            END IF;
        END IF;

        v_results := v_results || jsonb_build_object('id', v_id, 'field', v_field, 'success', v_success, 'message', v_message);
    END LOOP;

    RETURN v_results;
END;
$$;
