import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ranchApi } from '@/api/ranch.api';
import { Home, ChevronDown, X, Loader2 } from 'lucide-react';

interface RanchSelectorProps {
  value?: string | null;
  onChange: (ranchId: string | null, ranchName?: string) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
}

/**
 * Searchable ranch selector backed by /api/ranch.
 * Shows a text input + dropdown with filtered results.
 */
export function RanchSelector({
  value,
  onChange,
  label = 'Rancho',
  placeholder = 'Buscar rancho...',
  error,
  disabled = false,
  clearable = true,
  className = '',
}: RanchSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['ranches-selector'],
    queryFn: () => ranchApi.list({ limit: 100 }),
    staleTime: 1000 * 60 * 5,
  });

  const ranches = data?.items || [];
  const filtered = ranches.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.ranchCode?.toLowerCase().includes(search.toLowerCase()),
  );

  const selected = ranches.find((r) => r.id === value);

  // Close on outside click
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

  function handleInputFocus() {
    if (!disabled) setOpen(true);
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
        <Home className="w-4 h-4 text-gray-400 shrink-0" />

        {selected && !open ? (
          <span className="flex-1 text-gray-900 dark:text-white truncate">{selected.name}</span>
        ) : (
          <input
            type="text"
            value={open ? search : selected ? selected.name : ''}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={handleInputFocus}
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
            filtered.map((ranch) => (
              <button
                key={ranch.id}
                type="button"
                className={`w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors
                  ${ranch.id === value ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400' : 'text-gray-900 dark:text-white'}
                `}
                onClick={() => handleSelect(ranch.id, ranch.name)}
              >
                <Home className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
                <div>
                  <p className="text-sm font-medium">{ranch.name}</p>
                  <p className="text-xs text-gray-400">{ranch.ranchCode} &middot; {ranch.city}, {ranch.state}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
