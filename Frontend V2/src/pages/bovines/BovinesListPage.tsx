import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';
import { canUser } from '@/utils/permissions';
import { formatDate } from '@/utils/formatters';
import { cn } from '@/utils/cn';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { Modal } from '@/components/ui/Modal';
import { HealthStatusBadge } from '@/components/ui/HealthStatusBadge';
import { LocationSelector } from '@/components/ui/LocationSelector';
import { RanchSelector } from '@/components/ui/RanchSelector';
import {
  useBovineList,
  useBovineFilterOptions,
  useBovineStatistics,
  useBulkMoveBovines,
} from '@/hooks/useBovines';
import { getBovineErrorMessage } from '@/utils/errorHandler';
import { BovineMapView } from '@/components/bovines/BovineMapView';
import type {
  BovineDetailResponse,
  BovineFilters,
  CattleType,
  GenderType,
  HealthStatus,
  VaccinationStatus,
  MapMarkersFilters,
} from '@/types/bovine.dtos';
import { MovementReason, MovementType } from '@/types/bovine.dtos';
import {
  Beef, Plus, Search, SlidersHorizontal, X, QrCode,
  MoveRight, Printer, ChevronDown, CheckSquare,
  Weight, MapPin, Syringe, List, Map as MapIcon, Home,
} from 'lucide-react';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';

// ─── URL params ↔ filters helpers ────────────────────────────────────────────

