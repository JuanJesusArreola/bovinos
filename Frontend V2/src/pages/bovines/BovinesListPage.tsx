import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bovinesApi } from '@/api/bovines.api';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';
import { canUser } from '@/utils/permissions';
import { formatDate } from '@/utils/formatters';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { Modal } from '@/components/ui/Modal';
import { HealthStatusBadge } from '@/components/ui/HealthStatusBadge';
import { LocationSelector } from '@/components/ui/LocationSelector';
import type { Bovine } from '@/types';
import {
  Beef, Plus, Search, SlidersHorizontal, X, QrCode,
  MoveRight, Printer, ChevronDown, CheckSquare, Square,
  Weight, MapPin, Syringe,
} from 'lucide-react';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';

// ─── Filter options ────────────────────────────────────────────────────────────

const CATTLE_TYPE_OPTIONS = [
  { value: 'CATTLE', label: 'Ganado' },
  { value: 'BULL', label: 'Toro' },
  { value: 'COW', label: 'Vaca' },
  { value: 'CALF', label: 'Becerro' },
];

const HEALTH_OPTIONS = [
  { value: 'HEALTHY', label: 'Saludable', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  { value: 'SICK', label: 'Enfermo', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  { value: 'RECOVERING', label: 'Recuperación', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  { value: 'QUARANTINE', label: 'Cuarentena', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  { value: 'DECEASED', label: 'Fallecido', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  { value: 'UNKNOWN', label: 'Desconocido', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
];

const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Macho' },
  { value: 'FEMALE', label: 'Hembra' },
];

const VACCINATION_OPTIONS = [
  { value: 'UP_TO_DATE', label: 'Al día' },
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'OVERDUE', label: 'Atrasado' },
  { value: 'NONE', label: 'Sin vacunas' },
];

// ─── Multi-select chip component ───────────────────────────────────────────────

interface ChipFilterProps {
  label: string;
  options: { value: string; label: string; color?: string }[];
  selected: string[];
  onChange: (vals: string[]) => void;
}

function ChipFilter({ label, options, selected, onChange }: ChipFilterProps) {
  const [open, setOpen] = useState(false);

  function toggle(val: string) {
    onChange(
      selected.includes(val)
        ? selected.filter((v) => v !== val)
        : [...selected, val],
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors
          ${selected.length > 0
            ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400 dark:border-primary-600'
            : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400'
          }`}
      >
        {label}
        {selected.length > 0 && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary-600 text-white text-xs">
            {selected.length}
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-40 min-w-[160px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <span className={`flex-shrink-0 w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                  selected.includes(opt.value)
                    ? 'bg-primary-600 border-primary-600 text-white'
                    : 'border-gray-300 dark:border-gray-600'
                }`}>
                  {selected.includes(opt.value) && <CheckSquare className="w-3 h-3" />}
                </span>
                {opt.color
                  ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${opt.color}`}>{opt.label}</span>
                  : <span className="text-gray-700 dark:text-gray-300">{opt.label}</span>
                }
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Active filter chip ────────────────────────────────────────────────────────

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

// ─── Main Component ─────────────────────────────────────────────────────────────

export function BovinesListPage() {
  const navigate = useNavigate();
  const { user, activeRanchId } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();

  // ── Filters ──────────────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [qrSearch, setQrSearch] = useState('');
  const [showQrInput, setShowQrInput] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [healthFilter, setHealthFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [genderFilter, setGenderFilter] = useState<string[]>([]);
  const [breedFilter, setBreedFilter] = useState<string[]>([]);
  const [vaccinationFilter, setVaccinationFilter] = useState<string[]>([]);

  // ── Selection ─────────────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Bulk action modals ────────────────────────────────────────────────────────
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveLocationId, setMoveLocationId] = useState<string | null>(null);
  const [moveReason, setMoveReason] = useState('');

  // ── Queries ───────────────────────────────────────────────────────────────────
  const queryKey = ['bovines', page, search, qrSearch, healthFilter, typeFilter, genderFilter, breedFilter, vaccinationFilter];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      bovinesApi.list({
        page,
        limit: DEFAULT_PAGE_SIZE,
        search: search || qrSearch || undefined,
        cattleType: typeFilter.length === 1 ? typeFilter[0] : undefined,
        healthStatus: healthFilter.length === 1 ? healthFilter[0] : undefined,
        gender: genderFilter.length === 1 ? genderFilter[0] : undefined,
        breed: breedFilter.length === 1 ? breedFilter[0] : undefined,
        vaccinationStatus: vaccinationFilter.length === 1 ? vaccinationFilter[0] : undefined,
        ranchId: activeRanchId || undefined,
      }).then((r) => r.data.data),
  });

  const { data: stats } = useQuery({
    queryKey: ['bovines-stats'],
    queryFn: () => bovinesApi.statistics().then((r) => r.data.data),
  });

  // ── Breed options from stats ──────────────────────────────────────────────────
  const breedOptions = useMemo(() => {
    if (!stats?.byBreed) return [];
    return Object.entries(stats.byBreed)
      .sort((a, b) => b[1] - a[1])
      .map(([breed, count]) => ({ value: breed, label: `${breed} (${count})` }));
  }, [stats]);

  // ── Active filters summary ────────────────────────────────────────────────────
  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    healthFilter.forEach((v) => {
      const opt = HEALTH_OPTIONS.find((o) => o.value === v);
      chips.push({ key: `h-${v}`, label: opt?.label || v, clear: () => setHealthFilter((p) => p.filter((x) => x !== v)) });
    });
    typeFilter.forEach((v) => {
      const opt = CATTLE_TYPE_OPTIONS.find((o) => o.value === v);
      chips.push({ key: `t-${v}`, label: opt?.label || v, clear: () => setTypeFilter((p) => p.filter((x) => x !== v)) });
    });
    genderFilter.forEach((v) => {
      const opt = GENDER_OPTIONS.find((o) => o.value === v);
      chips.push({ key: `g-${v}`, label: opt?.label || v, clear: () => setGenderFilter((p) => p.filter((x) => x !== v)) });
    });
    breedFilter.forEach((v) => {
      chips.push({ key: `b-${v}`, label: v, clear: () => setBreedFilter((p) => p.filter((x) => x !== v)) });
    });
    vaccinationFilter.forEach((v) => {
      const opt = VACCINATION_OPTIONS.find((o) => o.value === v);
      chips.push({ key: `vac-${v}`, label: opt?.label || v, clear: () => setVaccinationFilter((p) => p.filter((x) => x !== v)) });
    });
    return chips;
  }, [healthFilter, typeFilter, genderFilter, breedFilter, vaccinationFilter]);

  function clearAllFilters() {
    setHealthFilter([]); setTypeFilter([]); setGenderFilter([]);
    setBreedFilter([]); setVaccinationFilter([]);
    setSearch(''); setQrSearch(''); setPage(1);
  }

  // ── Selection helpers ─────────────────────────────────────────────────────────
  const bovines = data?.items || [];
  const allOnPageSelected = bovines.length > 0 && bovines.every((b) => selectedIds.has(b.id));
  const someOnPageSelected = bovines.some((b) => selectedIds.has(b.id));

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

  function clearSelection() {
    setSelectedIds(new Set());
  }

  // ── Bulk move mutation ────────────────────────────────────────────────────────
  const moveMutation = useMutation({
    mutationFn: () => bovinesApi.bulkMove(Array.from(selectedIds), moveLocationId!, moveReason || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bovines'] });
      toast.success('Movimiento registrado', `${selectedIds.size} bovino(s) movidos al nuevo potrero.`);
      setShowMoveModal(false);
      setMoveLocationId(null);
      setMoveReason('');
      clearSelection();
    },
    onError: (err: any) => {
      toast.error('Error al mover', err?.response?.data?.error?.message || 'No se pudieron mover los bovinos.');
    },
  });

  // ── Print QRs ─────────────────────────────────────────────────────────────────
  function handlePrintQRs() {
    const selected = bovines.filter((b) => selectedIds.has(b.id));
    if (selected.length === 0) return;

    const win = window.open('', '_blank');
    if (!win) return;

    win.document.write(`
      <html><head><title>QRs Bovinos</title>
      <style>
        body { font-family: sans-serif; margin: 0; }
        .grid { display: flex; flex-wrap: wrap; gap: 16px; padding: 16px; }
        .card { border: 1px solid #ccc; border-radius: 8px; padding: 12px; text-align: center; width: 150px; page-break-inside: avoid; }
        .card h3 { margin: 0 0 4px; font-size: 14px; font-weight: 700; }
        .card p { margin: 0; font-size: 11px; color: #666; }
        .qr-placeholder { width: 100px; height: 100px; background: #f0f0f0; border: 1px dashed #999; margin: 8px auto; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #999; }
        @media print { @page { margin: 10mm; } }
      </style></head><body>
      <div class="grid">
        ${selected.map((b) => `
          <div class="card">
            <div class="qr-placeholder">${b.earTag}</div>
            <h3>${b.earTag}</h3>
            <p>${b.name || ''}</p>
            <p>${b.breed || ''}</p>
          </div>
        `).join('')}
      </div>
      </body></html>
    `);
    win.document.close();
    win.print();
  }

  // ── QR search ─────────────────────────────────────────────────────────────────
  function handleQrSearch(val: string) {
    setQrSearch(val);
    setSearch('');
    setPage(1);
  }

  // ── Columns ───────────────────────────────────────────────────────────────────
  const columns: Column<Bovine>[] = [
    // Checkbox column
    {
      key: 'id',
      header: (
        <button
          onClick={(e) => { e.stopPropagation(); toggleSelectAll(); }}
          className="flex items-center"
          title={allOnPageSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
        >
          {allOnPageSelected
            ? <CheckSquare className="w-4 h-4 text-primary-600" />
            : someOnPageSelected
              ? <CheckSquare className="w-4 h-4 text-primary-400" />
              : <Square className="w-4 h-4 text-gray-400" />
          }
        </button>
      ) as unknown as string,
      render: (b) => (
        <button
          onClick={(e) => { e.stopPropagation(); toggleRow(b.id); }}
          className="flex items-center"
        >
          {selectedIds.has(b.id)
            ? <CheckSquare className="w-4 h-4 text-primary-600" />
            : <Square className="w-4 h-4 text-gray-300 hover:text-gray-500" />
          }
        </button>
      ),
    },
    // Arete
    {
      key: 'earTag',
      header: 'Arete',
      render: (b) => (
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <span className="font-semibold text-primary-700 dark:text-primary-400 font-mono text-sm">
              {b.earTag}
            </span>
            {b.name && <span className="text-xs text-gray-500 dark:text-gray-400">{b.name}</span>}
          </div>
        </div>
      ),
    },
    // Raza / Tipo
    {
      key: 'breed',
      header: 'Raza / Tipo',
      render: (b) => (
        <div>
          <p className="text-sm text-gray-900 dark:text-white">{b.breed}</p>
          <Badge variant="info" className="mt-0.5 text-xs">
            {b.cattleTypeLabel || b.cattleType}
          </Badge>
        </div>
      ),
    },
    // Sexo
    {
      key: 'gender',
      header: 'Sexo',
      render: (b) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {b.gender === 'MALE' ? '♂ Macho' : b.gender === 'FEMALE' ? '♀ Hembra' : b.gender}
        </span>
      ),
    },
    // Salud
    {
      key: 'healthStatus',
      header: 'Salud',
      render: (b) => <HealthStatusBadge status={b.healthStatus} />,
    },
    // Vacunación
    {
      key: 'vaccinationStatus',
      header: 'Vacunación',
      render: (b) => {
        const v = b.vaccinationStatus;
        if (!v) return <span className="text-gray-400 text-sm">—</span>;
        const map: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'default' }> = {
          UP_TO_DATE: { label: 'Al día', variant: 'success' },
          PENDING: { label: 'Pendiente', variant: 'warning' },
          OVERDUE: { label: 'Atrasado', variant: 'danger' },
          NONE: { label: 'Sin vacunas', variant: 'default' },
        };
        const cfg = map[v];
        return cfg ? <Badge variant={cfg.variant}>{cfg.label}</Badge> : <span className="text-sm">{v}</span>;
      },
    },
    // Peso / Edad
    {
      key: 'weight',
      header: 'Peso / Edad',
      render: (b) => (
        <div className="text-sm">
          {b.weight
            ? <p className="flex items-center gap-1"><Weight className="w-3 h-3 text-gray-400" />{b.weight} kg</p>
            : <p className="text-gray-400">— kg</p>
          }
          <p className="text-xs text-gray-400 mt-0.5">{b.ageDisplay || (b.birthDate ? formatDate(b.birthDate) : '—')}</p>
        </div>
      ),
    },
    // Ubicación
    {
      key: 'ranch',
      header: 'Ubicación',
      render: (b) => (
        <div className="text-sm">
          <p className="text-gray-900 dark:text-white flex items-center gap-1">
            <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
            {b.ranch?.name || '—'}
          </p>
        </div>
      ),
    },
  ];

  const canManage = user && canUser(user.role, 'MANAGE_BOVINE');
  const canMove = user && canUser(user.role, 'MOVE_BOVINE');

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary-50 dark:bg-primary-900/30 p-3">
            <Beef className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bovinos</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Gestión del inventario ganadero
              {data?.total != null && ` · ${data.total.toLocaleString()} registros`}
            </p>
          </div>
        </div>
        {canManage && (
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => navigate('/bovines/new')}>
            Nuevo Bovino
          </Button>
        )}
      </div>

      {/* ── Stats ───────────────────────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCard title="Total" value={stats.total} icon={Beef} color="primary" />
          <StatCard title="Activos" value={stats.active} icon={Beef} color="emerald" />
          <StatCard title="En cuarentena" value={stats.quarantined} icon={Beef} color="amber" />
          <StatCard title="Fallecidos" value={stats.deceased} icon={Beef} color="gray" />
          <StatCard title="Vendidos" value={stats.sold} icon={Beef} color="blue" />
        </div>
      )}

      {/* ── Search bar + controls ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Main search */}
        {!showQrInput ? (
          <div className="flex-1">
            <Input
              placeholder="Buscar por arete, nombre o raza..."
              icon={<Search className="w-4 h-4" />}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setQrSearch(''); setPage(1); }}
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1">
              <Input
                placeholder="Introduce el código QR del arete..."
                icon={<QrCode className="w-4 h-4 text-primary-500" />}
                value={qrSearch}
                onChange={(e) => handleQrSearch(e.target.value)}
                autoFocus
              />
            </div>
            <button
              onClick={() => { setShowQrInput(false); setQrSearch(''); }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* QR scan toggle */}
        <Button
          variant={showQrInput ? 'primary' : 'outline'}
          icon={<QrCode className="w-4 h-4" />}
          onClick={() => { setShowQrInput((v) => !v); setSearch(''); setQrSearch(''); }}
          title="Buscar por código QR"
        >
          <span className="hidden sm:inline">QR</span>
        </Button>

        {/* Filters toggle */}
        <Button
          variant={showFilters ? 'primary' : 'outline'}
          icon={<SlidersHorizontal className="w-4 h-4" />}
          onClick={() => setShowFilters((v) => !v)}
        >
          <span className="hidden sm:inline">Filtros</span>
          {activeFilters.length > 0 && (
            <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/30 text-xs font-bold">
              {activeFilters.length}
            </span>
          )}
        </Button>
      </div>

      {/* ── Advanced filters panel ─────────────────────────────────────────── */}
      {showFilters && (
        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-4">
          <div className="flex flex-wrap gap-2">
            <ChipFilter
              label="Salud"
              options={HEALTH_OPTIONS}
              selected={healthFilter}
              onChange={(v) => { setHealthFilter(v); setPage(1); }}
            />
            <ChipFilter
              label="Tipo"
              options={CATTLE_TYPE_OPTIONS}
              selected={typeFilter}
              onChange={(v) => { setTypeFilter(v); setPage(1); }}
            />
            <ChipFilter
              label="Sexo"
              options={GENDER_OPTIONS}
              selected={genderFilter}
              onChange={(v) => { setGenderFilter(v); setPage(1); }}
            />
            {breedOptions.length > 0 && (
              <ChipFilter
                label="Raza"
                options={breedOptions}
                selected={breedFilter}
                onChange={(v) => { setBreedFilter(v); setPage(1); }}
              />
            )}
            <ChipFilter
              label="Vacunación"
              options={VACCINATION_OPTIONS}
              selected={vaccinationFilter}
              onChange={(v) => { setVaccinationFilter(v); setPage(1); }}
            />

            {activeFilters.length > 0 && (
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Limpiar todo
              </button>
            )}
          </div>

          {/* Active filter chips */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((f) => (
                <ActiveChip key={f.key} label={f.label} onRemove={() => { f.clear(); setPage(1); }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active filter chips (outside panel, always visible) */}
      {!showFilters && activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">Filtros activos:</span>
          {activeFilters.map((f) => (
            <ActiveChip key={f.key} label={f.label} onRemove={() => { f.clear(); setPage(1); }} />
          ))}
          <button
            onClick={clearAllFilters}
            className="text-xs text-red-500 hover:underline"
          >
            Limpiar todo
          </button>
        </div>
      )}

      {/* ── Bulk action bar ──────────────────────────────────────────────────── */}
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
            <Button
              size="sm"
              variant="outline"
              icon={<Printer className="w-3.5 h-3.5" />}
              onClick={handlePrintQRs}
            >
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

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      <DataTable<Bovine>
        columns={columns}
        data={bovines}
        loading={isLoading}
        keyExtractor={(b) => b.id}
        page={page}
        totalPages={data?.totalPages || 1}
        total={data?.total || 0}
        onPageChange={setPage}
        onRowClick={(b) => navigate(`/bovines/${b.id}`)}
        emptyMessage="No se encontraron bovinos con los filtros aplicados"
        rowClassName={(b: Bovine) => selectedIds.has(b.id)
          ? 'bg-primary-50/50 dark:bg-primary-900/10'
          : ''
        }
      />

      {/* ── Modal: Mover a otro potrero ──────────────────────────────────────── */}
      <Modal
        open={showMoveModal}
        onClose={() => { setShowMoveModal(false); setMoveLocationId(null); setMoveReason(''); }}
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

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Razón del movimiento <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={moveReason}
              onChange={(e) => setMoveReason(e.target.value)}
              placeholder="Ej: Rotación de potrero, cuarentena, mantenimiento..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => { setShowMoveModal(false); setMoveLocationId(null); setMoveReason(''); }}
            >
              Cancelar
            </Button>
            <Button
              icon={<MoveRight className="w-4 h-4" />}
              disabled={!moveLocationId || moveMutation.isPending}
              loading={moveMutation.isPending}
              onClick={() => moveMutation.mutate()}
            >
              Confirmar movimiento
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
