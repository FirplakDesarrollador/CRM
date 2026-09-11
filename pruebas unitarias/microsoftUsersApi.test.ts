import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('next/headers', () => ({
    cookies: async () => ({
        getAll: () => [],
        get: () => undefined
    })
}));

vi.mock('@supabase/ssr', () => ({
    createServerClient: () => ({
        auth: {
            getUser: mockGetUser
        },
        from: mockFrom
    })
}));

vi.mock('@/lib/supabase/server', () => ({
    createClient: async () => ({
        auth: {
            getUser: mockGetUser
        },
        from: mockFrom
    })
}));

vi.mock('@/lib/microsoft', () => ({
    getMicrosoftTokens: vi.fn().mockResolvedValue(null),
    searchMicrosoftUsers: vi.fn().mockResolvedValue([])
}));

import { GET } from '@/app/api/microsoft/users/route';

describe('GET /api/microsoft/users', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('devuelve colaboradores de CRM_Usuarios cuando no hay tokens o graph no tiene resultados', async () => {
        mockGetUser.mockResolvedValue({
            data: { user: { id: 'user-123', email: 'test@firplak.com' } },
            error: null
        });

        const mockDbUsers = [
            {
                id: 'crm-user-1',
                full_name: 'Luis Guillermo Escobar',
                email: 'luis.escobar@firplak.com',
                role: 'ADMIN'
            }
        ];

        mockFrom.mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    or: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue({ data: mockDbUsers, error: null })
                    })
                }),
                order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [], error: null })
                })
            })
        });

        const req = new NextRequest('http://localhost:3000/api/microsoft/users?q=lu');
        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(Array.isArray(data)).toBe(true);
        expect(data).toHaveLength(1);
        expect(data[0].displayName).toBe('Luis Guillermo Escobar');
    });

    it('devuelve colaboradores incluso si supabase.auth.getUser() da error o no hay cookie auth', async () => {
        mockGetUser.mockResolvedValue({
            data: { user: null },
            error: new Error('Auth session missing')
        });

        const mockDbUsers = [
            {
                id: 'crm-user-1',
                full_name: 'Luis Guillermo Escobar',
                email: 'luis.escobar@firplak.com',
                role: 'ADMIN'
            }
        ];

        mockFrom.mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    or: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue({ data: mockDbUsers, error: null })
                    })
                }),
                order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [], error: null })
                })
            })
        });

        const req = new NextRequest('http://localhost:3000/api/microsoft/users?q=lu');
        const res = await GET(req);
        const data = await res.json();

        // Si la sesión falla, no debería responder 401 bloqueando la UI del CRM
        expect(res.status).toBe(200);
        expect(Array.isArray(data)).toBe(true);
    });
});
