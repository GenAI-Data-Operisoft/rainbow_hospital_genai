// Enhanced CategoriesPanel.js with transcript highlighting
'use client';

import React from 'react';
import { BarChart3, Edit, Save, Search } from 'lucide-react';
import FeedbackControls from './FeedbackControls';

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
  // New props for highlighting
  onHighlightTranscript,
  transcript
}) => {
  // normalize helper
  const normalizeItems = (items) => {
    if (!items) return [];

    if (Array.isArray(items)) {
      return items
        .map((item) => {
          if (typeof item === 'string') return item.trim();
          if (typeof item === 'object' && item !== null) {
            // Flatten object values like {Medicine: "Paracetamol"}
            return Object.values(item).join(', ');
          }
          return String(item);
        })
        .filter(Boolean);
    }

    if (typeof items === 'string') return items.trim() ? [items] : [];

    if (typeof items === 'object' && items !== null) {
      return [Object.values(items).join(', ')];
    }

    return [String(items)];
  };

  // Enhanced keyword extraction function
  const extractKeywords = (categoryItem) => {
    if (!categoryItem || typeof categoryItem !== 'string') return [];

    const text = categoryItem.toLowerCase();
    const keywords = [];

    // Common medical stopwords to exclude from search
    const stopwords = [
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'by', 'a', 'an', 'is', 'was', 'are', 'were', 'have', 'has', 'had',
      'medicine', 'take', 'apply', 'use'
    ];

    // Extract meaningful phrases and individual words
    const words = text.split(/[\s,\.\-\(\)]+/).filter(word =>
      word.length > 2 && !stopwords.includes(word)
    );

    // Add individual meaningful words
    keywords.push(...words);

    // Extract important phrases (2-4 words)
    const phrases = [];
    for (let i = 0; i < words.length - 1; i++) {
      // 2-word phrases
      if (i < words.length - 1) {
        phrases.push(`${words[i]} ${words[i + 1]}`);
      }
      // 3-word phrases
      if (i < words.length - 2) {
        phrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
      }
      // 4-word phrases for specific cases
      if (i < words.length - 3 && text.includes('for the last')) {
        phrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]} ${words[i + 3]}`);
      }
    }

    // Add phrases to keywords (prioritize longer phrases)
    keywords.push(...phrases.reverse());

    return keywords;
  };

  // Find matching text segments in transcript
  const findMatchingSegments = (categoryItem, transcript) => {
    if (!categoryItem || !transcript) return [];

    const keywords = extractKeywords(categoryItem);
    const transcriptLower = transcript.toLowerCase();
    const matches = [];

    // Try to find matches with different strategies
    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase();
      let startIndex = transcriptLower.indexOf(keywordLower);

      while (startIndex !== -1) {
        // Extend the match to include surrounding context (sentence-like boundaries)
        let segmentStart = startIndex;
        let segmentEnd = startIndex + keyword.length;

        // Extend backwards to sentence start or previous period
        while (segmentStart > 0 &&
          transcriptLower[segmentStart - 1] !== '.' &&
          transcriptLower[segmentStart - 1] !== '?' &&
          transcriptLower[segmentStart - 1] !== '!') {
          segmentStart--;
        }

        // Extend forwards to sentence end or next period
        while (segmentEnd < transcriptLower.length &&
          transcriptLower[segmentEnd] !== '.' &&
          transcriptLower[segmentEnd] !== '?' &&
          transcriptLower[segmentEnd] !== '!') {
          segmentEnd++;
        }

        // Include the ending punctuation
        if (segmentEnd < transcriptLower.length) {
          segmentEnd++;
        }

        // Get the actual text segment
        const segment = transcript.substring(segmentStart, segmentEnd).trim();

        if (segment.length > keyword.length * 0.8) { // Ensure we found a meaningful segment
          matches.push({
            segment,
            startIndex: segmentStart,
            endIndex: segmentEnd,
            matchedKeyword: keyword,
            confidence: keyword.split(' ').length // Longer phrases get higher confidence
          });
        }

        // Look for next occurrence
        startIndex = transcriptLower.indexOf(keywordLower, startIndex + 1);
      }
    }

    // Sort by confidence (longer matches first) and remove duplicates
    const uniqueMatches = matches
      .sort((a, b) => b.confidence - a.confidence)
      .filter((match, index, arr) =>
        index === arr.findIndex(m => Math.abs(m.startIndex - match.startIndex) < 10)
      )
      .slice(0, 3); // Limit to top 3 matches

    return uniqueMatches;
  };

  // Handle category item click
  const handleCategoryItemClick = (categoryItem) => {
    if (!transcript || !onHighlightTranscript) {
      console.log('No transcript or highlight function available');
      return;
    }

    console.log('Clicked category item:', categoryItem);

    const matches = findMatchingSegments(categoryItem, transcript);

    if (matches.length > 0) {
      console.log('Found matches:', matches);
      // Highlight the best match (first one after sorting)
      onHighlightTranscript(matches[0].startIndex, matches[0].endIndex, matches[0].segment);
    } else {
      console.log('No matches found for:', categoryItem);
      // Optional: show a brief message to user
      if (onHighlightTranscript) {
        onHighlightTranscript(null, null, null, `No matching text found for: ${categoryItem}`);
      }
    }
  };

  const getCategoryIcon = (category) => {
    const icons = {
      symptoms: '🤒',
      objective: '🔍',
      assessment: '⚕️',
      vitals: '📊',
      plan: '📋',
      notes: '📝',
      followUp: '📅',
      history: '📚',
      clinicalAlerts: '🚨',
      SYMPTOMS: '🤒',
      OBJECTIVE: '🔍',
      ASSESSMENT: '⚕️',
      VITALS: '📊',
      PLAN: '📋',
      NOTES: '📝',
      FEATURES: '🔬',
      HISTORY: '📚',
      CLINICAL_ALERTS: '🚨'
    };
    return icons[category] || '📌';
  };

  const getCategoryColor = (category) => {
    const colors = {
      symptoms: 'border-[#EC2F8C]',
      objective: 'border-[#8E3B7A]',
      assessment: 'border-[#D22078]',
      vitals: 'border-[#7A2D68]',
      plan: 'border-[#8E3B7A]',
      notes: 'border-gray-500',
      followUp: 'border-[#EC2F8C]',
      history: 'border-[#8E3B7A]',
      clinicalAlerts: 'border-red-600',
      SYMPTOMS: 'border-[#EC2F8C]',
      OBJECTIVE: 'border-[#8E3B7A]',
      ASSESSMENT: 'border-[#D22078]',
      VITALS: 'border-[#7A2D68]',
      PLAN: 'border-[#8E3B7A]',
      NOTES: 'border-gray-500',
      FEATURES: 'border-blue-500',
      HISTORY: 'border-[#8E3B7A]',
      CLINICAL_ALERTS: 'border-red-600'
    };
    return colors[category] || 'border-[#8E3B7A]';
  };

  // Save handler
  const handleSaveCategories = () => {
    console.log('Saving categories...', categories);
    setIsEditingCategories(false);
  };

  return (
    <div className="lg:col-span-4 bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-col">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-[#8E3B7A] to-[#EC2F8C] px-4 py-3">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <div className="w-6 h-6 bg-white/20 rounded flex items-center justify-center">
            <BarChart3 className="h-4 w-4 text-white" />
          </div>
          Medical Categories
          {/* {transcript && (
            <div className="ml-2 text-xs bg-white/20 px-2 py-1 rounded-full">
              <Search className="h-3 w-3 inline mr-1" />
              Click to highlight
            </div>
          )} */}
        </h3>
      </div>

      <div className="p-4 flex-1 flex flex-col">
        {/* BUTTONS + FEEDBACK */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => {
              if (isEditingCategories) {
                handleSaveCategories();
              } else {
                setIsEditingCategories(true);
              }
            }}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            {isEditingCategories ? <Save className="h-3 w-3" /> : <Edit className="h-3 w-3" />}
            {isEditingCategories ? 'Save' : 'Edit'}
          </button>

          {/* Feedback Controls */}
          <FeedbackControls
            sessionIdRef={sessionIdRef}
            wsRef={wsRef}
            user={user}
            panelName="categories"
          />
        </div>

        {/* CATEGORIES */}
        <div
          className="border-2 border-[#8E3B7A]/30 rounded-xl p-6 overflow-auto bg-gray-50 flex-1 
                     min-h-[500px] max-h-[600px]"
        >
          {!categories ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 text-center">
              <BarChart3 className="h-10 w-10 mb-2 text-[#8E3B7A]/50" />
              <p className="text-sm">Categories will appear after analysis...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(categories).map(([key, items]) => {
                const normalizedItems = normalizeItems(items);
                if (normalizedItems.length === 0) return null;

                const icon = getCategoryIcon(key);
                const title = key.replace(/([A-Z])/g, ' $1').toUpperCase();
                const colorClass = getCategoryColor(key);

                return (
                  <div key={key} className={`border-l-4 ${colorClass} bg-white p-3 rounded-r-xl`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        {icon} {title}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {normalizedItems.map((item, itemIndex) =>
                        isEditingCategories ? (
                          <textarea
                            key={itemIndex}
                            value={item}
                            onChange={(e) => {
                              const updated = { ...categories };
                              updated[key][itemIndex] = e.target.value;
                              setCategories(updated);
                            }}
                            className="w-full p-2 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-pink-400"
                          />
                        ) : (
                          <div
                            key={itemIndex}
                            onClick={() => handleCategoryItemClick(item)}
                            className="text-xs text-gray-600 cursor-pointer hover:bg-pink-100 p-2 rounded 
                                     transition-colors duration-200 border border-transparent 
                                     hover:border-pink-200 hover:shadow-sm"
                            title={transcript ? "Click to highlight related text in transcript" : "No transcript available"}
                          >
                            <div className="flex items-center gap-1">
                              <span>•</span>
                              <span>{item}</span>
                              {transcript && <Search className="h-3 w-3 text-gray-400 ml-auto" />}
                            </div>
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
    </div>
  );
};

export default CategoriesPanel;