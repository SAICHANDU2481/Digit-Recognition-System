import React, { useState, useEffect } from 'react';
import { BarChart3, CheckCircle2, Award, Zap, Layers, Activity, RefreshCw, AlertCircle, FileText } from 'lucide-react';
import { getApiUrl } from '../config.js';

export default function ModelMetrics() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(getApiUrl('/api/model-info'));
      const data = await res.json();
      if (res.ok && data.success) {
        setMetrics(data.metrics);
      } else {
        setError(data.error || 'Failed to load model metrics.');
      }
    } catch (err) {
      setError('Could not connect to backend to retrieve model metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="glass-panel rounded-2xl p-12 text-center flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-brand-500/30 border-t-brand-500 animate-spin mb-4" />
        <p className="text-slate-300 font-medium">Loading Real Model Metrics & Evaluation Data...</p>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="glass-panel rounded-2xl p-8 text-center border-amber-500/30">
        <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-200">Metrics Not Yet Available</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto mb-4">
          {error || 'Model metrics will be generated once train_model.py is executed.'}
        </p>
        <button
          onClick={fetchMetrics}
          className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Loading</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics Header Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-panel rounded-2xl p-4 border border-brand-500/20">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Test Accuracy</span>
            <Award className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight">
            {metrics.test_accuracy_percentage}%
          </div>
          <p className="text-[11px] text-emerald-400 mt-1 flex items-center">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Evaluated on 10,000 images
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-4 border border-purple-500/20">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Macro F1-Score</span>
            <Activity className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight">
            {(metrics.macro_f1_score * 100).toFixed(2)}%
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Precision: {(metrics.macro_precision * 100).toFixed(1)}% | Recall: {(metrics.macro_recall * 100).toFixed(1)}%
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-4 border border-indigo-500/20">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Total Parameters</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight">
            {metrics.total_parameters ? metrics.total_parameters.toLocaleString() : 'N/A'}
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">
            Trainable: {metrics.trainable_parameters ? metrics.trainable_parameters.toLocaleString() : 'N/A'}
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-4 border border-cyan-500/20">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Test Loss</span>
            <Zap className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight">
            {metrics.test_loss}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Categorical crossentropy
          </p>
        </div>
      </div>

      {/* Confusion Matrix and Per-Class Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Confusion Matrix Heatmap */}
        <div className="glass-panel rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">Confusion Matrix Heatmap</h3>
              <p className="text-xs text-slate-400">Actual vs. predicted digit distribution across 10,000 test images</p>
            </div>
            <a
              href={getApiUrl('/api/confusion-matrix-image')}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-brand-400 hover:text-brand-300 font-medium"
            >
              Open Full Heatmap
            </a>
          </div>

          <div className="w-full rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center p-2">
            <img
              src={getApiUrl('/api/confusion-matrix-image')}
              alt="MNIST Confusion Matrix"
              className="w-full max-h-[380px] object-contain rounded-lg"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
        </div>

        {/* Per-Class Precision, Recall, and F1 Table */}
        <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white">Per-Class Performance Breakdown</h3>
                <p className="text-xs text-slate-400">Precision, Recall, and F1-Score for each digit class (0-9)</p>
              </div>
              <span className="text-[11px] font-mono text-slate-500">MNIST Test Set</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                    <th className="py-2 px-2">Digit</th>
                    <th className="py-2 px-2">Precision</th>
                    <th className="py-2 px-2">Recall</th>
                    <th className="py-2 px-2">F1-Score</th>
                    <th className="py-2 px-2 text-right">Support</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {Object.entries(metrics.per_class_metrics || {}).map(([digit, val]) => (
                    <tr key={digit} className="hover:bg-slate-800/40">
                      <td className="py-1.5 px-2 font-bold text-brand-400">{digit}</td>
                      <td className="py-1.5 px-2 text-slate-300">{(val.precision * 100).toFixed(1)}%</td>
                      <td className="py-1.5 px-2 text-slate-300">{(val.recall * 100).toFixed(1)}%</td>
                      <td className="py-1.5 px-2 text-white font-medium">{(val.f1_score * 100).toFixed(1)}%</td>
                      <td className="py-1.5 px-2 text-right text-slate-400">{val.support}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500">
            Training time: <strong className="text-slate-400">{metrics.training_duration_seconds}s</strong> | Evaluated: {metrics.timestamp ? new Date(metrics.timestamp).toLocaleString() : 'Recent'}
          </div>
        </div>
      </div>
    </div>
  );
}
