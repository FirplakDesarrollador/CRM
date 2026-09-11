import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase', () => ({
    supabase: {
        from: vi.fn(),
        auth: {
            getUser: vi.fn()
        }
    }
}));

import { searchMicrosoftUsers } from '@/lib/microsoft';

describe('searchMicrosoftUsers - Búsqueda de colaboradores Microsoft Tenant', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('encuentra colaboradores usando /users con $search en Azure AD', async () => {
        const mockUsers = [
            {
                id: 'aad-guid-123',
                displayName: 'Luis Guillermo Escobar',
                mail: 'luis.escobar@firplak.com',
                userPrincipalName: 'luis.escobar@firplak.com',
                jobTitle: 'Director Comercial'
            }
        ];

        // Mock fetch to simulate Graph API /users?$search
        global.fetch = vi.fn().mockImplementation(async (url: string) => {
            if (url.includes('/users?$search=')) {
                return {
                    ok: true,
                    json: async () => ({ value: mockUsers })
                };
            }
            return {
                ok: false,
                status: 400,
                text: async () => 'Not found'
            };
        });

        const results = await searchMicrosoftUsers('fake-access-token', 'luis');
        expect(results).toHaveLength(1);
        expect(results[0].id).toBe('aad-guid-123');
        expect(results[0].displayName).toBe('Luis Guillermo Escobar');
        expect(results[0].mail).toBe('luis.escobar@firplak.com');
    });

    it('si /users $search viene vacío o falla, recurre a $filter o People API sin retornar vacío prematuramente', async () => {
        // Simular que $search no trajo nada, pero $filter sí encuentra
        const mockFilterUsers = [
            {
                id: 'aad-guid-456',
                displayName: 'Luis Carlos Isaza',
                mail: 'luis.isaza@firplak.com',
                userPrincipalName: 'luis.isaza@firplak.com',
                jobTitle: 'Asesor'
            }
        ];

        global.fetch = vi.fn().mockImplementation(async (url: string) => {
            if (url.includes('/users?$search=')) {
                return {
                    ok: true,
                    json: async () => ({ value: [] }) // Vacío en $search
                };
            }
            if (url.includes('/users?$filter=')) {
                return {
                    ok: true,
                    json: async () => ({ value: mockFilterUsers })
                };
            }
            return {
                ok: false,
                status: 404,
                text: async () => 'Not found'
            };
        });

        const results = await searchMicrosoftUsers('fake-access-token', 'luis');
        expect(results).toHaveLength(1);
        expect(results[0].displayName).toBe('Luis Carlos Isaza');
    });
});
