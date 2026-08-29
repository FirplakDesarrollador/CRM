import { test, expect } from '@playwright/test';

test.describe('Module Navigation & Role Restrictions', () => {
    test('desacopla el formulario al navegar por sidebar y aísla el ID de sesión', async ({ page }) => {
        await page.goto('/e2e/module-navigation');

        // Estado inicial: lista limpia
        await expect(page.getByTestId('list-view-active')).toBeVisible();
        await expect(page.getByTestId('form-panel-active')).not.toBeVisible();

        // 1. Abrir cuenta con ID
        await page.getByTestId('open-account-btn').click();
        await expect(page.getByTestId('form-panel-active')).toBeVisible();
        await expect(page).toHaveURL(/.*id=cuenta-test-uuid/);

        // 2. Verificar que los filtros en sesión NO contienen el ID
        const sessionState = await page.getByTestId('session-storage-state').textContent();
        expect(sessionState).toContain('channel=DIST_NAC');
        expect(sessionState).not.toContain('id=');

        // 3. Clic en "Cuentas" en Sidebar -> Debe desmontar el formulario inmediatamente
        await page.getByTestId('sidebar-cuentas-btn').click();
        await expect(page.getByTestId('form-panel-active')).not.toBeVisible();
        await expect(page.getByTestId('list-view-active')).toBeVisible();
        await expect(page).not.toHaveURL(/.*id=/);
    });

    test('restringe la visibilidad de módulos en el sidebar según el rol del usuario', async ({ page }) => {
        await page.goto('/e2e/module-navigation');

        // Por defecto rol ASESOR: módulos admin no deben aparecer
        await page.getByTestId('role-asesor-btn').click();
        await expect(page.getByTestId('nav-item-cuentas')).toBeVisible();
        await expect(page.getByTestId('nav-item-oportunidades')).toBeVisible();
        await expect(page.getByTestId('nav-item-inventarios')).not.toBeVisible();
        await expect(page.getByTestId('nav-item-informes')).not.toBeVisible();
        await expect(page.getByTestId('nav-item-usuarios')).not.toBeVisible();

        // Cambiar a rol ADMIN: módulos protegidos deben ser visibles
        await page.getByTestId('role-admin-btn').click();
        await expect(page.getByTestId('nav-item-inventarios')).toBeVisible();
        await expect(page.getByTestId('nav-item-informes')).toBeVisible();
        await expect(page.getByTestId('nav-item-usuarios')).toBeVisible();
    });
});
