import { lazy, Suspense, type PropsWithChildren, type ReactElement } from 'react'
import { Navigate, useLocation, type RouteObject } from 'react-router-dom'
import { useAppSelector } from '@/app/store/hooks'
import { selectIsAuthed, selectRole } from '@/features/auth/model'
import { AppLayout } from '@/app/layouts/AppLayout'
import { PublicLayout } from '@/app/layouts/PublicLayout'
import { GlobalErrorBoundary, LocalErrorBoundary } from '@/app/providers/ErrorBoundary'
import { Skeleton } from '@/shared/ui/Skeleton'

const LandingPage = lazy(() => import('@/pages/LandingPage'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const SignupPage = lazy(() => import('@/pages/SignupPage'))
const VerifyPage = lazy(() => import('@/pages/VerifyPage'))
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const ProfilePage = lazy(() => import('@/pages/ProfilePage'))
const CatalogPage = lazy(() => import('@/pages/CatalogPage'))
const DoctorProfilePage = lazy(() => import('@/pages/DoctorProfilePage'))
const BookingPage = lazy(() => import('@/pages/BookingPage'))
const BookingConfirmPage = lazy(() => import('@/pages/BookingConfirmPage'))
const MyAppointmentsPage = lazy(() => import('@/pages/MyAppointmentsPage'))
const AdminDoctorsPage = lazy(() => import('@/pages/AdminDoctorsPage'))
const AdminServicesPage = lazy(() => import('@/pages/AdminServicesPage'))
const AdminSlotsPage = lazy(() => import('@/pages/AdminSlotsPage'))
const AdminAppointmentsPage = lazy(() => import('@/pages/AdminAppointmentsPage'))

function RouteFallback() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-8 w-52" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  )
}

function withSuspense(element: ReactElement) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>
}

function withLocalErrorBoundary(element: ReactElement) {
  return <LocalErrorBoundary>{element}</LocalErrorBoundary>
}

export function PrivateRoute({ children }: PropsWithChildren): ReactElement {
  const isAuthed = useAppSelector(selectIsAuthed)
  const location = useLocation()

  if (!isAuthed && location.pathname.startsWith('/app')) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}

export function AdminRoute({ children }: PropsWithChildren): ReactElement {
  const role = useAppSelector(selectRole)

  if (role !== 'admin') {
    return <Navigate to="/app" replace />
  }

  return <>{children}</>
}

export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: <PublicLayout />,
    children: [
      {
        index: true,
        element: withSuspense(<LandingPage />),
      },
      {
        path: 'login',
        element: withSuspense(<LoginPage />),
      },
      {
        path: 'signup',
        element: withSuspense(<SignupPage />),
      },
      {
        path: 'verify/:token',
        element: withSuspense(<VerifyPage />),
      },
      {
        path: 'forgot-password',
        element: withSuspense(<ForgotPasswordPage />),
      },
      {
        path: 'reset-password/:token',
        element: withSuspense(<ResetPasswordPage />),
      },
    ],
  },
  {
    path: '/app',
    element: (
      <PrivateRoute>
        <GlobalErrorBoundary>
          <AppLayout />
        </GlobalErrorBoundary>
      </PrivateRoute>
    ),
    children: [
      {
        index: true,
        element: withSuspense(<DashboardPage />),
      },
      {
        path: 'profile',
        element: withSuspense(<ProfilePage />),
      },
      {
        path: 'catalog',
        element: withSuspense(<CatalogPage />),
      },
      {
        path: 'doctor/:doctorId',
        element: withSuspense(<DoctorProfilePage />),
      },
      {
        path: 'booking/:doctorId',
        element: withLocalErrorBoundary(withSuspense(<BookingPage />)),
      },
      {
        path: 'booking/:doctorId/confirm',
        element: withLocalErrorBoundary(withSuspense(<BookingConfirmPage />)),
      },
      {
        path: 'appointments',
        element: withSuspense(<MyAppointmentsPage />),
      },
      {
        path: 'admin/doctors',
        element: (
          <AdminRoute>{withLocalErrorBoundary(withSuspense(<AdminDoctorsPage />))}</AdminRoute>
        ),
      },
      {
        path: 'admin/services',
        element: (
          <AdminRoute>{withLocalErrorBoundary(withSuspense(<AdminServicesPage />))}</AdminRoute>
        ),
      },
      {
        path: 'admin/slots',
        element: (
          <AdminRoute>{withLocalErrorBoundary(withSuspense(<AdminSlotsPage />))}</AdminRoute>
        ),
      },
      {
        path: 'admin/appointments',
        element: (
          <AdminRoute>
            {withLocalErrorBoundary(withSuspense(<AdminAppointmentsPage />))}
          </AdminRoute>
        ),
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]
