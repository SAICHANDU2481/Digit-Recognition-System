import React, { useState } from 'react';
import { Eye, Sparkles, X, AlertTriangle, Layers, Info, CheckCircle2, RefreshCw, GraduationCap } from 'lucide-react';

export default function ExplainabilityViewer({
  explanation,
  isLoading,
  error,
  onClose,
  onExplainDigit = null,
  onAskTutor = null,
}) {
  const [selectedTargetDigit, setSelectedTargetDigit] = useState(null);

  if (isLoading) {
    return (
      <div className="glass-panel rounded-2xl p-6 border border-brand-500/30 flex flex-col items-center justify-center min-h-[300px] animate-pulse">
        <div className="w-12 h-12 rounded-full border-3 border-brand-500/30 border-t-brand-400 animate-spin mb-3" />
        <h4 className="text-sm font-semibold text-white">Generating Grad-CAM Heatmap...</h4>
        <p className="text-xs text-slate-400 mt-1">
          Backpropagating target class score to convolutional feature maps (layer conv2_2)
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel rounded-2xl p-5 border border-rose-500/30">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2 text-rose-400">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Explainability Error</span>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-xs text-slate-300 mt-3">{error}</p>
      </div>
    );
  }

  if (!explanation) return null;

  const {
    prediction,
    confidence = 0,
    layer = 'conv2_2',
    original_image,
    heatmap,
    overlay,
    explanation_method = 'Grad-CAM',
    probabilities = {},
    duration_ms = 0,
    is_blank = false,
  } = explanation;

  if (is_blank) {
    return (
      <div className="glass-panel rounded-2xl p-5 border border-amber-500/30">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2 text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Blank Input</span>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-xs text-slate-300 mt-3">
          The drawn canvas is blank or too faint. Draw a legible digit to view its Grad-CAM explanation.
        </p>
      </div>
    );
  }

  const handleTargetChange = (digit) => {
    setSelectedTargetDigit(digit);
    if (onExplainDigit) {
      onExplainDigit(digit);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-5 border border-indigo-500/30 shadow-2xl space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-white tracking-tight">Grad-CAM Feature Attribution</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                Layer: {layer}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Computed in {duration_ms.toFixed(1)} ms &bull; {explanation_method}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {onAskTutor && (
            <button
              onClick={onAskTutor}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 text-xs font-medium transition-all shadow-sm"
              title="Consult Handwriting Tutor about this feature activation map"
            >
              <GraduationCap className="w-3.5 h-3.5 text-indigo-300" />
              <span>Ask Tutor</span>
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close explanation panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Hero Stats */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center space-x-3">
          <span className="text-3xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-indigo-300">
            Digit {prediction}
          </span>
          <div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              {(confidence * 100).toFixed(1)}% Confidence
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">Primary Predicted Class</p>
          </div>
        </div>

        {/* Target Alternative Class Explanations */}
        {onExplainDigit && (
          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
            <span className="text-[11px]">Explain as:</span>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
              <button
                key={d}
                onClick={() => handleTargetChange(d)}
                className={`w-5 h-5 rounded font-mono text-[10px] flex items-center justify-center border transition-all ${
                  (selectedTargetDigit !== null ? selectedTargetDigit === d : prediction === d)
                    ? 'bg-brand-600 text-white border-brand-400'
                    : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                }`}
                title={`Compute Grad-CAM for class ${d}`}
              >
                {d}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Side-by-Side Visualizations (3-Panel Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Panel 1: Original Processed 28x28 */}
        <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-800 flex flex-col items-center">
          <span className="text-[11px] font-semibold text-slate-300 mb-2">1. Processed Input</span>
          <div className="w-32 h-32 rounded-lg bg-black border border-slate-700 overflow-hidden flex items-center justify-center shadow-inner">
            {original_image ? (
              <img
                src={original_image}
                alt="Original processed digit"
                className="w-full h-full object-contain [image-rendering:pixelated]"
              />
            ) : (
              <span className="text-xs text-slate-600">None</span>
            )}
          </div>
          <span className="text-[10px] text-slate-500 mt-2 font-mono">LeCun Centered 28×28</span>
        </div>

        {/* Panel 2: Grad-CAM Heatmap */}
        <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-800 flex flex-col items-center">
          <span className="text-[11px] font-semibold text-slate-300 mb-2">2. Activation Heatmap</span>
          <div className="w-32 h-32 rounded-lg bg-black border border-indigo-500/40 overflow-hidden flex items-center justify-center shadow-inner">
            {heatmap ? (
              <img
                src={heatmap}
                alt="Grad-CAM JET colormap heatmap"
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="text-xs text-slate-600">None</span>
            )}
          </div>
          <div className="flex items-center space-x-1 text-[10px] text-slate-400 mt-2 font-mono">
            <span className="text-blue-400">Low</span>
            <span className="inline-block w-8 h-1.5 rounded bg-gradient-to-r from-blue-600 via-yellow-400 to-red-600" />
            <span className="text-red-400">High</span>
          </div>
        </div>

        {/* Panel 3: Blended Overlay */}
        <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-800 flex flex-col items-center">
          <span className="text-[11px] font-semibold text-slate-300 mb-2">3. Blended Overlay</span>
          <div className="w-32 h-32 rounded-lg bg-black border border-purple-500/40 overflow-hidden flex items-center justify-center shadow-inner">
            {overlay ? (
              <img
                src={overlay}
                alt="Grad-CAM overlay on original image"
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="text-xs text-slate-600">None</span>
            )}
          </div>
          <span className="text-[10px] text-purple-300 mt-2 font-mono">60% Digit + 40% CAM</span>
        </div>
      </div>

      {/* Scientific Explanation Notice */}
      <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 leading-relaxed flex items-start space-x-2">
        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-200">What does this visualization show? </span>
          Grad-CAM computes the gradient of class score {prediction} with respect to feature maps in the final convolutional layer (<code className="text-indigo-300">{layer}</code>). The red and yellow zones indicate anatomical pixel features that most heavily pushed the network towards this classification.
          <span className="block text-slate-500 mt-0.5">
            Note: Grad-CAM visualizes model attention and statistical relevance; it is not a claim of human-style logical reasoning.
          </span>
        </div>
      </div>
    </div>
  );
}
