import { describe, expect, it } from 'vitest';
import { canEditOpportunityCollaborators } from '@/lib/opportunityCollaboratorPermissions';

const ownerId = 'owner-id';

function canEdit(overrides: Partial<Parameters<typeof canEditOpportunityCollaborators>[0]> = {}) {
    return canEditOpportunityCollaborators({
        userId: 'current-user-id',
        role: 'VENDEDOR',
        ownerId,
        ownerCoordinatorIds: [],
        ...overrides,
    });
}

describe('canEditOpportunityCollaborators', () => {
    it('allows the opportunity owner', () => {
        expect(canEdit({ userId: ownerId })).toBe(true);
    });

    it('allows an administrator', () => {
        expect(canEdit({ role: 'ADMIN' })).toBe(true);
    });

    it('allows only a coordinator assigned to the owner', () => {
        expect(canEdit({ role: 'COORDINADOR', ownerCoordinatorIds: ['current-user-id'] })).toBe(true);
        expect(canEdit({ role: 'COORDINADOR', ownerCoordinatorIds: ['another-coordinator'] })).toBe(false);
    });

    it('rejects other sellers and missing ownership context', () => {
        expect(canEdit()).toBe(false);
        expect(canEdit({ ownerId: undefined })).toBe(false);
    });
});
