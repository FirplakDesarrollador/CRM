import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Resolver, useForm, UseFormReturn } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFormAutoSave } from './useFormAutoSave';

type TestForm = { nombre: string };

describe('useFormAutoSave', () => {
    let container: HTMLDivElement;
    let root: Root;
    let formApi: UseFormReturn<TestForm> | undefined;
    const saves: TestForm[] = [];

    beforeEach(() => {
        vi.useFakeTimers();
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        saves.length = 0;
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        vi.useRealTimers();
    });

    it('does not cancel a one-change autosave when the inline callback changes on render', async () => {
        function Harness() {
            const form = useForm<TestForm>({ defaultValues: { nombre: '' } });
            formApi = form;
            useFormAutoSave({
                form,
                onSave: async data => {
                    saves.push({ ...data });
                },
                debounceMs: 100,
                isEnabled: true
            });
            return null;
        }

        await act(async () => root.render(<Harness />));
        await act(async () => {
            formApi?.setValue('nombre', 'Cuenta renombrada');
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(101);
        });

        expect(saves).toEqual([{ nombre: 'Cuenta renombrada' }]);
    });

    it('returns error status and errorMessage when onSave throws an error', async () => {
        let statusResult = '';
        let errorResult: string | null = null;

        function Harness() {
            const form = useForm<TestForm>({ defaultValues: { nombre: '' } });
            formApi = form;
            const { status, errorMessage } = useFormAutoSave({
                form,
                onSave: async () => {
                    throw new Error('Fallo al guardar cuenta');
                },
                debounceMs: 100,
                isEnabled: true
            });
            statusResult = status;
            errorResult = errorMessage ?? null;
            return null;
        }

        await act(async () => root.render(<Harness />));
        await act(async () => {
            formApi?.setValue('nombre', 'Cambio invalido');
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(101);
        });

        expect(statusResult).toBe('error');
        expect(errorResult).toBe('Fallo al guardar cuenta');
    });

    it('extracts field validation error when form.trigger() fails', async () => {
        let statusResult = '';
        let errorResult: string | null = null;

        function Harness() {
            const resolver: Resolver<TestForm> = async (values) => {
                if (!values.nombre || values.nombre.length < 2) {
                    return {
                        values: {} as Record<string, never>,
                        errors: {
                            nombre: {
                                type: 'min',
                                message: 'Nombre requerido'
                            }
                        }
                    };
                }
                return { values, errors: {} as Record<string, never> };
            };

            const form = useForm<TestForm>({
                defaultValues: { nombre: '' },
                resolver
            });
            formApi = form;
            const { status, errorMessage } = useFormAutoSave({
                form,
                onSave: async () => {},
                debounceMs: 100,
                isEnabled: true
            });
            statusResult = status;
            errorResult = errorMessage ?? null;
            return null;
        }

        await act(async () => root.render(<Harness />));
        await act(async () => {
            formApi?.setValue('nombre', 'a');
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(101);
        });

        expect(statusResult).toBe('error');
        expect(errorResult).toBe('nombre: Nombre requerido');
    });
});


