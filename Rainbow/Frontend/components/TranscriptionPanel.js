// Enhanced TranscriptionPanel.js with message box highlighting functionality
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Copy, Edit, Save, Wifi, WifiOff, Radio, AlertCircle } from 'lucide-react';
import FeedbackControls from './FeedbackControls';

const TranscriptionPanel = ({
  messages,
  transcript,
  setTranscript,
  setMessages,
  isEditingTranscript,
  setIsEditingTranscript,
  copyTranscript,
  highlightedMessageIndex,
  highlightMessage,
  connectionStatus,
  sessionActive,
  onTranscriptEditComplete,
  sessionIdRef,
  sessionId,
  wsRef,
  user,
  // New props for category highlighting
  highlightRange,
  highlightMessage: highlightNotification
}) => {
  const [localHighlight, setLocalHighlight] = useState(null);
  const [highlightedMessages, setHighlightedMessages] = useState([]);
  const transcriptRef = useRef(null);
  const messageRefs = useRef([]);

  // Function to rebuild transcript from messages
  const rebuildTranscriptFromMessages = (updatedMessages) => {
    const newTranscript = updatedMessages.map(msg => msg.text).join(' ');
    setTranscript(newTranscript);
    return newTranscript;
  };

  // Save edited transcript
  const handleSave = async () => {
    rebuildTranscriptFromMessages(messages);
    setIsEditingTranscript(false);

    if (onTranscriptEditComplete) {
      await onTranscriptEditComplete();
    }
  };

  // Handle individual message edit
  const handleMessageEdit = (index, newText) => {
    const updated = [...messages];
    updated[index].text = newText;
    setMessages(updated);
    rebuildTranscriptFromMessages(updated);
  };

  // Create highlighted text component
  const HighlightedText = ({ text, startIndex, endIndex }) => {
    if (!startIndex && startIndex !== 0) return <span>{text}</span>;

    const beforeHighlight = text.substring(0, startIndex);
    const highlightedText = text.substring(startIndex, endIndex);
    const afterHighlight = text.substring(endIndex);

    return (
      <span>
        {beforeHighlight}
        <span 
          className="bg-yellow-200 border border-yellow-400 rounded px-1 animate-pulse"
          style={{ animationDuration: '2s', animationIterationCount: '3' }}
        >
          {highlightedText}
        </span>
        {afterHighlight}
      </span>
    );
  };

  // Find which messages contain the highlighted segment
  const findMatchingMessages = (startIndex, endIndex, segment) => {
    if (!transcript || !messages.length) return [];
    
    const matchingMessages = [];
    let currentPosition = 0;
    
    // Find which messages contain the highlighted text
    messages.forEach((message, index) => {
      const messageStart = currentPosition;
      const messageEnd = currentPosition + message.text.length;
      
      // Check if the highlight overlaps with this message
      if (startIndex < messageEnd && endIndex > messageStart) {
        matchingMessages.push(index);
      }
      
      currentPosition = messageEnd + 1; // +1 for the space between messages
    });
    
    return matchingMessages;
  };

  // Handle highlight updates
  useEffect(() => {
    if (highlightRange) {
      setLocalHighlight({
        startIndex: highlightRange.startIndex,
        endIndex: highlightRange.endIndex,
        segment: highlightRange.segment
      });

      // Find which messages to highlight
      const matchingMessageIndices = findMatchingMessages(
        highlightRange.startIndex, 
        highlightRange.endIndex, 
        highlightRange.segment
      );
      
      setHighlightedMessages(matchingMessageIndices);

      // Scroll to the first highlighted message if available
      if (matchingMessageIndices.length > 0 && messageRefs.current[matchingMessageIndices[0]]) {
        messageRefs.current[matchingMessageIndices[0]].scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }

      // Clear highlight after 5 seconds
      const timer = setTimeout(() => {
        setLocalHighlight(null);
        setHighlightedMessages([]);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [highlightRange, messages, transcript]);

  // Render transcript with highlighting
  const renderTranscriptContent = () => {
    if (messages.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 text-center">
          <Mic className="h-12 w-12 mb-3 text-[#8E3B7A]/50" />
          <p className="text-sm">
            {connectionStatus === 'connected'
              ? 'Start recording to see live transcription...'
              : 'Connecting to transcription service...'}
          </p>
          {connectionStatus === 'disconnected' && (
            <p className="text-xs mt-2 text-red-500">
              Unable to connect. Please check if the backend server is running.
            </p>
          )}
        </div>
      );
    }

    // If editing, show editable messages
    if (isEditingTranscript) {
      return (
        <div className="space-y-3">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg transition-all ${
                highlightedMessages.includes(index)
                  ? 'bg-yellow-100 border-2 border-yellow-400 animate-pulse'
                  : 'bg-white border border-gray-200'
              }`}
            >
              <textarea
                value={message.text}
                onChange={(e) => handleMessageEdit(index, e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
                rows={3}
              />
              <div className="text-xs text-gray-400 mt-1 flex justify-between">
                <span>{message.time}</span>
              </div>
            </div>
          ))}
        </div>
      );
    }

    // For read-only view with full transcript highlighting
    return (
      <div className="space-y-4">
        {/* Full transcript view for highlighting */}
        {/* <div 
          ref={transcriptRef}
          className="p-4 bg-gray-50 border border-gray-200 rounded-lg"
        >
          <div className="text-xs text-gray-500 mb-2 font-medium">Full Transcript:</div>
          <div className="text-sm text-gray-800 leading-relaxed">
            {localHighlight ? (
              <HighlightedText 
                text={transcript}
                startIndex={localHighlight.startIndex}
                endIndex={localHighlight.endIndex}
              />
            ) : (
              transcript
            )}
          </div>
        </div> */}

        {/* Individual messages */}
        <div className="space-y-3">
          <div className="text-xs text-gray-500 font-medium">Message History:</div>
          {messages.map((message, index) => (
            <div
              key={index}
              ref={el => messageRefs.current[index] = el}
              onClick={() => !isEditingTranscript && highlightMessage(index)}
              className={`p-3 rounded-lg transition-all cursor-pointer border-2 ${
                highlightedMessages.includes(index)
                  ? 'bg-yellow-100 border-yellow-400 animate-pulse shadow-md'
                  : highlightedMessageIndex === index
                    ? 'bg-blue-100 border-blue-300'
                    : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-sm text-gray-800 mb-1">{message.text}</div>
              <div className="text-xs text-gray-400 flex justify-between items-center">
                <span>{message.time}</span>
                {highlightedMessages.includes(index) && (
                  <span className="bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full text-xs font-medium">
                    Matched
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="lg:col-span-4 bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-col">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-[#E15CFF] to-[#8500A3] px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <div className="w-6 h-6 bg-white/20 rounded flex items-center justify-center">
              <Mic className="h-4 w-4 text-white" />
            </div>
            Live Transcription
            {/* {localHighlight && (
              <div className="ml-2 text-xs bg-yellow-400/20 text-white px-2 py-1 rounded-full animate-pulse flex items-center gap-1">
                <span>•</span>
                <span>Highlighting {highlightedMessages.length} message(s)</span>
              </div>
            )} */}
          </h3>

          {/* Connection Status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-white/90 text-xs">
              {connectionStatus === 'connected' ? (
                <Wifi className="h-3 w-3 text-green-300" />
              ) : (
                <WifiOff className="h-3 w-3 text-red-300" />
              )}
              <span className="hidden sm:inline">
                {connectionStatus === 'connected'
                  ? 'Connected'
                  : connectionStatus === 'connecting'
                    ? 'Connecting...'
                    : 'Disconnected'}
              </span>
            </div>
            <div className="flex items-center gap-1 text-white/90 text-xs">
              {sessionActive ? (
                <Radio className="h-3 w-3 text-green-300 animate-pulse" />
              ) : (
                <Radio className="h-3 w-3 text-gray-300" />
              )}
              <span className="hidden sm:inline">
                {sessionActive ? 'Session Active' : 'No Session'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Show highlight notification if provided */}
        {/* {highlightNotification && (
          <div className="mb-3 p-2 bg-orange-50 border border-orange-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            <span className="text-sm text-orange-700">{highlightNotification}</span>
          </div>
        )} */}

        {/* BUTTONS + FEEDBACK */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => {
              if (isEditingTranscript) {
                handleSave();
              } else {
                setIsEditingTranscript(true);
              }
            }}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            disabled={!sessionActive && messages.length === 0}
          >
            {isEditingTranscript ? <Save className="h-3 w-3" /> : <Edit className="h-3 w-3" />}
            {isEditingTranscript ? 'Save' : 'Edit'}
          </button>

          <button
            onClick={copyTranscript}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            disabled={messages.length === 0}
          >
            <Copy className="h-3 w-3" />
            Copy
          </button>

          {/* Feedback Controls */}
          <FeedbackControls
            sessionIdRef={sessionIdRef}
            wsRef={wsRef}
            user={user}
            panelName="transcription"
          />
        </div>

        {/* TRANSCRIPTION BOX */}
        <div
          className="border-2 border-[#8E3B7A]/30 rounded-xl p-6 overflow-auto bg-gray-50 flex-1 
             min-h-[500px] max-h-[600px]"
        >
          {renderTranscriptContent()}
        </div>
      </div>
    </div>
  );
};

export default TranscriptionPanel;