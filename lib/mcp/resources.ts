/**
 * Exposición de Recursos Nativos MCP (Resources)
 * Permite a los clientes LLM leer catálogos y métricas sin consumir llamadas a herramientas.
 */
import {
  CANALES_REFERENCIA,
  FASES_POR_CANAL,
  CLASIFICACIONES_ACTIVIDAD,
  MOTIVOS_PERDIDA,
  ORIGENES_OPORTUNIDAD,
  CrmDatabaseAdapter,
} from './database';

export interface McpResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export function listCrmResources(): McpResourceDefinition[] {
  return [
    {
      uri: 'crm://canales',
      name: 'Canales de Venta Firplak',
      description: 'Los 5 canales inmutables comerciales con sus listas de precios asociadas',
      mimeType: 'application/json',
    },
    {
      uri: 'crm://fases/OBRAS_NAC',
      name: 'Fases de Venta - Obras Nacionales',
      description: 'Etapas ordenadas con probabilidades para el canal Obras Nacionales',
      mimeType: 'application/json',
    },
    {
      uri: 'crm://fases/DIST_NAC',
      name: 'Fases de Venta - Distribución Nacional',
      description: 'Etapas comerciales para Distribución Nacional',
      mimeType: 'application/json',
    },
    {
      uri: 'crm://fases/PROPIO',
      name: 'Fases de Venta - Puntos Propios',
      description: 'Etapas comerciales para Puntos Propios / Retail',
      mimeType: 'application/json',
    },
    {
      uri: 'crm://clasificaciones-actividad',
      name: 'Clasificaciones de Actividades',
      description: 'Catálogo de tipos de tarea y evento para agenda comercial',
      mimeType: 'application/json',
    },
    {
      uri: 'crm://motivos-perdida',
      name: 'Motivos de Pérdida Oficiales',
      description: 'Causales estandarizadas de descarte de oportunidades',
      mimeType: 'application/json',
    },
    {
      uri: 'crm://origenes-oportunidad',
      name: 'Orígenes de Oportunidad',
      description: 'Catálogo de procedencia de leads y negocios comerciales',
      mimeType: 'application/json',
    },
    {
      uri: 'crm://metricas-embudo',
      name: 'Métricas Resumidas del Pipeline',
      description: 'Totales agregados de oportunidades por fase',
      mimeType: 'application/json',
    },
  ];
}

export async function readCrmResource(
  uri: string,
  db: CrmDatabaseAdapter
): Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> {
  let data: unknown = null;

  if (uri === 'crm://canales') {
    data = CANALES_REFERENCIA;
  } else if (uri.startsWith('crm://fases/')) {
    const canalId = uri.replace('crm://fases/', '').toUpperCase();
    data = FASES_POR_CANAL[canalId] || { error: `Canal ${canalId} no encontrado` };
  } else if (uri === 'crm://clasificaciones-actividad') {
    data = CLASIFICACIONES_ACTIVIDAD;
  } else if (uri === 'crm://motivos-perdida') {
    data = MOTIVOS_PERDIDA;
  } else if (uri === 'crm://origenes-oportunidad') {
    data = ORIGENES_OPORTUNIDAD;
  } else if (uri === 'crm://metricas-embudo') {
    const opps = Array.from(db.getMemory().opportunities.values()).filter((o) => !o.is_deleted);
    const totalMonto = opps.reduce((sum, o) => sum + (Number(o.valor) || 0), 0);
    data = {
      total_oportunidades_activas: opps.length,
      monto_total_pipeline_cop: totalMonto,
      distribucion_canal: {
        OBRAS_NAC: opps.filter((o) => o.canal_id === 'OBRAS_NAC').length,
        DIST_NAC: opps.filter((o) => o.canal_id === 'DIST_NAC').length,
        PROPIO: opps.filter((o) => o.canal_id === 'PROPIO').length,
      },
    };
  } else {
    throw new Error(`Recurso no encontrado: ${uri}`);
  }

  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}
