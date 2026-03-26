SELECT jsonb_pretty(
  jsonb_build_object(
    'database',     'CRM_FIRPLAK',
    'schema',       'public',
    'exportado_en', now()::text,
    'tablas',       (
      SELECT jsonb_agg(tabla_obj ORDER BY tabla_obj->>'tabla')
      FROM (
        SELECT jsonb_build_object(
          'tabla',         t.table_name,
          'columnas',      (
            SELECT jsonb_agg(
              jsonb_build_object(
                'columna',   c.column_name,
                'tipo',      CASE
                               WHEN c.character_maximum_length IS NOT NULL
                               THEN c.data_type || '(' || c.character_maximum_length || ')'
                               ELSE c.udt_name
                             END,
                'nullable',  c.is_nullable,
                'default',   c.column_default
              ) ORDER BY c.ordinal_position
            )
            FROM information_schema.columns c
            WHERE c.table_schema = 'public'
              AND c.table_name = t.table_name
          ),
          'primary_key',   COALESCE((
            SELECT jsonb_agg(kcu.column_name ORDER BY kcu.ordinal_position)
            FROM information_schema.table_constraints tc2
            JOIN information_schema.key_column_usage kcu
              ON tc2.constraint_name = kcu.constraint_name
              AND tc2.table_schema  = kcu.table_schema
            WHERE tc2.constraint_type = 'PRIMARY KEY'
              AND tc2.table_schema    = 'public'
              AND tc2.table_name      = t.table_name
          ), '[]'::jsonb),
          'foreign_keys',  COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'columna',           kcu.column_name,
                'tabla_referencia',  ccu.table_name,
                'columna_referencia', ccu.column_name
              )
            )
            FROM information_schema.table_constraints tc3
            JOIN information_schema.key_column_usage kcu
              ON tc3.constraint_name = kcu.constraint_name
              AND tc3.table_schema  = kcu.table_schema
            JOIN information_schema.constraint_column_usage ccu
              ON ccu.constraint_name = tc3.constraint_name
              AND ccu.table_schema  = tc3.table_schema
            WHERE tc3.constraint_type = 'FOREIGN KEY'
              AND tc3.table_schema    = 'public'
              AND tc3.table_name      = t.table_name
          ), '[]'::jsonb),
          'unique_constraints', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'nombre',    tc4.constraint_name,
                'columnas',  (
                  SELECT jsonb_agg(k2.column_name ORDER BY k2.ordinal_position)
                  FROM information_schema.key_column_usage k2
                  WHERE k2.constraint_name = tc4.constraint_name
                    AND k2.table_schema    = tc4.table_schema
                )
              )
            )
            FROM information_schema.table_constraints tc4
            WHERE tc4.constraint_type = 'UNIQUE'
              AND tc4.table_schema    = 'public'
              AND tc4.table_name      = t.table_name
          ), '[]'::jsonb),
          'indices', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'nombre',    i.relname,
                'definicion', pg_get_indexdef(ix.indexrelid),
                'es_unico',  ix.indisunique
              )
            )
            FROM pg_index ix
            JOIN pg_class ti ON ti.oid = ix.indrelid
            JOIN pg_class i  ON i.oid  = ix.indexrelid
            JOIN pg_namespace ni ON ni.oid = ti.relnamespace
            WHERE ni.nspname = 'public'
              AND ti.relname = t.table_name
              AND NOT ix.indisprimary
          ), '[]'::jsonb),
          'triggers', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'nombre',   trg.trigger_name,
                'evento',   trg.event_manipulation,
                'timing',   trg.action_timing,
                'accion',   trg.action_statement
              )
            )
            FROM information_schema.triggers trg
            WHERE trg.trigger_schema      = 'public'
              AND trg.event_object_table  = t.table_name
          ), '[]'::jsonb),
          'rls_habilitado', (
            SELECT cl.relrowsecurity
            FROM pg_class cl
            JOIN pg_namespace ns ON ns.oid = cl.relnamespace
            WHERE ns.nspname = 'public'
              AND cl.relname = t.table_name
              AND cl.relkind = 'r'
            LIMIT 1
          ),
          'filas_estimadas', (
            SELECT cl.reltuples::bigint
            FROM pg_class cl
            JOIN pg_namespace ns ON ns.oid = cl.relnamespace
            WHERE ns.nspname = 'public'
              AND cl.relname = t.table_name
              AND cl.relkind = 'r'
            LIMIT 1
          )
        ) AS tabla_obj
        FROM information_schema.tables t
        WHERE t.table_schema = 'public'
          AND t.table_type   = 'BASE TABLE'
          AND t.table_name LIKE 'CRM_%'
      ) sub
    ),
    'resumen_relaciones', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'desde_tabla',   kcu.table_name,
          'columna',       kcu.column_name,
          'hacia_tabla',   ccu.table_name,
          'ref_columna',   ccu.column_name
        ) ORDER BY kcu.table_name, kcu.column_name
      )
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema  = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema  = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema    = 'public'
        AND tc.table_name LIKE 'CRM_%'
    ), '[]'::jsonb),
    'funciones_rpc', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'nombre',      p.proname,
          'argumentos',  pg_get_function_arguments(p.oid),
          'retorna',     pg_get_function_result(p.oid),
          'lenguaje',    l.lanname,
          'seguridad',   CASE WHEN p.prosecdef THEN 'DEFINER' ELSE 'INVOKER' END
        ) ORDER BY p.proname
      )
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      JOIN pg_language l  ON l.oid = p.prolang
      WHERE n.nspname = 'public'
        AND l.lanname IN ('sql', 'plpgsql')
    ), '[]'::jsonb)
  )
) AS estructura_crm_json;
