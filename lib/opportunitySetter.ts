/**
 * Options available for the "Setter" field of an opportunity
 * (`CRM_Oportunidades.setter`, TEXT NULL). A null/empty value means "Ninguna".
 *
 * The column is free text, so adding a new option only requires adding it here.
 */
export const OPPORTUNITY_SETTER_OPTIONS = [
    { value: 'CO', label: 'CO' },
    { value: 'REC', label: 'REC' },
] as const;

export type OpportunitySetterValue = (typeof OPPORTUNITY_SETTER_OPTIONS)[number]['value'];
