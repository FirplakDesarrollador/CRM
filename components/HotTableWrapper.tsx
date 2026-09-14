import { forwardRef } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import { registerLanguageDictionary, esMX } from 'handsontable/i18n';

import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';

// Registrar todos los módulos y el diccionario en español
registerAllModules();
registerLanguageDictionary(esMX);

const HotTableWrapper = forwardRef<any, any>(function HotTableWrapper(props, ref) {
    // Si se pasa dropdownMenu como true, lo cambiamos para que solo muestre el filtro por valor
    const customProps: any = {
        manualColumnResize: true,
        language: props?.language || esMX.languageCode,
        ...props
    };
    if (customProps.dropdownMenu === true) {
        customProps.dropdownMenu = ['filter_by_value', 'filter_action_bar'];
    }
    
    return <HotTable ref={ref} {...customProps} />;
});

export default HotTableWrapper;
