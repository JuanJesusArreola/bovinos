/**
 * Reusable media gallery for Ranch, Location, and Bovine entities.
 *
 * Each backend exposes media slightly differently:
 *
 * - Ranch (RICH):    GET /ranch/:id/media → `RanchMedia[]` with full metadata
 *                    (title, category, description, tags, etc.).
 *
 * - Location (FLAT): GET /locations/:id/media → grouped URLs by kind.
 *                    Upload by `mediaType: 'images'|'documents'|'videos'|'maps'`,
 *                    delete by storagePath.
 *
 * - Bovine (TYPED):  GET /bovines/:id/media → `BovineMediaListResponse` with
 *                    structured items per kind (`'images'|'documents'|'videos'`)
 *                    including filename, mimeType, size, thumbnailUrl, caption.
 *
 * `MediaGallery` exposes a single API (`entityType`, `entityId`) and adapts
 * each backend internally to a normalized `MediaItem` shape. UI features that
 * only make sense for one entity (Ranch's category filter / tags) are hidden
 * for the others automatically.
 */

import { useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { ranchApi } from '@/api/ranch.api';
import { locationsApi, storagePathFromUrl } from '@/api/locations.api';
import { bovinesApi } from '@/api/bovines.api';
import { diseasesApi } from '@/api/diseases.api';
import type { LocationMediaKind } from '@/api/locations.api';
import type { RanchMedia } from '@/types';
import { MediaType, MediaCategory } from '@/types/ranch.types';
import type { BovineMediaType } from '@/types/bovine.dtos';
import type { DiseaseMediaResponse } from '@/types/disease.dtos';
import {
  Image as ImageIcon, FileText, Upload, X, Download, Trash2, Tag,
  Video, Map as MapIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ─── Public props ────────────────────────────────────────────────────────────

export interface MediaGalleryProps {
  entityType: 'ranch' | 'location' | 'bovine' | 'disease';
  entityId: string;
  className?: string;
}

// ─── Normalized MediaItem (internal) ─────────────────────────────────────────

interface MediaItem {
  /** Stable identifier — `media.id` for ranch, `${kind}:${url}` for location. */
  id: string;
  url: string;
  thumbnailUrl?: string;
  title: string;
  description?: string;
  /** MIME type (best-effort for location which only knows kind). */
  mimeType: string;
  filesize?: number;
  uploadDate?: string;
  /** Ranch only — category enum value. */
  category?: string;
  /** Ranch only — array of tags. */
  tags?: string[];
  /** Image dimensions (Ranch only, when known). */
  width?: number;
  height?: number;
  /** Backend-specific kind for Location (images/documents/videos/maps). */
  locationKind?: LocationMediaKind;
  /** Backend-specific kind for Bovine (images/documents/videos). */
  bovineKind?: BovineMediaType;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function isImageMime(mime: string): boolean {
  return mime.startsWith('image/');
}

function formatFileSize(bytes?: number): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d?: string): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fileNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    return decodeURIComponent(parts[parts.length - 1] ?? url);
  } catch {
    return url.split('/').filter(Boolean).pop() ?? url;
  }
}

function inferMimeFromKind(kind: LocationMediaKind, url: string): string {
  if (kind === 'images') return 'image/*';
  if (kind === 'videos') return 'video/*';
  if (kind === 'maps')   return /\.pdf$/i.test(url) ? 'application/pdf' : 'image/*';
  // documents
  if (/\.pdf$/i.test(url))     return 'application/pdf';
  if (/\.docx?$/i.test(url))   return 'application/msword';
  if (/\.xlsx?$/i.test(url))   return 'application/vnd.ms-excel';
  return 'application/octet-stream';
}

// ─── Mode config (drives which features are visible) ─────────────────────────

