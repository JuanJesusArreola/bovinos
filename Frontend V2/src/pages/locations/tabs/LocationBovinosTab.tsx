import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { bovinesApi } from '@/api/bovines.api';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { HealthStatusBadge } from '@/components/ui/HealthStatusBadge';
import { cn } from '@/utils/cn';
import { formatDate } from '@/utils/formatters';
import {
  Beef, Search, ChevronRight, Mars, Venus, Scale, Clock, ExternalLink,
} from 'lucide-react';
import type { Bovine } from '@/types';

// ─── Gender badge ─────────────────────────────────────────────────────────────

function GenderChip({ gender }: { gender: string }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium',
      gender === 'MALE'
        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
        : 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
    )}>
      {gender === 'MALE' ? <Mars className="w-3 h-3" /> : <Venus className="w-3 h-3" />}
      {gender === 'MALE' ? 'M' : 'F'}
    </span>
  );
}

// ─── BovineRow ────────────────────────────────────────────────────────────────

const CATTLE_LABEL: Record<string, string> = {
  CATTLE: 'Ganado', BULL: 'Toro', COW: 'Vaca', CALF: 'Becerro/a',
};

const AVATAR_GRADIENTS = [
  'from-amber-400 to-orange-500', 'from-emerald-400 to-teal-600',
  'from-blue-400 to-indigo-600',  'from-violet-400 to-purple-600',
  'from-rose-400 to-pink-600',
];

function getGradient(earTag: string) {
  return AVATAR_GRADIENTS[(earTag.charCodeAt(0) || 0) % AVATAR_GRADIENTS.length];
}

function BovineRow({ bovine, onClick }: { bovine: Bovine; onClick: () => void }) {
  const initial = bovine.earTag.replace(/[^A-Za-z0-9]/g, '').charAt(0).toUpperCase() || '?';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors group text-left"
    >
      {/* Avatar */}
      <div className={cn(
        'shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br flex items-center justify-center text-white font-bold text-sm shadow-sm',
        getGradient(bovine.earTag),
      )}>
        {initial}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{bovine.earTag}</span>
          {bovine.name && <span className="text-xs text-gray-400 truncate">"{bovine.name}"</span>}
          <GenderChip gender={bovine.gender} />
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
          <span>{bovine.breed}</span>
          <span>·</span>
          <span>{CATTLE_LABEL[bovine.cattleType] ?? bovine.cattleType}</span>
          {bovine.ageDisplay && <><span>·</span><span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{bovine.ageDisplay}</span></>}
          {bovine.weight && <><span>·</span><span className="flex items-center gap-0.5"><Scale className="w-3 h-3" />{bovine.weight} kg</span></>}
        </div>
      </div>

      {/* Health + arrow */}
      <div className="shrink-0 flex items-center gap-2">
        <HealthStatusBadge status={bovine.healthStatus} showIcon={false} size="sm" />
        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-500 transition-colors" />
      </div>
    </button>
  );
}

// ─── LocationBovinosTab ───────────────────────────────────────────────────────

interface Props {
  locationId: string;
  locationName: string;
}

export function LocationBovinosTab({ locationId, locationName }: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['bovines-at-location', locationId, page],
    queryFn: () =>
      // Backend filter name is `locationId` (NOT `currentLocationId`) —
      // it JOINs against BovineLocationHistory to find bovines with an
      // active stay at that potrero. The previous param was silently
      // ignored by the validator, returning ALL bovines of the ranch.
      bovinesApi.list({ locationId, page, limit: LIMIT })
        .then((r) => r.data.data),
    enabled: !!locationId,
    staleTime: 1000 * 60,
  });

  // Canonical field is `bovines`; `items` is a legacy alias that isn't
  // always populated. Prefer the canonical first.
  const items: Bovine[] = (data?.bovines ?? data?.items ?? []) as Bovine[];
  const total: number   = (data?.pagination?.total ?? data?.total ?? items.length) as number;
  const totalPages      = Math.ceil(total / LIMIT);

  const filtered = search.trim()
    ? items.filter((b) =>
        b.earTag.toLowerCase().includes(search.toLowerCase()) ||
        b.name?.toLowerCase().includes(search.toLowerCase()) ||
        b.breed.toLowerCase().includes(search.toLowerCase()),
      )
    : items;

  return (
    <Card className="overflow-hidden p-0">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/40">
            <Beef className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <CardTitle>Bovinos en {locationName}</CardTitle>
            {total > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">{total} animal{total !== 1 ? 'es' : ''}</p>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          icon={<ExternalLink className="w-3.5 h-3.5" />}
          onClick={() => navigate(`/bovines?locationId=${locationId}`)}
        >
          Ver en Bovinos
        </Button>
      </div>

      {/* Search */}
      <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
        <Input
          placeholder="Buscar por arete, nombre o raza..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="h-8 text-sm"
          icon={<Search className="w-4 h-4 text-gray-400" />}
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="md" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center px-6">
          <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <Beef className="w-7 h-7 text-gray-300 dark:text-gray-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {search ? 'Sin resultados' : 'Sin animales en esta ubicación'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {search ? 'Intenta con otro término.' : 'Mueve bovinos aquí desde su ficha individual.'}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="divide-y divide-gray-50 dark:divide-gray-800/80">
            {filtered.map((b) => (
              <BovineRow key={b.id} bovine={b} onClick={() => navigate(`/bovines/${b.id}`)} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400">
              <span>Página {page} de {totalPages}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Anterior
                </Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
