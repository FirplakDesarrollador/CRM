import { describe, expect, it } from 'vitest';
import { userSchema } from '@/lib/userValidation';

describe('userSchema validation', () => {
    const baseValidUser = {
        email: 'analista2.desarrollo@firplak.com',
        full_name: 'Esteban Muñoz Garcia',
        role: 'ADMIN' as const,
        telefono: '3218722817',
    };

    it('acepta contraseña vacía ("") para no modificarla al editar usuario', () => {
        const result = userSchema.safeParse({
            ...baseValidUser,
            password: '',
        });
        expect(result.success).toBe(true);
    });

    it('acepta contraseña undefined', () => {
        const result = userSchema.safeParse({
            ...baseValidUser,
        });
        expect(result.success).toBe(true);
    });

    it('acepta contraseña válida de 6 o más caracteres', () => {
        const result = userSchema.safeParse({
            ...baseValidUser,
            password: 'password123',
        });
        expect(result.success).toBe(true);
    });

    it('rechaza contraseña corta de menos de 6 caracteres si se ingresa texto', () => {
        const result = userSchema.safeParse({
            ...baseValidUser,
            password: '123',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0].message).toContain('al menos 6 caracteres');
        }
    });

    it('acepta el campo telefono opcional', () => {
        const resultWithPhone = userSchema.safeParse({
            ...baseValidUser,
            telefono: '+57 321 872 2817',
        });
        expect(resultWithPhone.success).toBe(true);

        const resultWithoutPhone = userSchema.safeParse({
            ...baseValidUser,
            telefono: undefined,
        });
        expect(resultWithoutPhone.success).toBe(true);
    });
});
