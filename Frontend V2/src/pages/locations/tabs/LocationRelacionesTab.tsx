import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { locationsApi } from '@/api/locations.api';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/store/ToastContext';
import { useAuth } from '@/store/AuthContext';
import { canUser } from '@/utils/permissions';
import { cn } from '@/utils/cn';
import { getFriendlyMessage } from '@/utils/errorHandler';
import {
  Network, Plus, Trash2, ExternalLink,
  GitBranch, ArrowUpToLine, ArrowDownToLine, Shuffle, Route, MapPin,
} from 'lucide-react';
import { RelationType } from '@/types/location.types';
import type { LocationRelation, LocationRelationGroup } from '@/types/location.types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const RELATION_META: Record<RelationType, { label: string; color: string; Icon: React.FC<{ className?: string }> }> = {
  [RelationType.ADJACENT]:  { label: 'Adyacente',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',   Icon: Shuffle },
  [RelationType.CONNECTED]: { label: 'Conectada',  color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400', Icon: Network },
  [RelationType.CONTAINS]:  { label: 'Contiene',   color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', Icon: GitBranch },
  [RelationType.ROUTE]:     { label: 'Ruta',       color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', Icon: Route },
  [RelationType.OVERLAPS]:  { label: 'Superpuesta', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', Icon: MapPin },
  [RelationType.NEAR]:      { label: 'Cercana',    color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',       Icon: MapPin },
};

const LOCATION_TYPE_LABEL: Record<string, string> = {
  PASTURE: 'Potrero', CORRAL: 'Corral', BARN: 'Establo', MILKING_PARLOR: 'Sala de ordeño',
  FEED_AREA: 'Área de alimentación', WATER_SOURCE: 'Fuente de agua', QUARANTINE_AREA: 'Cuarentena',
  LOADING_AREA: 'Área de carga', STORAGE: 'Almacén', OTHER: 'Otro',
};

// ─── RelationCard ─────────────────────────────────────────────────────────────

function RelationCard({
  relation,
  canManage,
  onRemove,
  onNavigate,
}: {
  relation: LocationRelation;
  canManage: boolean;
  onRemove: (id: string) => void;
  onNavigate: (locationId: string) => void;
}) {
  const loc = relation.relatedLocation;
  const meta = RELATION_META[relation.relationType] ?? RELATION_META[RelationType.NEAR];
  const Icon = meta.Icon;

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 group hover:border-primary-200 dark:hover:border-primary-800 transition-colors">
      {/* Icon */}
      <div className="shrink-0 w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {loc?.name ?? relation.relatedLocationId}
          </span>
          {loc?.locationCode && (
            <span className="text-xs text-gray-400">[{loc.locationCode}]</span>
          )}
          <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded', meta.color)}>
            {meta.label}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400 flex-wrap">
          {loc?.type && <span>{LOCATION_TYPE_LABEL[loc.type] ?? loc.type}</span>}
          {relation.distance != null && (
            <><span>·</span><span>{relation.distance} m</span></>
          )}
          {relation.notes && (
            <><span>·</span><span className="truncate max-w-[160px]">{relation.notes}</span></>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => onNavigate(relation.relatedLocationId)}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600 transition-colors"
          title="Ver ubicación"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
        {canManage && (
          <button
            type="button"
            onClick={() => onRemove(relation.id)}
            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600 transition-colors"
            title="Eliminar relación"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── RelationGroup ─────────────────────────────────────────────────────────────

function RelationGroup({
  title,
  icon: Icon,
  relations,
  canManage,
  onRemove,
  onNavigate,
}: {
  title: string;
  icon: React.FC<{ className?: string }>;
  relations: LocationRelation[];
  canManage: boolean;
  onRemove: (id: string) => void;
  onNavigate: (locationId: string) => void;
}) {
  if (relations.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 text-gray-400" />
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {title}
        </h4>
        <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">
          {relations.length}
        </span>
      </div>
      <div className="space-y-2">
        {relations.map((r) => (
          <RelationCard
            key={r.id}
            relation={r}
            canManage={canManage}
            onRemove={onRemove}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  );
}

// ─── AddRelationModal ─────────────────────────────────────────────────────────

function AddRelationModal({
  locationId,
  ranchId,
  open,
  onClose,
}: {
  locationId: string;
  /** Ranch of the source location. Used to filter related options to same ranch. */
  ranchId?: string;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [relatedId, setRelatedId]     = useState('');
  const [relType, setRelType]         = useState<RelationType>(RelationType.ADJACENT);
  const [distance, setDistance]       = useState('');
  const [notes, setNotes]             = useState('');

  // Search locations — filter server-side by ranchId when known so we never
  // receive cross-ranch options. Falls back to broad list if ranchId missing.
  const { data: locData, isLoading: loadingLocs } = useQuery({
    queryKey: ['locations-search-relations', ranchId],
    queryFn: () => locationsApi.list({
      limit: 100,
      ...(ranchId ? { ranchId } : {}),
    } as any).then((r) => r.items),
    staleTime: 1000 * 60 * 5,
    enabled: open,
  });

  // Defensive client-side filter: even if backend doesn't honor ranchId, drop
  // any cross-ranch result. Cross-ranch relations are forbidden (Phase 7.3).
  const locations = (locData ?? [])
    .filter((l) => l.id !== locationId)
    .filter((l) => !ranchId || l.ranchId === ranchId);

  const mutation = useMutation({
    mutationFn: async () => {
      // Defense-in-depth: even though we pre-filter the dropdown by ranchId,
      // double-check the selected target is in the same ranch as the source.
      // This catches any race condition (stale list while ranches changed).
      if (ranchId) {
        const target = locations.find((l) => l.id === relatedId);
        if (target && target.ranchId !== ranchId) {
          const err: any = new Error(
            'No se permite crear relaciones entre ubicaciones de ranchos distintos.',
          );
          err.__handled = true;
          throw err;
        }
      }
      return locationsApi.addRelation({
        fromLocationId: locationId,
        toLocationId: relatedId,
        relationType: relType,
        distance: distance ? Number(distance) : undefined,
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success('Relación agregada');
      queryClient.invalidateQueries({ queryKey: ['location-relations', locationId] });
      onClose();
      setRelatedId(''); setRelType(RelationType.ADJACENT); setDistance(''); setNotes('');
    },
    onError: (err: any) => {
      // Special-case the backend's RELATION_CROSS_RANCH for a clearer message.
      if (err?.response?.data?.code === 'RELATION_CROSS_RANCH') {
        toast.error(
          'Ranchos distintos',
          'No se permite crear relaciones entre ubicaciones de ranchos distintos. Selecciona una ubicación del mismo rancho.',
        );
        return;
      }
      const msg = err?.__handled ? err.message : getFriendlyMessage(err);
      toast.error('Error', msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!relatedId) return;
    mutation.mutate();
  };

  return (
    <Modal open={open} onClose={onClose} title="Agregar relación" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Cross-ranch notice */}
        {ranchId && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40 text-xs text-blue-700 dark:text-blue-400">
            <span>ℹ️</span>
            <span>
              Solo se pueden relacionar ubicaciones <strong>del mismo rancho</strong>.
              El listado abajo está filtrado automáticamente.
            </span>
          </div>
        )}

        {/* Related location */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Ubicación relacionada <span className="text-red-500">*</span>
          </label>
          {loadingLocs ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
              <Spinner size="sm" /> Cargando ubicaciones…
            </div>
          ) : locations.length === 0 ? (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40 text-xs text-amber-700 dark:text-amber-400">
              <span>⚠️</span>
              <span>
                Este rancho aún no tiene otras ubicaciones disponibles para relacionar.
                Crea otras ubicaciones en el mismo rancho antes de definir relaciones.
              </span>
            </div>
          ) : (
            <select
              value={relatedId}
              onChange={(e) => setRelatedId(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Seleccionar…</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} [{l.locationCode}] — {LOCATION_TYPE_LABEL[l.type] ?? l.type}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Relation type */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Tipo de relación <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {Object.values(RelationType).map((rt) => {
              const meta = RELATION_META[rt];
              const Icon = meta.Icon;
              return (
                <button
                  key={rt}
                  type="button"
                  onClick={() => setRelType(rt)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors',
                    relType === rt
                      ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400',
                  )}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Distance */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Distancia (m) <span className="text-xs text-gray-400 font-normal">— opcional</span>
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            placeholder="Ej: 250"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Notes */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Notas <span className="text-xs text-gray-400 font-normal">— opcional</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Observaciones sobre esta relación…"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            size="sm"
            loading={mutation.isPending}
            disabled={!relatedId || locations.length === 0}
          >
            Agregar relación
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── LocationRelacionesTab ─────────────────────────────────────────────────────

interface Props {
  locationId: string;
  /** Ranch of the source location (used to filter relation candidates). */
  ranchId?: string;
}

export function LocationRelacionesTab({ locationId, ranchId }: Props) {
  const navigate   = useNavigate();
  const toast      = useToast();
  const { user }   = useAuth();
  const queryClient = useQueryClient();
  const canManage  = canUser(user?.role, 'MANAGE_LOCATION');

  const [addOpen, setAddOpen]         = useState(false);
  const [removingId, setRemovingId]   = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['location-relations', locationId],
    queryFn: () => locationsApi.getAllRelations(locationId),
    enabled: !!locationId,
    staleTime: 1000 * 60 * 2,
  });

  const group: LocationRelationGroup = data ?? {
    parents: [], children: [], adjacent: [], connected: [], other: [],
  };

  const totalRelations =
    group.parents.length + group.children.length +
    group.adjacent.length + group.connected.length + (group.other?.length ?? 0);

  const removeMutation = useMutation({
    mutationFn: (relationId: string) => locationsApi.removeRelation(relationId),
    onSuccess: () => {
      toast.success('Relación eliminada');
      queryClient.invalidateQueries({ queryKey: ['location-relations', locationId] });
      setRemovingId(null);
    },
    onError: (err: any) => {
      toast.error('Error', getFriendlyMessage(err));
      setRemovingId(null);
    },
  });

  const handleRemove = (id: string) => setRemovingId(id);
  const confirmRemove = () => {
    if (removingId) removeMutation.mutate(removingId);
  };

  return (
    <>
      <Card className="overflow-hidden p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/40">
              <Network className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <CardTitle>Relaciones</CardTitle>
              {totalRelations > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {totalRelations} relación{totalRelations !== 1 ? 'es' : ''} registrada{totalRelations !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
          {canManage && (
            <Button
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setAddOpen(true)}
            >
              Agregar
            </Button>
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          {isLoading ? (
            <div className="flex justify-center py-16"><Spinner size="md" /></div>
          ) : totalRelations === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Network className="w-7 h-7 text-gray-300 dark:text-gray-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Sin relaciones registradas
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {canManage
                    ? 'Agrega relaciones con potreros adyacentes, rutas o ubicaciones padre/hijo.'
                    : 'Esta ubicación no tiene relaciones con otras ubicaciones.'}
                </p>
              </div>
              {canManage && (
                <Button
                  size="sm"
                  variant="outline"
                  icon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => setAddOpen(true)}
                >
                  Primera relación
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <RelationGroup
                title="Ubicaciones padre"
                icon={ArrowUpToLine}
                relations={group.parents}
                canManage={canManage}
                onRemove={handleRemove}
                onNavigate={(id) => navigate(`/locations/${id}`)}
              />
              <RelationGroup
                title="Ubicaciones hijo"
                icon={ArrowDownToLine}
                relations={group.children}
                canManage={canManage}
                onRemove={handleRemove}
                onNavigate={(id) => navigate(`/locations/${id}`)}
              />
              <RelationGroup
                title="Adyacentes"
                icon={Shuffle}
                relations={group.adjacent}
                canManage={canManage}
                onRemove={handleRemove}
                onNavigate={(id) => navigate(`/locations/${id}`)}
              />
              <RelationGroup
                title="Conectadas"
                icon={Network}
                relations={group.connected}
                canManage={canManage}
                onRemove={handleRemove}
                onNavigate={(id) => navigate(`/locations/${id}`)}
              />
              {group.other && group.other.length > 0 && (
                <RelationGroup
                  title="Otras relaciones"
                  icon={GitBranch}
                  relations={group.other}
                  canManage={canManage}
                  onRemove={handleRemove}
                  onNavigate={(id) => navigate(`/locations/${id}`)}
                />
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Add modal */}
      <AddRelationModal
        locationId={locationId}
        ranchId={ranchId}
        open={addOpen}
        onClose={() => setAddOpen(false)}
      />

      {/* Confirm remove modal */}
      <Modal
        open={!!removingId}
        onClose={() => setRemovingId(null)}
        title="Eliminar relación"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            ¿Estás seguro de que deseas eliminar esta relación? Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setRemovingId(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={removeMutation.isPending}
              onClick={confirmRemove}
            >
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
