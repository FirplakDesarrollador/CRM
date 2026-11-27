import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { calculatePdfItemRow, calculatePdfTotals } from '@/lib/pdfGenerator';

export async function buildQuoteExcelWorkbook(
    quote: any,
    items: any[],
    account: any,
    opportunity: any,
    advisorName?: string
): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CRM Firplak';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Cotización', {
        views: [{ showGridLines: true }],
    });

    const isUSD = quote?.currency_id === 'USD';
    const currencyFormat = isUSD ? '"$"#,##0.00' : '"$"#,##0';

    // Paleta de colores Firplak
    const brandNavy = 'FF254153';
    const brandBlueLight = 'FFF0F4F8';
    const borderGray = 'FFD0D7DE';

    // Configuración de anchos de columna
    sheet.columns = [
        { key: 'itemNum', width: 8 },
        { key: 'referencia', width: 22 },
        { key: 'descripcion', width: 44 },
        { key: 'cantidad', width: 12 },
        { key: 'precioUnitario', width: 18 },
        { key: 'descuento', width: 14 },
        { key: 'subtotal', width: 20 },
    ];

    // Encabezado principal
    sheet.mergeCells('A1:G1');
    const headerTitle = sheet.getCell('A1');
    headerTitle.value = 'FIRPLAK S.A.S. — FORMATO DE COTIZACIÓN / PEDIDO (F-V-29)';
    headerTitle.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    headerTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandNavy } };
    headerTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 28;

    sheet.mergeCells('A2:G2');
    const headerSubtitle = sheet.getCell('A2');
    headerSubtitle.value = 'NIT 890.927.404-0 • Autopista Sur Calle 29 No. 41-15 Itagüí, Antioquia • PBX 444 17 71';
    headerSubtitle.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF555555' } };
    headerSubtitle.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(2).height = 18;

    // Fila 3 vacía de separación
    sheet.getRow(3).height = 8;

    // Bloque de metadatos (Cotización y Cliente)
    const quoteDateStr = quote?.created_at
        ? format(new Date(quote.created_at), 'dd/MM/yyyy HH:mm', { locale: es })
        : format(new Date(), 'dd/MM/yyyy');

    const displayAdvisor = advisorName || opportunity?.owner_user_id || 'Generado desde CRM';

    const infoRows = [
        ['No. Cotización:', quote?.numero_cotizacion || 'Borrador', 'Cliente / Razón Social:', account?.nombre || 'N/A'],
        ['Fecha Emisión:', quoteDateStr, 'NIT / Documento:', quote?.nit_cliente_final || account?.nit_base || account?.nit || 'N/A'],
        ['Oportunidad:', opportunity?.nombre || 'N/A', 'Teléfono / Contacto:', account?.telefono || quote?.email_contacto || 'N/A'],
        ['Asesor Comercial:', displayAdvisor, 'Ciudad / Dirección:', `${account?.ciudad || ''} ${quote?.direccion_envio_factura || account?.direccion || ''}`.trim() || 'N/A'],
        ['Moneda:', quote?.currency_id || 'COP', 'Términos de Pago:', quote?.terminos_pago || 'Contado'],
    ];

    let currentInfoRow = 4;
    for (const rowData of infoRows) {
        sheet.getCell(`A${currentInfoRow}`).value = rowData[0];
        sheet.getCell(`A${currentInfoRow}`).font = { name: 'Arial', size: 9, bold: true, color: { argb: brandNavy } };
        sheet.getCell(`B${currentInfoRow}`).value = rowData[1];
        sheet.getCell(`B${currentInfoRow}`).font = { name: 'Arial', size: 9 };

        sheet.getCell(`D${currentInfoRow}`).value = rowData[2];
        sheet.getCell(`D${currentInfoRow}`).font = { name: 'Arial', size: 9, bold: true, color: { argb: brandNavy } };

        sheet.mergeCells(`E${currentInfoRow}:G${currentInfoRow}`);
        const destCell = sheet.getCell(`E${currentInfoRow}`);
        destCell.value = rowData[3];
        destCell.font = { name: 'Arial', size: 9 };

        sheet.getRow(currentInfoRow).height = 18;
        currentInfoRow++;
    }

    // Separación antes de la tabla de productos
    currentInfoRow++;
    const tableHeaderRowNum = currentInfoRow;

    // Cabecera de la tabla de ítems
    const tableHeaders = [
        'Ítem',
        'Referencia',
        'Descripción',
        'Cantidad',
        'Precio Unitario',
        'Descuento',
        'Total Neto',
    ];

    const tableHeaderRow = sheet.getRow(tableHeaderRowNum);
    tableHeaderRow.height = 24;

    tableHeaders.forEach((th, idx) => {
        const cell = tableHeaderRow.getCell(idx + 1);
        cell.value = th;
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandNavy } };
        cell.alignment = {
            horizontal: idx === 0 ? 'center' : idx >= 3 ? 'right' : 'left',
            vertical: 'middle',
        };
        cell.border = {
            top: { style: 'thin', color: { argb: borderGray } },
            bottom: { style: 'thin', color: { argb: borderGray } },
        };
    });

    let rowIdx = tableHeaderRowNum + 1;

    // Filas de ítems
    if (items && items.length > 0) {
        items.forEach((item, index) => {
            const rowData = calculatePdfItemRow(item);
            const r = sheet.getRow(rowIdx);
            r.height = 20;

            const isEven = index % 2 === 0;
            const bgPattern = isEven ? undefined : { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: brandBlueLight } };

            const c1 = r.getCell(1);
            c1.value = index + 1;
            c1.alignment = { horizontal: 'center', vertical: 'middle' };

            const c2 = r.getCell(2);
            c2.value = rowData.referencia;
            c2.alignment = { horizontal: 'left', vertical: 'middle' };

            const c3 = r.getCell(3);
            c3.value = rowData.descripcion;
            c3.alignment = { horizontal: 'left', vertical: 'middle' };

            const c4 = r.getCell(4);
            c4.value = Number(rowData.cantidad) || 0;
            c4.alignment = { horizontal: 'right', vertical: 'middle' };
            c4.numFmt = '#,##0';

            const c5 = r.getCell(5);
            c5.value = rowData.unitPrice;
            c5.alignment = { horizontal: 'right', vertical: 'middle' };
            c5.numFmt = currencyFormat;

            const c6 = r.getCell(6);
            c6.value = rowData.discountPct ? `${rowData.discountPct}%` : '0%';
            c6.alignment = { horizontal: 'right', vertical: 'middle' };

            const c7 = r.getCell(7);
            c7.value = rowData.lineTotal;
            c7.alignment = { horizontal: 'right', vertical: 'middle' };
            c7.numFmt = currencyFormat;

            for (let c = 1; c <= 7; c++) {
                const cell = r.getCell(c);
                cell.font = { name: 'Arial', size: 9 };
                if (bgPattern) cell.fill = bgPattern;
                cell.border = {
                    bottom: { style: 'thin', color: { argb: borderGray } },
                    left: { style: 'thin', color: { argb: borderGray } },
                    right: { style: 'thin', color: { argb: borderGray } },
                };
            }

            rowIdx++;
        });
    }

    // Totales calculados exactamente como en el PDF
    const { subtotalBruto, descuentoTotal, subtotal, iva, granTotal } = calculatePdfTotals(items, quote);

    sheet.getRow(rowIdx).height = 10;
    rowIdx++;

    const totalsData = [
        ...(descuentoTotal > 0
            ? [
                  { label: 'Subtotal (Sin IVA):', value: subtotalBruto },
                  { label: 'Descuento Comercial:', value: -descuentoTotal, isDiscount: true },
                  { label: 'Subtotal Neto (Sin IVA):', value: subtotal },
              ]
            : [{ label: 'Subtotal (Sin IVA):', value: subtotal }]),
        { label: isUSD ? 'IVA (0%):' : 'IVA (19%):', value: iva },
        { label: 'GRAN TOTAL (Con IVA):', value: granTotal, isTotal: true },
    ];

    for (const t of totalsData) {
        const r = sheet.getRow(rowIdx);
        r.height = t.isTotal ? 24 : 20;

        sheet.mergeCells(`E${rowIdx}:F${rowIdx}`);
        const labelCell = r.getCell(5);
        labelCell.value = t.label;
        labelCell.alignment = { horizontal: 'right', vertical: 'middle' };
        labelCell.font = { name: 'Arial', size: t.isTotal ? 10 : 9, bold: true, color: { argb: t.isTotal ? brandNavy : 'FF333333' } };

        const valCell = r.getCell(7);
        valCell.value = t.value;
        valCell.alignment = { horizontal: 'right', vertical: 'middle' };
        valCell.font = { name: 'Arial', size: t.isTotal ? 11 : 9, bold: t.isTotal };
        valCell.numFmt = currencyFormat;

        if (t.isTotal) {
            labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6EEF5' } };
            valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6EEF5' } };
            labelCell.border = { top: { style: 'thin', color: { argb: brandNavy } }, bottom: { style: 'double', color: { argb: brandNavy } } };
            valCell.border = { top: { style: 'thin', color: { argb: brandNavy } }, bottom: { style: 'double', color: { argb: brandNavy } } };
        }

        rowIdx++;
    }

    // Términos y nota legal
    rowIdx++;
    sheet.mergeCells(`A${rowIdx}:G${rowIdx}`);
    const noteCell = sheet.getCell(`A${rowIdx}`);
    noteCell.value = 'Nota: Con la firma o aceptación de este documento, autoriza el tratamiento de datos personales de acuerdo con la Ley 1581 de 2012 y las políticas de Firplak S.A.S.';
    noteCell.font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF777777' } };
    noteCell.alignment = { horizontal: 'left', vertical: 'middle' };

    return workbook;
}

export async function generateQuoteExcel(
    quote: any,
    items: any[],
    account: any,
    opportunity: any,
    advisorName?: string
): Promise<void> {
    const workbook = await buildQuoteExcelWorkbook(quote, items, account, opportunity, advisorName);
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
    });
    const safeFileName = `Cotizacion_${(quote?.numero_cotizacion || 'Borrador').toString().replace(/[/\\?%*:|"<>]/g, '_')}.xlsx`;
    saveAs(blob, safeFileName);
}

