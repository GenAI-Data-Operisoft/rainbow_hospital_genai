'use client';

import React, { useState, useRef } from 'react';
import pdfExportService from './PdfExportService';
import FeedbackControls from './FeedbackControls';
import {
  FileText, Sparkles, CheckCircle, Download, Edit, Save, X, Search,
  User, Stethoscope, ClipboardList, Heart, Users, Activity,
  Baby, FlaskConical, Tag, BookOpen, MessageSquare, Lightbulb, Plus, Trash2
} from 'lucide-react';

const CATEGORY_CONFIG = {
  'Patient Demographics':             { icon: User,          headerBg: 'bg-blue-50',    headerBorder: 'border-blue-200',    headerText: 'text-blue-800',    iconBg: 'bg-blue-100',    iconColor: 'text-blue-600',    dot: 'bg-blue-500' },
  'Chief Complaints':                 { icon: MessageSquare, headerBg: 'bg-rose-50',    headerBorder: 'border-rose-200',    headerText: 'text-rose-800',    iconBg: 'bg-rose-100',    iconColor: 'text-rose-600',    dot: 'bg-rose-500' },
  'Present Illness':                  { icon: Activity,      headerBg: 'bg-orange-50',  headerBorder: 'border-orange-200',  headerText: 'text-orange-800',  iconBg: 'bg-orange-100',  iconColor: 'text-orange-600',  dot: 'bg-orange-500' },
  'Past Medical/Surgical History':    { icon: BookOpen,      headerBg: 'bg-amber-50',   headerBorder: 'border-amber-200',   headerText: 'text-amber-800',   iconBg: 'bg-amber-100',   iconColor: 'text-amber-600',   dot: 'bg-amber-500' },
  'Family History':                   { icon: Users,         headerBg: 'bg-purple-50',  headerBorder: 'border-purple-200',  headerText: 'text-purple-800',  iconBg: 'bg-purple-100',  iconColor: 'text-purple-600',  dot: 'bg-purple-500' },
  'Personal/Social History':          { icon: Heart,         headerBg: 'bg-pink-50',    headerBorder: 'border-pink-200',    headerText: 'text-pink-800',    iconBg: 'bg-pink-100',    iconColor: 'text-pink-600',    dot: 'bg-pink-500' },
  'Developmental History':            { icon: Baby,          headerBg: 'bg-teal-50',    headerBorder: 'border-teal-200',    headerText: 'text-teal-800',    iconBg: 'bg-teal-100',    iconColor: 'text-teal-600',    dot: 'bg-teal-500' },
  'Examination':                      { icon: Stethoscope,   headerBg: 'bg-cyan-50',    headerBorder: 'border-cyan-200',    headerText: 'text-cyan-800',    iconBg: 'bg-cyan-100',    iconColor: 'text-cyan-600',    dot: 'bg-cyan-500' },
  'Diagnosis':                        { icon: Tag,           headerBg: 'bg-red-50',     headerBorder: 'border-red-200',     headerText: 'text-red-800',     iconBg: 'bg-red-100',     iconColor: 'text-red-600',     dot: 'bg-red-500' },
  'Procedure':                        { icon: FlaskConical,  headerBg: 'bg-indigo-50',  headerBorder: 'border-indigo-200',  headerText: 'text-indigo-800',  iconBg: 'bg-indigo-100',  iconColor: 'text-indigo-600',  dot: 'bg-indigo-500' },
  'OB History':                       { icon: Baby,          headerBg: 'bg-fuchsia-50', headerBorder: 'border-fuchsia-200', headerText: 'text-fuchsia-800', iconBg: 'bg-fuchsia-100', iconColor: 'text-fuchsia-600', dot: 'bg-fuchsia-500' },
  'Doctor Note':                      { icon: ClipboardList, headerBg: 'bg-slate-50',   headerBorder: 'border-slate-200',   headerText: 'text-slate-800',   iconBg: 'bg-slate-100',   iconColor: 'text-slate-600',   dot: 'bg-slate-500' },
  'Doctor Recommendation and Advice': { icon: Lightbulb,     headerBg: 'bg-green-50',   headerBorder: 'border-green-200',   headerText: 'text-green-800',   iconBg: 'bg-green-100',   iconColor: 'text-green-600',   dot: 'bg-green-500' },
};
const DEFAULT_CFG = { icon: FileText, headerBg: 'bg-gray-50', headerBorder: 'border-gray-200', headerText: 'text-gray-800', iconBg: 'bg-gray-100', iconColor: 'text-gray-600', dot: 'bg-gray-400' };

