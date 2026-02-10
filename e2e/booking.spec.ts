import { expect, test } from '@playwright/test'

test('patient booking flow: каталог -> слоты -> подтверждение -> мои записи', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('patient@example.com')
  await page.getByLabel('Пароль').fill('patient123')
  await page.getByRole('button', { name: 'Войти' }).click()

  await page.goto('/app/catalog')
  await expect(page.getByRole('heading', { name: 'Каталог врачей' })).toBeVisible()

  await page.getByRole('link', { name: 'Профиль' }).first().click()
  await expect(page.getByRole('heading', { name: 'Профиль врача' })).toBeVisible()

  await page.getByRole('button', { name: 'Перейти к записи' }).click()
  await expect(page.getByRole('heading', { name: 'Выбор времени приема' })).toBeVisible()

  const chooseButtons = page.getByRole('button', { name: 'Выбрать' })
  await expect(chooseButtons.first()).toBeVisible()
  await chooseButtons.first().click()

  const continueButton = page.getByRole('button', { name: 'Продолжить' })
  await expect(continueButton).toBeVisible()
  await expect(continueButton).toBeEnabled()
  await continueButton.click()

  await expect(page.getByRole('heading', { name: 'Подтверждение записи' })).toBeVisible()
  const reason = `Плановая проверка состояния и консультация ${Date.now()}`
  await page.getByLabel('Телефон').fill('+77011234567')
  await page.getByLabel('Причина обращения').fill(reason)
  await page.getByLabel('Онлайн').check()
  await page.getByRole('button', { name: 'Подтвердить' }).click()

  await expect(page).toHaveURL(/\/app\/appointments/)
  await expect(page.getByRole('heading', { name: 'Мои записи' })).toBeVisible()
  await expect(page.getByText(reason).first()).toBeVisible()
})
