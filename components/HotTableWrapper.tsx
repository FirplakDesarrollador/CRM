"use client";

import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';

// Registrar todos los módulos necesarios
registerAllModules();

export default function HotTableWrapper(props: any) {
    return <HotTable {...props} />;
}
