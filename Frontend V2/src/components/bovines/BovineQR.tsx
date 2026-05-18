/**
 * BovineQR — Single, reusable QR renderer for the bovines module.
 *
 * Renders a real, scannable QR code using `qrcode.react` (SVG by default —
 * crisp at any size and printable). Used by:
 *   • BovineDetailPage modal (large display + regenerate action)
 *   • BovinesListPage bulk-print sheet (small cards, multiple per page)
 *   • Anywhere else a bovine QR needs to appear (e.g. shipping labels)
 *
 * The `value` passed to the QR is the raw `qrCode` string stored on the
 * backend — we never compose or derive it client-side.
 */

import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { cn } from '@/utils/cn';

interface BovineQRProps {
  /** The raw qrCode string from the backend (BovineDetailResponse.qrCode). */
  value: string | null | undefined;
  /** Pixel size of the QR (default 192). */
  size?: number;
  /** Show the earTag underneath as plain text (default true). */
  earTag?: string;
  /** Show the qrCode string in monospace below (default false). Useful for debugging. */
  showRawCode?: boolean;
  /**
   * Use canvas instead of SVG. Required when the QR will be exported to a
   * raster format (image download). For on-screen + print use, SVG is sharper.
   */
  variant?: 'svg' | 'canvas';
  /** Error-correction level. 'M' (default) is fine for ear tag codes. */
  level?: 'L' | 'M' | 'Q' | 'H';
  className?: string;
}

export function BovineQR({
  value,
  size = 192,
  earTag,
  showRawCode = false,
  variant = 'svg',
  level = 'M',
  className,
}: BovineQRProps) {
  // No code stored on the bovine → empty placeholder so callers don't have
  // to special-case "missing" inline.
  if (!value) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-400 text-xs',
          className,
        )}
        style={{ width: size, height: size }}
      >
        <span>Sin QR generado</span>
      </div>
    );
  }

  const QR = variant === 'canvas' ? QRCodeCanvas : QRCodeSVG;

  return (
    <div className={cn('inline-flex flex-col items-center gap-2', className)}>
      {/* White padding around the QR ensures contrast for scanners — Tailwind p-2 = 8px */}
      <div
        className="bg-white rounded-xl p-2 shadow-sm border border-gray-200 dark:border-gray-700"
        style={{ width: size + 16, height: size + 16 }}
      >
        <QR
          value={value}
          size={size}
          level={level}
          bgColor="#ffffff"
          fgColor="#000000"
          // Quiet zone is handled by our padding wrapper above. The library
          // also adds its own; passing `includeMargin={false}` keeps it tight.
          includeMargin={false}
        />
      </div>
      {earTag && (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Arete: <strong className="text-gray-900 dark:text-white">{earTag}</strong>
        </p>
      )}
      {showRawCode && (
        <p className="font-mono text-[10px] text-gray-400 break-all max-w-[220px] text-center">
          {value}
        </p>
      )}
    </div>
  );
}
