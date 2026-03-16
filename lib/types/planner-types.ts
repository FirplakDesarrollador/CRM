/**
 * Microsoft Planner Integration Types
 * 
 * These types define the metadata structure stored in the database
 * when a CRM activity is synchronized with Microsoft Planner.
 */

export interface PlannerMetadata {
    /** Microsoft 365 Group ID */
    groupId: string;

    /** Display name of the Microsoft 365 Group */
    groupName: string;

    /** Planner Plan ID */
    planId: string;

    /** Title of the Planner Plan */
    planTitle: string;

    /** Planner Bucket ID (column in the plan) */
    bucketId: string;

    /** Name of the Planner Bucket */
    bucketName: string;

    /** ID of the created task in Planner (optional if creation failed) */
    plannerId?: string;

    /** Direct web URL to view the task in Planner */
    webUrl?: string;

    /** List of assigned collaborators */
    assignees?: Array<{
        id: string;
        name: string;
        email: string;
    }>;

    /** Checklist items added to the Planner task */
    checklist?: string[];

    /** Timestamp when the task was created in Planner */
    createdAt: string;
}

/**
 * Helper function to construct the web URL for a Planner task
 */
export function buildPlannerTaskUrl(groupId: string, planId: string): string {
    return `https://tasks.office.com/${groupId}/Home/Planner#/plantaskboard?groupId=${groupId}&planId=${planId}`;
}

/**
 * Helper function to parse Planner metadata from JSON string
 */
export function parsePlannerMetadata(json: string | null | undefined): PlannerMetadata | null {
    if (!json) return null;

    try {
        return JSON.parse(json) as PlannerMetadata;
    } catch (error) {
        console.error('[PlannerMetadata] Failed to parse:', error);
        return null;
    }
}
