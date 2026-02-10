import { expect, test } from '@playwright/test'

test('patient flow: логин и доступ к каталогу', async ({ page }) => {
  await page.goto('/login')

  await page.getByLabel('Email').fill('patient@example.com')
  await page.getByLabel('Пароль').fill('patient123')
  await page.getByRole('button', { name: 'Войти' }).click()

  await expect(page).toHaveURL(/\/app$/)

  await page.goto('/app/catalog')
  await expect(page.getByRole('heading', { name: 'Каталог врачей' })).toBeVisible()
})

test('admin flow: доступ к админ разделу', async ({ page }) => {
  await page.goto('/login')

  await page.getByLabel('Email').fill('admin@example.com')
  await page.getByLabel('Пароль').fill('admin123')
  await page.getByRole('button', { name: 'Войти' }).click()

  await page.goto('/app/admin/doctors')
  await expect(page.getByRole('heading', { name: 'Администрирование врачей' })).toBeVisible()
  await expect(page.getByText('Админ: врачи')).toBeVisible()
})