/** Parse a CSV query param into a string[]. Empty/missing → []. */
function parseCsv(value: string | null): string[] {
  if (!value) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

/** Parse a numeric query param. Invalid/missing → undefined. */
function parseNumber(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

// ─── Age presets ─────────────────────────────────────────────────────────────

const AGE_PRESETS = [
  { value: '0-6',   label: 'Becerros (0-6 m)',  min: 0,  max: 6  },
  { value: '6-18',  label: 'Novillos (6-18 m)', min: 6,  max: 18 },
  { value: '18-',   label: 'Adultos (>18 m)',   min: 18, max: undefined as number | undefined },
] as const;

// ─── Multi-select chip filter ────────────────────────────────────────────────
//
// Each ChipFilter renders a pill button that toggles a popover with checkbox
// options. The opened/closed state is CONTROLLED by the parent via the
// `openId` + `onOpenChange` pair so only ONE filter can be open at a time
// (previously each instance held its own `useState`, allowing all of them
// to be open simultaneously and visually overlap).
//
// Behaviors:
//   - Clicking another filter pill closes the previous one.
//   - Clicking outside any open popover closes it (mousedown listener).
//   - Pressing Escape closes the current one.
//   - Explicit text colors on every option label ensure contrast on both
//     light and dark backgrounds (the old `text-left` alone inherited a
//     near-invisible color on dark mode).

interface ChipFilterProps {
  /** Unique key used by the parent to track which filter is open. */
  id: string;
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (vals: string[]) => void;
  /** Id of the currently-open filter (or null if none). Parent-managed. */
  openId: string | null;
  /** Setter the parent passes down; pass `null` to close. */
  onOpenChange: (id: string | null) => void;
}

function ChipFilter({
  id, label, options, selected, onChange, openId, onOpenChange,
}: ChipFilterProps) {
  const open = openId === id;
  const containerRef = useRef<HTMLDivElement>(null);

  // Click-outside / Escape → close. Only registered while open to avoid
  // a global listener for every filter on the page.
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onOpenChange(null);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(null);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, onOpenChange]);

  function toggle(val: string) {
    onChange(
      selected.includes(val)
        ? selected.filter((v) => v !== val)
        : [...selected, val],
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(open ? null : id)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors',
          selected.length > 0
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
            // Strong default text so the pill label is legible on the
            // dark `bg-gray-800/50` filter panel.
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800',
        )}
      >
        {label}
        {selected.length > 0 && (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-600 text-white text-[10px] font-bold">
            {selected.length}
          </span>
        )}
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        // z-30 keeps the popover above sibling chips and the table.
        // shadow-xl + ring give a clearer separation from the panel below.
        <div
          className="absolute z-30 mt-1 w-56 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl ring-1 ring-black/5 dark:ring-white/5 p-2 max-h-60 overflow-y-auto"
          role="listbox"
          aria-label={label}
        >
          {options.map((o) => {
            const isSelected = selected.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggle(o.value)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors',
                  // Explicit text colors per state — light mode reads dark
                  // gray, dark mode reads near-white. Previously the option
                  // text inherited the panel's faint gray and was unreadable.
                  isSelected
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200 font-medium'
                    : 'text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800',
                )}
                role="option"
                aria-selected={isSelected}
              >
                <span className={cn(
                  'inline-flex items-center justify-center w-4 h-4 rounded border shrink-0',
                  isSelected
                    ? 'bg-primary-600 border-primary-600'
                    : 'border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-800',
                )}>
                  {isSelected && <span className="text-white text-[10px] leading-none font-bold">✓</span>}
                </span>
                <span className="flex-1 truncate">{o.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── FiltersPanel — orchestrates the 5 ChipFilters with single-open state ───

interface FilterOption { value: string; label: string }

interface FiltersPanelProps {
  // Options come from `useBovineFilterOptions` in the parent; they MUST be
  // passed in because this component lives at module scope and can't reach
  // the closure of `BovinesListPage`. Forgetting to pass them caused a
  // `ReferenceError: HEALTH_OPTIONS is not defined` (blank screen).
  healthOptions: FilterOption[];
  typeOptions: FilterOption[];
  genderOptions: FilterOption[];
  breedOptions: FilterOption[];
  vacOptions: FilterOption[];

  healthFilter: string[];
  typeFilter: string[];
  genderFilter: string[];
  breedFilter: string[];
  vaccinationFilter: string[];
  ageMin: number | undefined;
  ageMax: number | undefined;
  locationId: string | undefined;
  activeRanchId: string | null;
  activeFilterChips: { key: string; label: string; clear: () => void }[];
  updateParams: (patch: Record<string, unknown>) => void;
  clearAllFilters: () => void;
}

function FiltersPanel({
  healthOptions, typeOptions, genderOptions, breedOptions, vacOptions,
  healthFilter, typeFilter, genderFilter, breedFilter, vaccinationFilter,
  ageMin, ageMax, locationId, activeRanchId, activeFilterChips,
  updateParams, clearAllFilters,
}: FiltersPanelProps) {
  // Single source of truth for which dropdown is currently expanded.
  // Setting to `null` collapses any open popover.
  const [openFilterId, setOpenFilterId] = useState<string | null>(null);

  return (
    <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {healthOptions.length > 0 && (
          <ChipFilter
            id="salud"
            label="Salud"
            options={healthOptions}
            selected={healthFilter}
            onChange={(v) => updateParams({ healthStatus: v, page: 1 })}
            openId={openFilterId}
            onOpenChange={setOpenFilterId}
          />
        )}
        {typeOptions.length > 0 && (
          <ChipFilter
            id="tipo"
            label="Tipo"
            options={typeOptions}
            selected={typeFilter}
            onChange={(v) => updateParams({ cattleType: v, page: 1 })}
            openId={openFilterId}
            onOpenChange={setOpenFilterId}
          />
        )}
        {genderOptions.length > 0 && (
          <ChipFilter
            id="sexo"
            label="Sexo"
            options={genderOptions}
            selected={genderFilter}
            onChange={(v) => updateParams({ gender: v, page: 1 })}
            openId={openFilterId}
            onOpenChange={setOpenFilterId}
          />
        )}
        {breedOptions.length > 0 && (
          <ChipFilter
            id="raza"
            label="Raza"
            options={breedOptions}
            selected={breedFilter}
            onChange={(v) => updateParams({ breed: v, page: 1 })}
            openId={openFilterId}
            onOpenChange={setOpenFilterId}
          />
        )}
        {vacOptions.length > 0 && (
          <ChipFilter
            id="vacunacion"
            label="Vacunación"
            options={vacOptions}
            selected={vaccinationFilter}
            onChange={(v) => updateParams({ vaccinationStatus: v, page: 1 })}
            openId={openFilterId}
            onOpenChange={setOpenFilterId}
          />
        )}

        {/* Age presets — quick selectors that overwrite ageMin/ageMax */}
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-xs text-gray-600 dark:text-gray-300 mr-1">Edad:</span>
          {AGE_PRESETS.map((p) => {
            const active = ageMin === p.min && (ageMax ?? undefined) === p.max;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => updateParams({
                  ageMin: active ? undefined : p.min,
                  ageMax: active ? undefined : p.max,
                  page: 1,
                })}
                className={cn(
                  'px-2 py-1 rounded text-xs border transition-colors font-medium',
                  active
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-gray-400 dark:hover:border-gray-500 bg-white dark:bg-gray-800',
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {activeFilterChips.length > 0 && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium"
          >
            <X className="w-3.5 h-3.5" /> Limpiar todo
          </button>
        )}
      </div>

      {/* Location filter — depends on active ranch */}
      {activeRanchId && (
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Ubicación / Potrero (dentro del rancho)
          </label>
          <LocationSelector
            value={locationId || null}
            onChange={(id) => updateParams({ locationId: id ?? undefined, page: 1 })}
            ranchId={activeRanchId}
            placeholder="Todas las ubicaciones del rancho"
          />
        </div>
      )}
    </div>
  );
}

// ─── Active filter chip ──────────────────────────────────────────────────────

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-xs font-medium">
      {label}
      <button onClick={onRemove} className="hover:text-primary-900 dark:hover:text-primary-200">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BovinesListPage() {
  const navigate = useNavigate();
  const { user, activeRanchId, setActiveRanch } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();

  // ── URL params (single source of truth for filters) ───────────────────────
  const [searchParams, setSearchParams] = useSearchParams();

  const page             = Math.max(1, parseNumber(searchParams.get('page')) ?? 1);
  const search           = searchParams.get('search') ?? '';
  const view             = (searchParams.get('view') as 'list' | 'map') === 'map' ? 'map' : 'list';
  const healthFilter     = parseCsv(searchParams.get('healthStatus'));
  const typeFilter       = parseCsv(searchParams.get('cattleType'));
  const genderFilter     = parseCsv(searchParams.get('gender'));
  const breedFilter      = parseCsv(searchParams.get('breed'));
  const vaccinationFilter= parseCsv(searchParams.get('vaccinationStatus'));
  const locationId       = searchParams.get('locationId') || '';
  const ageMin           = parseNumber(searchParams.get('ageMin'));
  const ageMax           = parseNumber(searchParams.get('ageMax'));

  // Local debounced search input (URL gets updated 300ms after typing stops).
  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => { setSearchInput(search); }, [search]);
  useEffect(() => {
    if (searchInput === search) return;
    const t = setTimeout(() => updateParams({ search: searchInput || undefined, page: 1 }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // QR scan input (still local — submits to `search` once finished)
  const [showQrInput, setShowQrInput] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // ── URL writers ───────────────────────────────────────────────────────────
  /** Update one or more URL params. Pass undefined to delete. Always replaces. */
  const updateParams = useCallback(
    (changes: Record<string, string | number | string[] | undefined>) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(changes).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '' ||
            (Array.isArray(value) && value.length === 0)) {
          next.delete(key);
        } else if (Array.isArray(value)) {
          next.set(key, value.join(','));
        } else {
          next.set(key, String(value));
        }
      });
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  // ── Permissions ───────────────────────────────────────────────────────────
  const canManage = canUser(user?.role, 'MANAGE_BOVINE');
  const canMove   = canUser(user?.role, 'MANAGE_BOVINE');
  const ranchAccessCount = user?.ranchAccess?.length ?? 0;
  const showRanchFilter  = user?.role === 'SUPER_ADMIN' || ranchAccessCount > 1;

  // ── Build filter object for the hook ──────────────────────────────────────
  // We pass single-value filters as enums (after one-of-N selection) and arrays
  // are CSV-encoded by the hook → flattenFilters helper inside bovines.api.ts.
  const filters: BovineFilters & { page: number; limit: number } = useMemo(() => ({
    page,
    limit: DEFAULT_PAGE_SIZE,
    searchTerm: search || undefined,
    cattleType: typeFilter.length === 1 ? typeFilter[0] as CattleType : undefined,
    healthStatus: healthFilter.length === 1 ? healthFilter[0] as HealthStatus : undefined,
    gender: genderFilter.length === 1 ? genderFilter[0] as GenderType : undefined,
    breed: breedFilter.length === 1 ? breedFilter[0] : undefined,
    vaccinationStatus: vaccinationFilter.length === 1 ? vaccinationFilter[0] as VaccinationStatus : undefined,
    ranchId: activeRanchId ?? undefined,
    locationId: locationId || undefined,
    ageRange: (ageMin != null || ageMax != null)
      ? { min: ageMin ?? 0, max: ageMax ?? 1200 }
      : undefined,
  }), [page, search, typeFilter, healthFilter, genderFilter, breedFilter,
       vaccinationFilter, activeRanchId, locationId, ageMin, ageMax]);

  // ── Data fetching (centralized hooks) ─────────────────────────────────────
  const { data, isLoading, isFetching } = useBovineList(filters);

  // Map filters — same URL params, but the map endpoint accepts arrays
  // (multi-select) directly instead of single-value filters. This is
  // distinct from the list endpoint which currently uses one-of-N.
  const mapFilters: MapMarkersFilters = useMemo(() => ({
    ranchIds: activeRanchId ? [activeRanchId] : null,
    healthStatus: healthFilter.length ? (healthFilter as HealthStatus[]) : undefined,
    cattleTypes: typeFilter.length ? (typeFilter as CattleType[]) : undefined,
    genders: genderFilter.length ? (genderFilter as GenderType[]) : undefined,
    breeds: breedFilter.length ? breedFilter : undefined,
    vaccinationStatus: vaccinationFilter.length === 1
      ? vaccinationFilter[0] as VaccinationStatus
      : undefined,
    locationId: locationId || undefined,
    ageRange: (ageMin != null || ageMax != null)
      ? { min: ageMin ?? 0, max: ageMax ?? 1200 }
      : undefined,
  }), [activeRanchId, healthFilter, typeFilter, genderFilter, breedFilter,
       vaccinationFilter, locationId, ageMin, ageMax]);
  const { data: stats }                 = useBovineStatistics();
  const { data: filterOptions }         = useBovineFilterOptions();

  // Catalog options preferring backend-driven, with fallbacks for first render.
  const HEALTH_OPTIONS  = filterOptions?.healthStatuses ?? [];
  const TYPE_OPTIONS    = filterOptions?.cattleTypes ?? [];
  const GENDER_OPTIONS  = filterOptions?.genders ?? [];
  const VAC_OPTIONS     = filterOptions?.vaccinationStatuses ?? [];
  const BREED_OPTIONS   = useMemo(
    () => (filterOptions?.breeds ?? []).map((b) => ({ value: b, label: b })),
    [filterOptions?.breeds],
  );

  // ── Selection state ───────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveLocationId, setMoveLocationId] = useState<string | null>(null);
  // Strict MovementReason enum (8 valid backend values) — defaults to TRANSFER
  // for the bulk-move flow. CREATION is reserved for initial registry only.
  const [moveReason, setMoveReason] = useState<MovementReason>(MovementReason.TRANSFER);
  const [moveMovementType, setMoveMovementType] = useState<MovementType>(MovementType.MANUAL);
  const [moveNotesBulk, setMoveNotesBulk] = useState('');
        console.log('BOVINE RESPONSE', data);
  const bovines: BovineDetailResponse[] = data?.bovines ?? [];
  const totalCount = data?.pagination?.total ?? 0;
  const totalPages = data?.pagination?.totalPages ?? 1;

  const allOnPageSelected = bovines.length > 0 && bovines.every((b) => selectedIds.has(b.id));

  function toggleSelectAll() {
    if (allOnPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        bovines.forEach((b) => next.delete(b.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        bovines.forEach((b) => next.add(b.id));
        return next;
      });
    }
  }

  const toggleRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  function clearSelection() { setSelectedIds(new Set()); }

  // ── Reset selection when changing pages or main filters ───────────────────
  useEffect(() => { clearSelection(); }, [page, activeRanchId, locationId]);

  // ── Bulk move (centralized hook) ──────────────────────────────────────────
  const bulkMoveMutation = useBulkMoveBovines();
  function handleBulkMove() {
    if (!moveLocationId || selectedIds.size === 0) return;
    bulkMoveMutation.mutate(
      {
        ids: Array.from(selectedIds),
        locationId: moveLocationId,
        // Strict enum values only — no free-form reason strings.
        reason: moveReason,
        movementType: moveMovementType,
        notes: moveNotesBulk || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Movimiento registrado', `${selectedIds.size} bovino(s) movidos.`);
          setShowMoveModal(false);
          setMoveLocationId(null);
          setMoveReason('');
          clearSelection();
        },
        onError: (err: unknown) => {
          toast.error('Error al mover', getBovineErrorMessage(err));
        },
      },
    );
  }

  // ── Active filter chips ───────────────────────────────────────────────────
  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    healthFilter.forEach((v) => {
      const opt = HEALTH_OPTIONS.find((o) => o.value === v);
      chips.push({
        key: `h-${v}`,
        label: opt?.label || v,
        clear: () => updateParams({ healthStatus: healthFilter.filter((x) => x !== v), page: 1 }),
      });
    });
    typeFilter.forEach((v) => {
      const opt = TYPE_OPTIONS.find((o) => o.value === v);
      chips.push({
        key: `t-${v}`, label: opt?.label || v,
        clear: () => updateParams({ cattleType: typeFilter.filter((x) => x !== v), page: 1 }),
      });
    });
    genderFilter.forEach((v) => {
      const opt = GENDER_OPTIONS.find((o) => o.value === v);
      chips.push({
        key: `g-${v}`, label: opt?.label || v,
        clear: () => updateParams({ gender: genderFilter.filter((x) => x !== v), page: 1 }),
      });
    });
    breedFilter.forEach((v) => {
      chips.push({
        key: `b-${v}`, label: v,
        clear: () => updateParams({ breed: breedFilter.filter((x) => x !== v), page: 1 }),
      });
    });
    vaccinationFilter.forEach((v) => {
      const opt = VAC_OPTIONS.find((o) => o.value === v);
      chips.push({
        key: `vac-${v}`, label: opt?.label || v,
        clear: () => updateParams({ vaccinationStatus: vaccinationFilter.filter((x) => x !== v), page: 1 }),
      });
    });
    if (locationId) {
      chips.push({
        key: 'loc',
        label: 'Ubicación específica',
        clear: () => updateParams({ locationId: undefined, page: 1 }),
      });
    }
    if (ageMin != null || ageMax != null) {
      const label = ageMax != null
        ? `Edad: ${ageMin ?? 0}-${ageMax} m`
        : `Edad: > ${ageMin} m`;
      chips.push({
        key: 'age', label,
        clear: () => updateParams({ ageMin: undefined, ageMax: undefined, page: 1 }),
      });
    }
    return chips;
  }, [healthFilter, typeFilter, genderFilter, breedFilter, vaccinationFilter,
      locationId, ageMin, ageMax, HEALTH_OPTIONS, TYPE_OPTIONS, GENDER_OPTIONS,
      VAC_OPTIONS, updateParams]);

  function clearAllFilters() {
    const next = new URLSearchParams();
    if (view === 'map') next.set('view', 'map');
    setSearchParams(next, { replace: true });
  }

  // ── QR search ────────────────────────────────────────────────────────────
  function handleQrSearch(val: string) {
    updateParams({ search: val || undefined, page: 1 });
  }

  // ── Print QRs ────────────────────────────────────────────────────────────
  /**
   * Bulk-print a sheet of REAL QR codes for the currently selected bovines.
   * Each card embeds a scannable QR (rendered as an <img> served by
   * api.qrserver.com using the bovine's `qrCode` string from the backend).
   *
   * If a bovine has no `qrCode` yet, we render a clearly-labeled placeholder
   * card so the user sees which animals still need a code.
   */
  function handlePrintQRs() {
    const selected = bovines.filter((b) => selectedIds.has(b.id));
    if (selected.length === 0) return;

    const escape = (s: string | null | undefined) =>
      (s ?? '').replace(/[<>&"']/g, (c) =>
        ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&#39;' }[c]!));

    const win = window.open('', '_blank');
    if (!win) {
      toast.error('Pop-ups bloqueados', 'Habilita las ventanas emergentes para imprimir.');
      return;
    }

    const cardsHtml = selected.map((b) => {
      const earTag = escape(b.earTag);
      const name   = escape(b.name);
      const breed  = escape(b.breed);

      const qrCell = b.qrCode
        ? `<img class="qr" alt="QR ${earTag}"
                src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(b.qrCode)}" />`
        : `<div class="qr-missing">
             <div>Sin QR<br/>generado</div>
           </div>`;

      return `
        <div class="card">
          ${qrCell}
          <h3>${earTag}</h3>
          ${name  ? `<p>${name}</p>`  : ''}
          ${breed ? `<p class="muted">${breed}</p>` : ''}
        </div>
      `;
    }).join('');

    win.document.write(`
      <!doctype html><html><head><meta charset="utf-8" />
      <title>QRs Bovinos (${selected.length})</title>
      <style>
        body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 14px; padding: 16px; }
        .card { border: 1px solid #d1d5db; border-radius: 10px; padding: 12px 10px;
                text-align: center; page-break-inside: avoid; background: #fff; }
        .qr { width: 140px; height: 140px; margin: 0 auto 8px; display: block; }
        .qr-missing { width: 140px; height: 140px; margin: 0 auto 8px;
                      background: #f3f4f6; border: 1px dashed #9ca3af; border-radius: 6px;
                      display: flex; align-items: center; justify-content: center;
                      font-size: 11px; color: #6b7280; }
        h3 { margin: 0 0 2px; font-size: 13px; font-weight: 700; color: #111827; }
        p  { margin: 0; font-size: 11px; color: #4b5563; }
        p.muted { color: #9ca3af; }
        @media print { @page { margin: 10mm; } }
      </style></head><body>
        <div class="grid">${cardsHtml}</div>
        <script>window.addEventListener('load', () => setTimeout(() => window.print(), 400));<\/script>
      </body></html>
    `);
    win.document.close();
  }

  // ── Columns ──────────────────────────────────────────────────────────────
  const columns: Column<BovineDetailResponse>[] = [
    // Checkbox column
    {
      key: 'select',
      header: (
        <button onClick={toggleSelectAll} className="text-gray-400 hover:text-primary-600">
          <CheckSquare className={cn('w-4 h-4', allOnPageSelected && 'text-primary-600')} />
        </button>
      ) as any,
      render: (b) => (
        <button
          onClick={(e) => { e.stopPropagation(); toggleRow(b.id); }}
          className="text-gray-400 hover:text-primary-600"
        >
          <CheckSquare className={cn('w-4 h-4', selectedIds.has(b.id) && 'text-primary-600')} />
        </button>
      ),
      className: 'w-10',
    },
    {
      key: 'earTag',
      header: 'Arete',
      render: (b) => (
        <div>
          <p className="font-mono font-semibold text-gray-900 dark:text-white">{b.earTag}</p>
          {b.name && <p className="text-xs text-gray-500">{b.name}</p>}
        </div>
      ),
    },
    {
      key: 'cattleType',
      header: 'Tipo',
      render: (b) => (
        <Badge variant="info">{b.cattleTypeLabel || b.cattleType}</Badge>
      ),
    },
    {
      key: 'breed',
      header: 'Raza',
      render: (b) => <span className="text-sm text-gray-700 dark:text-gray-300">{b.breed}</span>,
    },
    {
      key: 'gender',
      header: 'Sexo',
      render: (b) => <span className="text-sm text-gray-700 dark:text-gray-300">{b.genderLabel || b.gender}</span>,
    },
    {
      key: 'age',
      header: 'Edad',
      render: (b) => <span className="text-sm text-gray-700 dark:text-gray-300">{b.ageDisplay}</span>,
    },
    {
      key: 'weight',
      header: 'Peso',
      render: (b) => b.weight != null ? (
        <span className="inline-flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
          <Weight className="w-3 h-3 text-gray-400" /> {b.weight} kg
        </span>
      ) : <span className="text-xs text-gray-400">—</span>,
    },
    {
      key: 'health',
      header: 'Salud',
      render: (b) => <HealthStatusBadge status={b.healthStatus as any} />,
    },
    {
      key: 'vac',
      header: 'Vacunación',
      render: (b) => (
        <span className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
          <Syringe className="w-3 h-3 text-gray-400" />
          {b.vaccinationStatusLabel || b.vaccinationStatus}
        </span>
      ),
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary-50 dark:bg-primary-900/30 p-3">
            <Beef className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bovinos</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Gestión del inventario ganadero
              {totalCount > 0 && ` · ${totalCount.toLocaleString()} registros`}
              {isFetching && !isLoading && (
                <span className="ml-2 text-xs text-amber-500">· actualizando…</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle (list/map) */}
          <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => updateParams({ view: undefined })}
              className={cn(
                'px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 transition-colors',
                view === 'list'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
              )}
            >
              <List className="w-4 h-4" /> Lista
            </button>
            <button
              onClick={() => updateParams({ view: 'map' })}
              className={cn(
                'px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 transition-colors border-l border-gray-200 dark:border-gray-700',
                view === 'map'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
              )}
            >
              <MapIcon className="w-4 h-4" /> Mapa
            </button>
          </div>
          {canManage && (
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => navigate('/bovines/new')}>
              Nuevo
            </Button>
          )}
        </div>
      </div>

      {/* ── Global ranch filter (multi-ranch users) ─────────────────────── */}
      {showRanchFilter && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40">
          <Home className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0">
            Filtrar por rancho:
          </span>
          <div className="flex-1 max-w-sm">
            <RanchSelector
              value={activeRanchId}
              onChange={(rid) => setActiveRanch(rid)}
              placeholder="Todos los ranchos"
              clearable
              label=""
            />
          </div>
          {activeRanchId && (
            <span className="text-xs text-gray-500 shrink-0 hidden md:inline">
              Mostrando solo bovinos de este rancho.
            </span>
          )}
        </div>
      )}

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCard title="Total" value={stats.total ?? stats.totalBovines ?? 0} icon={Beef} color="primary" />
          <StatCard title="Saludables" value={stats.totalByHealthStatus?.HEALTHY ?? 0} icon={Beef} color="emerald" />
          <StatCard title="Enfermos" value={stats.totalByHealthStatus?.SICK ?? stats.sickAnimals ?? 0} icon={Beef} color="red" />
          <StatCard title="Cuarentena" value={stats.totalByHealthStatus?.QUARANTINE ?? 0} icon={Beef} color="amber" />
          <StatCard title="Vacunación pendiente" value={stats.upcomingVaccinations ?? 0} icon={Syringe} color="blue" />
        </div>
      )}

      {/* ── Search bar + controls ───────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {!showQrInput ? (
          <div className="flex-1">
            <Input
              placeholder="Buscar por arete, nombre o raza..."
              icon={<Search className="w-4 h-4" />}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1">
              <Input
                placeholder="Introduce el código QR del arete..."
                icon={<QrCode className="w-4 h-4 text-primary-500" />}
                value={search}
                onChange={(e) => handleQrSearch(e.target.value)}
                autoFocus
              />
            </div>
            <button
              onClick={() => { setShowQrInput(false); handleQrSearch(''); }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <Button
          variant={showQrInput ? 'primary' : 'outline'}
          icon={<QrCode className="w-4 h-4" />}
          onClick={() => { setShowQrInput((v) => !v); handleQrSearch(''); }}
          title="Buscar por código QR"
        >
          <span className="hidden sm:inline">QR</span>
        </Button>

        <Button
          variant={showFilters ? 'primary' : 'outline'}
          icon={<SlidersHorizontal className="w-4 h-4" />}
          onClick={() => setShowFilters((v) => !v)}
        >
          <span className="hidden sm:inline">Filtros</span>
          {activeFilterChips.length > 0 && (
            <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/30 text-xs font-bold">
              {activeFilterChips.length}
            </span>
          )}
        </Button>
      </div>

      {/* ── Advanced filters panel ───────────────────────────────────────
          Single `openFilterId` state guarantees only ONE dropdown can be
          expanded at a time — clicking another chip auto-closes the
          previous one. Solves the overlap bug from the old design where
          every ChipFilter held its own `useState`.                        */}
      {showFilters && (
        <FiltersPanel
          healthOptions={HEALTH_OPTIONS}
          typeOptions={TYPE_OPTIONS}
          genderOptions={GENDER_OPTIONS}
          breedOptions={BREED_OPTIONS}
          vacOptions={VAC_OPTIONS}
          healthFilter={healthFilter}
          typeFilter={typeFilter}
          genderFilter={genderFilter}
          breedFilter={breedFilter}
          vaccinationFilter={vaccinationFilter}
          ageMin={ageMin}
          ageMax={ageMax}
          locationId={locationId}
          activeRanchId={activeRanchId}
          activeFilterChips={activeFilterChips}
          updateParams={updateParams}
          clearAllFilters={clearAllFilters}
        />
      )}

      {/* Active filter chips outside the panel */}
      {!showFilters && activeFilterChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">Filtros activos:</span>
          {activeFilterChips.map((f) => (
            <ActiveChip key={f.key} label={f.label} onRemove={f.clear} />
          ))}
          <button onClick={clearAllFilters} className="text-xs text-red-500 hover:underline">
            Limpiar todo
          </button>
        </div>
      )}

      {/* ── Bulk action bar ─────────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
          <div className="flex items-center gap-2 flex-1">
            <CheckSquare className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            <span className="text-sm font-medium text-primary-800 dark:text-primary-300">
              {selectedIds.size} bovino{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {canMove && (
              <Button
                size="sm"
                variant="outline"
                icon={<MoveRight className="w-3.5 h-3.5" />}
                onClick={() => setShowMoveModal(true)}
              >
                Mover potrero
              </Button>
            )}
            <Button size="sm" variant="outline" icon={<Printer className="w-3.5 h-3.5" />} onClick={handlePrintQRs}>
              Imprimir QRs
            </Button>
            <button
              onClick={clearSelection}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ml-1"
              title="Cancelar selección"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Content: list or map ────────────────────────────────────────── */}
      {view === 'list' ? (
        <DataTable<BovineDetailResponse>
          columns={columns}
          data={bovines}
          loading={isLoading}
          keyExtractor={(b) => b.id}
          page={page}
          totalPages={totalPages}
          total={totalCount}
          onPageChange={(p) => updateParams({ page: p })}
          onRowClick={(b) => navigate(`/bovines/${b.id}`)}
          emptyMessage={
            activeFilterChips.length > 0 || search
              ? 'No se encontraron bovinos con los filtros aplicados.'
              : 'No hay bovinos registrados todavía.'
          }
          rowClassName={(b: BovineDetailResponse) => selectedIds.has(b.id)
            ? 'bg-primary-50/50 dark:bg-primary-900/10'
            : ''
          }
        />
      ) : (
        <BovineMapView
          filters={mapFilters}
          onMarkerClick={(id) => navigate(`/bovines/${id}`)}
          className="h-[600px] w-full"
        />
      )}

      {/* ── Modal: Mover a otro potrero ─────────────────────────────────── */}
      <Modal
        open={showMoveModal}
        onClose={() => {
          setShowMoveModal(false);
          setMoveLocationId(null);
          setMoveReason(MovementReason.TRANSFER);
          setMoveMovementType(MovementType.MANUAL);
          setMoveNotesBulk('');
        }}
        title={`Mover ${selectedIds.size} bovino${selectedIds.size !== 1 ? 's' : ''} a otro potrero`}
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <MoveRight className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Se moverán <strong>{selectedIds.size} bovino{selectedIds.size !== 1 ? 's' : ''}</strong> al potrero seleccionado y se registrará el movimiento en el historial.
            </p>
          </div>

          <LocationSelector
            label="Potrero / Ubicación destino"
            value={moveLocationId}
            onChange={(id) => setMoveLocationId(id)}
            ranchId={activeRanchId}
            placeholder="Selecciona el potrero de destino..."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* MovementReason — 8 backend values. CREATION omitted because
                this is an ad-hoc bulk-move (the animals already exist). */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Razón del movimiento
              </label>
              <select
                value={moveReason}
                onChange={(e) => setMoveReason(e.target.value as MovementReason)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              >
                <option value={MovementReason.TRANSFER}>Traslado</option>
                <option value={MovementReason.GRAZING}>Pastoreo</option>
                <option value={MovementReason.MEDICAL}>Atención médica</option>
                <option value={MovementReason.QUARANTINE}>Cuarentena</option>
                <option value={MovementReason.BREEDING}>Reproducción</option>
                <option value={MovementReason.SALE}>Venta</option>
                <option value={MovementReason.OTHER}>Otro</option>
              </select>
            </div>

            {/* MovementType — exactly the 3 backend values. */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Tipo de movimiento
              </label>
              <select
                value={moveMovementType}
                onChange={(e) => setMoveMovementType(e.target.value as MovementType)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              >
                <option value={MovementType.MANUAL}>Manual</option>
                <option value={MovementType.AUTOMATED}>Automatizado</option>
                <option value={MovementType.SCHEDULED}>Programado</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Notas <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={moveNotesBulk}
              onChange={(e) => setMoveNotesBulk(e.target.value)}
              placeholder="Comentario adicional sobre el movimiento..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => {
              setShowMoveModal(false);
              setMoveLocationId(null);
              setMoveReason(MovementReason.TRANSFER);
              setMoveMovementType(MovementType.MANUAL);
              setMoveNotesBulk('');
            }}>
              Cancelar
            </Button>
            <Button
              icon={<MoveRight className="w-4 h-4" />}
              disabled={!moveLocationId || bulkMoveMutation.isPending}
              loading={bulkMoveMutation.isPending}
              onClick={handleBulkMove}
            >
              Confirmar movimiento
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
