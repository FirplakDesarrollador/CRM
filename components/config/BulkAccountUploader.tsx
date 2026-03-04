"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import {
    Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle, Loader2, X,
    ChevronRight, ChevronLeft, Rocket, MapPin, Pencil, ToggleLeft, ToggleRight,
    Search, AlertTriangle, Copy
} from 'lucide-react';
import { cn } from '@/components/ui/utils';
import { supabase } from '@/lib/supabase';

// ── Types ─────────────────────────────────
interface RowData {
    cuenta_nombre: string;
    cuenta_nit: string;
    cuenta_telefono: string;
    cuenta_direccion: string;
    cuenta_email: string;
    cuenta_canal: string;
    cuenta_pais: string;
    cuenta_departamento: string;
    cuenta_ciudad: string;
    contacto_nombre: string;
    contacto_cargo: string;
    contacto_email: string;
    contacto_telefono: string;
}

interface RowValidation {
    errors: { field: string; message: string; type: 'error' | 'warning' | 'duplicate' }[];
    resolved_canal: string | null;
    resolved_pais_id: number | null;
    resolved_depto_id: number | null;
    resolved_ciudad_id: number | null;
    pais_suggestions: { id: number; nombre: string }[];
    depto_suggestions: { id: number; nombre: string }[];
    ciudad_suggestions: { id: number; nombre: string }[];
    canal_suggestions: string[];
    duplicate_accounts: { id: string; nombre: string; nit_base: string }[];
    duplicate_contacts: { id: string; nombre: string; email: string }[];
    enabled: boolean;
}

interface UploadResult {
    success: boolean;
    createdAccounts: number;
    createdContacts: number;
    errors: string[];
}

interface Catalog {
    paises: { id: number; nombre: string }[];
    departamentos: { id: number; nombre: string; pais_id: number }[];
    ciudades: { id: number; nombre: string; departamento_id: number }[];
    existingAccounts: { id: string; nombre: string; nit_base: string; email: string; telefono: string }[];
    existingContacts: { id: string; nombre: string; email: string; account_id: string }[];
}

const CSV_HEADERS = [
    'cuenta_nombre', 'cuenta_nit', 'cuenta_telefono', 'cuenta_direccion', 'cuenta_email',
    'cuenta_canal', 'cuenta_pais', 'cuenta_departamento', 'cuenta_ciudad',
    'contacto_nombre', 'contacto_cargo', 'contacto_email', 'contacto_telefono'
];

const CANAL_OPTIONS = [
    { id: 'DIST_NAC', label: 'Distribución Nacional' },
    { id: 'DIST_INT', label: 'Distribución Internacional' },
    { id: 'OBRAS_NAC', label: 'Obras Nacional' },
    { id: 'OBRAS_INT', label: 'Obras Internacional' },
    { id: 'PROPIO', label: 'Canal Propio' },
];

const CANAL_IDS = CANAL_OPTIONS.map(c => c.id);

// ── Helpers ───────────────────────────────
function normalize(s: string): string {
    return s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function closeMatchAll(text: string, candidates: { id: number; nombre: string }[], maxResults = 5): { id: number; nombre: string; score: number }[] {
    if (!text || !text.trim()) return [];
    const norm = normalize(text);
    // Score: exact=100, startsWith=80, includes=60
    const scored = candidates.map(c => {
        const cn = normalize(c.nombre);
        let score = 0;
        if (cn === norm) score = 100;
        else if (cn.startsWith(norm) || norm.startsWith(cn)) score = 80;
        else if (cn.includes(norm) || norm.includes(cn)) score = 60;
        return { ...c, score };
    }).filter(c => c.score > 0).sort((a, b) => b.score - a.score);
    return scored.slice(0, maxResults);
}

function resolveCanal(text: string): { id: string | null; suggestions: string[] } {
    if (!text) return { id: null, suggestions: CANAL_IDS };
    const upper = text.toUpperCase().trim();
    if (CANAL_IDS.includes(upper)) return { id: upper, suggestions: [] };

    const friendlyMap: Record<string, string> = {
        'distribucion nacional': 'DIST_NAC', 'distribucion internacional': 'DIST_INT',
        'obras nacional': 'OBRAS_NAC', 'obras internacional': 'OBRAS_INT',
        'canal propio': 'PROPIO', 'propio': 'PROPIO',
    };
    const norm = normalize(text);
    if (friendlyMap[norm]) return { id: friendlyMap[norm], suggestions: [] };

    // Partial match suggestions
    const suggestions = CANAL_OPTIONS
        .filter(c => normalize(c.label).includes(norm) || normalize(c.id).includes(norm))
        .map(c => c.id);
    return { id: null, suggestions: suggestions.length > 0 ? suggestions : CANAL_IDS };
}

function generateTemplateCSV(): string {
    const header = CSV_HEADERS.join(',');
    const example = [
        'Constructora Ejemplo', '890123456', '3001234567', 'Calle 50 #30-20', 'info@ejemplo.com',
        'DIST_NAC', 'Colombia', 'Antioquia', 'Medellín',
        'Juan Pérez', 'Gerente Comercial', 'juan@ejemplo.com', '3009876543'
    ].join(',');
    return `${header}\n${example}`;
}

function parseCSV(text: string): { rows: RowData[]; missingColumns: string[] } {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return { rows: [], missingColumns: [] };

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const missingColumns = CSV_HEADERS.filter(h => !headers.includes(h));

    const rows: RowData[] = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row: any = {};
        CSV_HEADERS.forEach(h => { row[h] = ''; }); // init all columns
        headers.forEach((h, idx) => {
            if (CSV_HEADERS.includes(h)) {
                row[h] = (values[idx] || '').trim();
            }
        });
        if (row.cuenta_nombre || row.cuenta_nit || row.contacto_nombre) {
            rows.push(row as RowData);
        }
    }
    return { rows, missingColumns };
}

