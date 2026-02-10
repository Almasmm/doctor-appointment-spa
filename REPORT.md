# Doctor Appointment SPA - Final Technical Report

## 1. Project Summary
Doctor Appointment SPA is a React + Redux Toolkit single-page application for patient booking and admin schedule operations.

Runtime backend:
- `json-server` with `mock/db.json`.

Testing backend:
- fully isolated MSW in-memory handlers (`src/test/msw/handlers.ts`).

Implemented roles:
- `patient`
- `admin`

## 2. Architecture
Feature-sliced structure:
- `src/entities/*`: domain types + API clients.
- `src/features/*`: business logic (RTK slices/thunks) + container/presenter UI.
- `src/pages/*`: route-level screens.
- `src/shared/*`: UI kit, helpers, HTTP wrapper.
- `src/app/*`: router, store, providers, layouts.

Core store:
- `auth`, `catalog`, `booking`, `appointments`, `ui` in `src/app/store/index.ts`.

## 3. RBAC, Routes, Guards
Routes and guards are implemented in `src/app/router/routes.tsx`.

Access rules:
- Guest: `/`, `/login`.
- Any `/app/*`: only authenticated user (`PrivateRoute`).
- Any `/app/admin/*`: only `admin` (`AdminRoute`).

Sidebar visibility rules (`src/widgets/Sidebar/Sidebar.tsx`):
- Patient menu:
  - `/app`
  - `/app/profile`
  - `/app/catalog`
  - `/app/appointments`
- Admin menu (additional):
  - `/app/admin/doctors`
  - `/app/admin/services`
  - `/app/admin/slots`

Active-state fix:
- root dashboard link uses `end={to === '/app'}` to avoid false active highlighting on nested routes.

## 4. Authentication and Session
Implemented in `src/features/auth/model/authSlice.ts`:
- login with email/password.
- role-aware session state.
- persistence in `localStorage`.
- session restore on app boot.
- logout clears auth state and storage.

UI behavior:
- invalid credentials and server errors are surfaced as readable messages.
- login integration test is in `src/pages/LoginPage/LoginPage.integration.test.tsx`.

## 5. Patient Flows
### 5.1 Catalog
Implemented:
- doctor cards with specialty/rating/clinic.
- search + service filter.
- loading skeleton, empty state, error + retry.

### 5.2 Doctor Profile
Implemented:
- doctor details and service list.
- CTA to booking.
- loading/error handling.

### 5.3 Booking Slots
Implemented:
- slot list by doctor/date range.
- statuses: `free`, `held`, `booked`, `blocked`.
- hold creation on selection.
- previous hold release when selecting another slot.
- conflict handling (`409` => "Слот уже занят").

### 5.4 Booking Confirm
Implemented complex form with sync + async validation:
- required: `serviceId`, `appointmentType`, `reason`, `email`, `phone`.
- async reason duplicate validation.
- async email availability validation.
- pending UI and submit lock during async checks.

### 5.5 My Appointments
Implemented:
- joined list (`appointments + doctors + slots`).
- status badges (`scheduled/cancelled/completed`).
- sorting with upcoming-first behavior.
- cancel appointment with confirm dialog + pending/error/retry.
- reschedule flow (see lifecycle section).

### 5.6 Profile Cabinet
Implemented:
- user card (name/email/role).
- appointments counter badge.
- nearest upcoming appointment.
- empty nearest state when no future appointments.

## 6. Admin Flows
### 6.1 Admin Services CRUD
`src/pages/AdminServicesPage/AdminServicesPage.tsx`

Implemented:
- list.
- create.
- edit.
- delete.
- validation (required name, numeric duration/price, uniqueness).
- loading/error/retry for load and mutation.

### 6.2 Admin Doctors CRUD
`src/pages/AdminDoctorsPage/AdminDoctorsPage.tsx`

Implemented:
- list.
- create.
- edit.
- delete.
- service assignment (`serviceIds`).
- validation (required fields, rating range, valid service ids, id uniqueness).
- loading/error/retry.

### 6.3 Admin Slots Engine + Management
`src/pages/AdminSlotsPage/AdminSlotsPage.tsx`

Implemented:
- monitoring summary counters (`free/held/booked/blocked`).
- nearest slots list.
- bulk generation form:
  - doctor
  - `dateFrom/dateTo`
  - work hours
  - slot duration
- server-side generation endpoint: `POST /slots/bulk`.
- generation rules:
  - reject generation in the past.
  - skip overlapping slots.
  - return created/skipped stats.