const MEDIA_CATEGORY_OPTIONS = [
  { value: MediaCategory.FACILITY_PHOTO,    label: 'Foto de Instalación' },
  { value: MediaCategory.AERIAL_PHOTO,      label: 'Foto Aérea' },
  { value: MediaCategory.SATELLITE_IMAGE,   label: 'Imagen Satelital' },
  { value: MediaCategory.LIVESTOCK_PHOTO,   label: 'Foto de Ganado' },
  { value: MediaCategory.PROPERTY_MAP,      label: 'Mapa de Propiedad' },
  { value: MediaCategory.LOGO,              label: 'Logo' },
  { value: MediaCategory.CERTIFICATE,       label: 'Certificado' },
  { value: MediaCategory.LICENSE,           label: 'Licencia' },
  { value: MediaCategory.CONTRACT,          label: 'Contrato' },
  { value: MediaCategory.REPORT,            label: 'Reporte' },
  { value: MediaCategory.PLAN,              label: 'Plano' },
  { value: MediaCategory.LEGAL_DOCUMENT,    label: 'Documento Legal' },
  { value: MediaCategory.FINANCIAL_DOCUMENT,label: 'Documento Financiero' },
  { value: MediaCategory.OTHER,             label: 'Otro' },
];
const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  MEDIA_CATEGORY_OPTIONS.map((o) => [o.value, o.label]),
);

const LOCATION_KIND_OPTIONS: { value: LocationMediaKind; label: string; accept: string; Icon: LucideIcon }[] = [
  { value: 'images',    label: 'Fotos',      accept: 'image/*', Icon: ImageIcon },
  { value: 'documents', label: 'Documentos', accept: '.pdf,.doc,.docx,.xls,.xlsx,.txt', Icon: FileText },
  { value: 'videos',    label: 'Videos',     accept: 'video/*', Icon: Video },
  { value: 'maps',      label: 'Mapas',      accept: 'image/*,application/pdf', Icon: MapIcon },
];

const BOVINE_KIND_OPTIONS: { value: BovineMediaType; label: string; accept: string; Icon: LucideIcon }[] = [
  { value: 'images',    label: 'Fotos',      accept: 'image/*', Icon: ImageIcon },
  { value: 'documents', label: 'Documentos', accept: '.pdf,.doc,.docx,.xls,.xlsx,.txt', Icon: FileText },
  { value: 'videos',    label: 'Videos',     accept: 'video/*', Icon: Video },
];

// ─── Component ──────────────────────────────────────────────────────────────

