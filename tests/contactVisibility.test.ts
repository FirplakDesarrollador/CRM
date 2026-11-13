import { describe, expect, it } from 'vitest';
import { shouldRestrictContactsByAccountOwner, filterContactsForUser } from '@/lib/contactVisibility';

describe('contactVisibility', () => {
    describe('shouldRestrictContactsByAccountOwner', () => {
        it('returns false for VENDEDOR so sellers can find all contacts by phone/email/name', () => {
            expect(shouldRestrictContactsByAccountOwner('VENDEDOR')).toBe(false);
        });

        it('returns false for COORDINADOR', () => {
            expect(shouldRestrictContactsByAccountOwner('COORDINADOR')).toBe(false);
        });

        it('returns false for ADMIN', () => {
            expect(shouldRestrictContactsByAccountOwner('ADMIN')).toBe(false);
        });

        it('returns false for undefined role', () => {
            expect(shouldRestrictContactsByAccountOwner(undefined)).toBe(false);
        });
    });

    describe('filterContactsForUser', () => {
        const sampleContacts = [
            { id: '1', account_id: 'acc-1', nombre: 'Tatiana', telefono: '3023887689' },
            { id: '2', account_id: 'acc-2', nombre: 'Sandra Jiménez', telefono: '3007367088' },
            { id: '3', account_id: 'acc-3', nombre: 'Carlos Ruiz', telefono: '3101234567' }
        ];

        it('does not filter out contacts belonging to other owners when role is VENDEDOR', () => {
            const myAccounts = new Set(['acc-1']);
            const result = filterContactsForUser(sampleContacts, {
                role: 'VENDEDOR',
                userAccountIds: myAccounts
            });
            expect(result).toHaveLength(3);
            expect(result.map(c => c.telefono)).toContain('3007367088');
        });
    });
});
