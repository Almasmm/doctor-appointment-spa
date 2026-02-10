# Doctor Appointment SPA

Полноценное SPA-приложение для записи к врачу с ролями `patient/admin`, защищённой маршрутизацией, мок-бэкендом и многоуровневым тестированием.

Проект выполнен на `React + TypeScript + Redux Toolkit + MSW + Vitest + Playwright` и собран как production-ready учебный capstone.

---

## 1. Что реализовано

### 1.1 Авторизация и сессия

- Вход по `email/password`.
- Роли: `patient`, `admin`.
- Защищённые роуты:
  - любой `/app/*` только после логина;
  - любой `/app/admin/*` только для `admin`.
- Сессия сохраняется в `localStorage`.
- Logout очищает сессию и делает редирект.
- Расширенный auth flow:
  - `signup`;
  - `verify account` по токену;
  - `forgot password`;
  - `reset password`.

### 1.2 Пациентский функционал

- Каталог врачей:
  - поиск по ФИО/специализации;
  - фильтр по услуге;
  - loading/error/empty/retry.
- Профиль врача.
- Booking flow:
  - выбор слота;
  - hold слота;
  - release предыдущего hold при перевыборе;
  - обработка конфликтов (409).
- Подтверждение записи (сложная форма):
  - `serviceId`, `appointmentType`, `reason`, `email`, `phone`;
  - sync + async validation (reason duplicate, email availability);
  - pending states и блокировки submit.
- Мои записи:
  - список + сортировка;
  - статусы `scheduled/cancelled/completed`;
  - отмена записи;
  - перенос записи (reschedule).
- Профиль:
  - сводка пользователя;
  - бейдж количества записей;
  - ближайшая будущая запись.

### 1.3 Админский функционал

- `Admin: услуги` - CRUD.
- `Admin: врачи` - CRUD + привязка `serviceIds`.
- `Admin: слоты`:
  - мониторинг (`free/held/booked/blocked`);
  - bulk-генерация слотов;
  - block/unblock.
- `Admin: записи`:
  - обзор записей;
  - фильтры по врачу/статусу/дате;
  - смена статусов (`completed/cancelled`);
  - освобождение слота при отмене.

### 1.4 Бизнес-инварианты

- Статусы:
  - `AppointmentStatus`: `scheduled | cancelled | completed`
  - `SlotStatus`: `free | held | booked | blocked`
- Hold TTL и cleanup.
- Корректные переходы статусов при booking/cancel/reschedule.
- Консистентность данных между страницами (интеграционный сценарий).

---

## 2. Технологии

- React 19 + TypeScript
- Redux Toolkit (slice + async thunk)
- React Router v6 (nested routes, guards, lazy)
- React Hook Form + Zod
- Tailwind CSS
- JSON Server (runtime mock API)
- MSW (integration tests backend isolation)
- Vitest + Testing Library (unit/integration)
- Playwright (E2E)

---

## 3. Архитектура

Проект следует FSD-структуре и разделению Container/Presenter:

```text
src/
  app/         # store, router, providers, layouts
  entities/    # types + api клиентов по сущностям
  features/    # бизнес-логика и контейнеры фич
  pages/       # route-level страницы
  widgets/     # крупные композиционные блоки (Header, Sidebar)
  shared/      # ui-kit, lib, utils
  test/msw/    # handlers + server для integration
```

Пример data flow:

1. UI событие на странице.
2. Dispatch async thunk / вызов entity api.
3. Запрос в mock backend (json-server или MSW).
4. Обновление store/state.
5. Перерисовка presenter-компонентов.

---

## 4. RBAC и роуты

### Public

- `/`
- `/login`
- `/signup`
- `/verify/:token`
- `/forgot-password`
- `/reset-password/:token`

### Private (`/app/*`)

- `/app`
- `/app/profile`
- `/app/catalog`
- `/app/doctor/:doctorId`
- `/app/booking/:doctorId`
- `/app/booking/:doctorId/confirm`
- `/app/appointments`

