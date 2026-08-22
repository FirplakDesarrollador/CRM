-- Harden the browser-facing sync RPC without changing its public signature.
-- The legacy implementation is moved to a non-exposed schema and runs as the
-- authenticated caller, so RLS remains authoritative.

create schema if not exists private;
revoke all on schema private from public;

alter function public.process_field_updates(text, jsonb, uuid)
    set schema private;

alter function private.process_field_updates(text, jsonb, uuid)
    security invoker;

revoke all on function private.process_field_updates(text, jsonb, uuid) from public;
revoke all on function private.process_field_updates(text, jsonb, uuid) from anon;
grant usage on schema private to authenticated;
grant execute on function private.process_field_updates(text, jsonb, uuid) to authenticated;

create or replace function public.process_field_updates(
    p_table_name text,
    p_updates jsonb,
    p_user_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_results jsonb;
    v_enriched_results jsonb;
    v_update jsonb;
    v_result jsonb;
    v_index integer;
    v_id_column text;
begin
    if auth.uid() is null then
        raise exception 'Authentication required';
    end if;

    if p_user_id is distinct from auth.uid() then
        raise exception 'p_user_id must match auth.uid()';
    end if;

    if p_table_name <> all (array[
        'CRM_Cuentas',
        'CRM_Contactos',
        'CRM_Oportunidades',
        'CRM_Oportunidades_Colaboradores',
        'CRM_Cotizaciones',
        'CRM_CotizacionItems',
        'CRM_Actividades',
        'CRM_Pedidos',
        'CRM_PedidoItems',
        'CRM_SapIntegrationQueue'
    ]::text[]) then
        raise exception 'Table % is not allowed for synchronization', p_table_name;
    end if;

    if jsonb_typeof(p_updates) <> 'array' then
        raise exception 'p_updates must be a JSON array';
    end if;

    v_results := private.process_field_updates(p_table_name, p_updates, p_user_id);
    if jsonb_typeof(v_results) <> 'array' then
        raise exception 'Legacy sync implementation returned a non-array response';
    end if;

    -- The legacy single-field path did not persist the accepted timestamp in
    -- _sync_metadata. Repair it in the same transaction so LWW remains real.
    for v_index in 0 .. jsonb_array_length(p_updates) - 1 loop
        v_update := p_updates -> v_index;
        v_result := v_results -> v_index;

        if coalesce((v_result ->> 'success')::boolean, false)
           and v_update ->> 'field' <> '_complete_snapshot_' then
            select case
                when exists (
                    select 1
                    from information_schema.columns
                    where table_schema = 'public'
                      and table_name = p_table_name
                      and column_name = 'uuid_generado'
                ) and (v_update ->> 'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then 'uuid_generado'
                else 'id'
            end into v_id_column;

            execute format(
                'update public.%I set _sync_metadata = jsonb_set(coalesce(_sync_metadata, ''{}''::jsonb), array[$1], to_jsonb($2::bigint), true) where %I::text = $3',
                p_table_name,
                v_id_column
            ) using v_update ->> 'field', v_update ->> 'ts', v_update ->> 'id';
        end if;
    end loop;

    select coalesce(
        jsonb_agg(
            result_item || jsonb_build_object(
                'mutation_id', update_item ->> 'mutation_id'
            )
            order by result_ord
        ),
        '[]'::jsonb
    )
    into v_enriched_results
    from jsonb_array_elements(v_results) with ordinality as results(result_item, result_ord)
    join jsonb_array_elements(p_updates) with ordinality as updates(update_item, update_ord)
      on result_ord = update_ord;

    return v_enriched_results;
end;
$$;

revoke all on function public.process_field_updates(text, jsonb, uuid) from public;
revoke all on function public.process_field_updates(text, jsonb, uuid) from anon;
grant execute on function public.process_field_updates(text, jsonb, uuid) to authenticated;

-- Pedido items previously used created_at as their incremental cursor, making
-- edits invisible forever. Add and maintain updated_at for proper deltas.
alter table public."CRM_PedidoItems"
    add column if not exists updated_at timestamptz not null default now();

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists crm_pedido_items_set_updated_at on public."CRM_PedidoItems";
create trigger crm_pedido_items_set_updated_at
before update on public."CRM_PedidoItems"
for each row execute function private.set_updated_at();

create index if not exists crm_pedido_items_updated_at_id_idx
    on public."CRM_PedidoItems" (updated_at, id);
