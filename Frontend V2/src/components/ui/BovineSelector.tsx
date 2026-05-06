import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { bovinesApi } from '@/api/bovines.api';
import { Tag, ChevronDown, X, Loader2 } from 'lucide-react';

interface BovineSelectorProps {
  value?: string | null;
  onChange: (bovineId: string | null, bovineTag?: string) => void;
  ranchId?: string | null;
  /** Optionally restrict to a specific gender (e.g. 'FEMALE' for dam selection) */
  filterGender?: string;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
  /** Exclude specific bovine IDs from the list (e.g. exclude self) */
  excludeIds?: string[];
}

/**
 * Searchable bovine selector backed by /api/bovines.
 * Useful for dam/sire pickers, movement destination, health records, etc.
 */
export function BovineSelector({
  value,
  onChange,
  ranchId,
  filterGender,
  label = 'Bovino',
  placeholder = 'Buscar por arete o nombre...',
  error,
  disabled = false,
  clearable = true,
  className = '',
  excludeIds = [],
}: BovineSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['bovines-selector', ranchId, filterGender],
    queryFn: () =>
      bovinesApi
        .list({
          limit: 100,          // backend max is 100
          ...(ranchId ? { ranchId } : {}),
          ...(filterGender ? { gender: filterGender } : {}),
        })
        .then((r) => r.data.data),
    staleTime: 1000 * 60 * 3,
  });

  const bovines = (data?.items || []).filter((b) => !excludeIds.includes(b.id));
  const filtered = bovines.filter((b) => {
    const q = search.toLowerCase();
    return (
      b.earTag.toLowerCase().includes(q) ||
      (b.name && b.name.toLowerCase().includes(q))
    );
  });

  const selected = bovines.find((b) => b.id === value);

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

  function handleSelect(id: string, tag: string) {
    onChange(id, tag);
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
        <Tag className="w-4 h-4 text-gray-400 shrink-0" />

        {selected && !open ? (
          <span className="flex-1 text-gray-900 dark:text-white truncate">
            {selected.earTag}{selected.name ? ` — ${selected.name}` : ''}
          </span>
        ) : (
          <input
            type="text"
            value={open ? search : selected ? `${selected.earTag}${selected.name ? ` — ${selected.name}` : ''}` : ''}
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
            filtered.map((bovine) => (
              <button
                key={bovine.id}
                type="button"
                className={`w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors
                  ${bovine.id === value ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400' : 'text-gray-900 dark:text-white'}
                `}
                onClick={() => handleSelect(bovine.id, bovine.earTag)}
              >
                <Tag className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
                <div>
                  <p className="text-sm font-medium">{bovine.earTag}</p>
                  <p className="text-xs text-gray-400">
                    {bovine.name && <span>{bovine.name} &middot; </span>}
                    {bovine.breed} &middot; {bovine.gender}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
