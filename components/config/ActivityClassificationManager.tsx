import { useState } from 'react';
import { useActivityClassifications, ActivityClassification } from '@/lib/hooks/useActivityClassifications';
import { Plus, Trash2, ChevronRight, ChevronDown, List, CheckCircle2, AlertCircle, Calendar, CheckSquare } from 'lucide-react';
import { cn } from '@/components/ui/utils';
import { syncEngine } from '@/lib/sync';

export function ActivityClassificationManager() {
    const {
        classifications,
        subclassifications,
        loading,
        error,
        createClassification,
        deleteClassification,
        createSubclassification,
        deleteSubclassification
    } = useActivityClassifications();

    const [newClsName, setNewClsName] = useState('');
    const [selectedType, setSelectedType] = useState<'EVENTO' | 'TAREA'>('EVENTO');
    const [expandedCls, setExpandedCls] = useState<number | null>(null);
    const [newSubName, setNewSubName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (loading) return <div className="p-8 text-center text-slate-500">Cargando clasificaciones...</div>;
    if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;

    const handleCreateCls = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newClsName.trim()) return;

        setIsSubmitting(true);
        const { error } = await createClassification(newClsName.trim(), selectedType);
        setIsSubmitting(false);

        if (!error) {
            setNewClsName('');
            // Trigger background sync to update local Dexie for immediate usage
            syncEngine.triggerSync();
        } else {
            alert('Error al crear clasificación: ' + error);
        }
    };

    const handleCreateSub = async (e: React.FormEvent, clsId: number) => {
        e.preventDefault();
        if (!newSubName.trim()) return;

        setIsSubmitting(true);
        const { error } = await createSubclassification(newSubName.trim(), clsId);
        setIsSubmitting(false);

        if (!error) {
            setNewSubName('');
            syncEngine.triggerSync();
        } else {
            alert('Error al crear sub-clasificación: ' + error);
        }
    };

    const handleDeleteCls = async (id: number) => {
        if (!confirm('¿Estás seguro? Se eliminarán también todas las sub-clasificaciones asociadas.')) return;
        await deleteClassification(id);
        syncEngine.triggerSync();
    };

    const handleDeleteSub = async (id: number) => {
        if (!confirm('¿Estás seguro de eliminar esta sub-clasificación?')) return;
        await deleteSubclassification(id);
        syncEngine.triggerSync();
    };

    const filteredClassifications = classifications.filter(c => c.tipo_actividad === selectedType);

    return (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                    <List className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-900 text-lg">Clasificación de Actividades</h3>
                    <p className="text-sm text-slate-500">Gestiona tipos de eventos y tareas</p>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar / Tabs */}
                <div className="w-48 bg-slate-50 border-r border-slate-100 p-4 space-y-2">
                    <button
                        onClick={() => { setSelectedType('EVENTO'); setExpandedCls(null); }}
                        className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                            selectedType === 'EVENTO'
                                ? "bg-white text-blue-600 shadow-sm border border-slate-100"
                                : "text-slate-500 hover:bg-white hover:text-slate-700"
                        )}
                    >
                        <Calendar className="w-4 h-4" />
                        Eventos
                    </button>
                    <button
                        onClick={() => { setSelectedType('TAREA'); setExpandedCls(null); }}
                        className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                            selectedType === 'TAREA'
                                ? "bg-white text-emerald-600 shadow-sm border border-slate-100"
                                : "text-slate-500 hover:bg-white hover:text-slate-700"
                        )}
                    >
                        <CheckSquare className="w-4 h-4" />
                        Tareas
                    </button>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* List */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {filteredClassifications.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 text-sm">
                                No hay clasificaciones de {selectedType.toLowerCase()} registradas.
                            </div>
                        ) : (
                            filteredClassifications.map(cls => (
                                <div key={cls.id} className="border border-slate-200 rounded-xl overflow-hidden transition-all hover:shadow-sm">
                                    <div
                                        className={cn(
                                            "flex items-center justify-between p-4 cursor-pointer select-none",
                                            expandedCls === cls.id ? "bg-slate-50" : "bg-white"
                                        )}
                                        onClick={() => setExpandedCls(expandedCls === cls.id ? null : cls.id)}
                                    >
                                        <div className="flex items-center gap-3">
                                            {expandedCls === cls.id ? (
                                                <ChevronDown className="w-4 h-4 text-slate-400" />
                                            ) : (
                                                <ChevronRight className="w-4 h-4 text-slate-400" />
                                            )}
                                            <span className="font-bold text-slate-700">{cls.nombre}</span>
                                            <span className="text-xs text-slate-400 font-mono">ID: {cls.id}</span>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteCls(cls.id); }}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Eliminar clasificación"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Subclassifications */}
                                    {expandedCls === cls.id && (
                                        <div className="bg-slate-50 border-t border-slate-200 p-4 pl-11 space-y-3">
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                                Causales / Sub-clasificaciones
                                            </p>

                                            <div className="space-y-2">
                                                {subclassifications
                                                    .filter(s => s.clasificacion_id === cls.id)
                                                    .map(sub => (
                                                        <div key={sub.id} className="flex items-center justify-between group bg-white p-2 rounded-lg border border-slate-100">
                                                            <span className="text-sm text-slate-600 font-medium pl-2 border-l-2 border-slate-200">
                                                                {sub.nombre}
                                                            </span>
                                                            <button
                                                                onClick={() => handleDeleteSub(sub.id)}
                                                                className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    ))
                                                }
                                                {subclassifications.filter(s => s.clasificacion_id === cls.id).length === 0 && (
                                                    <p className="text-xs text-slate-400 italic">Sin sub-clasificaciones</p>
                                                )}
                                            </div>

                                            {/* Add Subclassification */}
                                            <form onSubmit={(e) => handleCreateSub(e, cls.id)} className="flex gap-2 mt-3 pt-3 border-t border-slate-200/50">
                                                <input
                                                    type="text"
                                                    value={newSubName}
                                                    onChange={(e) => setNewSubName(e.target.value)}
                                                    placeholder="Nueva sub-clasificación..."
                                                    className="flex-1 text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-400"
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={isSubmitting || !newSubName.trim()}
                                                    className="px-3 py-2 bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                            </form>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer: Add Classification */}
                    <div className="p-4 border-t border-slate-100 bg-slate-50/80">
                        <form onSubmit={handleCreateCls} className="flex gap-3">
                            <input
                                type="text"
                                value={newClsName}
                                onChange={(e) => setNewClsName(e.target.value)}
                                placeholder={`Nueva clasificación de ${selectedType.toLowerCase()}...`}
                                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all"
                            />
                            <button
                                type="submit"
                                disabled={isSubmitting || !newClsName.trim()}
                                className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-lg shadow-slate-200 flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Agregar
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
