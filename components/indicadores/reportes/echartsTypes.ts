// Minimal typing for the ECharts callback params this app actually reads
// (avoids `any` in click handlers/tooltip formatters across the indicadores
// report pages without depending on echarts' full, deeply-generic types).
export interface EChartsCallbackParams {
    name?: string;
    seriesName?: string;
    value?: number | string;
    percent?: number;
    data?: {
        id?: string | number;
        bucket?: string;
        value?: number;
        count?: number;
        [key: string]: unknown;
    };
}