function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { inQuotes = !inQuotes; }
        else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
        else { current += ch; }
    }
    result.push(current.trim());
    return result;
}

function downloadCSV(filename: string, content: string) {
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ── Validate a single row against catalogs ──
function validateRow(row: RowData, catalog: Catalog): RowValidation {
    const errors: RowValidation['errors'] = [];

    // 1. Campo nombre vacío
    if (!row.cuenta_nombre?.trim()) {
        errors.push({ field: 'cuenta_nombre', message: 'Nombre de cuenta vacío', type: 'error' });
    }

    // 2. Canal
    const canalResult = resolveCanal(row.cuenta_canal);
    if (row.cuenta_canal && !canalResult.id) {
        errors.push({ field: 'cuenta_canal', message: `Canal "${row.cuenta_canal}" no reconocido`, type: 'error' });
    } else if (!row.cuenta_canal) {
        errors.push({ field: 'cuenta_canal', message: 'Canal vacío, se usará DIST_NAC', type: 'warning' });
    }

    // 3. Territorios
    const paisMatches = closeMatchAll(row.cuenta_pais, catalog.paises);
    const resolved_pais_id = paisMatches.length > 0 && paisMatches[0].score === 100 ? paisMatches[0].id : (paisMatches.length === 1 ? paisMatches[0].id : null);
    if (row.cuenta_pais && !resolved_pais_id && paisMatches.length === 0) {
        errors.push({ field: 'cuenta_pais', message: `País "${row.cuenta_pais}" no encontrado`, type: 'error' });
    } else if (row.cuenta_pais && !resolved_pais_id && paisMatches.length > 0) {
        errors.push({ field: 'cuenta_pais', message: `País "${row.cuenta_pais}" ambiguo, selecciona uno`, type: 'warning' });
    }

    const filteredDeptos = resolved_pais_id
        ? catalog.departamentos.filter(d => d.pais_id === resolved_pais_id)
        : catalog.departamentos;
    const deptoMatches = closeMatchAll(row.cuenta_departamento, filteredDeptos);
    const resolved_depto_id = deptoMatches.length > 0 && deptoMatches[0].score >= 80 ? deptoMatches[0].id : null;
    if (row.cuenta_departamento && !resolved_depto_id && deptoMatches.length === 0) {
        errors.push({ field: 'cuenta_departamento', message: `Departamento "${row.cuenta_departamento}" no encontrado`, type: 'error' });
    } else if (row.cuenta_departamento && !resolved_depto_id && deptoMatches.length > 0) {
        errors.push({ field: 'cuenta_departamento', message: `Departamento ambiguo, selecciona uno`, type: 'warning' });
    }

    const filteredCities = resolved_depto_id
        ? catalog.ciudades.filter(c => c.departamento_id === resolved_depto_id)
        : catalog.ciudades;
    const cityMatches = closeMatchAll(row.cuenta_ciudad, filteredCities);
    const resolved_ciudad_id = cityMatches.length > 0 && cityMatches[0].score >= 80 ? cityMatches[0].id : null;
    if (row.cuenta_ciudad && !resolved_ciudad_id && cityMatches.length === 0) {
        errors.push({ field: 'cuenta_ciudad', message: `Ciudad "${row.cuenta_ciudad}" no encontrada`, type: 'error' });
    } else if (row.cuenta_ciudad && !resolved_ciudad_id && cityMatches.length > 0) {
        errors.push({ field: 'cuenta_ciudad', message: `Ciudad ambigua, selecciona una`, type: 'warning' });
    }

    // 4. Duplicados — Cuentas
    const duplicate_accounts: RowValidation['duplicate_accounts'] = [];
    if (row.cuenta_nombre) {
        const nameNorm = normalize(row.cuenta_nombre);
        catalog.existingAccounts.forEach(a => {
            if (normalize(a.nombre) === nameNorm) duplicate_accounts.push(a);
            else if (row.cuenta_nit && a.nit_base && a.nit_base === row.cuenta_nit) duplicate_accounts.push(a);
            else if (row.cuenta_email && a.email && normalize(a.email) === normalize(row.cuenta_email)) duplicate_accounts.push(a);
        });
    }
    if (duplicate_accounts.length > 0) {
        errors.push({ field: 'cuenta_nombre', message: `Posible duplicado: "${duplicate_accounts[0].nombre}"`, type: 'duplicate' });
    }

    // 5. Duplicados — Contactos
    const duplicate_contacts: RowValidation['duplicate_contacts'] = [];
    if (row.contacto_nombre && row.contacto_email) {
        const emailNorm = normalize(row.contacto_email);
        catalog.existingContacts.forEach(c => {
            if (normalize(c.email || '') === emailNorm) duplicate_contacts.push(c);
        });
    }
    if (duplicate_contacts.length > 0) {
        errors.push({ field: 'contacto_email', message: `Email de contacto ya existe`, type: 'duplicate' });
    }

    return {
        errors,
        resolved_canal: canalResult.id || (row.cuenta_canal ? null : 'DIST_NAC'),
        resolved_pais_id: resolved_pais_id ?? (paisMatches.length > 0 ? paisMatches[0].id : null),
        resolved_depto_id: resolved_depto_id ?? (deptoMatches.length > 0 ? deptoMatches[0].id : null),
        resolved_ciudad_id: resolved_ciudad_id ?? (cityMatches.length > 0 ? cityMatches[0].id : null),
        pais_suggestions: paisMatches,
        depto_suggestions: deptoMatches,
        ciudad_suggestions: cityMatches,
        canal_suggestions: canalResult.suggestions,
        duplicate_accounts,
        duplicate_contacts,
        enabled: true,
    };
}

// ── Inline edit cell component ──
function EditableCell({ value, onChange, className, placeholder }: {
    value: string; onChange: (v: string) => void; className?: string; placeholder?: string;
}) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value);

    useEffect(() => { setDraft(value); }, [value]);

    if (editing) {
        return (
            <input
                autoFocus
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={() => { setEditing(false); onChange(draft); }}
                onKeyDown={e => { if (e.key === 'Enter') { setEditing(false); onChange(draft); } if (e.key === 'Escape') { setEditing(false); setDraft(value); } }}
                className={cn("w-full border border-blue-300 rounded px-1.5 py-0.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400", className)}
                placeholder={placeholder}
            />
        );
    }
    return (
        <span
            onClick={() => setEditing(true)}
            className={cn("cursor-pointer hover:bg-blue-50 px-1.5 py-0.5 rounded transition-colors inline-flex items-center gap-1 min-w-[40px]", className)}
            title="Clic para editar"
        >
            {value || <span className="text-slate-300 italic">{placeholder || 'vacío'}</span>}
            <Pencil className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover:opacity-100" />
        </span>
    );
}

