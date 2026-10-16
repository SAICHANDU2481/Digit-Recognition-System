import React, { useState, useEffect } from 'react';
import { BookOpen, ExternalLink, RefreshCw, Bookmark, Sparkles, GraduationCap } from 'lucide-react';
import { getApiUrl } from '../config.js';

export default function EducationalResources() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');

  const fetchResources = async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/resources'));
      const data = await res.json();
      if (res.ok && data.success) {
        setResources(data.resources || []);
      }
    } catch (e) {
      console.warn('Could not fetch resources:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResources();
  }, []);

  const categories = ['All', ...new Set(resources.map((r) => r.category).filter(Boolean))];
  const filteredResources =
    filter === 'All' ? resources : resources.filter((r) => r.category === filter);

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="glass-panel rounded-2xl p-6 border border-brand-500/20">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center text-brand-400">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Educational Resources & Computer Vision References</h2>
            <p className="text-xs text-slate-400">
              Curated public research papers, benchmark leaderboards, and interactive guides on the MNIST dataset and CNNs.
            </p>
          </div>
        </div>

        {/* Filter categories */}
        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-800">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                filter === cat
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Resource Cards */}
      {loading ? (
        <div className="glass-panel rounded-2xl p-12 text-center">
          <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-400">Loading learning resources...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredResources.map((item, idx) => (
            <div
              key={idx}
              className="glass-panel glass-panel-hover rounded-2xl p-5 flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
                    {item.category || 'Reference'}
                  </span>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-500 group-hover:text-brand-400 transition-colors p-1"
                    title="Open external resource"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

                <h3 className="text-sm font-bold text-white group-hover:text-brand-300 transition-colors">
                  {item.title}
                </h3>
                {item.author && (
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">By {item.author}</p>
                )}
                <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 truncate max-w-[220px]">
                  {new URL(item.url).hostname}
                </span>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1 text-xs font-semibold text-brand-400 hover:text-brand-300"
                >
                  <span>Read Article</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
