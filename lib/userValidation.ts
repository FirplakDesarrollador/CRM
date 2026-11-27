import { z } from 'zod';

export const userSchema = z.object({
    email: z.string().refine(val => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((val || "").trim()), { message: "Email inválido" }),
    password: z.string()
        .optional()
        .refine(val => !val || val.trim() === '' || val.length >= 6, {
            message: 'La contraseña debe tener al menos 6 caracteres',
        }),
    full_name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    telefono: z.string().optional(),
    role: z.enum(['ADMIN', 'COORDINADOR', 'VENDEDOR']),
    allowed_modules: z.array(z.string()).optional(),
    coordinadores: z.array(z.string()).optional(),
    pais: z.string().optional(),
    departamento: z.string().optional(),
    paises: z.array(z.string()).optional(),
    departamentos: z.array(z.string()).optional(),
    canales: z.array(z.string()).optional(),
    zona_id: z.string().optional().nullable(),
});

export type UserFormData = z.infer<typeof userSchema>;
