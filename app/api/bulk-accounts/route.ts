import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// ── Helpers ───────────────────────────────────────────────────────────
function normalize(s: string): string {
    return s
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''); // strip diacritics
}

function closeMatch(text: string, candidates: { id: number; nombre: string }[]): number | null {
    if (!text || !text.trim()) return null;
    const norm = normalize(text);

    // 1. Exact match (after normalisation)
    const exact = candidates.find(c => normalize(c.nombre) === norm);
    if (exact) return exact.id;

    // 2. Starts-with or includes
    const startsWith = candidates.find(c => normalize(c.nombre).startsWith(norm) || norm.startsWith(normalize(c.nombre)));
    if (startsWith) return startsWith.id;

    const includes = candidates.find(c => normalize(c.nombre).includes(norm) || norm.includes(normalize(c.nombre)));
    if (includes) return includes.id;

    return null;
}

const VALID_CANALES = ['DIST_NAC', 'DIST_INT', 'OBRAS_NAC', 'OBRAS_INT', 'PROPIO'];

function resolveCanal(text: string): string {
    if (!text) return 'DIST_NAC';
    const upper = text.toUpperCase().trim();
    if (VALID_CANALES.includes(upper)) return upper;

    // Friendly names → IDs
    const map: Record<string, string> = {
        'distribucion nacional': 'DIST_NAC',
        'distribucion internacional': 'DIST_INT',
        'obras nacional': 'OBRAS_NAC',
        'obras internacional': 'OBRAS_INT',
        'canal propio': 'PROPIO',
        'propio': 'PROPIO',
    };
    return map[normalize(text)] || 'DIST_NAC';
}

// ── Types ─────────────────────────────────────────────────────────────
interface RowInput {
    cuenta_nombre: string;
    cuenta_nit?: string;
    cuenta_telefono?: string;
    cuenta_direccion?: string;
    cuenta_email?: string;
    cuenta_canal?: string;
    cuenta_pais?: string;
    cuenta_departamento?: string;
    cuenta_ciudad?: string;
    contacto_nombre?: string;
    contacto_cargo?: string;
    contacto_email?: string;
    contacto_telefono?: string;
    // Pre-resolved IDs from wizard validation
    _resolved_pais_id?: number | null;
    _resolved_depto_id?: number | null;
    _resolved_ciudad_id?: number | null;
}

// ── POST handler ──────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();

        // Auth check
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const body = await req.json();
        const rows: RowInput[] = body.rows;

        if (!rows || !Array.isArray(rows) || rows.length === 0) {
            return NextResponse.json({ error: 'No se recibieron filas' }, { status: 400 });
        }

        // ── Load territory catalogs ──────────────────────────────────
        const [{ data: paises }, { data: departamentos }, { data: ciudades }] = await Promise.all([
            supabase.from('CRM_Paises').select('id, nombre'),
            supabase.from('CRM_Departamentos').select('id, nombre, pais_id'),
            supabase.from('CRM_Ciudades').select('id, nombre, departamento_id'),
        ]);

        const paisList = paises || [];
        const depList = departamentos || [];
        const cityList = ciudades || [];

        // ── Process rows ─────────────────────────────────────────────
        const errors: string[] = [];
        let createdAccounts = 0;
        let createdContacts = 0;

        const BATCH = 50;
        for (let i = 0; i < rows.length; i += BATCH) {
            const batch = rows.slice(i, i + BATCH);

            for (let j = 0; j < batch.length; j++) {
                const row = batch[j];
                const rowNum = i + j + 1;

                if (!row.cuenta_nombre || !row.cuenta_nombre.trim()) {
                    errors.push(`Fila ${rowNum}: nombre de cuenta vacío, se omite.`);
                    continue;
                }

                // Resolve territories — use pre-resolved IDs if available, else close-match
                const paisId = row._resolved_pais_id ?? closeMatch(row.cuenta_pais || '', paisList);
                const filteredDeps = paisId ? depList.filter(d => d.pais_id === paisId) : depList;
                const depId = row._resolved_depto_id ?? closeMatch(row.cuenta_departamento || '', filteredDeps);
                const filteredCities = depId ? cityList.filter(c => c.departamento_id === depId) : cityList;
                const ciudadId = row._resolved_ciudad_id ?? closeMatch(row.cuenta_ciudad || '', filteredCities);

                const canalId = resolveCanal(row.cuenta_canal || '');
                const accountId = crypto.randomUUID();

                const accountPayload = {
                    id: accountId,
                    nombre: row.cuenta_nombre.trim(),
                    nit_base: (row.cuenta_nit || '').trim() || null,
                    telefono: (row.cuenta_telefono || '').trim() || null,
                    direccion: (row.cuenta_direccion || '').trim() || null,
                    email: (row.cuenta_email || '').trim() || null,
                    canal_id: canalId,
                    pais_id: paisId,
                    departamento_id: depId,
                    ciudad_id: ciudadId,
                    created_by: user.id,
                    owner_user_id: body.vendedor_id || user.id,
                    updated_at: new Date().toISOString(),
                };

                const { error: accErr } = await supabase.from('CRM_Cuentas').insert(accountPayload);
                if (accErr) {
                    errors.push(`Fila ${rowNum} (${row.cuenta_nombre}): ${accErr.message}`);
                    continue;
                }
                createdAccounts++;

                // Insert contact if provided
                if (row.contacto_nombre && row.contacto_nombre.trim()) {
                    const contactId = crypto.randomUUID();
                    const contactPayload = {
                        id: contactId,
                        account_id: accountId,
                        nombre: row.contacto_nombre.trim(),
                        cargo: (row.contacto_cargo || '').trim() || null,
                        email: (row.contacto_email || '').trim() || null,
                        telefono: (row.contacto_telefono || '').trim() || null,
                        es_principal: true,
                        created_by: user.id,
                        updated_by: user.id,
                        updated_at: new Date().toISOString(),
                    };

                    const { error: conErr } = await supabase.from('CRM_Contactos').insert(contactPayload);
                    if (conErr) {
                        errors.push(`Fila ${rowNum} contacto (${row.contacto_nombre}): ${conErr.message}`);
                    } else {
                        createdContacts++;
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            createdAccounts,
            createdContacts,
            errors,
        });
    } catch (err: any) {
        console.error('[bulk-accounts] Error:', err);
        return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
    }
}
