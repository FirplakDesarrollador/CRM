import { expect, test } from '@playwright/test';

test.describe('Activity checklist autosave', () => {
    test('persists task checklist items into local metadata for sync', async ({ page }) => {
        await page.route('**/api/microsoft/planner/tasks/planner-task-e2e', route => {
            route.fulfill({ status: 500, body: 'Planner unavailable in E2E' });
        });

        await page.goto('/e2e/activities-checklist');

        await expect(page.getByRole('heading', { name: 'Editar Actividad' })).toBeVisible();
        await page.getByPlaceholder('Nueva actividad...').fill('Actualizar datos de tarea');
        await page.locator('input[placeholder="Nueva actividad..."] + button').click();

        await expect(page.getByText('Actualizar datos de tarea')).toBeVisible();
        await expect(page.getByTestId('activity-metadata')).toContainText('Actualizar datos de tarea', { timeout: 4000 });
        await expect(page.getByTestId('activity-metadata')).toContainText('pending_planner_update');
    });
});
