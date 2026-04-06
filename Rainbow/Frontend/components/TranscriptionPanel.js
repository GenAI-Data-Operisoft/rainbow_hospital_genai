'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Copy, Edit, Save, Wifi, WifiOff, Radio } from 'lucide-react';
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
  highlightRange,
}) => {
  const [highlightedMessages, setHighlightedMessages] = useState([]);
  const messageRefs = useRef([]);
  const scrollContainerRef = useRef(null);
  const isUserScrolledUp = useRef(false);

  // Auto-scroll to bottom when new messages arrive, unless user scrolled up
  useEffect(() => {
    if (!isUserScrolledUp.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Track if user manually scrolled up
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isUserScrolledUp.current = distanceFromBottom > 80;
  };

  const rebuildTranscript = (msgs) => {
    const t = msgs.map(m => m.text).join(' ');
    setTranscript(t);
    return t;
  };

  const handleSave = async () => {
    rebuildTranscript(messages);
    setIsEditingTranscript(false);
    if (onTranscriptEditComplete) await onTranscriptEditComplete();
  };

  const handleMessageEdit = (index, newText) => {
    const updated = [...messages];
    updated[index].text = newText;
    setMessages(updated);
    rebuildTranscript(updated);
  };

  const findMatchingMessages = (startIndex, endIndex) => {
    if (!transcript || !messages.length) return [];
    const result = [];
    let pos = 0;
    messages.forEach((msg, i) => {
      const start = pos, end = pos + msg.text.length;
      if (startIndex < end && endIndex > start) result.push(i);
      pos = end + 1;
    });
    return result;
  };

  useEffect(() => {
    if (!highlightRange) return;
    const matched = findMatchingMessages(highlightRange.startIndex, highlightRange.endIndex);
    setHighlightedMessages(matched);
    if (matched.length > 0 && messageRefs.current[matched[0]]) {
      messageRefs.current[matched[0]].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    const t = setTimeout(() => setHighlightedMessages([]), 5000);
    return () => clearTimeout(t);
  }, [highlightRange, messages, transcript]);

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#7B2FBE] to-[#C026D3] px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Mic className="h-4 w-4 text-white" />
            </div>
            Live Transcription
          </h3>
          <div className="flex items-center gap-2 text-xs text-white/80">
            <span className="flex items-center gap-1">
              {connectionStatus === 'connected'
                ? <Wifi className="h-3 w-3 text-green-300" />
                : <WifiOff className="h-3 w-3 text-red-300" />}
              <span className="hidden sm:inline">
                {connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
              </span>
            </span>
            <span className="text-white/40">|</span>
            <span className="flex items-center gap-1">
              <Radio className={`h-3 w-3 ${sessionActive ? 'text-green-300 animate-pulse' : 'text-white/40'}`} />
              <span className="hidden sm:inline">{sessionActive ? 'Active' : 'No Session'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/80 flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => isEditingTranscript ? handleSave() : setIsEditingTranscript(true)}
          disabled={!sessionActive && isEmpty}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-lg transition-colors shadow-sm disabled:opacity-40"
        >
          {isEditingTranscript ? <><Save className="h-3.5 w-3.5 text-green-600" /><span className="text-green-700">Save</span></> : <><Edit className="h-3.5 w-3.5 text-gray-500" /><span className="text-gray-600">Edit</span></>}
        </button>
        <button
          onClick={copyTranscript}
          disabled={isEmpty}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-lg transition-colors shadow-sm disabled:opacity-40 text-gray-600"
        >
          <Copy className="h-3.5 w-3.5" /> Copy
        </button>
        <FeedbackControls sessionIdRef={sessionIdRef} wsRef={wsRef} user={user} panelName="transcription" />
      </div>

      {/* Content */}
      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-0">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center px-4">
            <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center mb-3">
              <Mic className="h-7 w-7 text-purple-300" />
            </div>
            <p className="text-sm font-medium text-gray-500">
              {connectionStatus === 'connected' ? 'Start recording to see live transcription' : 'Connecting to transcription service...'}
            </p>
            {connectionStatus === 'disconnected' && (
              <p className="text-xs text-red-400 mt-1">Check if the backend server is running.</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((message, index) => {
              const isHighlighted = highlightedMessages.includes(index);
              const isSelected = highlightedMessageIndex === index;
              return (
                <div
                  key={index}
                  ref={el => messageRefs.current[index] = el}
                  onClick={() => !isEditingTranscript && highlightMessage(index)}
                  className={`rounded-xl border-l-4 transition-all cursor-pointer px-3 py-2.5 ${
                    isHighlighted
                      ? 'bg-yellow-50 border-l-yellow-400 border border-yellow-200 shadow-sm'
                      : isSelected
                        ? 'bg-blue-50 border-l-blue-400 border border-blue-200'
                        : 'bg-white border-l-purple-300 border border-gray-200 hover:border-l-purple-500 hover:bg-gray-50'
                  }`}
                >
                  {isEditingTranscript ? (
                    <div>
                      <textarea
                        value={message.text}
                        onChange={(e) => handleMessageEdit(index, e.target.value)}
                        className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none font-sans"
                        rows={3}
                      />
                      <p className="text-xs text-gray-400 mt-1">{message.time}</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-800 leading-relaxed">{message.text}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-400">{message.time}</span>
                        {isHighlighted && (
                          <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full font-medium">Matched</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TranscriptionPanel;
