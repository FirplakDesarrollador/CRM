import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { FIRPLAK_LOGO_BASE64 } from './firplakLogoBase64';

export interface PdfItemRowData {
    referencia: string;
    cantidad: string;
    descripcion: string;
    unitPrice: number;
    discountPct: number;
    lineTotal: number;
}

export interface PdfTotalsData {
    subtotalBruto: number;
    descuentoTotal: number;
    subtotal: number;
    iva: number;
    granTotal: number;
}

export function calculatePdfItemRow(item: any): PdfItemRowData {
    const qty = Number(item?.cantidad) || 1;
    const discountPct = Number(item?.discount_pct) || 0;
    const unitPrice = Number(item?.precio_unitario) || 0;
    const lineTotal = item?.subtotal !== undefined && item?.subtotal !== null
        ? Number(item.subtotal)
        : unitPrice * qty * (1 - discountPct / 100);

    return {
        referencia: item?.numero_articulo || item?.producto_id || 'N/A',
        cantidad: qty.toString(),
        descripcion: item?.descripcion_linea || 'Artículo',
        unitPrice,
        discountPct,
        lineTotal,
    };
}

export function calculatePdfTotals(items: any[], quote: any): PdfTotalsData {
    const isExport = quote?.currency_id === 'USD';

    let subtotalBruto = 0;
    let subtotal = 0;

    if (items && items.length > 0) {
        for (const item of items) {
            const row = calculatePdfItemRow(item);
            const qty = Number(item?.cantidad) || 1;
            const unitPrice = Number(item?.precio_unitario) || 0;
            subtotalBruto += unitPrice * qty;
            subtotal += row.lineTotal;
        }
    } else {
        subtotal = Number(quote?.total_amount) || 0;
        subtotalBruto = subtotal;
    }

    const descuentoTotal = Math.max(0, subtotalBruto - subtotal);
    const iva = isExport ? 0 : subtotal * 0.19;
    const granTotal = subtotal + iva;

    return { subtotalBruto, descuentoTotal, subtotal, iva, granTotal };
}

