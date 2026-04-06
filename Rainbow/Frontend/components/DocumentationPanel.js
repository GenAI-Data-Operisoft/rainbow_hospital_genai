'use client';

import React, { useState, useRef } from 'react';
import pdfExportService from './PdfExportService';
import FeedbackControls from './FeedbackControls'; // ✅ Import feedback controls

import { FileText, Sparkles, CheckCircle, Download, Edit, Save, X, Search } from 'lucide-react';

const DocumentationPanel = ({
  prescription = '',
  setPrescription = () => { },
  isEditingPrescription = false,
  setIsEditingPrescription = () => { },
  isGenerating = false,
  isFinalizing = false,
  isFinalized = false,
  generatePrescription = () => { },
  finalizePrescription = () => { },
  patientDemographics = {},
  // New props for highlighting
  onHighlightTranscript,
  transcript,
  // New props for PDF export
  user = {},
  metadata = {},
  diarizationResults = null,
  // ✅ New props for feedback (optional)
  sessionIdRef = null,
  sessionId = null,
  wsRef = null
}) => {
  const [isZoomed, setIsZoomed] = useState(false);
  const [editingSections, setEditingSections] = useState({});
  const [isExporting, setIsExporting] = useState(false);
  const [editableSections, setEditableSections] = useState(null);
  const prevPrescriptionRef = useRef(null);

  const summaryRef = useRef(null);

  // Add the exportPDF function
  const exportPDF = async () => {
    if (!prescription) {
      alert('No prescription available to export.');
      return;
    }

    try {
      setIsExporting(true);

      await pdfExportService.exportPrescriptionPDF({
        prescription,
        patientDemographics: patientDemographics || {},
        user: user || {},
        metadata: {
          model: metadata?.ai_model || metadata?.model || 'Nova-Lite',
          context: metadata?.context || 'Generic',
          ...metadata
        },
        transcript: transcript || '',
        diarizationResults: diarizationResults || null
      });

    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleFinalize = () => {
    if (!prescription?.trim()) {
      alert('No prescription available. Please generate or enter some text first.');
      return;
    }

    setTimeout(() => {
      setIsZoomed(true);
      if (!isFinalized) finalizePrescription?.();
    }, 100);
  };

  const getCategoryIcon = (category) => {
    const icons = {
      'Patient Demographics': '',
      'Chief Complaints': '',
      'Present Illness': '',
      'Past Medical/Surgical History': '',
      'Family History': '',
      'Personal/Social History': '',
      'Developmental History': '',
      'Examination': '',
      'Diagnosis': '',
      'Procedure': '',
      'OB History': '',
      'Doctor Note': '',
      'Doctor Recommendation and Advice': '',
  };

    return icons[category] || '';
  };

  const parseDocumentation = (text) => {
    if (!text) return [];

    const lines = text.split('\n');
    const sections = [];
    let currentSection = null;
    let currentContent = [];

    const categories = [
      'Patient Demographics',
      'Chief Complaints',
      'Present Illness',
      'Past Medical/Surgical History',
      'Family History',
      'Personal/Social History',
      'Developmental History',
      'Examination',
      'Diagnosis',
      'Procedure',
      'OB History',
      'Doctor Note',
      'Doctor Recommendation and Advice'
    ];

    const isMedicalDocHeader = (str) => {
      const cleaned = str.toLowerCase().replace(/[*•\-:\s]/g, '');
      return cleaned === 'medicaldocumentation';
    };

    for (const line of lines) {
      // Skip the "Medical Documentation:" divider line
      if (isMedicalDocHeader(line)) continue;

      const category = categories.find(cat =>
        line.toLowerCase().includes(cat.toLowerCase() + ':') ||
        line.toLowerCase().includes('**' + cat.toLowerCase() + '**')
      );

      if (category) {
        if (currentSection) {
          sections.push({ category: currentSection, content: currentContent });
        }
        currentSection = category;
        // Strip markdown bold markers, leading bullets, and the category label
        const headerContent = line
          .replace(/\*\*/g, '')
          .replace(/^[-•]\s*/, '')
          .replace(new RegExp(category + ':\\s*', 'i'), '')
          .trim();
        currentContent = headerContent && !isMedicalDocHeader(headerContent)
          ? [headerContent]
          : [];
      } else if (currentSection) {
        const trimmedLine = line.trim();
        if (trimmedLine && !isMedicalDocHeader(trimmedLine)) {
          const cleanLine = trimmedLine.replace(/^[-•]\s*/, '').trim();
          if (cleanLine) currentContent.push(cleanLine);
        }
      }
    }

    if (currentSection) sections.push({ category: currentSection, content: currentContent });

    return sections;
  };

  // Enhanced keyword extraction function
  const extractKeywords = (itemText) => {
    if (!itemText || typeof itemText !== 'string') return [];

    const text = itemText.toLowerCase();
    const keywords = [];

    const stopwords = [
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'by', 'a', 'an', 'is', 'was', 'are', 'were', 'have', 'has', 'had',
      'medicine', 'take', 'apply', 'use', 'mg', 'tablet', 'capsule'
    ];

    const words = text.split(/[\s,\.\-\(\)]+/).filter(word =>
      word.length > 2 && !stopwords.includes(word)
    );

    keywords.push(...words);

    const phrases = [];
    for (let i = 0; i < words.length - 1; i++) {
      if (i < words.length - 1) {
        phrases.push(`${words[i]} ${words[i + 1]}`);
      }
      if (i < words.length - 2) {
        phrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
      }
    }

    keywords.push(...phrases.reverse());

    return keywords;
  };

  // Find matching text segments in transcript
  const findMatchingSegments = (itemText, transcript) => {
    if (!itemText || !transcript) return [];

    const keywords = extractKeywords(itemText);
    const transcriptLower = transcript.toLowerCase();
    const matches = [];

    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase();
      let startIndex = transcriptLower.indexOf(keywordLower);

      while (startIndex !== -1) {
        let segmentStart = startIndex;
        let segmentEnd = startIndex + keyword.length;

        while (segmentStart > 0 &&
          transcriptLower[segmentStart - 1] !== '.' &&
          transcriptLower[segmentStart - 1] !== '?' &&
          transcriptLower[segmentStart - 1] !== '!') {
          segmentStart--;
        }

        while (segmentEnd < transcriptLower.length &&
          transcriptLower[segmentEnd] !== '.' &&
          transcriptLower[segmentEnd] !== '?' &&
          transcriptLower[segmentEnd] !== '!') {
          segmentEnd++;
        }

        if (segmentEnd < transcriptLower.length) {
          segmentEnd++;
        }

        const segment = transcript.substring(segmentStart, segmentEnd).trim();

        if (segment.length > keyword.length * 0.8) {
          matches.push({
            segment,
            startIndex: segmentStart,
            endIndex: segmentEnd,
            matchedKeyword: keyword,
            confidence: keyword.split(' ').length
          });
        }

        startIndex = transcriptLower.indexOf(keywordLower, startIndex + 1);
      }
    }

    const uniqueMatches = matches
      .sort((a, b) => b.confidence - a.confidence)
      .filter((match, index, arr) =>
        index === arr.findIndex(m => Math.abs(m.startIndex - match.startIndex) < 10)
      )
      .slice(0, 3);

    return uniqueMatches;
  };

  // Handle documentation item click
  const handleDocumentationItemClick = (itemText) => {
    if (!transcript || !onHighlightTranscript) {
      console.log('No transcript or highlight function available');
      return;
    }

    console.log('Clicked documentation item:', itemText);

    const matches = findMatchingSegments(itemText, transcript);

    if (matches.length > 0) {
      console.log('Found matches:', matches);
      onHighlightTranscript(matches[0].startIndex, matches[0].endIndex, matches[0].segment);
    } else {
      console.log('No matches found for:', itemText);
      if (onHighlightTranscript) {
        onHighlightTranscript(null, null, null, `No matching text found for: ${itemText}`);
      }
    }
  };

  const handleSectionContentChange = (sectionIndex, itemIndex, newValue) => {
    const sections = editableSections || parseDocumentation(prescription);
    const updated = sections.map((s, si) =>
      si === sectionIndex
        ? { ...s, content: s.content.map((c, ci) => ci === itemIndex ? newValue : c) }
        : s
    );
    setEditableSections(updated);

    const updatedPrescription = updated
      .map(section => {
        const header = `**${section.category}:**`;
        const items = section.content
          .filter(item => item !== '')
          .map(item => (item.startsWith('-') ? item : `- ${item}`))
          .join('\n');
        return `${header}\n${items}`;
      })
      .join('\n\n');

    prevPrescriptionRef.current = updatedPrescription;
    setPrescription(updatedPrescription);
  };

  const handleAddLine = (sectionIndex) => {
    const sections = editableSections || parseDocumentation(prescription);
    const updated = sections.map((s, si) =>
      si === sectionIndex ? { ...s, content: [...s.content, ''] } : s
    );
    setEditableSections(updated);

    const updatedPrescription = updated
      .map(section => {
        const header = `**${section.category}:**`;
        const items = section.content
          .filter(item => item !== '')
          .map(item => (item.startsWith('-') ? item : `- ${item}`))
          .join('\n');
        return `${header}\n${items}`;
      })
      .join('\n\n');

    prevPrescriptionRef.current = updatedPrescription;
    setPrescription(updatedPrescription);
  };

  const handleDeleteLine = (sectionIndex, itemIndex) => {
    const sections = editableSections || parseDocumentation(prescription);
    const updated = sections.map((s, si) =>
      si === sectionIndex
        ? { ...s, content: s.content.filter((_, ci) => ci !== itemIndex) }
        : s
    );
    setEditableSections(updated);

    const updatedPrescription = updated
      .map(section => {
        const header = `**${section.category}:**`;
        const items = section.content
          .filter(item => item !== '')
          .map(item => (item.startsWith('-') ? item : `- ${item}`))
          .join('\n');
        return `${header}\n${items}`;
      })
      .join('\n\n');

    prevPrescriptionRef.current = updatedPrescription;
    setPrescription(updatedPrescription);
  };

  const toggleEditSection = (sectionIndex) => {
    setEditingSections(prev => ({
      ...prev,
      [sectionIndex]: !prev[sectionIndex]
    }));
  };

  const renderDocumentation = (text) => {
    if (!text) return null;

    // If prescription changed externally (e.g. Generate), reset editable sections
    if (prevPrescriptionRef.current !== text) {
      prevPrescriptionRef.current = text;
      setEditableSections(null);
    }

    const sections = editableSections || parseDocumentation(text);
    const patientDemoIndex = sections.findIndex(s => s.category === 'Patient Demographics');
    const showMedicalDocHeader = patientDemoIndex >= 0 && sections.length > patientDemoIndex + 1;

    return (
      <div className="space-y-4">
        {sections.map((section, idx) => {
          // Skip rendering "Plan of Action" section
          if (section.category === 'Plan of Action') return null;

          // Skip rendering "Medical Documentation" if it appears as content
          const filteredContent = section.content.filter(item =>
            item.toLowerCase() !== 'medical documentation'
          );

          return (
            <React.Fragment key={idx}>
              {/* Show Medical Documentation header after Patient Demographics */}
              {idx === patientDemoIndex + 1 && showMedicalDocHeader && (
                <div className="my-6">
                  <h3 className="text-lg font-bold text-gray-800 border-b-2 border-[#EC2F8C] pb-2 mb-4">
                    Medical Documentation
                  </h3>
                </div>
              )}

              <div className="border border-gray-300 rounded-lg overflow-hidden">
                {/* Section Header with Edit Toggle */}
                <div className={`px-4 py-2 border-b border-gray-300 flex items-center justify-between ${section.category === 'Patient Demographics'
                  ? 'bg-blue-100'
                  : 'bg-gray-200'
                  }`}>
                  <h4 className={`font-semibold text-sm ${section.category === 'Patient Demographics'
                    ? 'text-blue-900'
                    : 'text-gray-800'
                    }`}>
                    {getCategoryIcon(section.category)} {section.category}
                  </h4>
                  {isEditingPrescription && (
                    <button
                      onClick={() => toggleEditSection(idx)}
                      className="p-1 hover:bg-gray-300 rounded transition-colors"
                      title={editingSections[idx] ? 'Done editing' : 'Edit section'}
                    >
                      {editingSections[idx] ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <Edit className="h-4 w-4 text-gray-600" />
                      )}
                    </button>
                  )}
                </div>

                {/* Section Content */}
                <div className={`px-4 py-3 text-sm text-gray-700 space-y-1 ${section.category === 'Patient Demographics'
                  ? 'bg-white'
                  : 'bg-gray-50'
                  }`}>
                  {filteredContent.map((line, i) => {
                    if (!isEditingPrescription && !line.trim()) return null;

                    const cleanLine = line.replace(/^[-•]\s*/, '');

                    return (
                      <div key={i}>
                        {isEditingPrescription && editingSections[idx] ? (
                          <div className="flex gap-2 mb-2">
                            <span className="text-gray-600 mt-2">•</span>
                            <textarea
                              value={cleanLine}
                              onChange={(e) => handleSectionContentChange(idx, i, e.target.value)}
                              className="flex-1 p-2 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-pink-400 font-sans"
                              rows="2"
                              placeholder="Enter content..."
                            />
                            <button
                              onClick={() => handleDeleteLine(idx, i)}
                              className="text-red-500 hover:text-red-700 px-2"
                              title="Delete line"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div
                            className="ml-4 flex gap-2 cursor-pointer hover:bg-pink-100 p-2 rounded transition-colors duration-200 border border-transparent hover:border-pink-200 hover:shadow-sm group"
                            onClick={() => handleDocumentationItemClick(cleanLine)}
                            title={transcript ? "Click to highlight related text in transcript" : "No transcript available"}
                          >
                            <span className="text-gray-600">•</span>
                            <span className="flex-1">{cleanLine}</span>
                            {transcript && (
                              <Search className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Add Line Button */}
                  {isEditingPrescription && editingSections[idx] && (
                    <button
                      onClick={() => handleAddLine(idx)}
                      className="mt-2 flex items-center gap-1 px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                    >
                      <span className="text-lg leading-none">+</span>
                      Add Line
                    </button>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {isZoomed && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          onClick={() => setIsZoomed(false)}
        />
      )}

      <div
        className={`lg:col-span-4 bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-col transition-all duration-500 transform z-50
          ${isZoomed ? 'fixed inset-0 m-auto max-w-4xl max-h-[90vh] scale-110' : 'relative scale-100'}`}
      >
        {isZoomed && (
          <button
            onClick={() => setIsZoomed(false)}
            className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 p-1 rounded-full z-50 bg-white/80 backdrop-blur-sm"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {/* HEADER */}
        <div className="bg-gradient-to-r from-[#03443F] to-[#27F5E4] px-4 py-3 relative">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <div className="w-6 h-6 bg-white/20 rounded flex items-center justify-center">
              <FileText className="h-4 w-4 text-white" />
            </div>
            Medical Documentation
          </h3>
        </div>

        <div className="p-4 flex flex-col gap-3">
          {/* ACTION BUTTONS + FEEDBACK */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setIsEditingPrescription(!isEditingPrescription);
                if (isEditingPrescription) {
                  setEditingSections({});
                }
              }}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              {isEditingPrescription ? <Save className="h-3 w-3" /> : <Edit className="h-3 w-3" />}
              {isEditingPrescription ? 'Save' : 'Edit'}
            </button>

            <button
              onClick={generatePrescription}
              disabled={isGenerating}
              className="flex items-center gap-1 px-3 py-1 text-sm 
                bg-gradient-to-r from-[#E15CFF] to-[#EC2F8C] 
                hover:from-[#7A2D68] hover:to-[#D22078] 
                text-white rounded-xl transition-colors disabled:opacity-50"
            >
              <Sparkles className="h-3 w-3" />
              {isGenerating ? 'Generating...' : 'Generate'}
            </button>

            <button
              onClick={handleFinalize}
              disabled={!prescription || isFinalizing}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-green-700 hover:bg-green-700 text-white rounded-xl transition-colors disabled:opacity-50"
            >
              <CheckCircle className="h-3 w-3" />
              {isFinalizing ? 'Finalizing...' : 'Finalize'}
            </button>

            {/* ✅ FEEDBACK CONTROLS */}
            {sessionIdRef && wsRef && (
              <FeedbackControls
                sessionIdRef={sessionIdRef}
                wsRef={wsRef}
                user={user}
                panelName="documentation"
              />
            )}
          </div>

          {/* CONTENT */}
          <div
            ref={summaryRef}
            className={`border-2 border-gray-200 rounded-xl p-3 overflow-auto transition-all duration-300 min-h-[500px] max-h-[600px]
    ${isZoomed ? 'min-h-[70vh] max-h-[80vh]' : ''}`}
          >
            {!prescription ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 text-center">
                <Sparkles className="h-10 w-10 mb-2 text-gray-300" />
                <p className="text-sm">Click "Generate" to create medical documentation...</p>
              </div>
            ) : (
              <>
                {renderDocumentation(prescription)}
              </>
            )}
          </div>

          {/* EXPORT PDF */}
          {isFinalized && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={exportPDF}
                disabled={isExporting}
                className="flex items-center gap-2 px-4 py-2 text-sm 
                  bg-[#EC2F8C] hover:bg-[#D22078] text-white rounded-xl shadow-md transition-colors disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                {isExporting ? 'Exporting...' : 'Save as PDF'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default DocumentationPanel;