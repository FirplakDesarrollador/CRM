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
      let val = item[col.key as keyof T];
      if (val === null || val === undefined) val = '';
      // Escape quotes
      val = String(val).replace(/"/g, '""');
      return `"${val}"`;
    }).join(delimiter);
  });

  const csvContent = [headers, ...rows].join('\n');
  
  // Add BOM for UTF-8 support in Excel
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
};
