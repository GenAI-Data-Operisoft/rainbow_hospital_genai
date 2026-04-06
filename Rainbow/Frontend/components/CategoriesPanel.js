'use client';

import React from 'react';
import { BarChart3, Edit, Save, Search } from 'lucide-react';
import FeedbackControls from './FeedbackControls';

const CATEGORY_META = {
  SYMPTOMS:        { label: 'Symptoms',         color: 'bg-rose-500',    light: 'bg-rose-50 border-rose-200',   text: 'text-rose-700' },
  OBJECTIVE:       { label: 'Objective',         color: 'bg-blue-500',    light: 'bg-blue-50 border-blue-200',   text: 'text-blue-700' },
  ASSESSMENT:      { label: 'Assessment',        color: 'bg-violet-500',  light: 'bg-violet-50 border-violet-200', text: 'text-violet-700' },
  VITALS:          { label: 'Vitals',            color: 'bg-cyan-500',    light: 'bg-cyan-50 border-cyan-200',   text: 'text-cyan-700' },
  PLAN:            { label: 'Plan',              color: 'bg-emerald-500', light: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
  NOTES:           { label: 'Notes',             color: 'bg-slate-500',   light: 'bg-slate-50 border-slate-200', text: 'text-slate-700' },
  FEATURES:        { label: 'Features',          color: 'bg-indigo-500',  light: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700' },
  HISTORY:         { label: 'History',           color: 'bg-amber-500',   light: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
  CLINICAL_ALERTS: { label: 'Clinical Alerts',   color: 'bg-red-500',     light: 'bg-red-50 border-red-200',     text: 'text-red-700' },
};

const CategoriesPanel = ({
  categories,
  setCategories,
  isEditingCategories,
  setIsEditingCategories,
  isAnalyzing,
  analyzeCategories,
  sessionIdRef,
  sessionId,
  wsRef,
  user,
  onHighlightTranscript,
  transcript
}) => {
  const normalizeItems = (items) => {
    if (!items) return [];
    if (Array.isArray(items)) return items.map(i => typeof i === 'string' ? i.trim() : typeof i === 'object' ? Object.values(i).join(', ') : String(i)).filter(Boolean);
    if (typeof items === 'string') return items.trim() ? [items] : [];
    if (typeof items === 'object') return [Object.values(items).join(', ')];
    return [String(items)];
  };

  const extractKeywords = (text) => {
    if (!text) return [];
    const stopwords = ['the','and','or','but','in','on','at','to','for','of','with','by','a','an','is','was','are','were','have','has','had','medicine','take','apply','use'];
    const words = text.toLowerCase().split(/[\s,\.\-\(\)]+/).filter(w => w.length > 2 && !stopwords.includes(w));
    const phrases = [];
    for (let i = 0; i < words.length - 1; i++) {
      phrases.push(`${words[i]} ${words[i+1]}`);
      if (i < words.length - 2) phrases.push(`${words[i]} ${words[i+1]} ${words[i+2]}`);
    }
    return [...words, ...phrases.reverse()];
  };

  const findMatch = (item, transcriptText) => {
    if (!item || !transcriptText) return null;
    const keywords = extractKeywords(item);
    const lower = transcriptText.toLowerCase();
    for (const kw of keywords) {
      const idx = lower.indexOf(kw.toLowerCase());
      if (idx === -1) continue;
      let s = idx, e = idx + kw.length;
      while (s > 0 && !'.?!'.includes(lower[s-1])) s--;
      while (e < lower.length && !'.?!'.includes(lower[e])) e++;
      if (e < lower.length) e++;
      const seg = transcriptText.substring(s, e).trim();
      if (seg.length > kw.length * 0.8) return { startIndex: s, endIndex: e, segment: seg };
    }
    return null;
  };

  const handleItemClick = (item) => {
    if (!transcript || !onHighlightTranscript) return;
    const match = findMatch(item, transcript);
    if (match) onHighlightTranscript(match.startIndex, match.endIndex, match.segment);
    else onHighlightTranscript(null, null, null, `No match found for: ${item}`);
  };

  const hasData = categories && Object.values(categories).some(v => normalizeItems(v).length > 0);

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#8E3B7A] to-[#EC2F8C] px-4 py-3 flex-shrink-0">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <BarChart3 className="h-4 w-4 text-white" />
          </div>
          Medical Categories
        </h3>
      </div>

      {/* Action bar */}
      <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/80 flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => isEditingCategories ? setIsEditingCategories(false) : setIsEditingCategories(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-lg transition-colors shadow-sm text-gray-600"
        >
          {isEditingCategories ? <><Save className="h-3.5 w-3.5 text-green-600" /><span className="text-green-700">Save</span></> : <><Edit className="h-3.5 w-3.5 text-gray-500" />Edit</>}
        </button>
        <FeedbackControls sessionIdRef={sessionIdRef} wsRef={wsRef} user={user} panelName="categories" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-0">
        {!hasData ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center px-4">
            <div className="w-14 h-14 bg-pink-50 rounded-2xl flex items-center justify-center mb-3">
              <BarChart3 className="h-7 w-7 text-pink-200" />
            </div>
            <p className="text-sm font-medium text-gray-500">Categories will appear after analysis</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {Object.entries(categories).map(([key, items]) => {
              const normalized = normalizeItems(items);
              if (normalized.length === 0) return null;
              const meta = CATEGORY_META[key] || { label: key, color: 'bg-gray-400', light: 'bg-gray-50 border-gray-200', text: 'text-gray-700' };

              return (
                <div key={key} className={`rounded-xl border ${meta.light} overflow-hidden`}>
                  <div className={`px-3 py-2 flex items-center gap-2 border-b ${meta.light}`}>
                    <span className={`w-2 h-2 rounded-full ${meta.color} flex-shrink-0`} />
                    <span className={`text-xs font-semibold uppercase tracking-wide ${meta.text}`}>{meta.label}</span>
                    <span className={`ml-auto text-xs ${meta.text} opacity-60`}>{normalized.length}</span>
                  </div>
                  <div className="bg-white px-3 py-2 space-y-1">
                    {normalized.map((item, i) =>
                      isEditingCategories ? (
                        <textarea key={i} value={item}
                          onChange={(e) => {
                            const updated = { ...categories };
                            updated[key][i] = e.target.value;
                            setCategories(updated);
                          }}
                          className="w-full p-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-pink-300 resize-none font-sans"
                          rows={2}
                        />
                      ) : (
                        <div key={i}
                          onClick={() => handleItemClick(item)}
                          className="flex items-start gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors group"
                          title={transcript ? 'Click to highlight in transcript' : undefined}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${meta.color}`} />
                          <span className="text-xs text-gray-700 flex-1 leading-relaxed">{item}</span>
                          {transcript && <Search className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />}
                        </div>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoriesPanel;