export async function buildQuotePdfDoc(
    quote: any,
    items: any[],
    account: any,
    opportunity: any,
    advisorName?: string,
    advisorEmail?: string
): Promise<jsPDF> {
    const doc = new jsPDF('p', 'pt', 'a4');

    // Paleta de Colores Corporativa Firplak
    const primaryNavy: [number, number, number] = [30, 58, 76];    // #1E3A4C
    const secondaryBlue: [number, number, number] = [43, 88, 118]; // #2B5876
    const textDark: [number, number, number] = [15, 23, 42];       // #0F172A
    const textMuted: [number, number, number] = [100, 116, 139];   // #64748B
    const borderLight: [number, number, number] = [226, 232, 240]; // #E2E8F0
    const bgLight: [number, number, number] = [248, 250, 252];     // #F8FAFC
    const bgHeader: [number, number, number] = [241, 245, 249];    // #F1F5F9

    const margin = 28;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    // ─────────────────────────────────────────────────────────────
    // 1. ENCABEZADO CON LOGO OFICIAL
    // ─────────────────────────────────────────────────────────────
    try {
        // Logo oficial Firplak (PNG alta resolución aspect ratio ~2.745)
        doc.addImage('data:image/png;base64,' + FIRPLAK_LOGO_BASE64, 'PNG', margin, y, 115, 42);
    } catch (e) {
        console.warn('No se pudo cargar el logo PNG:', e);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryNavy);
        doc.text('FIRPLAK', margin, y + 20);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...textMuted);
        doc.text('inspirando hogares', margin, y + 32);
    }

    // Título Central
    const centerX = pageWidth / 2 + 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...primaryNavy);
    doc.text('FORMATO DE COTIZACIÓN Y/O PEDIDO', centerX, y + 14, { align: 'center' });
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...secondaryBlue);
    doc.text('BAÑOS, COCINAS Y ROPAS', centerX, y + 27, { align: 'center' });
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textMuted);
    doc.text('NIT 890.927.404-0', centerX, y + 39, { align: 'center' });

    // Tarjeta Derecha de Metadatos del Documento
    const metaCardW = 120;
    const metaCardH = 46;
    const metaCardX = pageWidth - margin - metaCardW;
    
    doc.setFillColor(...bgLight);
    doc.setDrawColor(...borderLight);
    doc.setLineWidth(0.75);
    doc.roundedRect(metaCardX, y - 2, metaCardW, metaCardH, 3, 3, 'FD');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textMuted);
    doc.text('NÚMERO DE COTIZACIÓN', metaCardX + 8, y + 9);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryNavy);
    const quoteNum = quote?.numero_cotizacion || 'COT-BORRADOR';
    doc.text(quoteNum, metaCardX + 8, y + 22);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textDark);
    doc.text(`Fecha: ${format(new Date(), "dd/MM/yyyy")}`, metaCardX + 8, y + 33);
    doc.setTextColor(...textMuted);
    doc.text(`Doc: F-V-29  |  V. 04`, metaCardX + 8, y + 42);

    y += 50;

    // Línea divisoria decorativa de marca
    doc.setDrawColor(...primaryNavy);
    doc.setLineWidth(1.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // ─────────────────────────────────────────────────────────────
    // 2. INFORMACIÓN DEL CLIENTE Y DESPACHO (TARJETAS EN 2 COLUMNAS)
    // ─────────────────────────────────────────────────────────────
    const cardGap = 10;
    const cardW = (contentWidth - cardGap) / 2;
    const cardH = 78;
    const cardLeftX = margin;
    const cardRightX = margin + cardW + cardGap;

    // --- Tarjeta Izquierda: Datos del Cliente ---
    doc.setFillColor(...bgLight);
    doc.setDrawColor(...borderLight);
    doc.setLineWidth(0.75);
    doc.roundedRect(cardLeftX, y, cardW, cardH, 3, 3, 'FD');

    // Franja de título
    doc.setFillColor(...bgHeader);
    doc.rect(cardLeftX, y, cardW, 14, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryNavy);
    doc.text('INFORMACIÓN DEL CLIENTE', cardLeftX + 6, y + 10);

    // Contenido Cliente
    const cPad = cardLeftX + 6;
    let cy = y + 24;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textMuted);
    doc.text('RAZÓN SOCIAL:', cPad, cy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...textDark);
    const clientName = (account?.nombre || 'Sin cliente asignado').substring(0, 38);
    doc.text(clientName, cPad + 60, cy);

    cy += 12;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textMuted);
    doc.text('NIT / C.C.:', cPad, cy);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textDark);
    doc.text(account?.nit_base || account?.nit || 'N/A', cPad + 60, cy);

    cy += 12;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textMuted);
    doc.text('CLIENTE FINAL:', cPad, cy);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textDark);
    const finalClient = quote?.cliente_final 
        ? `${quote.cliente_final}${quote.nit_cliente_final ? ` (NIT: ${quote.nit_cliente_final})` : ''}`
        : 'Mismo cliente';
    doc.text(finalClient.substring(0, 36), cPad + 60, cy);

    cy += 12;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textMuted);
    doc.text('TEL / CONTACTO:', cPad, cy);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textDark);
    doc.text(account?.telefono || 'N/A', cPad + 60, cy);

    cy += 12;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textMuted);
    doc.text('EMAIL / FACT.:', cPad, cy);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textDark);
    doc.text((account?.email || quote?.email_contacto || 'N/A').substring(0, 36), cPad + 60, cy);

    // --- Tarjeta Derecha: Despacho y Condiciones ---
    doc.setFillColor(...bgLight);
    doc.setDrawColor(...borderLight);
    doc.setLineWidth(0.75);
    doc.roundedRect(cardRightX, y, cardW, cardH, 3, 3, 'FD');

    // Franja de título
    doc.setFillColor(...bgHeader);
    doc.rect(cardRightX, y, cardW, 14, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryNavy);
    doc.text('DESPACHO Y CONDICIONES COMERCIALES', cardRightX + 6, y + 10);

    const rPad = cardRightX + 6;
    let ry = y + 24;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textMuted);
    doc.text('DIR. ENTREGA:', rPad, ry);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textDark);
    doc.text((account?.direccion || 'N/A').substring(0, 38), rPad + 62, ry);

    ry += 12;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textMuted);
    doc.text('CIUDAD PROD.:', rPad, ry);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textDark);
    doc.text(account?.ciudad || 'N/A', rPad + 62, ry);

    ry += 12;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textMuted);
    doc.text('DIR. FACTURA:', rPad, ry);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textDark);
    const invoiceDir = quote?.direccion_envio_factura || account?.direccion || 'Misma dirección';
    const invoiceType = quote?.dir_envio_factura_tipo ? ` (${quote.dir_envio_factura_tipo})` : '';
    doc.text(`${invoiceDir.substring(0, 30)}${invoiceType}`, rPad + 62, ry);

    ry += 12;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textMuted);
    doc.text('CANAL / LISTA:', rPad, ry);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textDark);
    doc.text(`${account?.canal_id || 'PROPIO'} • PVP Sin IVA`, rPad + 62, ry);

    ry += 12;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textMuted);
    doc.text('CIERRE FACT.:', rPad, ry);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textDark);
    doc.text(`${quote?.cierre_facturacion ? 'SÍ' : 'NO'}${quote?.fecha_facturacion ? ` (${quote.fecha_facturacion})` : ''}`, rPad + 62, ry);

    y += cardH + 8;

    // ─────────────────────────────────────────────────────────────
    // 3. CONTACTOS Y LOGÍSTICA DE ENTREGA (TARJETA HORIZONTAL)
    // ─────────────────────────────────────────────────────────────
    const specH = 46;
    doc.setFillColor(...bgLight);
    doc.setDrawColor(...borderLight);
    doc.setLineWidth(0.75);
    doc.roundedRect(margin, y, contentWidth, specH, 3, 3, 'FD');

    // Franja de título
    doc.setFillColor(...bgHeader);
    doc.rect(margin, y, contentWidth, 13, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryNavy);
    doc.text('CONTACTOS DEL CLIENTE Y LOGÍSTICA DE ENTREGA', margin + 6, y + 9.5);

    // 4 Columnas internas
    const colW = contentWidth / 4;
    const sy = y + 21;
    
    // Col 1: Contacto Compras
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textMuted);
    doc.text('VENTAS / COMPRAS', margin + 6, sy);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textDark);
    doc.text((quote?.contacto_ventas || account?.nombre || '-').substring(0, 22), margin + 6, sy + 10);
    doc.setTextColor(...textMuted);
    doc.text(`Tel: ${account?.telefono || '-'}`, margin + 6, sy + 19);

    // Col 2: Logística / Tesorería
    const col2X = margin + colW;
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textMuted);
    doc.text('LOGÍSTICA / TESORERÍA', col2X, sy);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textDark);
    doc.text(`Log: ${(quote?.contacto_logistico || '-').substring(0, 18)}`, col2X, sy + 10);
    doc.text(`Tes: ${(quote?.contacto_tesoreria || '-').substring(0, 18)}`, col2X, sy + 19);

    // Col 3: Especificación Hidromasaje & Acceso
    const col3X = margin + colW * 2;
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textMuted);
    doc.text('SUBIDA HIDROMASAJE & ACCESO', col3X, sy);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textDark);
    const subidaTxt = quote?.servicio_subida_hidromasaje ? 'Servicio Subida: SÍ' : 'Servicio Subida: NO';
    const accesoTxt = `Piso: ${quote?.piso_entrega || '-'} • ${quote?.tiene_escaleras ? 'Escaleras' : 'Ascensor'}`;
    doc.text(subidaTxt, col3X, sy + 10);
    doc.text(accesoTxt, col3X, sy + 19);

    // Col 4: Tipo de Entrega
    const col4X = margin + colW * 3;
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textMuted);
    doc.text('TIPO DE ENTREGA', col4X, sy);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textDark);
    const entregaTxt = quote?.entrega_en_obra 
        ? 'Entrega en Obra' 
        : quote?.bodega_externa 
            ? 'Bodega Externa' 
            : 'Bodega Firplak';
    const muestraTxt = `Muestra: ${quote?.es_muestra ? 'SÍ' : 'NO'}`;
    doc.text(entregaTxt, col4X, sy + 10);
    doc.text(muestraTxt, col4X, sy + 19);

    y += specH + 8;

    // ─────────────────────────────────────────────────────────────
    // 4. TABLA DE ÍTEMS / PRODUCTOS
    // ─────────────────────────────────────────────────────────────
    const isUSD = quote?.currency_id === 'USD';
    const currencyFormatter = new Intl.NumberFormat(isUSD ? 'en-US' : 'es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });

    const tableData = items.map((item, idx) => {
        const row = calculatePdfItemRow(item);
        return [
            (idx + 1).toString(),
            row.referencia,
            row.cantidad,
            row.descripcion,
            currencyFormatter.format(row.unitPrice),
            row.discountPct > 0 ? `${row.discountPct}%` : '0%',
            currencyFormatter.format(row.lineTotal),
        ];
    });

    autoTable(doc, {
        startY: y,
        head: [['#', 'REFERENCIA SAP', 'CANT.', 'DESCRIPCIÓN DEL PRODUCTO', 'PRECIO UNIT.', 'DTO', 'VALOR TOTAL']],
        body: tableData,
        theme: 'striped',
        headStyles: {
            fillColor: primaryNavy,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 7.5,
            cellPadding: 4,
            halign: 'left',
        },
        bodyStyles: {
            fontSize: 7.5,
            cellPadding: 3.5,
            textColor: textDark,
            lineColor: borderLight,
            lineWidth: 0.5,
        },
        alternateRowStyles: {
            fillColor: [250, 252, 255],
        },
        columnStyles: {
            0: { cellWidth: 20, halign: 'center', textColor: textMuted },
            1: { cellWidth: 95, fontStyle: 'bold', textColor: primaryNavy },
            2: { cellWidth: 32, halign: 'center', fontStyle: 'bold' },
            3: { cellWidth: 'auto' },
            4: { cellWidth: 72, halign: 'right' },
            5: { cellWidth: 30, halign: 'center' },
            6: { cellWidth: 75, halign: 'right', fontStyle: 'bold', textColor: primaryNavy },
        },
        styles: {
            overflow: 'linebreak',
        },
    });

    let finalY = (doc as any).lastAutoTable?.finalY || y;
    finalY += 8;

    // ─────────────────────────────────────────────────────────────
    // 5. SECCIÓN DE TOTALES Y PAGO
    // ─────────────────────────────────────────────────────────────
    const { subtotalBruto, descuentoTotal, subtotal, iva, granTotal } = calculatePdfTotals(items, quote);
    const hasDiscount = descuentoTotal > 0;
    const boxH = hasDiscount ? 74 : 58;

    // Caja Bancaria (Izquierda)
    const bankBoxW = 310;
    const bankBoxH = boxH;
    doc.setFillColor(...bgLight);
    doc.setDrawColor(...borderLight);
    doc.setLineWidth(0.75);
    doc.roundedRect(margin, finalY, bankBoxW, bankBoxH, 3, 3, 'FD');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryNavy);
    doc.text('FORMA DE PAGO & CONSIGNACIÓN', margin + 6, finalY + 11);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textDark);
    doc.text('• BANCOLOMBIA Cta Cte: 008927404-01  |  Convenio Recaudo: 34368', margin + 6, finalY + (hasDiscount ? 23 : 22));
    doc.text('• BANCO DE BOGOTÁ Cta Cte: 406-007-252  |  Código Recaudo: 008617', margin + 6, finalY + (hasDiscount ? 34 : 31));
    doc.setTextColor(...textMuted);
    doc.text('Enviar soporte al email cartera@firplak.com con copia a su asesor comercial.', margin + 6, finalY + (hasDiscount ? 46 : 41));

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...secondaryBlue);
    doc.text('VALIDEZ DE LA OFERTA: 15 DÍAS HÁBILES', margin + 6, finalY + (hasDiscount ? 64 : 52));

    // Caja de Totales (Derecha)
    const totalsW = 185;
    const totalsH = boxH;
    const totalsX = pageWidth - margin - totalsW;

    doc.setFillColor(...bgLight);
    doc.setDrawColor(...borderLight);
    doc.setLineWidth(0.75);
    doc.roundedRect(totalsX, finalY, totalsW, totalsH, 3, 3, 'FD');

    if (hasDiscount) {
        // Fila 1: Subtotal Bruto sin IVA
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...textMuted);
        doc.text('SUBTOTAL (SIN IVA)', totalsX + 8, finalY + 12);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...textDark);
        doc.text(`${isUSD ? 'USD $' : '$'} ${currencyFormatter.format(subtotalBruto)}`, totalsX + totalsW - 8, finalY + 12, { align: 'right' });

        // Fila 2: Descuento Comercial en pesos
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(22, 163, 74); // Verde oscuro #16A34A
        doc.text('DESCUENTO COMERCIAL', totalsX + 8, finalY + 23);
        doc.text(`-${isUSD ? 'USD $' : '$'} ${currencyFormatter.format(descuentoTotal)}`, totalsX + totalsW - 8, finalY + 23, { align: 'right' });

        // Fila 3: Subtotal Neto sin IVA
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...textMuted);
        doc.text('SUBTOTAL NETO (SIN IVA)', totalsX + 8, finalY + 34);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...textDark);
        doc.text(`${isUSD ? 'USD $' : '$'} ${currencyFormatter.format(subtotal)}`, totalsX + totalsW - 8, finalY + 34, { align: 'right' });

        // Fila 4: IVA
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...textMuted);
        doc.text(isUSD ? 'IVA (0% Exportación)' : 'IVA (19%)', totalsX + 8, finalY + 45);
        doc.setTextColor(...textDark);
        doc.text(`${isUSD ? 'USD $' : '$'} ${currencyFormatter.format(iva)}`, totalsX + totalsW - 8, finalY + 45, { align: 'right' });

        // Barra destacada Gran Total con IVA
        doc.setFillColor(...primaryNavy);
        doc.rect(totalsX, finalY + 52, totalsW, 22, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('GRAN TOTAL (CON IVA)', totalsX + 8, finalY + 66);
        doc.setFontSize(9.5);
        doc.text(`${isUSD ? 'USD $' : '$'} ${currencyFormatter.format(granTotal)}`, totalsX + totalsW - 8, finalY + 66.5, { align: 'right' });
    } else {
        // Fila Subtotal sin IVA
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...textMuted);
        doc.text('SUBTOTAL (SIN IVA)', totalsX + 8, finalY + 13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...textDark);
        doc.text(`${isUSD ? 'USD $' : '$'} ${currencyFormatter.format(subtotal)}`, totalsX + totalsW - 8, finalY + 13, { align: 'right' });

        // Fila IVA
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...textMuted);
        doc.text(isUSD ? 'IVA (0% Exportación)' : 'IVA (19%)', totalsX + 8, finalY + 26);
        doc.setTextColor(...textDark);
        doc.text(`${isUSD ? 'USD $' : '$'} ${currencyFormatter.format(iva)}`, totalsX + totalsW - 8, finalY + 26, { align: 'right' });

        // Barra destacada Gran Total con IVA
        doc.setFillColor(...primaryNavy);
        doc.rect(totalsX, finalY + 35, totalsW, 23, 'F');
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('GRAN TOTAL (CON IVA)', totalsX + 8, finalY + 49.5);
        doc.setFontSize(10);
        doc.text(`${isUSD ? 'USD $' : '$'} ${currencyFormatter.format(granTotal)}`, totalsX + totalsW - 8, finalY + 50, { align: 'right' });
    }

    finalY += boxH + 10;

    // ─────────────────────────────────────────────────────────────
    // 6. PLANOS / OBSERVACIONES / ESPECIFICACIONES TÉCNICAS
    // ─────────────────────────────────────────────────────────────
    if (quote?.planos_hidromasaje || quote?.notas_sap || quote?.comentarios) {
        const obsH = 44;
        doc.setFillColor(...bgLight);
        doc.setDrawColor(...borderLight);
        doc.setLineWidth(0.75);
        doc.roundedRect(margin, finalY, contentWidth, obsH, 3, 3, 'FD');

        doc.setFillColor(...bgHeader);
        doc.rect(margin, finalY, contentWidth, 12, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryNavy);
        doc.text('OBSERVACIONES Y CONDICIONES ESPECÍFICAS', margin + 6, finalY + 8.5);

        let oy = finalY + 20;
        doc.setFontSize(7);
        if (quote?.fecha_entrega) {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...textDark);
            doc.text(`Fecha estimada de entrega: ${format(new Date(quote.fecha_entrega), "dd/MM/yyyy")}`, margin + 6, oy);
            oy += 9;
        }
        if (quote?.notas_sap) {
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...textDark);
            doc.text(`Notas SAP: ${quote.notas_sap.substring(0, 110)}`, margin + 6, oy);
            oy += 9;
        }
        if (quote?.comentarios) {
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...textMuted);
            doc.text(`Comentarios: ${quote.comentarios.substring(0, 110)}`, margin + 6, oy);
        }
        finalY += obsH + 10;
    } else {
        finalY += 5;
    }

    // ─────────────────────────────────────────────────────────────
    // 7. FIRMAS Y ACEPTACIÓN DEL DOCUMENTO
    // ─────────────────────────────────────────────────────────────
    // Obtener nombre y correo del asesor comercial
    let displayAdvisorName = advisorName || opportunity?.owner_user_id || 'Asesor Firplak';
    let displayAdvisorEmail = advisorEmail || '';

    if ((!advisorName || !displayAdvisorEmail) && opportunity?.owner_user_id) {
        try {
            const { supabase } = await import('@/lib/supabase');
            const { data: userData } = await supabase
                .from('CRM_Usuarios')
                .select('full_name, email')
                .eq('id', opportunity.owner_user_id)
                .maybeSingle();

            if (userData?.full_name && !advisorName) {
                displayAdvisorName = userData.full_name;
            }
            if (userData?.email && !displayAdvisorEmail) {
                displayAdvisorEmail = userData.email;
            }
        } catch (e) {
            console.warn('No se pudo obtener el nombre/correo del asesor:', e);
        }
    }

    if (!displayAdvisorEmail && displayAdvisorName && displayAdvisorName !== 'Asesor Firplak') {
        try {
            const { supabase } = await import('@/lib/supabase');
            const { data: userByName } = await supabase
                .from('CRM_Usuarios')
                .select('email')
                .ilike('full_name', displayAdvisorName)
                .maybeSingle();
            if (userByName?.email) {
                displayAdvisorEmail = userByName.email;
            }
        } catch (e) {
            // ignore
        }
    }

    if (!displayAdvisorEmail && typeof window !== 'undefined') {
        try {
            const { supabase } = await import('@/lib/supabase');
            const { data: sessionData } = await supabase.auth.getSession();
            if (sessionData?.session?.user?.email) {
                displayAdvisorEmail = sessionData.session.user.email;
            }
        } catch (e) {
            // ignore
        }
    }

    const signCardW = (contentWidth - cardGap) / 2;
    const signCardH = 44;
    const signLeftX = margin;
    const signRightX = margin + signCardW + cardGap;

    // Caja Firma Cliente
    doc.setDrawColor(...borderLight);
    doc.setFillColor(...bgLight);
    doc.roundedRect(signLeftX, finalY, signCardW, signCardH, 3, 3, 'FD');
    
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textMuted);
    doc.text('ACEPTADO POR EL CLIENTE', signLeftX + 6, finalY + 9);
    
    doc.setDrawColor(...textMuted);
    doc.setLineWidth(0.5);
    doc.line(signLeftX + 6, finalY + 28, signLeftX + signCardW - 6, finalY + 28);
    
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textDark);
    doc.text(`Firma / C.C. o NIT: ____________________  Fecha: ___/___/______`, signLeftX + 6, finalY + 38);

    // Caja Firma Asesor Firplak
    doc.setDrawColor(...borderLight);
    doc.setFillColor(...bgLight);
    doc.roundedRect(signRightX, finalY, signCardW, signCardH, 3, 3, 'FD');

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryNavy);
    doc.text('FIRPLAK S.A.S. - ASESOR COMERCIAL', signRightX + 6, finalY + 9);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textDark);
    doc.text(displayAdvisorName, signRightX + 6, finalY + 22);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textMuted);
    doc.text(`Contacto Asesor / PBX: (604) 444 17 71`, signRightX + 6, finalY + 33);
    const emailToDisplay = displayAdvisorEmail || 'cartera@firplak.com';
    doc.text(`Email: ${emailToDisplay} • www.firplak.com`, signRightX + 6, finalY + 41);

    // ─────────────────────────────────────────────────────────────
    // 8. TEXTO LEGAL Y PIE DE PÁGINA
    // ─────────────────────────────────────────────────────────────
    const boxBottom = finalY + signCardH;
    const legalText = 'Con la firma o aceptación de este documento (vía e-mail), usted nos autoriza para tratar sus datos personales de acuerdo con la Ley Colombiana 1581 de 2012 "Protección de Datos Personales" y nuestra política disponible en www.firplak.com/privacy_policies.';

    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    const legalLines = doc.splitTextToSize(legalText, contentWidth);
    const legalHeight = legalLines.length * 7;
    const totalFooterHeight = legalHeight + 6 + 9 + 5 + 8; // Altura requerida con espacios confortables

    // Si no cabe en la página actual, saltar de página
    if (boxBottom + 20 + totalFooterHeight > pageHeight - margin) {
        doc.addPage();
        finalY = margin;
    }

    // Posicionamiento armónico: si hay espacio suficiente, anclar elegantemente al pie de página;
    // si no, mantener una separación mínima holgada de 24pt respecto a las firmas.
    let footerY = Math.max(boxBottom + 24, pageHeight - margin - totalFooterHeight);

    // Línea 1: Tratamiento de datos personales
    doc.setTextColor(...textMuted);
    doc.text(legalLines, pageWidth / 2, footerY, { align: 'center' });
    footerY += legalHeight + 6;

    // Línea 2: Autorretenedores
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryNavy);
    doc.text('SOMOS AUTORRETENEDORES RES. 64 DE MAYO 3 DE 1995', pageWidth / 2, footerY, { align: 'center' });
    footerY += 9;

    // Línea 3: Dirección y canales de contacto
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textMuted);
    doc.text('Autopista Sur, Calle 29 No. 41-15 Itagüí – Antioquia • PBX: (604) 444 17 71 • Fax: (604) 281 76 07 • www.firplak.com', pageWidth / 2, footerY, { align: 'center' });

    return doc;
}

