const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceKey) {
    console.error("❌ SUPABASE_SERVICE_ROLE_KEY no encontrada en .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

// Mapeo Zonas Firplak → Departamentos de Colombia
const ZONA_DEPARTAMENTOS = {
    'CENTRO DEL PAIS': ['Cundinamarca', 'Bogotá D.C.', 'Boyacá', 'Meta', 'Casanare', 'Arauca'],
    'CORDOBA, SUCRE Y URABA': ['Córdoba', 'Sucre', 'Chocó'],
    'COSTA ATLÁNTICA': ['Atlántico', 'Bolívar', 'Magdalena', 'Cesar', 'La Guajira'],
    'EJE CAFETERO': ['Antioquia', 'Caldas', 'Risaralda', 'Quindío'],
    'SANTANDERES': ['Santander', 'Norte de Santander'],
    'SUR OCCIDENTE': ['Valle del Cauca', 'Cauca', 'Nariño'],
    'TOLIMA GRANDE': ['Tolima', 'Huila'],
    'EXTERIOR': []
};

const PAIS_COLOMBIA_ID = '1';

// Match manual: nombre Excel → email en Supabase
const EMAIL_OVERRIDES = {
    'Yaneth Rojas': 'yaneth.rojas@firplak.com',
    'Johana Coronado': 'johana.coronado@firplak.com',
    'Luz María Echeverri Cano': 'luz.echeverri@firplak.com',
    'Juan Esteban Correa': 'julian.correa@firplak.com',
    'Mario Bermudez': 'mario.bermudez@firplak.com',
    'Martha Giraldo': 'marta.giraldo@firplak.com',
    'Julián Martinez': 'julian.martinez@firplak.com',
    'Monica Zuluaga': 'monica.zuluaga@firplak.com',
};

const normalize = (str) => str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

async function run() {
    // 1. Leer Excel
    const filePath = path.join(__dirname, '..', 'Firplak - Zonas por asesor comercial.xlsx');
    const wb = XLSX.readFile(filePath);
    const ws = wb.Sheets['Zonas'];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(1);

    // 2. Obtener departamentos
    const { data: depts, error: deptsErr } = await supabase
        .from('CRM_Departamentos')
        .select('id, nombre, pais_id')
        .eq('pais_id', 1);

    if (deptsErr) { console.error("Error departamentos:", deptsErr.message); return; }

    // 3. Obtener usuarios
    const { data: usuarios, error: usersErr } = await supabase
        .from('CRM_Usuarios')
        .select('id, full_name, email, paises, departamentos')
        .eq('is_active', true);

    if (usersErr) { console.error("Error usuarios:", usersErr.message); return; }

    // 4. Agrupar zonas por vendedor
    const vendedorZonas = {};
    rows.forEach(([zona, vendedor]) => {
        if (!vendedor) return;
        const key = vendedor.trim();
        if (!vendedorZonas[key]) vendedorZonas[key] = [];
        if (!vendedorZonas[key].includes(zona)) vendedorZonas[key].push(zona.trim());
    });

    const updates = [];

    console.log("=== PLAN DE ACTUALIZACIÓN ===");

    for (const [vendedorNombre, zonas] of Object.entries(vendedorZonas)) {
        const overrideEmail = EMAIL_OVERRIDES[vendedorNombre];
        const targetNorm = normalize(vendedorNombre);
        const targetParts = targetNorm.split(' ');

        const usuario = usuarios.find(u => {
            if (overrideEmail && u.email === overrideEmail) return true;
            const nameNorm = normalize(u.full_name || u.email || '');
            if (nameNorm === targetNorm) return true;
            const nameParts = nameNorm.split(' ');
            const matchFirst = targetParts[0] && nameParts.includes(targetParts[0]);
            const matchSecond = targetParts[1] && nameParts.some(p => p.startsWith(targetParts[1].substring(0, 4)));
            return matchFirst && matchSecond;
        });

        // Recopilar IDs de departamentos
        const deptNombres = new Set();
        const esExterior = zonas.includes('EXTERIOR');
        zonas.forEach(zona => {
            (ZONA_DEPARTAMENTOS[zona] || []).forEach(d => deptNombres.add(d));
        });

        const deptIds = [];
        deptNombres.forEach(nombre => {
            const dept = depts.find(d =>
                normalize(d.nombre).includes(normalize(nombre)) ||
                normalize(nombre).includes(normalize(d.nombre))
            );
            if (dept) deptIds.push(String(dept.id));
        });

        const matchedAs = usuario ? `(${usuario.email})` : '';
        const status = usuario ? '✅' : '❌ NO ENCONTRADO';
        console.log(`\n${status} ${vendedorNombre} ${matchedAs}`);
        console.log(`   Zonas: ${zonas.join(', ')}`);
        console.log(`   Departamentos IDs: [${deptIds.join(', ')}]`);
        if (esExterior) console.log(`   🌍 Zona EXTERIOR`);

        if (usuario) {
            updates.push({ id: usuario.id, nombre: vendedorNombre, deptIds, esExterior });
        }
    }

    console.log(`\n${updates.length} de ${Object.keys(vendedorZonas).length} vendedores para actualizar.`);

    const applyMode = process.argv.includes('--apply');
    if (!applyMode) {
        console.log("\n👉 Ejecuta con --apply para guardar en Supabase.");
        return;
    }

    console.log("\n=== APLICANDO EN SUPABASE ===");
    let success = 0, errors = 0;

    for (const u of updates) {
        const { error } = await supabase
            .from('CRM_Usuarios')
            .update({
                paises: [PAIS_COLOMBIA_ID],
                departamentos: u.deptIds,
                pais: PAIS_COLOMBIA_ID,
                departamento: u.deptIds[0] || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', u.id);

        if (error) {
            console.log(`  ❌ ${u.nombre}: ${error.message}`);
            errors++;
        } else {
            console.log(`  ✅ ${u.nombre} → [${u.deptIds.join(', ')}]`);
            success++;
        }
    }

    console.log(`\nResultado: ${success} actualizados, ${errors} errores.`);
}

run();
