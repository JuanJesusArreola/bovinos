import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { cn } from '@/utils/cn';
import { Filter, X, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';

export interface MapFilters {
  healthStatus: string[];
  breeds: string[];
  gender: string[];
  ageMin?: number;
  ageMax?: number;
  diseases: string[];
}

interface MapFiltersPanelProps {
  filters: MapFilters;
  onChange: (filters: MapFilters) => void;
  availableBreeds?: string[];
  className?: string;
}

const HEALTH_STATUSES = [
  { value: 'HEALTHY', label: 'Saludable', color: '#22c55e' },
  { value: 'SICK', label: 'Enfermo', color: '#f59e0b' },
  { value: 'RECOVERING', label: 'Recuperación', color: '#3b82f6' },
  { value: 'QUARANTINE', label: 'Cuarentena', color: '#a855f7' },
  { value: 'DECEASED', label: 'Fallecido', color: '#ef4444' },
  { value: 'UNKNOWN', label: 'Desconocido', color: '#6b7280' },
];

const GENDERS = [
  { value: 'MALE', label: 'Macho' },
  { value: 'FEMALE', label: 'Hembra' },
];

const COMMON_DISEASES = [
  'Mastitis',
  'Neumonía',
  'Diarrea',
  'Fiebre Aftosa',
  'Brucelosis',
  'Tuberculosis',
  'Parasitosis',
  'Metritis',
  'Hipocalcemia',
  'Leptospirosis',
];

const DEFAULT_BREEDS = [
  'Holstein', 'Brahman', 'Angus', 'Hereford', 'Charolais',
  'Simmental', 'Limousin', 'Jersey', 'Gyr', 'Suizo',
];

export function MapFiltersPanel({
  filters,
  onChange,
  availableBreeds,
  className,
}: MapFiltersPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [showBreeds, setShowBreeds] = useState(false);
  const [showDiseases, setShowDiseases] = useState(false);
  const breeds = availableBreeds || DEFAULT_BREEDS;

  const activeCount =
    filters.healthStatus.length +
    filters.breeds.length +
    filters.gender.length +
    filters.diseases.length +
    (filters.ageMin ? 1 : 0) +
    (filters.ageMax ? 1 : 0);

  function toggleArrayFilter(key: 'healthStatus' | 'breeds' | 'gender' | 'diseases', value: string) {
    const current = filters[key];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ ...filters, [key]: updated });
  }

  function resetFilters() {
    onChange({ healthStatus: [], breeds: [], gender: [], ageMin: undefined, ageMax: undefined, diseases: [] });
  }

  return (
    <div className={cn(
      'rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden',
      className,
    )}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-primary-600" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">Filtros de Mapa</span>
          {activeCount > 0 && (
            <Badge variant="info">{activeCount} activos</Badge>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 dark:border-gray-800 pt-3">
          {/* Reset */}
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" icon={<RotateCcw className="w-3 h-3" />} onClick={resetFilters}>
              Limpiar filtros
            </Button>
          )}

          {/* Health Status */}
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Estado de Salud</p>
            <div className="flex flex-wrap gap-1.5">
              {HEALTH_STATUSES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => toggleArrayFilter('healthStatus', s.value)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                    filters.healthStatus.includes(s.value)
                      ? 'border-transparent text-white'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400',
                  )}
                  style={filters.healthStatus.includes(s.value) ? { backgroundColor: s.color } : {}}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Gender */}
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Sexo</p>
            <div className="flex gap-2">
              {GENDERS.map((g) => (
                <button
                  key={g.value}
                  onClick={() => toggleArrayFilter('gender', g.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    filters.gender.includes(g.value)
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-primary-400',
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Age Range */}
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Rango de Edad (meses)</p>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                placeholder="Mín"
                min={0}
                value={filters.ageMin ?? ''}
                onChange={(e) => onChange({ ...filters, ageMin: e.target.value ? Number(e.target.value) : undefined })}
              />
              <Input
                type="number"
                placeholder="Máx"
                min={0}
                value={filters.ageMax ?? ''}
                onChange={(e) => onChange({ ...filters, ageMax: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>
          </div>

          {/* Breeds */}
          <div>
            <button
              onClick={() => setShowBreeds(!showBreeds)}
              className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2"
            >
              Razas {filters.breeds.length > 0 && `(${filters.breeds.length})`}
              {showBreeds ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {showBreeds && (
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {breeds.map((breed) => (
                  <button
                    key={breed}
                    onClick={() => toggleArrayFilter('breeds', breed)}
                    className={cn(
                      'px-2 py-1 rounded-full text-xs border transition-colors',
                      filters.breeds.includes(breed)
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400',
                    )}
                  >
                    {breed}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Diseases */}
          <div>
            <button
              onClick={() => setShowDiseases(!showDiseases)}
              className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2"
            >
              Enfermedades {filters.diseases.length > 0 && `(${filters.diseases.length})`}
              {showDiseases ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {showDiseases && (
              <div className="flex flex-wrap gap-1.5">
                {COMMON_DISEASES.map((disease) => (
                  <button
                    key={disease}
                    onClick={() => toggleArrayFilter('diseases', disease)}
                    className={cn(
                      'px-2 py-1 rounded-full text-xs border transition-colors',
                      filters.diseases.includes(disease)
                        ? 'bg-red-600 text-white border-red-600'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400',
                    )}
                  >
                    {disease}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
