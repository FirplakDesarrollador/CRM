import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export async function generateQuotePdf(quote: any, items: any[], account: any, opportunity: any, save = true, advisorName?: string): Promise<string | void> {
    const doc = new jsPDF('p', 'pt', 'a4');
    
    // Configuración de fuentes y colores
    const darkGray: [number, number, number] = [30, 30, 30];
    const borderGray: [number, number, number] = [200, 200, 200];
    const margin = 30;
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = margin;

    // Helper to draw bordered text box
    const drawBox = (x: number, yPos: number, w: number, h: number, text: string, align: 'left' | 'center' | 'right' = 'left', title?: string) => {
        doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
        doc.rect(x, yPos, w, h);
        if (title) {
            doc.setFontSize(6);
            doc.setFont('helvetica', 'normal');
            doc.text(title, x + 3, yPos + 8);
        }
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        let textX = x + 3;
        if (align === 'center') textX = x + w / 2;
        if (align === 'right') textX = x + w - 3;
        doc.text(text, textX, yPos + 18, { align: align as any, maxWidth: w - 6 });
    };

    // HEADER
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('F-V-29', pageWidth - 70, y);
    y += 15;
    
    doc.setFontSize(12);
    doc.text('FORMATO DE COTIZACIÓN Y/O PEDIDO BAÑOS, COCINAS Y ROPAS', margin, y);
    doc.setFontSize(10);
    doc.text('V. 4', pageWidth - 70, y);
    y += 15;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('NIT 890.927.404-0', margin, y);
    doc.text(`Año: ${new Date().getFullYear()}`, pageWidth - 70, y);
    y += 10;
    
    doc.setDrawColor(0,0,0);
    doc.line(margin, y, pageWidth - margin, y);
    y += 15;

    // ROW 1: FECHA, RAZON SOCIAL
    const col1 = margin;
    const col2 = 180;
    const col3 = 350;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`FECHA : ${format(new Date(), "dd/MM/yyyy")}`, col1, y);
    doc.text(`RAZON SOCIAL: ${account?.nombre || ''}`, col2, y);
    y += 15;
    
    // ROW 2: NIT
    doc.text(`NIT/C.C. ${account?.nit_base || account?.nit || ''}`, col1, y);
    doc.text(`CLIENTE FINAL`, col3, y);
    y += 15;
    
    // ROW 3: DIREC. PRODUCTO
    doc.text(`DIREC. PRODUCTO: ${account?.direccion || ''}`, col1, y);
    doc.text(`CIUDAD PROD.: ${account?.ciudad || ''}`, col3 - 60, y);
    doc.text(`TEL: ${account?.telefono || ''}`, pageWidth - 140, y);
    y += 15;

    // ROW 4: DIREC. FACTURA
    doc.text(`DIREC. FACTURA: ${account?.direccion || ''}`, col1, y);
    doc.text(`CIUDAD FACT.: ${account?.ciudad || ''}`, col3 - 60, y);
    doc.text(`TEL: ${account?.telefono || ''}`, pageWidth - 140, y);
    y += 20;

    // CONTACTS SECTION
    doc.setFillColor(230, 230, 230);
    doc.rect(margin, y - 10, pageWidth - margin * 2, 14, 'F');
    doc.text('CONTACTOS DEL CLIENTE (POR FAVOR INGRESAR EL NOMBRE Y CELULAR DE CADA CARGO)', margin + 2, y);
    y += 15;

    doc.setFont('helvetica', 'normal');
    doc.text(`VENTAS/COMPRAS: ${account?.nombre || ''}`, col1, y);
    doc.text(`TEL \/ CEL: ${account?.telefono || ''}`, col3, y);
    y += 15;
    
    doc.text(`LOGISTICO: `, col1, y);
    doc.text(`TEL \/ CEL: `, col3, y);
    y += 15;
    
    doc.text(`TESORERIA: `, col1, y);
    doc.text(`TEL \/ CEL: `, col3, y);
    y += 15;
    
    doc.text(`FACTURA ELECTR.: ${account?.email || ''}`, col1, y);
    y += 15;
    
    doc.text(`EMAIL CONTACTO OC/COT: ${account?.email || ''}`, col1, y);
    y += 20;

    // INVOICE SECTION
    doc.setFont('helvetica', 'bold');
    doc.text(`CIERRE FACTURACION? ${quote.cierre_facturacion || 'NO'}`, col1, y);
    doc.text(`SI indique DD/MM/AA`, col1 + 150, y);
    doc.text(`SUBGRUPO CLIENT: ${account?.canal_id || ''}`, col3, y);
    y += 15;

    doc.text(`LISTA DE PRECIOS: PVP Sin. IVA`, col1, y);
    y += 15;
    
    doc.text(`ES UNA MUESTRA? ${quote.es_muestra ? 'SI' : 'NO'}`, col1, y);
    y += 15;
    
    doc.text(`DIRECCION PARA ENVIO DE FACTURA (marque con una X): OFICINA ( X )  TIENDA (   )`, col1, y);
    y += 15;

    doc.text(`SERVICIO DE SUBIDA DE HIDROMASAJE (marque con una X): SI ( ) NO ( X )`, col1, y);
    y += 15;

    doc.text(`PISO (   ) MEDIO (marque con una X) ASCENSOR ( ) ESCALERAS ( )`, col1, y);
    y += 15;

    doc.text(`VERIFICACIÓN PREVIA POR PARTE DE PERSONAL FIRPLAK (marque con una X) SI ( ) NO ( X )`, col1, y);
    y += 20;

    // TABLE
    const tableData = items.map((item, index) => {
        // En FIRPLAK, el Subtotal en la BD a veces ya tiene IVA, o es base. 
        // Vamos a usar base unit price y subtotal base.
        const qty = item.cantidad || 1;
        const discountPct = item.discount_pct || 0;
        const unitPrice = item.precio_unitario || 0;
        
        const formatter = new Intl.NumberFormat(quote.currency_id === 'USD' ? 'en-US' : 'es-CO');
        
        return [
            item.numero_articulo || item.producto_id || 'N/A', 
            qty.toString(), 
            item.descripcion_linea || 'Artículo', 
            formatter.format(unitPrice), 
            discountPct > 0 ? `${discountPct}%` : '0%', 
            formatter.format(item.subtotal || (unitPrice * qty * (1 - discountPct / 100)))
        ];
    });

    autoTable(doc, {
        startY: y,
        head: [['REFERENCIA SAP', 'CANT.', 'DESCRIPCION', 'VALOR UNITARIO', 'DTO', 'VALOR TOTAL']],
        body: tableData,
        theme: 'plain',
        headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', lineWidth: 0.5, lineColor: 0 },
        bodyStyles: { lineWidth: 0.5, lineColor: 200 },
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: {
            0: { cellWidth: 90 },
            1: { cellWidth: 35, halign: 'center' },
            2: { cellWidth: 'auto' },
            3: { cellWidth: 70, halign: 'right' },
            4: { cellWidth: 30, halign: 'center' },
            5: { cellWidth: 70, halign: 'right' },
        }
    });

    let finalY = (doc as any).lastAutoTable.finalY || y;
    
    // TOTALS SECTION
    // Cálculos de IVA aproximados si se asume que todo es Base (esto es heurístico)
    const rawTotal = quote.total_amount || 0;
    const isExport = quote.currency_id === 'USD';
    const subtotal = isExport ? rawTotal : rawTotal / 1.19; // Si ya estaba con IVA, extraemos la base. Ajustar según lógica de negocio.
    const iva = isExport ? 0 : rawTotal - subtotal;
    const granTotal = rawTotal;

    const tFmt = new Intl.NumberFormat(quote.currency_id === 'USD' ? 'en-US' : 'es-CO');
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    
    // Cuadros de totales
    const tw = 170;
    const tx = pageWidth - margin - tw;
    
    doc.setDrawColor(0);
    doc.rect(tx, finalY, tw, 15);
    doc.text('SUBTOTAL', tx + 5, finalY + 11);
    doc.text(tFmt.format(subtotal), tx + tw - 5, finalY + 11, { align: 'right' });
    
    doc.rect(tx, finalY + 15, tw, 15);
    doc.text('IVA 19%', tx + 5, finalY + 26);
    doc.text(tFmt.format(iva), tx + tw - 5, finalY + 26, { align: 'right' });
    
    doc.rect(tx, finalY + 30, tw, 15);
    doc.text('GRAN TOTAL', tx + 5, finalY + 41);
    doc.text(tFmt.format(granTotal), tx + tw - 5, finalY + 41, { align: 'right' });

    // BANCOLOMBIA text
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    const paymentText = "Favor consignar en BANCOLOMBIA (Corriente) 008927404-01 Recaudo 34368 ó Banco Bogotá (Corriente) 406-007-252 cod. Recaudo 008617 y dar aviso al fax (4)2817607 o al email cartera@firplak.com con copia a su asesor.";
    doc.text(doc.splitTextToSize(paymentText, 300), margin, finalY + 15);
    
    finalY += 60;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('VALIDEZ DE LA OFERTA 15 DÍAS HABILES', margin, finalY);
    finalY += 20;

    // PLANOS PARA HIDROMASAJES
    doc.setFillColor(230, 230, 230);
    doc.rect(margin, finalY - 10, pageWidth - margin * 2, 14, 'F');
    doc.text('PLANOS PARA HIDROMASAJES', margin + 2, finalY);
    finalY += 15;
    
    doc.setFontSize(8);
    autoTable(doc, {
        startY: finalY,
        head: [['REFERENCIA SAP', 'CANT.', 'DESCRIPCION', 'POSICIÓN DE FALDÓN']],
        body: [['', '', '', '']],
        theme: 'plain',
        headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', lineWidth: 0.5, lineColor: 0 },
        bodyStyles: { lineWidth: 0.5, lineColor: 200, minCellHeight: 20 },
        styles: { fontSize: 8, cellPadding: 3 },
    });
    
    finalY = (doc as any).lastAutoTable.finalY || finalY;
    finalY += 15;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Fecha de entrega:`, margin, finalY);
    finalY += 15;
    doc.text(`Fecha minima requerida por comercial/cliente: ${quote.fecha_minima_requerida || ''}`, margin, finalY);
    finalY += 15;
    
    doc.setFont('helvetica', 'bold');
    doc.text(`NOTAS: ${quote.notas_sap || ''}`, margin, finalY);
    finalY += 15;
    
    if (quote.comentarios) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        const splitComentarios = doc.splitTextToSize(`OBSERVACIONES: ${quote.comentarios}`, pageWidth - margin * 2);
        doc.text(splitComentarios, margin, finalY);
        finalY += (splitComentarios.length * 10) + 5;
    }
    
    finalY += 10;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    const legalText = `Con la firma o aceptación de este documento (vía e-mail), usted nos autoriza para tratar sus datos personales de acuerdo con la Ley Colombiana 1581 de 2012 "Protección de Datos Personales" y con nuestra política de tratamiento de datos personales. Conozca esta política y los mecanismos para ejercer sus derechos en http://www.firplak.com/privacy_policies`;
    doc.text(doc.splitTextToSize(legalText, pageWidth - margin * 2), margin, finalY);
    finalY += 35;

    // Obtener nombre del asesor
    let displayAdvisorName = advisorName || opportunity?.owner_user_id || 'Generado desde CRM';
    
    // Solo buscamos si no se nos pasó ya el nombre para evitar retrasos asíncronos que bloquean el nombre del archivo en Chrome
    if (!advisorName && opportunity?.owner_user_id) {
        try {
            const { supabase } = await import('@/lib/supabase');
            const { data: userData } = await supabase
                .from('CRM_Usuarios')
                .select('full_name')
                .eq('id', opportunity.owner_user_id)
                .single();
            
            if (userData?.full_name) {
                displayAdvisorName = userData.full_name;
            }
        } catch (e) {
            console.warn('No se pudo obtener el nombre del asesor:', e);
        }
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`ACEPTADO : _____________________________`, margin, finalY);
    doc.text(`ASESOR : ${displayAdvisorName}`, 300, finalY);
    finalY += 15;
    doc.text(`CC./NIT No.                       Contacto : ${account?.telefono || ''}`, margin, finalY);
    finalY += 30;

    // FOOTER
    doc.setFontSize(8);
    doc.text(`SOMOS AUTORRETENEDORES RES. 64 de MAYO 3 DE 1995`, pageWidth / 2, finalY, { align: 'center' });
    finalY += 10;
    doc.setFont('helvetica', 'normal');
    doc.text(`Autopista Sur, Calle 29 No. 41-15 Itagui – Antioquia. PBX 444 17 71. Fax. 281 76 07. www.firplak.com`, pageWidth / 2, finalY, { align: 'center' });

    if (save) {
        // Obtenemos los datos como ArrayBuffer para mayor compatibilidad con File System API
        const pdfArrayBuffer = doc.output('arraybuffer');
        const safeFileName = `Cotizacion_${(quote.numero_cotizacion || 'Borrador').toString().replace(/[/\\?%*:|"<>]/g, '_')}.pdf`;

        // Intentar usar File System Access API (Nativo de Chrome, evita problemas de nombres UUID)
        if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
            try {
                const handle = await (window as any).showSaveFilePicker({
                    suggestedName: safeFileName,
                    types: [{
                        description: 'Documento PDF',
                        accept: { 'application/pdf': ['.pdf'] },
                    }],
                });
                const writable = await handle.createWritable();
                await writable.write(pdfArrayBuffer);
                await writable.close();
                return;
            } catch (err: any) {
                // Si el usuario cancela el diálogo, no hacemos nada
                if (err.name === 'AbortError') return;
                console.warn('showSaveFilePicker no disponible o falló, usando fallback:', err);
            }
        }
        
        // Fallback tradicional si la API no está disponible (ej. navegadores antiguos o no-Chrome)
        const blob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
        saveAs(blob, safeFileName);
    } else {
        // En lugar de guardar, retornamos el contenido en base64 (string)
        // doc.output('datauristring') devuelve algo como "data:application/pdf;filename=generated.pdf;base64,JVBER..."
        // Para Graph API, generalmente enviamos solo el base64 sin el prefijo "data:..."
        const dataUriString = doc.output('datauristring');
        const base64Content = dataUriString.split(',')[1];
        return base64Content;
    }
}
