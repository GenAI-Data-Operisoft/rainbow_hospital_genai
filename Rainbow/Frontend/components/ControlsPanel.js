'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, Square, Trash2, Wifi, WifiOff, Radio,
  Loader2, AlertCircle, ScrollText, BarChart3, ChevronDown
} from 'lucide-react';

const ControlsPanel = ({
  isRecording,
  selectedModel,
  toggleRecording,
  handleFileUpload,
  clearAll,
  setSelectedModel,
  fileInputRef,
  connectionStatus,
  sessionActive,
  vadEnabled,
  speechInProgress,
  isEndingSession,
  transcript,
  scrollToEvaluation,
  growthData,
  onOpenGrowthChart,
  onPatientDataFetched
}) => {
  const [localEndingSession, setLocalEndingSession] = useState(false);
  const [waitingForSessionEnd, setWaitingForSessionEnd] = useState(false);
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [mrnInput, setMrnInput] = useState('');
  const [mrnLoading, setMrnLoading] = useState(false);
  const [mrnStatus, setMrnStatus] = useState(null); // 'success' | 'error' | null

  const handleMrnFetch = async () => {
    if (!mrnInput.trim()) return;
    setMrnLoading(true);
    setMrnStatus(null);
    try {
      const res = await fetch('/api/patient-visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mrn: mrnInput.trim() }),
      });
      const data = await res.json();
      if (res.ok && data) {
        setMrnStatus('success');
        if (onPatientDataFetched) onPatientDataFetched(data);
      } else {
        setMrnStatus('error');
      }
    } catch (e) {
      console.error('MRN fetch error:', e);
      setMrnStatus('error');
    } finally {
      setMrnLoading(false);
    }
  };

  const handleMrnKeyDown = (e) => {
    if (e.key === 'Enter') handleMrnFetch();
  };

  const inactivityTimer = useRef(null);
  const lastActivityTime = useRef(Date.now());

  const handleEndSession = async () => {
    setLocalEndingSession(true);
    setWaitingForSessionEnd(true);
    try { await clearAll(); } catch (e) { console.error(e); } finally {
      setLocalEndingSession(false);
      setShowInactivityWarning(false);
    }
  };

  const resetInactivityTimer = () => {
    lastActivityTime.current = Date.now();
    setShowInactivityWarning(false);
  };

  useEffect(() => {
    if (!sessionActive) return;
    inactivityTimer.current = setInterval(() => {
      const diff = (Date.now() - lastActivityTime.current) / (1000 * 60);
      if (sessionActive && !isRecording && diff >= 5 && !showInactivityWarning) setShowInactivityWarning(true);
    }, 30000);
    return () => clearInterval(inactivityTimer.current);
  }, [sessionActive, isRecording, showInactivityWarning]);

  useEffect(() => { resetInactivityTimer(); }, [isRecording, transcript]);
  useEffect(() => { if (!sessionActive) setWaitingForSessionEnd(false); }, [sessionActive]);

  const isActuallyEnding = localEndingSession || isEndingSession;
  const isTransitioning = isActuallyEnding || waitingForSessionEnd;

  const connectedColor = connectionStatus === 'connected' ? 'text-green-500' : 'text-red-500';
  const connectedLabel = connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected';

  return (
    <div className="relative bg-white border-b border-gray-200 shadow-sm">
      <div className="px-4 sm:px-6 py-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">

          {/* Model Select */}
          <div className="relative">
            <select
              value={selectedModel}
              onChange={(e) => { setSelectedModel(e.target.value); resetInactivityTimer(); }}
              disabled={isTransitioning}
              className="appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 font-medium cursor-pointer"
            >
              <option value="claude-sonnet3.5v2">Claude 3.5 Sonnet v2</option>
              <option value="claude-haiku3">Claude 3 Haiku</option>
              <option value="nova-lite">Nova Lite</option>
              <option value="nova-micro">Nova Micro</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Record Button */}
          <button
            onClick={() => { toggleRecording(); resetInactivityTimer(); }}
            disabled={isTransitioning}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
              isRecording
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white'
            }`}
          >
            {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {isRecording ? 'Stop' : 'Start'}
            {isRecording && <span className="w-2 h-2 bg-white rounded-full animate-pulse" />}
          </button>

          {/* Hidden file input */}
          <input ref={fileInputRef} type="file" accept=".mp3,.wav,.m4a,.flac,.ogg,.webm"
            onChange={(e) => { handleFileUpload(e); resetInactivityTimer(); }}
            disabled={isTransitioning} className="hidden" />

          {/* End Session */}
          <button
            onClick={handleEndSession}
            disabled={isTransitioning}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm ${
              isTransitioning ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-800 text-white'
            }`}
          >
            {isTransitioning ? <><Loader2 className="h-4 w-4 animate-spin" />Ending...</> : <><Trash2 className="h-4 w-4" />End Session</>}
          </button>

          {/* Divider */}
          <div className="hidden sm:block w-px h-6 bg-gray-200" />

          {/* Connection Status */}
          <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-600">
            <span className="flex items-center gap-1.5">
              {connectionStatus === 'connected'
                ? <Wifi className="h-3.5 w-3.5 text-green-500" />
                : <WifiOff className="h-3.5 w-3.5 text-red-500" />}
              <span className="hidden sm:inline">{connectedLabel}</span>
            </span>
            <span className="text-gray-300">|</span>
            <span className="flex items-center gap-1.5">
              <Radio className={`h-3.5 w-3.5 ${sessionActive ? 'text-green-500 animate-pulse' : 'text-gray-400'}`} />
              <span className="hidden sm:inline">{sessionActive ? 'Active' : 'No Session'}</span>
            </span>
          </div>

          {/* Growth Chart */}
          <button
            onClick={() => { if (onOpenGrowthChart) onOpenGrowthChart(); resetInactivityTimer(); }}
            disabled={!growthData}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm ${
              growthData ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
            title={growthData ? 'View WHO Growth Charts' : 'Generate prescription first'}
          >
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Growth Chart</span>
            {growthData && <span className="w-2 h-2 bg-green-300 rounded-full" />}
          </button>

          {/* Evaluation */}
          <button
            onClick={() => { scrollToEvaluation(); resetInactivityTimer(); }}
            disabled={!sessionActive || isTransitioning}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm ${
              !sessionActive || isTransitioning ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            <ScrollText className="h-4 w-4" />
            <span className="hidden sm:inline">Evaluation</span>
          </button>

          {/* Divider */}
          <div className="hidden sm:block w-px h-6 bg-gray-200" />

          {/* MRN Input */}
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={mrnInput}
              onChange={(e) => { setMrnInput(e.target.value); setMrnStatus(null); }}
              onKeyDown={handleMrnKeyDown}
              placeholder="Enter MRN"
              disabled={mrnLoading}
              className={`w-36 px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent disabled:opacity-50 ${
                mrnStatus === 'success' ? 'border-green-400 bg-green-50' : mrnStatus === 'error' ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'
              }`}
            />
            <button
              onClick={handleMrnFetch}
              disabled={mrnLoading || !mrnInput.trim()}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mrnLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Fetch'}
            </button>
          </div>
        </div>

        {/* Session note */}
        {sessionActive && !isTransitioning && (
          <div className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
            <span>Please end the session to save data correctly.</span>
          </div>
        )}

        {isTransitioning && (
          <div className="mt-2 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            Ending session and preparing a new one...
          </div>
        )}
      </div>

      {/* Inactivity Warning Modal */}
      {showInactivityWarning && (
        <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/10 backdrop-blur-sm rounded-b-xl">
          <div className="bg-white p-5 rounded-2xl shadow-2xl w-[90%] max-w-sm border border-gray-200">
            <h3 className="text-base font-semibold text-gray-800 mb-1">Session Inactive</h3>
            <p className="text-sm text-gray-500 mb-4">No recording detected for 5 minutes. Would you like to end this session?</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { resetInactivityTimer(); setShowInactivityWarning(false); }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium text-gray-700 transition-colors">
                Continue
              </button>
              <button onClick={handleEndSession}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-colors">
                End Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ControlsPanel;
