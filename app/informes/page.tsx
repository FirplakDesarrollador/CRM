"use client";

import React, { useState, useMemo } from 'react';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { useUsers } from '@/lib/hooks/useUsers';
import { supabase } from '@/lib/supabase';
import { downloadExcel, downloadCSV, downloadSopExcel, ExportColumn, SopRow } from '@/lib/utils/informes';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { FileSpreadsheet, Loader2, Download, TableProperties, Users, Briefcase, Building2, Calendar as CalendarIcon, Filter } from 'lucide-react';
import { cn } from '@/components/ui/utils';

// Constantes para filtros
const ENTIDADES = [
  { id: 'oportunidades', label: 'Oportunidades', icon: Briefcase, table: 'CRM_Oportunidades' },
  { id: 'cuentas', label: 'Cuentas', icon: Building2, table: 'CRM_Cuentas' },
  { id: 'contactos', label: 'Contactos', icon: Users, table: 'CRM_Contactos' },
  { id: 'cotizaciones', label: 'Cotizaciones', icon: TableProperties, table: 'CRM_Cotizaciones' },
  { id: 'actividades', label: 'Actividades', icon: CalendarIcon, table: 'CRM_Actividades' },
  { id: 'sop', label: 'Proyección S&OP', icon: FileSpreadsheet, table: 'CRM_Oportunidades' },
] as const;

type EntidadType = typeof ENTIDADES[number]['id'];

