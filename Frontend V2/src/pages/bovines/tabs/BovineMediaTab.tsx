import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bovinesApi, type BovinePhoto, type BovineDocument } from '@/api/bovines.api';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';
import { canUser } from '@/utils/permissions';
import { formatDate, formatRelative } from '@/utils/formatters';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FileUpload } from '@/components/ui/FileUpload';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';
import {
  Image, FileText, Upload, Trash2, Download, ZoomIn,
  X, Plus, Camera, AlertTriangle, File,
  ChevronLeft, ChevronRight, FolderOpen,
} from 'lucide-react';

// ─── Props ────────────────────────────────────────────────────────────────────

interface BovineMediaTabProps {
  bovineId: string;
  earTag: string;
}

// ─── Document category config ─────────────────────────────────────────────────

const DOC_CATEGORY_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; classes: string }> = {
  veterinary_docs:     { label: 'Veterinario',  icon: FileText, classes: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  vaccination_records: { label: 'Vacunación',   icon: FileText, classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  health_reports:      { label: 'Salud',        icon: FileText, classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  breeding_docs:       { label: 'Reproducción', icon: FileText, classes: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' },
  general_docs:        { label: 'General',      icon: File,     classes: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
};

function getDocConfig(category: string) {
  return DOC_CATEGORY_CONFIG[category] ?? DOC_CATEGORY_CONFIG['general_docs'];
}

function formatSize(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

interface LightboxProps {
  photos: BovinePhoto[];
  initialIndex: number;
  onClose: () => void;
}

function Lightbox({ photos, initialIndex, onClose }: LightboxProps) {
  const [idx, setIdx] = useState(initialIndex);
  const photo = photos[idx];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      {/* Close */}
      <button
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        onClick={onClose}
      >
        <X className="w-6 h-6" />
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-4 z-10 px-3 py-1 rounded-full bg-black/40 text-white text-sm">
        {idx + 1} / {photos.length}
      </div>

      {/* Prev */}
      {idx > 0 && (
        <button
          className="absolute left-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          onClick={(e) => { e.stopPropagation(); setIdx(idx - 1); }}
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Image */}
      <div
        className="max-w-[90vw] max-h-[85vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={photo.url}
          alt={photo.caption ?? `Foto ${idx + 1}`}
          className="max-w-full max-h-[78vh] object-contain rounded-lg shadow-2xl"
        />
        {(photo.caption || photo.takenAt) && (
          <div className="mt-3 text-center">
            {photo.caption && (
              <p className="text-white text-sm font-medium">{photo.caption}</p>
            )}
            {photo.takenAt && (
              <p className="text-white/60 text-xs mt-0.5">{formatDate(photo.takenAt)}</p>
            )}
          </div>
        )}
      </div>

      {/* Next */}
      {idx < photos.length - 1 && (
        <button
          className="absolute right-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          onClick={(e) => { e.stopPropagation(); setIdx(idx + 1); }}
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}

// ─── Photo card ───────────────────────────────────────────────────────────────

interface PhotoCardProps {
  photo: BovinePhoto;
  index: number;
  canDelete: boolean;
  onOpen: (index: number) => void;
  onDelete: (photo: BovinePhoto) => void;
}

function PhotoCard({ photo, index, canDelete, onOpen, onDelete }: PhotoCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="relative aspect-square rounded-xl overflow-hidden cursor-pointer group bg-gray-100 dark:bg-gray-800"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onOpen(index)}
    >
      <img
        src={photo.url}
        alt={photo.caption ?? `Foto ${index + 1}`}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
      />

      {/* Overlay */}
      <div className={cn(
        'absolute inset-0 bg-black/50 flex items-center justify-center gap-3 transition-opacity duration-200',
        hovered ? 'opacity-100' : 'opacity-0',
      )}>
        <button
          className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
          onClick={(e) => { e.stopPropagation(); onOpen(index); }}
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        {canDelete && (
          <button
            className="p-2 rounded-full bg-red-500/70 hover:bg-red-600/80 text-white transition-colors"
            onClick={(e) => { e.stopPropagation(); onDelete(photo); }}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Caption badge */}
      {photo.caption && (
        <div className="absolute bottom-0 inset-x-0 px-2 py-1.5 bg-gradient-to-t from-black/60 to-transparent">
          <p className="text-white text-xs truncate">{photo.caption}</p>
        </div>
      )}
    </div>
  );
}

// ─── Document row ─────────────────────────────────────────────────────────────

interface DocRowProps {
  doc: BovineDocument;
  canDelete: boolean;
  onDelete: (doc: BovineDocument) => void;
}

function DocRow({ doc, canDelete, onDelete }: DocRowProps) {
  const cfg = getDocConfig(doc.category);
  const Icon = cfg.icon;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', cfg.classes.split(' ').slice(0, 2).join(' '))}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{doc.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn('text-xs px-1.5 py-0.5 rounded-md font-medium', cfg.classes)}>
            {cfg.label}
          </span>
          <span className="text-xs text-gray-400">{formatSize(doc.size)}</span>
          {doc.createdAt && (
            <span className="text-xs text-gray-400">{formatRelative(doc.createdAt)}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <a
          href={doc.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-primary-500 transition-colors"
          title="Descargar"
        >
          <Download className="w-4 h-4" />
        </a>
        {canDelete && (
          <button
            onClick={() => onDelete(doc)}
            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
            title="Eliminar"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Upload Photo Modal ───────────────────────────────────────────────────────

interface UploadPhotoModalProps {
  open: boolean;
  onClose: () => void;
  bovineId: string;
  onSuccess: () => void;
}

function UploadPhotoModal({ open, onClose, bovineId, onSuccess }: UploadPhotoModalProps) {
  const [caption, setCaption] = useState('');
  const [takenAt, setTakenAt] = useState('');
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const toast = useToast();

  const attachMutation = useMutation({
    mutationFn: () =>
      bovinesApi.addPhoto(bovineId, {
        url: uploadedUrl!,
        storagePath: uploadedPath!,
        caption: caption || undefined,
        takenAt: takenAt || undefined,
      }),
    onSuccess: () => {
      onSuccess();
      onClose();
      setCaption('');
      setTakenAt('');
      setUploadedUrl(null);
      setUploadedPath(null);
    },
    onError: (err: any) => {
      toast.error('Error', err?.response?.data?.error?.message || 'No se pudo guardar la foto.');
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Subir Foto" size="sm">
      <div className="space-y-4">
        <FileUpload
          category="cattle_photos"
          label="Foto del animal *"
          maxFiles={1}
          onUploadComplete={(result) => {
            setUploadedUrl(result.url);
            setUploadedPath(result.storagePath);
          }}
          onError={(err) => toast.error('Error al subir', err)}
        />

        {uploadedUrl && (
          <div className="rounded-lg overflow-hidden border border-primary-200 dark:border-primary-700">
            <img src={uploadedUrl} alt="Preview" className="w-full h-36 object-cover" />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Descripción / Pie de foto <span className="font-normal">(opcional)</span>
          </label>
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Ej: Estado corporal — julio 2025"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Fecha de la foto <span className="font-normal">(opcional)</span>
          </label>
          <input
            type="date"
            value={takenAt}
            onChange={(e) => setTakenAt(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
          />
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            icon={<Upload className="w-4 h-4" />}
            disabled={!uploadedUrl}
            loading={attachMutation.isPending}
            onClick={() => attachMutation.mutate()}
          >
            Guardar Foto
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Upload Document Modal ────────────────────────────────────────────────────

interface UploadDocModalProps {
  open: boolean;
  onClose: () => void;
  bovineId: string;
  onSuccess: () => void;
}

type DocCategory = 'veterinary_docs' | 'vaccination_records' | 'health_reports' | 'breeding_docs' | 'general_docs';

function UploadDocModal({ open, onClose, bovineId, onSuccess }: UploadDocModalProps) {
  const [docCategory, setDocCategory] = useState<DocCategory>('veterinary_docs');
  const [uploadedResult, setUploadedResult] = useState<{ url: string; storagePath: string; name?: string; size?: number } | null>(null);
  const toast = useToast();

  const attachMutation = useMutation({
    mutationFn: () =>
      bovinesApi.addDocument(bovineId, {
        url: uploadedResult!.url,
        storagePath: uploadedResult!.storagePath,
        name: uploadedResult!.name ?? 'Documento',
        category: docCategory,
        size: uploadedResult!.size,
      }),
    onSuccess: () => {
      onSuccess();
      onClose();
      setUploadedResult(null);
      setDocCategory('veterinary_docs');
    },
    onError: (err: any) => {
      toast.error('Error', err?.response?.data?.error?.message || 'No se pudo guardar el documento.');
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Subir Documento" size="sm">
      <div className="space-y-4">
        {/* Category select */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Tipo de documento *
          </label>
          <select
            value={docCategory}
            onChange={(e) => setDocCategory(e.target.value as DocCategory)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
          >
            <option value="veterinary_docs">Documento veterinario</option>
            <option value="vaccination_records">Registro de vacunación</option>
            <option value="health_reports">Reporte de salud</option>
            <option value="breeding_docs">Documento reproductivo</option>
            <option value="general_docs">Documento general</option>
          </select>
        </div>

        <FileUpload
          category={docCategory}
          label="Archivo *"
          maxFiles={1}
          onUploadComplete={(result) => {
            setUploadedResult({
              url: result.url,
              storagePath: result.storagePath,
              name: (result.metadata?.originalName as string) ?? undefined,
              size: (result.metadata?.size as number) ?? undefined,
            });
          }}
          onError={(err) => toast.error('Error al subir', err)}
        />

        {uploadedResult && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-50 dark:bg-primary-900/10 border border-primary-200 dark:border-primary-700 text-sm text-primary-700 dark:text-primary-300">
            <FileText className="w-4 h-4 shrink-0" />
            <span className="truncate">{uploadedResult.name ?? 'Archivo subido'}</span>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            icon={<Upload className="w-4 h-4" />}
            disabled={!uploadedResult}
            loading={attachMutation.isPending}
            onClick={() => attachMutation.mutate()}
          >
            Guardar Documento
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BovineMediaTab({ bovineId, earTag }: BovineMediaTabProps) {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [lightboxIndex, setLightboxIndex]       = useState<number | null>(null);
  const [showUploadPhoto, setShowUploadPhoto]   = useState(false);
  const [showUploadDoc, setShowUploadDoc]       = useState(false);
  const [confirmDeletePhoto, setConfirmDeletePhoto] = useState<BovinePhoto | null>(null);
  const [confirmDeleteDoc, setConfirmDeleteDoc]     = useState<BovineDocument | null>(null);

  const canManage = canUser(user?.role, 'MANAGE_BOVINE');

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: photos = [], isLoading: loadingPhotos } = useQuery({
    queryKey: ['bovine-photos', bovineId],
    queryFn: () => bovinesApi.getPhotos(bovineId).then((r) => r.data.data ?? []),
    enabled: !!bovineId,
  });

  const { data: documents = [], isLoading: loadingDocs } = useQuery({
    queryKey: ['bovine-documents', bovineId],
    queryFn: () => bovinesApi.getDocuments(bovineId).then((r) => r.data.data ?? []),
    enabled: !!bovineId,
  });

  // ── Delete mutations ───────────────────────────────────────────────────────
  const deletePhotoMutation = useMutation({
    mutationFn: (photo: BovinePhoto) => bovinesApi.removePhoto(bovineId, photo.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bovine-photos', bovineId] });
      toast.success('Foto eliminada', 'La foto fue eliminada correctamente.');
      setConfirmDeletePhoto(null);
    },
    onError: (err: any) => {
      toast.error('Error', err?.response?.data?.error?.message || 'No se pudo eliminar la foto.');
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: (doc: BovineDocument) => bovinesApi.removeDocument(bovineId, doc.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bovine-documents', bovineId] });
      toast.success('Documento eliminado', 'El documento fue eliminado.');
      setConfirmDeleteDoc(null);
    },
    onError: (err: any) => {
      toast.error('Error', err?.response?.data?.error?.message || 'No se pudo eliminar el documento.');
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['bovine-photos', bovineId] });
    queryClient.invalidateQueries({ queryKey: ['bovine-documents', bovineId] });
  };

  return (
    <div className="space-y-6">
      {/* ── Photos section ─────────────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-primary-500" />
            Fotos
            {photos.length > 0 && (
              <span className="text-xs font-normal text-gray-400 dark:text-gray-500 ml-1">
                ({photos.length})
              </span>
            )}
          </CardTitle>
          {canManage && (
            <Button
              size="sm"
              variant="outline"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setShowUploadPhoto(true)}
            >
              Subir foto
            </Button>
          )}
        </div>

        {loadingPhotos ? (
          <div className="flex justify-center py-10">
            <Spinner size="lg" />
          </div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
              <Camera className="w-7 h-7 text-gray-300 dark:text-gray-600" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Sin fotos</p>
            <p className="text-xs text-gray-400 mt-1">
              Las fotos del animal aparecerán aquí.
            </p>
            {canManage && (
              <Button
                size="sm"
                variant="outline"
                icon={<Upload className="w-4 h-4" />}
                className="mt-4"
                onClick={() => setShowUploadPhoto(true)}
              >
                Subir primera foto
              </Button>
            )}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map((photo, idx) => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                index={idx}
                canDelete={canManage}
                onOpen={(i) => setLightboxIndex(i)}
                onDelete={(p) => setConfirmDeletePhoto(p)}
              />
            ))}
            {/* Add tile */}
            {canManage && (
              <button
                onClick={() => setShowUploadPhoto(true)}
                className="aspect-square rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500 flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-primary-500 transition-colors"
              >
                <Plus className="w-6 h-6" />
                <span className="text-xs">Agregar</span>
              </button>
            )}
          </div>
        )}
      </Card>

      {/* ── Documents section ──────────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-primary-500" />
            Documentos
            {documents.length > 0 && (
              <span className="text-xs font-normal text-gray-400 dark:text-gray-500 ml-1">
                ({documents.length})
              </span>
            )}
          </CardTitle>
          {canManage && (
            <Button
              size="sm"
              variant="outline"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setShowUploadDoc(true)}
            >
              Subir documento
            </Button>
          )}
        </div>

        {loadingDocs ? (
          <div className="flex justify-center py-10">
            <Spinner size="lg" />
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
              <FileText className="w-7 h-7 text-gray-300 dark:text-gray-600" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Sin documentos</p>
            <p className="text-xs text-gray-400 mt-1">
              Registros veterinarios, vacunaciones y más.
            </p>
            {canManage && (
              <Button
                size="sm"
                variant="outline"
                icon={<Upload className="w-4 h-4" />}
                className="mt-4"
                onClick={() => setShowUploadDoc(true)}
              >
                Subir primer documento
              </Button>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {documents.map((doc) => (
              <DocRow
                key={doc.id}
                doc={doc}
                canDelete={canManage}
                onDelete={(d) => setConfirmDeleteDoc(d)}
              />
            ))}
          </div>
        )}
      </Card>

      {/* ── Lightbox ───────────────────────────────────────────────────────── */}
      {lightboxIndex !== null && photos.length > 0 && (
        <Lightbox
          photos={photos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {/* ── Upload modals ──────────────────────────────────────────────────── */}
      <UploadPhotoModal
        open={showUploadPhoto}
        onClose={() => setShowUploadPhoto(false)}
        bovineId={bovineId}
        onSuccess={invalidateAll}
      />

      <UploadDocModal
        open={showUploadDoc}
        onClose={() => setShowUploadDoc(false)}
        bovineId={bovineId}
        onSuccess={invalidateAll}
      />

      {/* ── Confirm delete photo ───────────────────────────────────────────── */}
      <Modal
        open={!!confirmDeletePhoto}
        onClose={() => setConfirmDeletePhoto(null)}
        title="Eliminar foto"
        size="sm"
      >
        <div className="space-y-4">
          {confirmDeletePhoto && (
            <img
              src={confirmDeletePhoto.url}
              alt="Foto a eliminar"
              className="w-full h-40 object-cover rounded-xl"
            />
          )}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-400">
              Esta acción no se puede deshacer. La foto será eliminada permanentemente.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setConfirmDeletePhoto(null)}>Cancelar</Button>
            <Button
              variant="danger"
              icon={<Trash2 className="w-4 h-4" />}
              loading={deletePhotoMutation.isPending}
              onClick={() => confirmDeletePhoto && deletePhotoMutation.mutate(confirmDeletePhoto)}
            >
              Eliminar foto
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Confirm delete document ────────────────────────────────────────── */}
      <Modal
        open={!!confirmDeleteDoc}
        onClose={() => setConfirmDeleteDoc(null)}
        title="Eliminar documento"
        size="sm"
      >
        <div className="space-y-4">
          {confirmDeleteDoc && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800">
              <FileText className="w-8 h-8 text-gray-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{confirmDeleteDoc.name}</p>
                <p className="text-xs text-gray-400">{formatSize(confirmDeleteDoc.size)}</p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-400">
              Esta acción no se puede deshacer. El documento será eliminado permanentemente.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setConfirmDeleteDoc(null)}>Cancelar</Button>
            <Button
              variant="danger"
              icon={<Trash2 className="w-4 h-4" />}
              loading={deleteDocMutation.isPending}
              onClick={() => confirmDeleteDoc && deleteDocMutation.mutate(confirmDeleteDoc)}
            >
              Eliminar documento
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
