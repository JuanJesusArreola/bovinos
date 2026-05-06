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
}: LocationSelectorProps) {
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
            filtered.map((loc) => (
              <button
                key={loc.id}
                type="button"
                className={`w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors
                  ${loc.id === value ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400' : 'text-gray-900 dark:text-white'}
                `}
                onClick={() => handleSelect(loc.id, loc.name)}
              >
                <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
                <div>
                  <p className="text-sm font-medium">{loc.name}</p>
                  <p className="text-xs text-gray-400">{loc.locationCode} &middot; {loc.type}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
