"use client";

import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';

import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';

// Registrar todos los módulos necesarios
registerAllModules();

export default function HotTableWrapper(props: any) {
    // Si se pasa dropdownMenu como true, lo cambiamos para que solo muestre el filtro por valor
    const customProps = { ...props };
    if (customProps.dropdownMenu === true) {
        customProps.dropdownMenu = ['filter_by_value', 'filter_action_bar'];
    }
    
    return <HotTable {...customProps} />;
}
