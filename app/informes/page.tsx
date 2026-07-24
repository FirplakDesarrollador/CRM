"use client";

import React, { useState, useMemo } from 'react';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { useUsers } from '@/lib/hooks/useUsers';
import { supabase } from '@/lib/supabase';
import { downloadExcel, downloadCSV, downloadSopExcel, ExportColumn, SopRow } from '@/lib/utils/informes';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { FileSpreadsheet, Loader2, Download, TableProperties, Users, Briefcase, Building2, Calendar as CalendarIcon, Filter, RotateCcw, DollarSign, MapPin, Tag } from 'lucide-react';
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

const ESTADOS_OPPORTUNIDADES = ['Abierta', 'Ganada', 'Perdida', 'Suspendida'];
const ESTADOS_COTIZACION = ['DRAFT', 'SENT', 'WINNER', 'REJECTED', 'EXPIRED'];
const MESES_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const ESTADO_IDS_BY_NAME: Record<string, number[]> = {
    Abierta: [1],
    Ganada: [2, 11],
    Perdida: [3, 14],
    Suspendida: [4]
};

const SELECT_TRIGGER_CLASS = "w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-left text-slate-800 text-sm font-normal hover:bg-white focus:bg-white transition-all justify-between flex items-center";

export default function InformesPage() {
    const { role, isLoading: isLoadingUser } = useCurrentUser();
    const { users } = useUsers();
    
    const [selectedEntidad, setSelectedEntidad] = useState<EntidadType>('oportunidades');
    const [isExporting, setIsExporting] = useState(false);

    // Filtros Generales
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [dueDateFrom, setDueDateFrom] = useState('');
    const [dueDateTo, setDueDateTo] = useState('');
    const [selectedUser, setSelectedUser] = useState('');
    const [selectedCanal, setSelectedCanal] = useState('');
    const [selectedEstado, setSelectedEstado] = useState('');

    // Filtros de Oportunidades & Cotizaciones
    const [selectedFase, setSelectedFase] = useState('');
    const [minAmount, setMinAmount] = useState('');
    const [maxAmount, setMaxAmount] = useState('');
    const [selectedOrigen, setSelectedOrigen] = useState('');
    const [selectedSegmento, setSelectedSegmento] = useState('');
    const [selectedDept, setSelectedDept] = useState('');
    const [selectedCiudad, setSelectedCiudad] = useState('');

    // Filtros de Cuentas & Contactos
    const [selectedEsPremium, setSelectedEsPremium] = useState('');
    const [selectedCargo, setSelectedCargo] = useState('');
    const [selectedEstadoCotizacion, setSelectedEstadoCotizacion] = useState('');

    // Filtros de Actividades
    const [selectedTipoActividad, setSelectedTipoActividad] = useState('');
    const [selectedClasificacion, setSelectedClasificacion] = useState('');
    const [selectedSubclasificacion, setSelectedSubclasificacion] = useState('');
    const [selectedEstadoCumplimiento, setSelectedEstadoCumplimiento] = useState('');

    // Filtros de S&OP
    const [selectedPlanta, setSelectedPlanta] = useState('');
    const [selectedSopAnio, setSelectedSopAnio] = useState('');
    const [selectedSopMes, setSelectedSopMes] = useState('');
    const [selectedFamilia, setSelectedFamilia] = useState('');
    const [minProbabilidad, setMinProbabilidad] = useState('');
    const [selectedQuincena, setSelectedQuincena] = useState('');
    const [selectedTipoSop, setSelectedTipoSop] = useState('');

    // Estado de Catálogos
    const [catalogs, setCatalogs] = useState<{
        canales: {id: string, nombre: string}[];
        fases: {id: number, nombre: string, canal_id: string}[];
        segmentos: {id: number, nombre: string}[];
        depts: {id: number, nombre: string}[];
        ciudades: {id: number, nombre: string, departamento_id: number}[];
        tiposActividad: {id: number, nombre: string}[];
        clasificaciones: {id: number, nombre: string}[];
        subclasificaciones: {id: number, nombre: string, clasificacion_id: number}[];
        familias: string[];
    }>({
        canales: [],
        fases: [],
        segmentos: [],
        depts: [],
        ciudades: [],
        tiposActividad: [],
        clasificaciones: [],
        subclasificaciones: [],
        familias: []
    });

    // Cargar catálogos
    React.useEffect(() => {
        const fetchCatalogs = async () => {
            const [
                { data: canales },
                { data: fases },
                { data: segmentos },
                { data: depts },
                { data: ciudades },
                { data: tiposActidad },
                { data: clasificaciones },
                { data: subclasificaciones },
                { data: productos }
            ] = await Promise.all([
                supabase.from('CRM_Canales').select('id, nombre').order('nombre'),
                supabase.from('CRM_FasesOportunidad').select('id, nombre, canal_id').order('nombre'),
                supabase.from('CRM_Segmentos').select('id, nombre').order('nombre'),
                supabase.from('CRM_Departamentos').select('id, nombre').order('nombre'),
                supabase.from('CRM_Ciudades').select('id, nombre, departamento_id').order('nombre'),
                supabase.from('CRM_TiposActividad').select('id, nombre').order('nombre'),
                supabase.from('CRM_Activity_Clasificacion').select('id, nombre').order('nombre'),
                supabase.from('CRM_Activity_Subclasificacion').select('id, nombre, clasificacion_id').order('nombre'),
                supabase.from('CRM_ListaDePrecios').select('familia').not('familia', 'is', null)
            ]);

            const familias = Array.from(new Set(productos?.map(p => p.familia).filter(Boolean))).sort() as string[];

            setCatalogs({
                canales: canales || [],
                fases: fases || [],
                segmentos: segmentos || [],
                depts: depts || [],
                ciudades: ciudades || [],
                tiposActividad: tiposActidad || [],
                clasificaciones: clasificaciones || [],
                subclasificaciones: subclasificaciones || [],
                familias: familias || []
            });
        };
        fetchCatalogs();
    }, []);

    // Limpiar Filtros
    const handleResetFilters = () => {
        setDateFrom('');
        setDateTo('');
        setDueDateFrom('');
        setDueDateTo('');
        setSelectedUser('');
        setSelectedCanal('');
        setSelectedEstado('');
        setSelectedFase('');
        setMinAmount('');
        setMaxAmount('');
        setSelectedOrigen('');
        setSelectedSegmento('');
        setSelectedDept('');
        setSelectedCiudad('');
        setSelectedEsPremium('');
        setSelectedCargo('');
        setSelectedEstadoCotizacion('');
        setSelectedTipoActividad('');
        setSelectedClasificacion('');
        setSelectedSubclasificacion('');
        setSelectedEstadoCumplimiento('');
        setSelectedPlanta('');
        setSelectedSopAnio('');
        setSelectedSopMes('');
        setSelectedFamilia('');
        setMinProbabilidad('');
        setSelectedQuincena('');
        setSelectedTipoSop('');
    };

    // Nombres únicos de Fases filtradas por Canal
    const uniqueFaseNombres = useMemo(() => {
        const list = selectedCanal 
            ? catalogs.fases.filter(f => f.canal_id === selectedCanal) 
            : catalogs.fases;
        return Array.from(new Set(list.map(f => f.nombre))).sort();
    }, [catalogs.fases, selectedCanal]);

    // Ciudades filtradas por Departamento
    const filteredCiudades = useMemo(() => {
        if (!selectedDept) return catalogs.ciudades;
        return catalogs.ciudades.filter(c => c.departamento_id === Number(selectedDept));
    }, [catalogs.ciudades, selectedDept]);

    // Subclasificaciones de Actividad filtradas por Clasificación
    const filteredSubclasificaciones = useMemo(() => {
        if (!selectedClasificacion) return catalogs.subclasificaciones;
        return catalogs.subclasificaciones.filter(s => s.clasificacion_id === Number(selectedClasificacion));
    }, [catalogs.subclasificaciones, selectedClasificacion]);

    // Opciones para SearchableSelect
    const asesorOptions = useMemo(() => [
        { label: 'Todos los asesores', value: '' },
        ...(users?.map(u => ({ label: u.full_name || u.email || 'Sin nombre', value: u.id })) || [])
    ], [users]);

    const canalOptions = useMemo(() => [
        { label: 'Todos los canales', value: '' },
        ...catalogs.canales.map(c => ({ label: c.nombre, value: c.id }))
    ], [catalogs.canales]);

    const estadoOppOptions = useMemo(() => [
        { label: 'Todos los estados', value: '' },
        ...ESTADOS_OPPORTUNIDADES.map(e => ({ label: e, value: e }))
    ], []);

    const faseOptions = useMemo(() => [
        { label: 'Todas las fases', value: '' },
        ...uniqueFaseNombres.map(n => ({ label: n, value: n }))
    ], [uniqueFaseNombres]);

    const segmentoOptions = useMemo(() => [
        { label: 'Todos los segmentos', value: '' },
        ...catalogs.segmentos.map(s => ({ label: s.nombre, value: String(s.id) }))
    ], [catalogs.segmentos]);

    const deptOptions = useMemo(() => [
        { label: 'Todos los departamentos', value: '' },
        ...catalogs.depts.map(d => ({ label: d.nombre, value: String(d.id) }))
    ], [catalogs.depts]);

    const ciudadOptions = useMemo(() => [
        { label: 'Todas las ciudades', value: '' },
        ...filteredCiudades.map(c => ({ label: c.nombre, value: String(c.id) }))
    ], [filteredCiudades]);

    const premiumOptions = useMemo(() => [
        { label: 'Todos los clientes', value: '' },
        { label: 'Solo Clientes Premium (VIP)', value: 'true' },
        { label: 'Solo Clientes Estándar', value: 'false' }
    ], []);

    const estadoCotizacionOptions = useMemo(() => [
        { label: 'Todos los estados', value: '' },
        ...ESTADOS_COTIZACION.map(st => ({ label: st, value: st }))
    ], []);

    const cumplimientoActividadOptions = useMemo(() => [
        { label: 'Todas las actividades', value: '' },
        { label: 'Solo Completadas', value: 'completadas' },
        { label: 'Solo Pendientes / En Progreso', value: 'pendientes' }
    ], []);

    const tipoActividadOptions = useMemo(() => [
        { label: 'Todos los tipos', value: '' },
        ...catalogs.tiposActividad.map(t => ({ label: t.nombre, value: String(t.id) }))
    ], [catalogs.tiposActividad]);

    const clasificacionActividadOptions = useMemo(() => [
        { label: 'Todas las clasificaciones', value: '' },
        ...catalogs.clasificaciones.map(c => ({ label: c.nombre, value: String(c.id) }))
    ], [catalogs.clasificaciones]);

    const subclasificacionActividadOptions = useMemo(() => [
        { label: 'Todas las subclasificaciones', value: '' },
        ...filteredSubclasificaciones.map(s => ({ label: s.nombre, value: String(s.id) }))
    ], [filteredSubclasificaciones]);

    const sopAnioOptions = useMemo(() => [
        { label: 'Todos los años', value: '' },
        { label: '2025', value: '2025' },
        { label: '2026', value: '2026' },
        { label: '2027', value: '2027' }
    ], []);

    const sopMesOptions = useMemo(() => [
        { label: 'Todos los meses', value: '' },
        ...MESES_ES.map(m => ({ label: m, value: m }))
    ], []);

    const sopPlantaOptions = useMemo(() => [
        { label: 'Todas las plantas', value: '' },
        { label: 'PC', value: 'PC' },
        { label: 'ALM', value: 'ALM' },
        { label: 'FVH', value: 'FVH' }
    ], []);

    const sopFamiliaOptions = useMemo(() => [
        { label: 'Todas las familias', value: '' },
        ...catalogs.familias.map(f => ({ label: f, value: f }))
    ], [catalogs.familias]);

    const sopQuincenaOptions = useMemo(() => [
        { label: 'Todas las quincenas', value: '' },
        { label: '1ª Quincena (Días 1-15)', value: '1' },
        { label: '2ª Quincena (Días 16-fin)', value: '2' }
    ], []);

    const sopTipoRegistroOptions = useMemo(() => [
        { label: 'Todos los registros', value: '' },
        { label: 'Solo Pedidos Confirmados', value: 'pedidos' },
        { label: 'Solo Oportunidades Proyectadas', value: 'proyectado' }
    ], []);

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

                let oppQuery = supabase
                    .from('CRM_Oportunidades')
                    .select(`
                        id,
                        nombre,
                        amount,
                        probabilidad,
                        probability,
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

                if (selectedUser) oppQuery = oppQuery.eq('owner_user_id', selectedUser);

                const { data: opps, error: oppsError } = await oppQuery;
                if (oppsError) throw oppsError;

                if (!opps || opps.length === 0) {
                    alert("No se encontraron oportunidades con los filtros seleccionados.");
                    setIsExporting(false);
                    return;
                }

                const oppIdsSet = new Set(opps.map(o => o.id));

                let validPeds: any[] = [];
                if (selectedTipoSop !== 'proyectado') {
                    const { data: peds, error: pedsError } = await supabase
                        .from('CRM_Pedidos')
                        .select(`
                            id,
                            uuid_generado,
                            opportunity_id,
                            cotizacion_id,
                            "EXTRA_Fecha de facturación",
                            "EXTRA_Fecha mínima requerida por comercial/cliente",
                            expectedCloseDate,
                            closeDate,
                            estado_pedido,
                            is_deleted,
                            items:CRM_PedidoItems(
                                id,
                                producto_id,
                                cantidad,
                                precio_unitario
                            )
                        `)
                        .eq('is_deleted', false);
                    if (pedsError) throw pedsError;
                    validPeds = (peds || []).filter(p => p.opportunity_id && oppIdsSet.has(p.opportunity_id));
                }

                const oppsWithPedidos = new Set(validPeds.map(p => p.opportunity_id));
                const oppsWithoutPedidosIds = Array.from(oppIdsSet).filter(id => !oppsWithPedidos.has(id));

                let quotesData: any[] = [];
                if (selectedTipoSop !== 'pedidos' && oppsWithoutPedidosIds.length > 0) {
                    const { data: qts, error: qtsError } = await supabase
                        .from('CRM_Cotizaciones')
                        .select(`
                            id,
                            opportunity_id,
                            status,
                            items:CRM_CotizacionItems(
                                id,
                                producto_id,
                                cantidad,
                                precio_unitario
                            )
                        `);
                    if (qtsError) throw qtsError;
                    const oppsWithoutPedidosSet = new Set(oppsWithoutPedidosIds);
                    quotesData = (qts || []).filter(q => q.opportunity_id && oppsWithoutPedidosSet.has(q.opportunity_id));
                }

                const sopRows: SopRow[] = [];

                const getYearAndMonth = (dateStr: string | null | undefined) => {
                    if (!dateStr || dateStr === '-') return { year: new Date().getFullYear(), monthName: 'Sin fecha', day: 1 };
                    if (typeof dateStr === 'string' && dateStr.includes('/')) {
                        const parts = dateStr.split('/');
                        if (parts.length >= 3) {
                            const day = parseInt(parts[0], 10);
                            const monthIdx = parseInt(parts[1], 10) - 1;
                            const year = parseInt(parts[2], 10);
                            if (!isNaN(year) && !isNaN(monthIdx) && !isNaN(day)) {
                                return { year: year < 100 ? 2000 + year : year, monthName: MESES_ES[monthIdx] || 'Sin fecha', day };
                            }
                        }
                    }
                    if (typeof dateStr === 'string' && dateStr.includes('-')) {
                        const parts = dateStr.split('T')[0].split('-');
                        if (parts.length >= 3) {
                            const year = parseInt(parts[0], 10);
                            const monthIdx = parseInt(parts[1], 10) - 1;
                            const day = parseInt(parts[2], 10);
                            if (!isNaN(year) && !isNaN(monthIdx) && !isNaN(day)) {
                                return { year, monthName: MESES_ES[monthIdx] || 'Sin fecha', day };
                            }
                        }
                    }
                    const date = new Date(dateStr);
                    if (!isNaN(date.getTime())) {
                        return { year: date.getFullYear(), monthName: MESES_ES[date.getMonth()] || 'Sin fecha', day: date.getDate() };
                    }
                    return { year: new Date().getFullYear(), monthName: 'Sin fecha', day: 1 };
                };

                const getJoinedSingle = (rel: any) => Array.isArray(rel) ? rel[0] : rel;

                if (selectedTipoSop !== 'proyectado') {
                    validPeds.forEach(ped => {
                        const opp = opps.find(o => o.id === ped.opportunity_id);
                        if (!opp) return;

                        const cuentaObj = getJoinedSingle(opp.cuenta);
                        const estadoObj = getJoinedSingle(opp.estado_info);

                        const canalId = cuentaObj?.canal_id;
                        const subcanalId = cuentaObj?.subclasificacion_id;

                        if (selectedCanal && canalId !== selectedCanal) return;
                        if (selectedEstado && estadoObj?.nombre !== selectedEstado) return;

                        const fechaFact = (ped as any)['EXTRA_Fecha de facturación'] || ped.closeDate || ped.expectedCloseDate;
                        const fechaEntr = (ped as any)['EXTRA_Fecha mínima requerida por comercial/cliente'] || ped.expectedCloseDate || ped.closeDate;

                        const dtComercial = getYearAndMonth(fechaFact || fechaEntr);
                        const dtPlanta = getYearAndMonth(fechaEntr || fechaFact);

                        const anioFact = dtComercial.year;
                        const mesComercial = dtComercial.monthName;
                        const mesPlanta = dtPlanta.monthName;
                        const quincena = dtComercial.day <= 15 ? 1 : 2;

                        if (selectedSopAnio && String(anioFact) !== selectedSopAnio) return;
                        if (selectedSopMes && mesComercial !== selectedSopMes) return;
                        if (selectedQuincena && String(quincena) !== selectedQuincena) return;

                        ped.items?.forEach((item: any) => {
                            const prod = prodMap.get(item.producto_id) || { sku: '-', descripcion: 'Producto no especificado', planta: '-', familia: '-' };

                            if (selectedPlanta && prod.planta !== selectedPlanta) return;
                            if (selectedFamilia && prod.familia !== selectedFamilia) return;

                            sopRows.push({
                                anio_fact: anioFact,
                                mes_planta: mesPlanta,
                                mes_comercial: mesComercial,
                                estado: 'Pedido (' + (ped.estado_pedido || 'Planeado') + ')',
                                asesor: userMap.get(opp.owner_user_id) || '-',
                                grupo_cliente: canalMap.get(canalId) || '-',
                                subgrupo_cliente: subclasificacionMap.get(subcanalId) || '-',
                                cliente: cuentaObj?.nombre || '-',
                                codigo_articulo: prod.sku,
                                descripcion_articulo: prod.descripcion,
                                planta: prod.planta,
                                familia: prod.familia,
                                valor_unit: Number(item.precio_unitario || 0),
                                cantidad_total: Number(item.cantidad || 0),
                                valor_total: Number(item.precio_unitario || 0) * Number(item.cantidad || 0),
                                probabilidad: 100,
                                quincena: quincena
                            });
                        });
                    });
                }

                if (selectedTipoSop !== 'pedidos') {
                    oppsWithoutPedidosIds.forEach(oppId => {
                        const opp = opps.find(o => o.id === oppId);
                        if (!opp) return;

                        const cuentaObj = getJoinedSingle(opp.cuenta);
                        const estadoObj = getJoinedSingle(opp.estado_info);

                        const canalId = cuentaObj?.canal_id;
                        const subcanalId = cuentaObj?.subclasificacion_id;
                        const oppProb = Number(opp.probabilidad || opp.probability || 0);

                        if (selectedCanal && canalId !== selectedCanal) return;
                        if (selectedEstado && estadoObj?.nombre !== selectedEstado) return;
                        if (minProbabilidad && oppProb < Number(minProbabilidad)) return;

                        const quote = quotesData.find(q => q.opportunity_id === oppId && q.status === 'WINNER')
                                   || quotesData.find(q => q.opportunity_id === oppId);

                        if (!quote || !quote.items || quote.items.length === 0) return;

                        const dtComercial = getYearAndMonth(opp.fecha_cierre_estimada);
                        const dtPlanta = getYearAndMonth(opp.fecha_cierre_estimada);

                        const anioFact = dtComercial.year;
                        const mesComercial = dtComercial.monthName;
                        const mesPlanta = dtPlanta.monthName;
                        const quincena = dtComercial.day <= 15 ? 1 : 2;

                        if (selectedSopAnio && String(anioFact) !== selectedSopAnio) return;
                        if (selectedSopMes && mesComercial !== selectedSopMes) return;
                        if (selectedQuincena && String(quincena) !== selectedQuincena) return;

                        quote.items.forEach((item: any) => {
                            const prod = prodMap.get(item.producto_id) || { sku: '-', descripcion: 'Producto no especificado', planta: '-', familia: '-' };

                            if (selectedPlanta && prod.planta !== selectedPlanta) return;
                            if (selectedFamilia && prod.familia !== selectedFamilia) return;

                            sopRows.push({
                                anio_fact: anioFact,
                                mes_planta: mesPlanta,
                                mes_comercial: mesComercial,
                                estado: estadoObj?.nombre || 'Proyectado',
                                asesor: userMap.get(opp.owner_user_id) || '-',
                                grupo_cliente: canalMap.get(canalId) || '-',
                                subgrupo_cliente: subclasificacionMap.get(subcanalId) || '-',
                                cliente: cuentaObj?.nombre || '-',
                                codigo_articulo: prod.sku,
                                descripcion_articulo: prod.descripcion,
                                planta: prod.planta,
                                familia: prod.familia,
                                valor_unit: Number(item.precio_unitario || 0),
                                cantidad_total: Number(item.cantidad || 0),
                                valor_total: Number(item.precio_unitario || 0) * Number(item.cantidad || 0),
                                probabilidad: oppProb,
                                quincena: quincena
                            });
                        });
                    });
                }

                if (sopRows.length === 0) {
                    alert("No se encontraron registros de S&OP con los filtros seleccionados.");
                    setIsExporting(false);
                    return;
                }

                const currentDateTime = new Date().toISOString().replace(/:/g, '-').split('.')[0];
                const fileName = `Informe_SOP_${currentDateTime}`;

                if (format === 'excel') {
                    await downloadSopExcel(sopRows, fileName);
                } else {
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

            selectStr = '*';
            columns = [];
            flattenFn = (item: any) => item;

            if (selectedEntidad === 'oportunidades') {
                selectStr = `
                    *,
                    cuenta:CRM_Cuentas(nombre, canal_id),
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
                    { header: 'PROBABILIDAD (%)', key: 'probabilidad', width: 15 },
                    { header: 'FECHA CIERRE EST.', key: 'fecha_cierre_estimada', width: 18 },
                    { header: 'SEGMENTO', key: 'segmento_nombre', width: 25 },
                    { header: 'ORIGEN', key: 'origen_oportunidad', width: 20 },
                    { header: 'DEPARTAMENTO', key: 'departamento_nombre', width: 20 },
                    { header: 'CIUDAD', key: 'ciudad_nombre', width: 20 },
                    { header: 'RAZÓN PÉRDIDA', key: 'razon_perdida_label', width: 30 },
                    { header: 'COMENTARIOS PÉRDIDA', key: 'comentarios_perdida', width: 40 },
                    { header: 'CREADO POR', key: 'creador_nombre', width: 25 }
                ];
                flattenFn = (item: any) => {
                    const cuentaObj = getJoinedSingle(item.cuenta);
                    const faseObj = getJoinedSingle(item.fase);
                    const estadoObj = getJoinedSingle(item.estado_info);
                    return {
                        ...item,
                        cuenta_nombre: cuentaObj?.nombre || '-',
                        fase_nombre: faseObj?.nombre || '-',
                        estado_nombre: estadoObj?.nombre || '-',
                        vendedor_nombre: userMap.get(item.owner_user_id) || '-',
                        creador_nombre: userMap.get(item.created_by) || '-',
                        segmento_nombre: segmentMap.get(item.segmento_id) || '-',
                        canal_nombre: canalMap.get(faseObj?.canal_id || cuentaObj?.canal_id) || '-',
                        departamento_nombre: deptMap.get(item.departamento_id) || '-',
                        ciudad_nombre: cityMap.get(item.ciudad_id) || '-',
                        probabilidad: item.probabilidad ?? item.probability ?? 0,
                        probability: item.probabilidad ?? item.probability ?? 0,
                        razon_perdida_label: item.razon_perdida_id ? (lossReasonMap.get(item.razon_perdida_id) || item.razon_perdida) : (item.razon_perdida || '-')
                    };
                };
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
                    { header: 'ES PREMIUM', key: 'premium_label', width: 15 },
                    { header: 'VENDEDOR ASIGNADO', key: 'vendedor_nombre', width: 25 },
                    { header: 'CREADO EL', key: 'created_at' }
                ];
                flattenFn = (item: any) => ({
                    ...item,
                    nit: item.nit || (item.nit_base ? `${item.nit_base}${item.nit_sufijo ? '-' + item.nit_sufijo : ''}` : '-'),
                    canal_nombre: canalMap.get(item.canal_id) || '-',
                    premium_label: item.es_premium ? 'Sí' : 'No',
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
                flattenFn = (item: any) => {
                    const cuentaObj = getJoinedSingle(item.cuenta);
                    return {
                        ...item,
                        nombre_completo: item.nombre || `${item.nombres || ''} ${item.apellidos || ''}`.trim() || '-',
                        cuenta_nombre: cuentaObj?.nombre || '-',
                        vendedor_nombre: userMap.get(item.user_id || item.created_by) || '-'
                    };
                };
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
                flattenFn = (item: any) => {
                    const oppObj = getJoinedSingle(item.oportunidad);
                    return {
                        ...item,
                        codigo: item.numero_cotizacion || item.codigo || item.id,
                        titulo: item.titulo || oppObj?.nombre || '-',
                        oportunidad_nombre: oppObj?.nombre || '-',
                        subtotal: item.subtotal || item.total_amount || 0,
                        total_final: item.total_amount || item.total_final || 0,
                        estado: item.status || item.estado || '-',
                        vendedor_nombre: userMap.get(item.user_id || item.created_by) || '-'
                    };
                };
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
                flattenFn = (item: any) => {
                    const cuentaObj = getJoinedSingle(item.cuenta);
                    const oppObj = getJoinedSingle(item.oportunidad);
                    const usrObj = getJoinedSingle(item.usuario);
                    const clasifObj = getJoinedSingle(item.clasificacion);
                    const subclasifObj = getJoinedSingle(item.subclasificacion);
                    const tipoActObj = getJoinedSingle(item.tipo_act_info);
                    return {
                        ...item,
                        asunto: item.asunto || '-',
                        clasificacion_nombre: clasifObj?.nombre || clasificacionMap.get(item.clasificacion_id) || '-',
                        subclasificacion_nombre: subclasifObj?.nombre || subclasificacionMap.get(item.subclasificacion_id) || '-',
                        cuenta_nombre: cuentaObj?.nombre || '-',
                        oportunidad_nombre: oppObj?.nombre || '-',
                        oportunidad_monto: oppObj?.amount || 0,
                        vendedor_nombre: usrObj?.full_name || userMap.get(item.user_id) || '-',
                        estado_nombre: item.is_completed ? 'Completado' : 'No completado',
                        tipo_nombre: tipoActObj?.nombre || tipoActividadMap.get(item.tipo_actividad_id) || item.tipo_actividad || '-',
                        descripcion: item.descripcion || '-'
                    };
                };
            }

            let query = supabase.from(entidadDef.table).select(selectStr);

            if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00Z`);
            if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59Z`);
            
            if (selectedEntidad === 'actividades') {
                if (dueDateFrom) query = query.gte('fecha_fin', `${dueDateFrom}T00:00:00Z`);
                if (dueDateTo) query = query.lte('fecha_fin', `${dueDateTo}T23:59:59Z`);
            }
            
            if (selectedUser) {
                if (selectedEntidad === 'oportunidades' || selectedEntidad === 'cuentas') {
                    query = query.eq('owner_user_id', selectedUser);
                } else {
                    query = query.eq('user_id', selectedUser);
                }
            }

            if (selectedCanal) {
                if (selectedEntidad === 'cuentas') {
                    query = query.eq('canal_id', selectedCanal);
                } else if (selectedEntidad === 'oportunidades') {
                    const { data: faseData } = await supabase.from('CRM_FasesOportunidad').select('id').eq('canal_id', selectedCanal);
                    const faseIds = faseData?.map(f => f.id) || [];
                    query = query.in('fase_id', faseIds);
                }
            }

            if (selectedEstado && selectedEntidad === 'oportunidades') {
                const estadoIds = ESTADO_IDS_BY_NAME[selectedEstado];
                if (estadoIds?.length) {
                    query = query.in('estado_id', estadoIds);
                }
            }

            if (selectedFase && selectedEntidad === 'oportunidades') {
                let matchingFases = catalogs.fases.filter(f => f.nombre === selectedFase);
                if (selectedCanal) {
                    matchingFases = matchingFases.filter(f => f.canal_id === selectedCanal);
                }
                const faseIds = matchingFases.map(f => f.id);
                if (faseIds.length > 0) {
                    query = query.in('fase_id', faseIds);
                }
            }

            if (selectedSegmento && selectedEntidad === 'oportunidades') {
                query = query.eq('segmento_id', Number(selectedSegmento));
            }

            if (selectedOrigen && selectedEntidad === 'oportunidades') {
                query = query.ilike('origen_oportunidad', `%${selectedOrigen.trim()}%`);
            }

            if (selectedEntidad === 'oportunidades') {
                if (minAmount) query = query.gte('amount', Number(minAmount));
                if (maxAmount) query = query.lte('amount', Number(maxAmount));
            }

            if (selectedEntidad === 'cotizaciones') {
                if (minAmount) query = query.gte('total_amount', Number(minAmount));
                if (maxAmount) query = query.lte('total_amount', Number(maxAmount));
                if (selectedEstadoCotizacion) query = query.eq('status', selectedEstadoCotizacion);
            }

            if (selectedEntidad === 'oportunidades' || selectedEntidad === 'cuentas') {
                if (selectedDept) query = query.eq('departamento_id', Number(selectedDept));
                if (selectedCiudad) query = query.eq('ciudad_id', Number(selectedCiudad));
            }

            if (selectedEntidad === 'cuentas' && selectedEsPremium !== '') {
                query = query.eq('es_premium', selectedEsPremium === 'true');
            }

            if (selectedEntidad === 'contactos' && selectedCargo) {
                query = query.ilike('cargo', `%${selectedCargo.trim()}%`);
            }

            if (selectedEntidad === 'actividades') {
                if (selectedTipoActividad) query = query.eq('tipo_actividad_id', Number(selectedTipoActividad));
                if (selectedClasificacion) query = query.eq('clasificacion_id', Number(selectedClasificacion));
                if (selectedSubclasificacion) query = query.eq('subclasificacion_id', Number(selectedSubclasificacion));
                if (selectedEstadoCumplimiento === 'completadas') query = query.eq('is_completed', true);
                if (selectedEstadoCumplimiento === 'pendientes') query = query.eq('is_completed', false);
            }

            const { data, error } = await query;
            if (error) throw error;

            if (!data || data.length === 0) {
                alert("No se encontraron registros con los filtros seleccionados.");
                setIsExporting(false);
                return;
            }

            const flattenedData = data.map(flattenFn);

            if (columns.length === 0) {
                const headerKeys = Object.keys(flattenedData[0]);
                columns = headerKeys.map(key => ({
                    header: key.toUpperCase().replace(/_/g, ' '),
                    key: key,
                    width: 25
                }));
            }

            const currentDateTime = new Date().toISOString().replace(/:/g, '-').split('.')[0];
            const fileName = `Informe_${entidadDef.label}_${currentDateTime}`;

            if (format === 'excel') {
                await downloadExcel(flattenedData, columns, fileName, entidadDef.label);
            } else {
                downloadCSV(flattenedData, columns, fileName);
            }

        } catch (error: any) {
            console.error("Export Error:", error);
            const detailMsg = error?.message || error?.details || error?.hint || (typeof error === 'string' ? error : JSON.stringify(error));
            alert(`Ocurrió un error al exportar: ${detailMsg || 'Desconocido'}`);
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
                    <CardHeader className="bg-white border-b border-slate-100 px-6 py-5 flex flex-row items-center justify-between">
                        <div className="flex items-center gap-2 text-[#254153]">
                            <Filter className="w-5 h-5" />
                            <CardTitle className="text-lg">Filtros del Informe: <span className="text-blue-600 ml-1">{ENTIDADES.find(e => e.id === selectedEntidad)?.label}</span></CardTitle>
                        </div>
                        <button
                            onClick={handleResetFilters}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 rounded-lg transition-all"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Limpiar Filtros
                        </button>
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

                        {/* Rango de Fechas (Vencimiento) - Solo para Actividades */}
                        {selectedEntidad === 'actividades' && (
                            <div className="space-y-3 col-span-1 lg:col-span-2">
                                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                    <CalendarIcon className="w-4 h-4 text-amber-500" />
                                    Rango de Fechas (Vencimiento)
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-medium">Desde</span>
                                        <input 
                                            type="date" 
                                            value={dueDateFrom} 
                                            onChange={e => setDueDateFrom(e.target.value)} 
                                            className="w-full pl-12 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:bg-white transition-all text-sm"
                                        />
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-medium">Hasta</span>
                                        <input 
                                            type="date" 
                                            value={dueDateTo} 
                                            onChange={e => setDueDateTo(e.target.value)} 
                                            className="w-full pl-12 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:bg-white transition-all text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Asesor Comercial */}
                        <div className="space-y-3">
                            <label className="text-sm font-semibold text-slate-700">Asesor Comercial</label>
                            <SearchableSelect 
                                options={asesorOptions}
                                value={selectedUser}
                                onChange={setSelectedUser}
                                placeholder="Todos los asesores"
                                triggerClassName={SELECT_TRIGGER_CLASS}
                            />
                        </div>

                        {/* Canal */}
                        {(selectedEntidad === 'oportunidades' || selectedEntidad === 'cuentas' || selectedEntidad === 'sop') && (
                            <div className="space-y-3">
                                <label className="text-sm font-semibold text-slate-700">Canal de Venta</label>
                                <SearchableSelect 
                                    options={canalOptions}
                                    value={selectedCanal}
                                    onChange={setSelectedCanal}
                                    placeholder="Todos los canales"
                                    triggerClassName={SELECT_TRIGGER_CLASS}
                                />
                            </div>
                        )}

                        {/* Estado Oportunidad */}
                        {(selectedEntidad === 'oportunidades' || selectedEntidad === 'sop') && (
                            <div className="space-y-3">
                                <label className="text-sm font-semibold text-slate-700">Estado Oportunidad</label>
                                <SearchableSelect 
                                    options={estadoOppOptions}
                                    value={selectedEstado}
                                    onChange={setSelectedEstado}
                                    placeholder="Todos los estados"
                                    triggerClassName={SELECT_TRIGGER_CLASS}
                                />
                            </div>
                        )}

                        {/* Fase de Oportunidad */}
                        {selectedEntidad === 'oportunidades' && (
                            <div className="space-y-3">
                                <label className="text-sm font-semibold text-slate-700">Fase de Oportunidad</label>
                                <SearchableSelect 
                                    options={faseOptions}
                                    value={selectedFase}
                                    onChange={setSelectedFase}
                                    placeholder="Todas las fases"
                                    triggerClassName={SELECT_TRIGGER_CLASS}
                                />
                            </div>
                        )}

                        {/* Segmento */}
                        {selectedEntidad === 'oportunidades' && (
                            <div className="space-y-3">
                                <label className="text-sm font-semibold text-slate-700">Segmento de Mercado</label>
                                <SearchableSelect 
                                    options={segmentoOptions}
                                    value={selectedSegmento}
                                    onChange={setSelectedSegmento}
                                    placeholder="Todos los segmentos"
                                    triggerClassName={SELECT_TRIGGER_CLASS}
                                />
                            </div>
                        )}

                        {/* Origen de Oportunidad */}
                        {selectedEntidad === 'oportunidades' && (
                            <div className="space-y-3">
                                <label className="text-sm font-semibold text-slate-700">Origen de Oportunidad</label>
                                <input 
                                    type="text" 
                                    placeholder="Ej. Web, Feria, Referido" 
                                    value={selectedOrigen} 
                                    onChange={e => setSelectedOrigen(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
                                />
                            </div>
                        )}

                        {/* Montos Min y Max (Oportunidades & Cotizaciones) */}
                        {(selectedEntidad === 'oportunidades' || selectedEntidad === 'cotizaciones') && (
                            <div className="space-y-3 col-span-1 lg:col-span-2">
                                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                    <DollarSign className="w-4 h-4 text-emerald-600" />
                                    Rango de Valor ($)
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <input 
                                        type="number" 
                                        placeholder="Monto Mínimo" 
                                        value={minAmount} 
                                        onChange={e => setMinAmount(e.target.value)}
                                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-sm"
                                    />
                                    <input 
                                        type="number" 
                                        placeholder="Monto Máximo" 
                                        value={maxAmount} 
                                        onChange={e => setMaxAmount(e.target.value)}
                                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-sm"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Ubicación (Departamento y Ciudad) */}
                        {(selectedEntidad === 'oportunidades' || selectedEntidad === 'cuentas') && (
                            <>
                                <div className="space-y-3">
                                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                        <MapPin className="w-4 h-4 text-slate-400" />
                                        Departamento
                                    </label>
                                    <SearchableSelect 
                                        options={deptOptions}
                                        value={selectedDept}
                                        onChange={val => { setSelectedDept(val); setSelectedCiudad(''); }}
                                        placeholder="Todos los departamentos"
                                        triggerClassName={SELECT_TRIGGER_CLASS}
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-semibold text-slate-700">Ciudad</label>
                                    <SearchableSelect 
                                        options={ciudadOptions}
                                        value={selectedCiudad}
                                        onChange={setSelectedCiudad}
                                        placeholder="Todas las ciudades"
                                        triggerClassName={SELECT_TRIGGER_CLASS}
                                    />
                                </div>
                            </>
                        )}

                        {/* Cuentas - Es Premium */}
                        {selectedEntidad === 'cuentas' && (
                            <div className="space-y-3">
                                <label className="text-sm font-semibold text-slate-700">Tipo de Cliente (Premium)</label>
                                <SearchableSelect 
                                    options={premiumOptions}
                                    value={selectedEsPremium}
                                    onChange={setSelectedEsPremium}
                                    placeholder="Todos los clientes"
                                    triggerClassName={SELECT_TRIGGER_CLASS}
                                />
                            </div>
                        )}

                        {/* Contactos - Cargo */}
                        {selectedEntidad === 'contactos' && (
                            <div className="space-y-3">
                                <label className="text-sm font-semibold text-slate-700">Cargo / Rol de Decisión</label>
                                <input 
                                    type="text" 
                                    placeholder="Ej. Gerente, Director de Obra, Comprador" 
                                    value={selectedCargo} 
                                    onChange={e => setSelectedCargo(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
                                />
                            </div>
                        )}

                        {/* Cotizaciones - Estado */}
                        {selectedEntidad === 'cotizaciones' && (
                            <div className="space-y-3">
                                <label className="text-sm font-semibold text-slate-700">Estado de Cotización</label>
                                <SearchableSelect 
                                    options={estadoCotizacionOptions}
                                    value={selectedEstadoCotizacion}
                                    onChange={setSelectedEstadoCotizacion}
                                    placeholder="Todos los estados"
                                    triggerClassName={SELECT_TRIGGER_CLASS}
                                />
                            </div>
                        )}

                        {/* Actividades - Tipo, Clasificación, Subclasificación, Estado Cumplimiento */}
                        {selectedEntidad === 'actividades' && (
                            <>
                                <div className="space-y-3">
                                    <label className="text-sm font-semibold text-slate-700">Estado de Cumplimiento</label>
                                    <SearchableSelect 
                                        options={cumplimientoActividadOptions}
                                        value={selectedEstadoCumplimiento}
                                        onChange={setSelectedEstadoCumplimiento}
                                        placeholder="Todas las actividades"
                                        triggerClassName={SELECT_TRIGGER_CLASS}
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-semibold text-slate-700">Tipo de Actividad</label>
                                    <SearchableSelect 
                                        options={tipoActividadOptions}
                                        value={selectedTipoActividad}
                                        onChange={setSelectedTipoActividad}
                                        placeholder="Todos los tipos"
                                        triggerClassName={SELECT_TRIGGER_CLASS}
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-semibold text-slate-700">Clasificación</label>
                                    <SearchableSelect 
                                        options={clasificacionActividadOptions}
                                        value={selectedClasificacion}
                                        onChange={val => { setSelectedClasificacion(val); setSelectedSubclasificacion(''); }}
                                        placeholder="Todas las clasificaciones"
                                        triggerClassName={SELECT_TRIGGER_CLASS}
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-semibold text-slate-700">Subclasificación</label>
                                    <SearchableSelect 
                                        options={subclasificacionActividadOptions}
                                        value={selectedSubclasificacion}
                                        onChange={setSelectedSubclasificacion}
                                        placeholder="Todas las subclasificaciones"
                                        triggerClassName={SELECT_TRIGGER_CLASS}
                                    />
                                </div>
                            </>
                        )}

                        {/* Proyección S&OP */}
                        {selectedEntidad === 'sop' && (
                            <>
                                <div className="space-y-3">
                                    <label className="text-sm font-semibold text-slate-700">Año Facturación (S&OP)</label>
                                    <SearchableSelect 
                                        options={sopAnioOptions}
                                        value={selectedSopAnio}
                                        onChange={setSelectedSopAnio}
                                        placeholder="Todos los años"
                                        triggerClassName={SELECT_TRIGGER_CLASS}
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-semibold text-slate-700">Mes Comercial (S&OP)</label>
                                    <SearchableSelect 
                                        options={sopMesOptions}
                                        value={selectedSopMes}
                                        onChange={setSelectedSopMes}
                                        placeholder="Todos los meses"
                                        triggerClassName={SELECT_TRIGGER_CLASS}
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-semibold text-slate-700">Planta</label>
                                    <SearchableSelect 
                                        options={sopPlantaOptions}
                                        value={selectedPlanta}
                                        onChange={setSelectedPlanta}
                                        placeholder="Todas las plantas"
                                        triggerClassName={SELECT_TRIGGER_CLASS}
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-semibold text-slate-700">Familia de Producto</label>
                                    <SearchableSelect 
                                        options={sopFamiliaOptions}
                                        value={selectedFamilia}
                                        onChange={setSelectedFamilia}
                                        placeholder="Todas las familias"
                                        triggerClassName={SELECT_TRIGGER_CLASS}
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-semibold text-slate-700">Probabilidad Mínima (%)</label>
                                    <input 
                                        type="number" 
                                        placeholder="Ej. 70" 
                                        value={minProbabilidad} 
                                        onChange={e => setMinProbabilidad(e.target.value)}
                                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-semibold text-slate-700">Quincena</label>
                                    <SearchableSelect 
                                        options={sopQuincenaOptions}
                                        value={selectedQuincena}
                                        onChange={setSelectedQuincena}
                                        placeholder="Todas las quincenas"
                                        triggerClassName={SELECT_TRIGGER_CLASS}
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-semibold text-slate-700">Tipo de Registro</label>
                                    <SearchableSelect 
                                        options={sopTipoRegistroOptions}
                                        value={selectedTipoSop}
                                        onChange={setSelectedTipoSop}
                                        placeholder="Todos los registros"
                                        triggerClassName={SELECT_TRIGGER_CLASS}
                                    />
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
