"use client";

import { usePedidos } from "@/lib/hooks/usePedidos";
import { LocalQuote, db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Edit2, AlertCircle, Trash2, Info, Receipt, Calendar, Truck, Send } from "lucide-react";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { cn } from "@/components/ui/utils";

export function PedidosList({ quote, onEditStateChange }: { quote: LocalQuote, onEditStateChange?: (isEditing: boolean) => void }) {
    const { pedidosCollection, deletePedido, updatePedido } = usePedidos(quote.id);
    const [isCreating, setIsCreating] = useState(false);
    const [editingUuid, setEditingUuid] = useState<string | null>(null);

    const quoteItems = useLiveQuery(() => db.quoteItems.where('cotizacion_id').equals(quote.id).toArray(), [quote.id]);
    const opp = useLiveQuery(() => db.opportunities.get(quote.opportunity_id), [quote.opportunity_id]);

    // Sync with parent if needed
    const isEditing = isCreating || !!editingUuid;
    useEffect(() => {
        onEditStateChange?.(isEditing);
    }, [isEditing, onEditStateChange]);

    if (!pedidosCollection || !quoteItems) return <div>Cargando pedidos...</div>;

    const isWinner = opp?.status === 'WINNER' || quote.status === 'WINNER';

    if (isCreating || editingUuid) {
        return (
            <PedidoEditorForm 
                quote={quote} 
                pedidoUuid={editingUuid}
                onClose={() => {
                    setIsCreating(false);
                    setEditingUuid(null);
                }} 
            />
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border shadow-sm">
                <div>
                    <h3 className="font-bold text-lg text-slate-800">Pedidos Vinculados</h3>
                    <p className="text-sm text-slate-500">Maneja múltiples pedidos facturables para esta cotización.</p>
                </div>
                <button
                    onClick={() => setIsCreating(true)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                    <Plus className="w-4 h-4" /> Nuevo Pedido Parcial
                </button>
            </div>

            {!isWinner && (
                <div className="bg-amber-50 text-amber-800 p-4 rounded-lg flex items-start gap-3 border border-amber-200">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold text-sm">Oportunidad no ganada</p>
                        <p className="text-sm opacity-90">Puedes generar borradores/planes de pedidos, pero no podrás emitirlos a SAP hasta confirmar la oportunidad como Ganadora.</p>
                    </div>
                </div>
            )}

            {pedidosCollection.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <Truck className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    <p className="text-slate-500">Aún no hay pedidos parciales creados.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {pedidosCollection.map(ped => (
                        <div key={ped.uuid_generado} className="bg-white p-5 rounded-xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-bold text-slate-900 border px-2 py-1 bg-slate-100 rounded text-xs">{ped.salesOrderNumber || 'PED-BORRADOR'}</span>
                                    <span className={cn(
                                        "text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded",
                                        ped.estado_pedido === 'PLANEADO' ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"
                                    )}>
                                        {ped.estado_pedido}
                                    </span>
                                </div>
                                <div className="text-sm text-slate-500 font-medium">
                                    {ped.items?.length || 0} ítems vinculados
                                </div>
                            </div>

                            {/* Detalle solicitado por el usuario */}
                            <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-2 border-l pl-6 ml-2">
                                <div className="col-span-2 space-y-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Productos y Cantidades</p>
                                    <div className="flex flex-wrap gap-2">
                                        {ped.items?.map(item => {
                                            const qItem = quoteItems.find(qi => qi.producto_id === item.producto_id);
                                            return (
                                                <div key={item.id} className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg text-xs">
                                                    <span className="font-bold text-slate-700 truncate max-w-[150px]" title={qItem?.descripcion_linea}>
                                                        {qItem?.descripcion_linea || 'Producto'}
                                                    </span>
                                                    <span className="bg-blue-100 text-blue-700 px-1.5 rounded font-black">x{item.cantidad}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fecha Facturación</p>
                                    <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                        {ped.fecha_facturacion || 'Sin fecha'}
                                    </p>
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo Facturación</p>
                                    <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                                        <Receipt className="w-3.5 h-3.5 text-slate-400" />
                                        {ped.tipo_facturacion || 'No definido'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setEditingUuid(ped.uuid_generado!)}
                                    className="p-2 border rounded hover:bg-slate-50 text-slate-700 tooltip"
                                    title="Editar Pedido"
                                    disabled={ped.estado_pedido !== 'PLANEADO'}
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                {isWinner && ped.estado_pedido === 'PLANEADO' && (
                                    <button
                                        onClick={async () => {
                                            if (confirm("¿Confirmar envío de este pedido a SAP?")) {
                                                await updatePedido(ped.uuid_generado!, { estado_pedido: 'ENVIADO_SAP' });
                                                alert("Pedido marcado para envío a SAP.");
                                            }
                                        }}
                                        className="flex items-center gap-2 p-2 border rounded border-green-200 text-green-700 hover:bg-green-50 transition-colors"
                                        title="Enviar a SAP"
                                    >
                                        <Send className="w-4 h-4" />
                                        <span className="text-sm font-medium">Lanzar</span>
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        if (confirm("¿Seguro que deseas eliminar este pedido parcial?")) {
                                            deletePedido(ped.uuid_generado!);
                                        }
                                    }}
                                    className="p-2 border rounded hover:bg-red-50 text-red-600 tooltip"
                                    title="Eliminar Pedido"
                                    disabled={ped.estado_pedido !== 'PLANEADO'}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}


function PedidoEditorForm({ quote, pedidoUuid, onClose }: { quote: LocalQuote, pedidoUuid: string | null, onClose: () => void }) {
    const { createPedido, updatePedido, updatePedidoItems } = usePedidos(quote.id);
    const ped = useLiveQuery(async () => {
        if (!pedidoUuid) return null;
        return db.pedidos.get(pedidoUuid);
    }, [pedidoUuid]);
    
    // Obtenemos los items de la cotización para saber qué podemos pedir
    const quoteItems = useLiveQuery(() => db.quoteItems.where('cotizacion_id').equals(quote.id).toArray(), [quote.id]);
    
    // Obtenemos qué cantidades ya han sido consumidas por OTROS pedidos de esta misma coti
    const consumosGlobales = useLiveQuery(async () => {
        const todosLosPedidos = await db.pedidos.where('cotizacion_id').equals(quote.id).toArray();
        const historialConsumo: Record<string, number> = {};
        
        for (const p of todosLosPedidos) {
            // Saltamos el pedido actual que estamos editando para que devuelva sus propias cantidades al "disponible"
            if (p.uuid_generado === pedidoUuid) continue; 
            const pItems = await db.pedidoItems.where('pedido_uuid').equals(p.uuid_generado).toArray();
            for (const pi of pItems) {
                historialConsumo[pi.producto_id] = (historialConsumo[pi.producto_id] || 0) + Number(pi.cantidad);
            }
        }
        return historialConsumo;
    }, [quote.id, pedidoUuid]);

    // Items actualmente guardados en el pedido que se está editando
    const itemsEnPedido = useLiveQuery(async () => {
        if (!pedidoUuid) return {};
        const pItems = await db.pedidoItems.where('pedido_uuid').equals(pedidoUuid).toArray();
        const mapa: Record<string, number> = {};
        pItems.forEach(pi => mapa[pi.producto_id] = Number(pi.cantidad));
        return mapa;
    }, [pedidoUuid]);


    const { register, handleSubmit, watch, setValue } = useForm({
        defaultValues: {
            fecha_facturacion: ped?.fecha_facturacion || "",
            tipo_facturacion: ped?.tipo_facturacion || "",
            orden_compra: ped?.orden_compra || "",
            incoterm: ped?.incoterm || "",
            notas_sap: ped?.notas_sap || "",
            cliente_final: ped?.cliente_final || "",
            email_contacto: ped?.email_contacto || "",
            contacto_ventas: ped?.contacto_ventas || "",
            contacto_logistico: ped?.contacto_logistico || "",
            contacto_tesoreria: ped?.contacto_tesoreria || "",
            dir_envio_factura_tipo: ped?.dir_envio_factura_tipo || "",
            servicio_subida_hidromasaje: ped?.servicio_subida_hidromasaje || false,
            piso_entrega: ped?.piso_entrega || "",
            tiene_escaleras: ped?.tiene_escaleras || false,
            planos_hidromasaje: ped?.planos_hidromasaje || "",
            fecha_entrega: ped?.fecha_entrega || "",
            nit_cliente_final: ped?.nit_cliente_final || "",
            entrega_en_obra: ped?.entrega_en_obra || false,
            bodega_externa: ped?.bodega_externa || false,
            bodega_firplak: ped?.bodega_firplak || false,
            // Add custom items structure for the form
            selected_quantities: {} as Record<string, number>
        }
    });

    // Populate logistic fields when 'ped' is loaded from local DB
    useEffect(() => {
        if (ped) {
            setValue('fecha_facturacion', ped.fecha_facturacion || "");
            setValue('tipo_facturacion', ped.tipo_facturacion || "");
            setValue('orden_compra', ped.orden_compra || "");
            setValue('incoterm', ped.incoterm || "");
            setValue('notas_sap', ped.notas_sap || "");
            setValue('cliente_final', ped.cliente_final || "");
            setValue('email_contacto', ped.email_contacto || "");
            setValue('contacto_ventas', ped.contacto_ventas || "");
            setValue('contacto_logistico', ped.contacto_logistico || "");
            setValue('contacto_tesoreria', ped.contacto_tesoreria || "");
            setValue('dir_envio_factura_tipo', ped.dir_envio_factura_tipo || "");
            setValue('servicio_subida_hidromasaje', ped.servicio_subida_hidromasaje || false);
            setValue('piso_entrega', ped.piso_entrega || "");
            setValue('tiene_escaleras', ped.tiene_escaleras || false);
            setValue('planos_hidromasaje', ped.planos_hidromasaje || "");
            setValue('fecha_entrega', ped.fecha_entrega || "");
            setValue('nit_cliente_final', ped.nit_cliente_final || "");
            setValue('entrega_en_obra', ped.entrega_en_obra || false);
            setValue('bodega_externa', ped.bodega_externa || false);
            setValue('bodega_firplak', ped.bodega_firplak || false);
        }
    }, [ped, setValue]);

    // Populate default quantities for edition based on itemsEnPedido
    useEffect(() => {
        if (itemsEnPedido && Object.keys(itemsEnPedido).length > 0) {
            setValue('selected_quantities', itemsEnPedido);
        }
    }, [itemsEnPedido, setValue]);

    const quantities = watch('selected_quantities');

    if (!quoteItems || !consumosGlobales) return <div>Cargando...</div>;

    const onSubmit = async (data: any) => {
        // Build items to save
        const itemsToSave = [];
        for (const qItem of quoteItems) {
            const qty = Number(data.selected_quantities[qItem.producto_id] || 0);
            if (qty > 0) {
                itemsToSave.push({
                    producto_id: qItem.producto_id,
                    cantidad: qty,
                    precio_unitario: qItem.precio_unitario,
                    descuento: qItem.discount_pct || 0
                });
            }
        }

        if (itemsToSave.length === 0) {
            alert("Debes añadir al menos una cantidad válida a alguno de los productos.");
            return;
        }

        const pedData = {
            fecha_facturacion: data.fecha_facturacion,
            tipo_facturacion: data.tipo_facturacion,
            orden_compra: data.orden_compra,
            incoterm: data.incoterm,
            notas_sap: data.notas_sap,
            cliente_final: data.cliente_final,
            email_contacto: data.email_contacto,
            contacto_ventas: data.contacto_ventas,
            contacto_logistico: data.contacto_logistico,
            contacto_tesoreria: data.contacto_tesoreria,
            dir_envio_factura_tipo: data.dir_envio_factura_tipo,
            servicio_subida_hidromasaje: data.servicio_subida_hidromasaje,
            piso_entrega: data.piso_entrega ? Number(data.piso_entrega) : null,
            tiene_escaleras: data.tiene_escaleras,
            planos_hidromasaje: data.planos_hidromasaje,
            fecha_entrega: data.fecha_entrega || null,
            nit_cliente_final: data.nit_cliente_final,
            entrega_en_obra: data.entrega_en_obra,
            bodega_externa: data.bodega_externa,
            bodega_firplak: data.bodega_firplak,
        };

        if (pedidoUuid) {
            await updatePedido(pedidoUuid, pedData);
            await updatePedidoItems(pedidoUuid, itemsToSave);
            alert("Datos de pedido actualizados.");
        } else {
            await createPedido(quote, itemsToSave, pedData);
            alert("Pedido parcial guardado con éxito.");
        }

        // Sincronizar estos mismos campos en la Cotización principal para el PDF F-V-29
        await db.quotes.update(quote.id, {
            cliente_final: pedData.cliente_final,
            email_contacto: pedData.email_contacto,
            contacto_ventas: pedData.contacto_ventas,
            contacto_logistico: pedData.contacto_logistico,
            contacto_tesoreria: pedData.contacto_tesoreria,
            dir_envio_factura_tipo: pedData.dir_envio_factura_tipo,
            servicio_subida_hidromasaje: pedData.servicio_subida_hidromasaje,
            piso_entrega: pedData.piso_entrega,
            tiene_escaleras: pedData.tiene_escaleras,
            planos_hidromasaje: pedData.planos_hidromasaje,
            fecha_entrega: pedData.fecha_entrega,
            nit_cliente_final: pedData.nit_cliente_final,
            entrega_en_obra: pedData.entrega_en_obra,
            bodega_externa: pedData.bodega_externa,
            bodega_firplak: pedData.bodega_firplak
        });

        onClose();
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="bg-white p-5 rounded-xl border border-blue-200">
                <h4 className="font-bold mb-4 text-blue-900 border-b pb-2 cursor-pointer flex justify-between">
                    <span>1. Cantidades a Pedir</span>
                    <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800">Cancelar</button>
                </h4>
                
                <div className="space-y-3">
                    {quoteItems.map(qi => {
                        const consumido = consumosGlobales[qi.producto_id] || 0;
                        const disponible = qi.cantidad - consumido;
                        
                        return (
                            <div key={qi.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border">
                                <div>
                                    <p className="font-medium text-sm text-slate-800">{qi.descripcion_linea || 'Producto'}</p>
                                    <p className="text-xs text-slate-500">Pactados en coti: {qi.cantidad} uds | Disponibles: <strong className="text-green-600">{disponible} uds</strong></p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="number"
                                        className="w-20 p-2 border rounded-md text-sm text-center"
                                        placeholder="0"
                                        min="0"
                                        max={disponible}
                                        {...register(`selected_quantities.${qi.producto_id}`, { valueAsNumber: true })}
                                    />
                                    <span className="text-xs text-slate-500">uds</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
                <h4 className="font-bold border-b pb-2">2. Datos logísticos SAP</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium flex items-center gap-2 mb-1">
                            <Calendar className="w-4 h-4 text-slate-400" /> Fecha Facturación
                        </label>
                        <input type="date" {...register("fecha_facturacion")} className="w-full p-2 border rounded-lg" />
                    </div>

                    <div>
                        <label className="text-sm font-medium flex items-center gap-2 mb-1">
                            <Receipt className="w-4 h-4 text-slate-400" /> Tipo Facturación
                        </label>
                        <select {...register("tipo_facturacion")} className="w-full p-2 border rounded-lg">
                            <option value="">Seleccione...</option>
                            <option value="Standard">Estándar</option>
                            <option value="Anticipo">Anticipo</option>
                        </select>
                    </div>

                    <div className="md:col-span-2">
                        <label className="text-sm font-medium">Orden de Compra / Referencia Cliente</label>
                        <input {...register("orden_compra")} className="w-full mt-1 p-2 border rounded-lg" placeholder="Ej. OC-12345" />
                    </div>

                    <div className="md:col-span-2">
                        <label className="text-sm font-medium">Notas Integración SAP</label>
                        <textarea {...register("notas_sap")} className="w-full mt-1 p-2 border rounded-lg" rows={3} />
                    </div>
                </div>

                <h4 className="font-bold border-b pb-2 pt-4">3. Datos Adicionales (F-V-29 / Contactos)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium">Cliente Final (Nombre)</label>
                        <input {...register("cliente_final")} className="w-full mt-1 p-2 border rounded-lg" placeholder="Nombre del cliente final" />
                    </div>
                    <div>
                        <label className="text-sm font-medium">NIT / CC Cliente Final</label>
                        <input {...register("nit_cliente_final")} className="w-full mt-1 p-2 border rounded-lg" placeholder="NIT o Cédula" />
                    </div>
                    <div>
                        <label className="text-sm font-medium">Email de Contacto (OC/Cot)</label>
                        <input {...register("email_contacto")} type="email" className="w-full mt-1 p-2 border rounded-lg" placeholder="correo@ejemplo.com" />
                    </div>
                    
                    <div className="md:col-span-2">
                        <p className="text-sm font-bold text-slate-700 mt-2">Contactos por Área (Nombre y Celular)</p>
                    </div>
                    <div>
                        <label className="text-sm font-medium">Ventas / Compras</label>
                        <input {...register("contacto_ventas")} className="w-full mt-1 p-2 border rounded-lg" placeholder="Nombre y celular" />
                    </div>
                    <div>
                        <label className="text-sm font-medium">Logística</label>
                        <input {...register("contacto_logistico")} className="w-full mt-1 p-2 border rounded-lg" placeholder="Nombre y celular" />
                    </div>
                    <div>
                        <label className="text-sm font-medium">Tesorería</label>
                        <input {...register("contacto_tesoreria")} className="w-full mt-1 p-2 border rounded-lg" placeholder="Nombre y celular" />
                    </div>

                    <div className="md:col-span-2">
                        <p className="text-sm font-bold text-slate-700 mt-2">Entregas y Logística Específica</p>
                    </div>
                    <div>
                        <label className="text-sm font-medium">Dirección Envío Factura</label>
                        <select {...register("dir_envio_factura_tipo")} className="w-full mt-1 p-2 border rounded-lg">
                            <option value="">Seleccione...</option>
                            <option value="OFICINA">Oficina</option>
                            <option value="TIENDA">Tienda</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-sm font-medium flex items-center gap-2 mt-1">
                            <input type="checkbox" {...register("servicio_subida_hidromasaje")} />
                            Requiere Servicio Subida Hidromasaje
                        </label>
                    </div>
                    <div>
                        <label className="text-sm font-medium">Piso de Entrega</label>
                        <input type="number" {...register("piso_entrega")} className="w-full mt-1 p-2 border rounded-lg" placeholder="Ej. 1" min="1" />
                    </div>
                    <div>
                        <label className="text-sm font-medium flex items-center gap-2 mt-1">
                            <input type="checkbox" {...register("tiene_escaleras")} />
                            ¿Tiene escaleras?
                        </label>
                    </div>
                    <div className="md:col-span-2 flex flex-wrap gap-6 bg-slate-50 p-3 rounded-lg border">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <input type="checkbox" {...register("entrega_en_obra")} />
                            ¿Entrega en obra?
                        </label>
                        <label className="text-sm font-medium flex items-center gap-2">
                            <input type="checkbox" {...register("bodega_externa")} />
                            ¿Bodega externa?
                        </label>
                        <label className="text-sm font-medium flex items-center gap-2">
                            <input type="checkbox" {...register("bodega_firplak")} />
                            ¿Bodega FIRPLAK?
                        </label>
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-sm font-medium">Planos de Hidromasaje (Notas/Referencias)</label>
                        <textarea {...register("planos_hidromasaje")} className="w-full mt-1 p-2 border rounded-lg" rows={2} placeholder="Describa posiciones o referencias..." />
                    </div>
                    <div>
                        <label className="text-sm font-medium flex items-center gap-2 mb-1">
                            <Calendar className="w-4 h-4 text-slate-400" /> Fecha Mínima de Entrega Solicitada
                        </label>
                        <input type="date" {...register("fecha_entrega")} className="w-full p-2 border rounded-lg" />
                    </div>
                </div>

                <div className="flex justify-end pt-4 border-t">
                    <button 
                        type="submit"
                        className="bg-blue-600 text-white font-medium px-6 py-2 rounded-lg hover:bg-blue-700 transition"
                    >
                        Guardar Borrador del Pedido
                    </button>
                </div>
            </div>
        </form>
    );
}
