//ControlsPanel.js
'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, Square, Upload, Trash2, Wifi, WifiOff, Radio, Loader2, AlertCircle, ScrollText, BarChart3
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
  onOpenGrowthChart // NEW: callback to open modal
}) => {
  const [localEndingSession, setLocalEndingSession] = useState(false);
  const [waitingForSessionEnd, setWaitingForSessionEnd] = useState(false);
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);

  const inactivityTimer = useRef(null);
  const lastActivityTime = useRef(Date.now());

  const handleEndSession = async () => {
    setLocalEndingSession(true);
    setWaitingForSessionEnd(true);
    try {
      await clearAll();
    } catch (error) {
      console.error('Error ending session:', error);
    } finally {
      setLocalEndingSession(false);
      setShowInactivityWarning(false); // close popup if open
    }
  };

  // ✅ Reset inactivity timer on user activity
  const resetInactivityTimer = () => {
    lastActivityTime.current = Date.now();
    setShowInactivityWarning(false);
  };

  // ✅ Continue Session handler
  const handleContinueSession = () => {
    resetInactivityTimer();
    setShowInactivityWarning(false);

    // If recording was active, it should continue working
    // If not recording, user needs to click Start to record
    if (isRecording) {
      console.log('Session continued - recording still active');
    } else {
      console.log('Session continued - click Start to resume recording');
    }
  };

  // ✅ Monitor inactivity safely
  useEffect(() => {
    if (!sessionActive) return;

    inactivityTimer.current = setInterval(() => {
      const now = Date.now();
      const diffMinutes = (now - lastActivityTime.current) / (1000 * 60);

      // Only show warning if session is active and user idle for >= 1 min
      if (sessionActive && !isRecording && diffMinutes >= 5) {
        if (!showInactivityWarning) setShowInactivityWarning(true);
      }
    }, 30 * 1000); // check every 30 seconds

    return () => clearInterval(inactivityTimer.current);
  }, [sessionActive, isRecording, showInactivityWarning]);

  // ✅ Reset timer when recording or transcript updates
  useEffect(() => {
    resetInactivityTimer();
  }, [isRecording, transcript]);

  // ✅ Re-enable start when session fully ends
  useEffect(() => {
    if (!sessionActive) {
      setWaitingForSessionEnd(false);
    }
  }, [sessionActive]);

  const isActuallyEnding = localEndingSession || isEndingSession;
  const isTransitioning = isActuallyEnding || waitingForSessionEnd;

  return (
    <div className="relative bg-white border-b border-gray-200 p-4">
      <div className="w-full px-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Model Selection */}
          <select
            value={selectedModel}
            onChange={(e) => {
              setSelectedModel(e.target.value);
              resetInactivityTimer();
            }}
            disabled={isTransitioning}
            className={`px-3 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm ${isTransitioning ? 'opacity-50 cursor-not-allowed' : ''
              }`}
          >
            <option value="claude-sonnet3.5v2">Claude 3.5 Sonnet v2</option>
            <option value="claude-haiku3">Claude 3 Haiku</option>
            <option value="nova-lite">Nova Lite</option>
            <option value="nova-micro">Nova Micro</option>
          </select>

          {/* Recording Button */}
          <button
            onClick={() => { toggleRecording(); resetInactivityTimer(); }}
            disabled={isTransitioning}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${isRecording
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white'
              } ${isTransitioning ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {isRecording ? 'Stop' : 'Start'}
          </button>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,.wav,.m4a,.flac,.ogg,.webm"
            onChange={(e) => { handleFileUpload(e); resetInactivityTimer(); }}
            disabled={isTransitioning}
            className="hidden"
          />

          {/* End Session Button */}
          <button
            onClick={handleEndSession}
            disabled={isTransitioning}
            className={`flex items-center gap-2 px-4 py-2 ${isTransitioning
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gray-600 hover:bg-gray-700'
              } text-white rounded-xl text-sm font-medium transition-colors`}
          >
            {isTransitioning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Please Wait...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                End Session
              </>
            )}
          </button>

          {/* Connection Status */}
          <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-xl text-sm">
            <div className="flex items-center gap-1">
              {connectionStatus === 'connected' ? (
                <Wifi className="h-3 w-3 text-green-500" />
              ) : (
                <WifiOff className="h-3 w-3 text-red-500" />
              )}
              <span>
                {connectionStatus === 'connected' ? 'Connected' :
                  connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
              </span>
            </div>

            <div className="flex items-center gap-1">
              {sessionActive ? (
                <Radio className="h-3 w-3 text-green-500 animate-pulse" />
              ) : (
                <Radio className="h-3 w-3 text-gray-500" />
              )}
              <span>
                {sessionActive ? 'Session Active' : 'No Session'}
              </span>
            </div>
          </div>

          {/* Graph Button */}
          <button
            onClick={() => { 
              console.log('📊 Opening growth chart modal with data:', growthData);
              if (onOpenGrowthChart) {
                onOpenGrowthChart();
              }
              resetInactivityTimer(); 
            }}
            disabled={!growthData}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              growthData
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            title={growthData ? 'View WHO Growth Charts' : 'Generate prescription first to extract growth data'}
          >
            <BarChart3 className="h-4 w-4" />
            Graph {growthData && '✓'}
          </button>

          {/* Go to Evaluation Button */}
          <button
            onClick={() => { scrollToEvaluation(); resetInactivityTimer(); }}
            disabled={!sessionActive || isTransitioning}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${!sessionActive || isTransitioning
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700 text-white shadow-md'
              }`}
          >
            <ScrollText className="h-4 w-4" />
            Go to Evaluation
          </button>

          {/* Recording Indicator */}
          {isRecording && (
            <div className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-800 rounded-xl text-sm">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              Recording
            </div>
          )}
        </div>

        {/* Note */}
        {sessionActive && !isTransitioning && (
          <div className="mt-1 p-1 bg-amber-50 border border-amber-300 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-3 w-3 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-amber-800 font-medium text-sm">
                  <span className="font-semibold">Note:</span> Please end the session to save the data correctly.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Saving / Transition Message */}
        {isTransitioning && (
          <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-center gap-2 text-blue-700">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="font-medium text-base">
                Please wait as we are ending the session and creating a new one...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 🟡 Inactivity Warning Modal */}
      {showInactivityWarning && (
        <div className="absolute inset-0 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl shadow-2xl w-[90%] max-w-md border-2 border-gray-300">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Session Inactivity Detected
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              No voice recording detected for the past 1 minute. Would you like to end this session?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={handleContinueSession}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-xl text-sm font-medium"
              >
                Continue Session
              </button>
              <button
                onClick={handleEndSession}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium"
              >
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