### Admin only (`/app/admin/*`)

- `/app/admin/doctors`
- `/app/admin/services`
- `/app/admin/slots`
- `/app/admin/appointments`

Sidebar показывает только доступные по роли пункты.

---

## 5. API (mock)

Ключевые endpoints:

- Auth:
  - `POST /auth/signup`
  - `POST /auth/login`
  - `POST /auth/verify`
  - `POST /auth/forgot-password`
  - `POST /auth/reset-password`
- Data:
  - `GET/POST/PATCH/DELETE /services`
  - `GET/POST/PATCH/DELETE /doctors`
  - `GET /slots`
  - `GET /slots/:slotId`
  - `PATCH /slots/:slotId`
  - `POST /slots/bulk`
  - `GET/POST/DELETE /slotHolds`
  - `GET/POST/PATCH /appointments`
  - `GET /users`

---

## 6. Быстрый старт

### 6.1 Установка

```bash
npm install
```

### 6.2 Запуск фронта + API

```bash
npm run dev:full
```

- Frontend: `http://localhost:5173`
- API: `http://127.0.0.1:3001`

### 6.3 Только фронт

```bash
npm run dev
```

### 6.4 Только API

```bash
npm run api
```

### 6.5 ENV

Создай `.env` на основе `.env.example`:

```env
VITE_API_BASE=http://127.0.0.1:3001
```

---

## 7. Тестовые аккаунты

- Пациент: `patient@example.com / patient123`
- Админ: `admin@example.com / admin123`

---

## 8. Команды проекта

```bash
npm run dev
npm run api
npm run dev:full
npm run lint
npm run typecheck
npm run test
npm run test:integration
npm run test:coverage
npm run e2e
npm run build
npm run verify
```

`npm run verify` = полный quality gate:

1. lint
2. typecheck
3. coverage
4. e2e
5. build

Перед `e2e` и `verify` база автоматически сбрасывается:

```bash
npm run db:reset
```

---

## 9. Качество и покрытие

- Unit + Integration + E2E слои.
- MSW-изолированные integration тесты.
- Покрытие и gates настроены в `vitest.config.ts`.
- Последний `verify`: PASS.

---

## 10. Как показать преподавателю (демо-сценарий)

1. Запусти проект:
   - `npm install`
   - `npm run dev:full`
2. Покажи quality gates:
   - `npm run test:integration`
   - `npm run verify`
3. Пройди user-flow:
   - signup -> verify -> login -> booking -> my appointments -> cancel/reschedule.
4. Пройди admin-flow:
   - services CRUD -> doctors CRUD -> slots generation/block -> appointments management.
5. Покажи отчёт:
   - `REPORT.md`.

---

## 11. Пошаговый push на GitHub

### Вариант A: первый push (если репозиторий ещё не инициализирован)

1. Создай пустой репозиторий на GitHub (`без README/.gitignore/license`).
2. В проекте выполни:

```bash
git init
git branch -M main
git add .
git commit -m "feat: production-ready doctor appointment spa"
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

### Вариант B: если git уже есть локально

```bash
git add .
git commit -m "docs: update README with full project guide"
git push
```

Если remote ещё не привязан:

```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

### Проверка перед пушем (рекомендуется)

```bash
npm run verify
```

---

## 12. Полезные файлы

- Основной отчёт: `REPORT.md`
- Роуты и guards: `src/app/router/routes.tsx`
- MSW handlers: `src/test/msw/handlers.ts`
- Auth logic: `src/features/auth/model/authSlice.ts`
- Booking logic: `src/features/booking/model/bookingSlice.ts`

---

## 13. Deployment plan (теоретически)

Вариант: Vercel / Netlify.

- Build command: `npm run build`
- Output directory: `dist`
- API в проде можно заменить на реальный backend (сейчас mock/json-server).

