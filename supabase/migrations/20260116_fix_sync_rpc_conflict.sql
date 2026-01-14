-- =============================================================================
-- FIX: process_field_updates - Exclude _sync_metadata and other system cols from UPDATE loop
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
    v_id UUID;
    v_update RECORD;
    v_current_row JSONB;
    v_current_metadata JSONB;
    v_last_ts BIGINT;
    
    v_results JSONB := '[]'::jsonb;
    v_success BOOLEAN;
    v_message TEXT;
    
    v_query TEXT;
    v_cols TEXT[];
    v_row_data JSONB;
    v_meta JSONB;
    
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

    -- 1. Identify all unique IDs in this batch
    FOR v_id IN 
        SELECT DISTINCT (u->>'id')::UUID 
        FROM jsonb_array_elements(p_updates) u
    LOOP
        -- 2. Fetch current row metadata
        EXECUTE format('SELECT to_jsonb(t) FROM %I t WHERE id = $1', p_table_name)
        INTO v_current_row
        USING v_id;

        IF v_current_row IS NULL THEN
            -- ==========================================
            -- CASE A: NEW ROW (INSERT)
            -- ==========================================
            v_cols := ARRAY['id'];
            v_row_data := jsonb_build_object('id', v_id);
            v_meta := '{}'::jsonb;

            -- Gather ALL fields for this ID from the batch (Latest version of each)
            FOR v_update IN 
                SELECT DISTINCT ON (val->>'field') 
                    (val->>'field') as field, val->'value' as value, (val->>'ts')::bigint as ts 
                FROM jsonb_array_elements(p_updates) val 
                WHERE (val->>'id')::UUID = v_id 
                  AND (val->>'field') NOT IN ('id', 'created_by', 'updated_by', '_sync_metadata')
                ORDER BY (val->>'field'), (val->>'ts') DESC
            LOOP
                v_cols := array_append(v_cols, v_update.field);
                v_row_data := v_row_data || jsonb_build_object(v_update.field, v_update.value);
                v_meta := jsonb_set(v_meta, ARRAY[v_update.field], to_jsonb(v_update.ts));
            END LOOP;

            -- Auto-inject ownership if missing
            IF v_has_owner_col AND NOT ('owner_user_id' = ANY(v_cols)) THEN
                v_cols := array_append(v_cols, 'owner_user_id');
                v_row_data := v_row_data || jsonb_build_object('owner_user_id', p_user_id);
            END IF;
            
            IF v_has_user_col AND NOT ('user_id' = ANY(v_cols)) THEN
                v_cols := array_append(v_cols, 'user_id');
                v_row_data := v_row_data || jsonb_build_object('user_id', p_user_id);
            END IF;

            -- Append metadata and audit
            v_cols := array_cat(v_cols, ARRAY['_sync_metadata', 'created_by', 'updated_by']);
            v_row_data := v_row_data || jsonb_build_object(
                '_sync_metadata', v_meta,
                'created_by', p_user_id,
                'updated_by', p_user_id
            );

            -- Build and execute dynamic INSERT
            -- Using jsonb_populate_record(NULL::table, ...) ensures correct typing for all fields
            v_query := format(
                'INSERT INTO %1$I (%2$s) SELECT %2$s FROM jsonb_populate_record(NULL::%1$I, $1)',
                p_table_name,
                (SELECT string_agg(quote_ident(c), ', ') FROM unnest(v_cols) c)
            );

            EXECUTE v_query USING v_row_data;
            
            v_results := v_results || jsonb_build_object('id', v_id, 'status', 'Created');
        ELSE
            -- ==========================================
            -- CASE B: EXISTING ROW (UPDATE)
            -- ==========================================
            v_current_metadata := COALESCE(v_current_row->'_sync_metadata', '{}'::jsonb);

            -- Process each field update individually with conflict resolution (LWW)
            FOR v_update IN 
                SELECT DISTINCT ON (val->>'field')
                    (val->>'field') as field, val->'value' as value, (val->>'ts')::bigint as ts 
                FROM jsonb_array_elements(p_updates) val 
                WHERE (val->>'id')::UUID = v_id 
                  AND (val->>'field') NOT IN ('id', '_sync_metadata') -- EXCLUDE SYSTEM FIELDS
                ORDER BY (val->>'field'), (val->>'ts') DESC
            LOOP
                v_last_ts := COALESCE((v_current_metadata->>v_update.field)::BIGINT, 0);

                IF v_update.ts > v_last_ts THEN
                    v_current_metadata := jsonb_set(v_current_metadata, ARRAY[v_update.field], to_jsonb(v_update.ts));
                    
                    v_query := format(
                        'UPDATE %1$I SET %2$I = (jsonb_populate_record(NULL::%1$I, jsonb_build_object(%2$L, $1))).%2$I, _sync_metadata = $2 %3$s %4$s WHERE id = $4',
                        p_table_name, 
                        v_update.field,
                        CASE WHEN v_update.field != 'updated_at' AND v_update.field != 'created_at' THEN ', updated_at = NOW()' ELSE '' END,
                        CASE WHEN v_update.field != 'updated_by' AND v_update.field != 'created_by' THEN ', updated_by = $3' ELSE '' END
                    );
                    
                    EXECUTE v_query USING v_update.value, v_current_metadata, p_user_id, v_id;
                    v_results := v_results || jsonb_build_object('id', v_id, 'field', v_update.field, 'status', 'Updated');
                ELSE
                    v_results := v_results || jsonb_build_object('id', v_id, 'field', v_update.field, 'status', 'Skipped');
                END IF;
            END LOOP;
        END IF;
    END LOOP;

    RETURN v_results;
END;
$$;
