import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { locationsApi } from '@/api/locations.api';
import { MapPin, ChevronDown, X, Loader2 } from 'lucide-react';
import type { LocationType } from '@/types/location.types';

interface LocationSelectorProps {
  value?: string | null;
  onChange: (locationId: string | null, locationName?: string) => void;
  ranchId?: string | null;
  /** Optionally restrict to specific location types */
  filterTypes?: LocationType[];
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
  /**
   * IDs que NO se pueden seleccionar (siguen visibles en la lista pero
   * marcados con badge `disabledHint`). Caso de uso principal (F-13 / M-02
   * frontend): deshabilitar el potrero donde el bovino ya esta para evitar
   * intentos de mover-al-mismo-sitio.
   */
  disabledIds?: string[];
  /**
   * Texto del badge mostrado junto a un item deshabilitado. Default:
   * "No disponible". Para F-13 pasar "Ubicación actual".
   */
  disabledHint?: string;
}

/**
 * Searchable location selector backed by /api/locations.
 * Optionally filtered by ranchId and/or location types.
 */
export function LocationSelector({
  value,
  onChange,
  ranchId,
  filterTypes,
  label = 'Ubicación',
  placeholder = 'Buscar ubicación...',
  error,
  disabled = false,
  clearable = true,
  className = '',
  disabledIds,
  disabledHint = 'No disponible',
}: LocationSelectorProps) {
  // Set para lookup O(1) sin tener que escribir `disabledIds?.includes(id)`
  // en cada render del dropdown.
  const disabledSet = new Set(disabledIds ?? []);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['locations-selector', ranchId],
    queryFn: () => locationsApi.list({ limit: 100, ...(ranchId ? { ranchId } : {}) } as any),
    staleTime: 1000 * 60 * 5,
    enabled: true,
  });

  const locations = data?.items || [];
  const filtered = locations.filter((loc) => {
    const matchSearch =
      loc.name.toLowerCase().includes(search.toLowerCase()) ||
      loc.locationCode?.toLowerCase().includes(search.toLowerCase());
    const matchType = filterTypes ? filterTypes.includes(loc.type as LocationType) : true;
    return matchSearch && matchType;
  });

  const selected = locations.find((loc) => loc.id === value);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        if (!selected) setSearch('');
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [selected]);

  function handleSelect(id: string, name: string) {
    onChange(id, name);
    setSearch('');
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
    setSearch('');
    setOpen(false);
  }

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </label>
      )}

      <div
        className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-900 text-sm transition-colors cursor-pointer
          ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'}
          ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-primary-500 dark:hover:border-primary-500'}
          ${open ? 'border-primary-500 ring-2 ring-primary-500/20' : ''}
        `}
        onClick={() => !disabled && setOpen((o) => !o)}
      >
        <MapPin className="w-4 h-4 text-gray-400 shrink-0" />

        {selected && !open ? (
          <span className="flex-1 text-gray-900 dark:text-white truncate">{selected.name}</span>
        ) : (
          <input
            type="text"
            value={open ? search : selected ? selected.name : ''}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => !disabled && setOpen(true)}
            placeholder={placeholder}
            disabled={disabled}
            className="flex-1 bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400"
            onClick={(e) => e.stopPropagation()}
          />
        )}

        <div className="flex items-center gap-1 shrink-0">
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          {clearable && selected && !disabled && (
            <button type="button" onClick={handleClear} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
              {isLoading ? 'Cargando...' : 'Sin resultados'}
            </div>
          ) : (
            filtered.map((loc) => {
              const isDisabled = disabledSet.has(loc.id);

              // F-19 / Backend L-01: contador de ocupacion "X/Y bovinos".
              // `loc.capacity` viene eager-loaded en /api/locations (Backend
              // mantiene `currentAnimals` sincronizado en cada entry/exit).
              // Si la location no tiene LocationCapacity definida, no se
              // muestra contador (no hay maximo contra el cual comparar).
              const cap = loc.capacity;
              const hasCapacity = !!cap && typeof cap.maxAnimals === 'number' && cap.maxAnimals > 0;
              const occupancyPct = hasCapacity
                ? Math.round((cap!.currentAnimals / cap!.maxAnimals) * 100)
                : null;
              const isFull = hasCapacity && cap!.currentAnimals >= cap!.maxAnimals;
              const isWarning = hasCapacity && occupancyPct! >= 80 && !isFull;

              // Item deshabilitado: se muestra atenuado, sin handler de
              // click, con badge `disabledHint` para que el usuario entienda
              // por que no es seleccionable (F-13: "Ubicación actual").
              if (isDisabled) {
                return (
                  <div
                    key={loc.id}
                    className="w-full flex items-start gap-2 px-3 py-2.5 text-left bg-gray-50 dark:bg-gray-800/50 cursor-not-allowed opacity-70"
                    aria-disabled="true"
                    title={disabledHint}
                  >
                    <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-gray-300 dark:text-gray-600" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                          {loc.name}
                        </p>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 shrink-0">
                          {disabledHint}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">
                        {loc.locationCode} &middot; {loc.type}
                        {hasCapacity && (
                          <span className="ml-2">
                            &middot; {cap!.currentAnimals}/{cap!.maxAnimals} bovinos
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              }
              return (
                <button
                  key={loc.id}
                  type="button"
                  className={`w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors
                    ${loc.id === value ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400' : 'text-gray-900 dark:text-white'}
                  `}
                  onClick={() => handleSelect(loc.id, loc.name)}
                  title={
                    isFull
                      ? `Lleno (${cap!.currentAnimals}/${cap!.maxAnimals}). Requerirá confirmación para forzar.`
                      : hasCapacity
                        ? `Ocupación ${occupancyPct}% (${cap!.currentAnimals}/${cap!.maxAnimals})`
                        : undefined
                  }
                >
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">{loc.name}</p>
                      {/* Badge de capacidad: rojo si lleno, ambar si >=80%,
                          gris para el resto. Solo se muestra si la location
                          tiene LocationCapacity definida. */}
                      {hasCapacity && (
                        <span
                          className={
                            isFull
                              ? 'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 shrink-0'
                              : isWarning
                                ? 'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 shrink-0'
                                : 'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 shrink-0'
                          }
                        >
                          {cap!.currentAnimals}/{cap!.maxAnimals}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">{loc.locationCode} &middot; {loc.type}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
