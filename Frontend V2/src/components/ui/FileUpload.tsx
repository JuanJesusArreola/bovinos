import { useState, useRef, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import apiClient from '@/api/client';
import type { ApiResponse } from '@/types';
import { Button } from './Button';
import { Badge } from './Badge';
import { cn } from '@/utils/cn';
import { Upload, X, FileText, Image, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export type FileCategory =
  | 'cattle_photos'
  | 'veterinary_docs'
  | 'vaccination_records'
  | 'health_reports'
  | 'breeding_docs'
  | 'production_data'
  | 'feed_reports'
  | 'financial_docs'
  | 'general_docs'
  | 'system_backups';

interface UploadResult {
  url: string;
  storagePath: string;
  metadata?: Record<string, unknown>;
}

interface FileUploadProps {
  category: FileCategory;
  onUploadComplete?: (result: UploadResult) => void;
  onError?: (error: string) => void;
  maxFiles?: number;
  accept?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
}

// Category-specific constraints matching backend FILE_CONFIGS
const CATEGORY_CONFIG: Record<FileCategory, { maxSize: number; maxFiles: number; accept: string; label: string }> = {
  cattle_photos: { maxSize: 10 * 1024 * 1024, maxFiles: 10, accept: 'image/jpeg,image/png,image/webp,image/heic', label: 'Fotos de Ganado' },
  veterinary_docs: { maxSize: 25 * 1024 * 1024, maxFiles: 5, accept: 'application/pdf,image/jpeg,image/png,text/plain', label: 'Documentos Veterinarios' },
  vaccination_records: { maxSize: 15 * 1024 * 1024, maxFiles: 3, accept: 'application/pdf,text/csv,.xls,.xlsx', label: 'Registros de Vacunación' },
  health_reports: { maxSize: 20 * 1024 * 1024, maxFiles: 5, accept: 'application/pdf,.doc,.docx', label: 'Reportes de Salud' },
  breeding_docs: { maxSize: 15 * 1024 * 1024, maxFiles: 8, accept: 'application/pdf,text/csv,image/jpeg,image/png', label: 'Documentos de Reproducción' },
  production_data: { maxSize: 50 * 1024 * 1024, maxFiles: 1, accept: 'text/csv,.xls,.xlsx,application/json', label: 'Datos de Producción' },
  feed_reports: { maxSize: 10 * 1024 * 1024, maxFiles: 3, accept: 'application/pdf,text/csv,.xlsx', label: 'Reportes de Alimentación' },
  financial_docs: { maxSize: 30 * 1024 * 1024, maxFiles: 2, accept: 'application/pdf,.xlsx', label: 'Documentos Financieros' },
  general_docs: { maxSize: 20 * 1024 * 1024, maxFiles: 5, accept: 'application/pdf,image/jpeg,image/png,text/plain', label: 'Documentos Generales' },
  system_backups: { maxSize: 500 * 1024 * 1024, maxFiles: 1, accept: '.zip,.gz,.tar', label: 'Respaldos del Sistema' },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageType(type: string): boolean {
  return type.startsWith('image/');
}

interface UploadedFile {
  name: string;
  size: number;
  type: string;
  url?: string;
  storagePath?: string;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

export function FileUpload({
  category,
  onUploadComplete,
  onError,
  maxFiles,
  accept,
  label,
  className,
  disabled = false,
}: FileUploadProps) {
  const config = CATEGORY_CONFIG[category];
  const effectiveMaxFiles = maxFiles ?? config.maxFiles;
  const effectiveAccept = accept ?? config.accept;
  const effectiveLabel = label ?? config.label;

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category);
      const res = await apiClient.post<ApiResponse<UploadResult>>('/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.data;
    },
  });

  const validateFile = useCallback(
    (file: File): string | null => {
      if (file.size > config.maxSize) {
        return `Archivo demasiado grande. Máximo: ${formatFileSize(config.maxSize)}`;
      }
      const allowedTypes = effectiveAccept.split(',').map((t) => t.trim());
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      const typeMatch = allowedTypes.some(
        (allowed) => file.type === allowed || allowed === ext || (allowed.endsWith('/*') && file.type.startsWith(allowed.replace('/*', '/'))),
      );
      if (!typeMatch) {
        return `Tipo de archivo no permitido. Permitidos: ${allowedTypes.join(', ')}`;
      }
      return null;
    },
    [config.maxSize, effectiveAccept],
  );

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const newFiles = Array.from(fileList);
      const remaining = effectiveMaxFiles - files.filter((f) => f.status === 'success').length;

      if (newFiles.length > remaining) {
        onError?.(`Máximo ${effectiveMaxFiles} archivos. Puedes subir ${remaining} más.`);
        return;
      }

      for (const file of newFiles) {
        const validationError = validateFile(file);
        if (validationError) {
          setFiles((prev) => [...prev, { name: file.name, size: file.size, type: file.type, status: 'error', error: validationError }]);
          onError?.(validationError);
          continue;
        }

        const entry: UploadedFile = { name: file.name, size: file.size, type: file.type, status: 'uploading' };
        setFiles((prev) => [...prev, entry]);

        try {
          const result = await uploadMutation.mutateAsync(file);
          setFiles((prev) =>
            prev.map((f) =>
              f.name === file.name && f.status === 'uploading'
                ? { ...f, status: 'success', url: result.url, storagePath: result.storagePath }
                : f,
            ),
          );
          onUploadComplete?.(result);
        } catch {
          setFiles((prev) =>
            prev.map((f) =>
              f.name === file.name && f.status === 'uploading'
                ? { ...f, status: 'error', error: 'Error al subir archivo' }
                : f,
            ),
          );
          onError?.('Error al subir archivo');
        }
      }
    },
    [files, effectiveMaxFiles, validateFile, uploadMutation, onUploadComplete, onError],
  );

  const removeFile = useCallback(
    async (index: number) => {
      const file = files[index];
      if (file.storagePath) {
        try {
          await apiClient.delete('/uploads', { data: { storagePath: file.storagePath } });
        } catch {
          // File may already be deleted
        }
      }
      setFiles((prev) => prev.filter((_, i) => i !== index));
    },
    [files],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (!disabled && e.dataTransfer.files.length) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [disabled, handleFiles],
  );

  return (
    <div className={cn('space-y-3', className)}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {effectiveLabel}
      </label>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          'relative flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors',
          dragOver
            ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/10'
            : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-800/50',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <Upload className="w-8 h-8 text-gray-400" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium text-primary-600 dark:text-primary-400">Haz clic para seleccionar</span>
          {' '}o arrastra archivos aquí
        </p>
        <p className="text-xs text-gray-400">
          Máx. {formatFileSize(config.maxSize)} por archivo &middot; Hasta {effectiveMaxFiles} archivos
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={effectiveAccept}
          multiple={effectiveMaxFiles > 1}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
          disabled={disabled}
        />
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
            >
              {isImageType(file.type) ? (
                <Image className="w-5 h-5 text-blue-500 shrink-0" />
              ) : (
                <FileText className="w-5 h-5 text-gray-400 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{file.name}</p>
                <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                {file.error && <p className="text-xs text-red-500 mt-0.5">{file.error}</p>}
              </div>
              {file.status === 'uploading' && <Loader2 className="w-4 h-4 animate-spin text-primary-500" />}
              {file.status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
              {file.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
              <button
                onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
