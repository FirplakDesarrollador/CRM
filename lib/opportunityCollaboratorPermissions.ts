import type { UserRole } from '@/lib/stores/useUserStore';

interface CollaboratorEditContext {
    userId?: string;
    role: UserRole | null;
    ownerId?: string;
    ownerCoordinatorIds?: string[] | null;
}

export function canEditOpportunityCollaborators({
    userId,
    role,
    ownerId,
    ownerCoordinatorIds,
}: CollaboratorEditContext): boolean {
    if (!userId || !ownerId) return false;

    return role === 'ADMIN'
        || userId === ownerId
        || (role === 'COORDINADOR' && Boolean(ownerCoordinatorIds?.includes(userId)));
}