// ── Suggestion dropdown ──
function SuggestionSelect<T extends { id: number | string; nombre?: string }>({ options, value, onSelect, label }: {
    options: T[]; value: number | string | null; onSelect: (id: any) => void; label: string;
}) {
    if (options.length === 0) return null;
    return (
        <select
            value={value ?? ''}
            onChange={e => onSelect(e.target.value ? (typeof options[0].id === 'number' ? Number(e.target.value) : e.target.value) : null)}
            className="text-[10px] bg-amber-50 border border-amber-200 rounded px-1 py-0.5 text-amber-800 font-medium max-w-[140px]"
        >
            <option value="">— {label} —</option>
            {options.map(o => (
                <option key={o.id} value={o.id}>{o.nombre || String(o.id)}</option>
            ))}
        </select>
    );
}

// ── MAIN Component ────────────────────────
export function BulkAccountUploader() {
    const [parsedRows, setParsedRows] = useState<RowData[]>([]);
    const [validations, setValidations] = useState<RowValidation[]>([]);
    const [catalog, setCatalog] = useState<Catalog | null>(null);
    const [wizardOpen, setWizardOpen] = useState(false);
    const [wizardStep, setWizardStep] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(false);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<UploadResult | null>(null);
    const [fileName, setFileName] = useState('');
    const [missingColumns, setMissingColumns] = useState<string[]>([]);
    const fileRef = useRef<HTMLInputElement>(null);

    // ── Fetch catalogs ──
    const fetchCatalogs = useCallback(async (): Promise<Catalog> => {
        const [paisRes, depRes, cityRes, accRes, conRes] = await Promise.all([
            supabase.from('CRM_Paises').select('id, nombre'),
            supabase.from('CRM_Departamentos').select('id, nombre, pais_id'),
            supabase.from('CRM_Ciudades').select('id, nombre, departamento_id'),
            supabase.from('CRM_Cuentas').select('id, nombre, nit_base, email, telefono').eq('is_deleted', false).limit(5000),
            supabase.from('CRM_Contactos').select('id, nombre, email, account_id').eq('is_deleted', false).limit(5000),
        ]);
        return {
            paises: paisRes.data || [],
            departamentos: depRes.data || [],
            ciudades: cityRes.data || [],
            existingAccounts: accRes.data || [],
            existingContacts: conRes.data || [],
        };
    }, []);

    // ── Validate all rows ──
    const runValidation = useCallback((rows: RowData[], cat: Catalog, prevValidations?: RowValidation[]) => {
        return rows.map((row, i) => {
            const v = validateRow(row, cat);
            // Preserve enabled state from previous validations
            if (prevValidations && prevValidations[i]) {
                v.enabled = prevValidations[i].enabled;
            }
            return v;
        });
    }, []);

    // ── Update a row and re-validate ──
    const updateRow = useCallback((index: number, field: keyof RowData, value: string) => {
        setParsedRows(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            if (catalog) {
                setValidations(prevV => {
                    const newV = [...prevV];
                    const v = validateRow(updated[index], catalog);
                    v.enabled = prevV[index]?.enabled ?? true;
                    newV[index] = v;
                    return newV;
                });
            }
            return updated;
        });
    }, [catalog]);

    // ── Override resolved ID ──
    const overrideResolution = useCallback((index: number, field: 'resolved_pais_id' | 'resolved_depto_id' | 'resolved_ciudad_id' | 'resolved_canal', value: any) => {
        setValidations(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            // Clear downstream errors
            if (field === 'resolved_pais_id' || field === 'resolved_canal') {
                updated[index].errors = updated[index].errors.filter(e =>
                    (field === 'resolved_canal' ? e.field !== 'cuenta_canal' : e.field !== 'cuenta_pais')
                );
            }
            if (field === 'resolved_depto_id') {
                updated[index].errors = updated[index].errors.filter(e => e.field !== 'cuenta_departamento');
            }
            if (field === 'resolved_ciudad_id') {
                updated[index].errors = updated[index].errors.filter(e => e.field !== 'cuenta_ciudad');
            }
            return updated;
        });
    }, []);

    // ── Toggle row ──
    const toggleRow = useCallback((index: number) => {
        setValidations(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], enabled: !updated[index].enabled };
            return updated;
        });
    }, []);

    const handleDownloadTemplate = useCallback(() => {
        downloadCSV('plantilla_cuentas_contactos.csv', generateTemplateCSV());
    }, []);

    const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);
        setResult(null);
        setIsLoadingCatalogs(true);

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const text = evt.target?.result as string;
            const { rows, missingColumns: mc } = parseCSV(text);
            setMissingColumns(mc);

            if (rows.length === 0) {
                alert('El archivo CSV no contiene filas válidas.');
                setIsLoadingCatalogs(false);
                return;
            }

            // Fetch catalogs for validation
            const cat = await fetchCatalogs();
            setCatalog(cat);

            const vals = runValidation(rows, cat);
            setParsedRows(rows);
            setValidations(vals);
            setWizardStep(0);
            setWizardOpen(true);
            setIsLoadingCatalogs(false);
        };
        reader.readAsText(file, 'UTF-8');
        if (fileRef.current) fileRef.current.value = '';
    }, [fetchCatalogs, runValidation]);

    const handleUpload = useCallback(async () => {
        setIsUploading(true);
        setProgress(10);
        setWizardStep(2);

        // Build payload: only enabled rows, inject resolved IDs
        const payload = parsedRows
            .map((row, i) => ({ row, val: validations[i] }))
            .filter(({ val }) => val.enabled)
            .map(({ row, val }) => ({
                ...row,
                cuenta_canal: val.resolved_canal || row.cuenta_canal || 'DIST_NAC',
                // The API still does close-match, but we override with resolved values
                _resolved_pais_id: val.resolved_pais_id,
                _resolved_depto_id: val.resolved_depto_id,
                _resolved_ciudad_id: val.resolved_ciudad_id,
            }));

        try {
            setProgress(30);
            const res = await fetch('/api/bulk-accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows: payload }),
            });
            setProgress(90);
            const data = await res.json();
            setResult(res.ok ? data : { success: false, createdAccounts: 0, createdContacts: 0, errors: [data.error || 'Error desconocido'] });
            setProgress(100);
        } catch (err: any) {
            setResult({ success: false, createdAccounts: 0, createdContacts: 0, errors: [err.message] });
        } finally {
            setIsUploading(false);
        }
    }, [parsedRows, validations]);

    const closeWizard = useCallback(() => {
        setWizardOpen(false);
        setParsedRows([]);
        setValidations([]);
        setResult(null);
        setProgress(0);
        setFileName('');
        setMissingColumns([]);
    }, []);

    // ── Stats ──
    const enabledRows = validations.filter(v => v.enabled);
    const errorCount = enabledRows.reduce((s, v) => s + v.errors.filter(e => e.type === 'error').length, 0);
    const warningCount = enabledRows.reduce((s, v) => s + v.errors.filter(e => e.type === 'warning').length, 0);
    const duplicateCount = enabledRows.reduce((s, v) => s + v.errors.filter(e => e.type === 'duplicate').length, 0);
    const accountCount = enabledRows.length;
    const contactCount = parsedRows.filter((r, i) => validations[i]?.enabled && r.contacto_nombre?.trim()).length;
    const hasBlockingErrors = enabledRows.some(v => v.errors.some(e => e.type === 'error' && e.field === 'cuenta_nombre'));

    // ── Render ────────────────────────────
    return (
        <>
            {/* Card */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-6">
                <div className="flex items-center gap-2">
                    <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
                        <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 text-lg">Carga Masiva de Cuentas</h3>
                        <p className="text-sm text-slate-500">Crea múltiples cuentas y contactos desde un archivo CSV.</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                    <button
                        onClick={handleDownloadTemplate}
                        className="flex items-center justify-center gap-2 px-5 py-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        Descargar Plantilla CSV
                    </button>

                    <div className="flex-1">
                        <input ref={fileRef} type="file" accept=".csv" className="hidden" id="bulk-account-upload" onChange={handleFileSelect} />
                        <label
                            htmlFor="bulk-account-upload"
                            className={cn(
                                "flex items-center justify-center gap-2 w-full px-5 py-3 border-2 border-dashed rounded-xl text-sm font-bold cursor-pointer transition-colors",
                                isLoadingCatalogs
                                    ? "bg-blue-50 border-blue-200 text-blue-600"
                                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                            )}
                        >
                            {isLoadingCatalogs ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Validando datos...</>
                            ) : (
                                <><Upload className="w-4 h-4" /> {fileName || 'Seleccionar archivo CSV'}</>
                            )}
                        </label>
                    </div>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <p className="text-xs font-bold text-blue-800 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Instrucciones
                    </p>
                    <p className="text-xs text-blue-700 leading-relaxed">
                        1. Descarga la plantilla CSV. 2. Llena los datos (un contacto por fila de cuenta).
                        3. Para <strong>país, departamento y ciudad</strong>, escribe el nombre completo.
                        4. Canales válidos: <code>DIST_NAC</code>, <code>DIST_INT</code>, <code>OBRAS_NAC</code>, <code>OBRAS_INT</code>, <code>PROPIO</code>.
                        5. El wizard te mostrará errores y te dejará corregirlos antes de cargar.
                    </p>
                </div>
            </div>

            {/* ── Wizard Modal ──────────────────── */}
            {wizardOpen && (
                <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
                                    <FileSpreadsheet className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">Carga Masiva de Cuentas</h2>
                                    <p className="text-xs text-slate-500">{fileName} — {parsedRows.length} filas</p>
                                </div>
                            </div>
                            <button onClick={closeWizard} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        {/* Steps */}
                        <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-50 border-b border-slate-100 shrink-0">
                            {['Validación y Edición', 'Confirmación', 'Resultado'].map((label, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <div className={cn(
                                        "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                                        wizardStep === idx ? "bg-emerald-600 text-white" :
                                            wizardStep > idx ? "bg-emerald-100 text-emerald-600" :
                                                "bg-slate-200 text-slate-500"
                                    )}>
                                        {wizardStep > idx ? '✓' : idx + 1}
                                    </div>
                                    <span className={cn("text-xs font-medium hidden sm:inline", wizardStep === idx ? "text-slate-900" : "text-slate-400")}>{label}</span>
                                    {idx < 2 && <ChevronRight className="w-3 h-3 text-slate-300" />}
                                </div>
                            ))}
                        </div>

                        {/* Missing columns alert */}
                        {missingColumns.length > 0 && wizardStep === 0 && (
                            <div className="mx-5 mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2 shrink-0">
                                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-amber-800">Columnas faltantes en el CSV:</p>
                                    <p className="text-[11px] text-amber-700 mt-0.5">{missingColumns.join(', ')}</p>
                                    <p className="text-[10px] text-amber-600 mt-1">Estas columnas se establecerán como vacías. Puedes editar los valores directamente en la tabla.</p>
                                </div>
                            </div>
                        )}

                        {/* Stats bar */}
                        {wizardStep === 0 && (
                            <div className="flex items-center gap-3 px-5 py-2.5 flex-wrap shrink-0">
                                <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-[10px] font-bold">{accountCount} cuentas</span>
                                <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-[10px] font-bold">{contactCount} contactos</span>
                                {errorCount > 0 && <span className="bg-red-50 text-red-700 px-2.5 py-1 rounded-full text-[10px] font-bold">{errorCount} errores</span>}
                                {warningCount > 0 && <span className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full text-[10px] font-bold">{warningCount} advertencias</span>}
                                {duplicateCount > 0 && <span className="bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full text-[10px] font-bold">{duplicateCount} duplicados</span>}
                                <span className="text-[10px] text-slate-400">
                                    {validations.filter(v => !v.enabled).length} filas deshabilitadas
                                </span>
                            </div>
                        )}

                        {/* Body */}
                        <div className="flex-1 overflow-auto">
                            {/* Step 0: Validation Table */}
                            {wizardStep === 0 && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-[11px]">
                                        <thead className="bg-slate-50 text-slate-400 uppercase text-[9px] font-bold sticky top-0 z-10">
                                            <tr>
                                                <th className="px-2 py-2.5 text-center w-8">On</th>
                                                <th className="px-2 py-2.5 text-left">#</th>
                                                <th className="px-2 py-2.5 text-left min-w-[140px]">Cuenta</th>
                                                <th className="px-2 py-2.5 text-left min-w-[90px]">NIT</th>
                                                <th className="px-2 py-2.5 text-left min-w-[100px]">Canal</th>
                                                <th className="px-2 py-2.5 text-left min-w-[100px]">País</th>
                                                <th className="px-2 py-2.5 text-left min-w-[110px]">Departamento</th>
                                                <th className="px-2 py-2.5 text-left min-w-[100px]">Ciudad</th>
                                                <th className="px-2 py-2.5 text-left min-w-[110px]">Email</th>
                                                <th className="px-2 py-2.5 text-left min-w-[90px]">Teléfono</th>
                                                <th className="px-2 py-2.5 text-left border-l-2 border-blue-200 min-w-[110px]">Contacto</th>
                                                <th className="px-2 py-2.5 text-left min-w-[80px]">Cargo</th>
                                                <th className="px-2 py-2.5 text-left min-w-[130px]">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {parsedRows.map((row, i) => {
                                                const val = validations[i];
                                                if (!val) return null;
                                                const hasErrors = val.errors.filter(e => e.type === 'error').length > 0;
                                                const hasDupes = val.errors.filter(e => e.type === 'duplicate').length > 0;
                                                const hasWarnings = val.errors.filter(e => e.type === 'warning').length > 0;

                                                return (
                                                    <tr key={i} className={cn(
                                                        "group transition-colors",
                                                        !val.enabled ? "opacity-40 bg-slate-50" :
                                                            hasErrors ? "bg-red-50/40" :
                                                                hasDupes ? "bg-purple-50/30" :
                                                                    hasWarnings ? "bg-amber-50/30" :
                                                                        "hover:bg-slate-50/50"
                                                    )}>
                                                        {/* Toggle */}
                                                        <td className="px-2 py-1.5 text-center">
                                                            <button onClick={() => toggleRow(i)} className="text-slate-400 hover:text-slate-600">
                                                                {val.enabled
                                                                    ? <ToggleRight className="w-5 h-5 text-emerald-500" />
                                                                    : <ToggleLeft className="w-5 h-5" />}
                                                            </button>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-slate-400 font-mono">{i + 1}</td>
                                                        {/* Cuenta nombre */}
                                                        <td className="px-2 py-1.5">
                                                            <EditableCell value={row.cuenta_nombre} onChange={v => updateRow(i, 'cuenta_nombre', v)} className="font-bold text-slate-900" placeholder="Nombre cuenta" />
                                                            {hasDupes && val.duplicate_accounts.length > 0 && (
                                                                <div className="mt-0.5">
                                                                    <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 w-fit">
                                                                        <Copy className="w-2.5 h-2.5" /> Duplicado: {val.duplicate_accounts[0].nombre}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </td>
                                                        {/* NIT */}
                                                        <td className="px-2 py-1.5">
                                                            <EditableCell value={row.cuenta_nit} onChange={v => updateRow(i, 'cuenta_nit', v)} className="font-mono text-slate-600" placeholder="NIT" />
                                                        </td>
                                                        {/* Canal */}
                                                        <td className="px-2 py-1.5">
                                                            {val.resolved_canal ? (
                                                                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold">{val.resolved_canal}</span>
                                                            ) : (
                                                                <SuggestionSelect
                                                                    options={CANAL_OPTIONS.map(c => ({ id: c.id, nombre: `${c.id} (${c.label})` }))}
                                                                    value={null}
                                                                    onSelect={(v: string) => overrideResolution(i, 'resolved_canal', v)}
                                                                    label="Canal"
                                                                />
                                                            )}
                                                        </td>
                                                        {/* País */}
                                                        <td className="px-2 py-1.5">
                                                            {val.resolved_pais_id ? (
                                                                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold">
                                                                    {catalog?.paises.find(p => p.id === val.resolved_pais_id)?.nombre || `ID:${val.resolved_pais_id}`}
                                                                </span>
                                                            ) : row.cuenta_pais ? (
                                                                <SuggestionSelect
                                                                    options={val.pais_suggestions.length > 0 ? val.pais_suggestions : (catalog?.paises || [])}
                                                                    value={null}
                                                                    onSelect={(v: number) => overrideResolution(i, 'resolved_pais_id', v)}
                                                                    label="País"
                                                                />
                                                            ) : (
                                                                <EditableCell value="" onChange={v => updateRow(i, 'cuenta_pais', v)} placeholder="País" />
                                                            )}
                                                        </td>
                                                        {/* Departamento */}
                                                        <td className="px-2 py-1.5">
                                                            {val.resolved_depto_id ? (
                                                                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold">
                                                                    {catalog?.departamentos.find(d => d.id === val.resolved_depto_id)?.nombre || `ID:${val.resolved_depto_id}`}
                                                                </span>
                                                            ) : row.cuenta_departamento ? (
                                                                <SuggestionSelect
                                                                    options={val.depto_suggestions.length > 0 ? val.depto_suggestions :
                                                                        (catalog?.departamentos.filter(d => !val.resolved_pais_id || d.pais_id === val.resolved_pais_id) || [])}
                                                                    value={null}
                                                                    onSelect={(v: number) => overrideResolution(i, 'resolved_depto_id', v)}
                                                                    label="Depto"
                                                                />
                                                            ) : (
                                                                <EditableCell value="" onChange={v => updateRow(i, 'cuenta_departamento', v)} placeholder="Depto" />
                                                            )}
                                                        </td>
                                                        {/* Ciudad */}
                                                        <td className="px-2 py-1.5">
                                                            {val.resolved_ciudad_id ? (
                                                                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold">
                                                                    {catalog?.ciudades.find(c => c.id === val.resolved_ciudad_id)?.nombre || `ID:${val.resolved_ciudad_id}`}
                                                                </span>
                                                            ) : row.cuenta_ciudad ? (
                                                                <SuggestionSelect
                                                                    options={val.ciudad_suggestions.length > 0 ? val.ciudad_suggestions :
                                                                        (catalog?.ciudades.filter(c => !val.resolved_depto_id || c.departamento_id === val.resolved_depto_id) || [])}
                                                                    value={null}
                                                                    onSelect={(v: number) => overrideResolution(i, 'resolved_ciudad_id', v)}
                                                                    label="Ciudad"
                                                                />
                                                            ) : (
                                                                <EditableCell value="" onChange={v => updateRow(i, 'cuenta_ciudad', v)} placeholder="Ciudad" />
                                                            )}
                                                        </td>
                                                        {/* Email */}
                                                        <td className="px-2 py-1.5">
                                                            <EditableCell value={row.cuenta_email} onChange={v => updateRow(i, 'cuenta_email', v)} placeholder="Email" />
                                                        </td>
                                                        {/* Teléfono */}
                                                        <td className="px-2 py-1.5">
                                                            <EditableCell value={row.cuenta_telefono} onChange={v => updateRow(i, 'cuenta_telefono', v)} placeholder="Teléfono" />
                                                        </td>
                                                        {/* Contacto */}
                                                        <td className="px-2 py-1.5 border-l-2 border-blue-100">
                                                            <EditableCell value={row.contacto_nombre} onChange={v => updateRow(i, 'contacto_nombre', v)} className="text-blue-900 font-medium" placeholder="Contacto" />
                                                            {val.duplicate_contacts.length > 0 && (
                                                                <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold mt-0.5 block w-fit">
                                                                    <Copy className="w-2.5 h-2.5 inline mr-0.5" /> Email ya existe
                                                                </span>
                                                            )}
                                                        </td>
                                                        {/* Cargo */}
                                                        <td className="px-2 py-1.5">
                                                            <EditableCell value={row.contacto_cargo} onChange={v => updateRow(i, 'contacto_cargo', v)} placeholder="Cargo" />
                                                        </td>
                                                        {/* Status */}
                                                        <td className="px-2 py-1.5">
                                                            {val.errors.length === 0 ? (
                                                                <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold">
                                                                    <CheckCircle className="w-3.5 h-3.5" /> OK
                                                                </span>
                                                            ) : (
                                                                <div className="space-y-0.5">
                                                                    {val.errors.map((e, ei) => (
                                                                        <span key={ei} className={cn(
                                                                            "text-[9px] px-1.5 py-0.5 rounded font-bold block",
                                                                            e.type === 'error' ? "bg-red-100 text-red-700" :
                                                                                e.type === 'duplicate' ? "bg-purple-100 text-purple-700" :
                                                                                    "bg-amber-100 text-amber-700"
                                                                        )}>
                                                                            {e.message}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Step 1: Confirmation */}
                            {wizardStep === 1 && (
                                <div className="space-y-6 max-w-lg mx-auto text-center py-8 px-6">
                                    <div className="bg-emerald-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto">
                                        <Rocket className="w-8 h-8 text-emerald-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900 mb-2">¿Confirmar Carga?</h3>
                                        <p className="text-slate-500">
                                            Se crearán <strong className="text-emerald-700">{accountCount} cuentas</strong> y{' '}
                                            <strong className="text-blue-700">{contactCount} contactos</strong>.
                                        </p>
                                    </div>

                                    <div className="bg-slate-50 rounded-xl p-4 text-left space-y-2">
                                        <p className="text-xs font-bold text-slate-500 uppercase">Resumen</p>
                                        <div className="flex justify-between text-sm"><span className="text-slate-600">Cuentas a crear</span><span className="font-bold text-slate-900">{accountCount}</span></div>
                                        <div className="flex justify-between text-sm"><span className="text-slate-600">Contactos a crear</span><span className="font-bold text-slate-900">{contactCount}</span></div>
                                        <div className="flex justify-between text-sm"><span className="text-slate-600">Filas omitidas</span><span className="font-bold text-slate-500">{validations.filter(v => !v.enabled).length}</span></div>
                                        <div className="flex justify-between text-sm"><span className="text-slate-600">Advertencias</span><span className={cn("font-bold", warningCount > 0 ? "text-amber-600" : "text-emerald-600")}>{warningCount}</span></div>
                                        <div className="flex justify-between text-sm"><span className="text-slate-600">Duplicados marcados</span><span className={cn("font-bold", duplicateCount > 0 ? "text-purple-600" : "text-emerald-600")}>{duplicateCount}</span></div>
                                    </div>

                                    {hasBlockingErrors && (
                                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2 text-left">
                                            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                                            <p className="text-xs text-red-700">Hay filas con nombre vacío que serán omitidas automáticamente por el servidor.</p>
                                        </div>
                                    )}

                                    {duplicateCount > 0 && (
                                        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-start gap-2 text-left">
                                            <Copy className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                                            <p className="text-xs text-purple-700">Hay {duplicateCount} posibles duplicados. Si no los deshabilitaste, se crearán igualmente.</p>
                                        </div>
                                    )}

                                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2 text-left">
                                        <MapPin className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                                        <p className="text-xs text-blue-700">Los territorios resueltos se usarán como IDs directos.</p>
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Result */}
                            {wizardStep === 2 && (
                                <div className="space-y-6 max-w-lg mx-auto text-center py-8 px-6">
                                    {isUploading ? (
                                        <div className="space-y-4">
                                            <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mx-auto" />
                                            <p className="text-slate-700 font-bold">Cargando datos...</p>
                                            <div className="w-full bg-slate-200 rounded-full h-2.5">
                                                <div className="bg-emerald-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                                            </div>
                                            <p className="text-xs text-slate-400">{progress}% completado</p>
                                        </div>
                                    ) : result ? (
                                        <div className="space-y-6">
                                            {result.createdAccounts > 0 ? (
                                                <><CheckCircle className="w-16 h-16 text-emerald-500 mx-auto" />
                                                    <h3 className="text-xl font-bold text-emerald-700">¡Carga Completada!</h3></>
                                            ) : (
                                                <><AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
                                                    <h3 className="text-xl font-bold text-red-700">Error en la Carga</h3></>
                                            )}
                                            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-left">
                                                <div className="flex justify-between text-sm"><span className="text-slate-600">Cuentas creadas</span><span className="font-bold text-emerald-700">{result.createdAccounts}</span></div>
                                                <div className="flex justify-between text-sm"><span className="text-slate-600">Contactos creados</span><span className="font-bold text-blue-700">{result.createdContacts}</span></div>
                                            </div>
                                            {result.errors.length > 0 && (
                                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-left max-h-48 overflow-y-auto">
                                                    <p className="text-xs font-bold text-red-800 mb-2">Errores ({result.errors.length})</p>
                                                    <ul className="space-y-1 text-[11px] text-red-700">
                                                        {result.errors.map((e, idx) => <li key={idx} className="flex gap-1"><span className="text-red-400">•</span>{e}</li>)}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between p-5 border-t border-slate-100 bg-slate-50/50 shrink-0">
                            <div>
                                {wizardStep === 0 && <button onClick={closeWizard} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors">Cancelar</button>}
                                {wizardStep === 1 && <button onClick={() => setWizardStep(0)} className="flex items-center gap-1 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors"><ChevronLeft className="w-4 h-4" /> Volver a editar</button>}
                            </div>
                            <div>
                                {wizardStep === 0 && (
                                    <button onClick={() => setWizardStep(1)} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-100 transition-all">
                                        Continuar <ChevronRight className="w-4 h-4" />
                                    </button>
                                )}
                                {wizardStep === 1 && (
                                    <button onClick={handleUpload} disabled={isUploading} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-100 transition-all">
                                        <Rocket className="w-4 h-4" /> Cargar Datos
                                    </button>
                                )}
                                {wizardStep === 2 && !isUploading && (
                                    <button onClick={closeWizard} className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-bold shadow-md transition-all">Cerrar</button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
