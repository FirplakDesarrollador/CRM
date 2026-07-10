import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

/**
 * Interface parameter for columns
 */
export interface ExportColumn<T> {
  header: string;
  key: keyof T | string;
  width?: number;
}

/**
 * Helper to download an array of objects to Excel
 */
export const downloadExcel = async <T extends Record<string, any>>(
  data: T[], 
  columns: ExportColumn<T>[], 
  filename: string, 
  sheetName: string = 'Datos'
) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  worksheet.columns = columns.map(col => ({
    header: col.header,
    key: col.key as string,
    width: col.width || 20
  }));

  // Style Header
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF254153' } };

  // Add Data
  data.forEach((item) => {
    worksheet.addRow(item);
  });

  // Generate buffer and save
  const buffer = await workbook.xlsx.writeBuffer();
  const fileType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8';
  const blob = new Blob([buffer], { type: fileType });
  saveAs(blob, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

/**
 * Helper to download an array of objects to CSV
 */
export const downloadCSV = <T extends Record<string, any>>(
  data: T[], 
  columns: ExportColumn<T>[], 
  filename: string
) => {
  if (data.length === 0) return;

  const delimiter = ';'; // Using semicolon is generally better for Excel to open CSV correctly in LATAM
  const headers = columns.map(c => `"${c.header}"`).join(delimiter);

  const rows = data.map(item => {
    return columns.map(col => {
      const value = item[col.key as keyof T];
      const stringValue = (value === null || value === undefined) ? '' : String(value);
      // Escape quotes
      const escapedValue = stringValue.replace(/"/g, '""');
      return `"${escapedValue}"`;
    }).join(delimiter);
  });

  const csvContent = [headers, ...rows].join('\n');
  
  // Add BOM for UTF-8 support in Excel
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
};

export interface SopRow {
  anio_fact: number;
  mes_planta: string;
  mes_comercial: string;
  estado: string;
  asesor: string;
  grupo_cliente: string;
  subgrupo_cliente: string;
  cliente: string;
  codigo_articulo: string;
  descripcion_articulo: string;
  planta: string;
  familia: string;
  valor_unit: number;
  cantidad_total: number;
  valor_total: number;
  probabilidad: number;
  quincena: number;
}

/**
 * Generates and downloads the S&OP Report with 'S&OP' detailed sheet and 'TD' Pivot Table sheet.
 */
export const downloadSopExcel = async (
  data: SopRow[],
  filename: string
) => {
  const workbook = new ExcelJS.Workbook();

  // ==========================================
  // SHEET 1: S&OP (Plain data list)
  // ==========================================
  const wsSop = workbook.addWorksheet('S&OP');

  const columnsSop = [
    { header: 'Año fact', key: 'anio_fact', width: 12 },
    { header: 'Mes Planta', key: 'mes_planta', width: 15 },
    { header: 'Mes Comercial', key: 'mes_comercial', width: 15 },
    { header: 'Estado', key: 'estado', width: 15 },
    { header: 'Asesor', key: 'asesor', width: 25 },
    { header: 'Grupo Cliente', key: 'grupo_cliente', width: 20 },
    { header: 'Subgrupo Cliente', key: 'subgrupo_cliente', width: 22 },
    { header: 'Cliente', key: 'cliente', width: 35 },
    { header: 'Código del Artículo', key: 'codigo_articulo', width: 25 },
    { header: 'Descripción del Artículo', key: 'descripcion_articulo', width: 40 },
    { header: 'Planta', key: 'planta', width: 12 },
    { header: 'Familia', key: 'familia', width: 25 },
    { header: 'Valor Unit', key: 'valor_unit', width: 15 },
    { header: 'Cantidad Total', key: 'cantidad_total', width: 15 },
    { header: 'Valor Total', key: 'valor_total', width: 18 },
    { header: '% de Probabilidad', key: 'probabilidad', width: 18 },
    { header: 'Quincena', key: 'quincena', width: 10 }
  ];

  wsSop.columns = columnsSop.map(col => ({
    header: col.header,
    key: col.key,
    width: col.width
  }));

  // Style S&OP Header
  const headerRow = wsSop.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Segoe UI', size: 10 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF254153' } };
  headerRow.height = 24;
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Add S&OP Rows
  data.forEach((item) => {
    const row = wsSop.addRow({
      ...item,
      // Representar probabilidad como decimal para que Excel lo formatee como %
      probabilidad: item.probabilidad / 100
    });
    
    // Format numeric values
    row.getCell('valor_unit').numFmt = '$#,##0';
    row.getCell('cantidad_total').numFmt = '#,##0';
    row.getCell('valor_total').numFmt = '$#,##0';
    row.getCell('probabilidad').numFmt = '0%';
    row.getCell('anio_fact').numFmt = '0';
    row.getCell('quincena').numFmt = '0';
    row.font = { name: 'Segoe UI', size: 10 };
  });

  // Add borders to cells in S&OP sheet
  wsSop.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });
    }
  });


  // ==========================================
  // SHEET 2: TD (Pivot Table simulation)
  // ==========================================
  const wsTd = workbook.addWorksheet('TD');

  // 1. Extract dimensions (Channels, Years, Months)
  const channels = Array.from(new Set(data.map(d => d.grupo_cliente || 'Desconocido'))).sort();
  
  // Get unique Year-Month combinations
  const yearMonthMap: Record<number, Set<string>> = {};
  data.forEach(d => {
    const yr = d.anio_fact || new Date().getFullYear();
    const ms = d.mes_comercial || 'Desconocido';
    if (!yearMonthMap[yr]) {
      yearMonthMap[yr] = new Set<string>();
    }
    yearMonthMap[yr].add(ms);
  });

  const sortedYears = Object.keys(yearMonthMap).map(Number).sort((a, b) => a - b);
  
  // Meses ordenados en español para orden correcto en columnas
  const mesOrden: Record<string, number> = {
    'Enero': 1, 'Febrero': 2, 'Marzo': 3, 'Abril': 4, 'Mayo': 5, 'Junio': 6,
    'Julio': 7, 'Agosto': 8, 'Septiembre': 9, 'Octubre': 10, 'Noviembre': 11, 'Diciembre': 12
  };
  
  // Estructura de columnas para cabeceras en TD
  // Columna A (1): "Etiquetas de fila"
  // Siguientes columnas mapeadas por año y mes
  interface ColDef {
    colIndex: number;
    year: number | null;
    month: string | null;
    isTotal: boolean;
    headerLabel: string;
  }
  const colDefs: ColDef[] = [];
  let colCounter = 2; // Inicia en B

  sortedYears.forEach(year => {
    const months = Array.from(yearMonthMap[year]).sort((a, b) => {
      return (mesOrden[a] || 99) - (mesOrden[b] || 99);
    });
    
    months.forEach(month => {
      colDefs.push({
        colIndex: colCounter++,
        year: year,
        month: month,
        isTotal: false,
        headerLabel: month
      });
    });
    
    // Columna Total del Año
    colDefs.push({
      colIndex: colCounter++,
      year: year,
      month: null,
      isTotal: true,
      headerLabel: `Total ${year}`
    });
  });

  // Columna Total General al final
  const totalGeneralColIndex = colCounter++;
  
  // 2. Escribir Cabecera de la Tabla Dinámica
  wsTd.mergeCells(1, 1, 1, 3);
  const titleCell = wsTd.getCell(1, 1);
  titleCell.value = 'Suma de Valor Total';
  titleCell.font = { bold: true, name: 'Segoe UI', size: 10, color: { argb: 'FF254153' } };

  // Fila de Años (Fila 3)
  wsTd.getCell(3, 1).value = 'Etiquetas de fila';
  wsTd.getCell(3, 1).font = { bold: true, name: 'Segoe UI', size: 10 };
  
  // Combinar celdas de cabecera por años
  let currentStartCol = 2;
  sortedYears.forEach(year => {
    const monthsInYear = yearMonthMap[year].size;
    const endCol = currentStartCol + monthsInYear; // Meses + Total
    wsTd.mergeCells(3, currentStartCol, 3, endCol);
    const yrCell = wsTd.getCell(3, currentStartCol);
    yrCell.value = year;
    yrCell.alignment = { horizontal: 'center' };
    yrCell.font = { bold: true, name: 'Segoe UI', size: 10, color: { argb: 'FFFFFFFF' } };
    yrCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF254153' } };
    currentStartCol = endCol + 1;
  });
  
  // Total general en la fila de años
  wsTd.getCell(3, totalGeneralColIndex).value = 'Total general';
  wsTd.getCell(3, totalGeneralColIndex).font = { bold: true, name: 'Segoe UI', size: 10, color: { argb: 'FFFFFFFF' } };
  wsTd.getCell(3, totalGeneralColIndex).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  wsTd.getCell(3, totalGeneralColIndex).alignment = { horizontal: 'center' };

  // Fila de Meses / Sub-cabeceras (Fila 4)
  wsTd.getCell(4, 1).value = ''; // Vacío
  colDefs.forEach(def => {
    const cell = wsTd.getCell(4, def.colIndex);
    cell.value = def.headerLabel;
    cell.font = { bold: true, name: 'Segoe UI', size: 9 };
    cell.alignment = { horizontal: 'center' };
    if (def.isTotal) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    }
  });

  // 3. Escribir Datos de Canales (Fila 5 en adelante)
  let rowIdx = 5;
  const colTotals: Record<number, number> = {};
  let absoluteTotal = 0;

  channels.forEach(channel => {
    const row = wsTd.getRow(rowIdx);
    row.getCell(1).value = channel;
    row.getCell(1).font = { name: 'Segoe UI', size: 10 };
    
    let channelRowTotal = 0;
    const channelYearTotals: Record<number, number> = {};

    colDefs.forEach(def => {
      const cell = row.getCell(def.colIndex);
      cell.numFmt = '$#,##0';
      cell.font = { name: 'Segoe UI', size: 10 };

      if (!def.isTotal) {
        // Filtrar datos para este canal, año y mes
        const val = data
          .filter(d => d.grupo_cliente === channel && d.anio_fact === def.year && d.mes_comercial === def.month)
          .reduce((sum, curr) => sum + (curr.valor_total || 0), 0);
        
        cell.value = val || null; // No escribir cero para verse más limpio
        
        // Sumar a acumuladores
        channelRowTotal += val;
        channelYearTotals[def.year!] = (channelYearTotals[def.year!] || 0) + val;
        colTotals[def.colIndex] = (colTotals[def.colIndex] || 0) + val;
      } else {
        // Celda de Total de Año
        const yearVal = channelYearTotals[def.year!] || 0;
        cell.value = yearVal || null;
        cell.font = { bold: true, name: 'Segoe UI', size: 10 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        colTotals[def.colIndex] = (colTotals[def.colIndex] || 0) + yearVal;
      }
    });

    // Celda Total General del Canal
    const genCell = row.getCell(totalGeneralColIndex);
    genCell.value = channelRowTotal;
    genCell.font = { bold: true, name: 'Segoe UI', size: 10 };
    genCell.numFmt = '$#,##0';
    genCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    absoluteTotal += channelRowTotal;

    rowIdx++;
  });

  // 4. Escribir Fila de Total General al Final
  const totalRow = wsTd.getRow(rowIdx);
  totalRow.getCell(1).value = 'Total general';
  totalRow.getCell(1).font = { bold: true, name: 'Segoe UI', size: 10 };
  
  colDefs.forEach(def => {
    const cell = totalRow.getCell(def.colIndex);
    cell.value = colTotals[def.colIndex] || 0;
    cell.font = { bold: true, name: 'Segoe UI', size: 10 };
    cell.numFmt = '$#,##0';
    if (def.isTotal) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    } else {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    }
  });

  // Celda Total Absoluto al final
  const absCell = totalRow.getCell(totalGeneralColIndex);
  absCell.value = absoluteTotal;
  absCell.font = { bold: true, name: 'Segoe UI', size: 10 };
  absCell.numFmt = '$#,##0';
  absCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

  // Bordes para la pestaña TD
  wsTd.eachRow((row, rIdx) => {
    if (rIdx >= 3) {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
      });
    }
  });

  // Ajustar anchos de columna en TD
  wsTd.getColumn(1).width = 25;
  for (let i = 2; i <= totalGeneralColIndex; i++) {
    wsTd.getColumn(i).width = 16;
  }

  // ==========================================
  // Generate buffer and save
  // ==========================================
  const buffer = await workbook.xlsx.writeBuffer();
  const fileType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8';
  const blob = new Blob([buffer], { type: fileType });
  saveAs(blob, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

