-- =============================================================================
-- SERVER SIDE SYNC LOGIC (Last Write Wins)
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
    v_raw_id TEXT;
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
    v_has_created_by BOOLEAN;
    v_has_updated_by BOOLEAN;
    v_insert_cols TEXT[];
    v_insert_placeholders TEXT[];
    
    v_col_type TEXT;
    v_id_col TEXT;
    v_id_type TEXT;
    v_has_uuid_gen BOOLEAN;
    
    v_base_id_type TEXT;
    
    -- For snapshot mode
    v_snap_field TEXT;
    v_snap_value JSONB;
    v_update_clauses TEXT[];
BEGIN
    -- 0. Determine base identity and audit info once per call
    SELECT udt_name INTO v_base_id_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = p_table_name 
    AND column_name = 'id';

    IF v_base_id_type IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', format('Table %I not found or has no id column', p_table_name));
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = p_table_name 
        AND column_name = 'uuid_generado'
    ) INTO v_has_uuid_gen;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = p_table_name 
        AND column_name = 'created_by'
    ) INTO v_has_created_by;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = p_table_name 
        AND column_name = 'updated_by'
    ) INTO v_has_updated_by;

    -- Loop through updates
    FOR v_update IN SELECT * FROM jsonb_array_elements(p_updates)
    LOOP
        v_raw_id := v_update->>'id';
        v_field := v_update->>'field';
        v_value := v_update->'value'; 
        v_ts := (v_update->>'ts')::BIGINT;
        
        v_success := FALSE;
        v_message := 'Skipped (Outdated)';

        -- 1. Identify correct ID column and type
        IF v_base_id_type = 'int8' AND v_raw_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND v_has_uuid_gen THEN
            v_id_col := 'uuid_generado';
            v_id_type := 'uuid';
        ELSE
            v_id_col := 'id';
            v_id_type := COALESCE(v_base_id_type, 'uuid');
        END IF;

        -- 2. Fetch current row metadata
        v_query := format('SELECT to_jsonb(t) FROM %I t WHERE %I = ($1)::%I', p_table_name, v_id_col, v_id_type);
        EXECUTE v_query INTO v_current_row USING v_raw_id;

        BEGIN -- START INDIVIDUAL UPDATE BLOCK
            IF v_field = '_complete_snapshot_' AND v_current_row IS NULL THEN
                -- ATOMIC INSERT (SNAPSHOT MODE)
                v_current_metadata := '{}'::jsonb;
                v_insert_cols := ARRAY[v_id_col, '_sync_metadata'];
                v_insert_placeholders := ARRAY[format('($1)::%I', v_id_type), '$3'];
                
                IF v_has_created_by THEN
                    v_insert_cols := array_append(v_insert_cols, 'created_by'::text);
                    v_insert_placeholders := array_append(v_insert_placeholders, '$4'::text);
                END IF;
                IF v_has_updated_by THEN
                    v_insert_cols := array_append(v_insert_cols, 'updated_by'::text);
                    v_insert_placeholders := array_append(v_insert_placeholders, '$4'::text);
                END IF;

                FOR v_snap_field, v_snap_value IN SELECT * FROM jsonb_each(v_value)
                LOOP
                    -- Skip system managed columns in snapshot loop
                    IF v_snap_field IN ('id', 'uuid_generado', '_sync_metadata', 'created_at', 'updated_at', 'created_by', 'updated_by') THEN
                        CONTINUE;
                    END IF;

                    v_col_type := NULL;
                    SELECT udt_name INTO v_col_type 
                    FROM information_schema.columns 
                    WHERE table_schema = 'public' AND table_name = p_table_name AND column_name = v_snap_field;

                    IF v_col_type IS NOT NULL THEN
                        v_insert_cols := array_append(v_insert_cols, v_snap_field::text);
                        v_insert_placeholders := array_append(v_insert_placeholders, format('($2->>%L)::%I', v_snap_field, v_col_type));
                        v_current_metadata := jsonb_set(v_current_metadata, ARRAY[v_snap_field], to_jsonb(v_ts));
                    END IF;
                END LOOP;

                -- Important: We must use the current metadata we just built
                v_query := format('INSERT INTO %I (%s) VALUES (%s)', p_table_name, array_to_string(v_insert_cols, ', '), array_to_string(v_insert_placeholders, ', '));
                EXECUTE v_query USING v_raw_id, v_value, v_current_metadata, p_user_id;
                v_success := TRUE;
                v_message := 'Created (Snapshot)';

            ELSIF v_field = '_complete_snapshot_' AND v_current_row IS NOT NULL THEN
                -- ATOMIC UPDATE (SNAPSHOT MODE)
                v_current_metadata := COALESCE(v_current_row->'_sync_metadata', '{}'::jsonb);
                v_update_clauses := ARRAY[]::text[];
                
                FOR v_snap_field, v_snap_value IN SELECT * FROM jsonb_each(v_value)
                LOOP
                    IF v_snap_field IN ('id', 'uuid_generado', '_sync_metadata', 'created_at', 'updated_at', 'created_by', 'updated_by') THEN
                        CONTINUE;
                    END IF;

                    v_last_ts := COALESCE((v_current_metadata->>v_snap_field)::BIGINT, 0);
                    
                    IF v_ts > v_last_ts THEN
                        v_col_type := NULL;
                        SELECT udt_name INTO v_col_type 
                        FROM information_schema.columns 
                        WHERE table_schema = 'public' AND table_name = p_table_name AND column_name = v_snap_field;

                        IF v_col_type IS NOT NULL THEN
                            v_update_clauses := array_append(v_update_clauses, format('%I = ($1->>%L)::%I', v_snap_field, v_snap_field, v_col_type));
                            v_current_metadata := jsonb_set(v_current_metadata, ARRAY[v_snap_field], to_jsonb(v_ts));
                        END IF;
                    END IF;
                END LOOP;

                IF array_length(v_update_clauses, 1) > 0 OR v_has_updated_by THEN
                    IF v_has_updated_by THEN
                        v_update_clauses := array_append(v_update_clauses, 'updated_by = $3'::text);
                    END IF;
                    v_query := format('UPDATE %I SET %s, _sync_metadata = $2, updated_at = NOW() WHERE %I = ($4)::%I',
                        p_table_name, array_to_string(v_update_clauses, ', '), v_id_col, v_id_type);
                    EXECUTE v_query USING v_value, v_current_metadata, p_user_id, v_raw_id;
                    v_success := TRUE;
                    v_message := 'Updated (Snapshot)';
                ELSE
                    v_success := TRUE;
                    v_message := 'No changes needed (Snapshot)';
                END IF;

            ELSE
                -- SINGLE FIELD UPDATE (NORMAL MODE)
                IF v_current_row IS NULL THEN
                    v_current_metadata := jsonb_build_object(v_field, v_ts);
                    v_insert_cols := ARRAY[v_id_col, '_sync_metadata'];
                    v_insert_placeholders := ARRAY[format('($1)::%I', v_id_type), '$3'];

                    IF v_has_created_by THEN
                        v_insert_cols := array_append(v_insert_cols, 'created_by'::text);
                        v_insert_placeholders := array_append(v_insert_placeholders, '$4'::text);
                    END IF;
                    IF v_has_updated_by THEN
                        v_insert_cols := array_append(v_insert_cols, 'updated_by'::text);
                        v_insert_placeholders := array_append(v_insert_placeholders, '$4'::text);
                    END IF;

                    -- Only add v_field if it's not already covered (id or audit)
                    IF v_field NOT IN (v_id_col, 'created_by', 'updated_by', '_sync_metadata') THEN
                        v_col_type := NULL;
                        SELECT udt_name INTO v_col_type 
                        FROM information_schema.columns 
                        WHERE table_schema = 'public' AND table_name = p_table_name AND column_name = v_field;
                        
                        IF v_col_type IS NOT NULL THEN
                            v_insert_cols := array_append(v_insert_cols, v_field::text);
                            v_insert_placeholders := array_append(v_insert_placeholders, format('($2#>>''{}'')::%I', v_col_type));
                        END IF;
                    END IF;

                    v_query := format('INSERT INTO %I (%s) VALUES (%s)', p_table_name, array_to_string(v_insert_cols, ', '), array_to_string(v_insert_placeholders, ', '));
                    EXECUTE v_query USING v_raw_id, v_value, v_current_metadata, p_user_id;
                    v_success := TRUE;
                    v_message := 'Created';
                ELSE
                    v_current_metadata := COALESCE(v_current_row->'_sync_metadata', '{}'::jsonb);
                    v_last_ts := COALESCE((v_current_metadata->>v_field)::BIGINT, 0);

                    IF v_ts > v_last_ts THEN
                        v_col_type := NULL;
                        SELECT udt_name INTO v_col_type 
                        FROM information_schema.columns 
                        WHERE table_schema = 'public' AND table_name = p_table_name AND column_name = v_field;

                        IF v_col_type IS NOT NULL THEN
                            v_query := format('UPDATE %I SET %I = ($1#>>''{}'')::%I, _sync_metadata = $2, updated_at = NOW() %s WHERE %I = ($4)::%I',
                                p_table_name, v_field, v_col_type, 
                                CASE WHEN v_has_updated_by THEN ', updated_by = $3' ELSE '' END,
                                v_id_col, v_id_type);
                            EXECUTE v_query USING v_value, v_current_metadata, p_user_id, v_raw_id;
                            v_success := TRUE;
                            v_message := 'Updated';
                        ELSE
                           v_success := FALSE;
                           v_message := format('Column %I not found in table %I', v_field, p_table_name);
                        END IF;
                    END IF;
                END IF;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_success := FALSE;
            v_message := SQLERRM;
        END; -- END INDIVIDUAL UPDATE BLOCK

        -- Log result
        v_results := v_results || jsonb_build_object(
            'id', v_raw_id,
            'field', v_field,
            'success', v_success,
            'message', v_message
        );
    END LOOP;

    RETURN v_results;
END;
$$;
