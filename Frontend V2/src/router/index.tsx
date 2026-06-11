import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UserRole } from '@/types';
import { ProtectedRoute } from './ProtectedRoute';
import { PageLoader } from '@/components/ui/Spinner';
import { RouteErrorBoundary } from '@/components/ui/RouteErrorBoundary';

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
const HealthRecordsListPage = lazy(() => import('@/pages/health/records/HealthRecordsListPage').then((m) => ({ default: m.HealthRecordsListPage })));
const HealthRecordDetailPage = lazy(() => import('@/pages/health/records/HealthRecordDetailPage').then((m) => ({ default: m.HealthRecordDetailPage })));
const DiagnosisStatsPage = lazy(() => import('@/pages/health/diagnosis/DiagnosisStatsPage').then((m) => ({ default: m.DiagnosisStatsPage })));
const DiseaseCatalogPage = lazy(() => import('@/pages/health/diseases/DiseaseCatalogPage').then((m) => ({ default: m.DiseaseCatalogPage })));
const DiseaseDetailPage = lazy(() => import('@/pages/health/diseases/DiseaseDetailPage').then((m) => ({ default: m.DiseaseDetailPage })));
// V2: deshabilitado hasta que exista el CRUD de enfermedades en backend.
// const DiseaseFormPage = lazy(() => import('@/pages/health/diseases/DiseaseFormPage').then((m) => ({ default: m.DiseaseFormPage })));
const CasesListPage = lazy(() => import('@/pages/health/cases/CasesListPage').then((m) => ({ default: m.CasesListPage })));
const CaseFormPage = lazy(() => import('@/pages/health/cases/CaseFormPage').then((m) => ({ default: m.CaseFormPage })));
const CaseDetailPage = lazy(() => import('@/pages/health/cases/CaseDetailPage').then((m) => ({ default: m.CaseDetailPage })));
const EpidemiologyDashboardPage = lazy(() => import('@/pages/health/epidemiology/EpidemiologyDashboardPage').then((m) => ({ default: m.EpidemiologyDashboardPage })));
const OutbreakPage = lazy(() => import('@/pages/health/epidemiology/OutbreakPage').then((m) => ({ default: m.OutbreakPage })));
const AlertsPage = lazy(() => import('@/pages/health/epidemiology/AlertsPage').then((m) => ({ default: m.AlertsPage })));
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
const VaccinationSchedulesPage = lazy(() => import('@/pages/vaccinations/VaccinationSchedulesPage').then((m) => ({ default: m.VaccinationSchedulesPage })));

const ALL_ROLES = Object.values(UserRole);
const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.OWNER];
const USER_MGMT_ROLES = [UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.RANCH_MANAGER];
const MANAGEMENT_ROLES = [UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.RANCH_MANAGER, UserRole.MANAGER];
// Roles que pueden registrar/manejar casos clínicos. Espeja la lista
// del PERMISSIONS map (`RECORD_CASE`/`MANAGE_CASE`) en utils/permissions.ts.
const CLINICAL_ROLES = [
  UserRole.SUPER_ADMIN, UserRole.OWNER,
  UserRole.RANCH_MANAGER, UserRole.MANAGER, UserRole.VETERINARIAN,
];

/**
 * F-33 / P-05: cada pagina lazy se envuelve en un boundary individual. Asi
 * un throw en `<BovineDetailPage>` no derribra el sidebar / header, y la
 * pagina ofrece "Recargar" + "Volver al inicio" en lugar de pantalla blanca.
 * El nombre de la ruta es opcional — si se pasa, aparece en el mensaje
 * amigable del fallback.
 */
function LazyPage({ children, name }: { children: React.ReactNode; name?: string }) {
  return (
    <RouteErrorBoundary routeName={name}>
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </RouteErrorBoundary>
  );
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
            {/* Listado paginado global de registros del rancho - mejora 3.
                Lectura abierta a todos los roles autenticados; las
                acciones de editar/eliminar se aplican desde el detalle
                del bovino con su propia gating. */}
            <Route path="/health/records" element={<LazyPage><HealthRecordsListPage /></LazyPage>} />
            {/* Detalle dedicado de un HealthRecord. Lectura abierta a todos
                los roles; las acciones internas (editar/eliminar/etc.) usan
                PermissionGuard. */}
            <Route path="/health/records/:id" element={<LazyPage><HealthRecordDetailPage /></LazyPage>} />
            {/* Dashboard dedicado de estadisticas de diagnostico (Capa 2).
                Misma gating que el listado: lectura abierta a todos los
                roles autenticados; el backend ya filtra por permisos. */}
            <Route path="/health/diagnosis/stats" element={<LazyPage><DiagnosisStatsPage /></LazyPage>} />
            {/* Catálogo de enfermedades — lectura para TODOS los roles
                autenticados (es material de referencia al diagnosticar). */}
            <Route path="/health/diseases/catalogo" element={<LazyPage><DiseaseCatalogPage /></LazyPage>} />
            {/* V2: ruta de alta de enfermedades deshabilitada — el backend aún
                no expone POST/PATCH /diseases (solo lectura + media). Reactivar
                junto con el botón "Nueva enfermedad" cuando exista el CRUD.
            <Route element={<ProtectedRoute roles={ADMIN_ROLES} />}>
              <Route path="/health/diseases/catalogo/nuevo" element={<LazyPage><DiseaseFormPage /></LazyPage>} />
            </Route>
            */}
            <Route path="/health/diseases/catalogo/:slug" element={<LazyPage><DiseaseDetailPage /></LazyPage>} />
            {/* Casos clínicos — listado y detalle abiertos a todos los roles
                autenticados (lectura). La creación requiere RECORD_CASE. */}
            <Route path="/health/cases" element={<LazyPage><CasesListPage /></LazyPage>} />
            {/* `nuevo` ANTES de `:id` para evitar que la ruta dinámica lo capture. */}
            <Route element={<ProtectedRoute roles={CLINICAL_ROLES} />}>
              <Route path="/health/cases/nuevo" element={<LazyPage><CaseFormPage /></LazyPage>} />
            </Route>
            <Route path="/health/cases/:id" element={<LazyPage><CaseDetailPage /></LazyPage>} />
            {/* Dashboard epidemiológico — VIEW_EPIDEMIOLOGY (VETERINARIAN+).
                El listado crudo de casos sigue público en /health/cases. */}
            <Route element={<ProtectedRoute roles={CLINICAL_ROLES} />}>
              <Route path="/health/epidemiology" element={<LazyPage><EpidemiologyDashboardPage /></LazyPage>} />
              <Route path="/health/epidemiology/alerts" element={<LazyPage name="Alertas epidemiológicas"><AlertsPage /></LazyPage>} />
              <Route path="/health/epidemiology/outbreak/:diseaseId" element={<LazyPage><OutbreakPage /></LazyPage>} />
            </Route>
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

            {/* Vaccination schedule catalog — OWNER / VETERINARIAN / SUPER_ADMIN */}
            <Route element={<ProtectedRoute roles={CLINICAL_ROLES} />}>
              <Route path="/vaccinations/schedules" element={<LazyPage name="Calendarios de vacunación"><VaccinationSchedulesPage /></LazyPage>} />
            </Route>

            {/* Gestión de usuarios: SUPER_ADMIN, OWNER y RANCH_MANAGER */}
            <Route element={<ProtectedRoute roles={USER_MGMT_ROLES} />}>
              <Route path="/users" element={<LazyPage><UsersPage /></LazyPage>} />
            </Route>

            {/* Solo SUPER_ADMIN y OWNER */}
            <Route element={<ProtectedRoute roles={ADMIN_ROLES} />}>
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
