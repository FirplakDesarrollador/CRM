/**
 * Utilidades para que las filas de las tablas (Handsontable) se comporten como
 * enlaces reales: clic central, Ctrl/Cmd+clic y clic derecho -> "Abrir en pestaña
 * nueva" abren la página en una pestaña nueva sin mover la pestaña actual.
 */

/** Clic "de pestaña nueva": botón central o Ctrl/Cmd/Shift + clic. */
export function isNewTabClick(event: { button?: number; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean } | null | undefined): boolean {
    if (!event) return false;
    return event.button === 1 || Boolean(event.ctrlKey || event.metaKey || event.shiftKey);
}

/**
 * Envuelve el contenido ya renderizado de una celda en un <a href> real.
 * El clic primario se cancela (la navegación la hace la tabla); el navegador solo actúa
 * en clic central y clic derecho -> "Abrir en pestaña nueva".
 */
export function wrapCellInRowLink(td: HTMLTableCellElement, href: string): void {
    if (typeof document === 'undefined' || !href) return;
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.className = 'opp-row-link';
    anchor.draggable = false;
    anchor.style.cssText = 'display:block;width:100%;height:100%;color:inherit;text-decoration:none;';
    // El clic primario (izquierdo, Ctrl, Cmd, Shift) lo gestiona la tabla en mousedown; el navegador
    // solo debe actuar de forma nativa en clic central ("auxclick") y en el menú contextual.
    anchor.addEventListener('click', (e) => e.preventDefault());
    while (td.firstChild) anchor.appendChild(td.firstChild);
    td.appendChild(anchor);
}

/**
 * Respaldo para clics fuera de un <a> (p. ej. el padding de la celda): simula un
 * Ctrl/Cmd+clic sobre un enlace temporal para que el navegador abra la pestaña
 * en segundo plano, sin quitar el foco de la pestaña actual.
 */
export function openLinkInBackgroundTab(href: string): void {
    if (typeof document === 'undefined' || !href) return;
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    const isMac = /Mac|iPhone|iPad/i.test(navigator.platform || '');
    anchor.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
        ctrlKey: !isMac,
        metaKey: isMac,
    }));
    document.body.removeChild(anchor);
}
