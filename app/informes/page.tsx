"use client";

import React, { useState, useMemo } from 'react';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { useUsers } from '@/lib/hooks/useUsers';
import { supabase } from '@/lib/supabase';
import { downloadExcel, downloadCSV, ExportColumn } from '@/lib/utils/informes';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { FileSpreadsheet, Loader2, Download, TableProperties, Users, Briefcase, Building2, Calendar as CalendarIcon, Filter } from 'lucide-react';
import { cn } from '@/components/ui/utils';

// Constantes para filtros
const ENTIDADES = [
  { id: 'oportunidades', label: 'Oportunidades', icon: Briefcase, table: 'CRM_Oportunidades' },
  { id: 'cuentas', label: 'Cuentas', icon: Building2, table: 'CRM_Cuentas' },
  { id: 'contactos', label: 'Contactos', icon: Users, table: 'CRM_Contactos' },
  { id: 'cotizaciones', label: 'Cotizaciones', icon: TableProperties, table: 'CRM_Cotizaciones' },
] as const;

type EntidadType = typeof ENTIDADES[number]['id'];

const CANALES = ['Retail', 'Constructoras', 'Grandes Superficies', 'Institucional', 'Exportaciones', 'E-commerce', 'Showroom'];
const ESTADOS_OPPORTUNIDADES = ['Abierta', 'Ganada', 'Perdida', 'Suspendida'];

export default function InformesPage() {
    const { role, isLoading: isLoadingUser } = useCurrentUser();
    const { users } = useUsers();
    
    const [selectedEntidad, setSelectedEntidad] = useState<EntidadType>('oportunidades');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [selectedUser, setSelectedUser] = useState('');
    const [selectedCanal, setSelectedCanal] = useState('');
    const [selectedEstado, setSelectedEstado] = useState('');
    const [isExporting, setIsExporting] = useState(false);

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

            // Configuración de columnas y joins por entidad
            let selectStr = '*';
            let columns: ExportColumn<any>[] = [];
            let flattenFn = (item: any) => item;

            if (selectedEntidad === 'oportunidades') {
                selectStr = `
                    *,
                    cuenta:CRM_Cuentas(nombre),
                    fase:CRM_FasesOportunidad(nombre),
                    estado_info:CRM_EstadosOportunidad(nombre),
                    vendedor:CRM_Usuarios!CRM_Oportunidades_owner_user_id_fkey(full_name)
                `;
                columns = [
                    { header: 'ID', key: 'id' },
                    { header: 'NOMBRE OPORTUNIDAD', key: 'nombre', width: 30 },
                    { header: 'CUENTA', key: 'cuenta_nombre', width: 30 },
                    { header: 'FASE', key: 'fase_nombre' },
                    { header: 'ESTADO', key: 'estado_nombre' },
                    { header: 'VALOR', key: 'amount' },
                    { header: 'MONEDA', key: 'currency_id' },
                    { header: 'VENDEDOR', key: 'vendedor_nombre', width: 25 },
                    { header: 'FECHA CIERRE', key: 'fecha_cierre_estimada' },
                    { header: 'CREADO EL', key: 'created_at' }
                ];
                flattenFn = (item: any) => ({
                    ...item,
                    cuenta_nombre: item.cuenta?.nombre || '-',
                    fase_nombre: item.fase?.nombre || '-',
                    estado_nombre: item.estado_info?.nombre || '-',
                    vendedor_nombre: item.vendedor?.full_name || '-'
                });
            } else if (selectedEntidad === 'cuentas') {
                selectStr = `
                    *,
                    vendedor:CRM_Usuarios!CRM_Cuentas_owner_user_id_fkey(full_name)
                `;
                columns = [
                    { header: 'ID', key: 'id' },
                    { header: 'NIT', key: 'nit' },
                    { header: 'NOMBRE CUENTA', key: 'nombre', width: 40 },
                    { header: 'CANAL', key: 'canal' },
                    { header: 'TELÉFONO', key: 'telefono' },
                    { header: 'EMAIL', key: 'email', width: 30 },
                    { header: 'CIUDAD', key: 'ciudad' },
                    { header: 'VENDEDOR ASIGNADO', key: 'vendedor_nombre', width: 25 },
                    { header: 'CREADO EL', key: 'created_at' }
                ];
                flattenFn = (item: any) => ({
                    ...item,
                    vendedor_nombre: item.vendedor?.full_name || '-'
                });
            } else if (selectedEntidad === 'contactos') {
                selectStr = `
                    *,
                    cuenta:CRM_Cuentas(nombre),
                    vendedor:CRM_Usuarios!CRM_Contactos_user_id_fkey(full_name)
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
                    vendedor_nombre: item.vendedor?.full_name || '-'
                });
            } else if (selectedEntidad === 'cotizaciones') {
                selectStr = `
                    *,
                    oportunidad:CRM_Oportunidades(nombre),
                    vendedor:CRM_Usuarios!CRM_Cotizaciones_user_id_fkey(full_name)
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
                    vendedor_nombre: item.vendedor?.full_name || '-'
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
            if (selectedEntidad === 'oportunidades' || selectedEntidad === 'cuentas') {
                if (selectedCanal) query = query.eq('canal', selectedCanal);
                if (selectedEstado && selectedEntidad === 'oportunidades') query = query.eq('estado', selectedEstado);
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
                        {(selectedEntidad === 'oportunidades' || selectedEntidad === 'cuentas') && (
                            <div className="space-y-3">
                                <label className="text-sm font-semibold text-slate-700">Canal</label>
                                <select 
                                    value={selectedCanal} 
                                    onChange={e => setSelectedCanal(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
                                >
                                    <option value="">Todos los canales</option>
                                    {CANALES.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {selectedEntidad === 'oportunidades' && (
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