// const CANALES = ['Retail', 'Constructoras', 'Grandes Superficies', 'Institucional', 'Exportaciones', 'E-commerce', 'Showroom'];
const ESTADOS_OPPORTUNIDADES = ['Abierta', 'Ganada', 'Perdida', 'Suspendida'];
const MESES_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function InformesPage() {
    const { role, isLoading: isLoadingUser } = useCurrentUser();
    const { users } = useUsers();
    
    const [selectedEntidad, setSelectedEntidad] = useState<EntidadType>('oportunidades');
    const [availableCanales, setAvailableCanales] = useState<{id: string, nombre: string}[]>([]);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [selectedUser, setSelectedUser] = useState('');
    const [selectedCanal, setSelectedCanal] = useState('');
    const [selectedEstado, setSelectedEstado] = useState('');
    const [selectedPlanta, setSelectedPlanta] = useState('');
    const [selectedSopAnio, setSelectedSopAnio] = useState('');
    const [selectedSopMes, setSelectedSopMes] = useState('');
    const [isExporting, setIsExporting] = useState(false);

    // Cargar canales para el filtro
    React.useEffect(() => {
        const fetchCanales = async () => {
            const { data } = await supabase.from('CRM_Canales').select('id, nombre');
            if (data) setAvailableCanales(data);
        };
        fetchCanales();
    }, []);

    if (isLoadingUser) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-[#254153]" />
            </div>
        );
    }

    if (role !== 'ADMIN') {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-slate-50 space-y-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600">
                    <FileSpreadsheet className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-bold text-slate-800">Acceso Restringido</h1>
                <p className="text-slate-500">Solo los administradores pueden acceder a este módulo de exportaciones.</p>
            </div>
        );
    }

    // Handlers
    const handleExport = async (format: 'excel' | 'csv') => {
        setIsExporting(true);
        try {
            const entidadDef = ENTIDADES.find(e => e.id === selectedEntidad);
            if (!entidadDef) throw new Error("Entidad no válida");

            // 1. Cargar Catálogos para Mapeo (Lookups)
            const [
              { data: users },
              { data: segments },
              { data: lossReasons },
              { data: departments },
              { data: cities },
              { data: canales },
              { data: clasificaciones },
              { data: subclasificaciones },
              { data: tiposActividad }
            ] = await Promise.all([
              supabase.from('CRM_Usuarios').select('id, full_name, email'),
              supabase.from('CRM_Segmentos').select('id, nombre'),
              supabase.from('CRM_RazonesPerdida').select('id, descripcion'),
              supabase.from('CRM_Departamentos').select('id, nombre'),
              supabase.from('CRM_Ciudades').select('id, nombre'),
              supabase.from('CRM_Canales').select('id, nombre'),
              supabase.from('CRM_Activity_Clasificacion').select('id, nombre'),
              supabase.from('CRM_Activity_Subclasificacion').select('id, nombre'),
              supabase.from('CRM_TiposActividad').select('id, nombre')
            ]);

            const userMap = new Map<string, string>();
            users?.forEach(u => userMap.set(u.id, u.full_name || u.email || '-'));

            const segmentMap = new Map<number, string>();
            segments?.forEach(s => segmentMap.set(s.id, s.nombre));

            const lossReasonMap = new Map<number, string>();
            lossReasons?.forEach(l => lossReasonMap.set(l.id, l.descripcion));

            const deptMap = new Map<number, string>();
            departments?.forEach(d => deptMap.set(d.id, d.nombre));

            const cityMap = new Map<number, string>();
            cities?.forEach(c => cityMap.set(c.id, c.nombre));

            const canalMap = new Map<string, string>();
            canales?.forEach(c => canalMap.set(c.id, c.nombre));

            const clasificacionMap = new Map<number, string>();
            clasificaciones?.forEach(c => clasificacionMap.set(c.id, c.nombre));

            const subclasificacionMap = new Map<number, string>();
            subclasificaciones?.forEach(s => subclasificacionMap.set(s.id, s.nombre));

            const tipoActividadMap = new Map<number, string>();
            tiposActividad?.forEach(t => tipoActividadMap.set(t.id, t.nombre));

            // Configuración de columnas y joins por entidad
            let selectStr = '*';
            let columns: ExportColumn<any>[] = [];
            let flattenFn = (item: any) => item;

            if (selectedEntidad === 'sop') {
                // 1. Cargar productos de CRM_ListaDePrecios para mapear planta y familia
                const { data: dbProducts, error: prodErr } = await supabase
                    .from('CRM_ListaDePrecios')
                    .select('id, numero_articulo, descripcion, planta, familia');
                if (prodErr) throw prodErr;

                const prodMap = new Map<string, { sku: string, descripcion: string, planta: string, familia: string }>();
                dbProducts?.forEach(p => prodMap.set(p.id, {
                    sku: p.numero_articulo || '-',
                    descripcion: p.descripcion || '-',
                    planta: p.planta || '-',
                    familia: p.familia || '-'
                }));

                // 2. Consultar todas las Oportunidades activas
                let oppQuery = supabase
                    .from('CRM_Oportunidades')
                    .select(`
                        id,
                        nombre,
                        amount,
                        probabilidad,
                        fecha_cierre_estimada,
                        created_at,
                        owner_user_id,
                        account_id,
                        estado_id,
                        fase_id,
                        cuenta:CRM_Cuentas(nombre, canal_id, subclasificacion_id),
                        fase:CRM_FasesOportunidad(nombre, canal_id),
                        estado_info:CRM_EstadosOportunidad(nombre)
                    `)
                    .eq('is_deleted', false);

                // Si hay filtro de asesor
                if (selectedUser) oppQuery = oppQuery.eq('owner_user_id', selectedUser);

                const { data: opps, error: oppsError } = await oppQuery;
                if (oppsError) throw oppsError;

                if (!opps || opps.length === 0) {
                    alert("No se encontraron oportunidades con los filtros seleccionados.");
                    setIsExporting(false);
                    return;
                }

                // 3. Consultar Pedidos
                const oppIds = opps.map(o => o.id);
                const { data: peds, error: pedsError } = await supabase
                    .from('CRM_Pedidos')
                    .select(`
                        id,
                        uuid_generado,
                        opportunity_id,
                        cotizacion_id,
                        fecha_facturacion,
                        fecha_entrega,
                        estado_pedido,
                        is_deleted,
                        items:CRM_PedidoItems(
                            id,
                            producto_id,
                            cantidad,
                            precio_unitario
                        )
                    `)
                    .in('opportunity_id', oppIds)
                    .eq('is_deleted', false);
                if (pedsError) throw pedsError;

                // Identificar qué oportunidades tienen pedidos
                const oppsWithPedidos = new Set(peds?.map(p => p.opportunity_id) || []);
                const oppsWithoutPedidosIds = oppIds.filter(id => !oppsWithPedidos.has(id));

                // 4. Consultar Cotizaciones para oportunidades sin pedidos
                let quotesData: any[] = [];
                if (oppsWithoutPedidosIds.length > 0) {
                    const { data: qts, error: qtsError } = await supabase
                        .from('CRM_Cotizaciones')
                        .select(`
                            id,
                            opportunity_id,
                            status,
                            is_winner,
                            items:CRM_CotizacionItems(
                                id,
                                producto_id,
                                cantidad,
                                precio_unitario
                            )
                        `)
                        .in('opportunity_id', oppsWithoutPedidosIds);
                    if (qtsError) throw qtsError;
                    quotesData = qts || [];
                }

                // 5. Procesar filas del reporte
                const sopRows: SopRow[] = [];

                // Helper para parsear fecha local
                const getYearAndMonth = (dateStr: string | null | undefined) => {
                    if (!dateStr) return { year: new Date().getFullYear(), monthName: 'Sin fecha', day: 1 };
                    const parts = dateStr.split('-');
                    if (parts.length >= 3) {
                        const year = parseInt(parts[0]);
                        const monthIdx = parseInt(parts[1]) - 1;
                        const day = parseInt(parts[2]);
                        return {
                            year,
                            monthName: MESES_ES[monthIdx] || 'Sin fecha',
                            day
                        };
                    }
                    const date = new Date(dateStr);
                    return {
                        year: date.getFullYear(),
                        monthName: MESES_ES[date.getMonth()] || 'Sin fecha',
                        day: date.getDate()
                    };
                };

                // A. Procesar Pedidos
                peds?.forEach(ped => {
                    const opp = opps.find(o => o.id === ped.opportunity_id);
                    if (!opp) return;

                    const canalId = opp.cuenta?.canal_id;
                    const subcanalId = opp.cuenta?.subclasificacion_id;

                    // Filtro por canal en UI
                    if (selectedCanal && canalId !== selectedCanal) return;

                    const dtComercial = getYearAndMonth(ped.fecha_facturacion || ped.fecha_entrega);
                    const dtPlanta = getYearAndMonth(ped.fecha_entrega || ped.fecha_facturacion);

                    const anioFact = dtComercial.year;
                    const mesComercial = dtComercial.monthName;
                    const mesPlanta = dtPlanta.monthName;
                    const quincena = dtComercial.day <= 15 ? 1 : 2;

                    // Aplicar filtros específicos de S&OP de Año y Mes Comercial si se seleccionaron
                    if (selectedSopAnio && String(anioFact) !== selectedSopAnio) return;
                    if (selectedSopMes && mesComercial !== selectedSopMes) return;

                    ped.items?.forEach((item: any) => {
                        const prod = prodMap.get(item.producto_id) || {
                            sku: '-',
                            descripcion: 'Producto no especificado',
                            planta: '-',
                            familia: '-'
                        };

                        // Filtro por planta en UI
                        if (selectedPlanta && prod.planta !== selectedPlanta) return;

                        sopRows.push({
                            anio_fact: anioFact,
                            mes_planta: mesPlanta,
                            mes_comercial: mesComercial,
                            estado: 'Pedido (' + (ped.estado_pedido || 'Planeado') + ')',
                            asesor: opp.CRM_Usuarios?.full_name || userMap.get(opp.owner_user_id) || '-',
                            grupo_cliente: canalMap.get(canalId) || '-',
                            subgrupo_cliente: subclasificacionMap.get(subcanalId) || '-',
                            cliente: opp.cuenta?.nombre || '-',
                            codigo_articulo: prod.sku,
                            descripcion_articulo: prod.descripcion,
                            planta: prod.planta,
                            familia: prod.familia,
                            valor_unit: Number(item.precio_unitario || 0),
                            cantidad_total: Number(item.cantidad || 0),
                            valor_total: Number(item.precio_unitario || 0) * Number(item.cantidad || 0),
                            probabilidad: 100, // Los pedidos son 100% seguros
                            quincena: quincena
                        });
                    });
                });

                // B. Procesar Oportunidades sin Pedidos (Proyectado)
                oppsWithoutPedidosIds.forEach(oppId => {
                    const opp = opps.find(o => o.id === oppId);
                    if (!opp) return;

                    const canalId = opp.cuenta?.canal_id;
                    const subcanalId = opp.cuenta?.subclasificacion_id;

                    // Filtro por canal en UI
                    if (selectedCanal && canalId !== selectedCanal) return;

                    // Filtro por estado en UI si se seleccionó en la grilla general de estados
                    if (selectedEstado && opp.estado_info?.nombre !== selectedEstado) return;

                    const quote = quotesData.find(q => q.opportunity_id === oppId && (q.is_winner || q.status === 'WINNER'))
                               || quotesData.find(q => q.opportunity_id === oppId);

                    if (!quote || !quote.items || quote.items.length === 0) return;

                    const dtComercial = getYearAndMonth(opp.fecha_cierre_estimada);
                    const dtPlanta = getYearAndMonth(opp.fecha_cierre_estimada);

                    const anioFact = dtComercial.year;
                    const mesComercial = dtComercial.monthName;
                    const mesPlanta = dtPlanta.monthName;
                    const quincena = dtComercial.day <= 15 ? 1 : 2;

                    // Aplicar filtros específicos de S&OP de Año y Mes Comercial si se seleccionaron
                    if (selectedSopAnio && String(anioFact) !== selectedSopAnio) return;
                    if (selectedSopMes && mesComercial !== selectedSopMes) return;

                    quote.items.forEach((item: any) => {
                        const prod = prodMap.get(item.producto_id) || {
                            sku: '-',
                            descripcion: 'Producto no especificado',
                            planta: '-',
                            familia: '-'
                        };

                        // Filtro por planta en UI
                        if (selectedPlanta && prod.planta !== selectedPlanta) return;

                        sopRows.push({
                            anio_fact: anioFact,
                            mes_planta: mesPlanta,
                            mes_comercial: mesComercial,
                            estado: opp.estado_info?.nombre || 'Proyectado',
                            asesor: opp.CRM_Usuarios?.full_name || userMap.get(opp.owner_user_id) || '-',
                            grupo_cliente: canalMap.get(canalId) || '-',
                            subgrupo_cliente: subclasificacionMap.get(subcanalId) || '-',
                            cliente: opp.cuenta?.nombre || '-',
                            codigo_articulo: prod.sku,
                            descripcion_articulo: prod.descripcion,
                            planta: prod.planta,
                            familia: prod.familia,
                            valor_unit: Number(item.precio_unitario || 0),
                            cantidad_total: Number(item.cantidad || 0),
                            valor_total: Number(item.precio_unitario || 0) * Number(item.cantidad || 0),
                            probabilidad: Number(opp.probabilidad || 0),
                            quincena: quincena
                        });
                    });
                });

                if (sopRows.length === 0) {
                    alert("No se encontraron registros de S&OP con los filtros seleccionados.");
                    setIsExporting(false);
                    return;
                }

                // 6. Exportar
                const currentDateTime = new Date().toISOString().replace(/:/g, '-').split('.')[0];
                const fileName = `Informe_SOP_${currentDateTime}`;

                if (format === 'excel') {
                    await downloadSopExcel(sopRows, fileName);
                } else {
                    // Exportar CSV simple de datos planos
                    const columnsSopCsv = [
                        { header: 'Año fact', key: 'anio_fact' },
                        { header: 'Mes Planta', key: 'mes_planta' },
                        { header: 'Mes Comercial', key: 'mes_comercial' },
                        { header: 'Estado', key: 'estado' },
                        { header: 'Asesor', key: 'asesor' },
                        { header: 'Grupo Cliente', key: 'grupo_cliente' },
                        { header: 'Subgrupo Cliente', key: 'subgrupo_cliente' },
                        { header: 'Cliente', key: 'cliente' },
                        { header: 'Código del Artículo', key: 'codigo_articulo' },
                        { header: 'Descripción del Artículo', key: 'descripcion_articulo' },
                        { header: 'Planta', key: 'planta' },
                        { header: 'Familia', key: 'familia' },
                        { header: 'Valor Unit', key: 'valor_unit' },
                        { header: 'Cantidad Total', key: 'cantidad_total' },
                        { header: 'Valor Total', key: 'valor_total' },
                        { header: '% de Probabilidad', key: 'probabilidad' },
                        { header: 'Quincena', key: 'quincena' }
                    ];
                    downloadCSV(sopRows, columnsSopCsv, fileName);
                }

                setIsExporting(false);
                return;
            }

            // Configuración de columnas y joins por entidad
            selectStr = '*';
            columns = [];
            flattenFn = (item: any) => item;

            if (selectedEntidad === 'oportunidades') {
                selectStr = `
                    *,
                    cuenta:CRM_Cuentas(nombre),
                    fase:CRM_FasesOportunidad(nombre, canal_id),
                    estado_info:CRM_EstadosOportunidad(nombre)
                `;
                columns = [
                    { header: 'ID', key: 'id' },
                    { header: 'FECHA CREACIÓN', key: 'created_at', width: 20 },
                    { header: 'NOMBRE OPORTUNIDAD', key: 'nombre', width: 35 },
                    { header: 'CUENTA', key: 'cuenta_nombre', width: 35 },
                    { header: 'CANAL', key: 'canal_nombre' },
                    { header: 'VENDEDOR', key: 'vendedor_nombre', width: 25 },
                    { header: 'ESTADO', key: 'estado_nombre', width: 15 },
                    { header: 'FASE ACTUAL', key: 'fase_nombre', width: 20 },
                    { header: 'VALOR', key: 'amount', width: 15 },
                    { header: 'MONEDA', key: 'currency_id', width: 10 },
                    { header: 'PROBABILIDAD (%)', key: 'probability', width: 15 },
                    { header: 'FECHA CIERRE EST.', key: 'fecha_cierre_estimada', width: 18 },
                    { header: 'SEGMENTO', key: 'segmento_nombre', width: 25 },
                    { header: 'ORIGEN', key: 'origen_oportunidad', width: 20 },
                    { header: 'DEPARTAMENTO', key: 'departamento_nombre', width: 20 },
                    { header: 'CIUDAD', key: 'ciudad_nombre', width: 20 },
                    { header: 'RAZÓN PÉRDIDA', key: 'razon_perdida_label', width: 30 },
                    { header: 'COMENTARIOS PÉRDIDA', key: 'comentarios_perdida', width: 40 },
                    { header: 'CREADO POR', key: 'creador_nombre', width: 25 }
                ];
                flattenFn = (item: any) => ({
                    ...item,
                    cuenta_nombre: item.cuenta?.nombre || '-',
                    fase_nombre: item.fase?.nombre || '-',
                    estado_nombre: item.estado_info?.nombre || '-',
                    vendedor_nombre: userMap.get(item.owner_user_id) || '-',
                    creador_nombre: userMap.get(item.created_by) || '-',
                    segmento_nombre: segmentMap.get(item.segmento_id) || '-',
                    canal_nombre: item.fase?.canal_id ? (canalMap.get(item.fase.canal_id) || '-') : '-',
                    departamento_nombre: deptMap.get(item.departamento_id) || '-',
                    ciudad_nombre: cityMap.get(item.ciudad_id) || '-',
                    // Resolve legacy text reason or new ID-based reason
                    razon_perdida_label: item.razon_perdida_id ? (lossReasonMap.get(item.razon_perdida_id) || item.razon_perdida) : (item.razon_perdida || '-')
                });
            } else if (selectedEntidad === 'cuentas') {
                selectStr = '*';
                columns = [
                    { header: 'ID', key: 'id' },
                    { header: 'NIT', key: 'nit' },
                    { header: 'NOMBRE CUENTA', key: 'nombre', width: 40 },
                    { header: 'CANAL', key: 'canal_nombre' },
                    { header: 'TELÉFONO', key: 'telefono' },
                    { header: 'EMAIL', key: 'email', width: 30 },
                    { header: 'CIUDAD', key: 'ciudad_nombre' },
                    { header: 'DEPARTAMENTO', key: 'departamento_nombre', width: 20 },
                    { header: 'VENDEDOR ASIGNADO', key: 'vendedor_nombre', width: 25 },
                    { header: 'CREADO EL', key: 'created_at' }
                ];
                flattenFn = (item: any) => ({
                    ...item,
                    canal_nombre: canalMap.get(item.canal_id) || '-',
                    vendedor_nombre: userMap.get(item.owner_user_id) || '-',
                    departamento_nombre: deptMap.get(item.departamento_id) || '-',
                    ciudad_nombre: cityMap.get(item.ciudad_id) || item.ciudad || '-'
                });
            } else if (selectedEntidad === 'contactos') {
                selectStr = `
                    *,
                    cuenta:CRM_Cuentas(nombre)
                `;
                columns = [
                    { header: 'ID', key: 'id' },
                    { header: 'NOMBRE COMPLETO', key: 'nombre_completo', width: 30 },
                    { header: 'CARGO', key: 'cargo' },
                    { header: 'EMAIL', key: 'email', width: 30 },
                    { header: 'TELÉFONO', key: 'telefono' },
                    { header: 'CUENTA', key: 'cuenta_nombre', width: 30 },
                    { header: 'VENDEDOR', key: 'vendedor_nombre', width: 25 },
                    { header: 'CREADO EL', key: 'created_at' }
                ];
                flattenFn = (item: any) => ({
                    ...item,
                    nombre_completo: `${item.nombres || ''} ${item.apellidos || ''}`.trim(),
                    cuenta_nombre: item.cuenta?.nombre || '-',
                    vendedor_nombre: userMap.get(item.user_id || item.created_by) || '-'
                });
            } else if (selectedEntidad === 'cotizaciones') {
                selectStr = `
                    *,
                    oportunidad:CRM_Oportunidades(nombre)
                `;
                columns = [
                    { header: 'CÓDIGO', key: 'codigo' },
                    { header: 'TÍTULO', key: 'titulo', width: 30 },
                    { header: 'OPORTUNIDAD', key: 'oportunidad_nombre', width: 30 },
                    { header: 'SUBTOTAL', key: 'subtotal' },
                    { header: 'TOTAL', key: 'total_final' },
                    { header: 'ESTADO', key: 'estado' },
                    { header: 'VENDEDOR', key: 'vendedor_nombre', width: 25 },
                    { header: 'FECHA COTIZACIÓN', key: 'created_at' }
                ];
                flattenFn = (item: any) => ({
                    ...item,
                    oportunidad_nombre: item.oportunidad?.nombre || '-',
                    vendedor_nombre: userMap.get(item.user_id || item.created_by) || '-'
                });
            } else if (selectedEntidad === 'actividades') {
                selectStr = `
                    *,
                    cuenta:CRM_Cuentas(nombre),
                    oportunidad:CRM_Oportunidades(nombre, amount),
                    usuario:CRM_Usuarios(full_name),
                    clasificacion:CRM_Activity_Clasificacion(nombre),
                    subclasificacion:CRM_Activity_Subclasificacion(nombre),
                    tipo_act_info:CRM_TiposActividad(nombre)
                `;
                columns = [
                    { header: 'ASUNTO', key: 'asunto', width: 35 },
                    { header: 'CLASIFICACIÓN', key: 'clasificacion_nombre', width: 25 },
                    { header: 'SUBCLASIFICACIÓN', key: 'subclasificacion_nombre', width: 25 },
                    { header: 'CUENTA', key: 'cuenta_nombre', width: 35 },
                    { header: 'OPORTUNIDAD', key: 'oportunidad_nombre', width: 35 },
                    { header: 'MONTO OPORTUNIDAD', key: 'oportunidad_monto', width: 20 },
                    { header: 'VENDEDOR', key: 'vendedor_nombre', width: 25 },
                    { header: 'FECHA CREACIÓN', key: 'created_at', width: 20 },
                    { header: 'FECHA VENCIMIENTO', key: 'fecha_fin', width: 20 },
                    { header: 'ESTADO', key: 'estado_nombre', width: 15 },
                    { header: 'TIPO', key: 'tipo_nombre', width: 20 },
                    { header: 'NOTAS', key: 'descripcion', width: 50 }
                ];
                flattenFn = (item: any) => ({
                    ...item,
                    asunto: item.asunto || '-',
                    clasificacion_nombre: item.clasificacion?.nombre || clasificacionMap.get(item.clasificacion_id) || '-',
                    subclasificacion_nombre: item.subclasificacion?.nombre || subclasificacionMap.get(item.subclasificacion_id) || '-',
                    cuenta_nombre: item.cuenta?.nombre || '-',
                    oportunidad_nombre: item.oportunidad?.nombre || '-',
                    oportunidad_monto: item.oportunidad?.amount || 0,
                    vendedor_nombre: item.usuario?.full_name || userMap.get(item.user_id) || '-',
                    estado_nombre: item.is_completed ? 'Completado' : 'No completado',
                    tipo_nombre: item.tipo_act_info?.nombre || tipoActividadMap.get(item.tipo_actividad_id) || item.tipo_actividad || '-',
                    descripcion: item.descripcion || '-'
                });
            }

            // Base query building
            let query = supabase.from(entidadDef.table).select(selectStr);

            // Apply filters mapping
            // Fechas
            if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00Z`);
            if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59Z`);
            
            // Asesor
            if (selectedUser) {
                if (selectedEntidad === 'oportunidades' || selectedEntidad === 'cuentas') {
                    query = query.eq('owner_user_id', selectedUser);
                } else {
                    query = query.eq('user_id', selectedUser);
                }
            }

            // Canal y Estado (dependiendo de la entidad)
            if (selectedCanal) {
                if (selectedEntidad === 'cuentas') {
                    query = query.eq('canal_id', selectedCanal);
                } else if (selectedEntidad === 'oportunidades') {
                    // Filtrar por el canal de la fase asociada
                    const { data: faseData } = await supabase.from('CRM_FasesOportunidad').select('id').eq('canal_id', selectedCanal);
                    const faseIds = faseData?.map(f => f.id) || [];
                    query = query.in('fase_id', faseIds);
                }
            }

            if (selectedEstado && selectedEntidad === 'oportunidades') {
                query = query.eq('estado', selectedEstado);
            }

            // Execute Query
            const { data, error } = await query;
            if (error) throw error;

            if (!data || data.length === 0) {
                alert("No se encontraron registros con los filtros seleccionados.");
                return;
            }

            // Aplanar datos para el reporte
            const flattenedData = data.map(flattenFn);

            // Si no se definieron columnas (fallback de seguridad), generar dinámicas
            if (columns.length === 0) {
                const headerKeys = Object.keys(flattenedData[0]);
                columns = headerKeys.map(key => ({
                    header: key.toUpperCase().replace(/_/g, ' '),
                    key: key,
                    width: 25
                }));
            }

            // Export logic
            const currentDateTime = new Date().toISOString().replace(/:/g, '-').split('.')[0];
            const fileName = `Informe_${entidadDef.label}_${currentDateTime}`;

            if (format === 'excel') {
                await downloadExcel(flattenedData, columns, fileName, entidadDef.label);
            } else {
                downloadCSV(flattenedData, columns, fileName);
            }

        } catch (error: any) {
            console.error("Export Error:", error);
            alert(`Ocurrió un error al exportar: ${error.message || 'Desconocido'}`);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="flex-1 w-full bg-slate-50 min-h-screen pb-safe">
            <header className="bg-white border-b border-slate-200/60 sticky top-0 z-30 shadow-[0_1px_8px_rgba(0,0,0,0.02)]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-linear-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center">
                            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800 tracking-tight leading-tight">Informes y Exportaciones</h1>
                            <p className="text-sm text-slate-500 font-medium mt-0.5">Módulo exclusivo para Administradores</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                
                {/* Entidad Selection Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {ENTIDADES.map(ent => (
                        <button
                            key={ent.id}
                            onClick={() => setSelectedEntidad(ent.id)}
                            className={cn(
                                "relative flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-200 gap-3 group text-left",
                                selectedEntidad === ent.id 
                                    ? "bg-blue-50 border-blue-500/50 shadow-md shadow-blue-500/10" 
                                    : "bg-white border-transparent shadow-sm hover:shadow-md hover:border-slate-200"
                            )}
                        >
                            <div className={cn(
                                "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                                selectedEntidad === ent.id ? "bg-blue-600 text-white shadow-inner" : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                            )}>
                                <ent.icon className="w-6 h-6" />
                            </div>
                            <span className={cn(
                                "font-semibold text-sm",
                                selectedEntidad === ent.id ? "text-blue-900" : "text-slate-700"
                            )}>
                                {ent.label}
                            </span>
                            {selectedEntidad === ent.id && (
                                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Filtros Card */}
                <Card className="border-0 shadow-xl shadow-slate-200/40 rounded-2xl overflow-hidden ring-1 ring-slate-200">
                    <CardHeader className="bg-white border-b border-slate-100 px-6 py-5">
                        <div className="flex items-center gap-2 text-[#254153]">
                            <Filter className="w-5 h-5" />
                            <CardTitle className="text-lg">Configuración del Informe: <span className="text-blue-600 ml-1">{ENTIDADES.find(e => e.id === selectedEntidad)?.label}</span></CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 bg-white grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        
                        {/* Rango de Fechas (Creación) */}
                        <div className="space-y-3 col-span-1 lg:col-span-2">
                            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <CalendarIcon className="w-4 h-4 text-slate-400" />
                                Rango de Fechas (Creación)
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-medium">Desde</span>
                                    <input 
                                        type="date" 
                                        value={dateFrom} 
                                        onChange={e => setDateFrom(e.target.value)} 
                                        className="w-full pl-12 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all text-sm"
                                    />
                                </div>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-medium">Hasta</span>
                                    <input 
                                        type="date" 
                                        value={dateTo} 
                                        onChange={e => setDateTo(e.target.value)} 
                                        className="w-full pl-12 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Asesor */}
                        <div className="space-y-3">
                            <label className="text-sm font-semibold text-slate-700">Asesor Comercial</label>
                            <select 
                                value={selectedUser} 
                                onChange={e => setSelectedUser(e.target.value)}
                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
                            >
                                <option value="">Todos los asesores</option>
                                {users?.map(u => (
                                    <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                                ))}
                            </select>
                        </div>

                        {/* Filtros específicos por entidad */}
                        {(selectedEntidad === 'oportunidades' || selectedEntidad === 'cuentas' || selectedEntidad === 'sop') && (
                            <div className="space-y-3">
                                <label className="text-sm font-semibold text-slate-700">Canal</label>
                                <select 
                                    value={selectedCanal} 
                                    onChange={e => setSelectedCanal(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
                                >
                                    <option value="">Todos los canales</option>
                                    {availableCanales.map(c => (
                                        <option key={c.id} value={c.id}>{c.nombre}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {(selectedEntidad === 'oportunidades' || selectedEntidad === 'sop') && (
                            <div className="space-y-3">
                                <label className="text-sm font-semibold text-slate-700">Estado</label>
                                <select 
                                    value={selectedEstado} 
                                    onChange={e => setSelectedEstado(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
                                >
                                    <option value="">Todos los estados</option>
                                    {ESTADOS_OPPORTUNIDADES.map(e => (
                                        <option key={e} value={e}>{e}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {selectedEntidad === 'sop' && (
                            <>
                                <div className="space-y-3">
                                    <label className="text-sm font-semibold text-slate-700">Año Facturación (S&OP)</label>
                                    <select 
                                        value={selectedSopAnio} 
                                        onChange={e => setSelectedSopAnio(e.target.value)}
                                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
                                    >
                                        <option value="">Todos los años</option>
                                        <option value="2025">2025</option>
                                        <option value="2026">2026</option>
                                        <option value="2027">2027</option>
                                    </select>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-semibold text-slate-700">Mes Comercial (S&OP)</label>
                                    <select 
                                        value={selectedSopMes} 
                                        onChange={e => setSelectedSopMes(e.target.value)}
                                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
                                    >
                                        <option value="">Todos los meses</option>
                                        {MESES_ES.map(mes => (
                                            <option key={mes} value={mes}>{mes}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-semibold text-slate-700">Planta</label>
                                    <select 
                                        value={selectedPlanta} 
                                        onChange={e => setSelectedPlanta(e.target.value)}
                                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
                                    >
                                        <option value="">Todas las plantas</option>
                                        <option value="PC">PC</option>
                                        <option value="ALM">ALM</option>
                                        <option value="FVH">FVH</option>
                                    </select>
                                </div>
                            </>
                        )}

                    </CardContent>
                    
                    {/* Botones de acción inferior */}
                    <div className="bg-slate-50/80 px-6 py-5 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3">
                        <button
                            onClick={() => handleExport('csv')}
                            disabled={isExporting}
                            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50"
                        >
                            Descargar CSV
                        </button>
                        <button
                            onClick={() => handleExport('excel')}
                            disabled={isExporting}
                            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-[#254153] text-white hover:bg-[#1a2f3d] transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-[#254153] focus:ring-offset-2 disabled:opacity-50"
                        >
                            {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                            Descargar Excel
                        </button>
                    </div>
                </Card>

            </main>
        </div>
    );
}