export async function generateQuotePdfBlob(
    quote: any,
    items: any[],
    account: any,
    opportunity: any,
    advisorName?: string,
    advisorEmail?: string
): Promise<Blob> {
    const doc = await buildQuotePdfDoc(quote, items, account, opportunity, advisorName, advisorEmail);
    const pdfArrayBuffer = doc.output('arraybuffer');
    return new Blob([pdfArrayBuffer], { type: 'application/pdf' });
}

export async function generateQuotePdf(
    quote: any,
    items: any[],
    account: any,
    opportunity: any,
    save = true,
    advisorName?: string,
    advisorEmail?: string
): Promise<string | void> {
    const doc = await buildQuotePdfDoc(quote, items, account, opportunity, advisorName, advisorEmail);

    if (save) {
        const pdfArrayBuffer = doc.output('arraybuffer');
        const safeFileName = `Cotizacion_${(quote.numero_cotizacion || 'Borrador').toString().replace(/[/\\?%*:|"<>]/g, '_')}.pdf`;

        // Intentar usar File System Access API si está disponible
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
                if (err.name === 'AbortError') return;
                console.warn('showSaveFilePicker no disponible o cancelado, usando fallback:', err);
            }
        }

        // Fallback tradicional
        const blob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
        saveAs(blob, safeFileName);
    } else {
        const dataUriString = doc.output('datauristring');
        const base64Content = dataUriString.split(',')[1];
        return base64Content;
    }
}
