import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UserRole } from '@/types';
import { ProtectedRoute } from './ProtectedRoute';
import { PageLoader } from '@/components/ui/Spinner';

// Layouts (not lazy — always needed)
import { AuthLayout } from '@/layouts/AuthLayout';
import { DashboardLayout } from '@/layouts/DashboardLayout';

// Auth pages — small, load eagerly
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { VerifyEmailPage } from '@/pages/auth/VerifyEmailPage';

// Error pages — small, load eagerly
import { NotFoundPage } from '@/pages/errors/NotFoundPage';
import { UnauthorizedPage } from '@/pages/errors/UnauthorizedPage';

// Lazy-loaded app pages
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const BovinesListPage = lazy(() => import('@/pages/bovines/BovinesListPage').then((m) => ({ default: m.BovinesListPage })));
const BovineDetailPage = lazy(() => import('@/pages/bovines/BovineDetailPage').then((m) => ({ default: m.BovineDetailPage })));
const BovineFormPage = lazy(() => import('@/pages/bovines/BovineFormPage').then((m) => ({ default: m.BovineFormPage })));
const HealthListPage = lazy(() => import('@/pages/health/HealthListPage').then((m) => ({ default: m.HealthListPage })));
const EventsListPage = lazy(() => import('@/pages/events/EventsListPage').then((m) => ({ default: m.EventsListPage })));
const FinancePage = lazy(() => import('@/pages/finance/FinancePage').then((m) => ({ default: m.FinancePage })));
const ProductionPage = lazy(() => import('@/pages/production/ProductionPage').then((m) => ({ default: m.ProductionPage })));
const ReproductionPage = lazy(() => import('@/pages/reproduction/ReproductionPage').then((m) => ({ default: m.ReproductionPage })));
const LocationsPage = lazy(() => import('@/pages/locations/LocationsPage').then((m) => ({ default: m.LocationsPage })));
const LocationDetailPage = lazy(() => import('@/pages/locations/LocationDetailPage').then((m) => ({ default: m.LocationDetailPage })));
const LocationFormPage = lazy(() => import('@/pages/locations/LocationFormPage').then((m) => ({ default: m.LocationFormPage })));
const MedicationsPage = lazy(() => import('@/pages/medications/MedicationsPage').then((m) => ({ default: m.MedicationsPage })));
const InventoryPage = lazy(() => import('@/pages/inventory/InventoryPage').then((m) => ({ default: m.InventoryPage })));
const RanchPage = lazy(() => import('@/pages/ranch/RanchPage').then((m) => ({ default: m.RanchPage })));
const RanchDetailPage = lazy(() => import('@/pages/ranch/RanchDetailPage').then((m) => ({ default: m.RanchDetailPage })));
const UsersPage = lazy(() => import('@/pages/users/UsersPage').then((m) => ({ default: m.UsersPage })));
const NotificationsPage = lazy(() => import('@/pages/notifications/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const SecurityPage = lazy(() => import('@/pages/security/SecurityPage').then((m) => ({ default: m.SecurityPage })));
const ReportsPage = lazy(() => import('@/pages/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const ProfilePage = lazy(() => import('@/pages/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const MapsPage = lazy(() => import('@/pages/maps/MapsPage').then((m) => ({ default: m.MapsPage })));

const ALL_ROLES = Object.values(UserRole);
const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.OWNER];
const MANAGEMENT_ROLES = [UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.RANCH_MANAGER, UserRole.MANAGER];

function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
        </Route>

        {/* Protected routes */}
        <Route element={<ProtectedRoute roles={ALL_ROLES} />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<LazyPage><DashboardPage /></LazyPage>} />

            {/* Bovinos */}
            <Route path="/bovines" element={<LazyPage><BovinesListPage /></LazyPage>} />
            <Route path="/bovines/:id" element={<LazyPage><BovineDetailPage /></LazyPage>} />
            <Route element={<ProtectedRoute roles={MANAGEMENT_ROLES} />}>
              <Route path="/bovines/new" element={<LazyPage><BovineFormPage /></LazyPage>} />
              <Route path="/bovines/:id/edit" element={<LazyPage><BovineFormPage /></LazyPage>} />
            </Route>

            {/* Modules */}
            <Route path="/health" element={<LazyPage><HealthListPage /></LazyPage>} />
            <Route path="/events" element={<LazyPage><EventsListPage /></LazyPage>} />
            <Route path="/finance" element={<LazyPage><FinancePage /></LazyPage>} />
            <Route path="/production" element={<LazyPage><ProductionPage /></LazyPage>} />
            <Route path="/reproduction" element={<LazyPage><ReproductionPage /></LazyPage>} />
            <Route path="/locations" element={<LazyPage><LocationsPage /></LazyPage>} />
            <Route path="/locations/:id" element={<LazyPage><LocationDetailPage /></LazyPage>} />
            <Route element={<ProtectedRoute roles={MANAGEMENT_ROLES} />}>
              <Route path="/locations/new" element={<LazyPage><LocationFormPage /></LazyPage>} />
              <Route path="/locations/:id/edit" element={<LazyPage><LocationFormPage /></LazyPage>} />
            </Route>
            <Route path="/medications" element={<LazyPage><MedicationsPage /></LazyPage>} />
            <Route path="/inventory" element={<LazyPage><InventoryPage /></LazyPage>} />
            <Route path="/notifications" element={<LazyPage><NotificationsPage /></LazyPage>} />
            <Route path="/reports" element={<LazyPage><ReportsPage /></LazyPage>} />
            <Route path="/profile" element={<LazyPage><ProfilePage /></LazyPage>} />
            <Route path="/maps" element={<LazyPage><MapsPage /></LazyPage>} />

            {/* Management restricted */}
            <Route element={<ProtectedRoute roles={MANAGEMENT_ROLES} />}>
              <Route path="/ranch" element={<LazyPage><RanchPage /></LazyPage>} />
              <Route path="/ranch/:id" element={<LazyPage><RanchDetailPage /></LazyPage>} />
            </Route>

            {/* Admin restricted */}
            <Route element={<ProtectedRoute roles={ADMIN_ROLES} />}>
              <Route path="/users" element={<LazyPage><UsersPage /></LazyPage>} />
              <Route path="/security" element={<LazyPage><SecurityPage /></LazyPage>} />
            </Route>
          </Route>
        </Route>

        {/* Error routes */}
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
