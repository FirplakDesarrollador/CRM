/**
 * Helpers compartidos por los hooks de listas (oportunidades, cuentas, contactos).
 */

/**
 * true si ambos arrays tienen los mismos valores en el mismo orden.
 * Se usa para conservar la referencia del estado y evitar que un array "nuevo pero igual"
 * vuelva a disparar la consulta completa de la lista.
 */
export function sameArrayValues<T>(a: readonly T[] | null | undefined, b: readonly T[] | null | undefined): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}
