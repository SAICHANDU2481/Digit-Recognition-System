import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Clock, Eye, Sparkles, ChevronRight, Hash, Layers } from 'lucide-react';

export default function MultiDigitDisplay({
  prediction,
  selectedDigitIndex,
  onSelectDigit,
  onAskGemini,
  onExplainCrop,
  onOpenBackendConfig,
}) {
  const [showCrops, setShowCrops] = useState(true);

  if (!prediction) {
    return (
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 text-center text-slate-500">
        <Hash className="w-10 h-10 mx-auto text-slate-600 mb-2 stroke-1" />
        <h4 className="text-sm font-semibold text-slate-300">Multi-Digit Sequence Recognition</h4>
        <p className="text-xs text-slate-500 mt-1">
          Draw or capture multiple digits (e.g., "5072", "20261016") to see segmentation, bounding boxes, and per-digit confidence.
        </p>
      </div>
    );
  }

  const {
    success,
    status = 'accepted_prediction',
    recognized_text = '',
    detected_digit_count = 0,
    per_digit_predictions = [],
    duration_ms = 0,
    warnings = [],
    error,
  } = prediction;

  // Status Theme
  const statusTheme = {
    accepted_prediction: {
      bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
      badge: 'bg-emerald-500 text-white',
      label: 'Accepted Prediction',
      icon: CheckCircle2,
    },
    uncertain_prediction: {
      bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
      badge: 'bg-amber-500 text-white',
      label: 'Uncertain Prediction',
      icon: AlertTriangle,
    },
    blank_input: {
      bg: 'bg-slate-800 border-slate-700 text-slate-400',
      badge: 'bg-slate-700 text-slate-200',
      label: 'Blank Input',
      icon: AlertTriangle,
    },
    segmentation_failure: {
      bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
      badge: 'bg-rose-500 text-white',
      label: 'Segmentation Issue',
      icon: XCircle,
    },
    invalid_input: {
      bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
      badge: 'bg-rose-500 text-white',
      label: 'Invalid Input',
      icon: XCircle,
    },
  }[status] || {
    bg: 'bg-slate-800 border-slate-700 text-slate-400',
    badge: 'bg-slate-700 text-slate-200',
    label: status,
    icon: AlertTriangle,
  };

  const StatusIcon = statusTheme.icon;

  return (
    <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-5">
      {/* Sequence Header & Primary Result */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-xs uppercase font-mono tracking-wider text-slate-400">
              Recognized Sequence
            </span>
            <div className={`flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusTheme.bg}`}>
              <StatusIcon className="w-3 h-3" />
              <span>{statusTheme.label}</span>
            </div>
          </div>

          <div className="flex items-baseline space-x-3">
            <span className="text-4xl sm:text-5xl font-mono font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-200 to-brand-400">
              {recognized_text || (status === 'blank_input' ? '—' : 'None')}
            </span>
            <span className="text-xs font-mono text-slate-500">
              ({detected_digit_count} {detected_digit_count === 1 ? 'digit' : 'digits'})
            </span>
          </div>
        </div>

        {/* Latency & Controls */}
        <div className="flex flex-col sm:items-end space-y-2">
          <div className="flex items-center space-x-3 text-xs text-slate-400 font-mono">
            <div className="flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>{duration_ms.toFixed(1)} ms</span>
            </div>

            <button
              onClick={() => setShowCrops(!showCrops)}
              className={`flex items-center space-x-1 px-2 py-1 rounded-lg border text-[11px] transition-colors ${
                showCrops
                  ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>{showCrops ? 'Hide Crops' : 'Show 28×28'}</span>
            </button>
          </div>

          {onAskGemini && recognized_text && (
            <button
              onClick={() =>
                onAskGemini({
                  recognized_text,
                  detected_digit_count,
                  per_digit_predictions,
                  status,
                })
              }
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-medium shadow-md transition-all self-start sm:self-auto"
            >
              <Sparkles className="w-3 h-3 text-purple-200" />
              <span>Ask Tutor About Sequence</span>
            </button>
          )}
        </div>
      </div>

      {/* Warnings & Diagnostics Banner */}
      {warnings && warnings.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 space-y-1">
          <div className="font-semibold flex items-center space-x-1.5 text-amber-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Segmentation & Policy Diagnostics:</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-slate-300 pl-1 text-[11px]">
            {warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 space-y-2.5">
          <div className="flex items-start space-x-2.5">
            <XCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <span className="leading-snug">{error}</span>
          </div>
          {onOpenBackendConfig && (
            <div className="pt-2 border-t border-rose-500/20 flex flex-wrap items-center gap-2">
              <button
                onClick={onOpenBackendConfig}
                className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 font-mono text-[11px] transition-colors"
              >
                ⚙️ Configure Backend URL
              </button>
              <a
                href="https://render.com/deploy?repo=https://github.com/SAICHANDU2481/Digit-Recognition-System"
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/40 font-mono text-[11px] transition-colors"
              >
                🚀 Deploy Backend on Render
              </a>
            </div>
          )}
        </div>
      )}

      {/* Per-Digit Breakdown Cards */}
      {per_digit_predictions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Segmented Digits (Left-to-Right Order)</span>
            <span className="text-[11px] text-slate-500">Click a card to inspect</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {per_digit_predictions.map((digitItem, idx) => {
              const isSelected = selectedDigitIndex === idx;
              const isAccepted = digitItem.status === 'accepted';
              const isUncertain = digitItem.status === 'uncertain';

              const cardStatusColor = isAccepted
                ? 'border-emerald-500/40 bg-emerald-950/20'
                : isUncertain
                ? 'border-amber-500/40 bg-amber-950/20'
                : 'border-rose-500/40 bg-rose-950/20';

              const digitBadge = isAccepted
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : isUncertain
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                : 'bg-rose-500/20 text-rose-400 border-rose-500/30';

              return (
                <div
                  key={idx}
                  onClick={() => onSelectDigit && onSelectDigit(idx)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer overflow-hidden ${cardStatusColor} ${
                    isSelected ? 'ring-2 ring-brand-400 scale-[1.02] shadow-lg' : 'hover:border-slate-600'
                  }`}
                >
                  {/* Top Row: Digit Info + 28x28 Crop */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      {/* Big Digit */}
                      <span className="text-3xl font-mono font-black text-white shrink-0">
                        {digitItem.status === 'rejected' ? '?' : digitItem.predicted_digit}
                      </span>

                      <div className="min-w-0">
                        <div className="flex items-center space-x-1">
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">Pos #{idx + 1}</span>
                          <span className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold border truncate ${digitBadge}`}>
                            {digitItem.status}
                          </span>
                        </div>
                        <div className="text-xs font-mono font-semibold text-slate-200 mt-0.5 truncate">
                          {(digitItem.confidence * 100).toFixed(1)}% conf
                        </div>
                      </div>
                    </div>

                    {/* Preprocessed 28x28 Thumbnail */}
                    {showCrops && digitItem.preprocessed_crop && (
                      <div className="w-9 h-9 rounded-lg bg-black border border-slate-700 overflow-hidden flex items-center justify-center shadow-inner shrink-0">
                        <img
                          src={digitItem.preprocessed_crop}
                          alt={`Digit ${digitItem.predicted_digit} 28x28 crop`}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                  </div>

                  {/* Confidence Bar */}
                  <div className="mt-2.5">
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isAccepted
                            ? 'bg-emerald-500'
                            : isUncertain
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, digitItem.confidence * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Top Alternatives & Margin */}
                  {digitItem.top_alternatives && digitItem.top_alternatives.length > 1 && (
                    <div className="mt-2 pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 space-y-1">
                      <div className="flex items-center justify-between text-slate-500">
                        <span>Runner-Up:</span>
                        <span className="font-mono text-slate-300">
                          Digit {digitItem.top_alternatives[1].digit} ({(digitItem.top_alternatives[1].confidence * 100).toFixed(1)}%)
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-500">
                        <span>Margin Δ:</span>
                        <span className="font-mono text-slate-400">
                          +{(digitItem.margin * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Bounding Box Coordinates */}
                  {digitItem.bounding_box && (
                    <div className="mt-1 text-[9px] font-mono text-slate-500">
                      Box: ({digitItem.bounding_box.x}, {digitItem.bounding_box.y}, {digitItem.bounding_box.w}×{digitItem.bounding_box.h})
                    </div>
                  )}

                  {/* Dedicated Explain Action */}
                  {onExplainCrop && digitItem.preprocessed_crop && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onExplainCrop(digitItem.preprocessed_crop, digitItem.predicted_digit);
                      }}
                      className="w-full mt-2.5 flex items-center justify-center space-x-1.5 py-1 px-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/25 active:bg-indigo-500/35 text-indigo-300 border border-indigo-500/30 text-[10px] font-mono font-medium transition-all shadow-sm"
                      title="Generate Grad-CAM heatmap for this segmented digit"
                    >
                      <Eye className="w-3 h-3 text-indigo-400" />
                      <span>Explain (Grad-CAM)</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
