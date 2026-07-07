"use client";

import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';

import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';

// Registrar todos los módulos necesarios
registerAllModules();

export default function HotTableWrapper(props: any) {
    return <HotTable {...props} />;
}