const DocumentationPanel = ({
  prescription = '',
  setPrescription = () => {},
  isEditingPrescription = false,
  setIsEditingPrescription = () => {},
  isGenerating = false,
  isFinalizing = false,
  isFinalized = false,
  generatePrescription = () => {},
  finalizePrescription = () => {},
  patientDemographics = {},
  onHighlightTranscript,
  transcript,
  user = {},
  metadata = {},
  diarizationResults = null,
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

  const exportPDF = async () => {
    if (!prescription) { alert('No prescription available to export.'); return; }
    try {
      setIsExporting(true);
      await pdfExportService.exportPrescriptionPDF({
        prescription,
        patientDemographics: patientDemographics || {},
        user: user || {},
        metadata: { model: metadata?.ai_model || metadata?.model || 'Nova-Lite', context: metadata?.context || 'Generic', ...metadata },
        transcript: transcript || '',
        diarizationResults: diarizationResults || null
      });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF: ' + error.message);
    } finally { setIsExporting(false); }
  };

  const handleFinalize = () => {
    if (!prescription?.trim()) { alert('No prescription available. Please generate or enter some text first.'); return; }
    setTimeout(() => { setIsZoomed(true); if (!isFinalized) finalizePrescription?.(); }, 100);
  };

  const parseDocumentation = (text) => {
    if (!text) return [];
    const lines = text.split('\n');
    const sections = [];
    let currentSection = null, currentContent = [];
    const categories = Object.keys(CATEGORY_CONFIG);
    const isMedDoc = (s) => s.toLowerCase().replace(/[*•\-:\s]/g, '') === 'medicaldocumentation';
    for (const line of lines) {
      if (isMedDoc(line)) continue;
      const category = categories.find(cat =>
        line.toLowerCase().includes(cat.toLowerCase() + ':') ||
        line.toLowerCase().includes('**' + cat.toLowerCase() + '**')
      );
      if (category) {
        if (currentSection) sections.push({ category: currentSection, content: currentContent });
        currentSection = category;
        const hc = line.replace(/\*\*/g, '').replace(/^[-•]\s*/, '').replace(new RegExp(category + ':\\s*', 'i'), '').trim();
        currentContent = hc && !isMedDoc(hc) ? [hc] : [];
      } else if (currentSection) {
        const tl = line.trim();
        if (tl && !isMedDoc(tl)) { const cl = tl.replace(/^[-•]\s*/, '').trim(); if (cl) currentContent.push(cl); }
      }
    }
    if (currentSection) sections.push({ category: currentSection, content: currentContent });
    return sections;
  };

  const extractKeywords = (text) => {
    if (!text) return [];
    const stopwords = ['the','and','or','but','in','on','at','to','for','of','with','by','a','an','is','was','are','were','have','has','had','medicine','take','apply','use','mg','tablet','capsule'];
    const words = text.toLowerCase().split(/[\s,\.\-\(\)]+/).filter(w => w.length > 2 && !stopwords.includes(w));
    const phrases = [];
    for (let i = 0; i < words.length - 1; i++) {
      phrases.push(`${words[i]} ${words[i+1]}`);
      if (i < words.length - 2) phrases.push(`${words[i]} ${words[i+1]} ${words[i+2]}`);
    }
    return [...words, ...phrases.reverse()];
  };

  const findMatch = (itemText, transcriptText) => {
    if (!itemText || !transcriptText) return null;
    const keywords = extractKeywords(itemText);
    const lower = transcriptText.toLowerCase();
    for (const kw of keywords) {
      let idx = lower.indexOf(kw.toLowerCase());
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

  const handleItemClick = (itemText) => {
    if (!transcript || !onHighlightTranscript) return;
    const match = findMatch(itemText, transcript);
    if (match) onHighlightTranscript(match.startIndex, match.endIndex, match.segment);
    else onHighlightTranscript(null, null, null, `No matching text found for: ${itemText}`);
  };

  const rebuildPrescription = (sections) => sections.map(s => {
    const header = `**${s.category}:**`;
    const items = s.content.filter(i => i !== '').map(i => i.startsWith('-') ? i : `- ${i}`).join('\n');
    return `${header}\n${items}`;
  }).join('\n\n');

  const handleContentChange = (si, ii, val) => {
    const sections = (editableSections || parseDocumentation(prescription)).map((s, i) =>
      i === si ? { ...s, content: s.content.map((c, j) => j === ii ? val : c) } : s
    );
    setEditableSections(sections);
    const updated = rebuildPrescription(sections);
    prevPrescriptionRef.current = updated;
    setPrescription(updated);
  };

  const handleAddLine = (si) => {
    const sections = (editableSections || parseDocumentation(prescription)).map((s, i) =>
      i === si ? { ...s, content: [...s.content, ''] } : s
    );
    setEditableSections(sections);
    const updated = rebuildPrescription(sections);
    prevPrescriptionRef.current = updated;
    setPrescription(updated);
  };

  const handleDeleteLine = (si, ii) => {
    const sections = (editableSections || parseDocumentation(prescription)).map((s, i) =>
      i === si ? { ...s, content: s.content.filter((_, j) => j !== ii) } : s
    );
    setEditableSections(sections);
    const updated = rebuildPrescription(sections);
    prevPrescriptionRef.current = updated;
    setPrescription(updated);
  };

  const renderSection = (section, sectionIdx, cfg) => {
    const Icon = cfg.icon;
    const isEditing = editingSections[sectionIdx];
    const filteredContent = section.content.filter(i => i.toLowerCase() !== 'medical documentation');
    const isNoneOnly = filteredContent.length === 1 && filteredContent[0].toLowerCase() === 'none';

    return (
      <div className={`rounded-xl border ${cfg.headerBorder} overflow-hidden shadow-sm`}>
        <div className={`${cfg.headerBg} px-3 sm:px-4 py-2.5 flex items-center justify-between border-b ${cfg.headerBorder}`}>
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-6 h-6 rounded-md ${cfg.iconBg} flex items-center justify-center flex-shrink-0`}>
              <Icon className={`h-3.5 w-3.5 ${cfg.iconColor}`} />
            </div>
            <span className={`font-semibold text-xs sm:text-sm ${cfg.headerText} truncate`}>{section.category}</span>
            {isNoneOnly && !isEditingPrescription && <span className="text-xs text-gray-400 italic hidden sm:inline ml-1">— not mentioned</span>}
          </div>
          {isEditingPrescription && (
            <button onClick={() => setEditingSections(p => ({ ...p, [sectionIdx]: !p[sectionIdx] }))}
              className="p-1 rounded-md hover:bg-white/60 transition-colors flex-shrink-0 ml-2">
              {isEditing ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Edit className={`h-4 w-4 ${cfg.iconColor}`} />}
            </button>
          )}
        </div>

        {(!isNoneOnly || (isEditingPrescription && isEditing)) && (
          <div className="bg-white px-3 sm:px-4 py-3 space-y-1">
            {filteredContent.map((line, i) => {
              if (!isEditingPrescription && !line.trim()) return null;
              const cleanLine = line.replace(/^[-•]\s*/, '');
              return (
                <div key={i}>
                  {isEditingPrescription && isEditing ? (
                    <div className="flex gap-2 items-start mb-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full mt-2.5 flex-shrink-0 ${cfg.dot}`} />
                      <textarea value={cleanLine} onChange={e => handleContentChange(sectionIdx, i, e.target.value)}
                        className="flex-1 p-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-pink-300 font-sans resize-none" rows={2} placeholder="Enter content..." />
                      <button onClick={() => handleDeleteLine(sectionIdx, i)} className="text-red-400 hover:text-red-600 p-1 mt-0.5 flex-shrink-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div onClick={() => handleItemClick(cleanLine)}
                      className="flex items-start gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors group"
                      title={transcript ? 'Click to highlight in transcript' : undefined}>
                      <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${cfg.dot}`} />
                      <span className="flex-1 text-xs sm:text-sm text-gray-700 leading-relaxed">{cleanLine}</span>
                      {transcript && <Search className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />}
                    </div>
                  )}
                </div>
              );
            })}
            {isEditingPrescription && isEditing && (
              <button onClick={() => handleAddLine(sectionIdx)}
                className={`mt-1.5 flex items-center gap-1 px-3 py-1.5 text-xs ${cfg.iconBg} ${cfg.iconColor} hover:opacity-80 rounded-lg transition-colors font-medium`}>
                <Plus className="h-3 w-3" /> Add Line
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderDocumentation = (text) => {
    if (!text) return null;
    if (prevPrescriptionRef.current !== text) { prevPrescriptionRef.current = text; setEditableSections(null); }
    const sections = editableSections || parseDocumentation(text);
    const demoIdx = sections.findIndex(s => s.category === 'Patient Demographics');
    const medicalSections = sections.filter((_, i) => i !== demoIdx && sections[i]?.category !== 'Plan of Action');
    const patientSection = demoIdx >= 0 ? sections[demoIdx] : null;

    return (
      <div className="space-y-3">
        {patientSection && renderSection(patientSection, demoIdx, CATEGORY_CONFIG['Patient Demographics'])}

        {patientSection && medicalSections.length > 0 && (
          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#EC2F8C]/30 to-transparent" />
            <span className="text-xs font-semibold text-[#EC2F8C] tracking-widest uppercase px-1">Medical Documentation</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#EC2F8C]/30 to-transparent" />
          </div>
        )}

        {medicalSections.map((section, relIdx) => {
          const sectionIdx = sections.indexOf(section);
          const cfg = CATEGORY_CONFIG[section.category] || DEFAULT_CFG;
          return <div key={relIdx}>{renderSection(section, sectionIdx, cfg)}</div>;
        })}
      </div>
    );
  };

  return (
    <>
      {isZoomed && <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={() => setIsZoomed(false)} />}

      <div className={`flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 z-50
        ${isZoomed ? 'fixed inset-2 sm:inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[90vw] md:max-w-3xl md:max-h-[90vh]' : 'h-full'}`}>

        {isZoomed && (
          <button onClick={() => setIsZoomed(false)}
            className="absolute top-3 right-3 z-50 w-8 h-8 bg-white/90 hover:bg-white rounded-full shadow-md flex items-center justify-center transition-colors">
            <X className="h-4 w-4 text-gray-600" />
          </button>
        )}

        {/* Header */}
        <div className="bg-gradient-to-r from-[#03443F] to-[#27F5E4] px-4 py-3 flex-shrink-0">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="h-4 w-4 text-white" />
            </div>
            Medical Documentation
          </h3>
        </div>

        {/* Action bar */}
        <div className="px-3 sm:px-4 py-2.5 border-b border-gray-100 bg-gray-50/80 flex-shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => { setIsEditingPrescription(!isEditingPrescription); if (isEditingPrescription) setEditingSections({}); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-lg transition-colors shadow-sm">
              {isEditingPrescription ? <><Save className="h-3.5 w-3.5 text-green-600" /><span className="text-green-700">Save</span></> : <><Edit className="h-3.5 w-3.5 text-gray-500" /><span className="text-gray-600">Edit</span></>}
            </button>

            <button onClick={generatePrescription} disabled={isGenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-[#E15CFF] to-[#EC2F8C] hover:from-[#c94de6] hover:to-[#d4267a] text-white rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
              <Sparkles className="h-3.5 w-3.5" />
              {isGenerating ? 'Generating...' : 'Generate'}
            </button>

            <button onClick={handleFinalize} disabled={!prescription || isFinalizing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
              <CheckCircle className="h-3.5 w-3.5" />
              {isFinalizing ? 'Finalizing...' : 'Finalize'}
            </button>

            {isFinalized && (
              <button onClick={exportPDF} disabled={isExporting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#EC2F8C] hover:bg-[#d4267a] text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 ml-auto">
                <Download className="h-3.5 w-3.5" />
                {isExporting ? 'Exporting...' : 'Save PDF'}
              </button>
            )}

            {sessionIdRef && wsRef && (
              <div className={isFinalized ? '' : 'ml-auto'}>
                <FeedbackControls sessionIdRef={sessionIdRef} wsRef={wsRef} user={user} panelName="documentation" />
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div ref={summaryRef} className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-0">
          {!prescription ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center px-4">
              <div className="w-14 h-14 bg-teal-50 rounded-2xl flex items-center justify-center mb-3">
                <Sparkles className="h-7 w-7 text-teal-300" />
              </div>
              <p className="text-sm font-medium text-gray-500">No documentation yet</p>
              <p className="text-xs text-gray-400 mt-1">Click "Generate" to create medical documentation from the transcript</p>
            </div>
          ) : renderDocumentation(prescription)}
        </div>
      </div>
    </>
  );
};

export default DocumentationPanel;
