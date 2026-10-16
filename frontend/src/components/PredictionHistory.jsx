import React from 'react';
import { History, Trash2, ArrowRight, Clock } from 'lucide-react';

export default function PredictionHistory({ history, onSelectHistory, onClearHistory }) {
  if (!history || history.length === 0) {
    return (
      <div className="glass-panel rounded-2xl p-4 text-center">
        <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2">
          <span className="flex items-center space-x-1.5">
            <History className="w-3.5 h-3.5" />
            <span>Recent Predictions</span>
          </span>
        </div>
        <p className="text-xs text-slate-500 py-3">No prediction history yet. Try drawing a digit!</p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-3">
        <span className="flex items-center space-x-1.5">
          <History className="w-3.5 h-3.5 text-brand-400" />
          <span>Recent Predictions ({history.length})</span>
        </span>
        <button
          onClick={onClearHistory}
          className="text-slate-400 hover:text-rose-400 p-1 rounded transition-colors"
          title="Clear History"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {history.slice(0, 6).map((item, index) => {
          const confidencePct = Math.round(item.confidence * 100);
          return (
            <div
              key={item.id || index}
              onClick={() => onSelectHistory && onSelectHistory(item)}
              className="bg-slate-900/70 hover:bg-slate-800/80 p-2 rounded-xl border border-slate-800 cursor-pointer transition-all hover:scale-102 flex items-center space-x-2 group"
            >
              <div className="w-10 h-10 rounded-lg bg-black border border-slate-700 overflow-hidden flex-shrink-0">
                <img
                  src={item.processed_image || item.originalImage}
                  alt={`Digit ${item.predicted_digit}`}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="overflow-hidden">
                <div className="flex items-center space-x-1">
                  <span className="font-mono font-bold text-white text-base">
                    {item.predicted_digit}
                  </span>
                  <span className="text-[10px] text-brand-400 font-medium">
                    {confidencePct}%
                  </span>
                </div>
                <span className="text-[9px] text-slate-500 truncate block">
                  {item.source || 'canvas'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