export function MediaGallery({ entityType, entityId, className }: MediaGalleryProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mode flags — feature toggles based on entityType
  const isRanch    = entityType === 'ranch';
  const isLocation = entityType === 'location';
  const isBovine   = entityType === 'bovine';
  const isDisease  = entityType === 'disease';

  // ── State ──────────────────────────────────────────────────────────────
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<MediaItem | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  // Ranch-only upload metadata
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState<string>(MediaCategory.FACILITY_PHOTO);
  const [uploadDescription, setUploadDescription] = useState('');
  // Location-only upload kind
  const [uploadKind, setUploadKind] = useState<LocationMediaKind>('images');
  // Bovine-only upload kind (3 values, no 'maps')
  const [uploadBovineKind, setUploadBovineKind] = useState<BovineMediaType>('images');
  // Filter (Ranch: category; Location/Bovine: kind)
  const [filterCategory, setFilterCategory] = useState('');
  const [filterKind, setFilterKind] = useState<LocationMediaKind | ''>('');
  const [filterBovineKind, setFilterBovineKind] = useState<BovineMediaType | ''>('');

  // ── Queries ────────────────────────────────────────────────────────────

  const ranchQuery = useQuery({
    queryKey: ['ranch-media', entityId, filterCategory],
    queryFn: () => ranchApi.listMedia(entityId, {
      limit: 100,
      ...(filterCategory ? { category: filterCategory } : {}),
    }).then((r) => r.data),
    enabled: isRanch && !!entityId,
  });

  const locationQuery = useQuery({
    queryKey: ['location-media', entityId],
    queryFn: () => locationsApi.getMedia(entityId).then((r) => r.data.data),
    enabled: isLocation && !!entityId,
  });

  const bovineQuery = useQuery({
    queryKey: ['bovine-media', entityId],
    queryFn: () => bovinesApi.getMedia(entityId).then((r) => r.data.data),
    enabled: isBovine && !!entityId,
  });

  // Disease — backend flat: `DiseaseMediaResponse[]` directo, sin agrupación
  // por kind. La distinción "imagen vs documento" la hacemos por mimeType.
  const diseaseQuery = useQuery({
    queryKey: ['diseases', 'media', entityId],
    queryFn: () => diseasesApi.listMedia(entityId).then((r) => r.data.data),
    enabled: isDisease && !!entityId,
  });

  // ── Adapt to MediaItem[] ───────────────────────────────────────────────
  const items: MediaItem[] = useMemo(() => {
    if (isRanch) {
      const raw = ranchQuery.data?.data;
      if (!Array.isArray(raw)) return [];
      return (raw as RanchMedia[]).map((m): MediaItem => ({
        id:           m.id,
        url:          m.url,
        thumbnailUrl: m.thumbnailUrl,
        title:        m.title,
        description:  m.description,
        mimeType:     m.mimeType,
        filesize:     m.filesize,
        uploadDate:   m.uploadDate,
        category:     m.category,
        tags:         m.tags,
        width:        m.width,
        height:       m.height,
      }));
    }
    if (isLocation) {
      const data = locationQuery.data;
      if (!data) return [];
      const all: MediaItem[] = [];
      (['images', 'documents', 'videos', 'maps'] as LocationMediaKind[]).forEach((kind) => {
        if (filterKind && filterKind !== kind) return;
        (data[kind] ?? []).forEach((url) => {
          all.push({
            id: `${kind}:${url}`,
            url,
            title: fileNameFromUrl(url),
            mimeType: inferMimeFromKind(kind, url),
            locationKind: kind,
          });
        });
      });
      return all;
    }
    if (isBovine) {
      // Bovine — backend returns BovineMediaListResponse with structured items.
      const data = bovineQuery.data;
      if (!data) return [];
      const all: MediaItem[] = [];
      (['images', 'documents', 'videos'] as BovineMediaType[]).forEach((kind) => {
        if (filterBovineKind && filterBovineKind !== kind) return;
        (data[kind] ?? []).forEach((m) => {
          all.push({
            id:           m.id,
            url:          m.url,
            thumbnailUrl: m.thumbnailUrl ?? undefined,
            title:        m.filename || fileNameFromUrl(m.url),
            mimeType:     m.mimeType,
            filesize:     m.size,
            uploadDate:   m.uploadedAt,
            description:  m.caption ?? undefined,
            bovineKind:   kind,
          });
        });
      });
      return all;
    }
    // Disease — flat array `DiseaseMediaResponse[]`. NO se filtra por kind
    // (el catálogo no expone categorías), pero el grupo image/document
    // sigue funcionando por `isImageMime(mimeType)` en el render.
    const data = diseaseQuery.data;
    if (!Array.isArray(data)) return [];
    return (data as DiseaseMediaResponse[]).map((m): MediaItem => ({
      id:           m.id,
      url:          m.url,
      thumbnailUrl: m.thumbnailUrl ?? undefined,
      title:        m.title || m.filename || fileNameFromUrl(m.url),
      description:  m.caption ?? undefined,
      mimeType:     m.mimeType,
      filesize:     m.size ?? undefined,
      uploadDate:   m.uploadedAt,
    }));
  }, [
    isRanch, isLocation, isBovine,
    ranchQuery.data, locationQuery.data, bovineQuery.data, diseaseQuery.data,
    filterKind, filterBovineKind,
  ]);

  const isLoading = isRanch
    ? ranchQuery.isLoading
    : isLocation
      ? locationQuery.isLoading
      : isBovine
        ? bovineQuery.isLoading
        : diseaseQuery.isLoading;

  const images    = useMemo(() => items.filter((m) => isImageMime(m.mimeType)), [items]);
  const documents = useMemo(() => items.filter((m) => !isImageMime(m.mimeType)), [items]);

  // ── Upload mutation ────────────────────────────────────────────────────
  // Return type is `unknown` because the two backends return different shapes;
  // the component never reads the response (just invalidates).
  const uploadMutation = useMutation<unknown, unknown, void>({
    mutationFn: async (): Promise<unknown> => {
      if (!uploadFile) throw new Error('No file selected');
      if (isRanch) {
        const mediaType = isImageMime(uploadFile.type) ? MediaType.IMAGE : MediaType.DOCUMENT;
        return ranchApi.uploadMedia(entityId, uploadFile, {
          title:       uploadTitle || uploadFile.name,
          type:        mediaType,
          category:    uploadCategory,
          description: uploadDescription || undefined,
        });
      }
      if (isLocation) {
        return locationsApi.uploadMedia(entityId, uploadFile, uploadKind);
      }
      if (isBovine) {
        // Bovine — caption is optional (free-text alongside the file).
        return bovinesApi.uploadMedia(
          entityId,
          uploadFile,
          uploadBovineKind,
          uploadDescription || undefined,
        );
      }
      // Disease — title (free-text) + caption opcionales. Si el usuario no
      // pasó título, usamos el nombre del archivo sin extensión.
      return diseasesApi.uploadMedia(entityId, uploadFile, {
        title:   uploadTitle || uploadFile.name.replace(/\.[^/.]+$/, ''),
        caption: uploadDescription || undefined,
      });
    },
    onSuccess: () => {
      const key = isRanch
        ? ['ranch-media', entityId]
        : isLocation
          ? ['location-media', entityId]
          : isBovine
            ? ['bovine-media', entityId]
            : ['diseases', 'media', entityId];
      queryClient.invalidateQueries({ queryKey: key });
      // Bovine: also refresh the /full bundle (its `media` field changed).
      if (isBovine) {
        queryClient.invalidateQueries({ queryKey: ['bovines', 'full', entityId] });
      }
      // Disease: refresh detail (eager-loaded `media[]` cambió) y by-slug.
      if (isDisease) {
        queryClient.invalidateQueries({ queryKey: ['diseases', 'detail', entityId] });
        queryClient.invalidateQueries({ queryKey: ['diseases', 'by-slug'] });
      }
      resetUploadForm();
    },
  });

  // ── Delete mutation ────────────────────────────────────────────────────
  const deleteMutation = useMutation<unknown, unknown, MediaItem>({
    mutationFn: async (item: MediaItem): Promise<unknown> => {
      if (isRanch) {
        return ranchApi.deleteMedia(item.id);
      }
      if (isLocation) {
        const path = storagePathFromUrl(item.url);
        return locationsApi.deleteMedia(entityId, path, item.locationKind);
      }
      if (isBovine) {
        // Bovine — backend uses storagePath wildcard, same convention as Location.
        const path = storagePathFromUrl(item.url);
        return bovinesApi.deleteMedia(entityId, path, item.bovineKind);
      }
      // Disease — delete por ID de la entrada de media (no por storagePath).
      return diseasesApi.deleteMedia(entityId, item.id);
    },
    onSuccess: () => {
      const key = isRanch
        ? ['ranch-media', entityId]
        : isLocation
          ? ['location-media', entityId]
          : isBovine
            ? ['bovine-media', entityId]
            : ['diseases', 'media', entityId];
      queryClient.invalidateQueries({ queryKey: key });
      if (isBovine) {
        queryClient.invalidateQueries({ queryKey: ['bovines', 'full', entityId] });
      }
      if (isDisease) {
        queryClient.invalidateQueries({ queryKey: ['diseases', 'detail', entityId] });
        queryClient.invalidateQueries({ queryKey: ['diseases', 'by-slug'] });
      }
      if (previewItem && deleteConfirm && previewItem.id === deleteConfirm.id) {
        setPreviewItem(null);
      }
      setDeleteConfirm(null);
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────
  function resetUploadForm() {
    setShowUploadForm(false);
    setUploadFile(null);
    setUploadTitle('');
    setUploadCategory(MediaCategory.FACILITY_PHOTO);
    setUploadDescription('');
    setUploadKind('images');
    setUploadBovineKind('images');
    uploadMutation.reset();
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      if (isRanch && !uploadTitle) {
        setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className={className ?? 'space-y-4 max-h-[65vh] overflow-y-auto pr-1'}>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isRanch ? (
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
            >
              <option value="">Todas las categorías</option>
              {MEDIA_CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : isLocation ? (
            <select
              value={filterKind}
              onChange={(e) => setFilterKind(e.target.value as LocationMediaKind | '')}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
            >
              <option value="">Todos los tipos</option>
              {LOCATION_KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : isBovine ? (
            <select
              value={filterBovineKind}
              onChange={(e) => setFilterBovineKind(e.target.value as BovineMediaType | '')}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
            >
              <option value="">Todos los tipos</option>
              {BOVINE_KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : null /* disease: sin filtros por kind, todo va flat */}
          <span className="text-sm text-gray-500">
            {items.length} archivo{items.length !== 1 ? 's' : ''}
          </span>
        </div>
        <Button size="sm" icon={<Upload className="w-4 h-4" />} onClick={() => setShowUploadForm(true)}>
          Subir Archivo
        </Button>
      </div>

      {/* Upload form */}
      {showUploadForm && (
        <Card className="!p-4 border-2 border-primary-200 dark:border-primary-800">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Subir nuevo archivo</h4>
          <div className="space-y-3">
            {/* File picker */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              {uploadFile ? (
                <div className="flex items-center gap-2">
                  {isImageMime(uploadFile.type)
                    ? <ImageIcon className="w-5 h-5 text-blue-500" />
                    : <FileText className="w-5 h-5 text-gray-400" />}
                  <span className="text-sm text-gray-900 dark:text-white">{uploadFile.name}</span>
                  <span className="text-xs text-gray-500">({formatFileSize(uploadFile.size)})</span>
                </div>
              ) : (
                <>
                  <Upload className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-500">Haz clic para seleccionar un archivo</span>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={isRanch
                  ? 'image/*,.pdf,.doc,.docx,.csv,.xlsx'
                  : isLocation
                    ? LOCATION_KIND_OPTIONS.find((o) => o.value === uploadKind)?.accept ?? 'image/*'
                    : isBovine
                      ? BOVINE_KIND_OPTIONS.find((o) => o.value === uploadBovineKind)?.accept ?? 'image/*'
                      : 'image/*,video/*' /* disease: imagen o video */}
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {isRanch ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Título *</label>
                    <input
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      placeholder="Nombre del archivo"
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Categoría *</label>
                    <select
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                    >
                      {MEDIA_CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Descripción</label>
                  <input
                    value={uploadDescription}
                    onChange={(e) => setUploadDescription(e.target.value)}
                    placeholder="Descripción opcional…"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                  />
                </div>
              </>
            ) : isLocation ? (
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo de archivo *</label>
                <select
                  value={uploadKind}
                  onChange={(e) => setUploadKind(e.target.value as LocationMediaKind)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                >
                  {LOCATION_KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            ) : isBovine ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo de archivo *</label>
                  <select
                    value={uploadBovineKind}
                    onChange={(e) => setUploadBovineKind(e.target.value as BovineMediaType)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                  >
                    {BOVINE_KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Descripción <span className="text-gray-400 font-normal">(opcional)</span></label>
                  <input
                    value={uploadDescription}
                    onChange={(e) => setUploadDescription(e.target.value)}
                    placeholder="Ej: Foto frontal, certificado de vacunación…"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                  />
                </div>
              </div>
            ) : (
              /* Disease — title + caption opcionales. NO hay kind/category. */
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Título <span className="text-gray-400 font-normal">(opcional)</span></label>
                  <input
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="Ej: Lesión cutánea típica"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Descripción <span className="text-gray-400 font-normal">(opcional)</span></label>
                  <input
                    value={uploadDescription}
                    onChange={(e) => setUploadDescription(e.target.value)}
                    placeholder="Notas sobre la imagen / video"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {uploadMutation.error ? (
              <Alert variant="error">
                {((uploadMutation.error as any)?.response?.data?.error?.message as string)
                  || ((uploadMutation.error as any)?.message as string)
                  || 'Error al subir archivo'}
              </Alert>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" type="button" onClick={resetUploadForm}>Cancelar</Button>
              <Button
                size="sm"
                icon={<Upload className="w-4 h-4" />}
                loading={uploadMutation.isPending}
                disabled={!uploadFile || (isRanch && !uploadTitle)}
                onClick={() => uploadMutation.mutate()}
              >
                Subir
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Loading */}
      {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}

      {/* Empty */}
      {!isLoading && items.length === 0 && (
        <div className="text-center py-12">
          <ImageIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No hay archivos multimedia</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Sube fotos, documentos y más para {isRanch ? 'este rancho' : isLocation ? 'esta ubicación' : isBovine ? 'este bovino' : 'esta enfermedad'}
          </p>
        </div>
      )}

      {/* Images grid */}
      {images.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-primary-600" /> Imágenes ({images.length})
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {images.map((item) => (
              <div
                key={item.id}
                className="group relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 cursor-pointer aspect-square"
                onClick={() => setPreviewItem(item)}
              >
                <img
                  src={item.thumbnailUrl || item.url}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 left-0 right-0 p-2">
                    <p className="text-xs text-white font-medium truncate">{item.title}</p>
                    {isRanch && item.category && (
                      <p className="text-xs text-gray-300">{CATEGORY_LABELS[item.category] || item.category}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteConfirm(item); }}
                  className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documents list */}
      {documents.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary-600" /> Documentos ({documents.length})
          </h4>
          <div className="space-y-2">
            {documents.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
              >
                <FileText className="w-5 h-5 text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.title}</p>
                  <p className="text-xs text-gray-500">
                    {isRanch && item.category && <>{CATEGORY_LABELS[item.category] || item.category} · </>}
                    {item.filesize != null && <>{formatFileSize(item.filesize)} · </>}
                    {item.uploadDate && formatDate(item.uploadDate)}
                  </p>
                  {item.description && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{item.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {isRanch && item.tags && item.tags.length > 0 && (
                    <span className="hidden sm:flex items-center gap-1 text-xs text-gray-400">
                      <Tag className="w-3 h-3" /> {item.tags.length}
                    </span>
                  )}
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
                    title="Descargar"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => setDeleteConfirm(item)}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Image preview modal */}
      {previewItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setPreviewItem(null)}>
          <div className="fixed inset-0 bg-black/80" />
          <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreviewItem(null)} className="absolute -top-10 right-0 p-2 text-white/80 hover:text-white">
              <X className="w-6 h-6" />
            </button>
            {isImageMime(previewItem.mimeType) ? (
              <img src={previewItem.url} alt={previewItem.title} className="w-full h-auto max-h-[80vh] object-contain rounded-lg" />
            ) : (
              <div className="bg-white dark:bg-gray-900 p-8 rounded-lg text-center">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-700 dark:text-gray-300">Vista previa no disponible para este tipo de archivo.</p>
                <a href={previewItem.url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline text-sm mt-2 inline-block">
                  Abrir en una nueva pestaña →
                </a>
              </div>
            )}
            <div className="mt-3 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-white font-medium truncate">{previewItem.title}</p>
                <p className="text-sm text-gray-400">
                  {isRanch && previewItem.category && <>{CATEGORY_LABELS[previewItem.category] || previewItem.category} · </>}
                  {previewItem.width && previewItem.height && `${previewItem.width}x${previewItem.height} · `}
                  {previewItem.filesize != null && `${formatFileSize(previewItem.filesize)} · `}
                  {previewItem.uploadDate && formatDate(previewItem.uploadDate)}
                </p>
                {previewItem.description && <p className="text-sm text-gray-500 mt-1 truncate">{previewItem.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewItem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  <Download className="w-5 h-5" />
                </a>
                <button
                  onClick={() => setDeleteConfirm(previewItem)}
                  className="p-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="fixed inset-0 bg-black/50" />
          <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Eliminar Archivo</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              ¿Eliminar <strong>{deleteConfirm.title}</strong>? Esta acción no se puede deshacer.
            </p>
            {deleteMutation.error ? (
              <Alert variant="error" className="mt-3">Error al eliminar archivo</Alert>
            ) : null}
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
              <Button
                variant="danger"
                size="sm"
                loading={deleteMutation.isPending}
                onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
              >
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
