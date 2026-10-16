import React from 'react';
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

/**
 * BoundingBoxOverlay
 * Renders responsive bounding boxes aligned with the source image coordinate space.
 * Color codes by status:
 * - Accepted: Emerald
 * - Uncertain: Amber
 * - Rejected: Rose
 */
export default function BoundingBoxOverlay({
  sourceDimensions = { width: 280, height: 280 },
  predictions = [],
  selectedDigitIndex = null,
  onSelectDigit = null,
  showLabels = true,
}) {
  if (!predictions || predictions.length === 0) return null;

  const { width = 280, height = 280 } = sourceDimensions;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
      {predictions.map((item, idx) => {
        const box = item.bounding_box;
        if (!box) return null;

        const leftPct = (box.x / width) * 100;
        const topPct = (box.y / height) * 100;
        const widthPct = (box.w / width) * 100;
        const heightPct = (box.h / height) * 100;

        const isSelected = selectedDigitIndex === idx;

        // Status-based theme
        let borderClass = 'border-emerald-400 bg-emerald-500/10 shadow-emerald-500/20';
        let badgeBg = 'bg-emerald-600 text-white';
        let StatusIcon = CheckCircle2;

        if (item.status === 'uncertain') {
          borderClass = 'border-amber-400 bg-amber-500/15 shadow-amber-500/20';
          badgeBg = 'bg-amber-600 text-white';
          StatusIcon = AlertCircle;
        } else if (item.status === 'rejected') {
          borderClass = 'border-rose-500 bg-rose-500/20 shadow-rose-500/20';
          badgeBg = 'bg-rose-600 text-white';
          StatusIcon = XCircle;
        }

        return (
          <div
            key={idx}
            onClick={() => onSelectDigit && onSelectDigit(idx)}
            className={`absolute border-2 rounded transition-all pointer-events-auto cursor-pointer group ${borderClass} ${
              isSelected ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-900 z-20 scale-[1.02]' : 'z-10'
            }`}
            style={{
              left: `${Math.max(0, leftPct)}%`,
              top: `${Math.max(0, topPct)}%`,
              width: `${Math.min(100 - leftPct, widthPct)}%`,
              height: `${Math.min(100 - topPct, heightPct)}%`,
            }}
            title={`Digit: ${item.predicted_digit} | Conf: ${(item.confidence * 100).toFixed(1)}% | Status: ${item.status}`}
          >
            {/* Corner Markers */}
            <div className="absolute -top-1 -left-1 w-2 h-2 bg-current rounded-full" />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-current rounded-full" />
            <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-current rounded-full" />
            <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-current rounded-full" />

            {/* Floating Predicted Digit + Confidence Tag */}
            {showLabels && (
              <div
                className={`absolute -top-6 left-0 flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shadow-md whitespace-nowrap transition-transform ${badgeBg}`}
              >
                <StatusIcon className="w-2.5 h-2.5" />
                <span>{item.status === 'rejected' ? '?' : item.predicted_digit}</span>
                <span className="text-[9px] opacity-85">({(item.confidence * 100).toFixed(0)}%)</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