- slot management:
  - `free -> blocked`
  - `blocked -> free`
  - mutation error + retry.

## 7. Data Model and Business Invariants
### 7.1 Status Model (STEP 19)
Implemented:
- `AppointmentStatus`: `scheduled | cancelled | completed`
- `SlotStatus`: `free | held | booked | blocked`

### 7.2 Time and Sorting Rules
Implemented:
- nearest appointment uses real time comparisons.
- profile nearest block selects closest future appointment.
- appointments list sorted with upcoming entries first.

### 7.3 Hold Rules
Implemented:
- hold TTL support.
- expired hold cleanup.
- previous hold release on re-selection.
- release hold when leaving confirm page without successful submit.

### 7.4 Appointment Lifecycle
Implemented:
- create appointment (normal booking).
- cancel appointment:
  - appointment -> `cancelled`
  - slot -> `free`
- reschedule appointment:
  - select new slot through booking flow
  - confirm updates existing appointment `slotId` and related fields
  - old slot freed
  - new slot booked

### 7.5 Cross-page Consistency
Added dedicated integration scenario:
- booking -> my appointments -> profile -> admin slots -> booking
- verifies synchronized state across screens after mutation.

## 8. API/Mock Coverage
Main endpoints covered in runtime/MSW:
- Auth/users:
  - `GET /users`
- Catalog:
  - `GET /services`
  - `GET /doctors`
- Admin Services:
  - `POST /services`
  - `PATCH /services/:id`
  - `DELETE /services/:id`
- Admin Doctors:
  - `POST /doctors`
  - `PATCH /doctors/:id`
  - `DELETE /doctors/:id`
- Slots:
  - `GET /slots`
  - `GET /slots/:id`
  - `PATCH /slots/:id`
  - `POST /slots/bulk`
- Holds:
  - `GET /slotHolds`
  - `POST /slotHolds`
  - `DELETE /slotHolds/:id`
- Appointments:
  - `GET /appointments`
  - `POST /appointments`
  - `PATCH /appointments/:id`

## 9. Testing Strategy
### 9.1 Test Layers
- Unit: reducers/selectors and pure logic.
- Integration: real store + pages + MSW + router.
- E2E: Playwright (critical user paths).

### 9.2 Key Integration Coverage
- `src/pages/BookingPage/BookingPage.integration.test.tsx`
- `src/pages/BookingConfirmPage/BookingConfirmPage.integration.test.tsx`
- `src/pages/ProfilePage/ProfilePage.integration.test.tsx`
- `src/pages/MyAppointmentsPage/MyAppointmentsPage.integration.test.tsx`
- `src/pages/AdminServicesPage/AdminServicesPage.integration.test.tsx`
- `src/pages/AdminDoctorsPage/AdminDoctorsPage.integration.test.tsx`
- `src/pages/AdminSlotsPage/AdminSlotsPage.integration.test.tsx`
- `src/app/consistency.integration.test.tsx`

### 9.3 Latest Verification Status
Latest full checks:
- `npm run test:integration` -> PASS (11 files, 52 tests)
- `npm run verify` -> PASS

`verify` pipeline (`package.json`):
- `lint`
- `typecheck`
- `test:coverage`
- `e2e`
- `build`

### 9.4 Coverage Gates
From `vitest.config.ts`:
- statements >= 75
- lines >= 80
- functions >= 70
- branches >= 60

Latest run exceeded thresholds (all gates green).

## 10. CI/CD
GitHub Actions workflow:
- file: `.github/workflows/ci.yml`
- Node 20
- steps:
  - install
  - lint
  - typecheck
  - coverage
  - e2e
  - build

This matches local `verify` philosophy and keeps quality checks deterministic in CI.

## 11. Final Status vs Roadmap
Closed and validated with PASS checks:
- STEP 19: status model + invariants
- STEP 20: admin services CRUD
- STEP 21: admin doctors CRUD
- STEP 22: slots bulk generation engine
- STEP 23: slots block/unblock management
- STEP 24: cancel appointment lifecycle
- STEP 25: reschedule appointment lifecycle
- STEP 26: hold reliability (TTL + cleanup/release)
- STEP 27: cross-page consistency scenario
- STEP 28: documentation updated to product-level report

## 12. Conclusion
The project now covers mandatory academic criteria for functionality, business logic, role security, and testing depth:
- RBAC and guarded routing are consistent.
- Patient and admin critical scenarios are implemented end-to-end.
- Core scheduling invariants (hold/TTL/conflict/status transitions) are enforced and tested.
- Quality gates (lint/typecheck/coverage/e2e/build) are automated and passing.
