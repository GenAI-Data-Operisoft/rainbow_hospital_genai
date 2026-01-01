//MedicalTranscriptionSystem.js
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import GlobalHeader from './GlobalHeader';
import ControlsPanel from './ControlsPanel';
import TranscriptionPanel from './TranscriptionPanel';
import DocumentationPanel from './DocumentationPanel';
import CategoriesPanel from './CategoriesPanel';
import EvaluationPanel from './EvaluationPanel';
import { Loader2, Wifi, WifiOff, Radio, Mic, MicOff } from 'lucide-react';

const MedicalTranscriptionSystem = ({ user }) => {
  // State management
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState([]);
  const [transcript, setTranscript] = useState('');
  const [prescription, setPrescription] = useState('');
  const [metadata, setMetadata] = useState(null);
  const [highlightedMessageIndex, setHighlightedMessageIndex] = useState(null);
  const [selectedModel, setSelectedModel] = useState('nova-lite');
  const [selectedContext, setSelectedContext] = useState('Generic');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isFinalized, setIsFinalized] = useState(false);
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [isEditingPrescription, setIsEditingPrescription] = useState(false);
  const [isEditingCategories, setIsEditingCategories] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [categories, setCategories] = useState(null);
  const [vadEnabled, setVadEnabled] = useState(false);
  const [speechInProgress, setSpeechInProgress] = useState(false);
  const [vadStats, setVadStats] = useState(null);
  const [diarizationResults, setDiarizationResults] = useState(null);
  const [patientDemographics, setPatientDemographics] = useState({}); // ADDED: Patient demographics state

  const [isEndingSession, setIsEndingSession] = useState(false);

  // NEW: State for category-to-transcript highlighting
  const [transcriptHighlight, setTranscriptHighlight] = useState(null);
  const [highlightNotification, setHighlightNotification] = useState(null);

  // NEW: State for evaluation results
  const [evaluationResult, setEvaluationResult] = useState(null);

  const [isCleared, setIsCleared] = useState(false);

  // Refs
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const sessionIdRef = useRef(null);
  const maxReconnectAttempts = 5;
  const evaluationRef = useRef(null);


  const getDisplayUsername = () => {
    return (
      user?.['cognito:username'] ||
      user?.username ||
      user?.name ||
      user?.email ||
      'UnknownUser'
    );
  };

  const scrollToEvaluation = () => {
    if (evaluationRef.current) {
      evaluationRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // NEW: Function to handle transcript highlighting from category clicks
  const handleHighlightTranscript = useCallback((startIndex, endIndex, segment, notificationMessage = null) => {
    console.log('Highlighting transcript:', { startIndex, endIndex, segment });

    if (startIndex !== null && endIndex !== null && segment) {
      setTranscriptHighlight({
        startIndex,
        endIndex,
        segment
      });
      setHighlightNotification(null);
    } else if (notificationMessage) {
      // Show notification for no matches found
      setTranscriptHighlight(null);
      setHighlightNotification(notificationMessage);

      // Clear notification after 3 seconds
      setTimeout(() => {
        setHighlightNotification(null);
      }, 3000);
    } else {
      // Clear highlighting
      setTranscriptHighlight(null);
      setHighlightNotification(null);
    }
  }, []);

  // Add debugging function to track transcript changes
  const debugTranscriptFlow = () => {
    console.log('=== TRANSCRIPT DEBUG INFO ===');
    console.log('Current transcript state:', transcript.substring(0, 200) + '...');
    console.log('Transcript length:', transcript.length);
    console.log('Session ID:', sessionIdRef.current);
    console.log('Session active:', sessionActive);
    console.log('Messages count:', messages.length);
    console.log('VAD enabled:', vadEnabled);
    console.log('Speech in progress:', speechInProgress);
    console.log('==============================');
  };


  useEffect(() => {
    const handleBeforeUnload = (event) => {
      // Check if there are unsaved changes (active session, recording, or transcript)
      const hasUnsavedChanges = sessionActive || isRecording || (transcript && transcript.trim().length > 0);

      if (hasUnsavedChanges && !isEndingSession) {
        event.preventDefault();
        event.returnValue = 'Are you sure you want to Save Changes?';
        return 'Are you sure you want to Save Changes?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [sessionActive, isRecording, transcript, isEndingSession]);


  // WebSocket connection with improved error handling
  const connectWebSocket = useCallback(() => {
    // Clear any existing timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Don't reconnect if we've exceeded max attempts
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      setConnectionStatus('error');
      return;
    }

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8765';
    console.log('Connecting to WebSocket:', wsUrl);
    setConnectionStatus('connecting');

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected successfully');
        setConnectionStatus('connected');
        reconnectAttempts.current = 0;
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error, event.data);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setConnectionStatus('disconnected');
        setSessionActive(false);
        setSessionId(null);
        sessionIdRef.current = null;
        // Reset VAD state on disconnect
        setVadEnabled(false);
        setSpeechInProgress(false);
        setVadStats(null);

        // Only reconnect if the closure was unexpected and we haven't exceeded max attempts
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          console.log(`WebSocket closed unexpectedly, reconnecting... (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
          reconnectAttempts.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, delay);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('error');
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setConnectionStatus('error');
      if (reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, delay);
      }
    }
  }, []);

  const handleWebSocketMessage = useCallback((data) => {
    // ✅ IMPORTANT: Only ignore messages if we're actively clearing AND it's not a session_started message
    if (isCleared && data.type !== 'session_started') {
      console.log("Ignoring WS message after clear:", data.type);
      return; // 🚫 ignore updates during cleanup
    }

    console.log('Received WebSocket message:', data);

    switch (data.type) {
      // 🎙️ Session start
      case 'session_started':
        setIsCleared(false); // ✅ Clear the flag when new session starts
        setSessionId(data.session_id);
        sessionIdRef.current = data.session_id;
        setSessionActive(true);

        if (data.vad_enabled) {
          setVadEnabled(true);
          console.log('VAD enabled for session:', data.session_id);
        }
        console.log('Session started:', data.session_id);
        break;

      // 🎧 Voice Activity Detection (VAD)
      case 'vad_event':
        console.log('VAD event:', data.event, data.timestamp);
        if (data.event === 'speech_start') {
          setSpeechInProgress(true);
        } else if (data.event === 'speech_end') {
          setSpeechInProgress(false);
        }
        break;

      // 🎤 Real-time transcription updates
      case 'transcription_update':
        if (data.transcript && data.transcript.trim()) {
          addTranscriptMessage(
            data.transcript,
            data.timestamp || new Date().toLocaleTimeString(),
            data.speaker,
            data.source === 'vad_stream'
          );
          console.log('Transcription update:', data.transcript, 'Speaker:', data.speaker, 'Source:', data.source);
        }
        break;

      // 🧠 Step 1: Summary generated (progressive)
      case 'summary_generated':
        console.log('🧠 Summary received:', data.data);
        setIsGenerating(true);
        setPrescription(data.data.medical_summary);
        setMetadata({
          summary_stats: data.data.summary_stats,
          context: data.data.context,
          ai_model: data.data.ai_model,
        });
        break;

      // 📊 Step 2: Categories generated (progressive)
      case 'categories_generated':
        console.log('📊 Categories received:', data.data);
        setIsAnalyzing(true);
        setCategories(data.data.medical_categories);
        setMetadata((prev) => ({
          ...prev,
          categories_stats: data.data.categories_stats,
        }));
        break;

      // 🩺 Step 3: Evaluation generated (progressive)
      case 'evaluation_generated':
        console.log('🩺 Evaluation received:', data.data);
        setIsFinalizing(true);
        setEvaluationResult(data.data.evaluation_result);

        if (scrollToEvaluation) scrollToEvaluation();

        // Mark completion of all stages
        setTimeout(() => {
          setIsGenerating(false);
          setIsAnalyzing(false);
          setIsFinalizing(false);
          setIsFinalized(true);
        }, 500);
        break;

      // 🧩 Legacy: Combined prescription (old backend support)
      case 'prescription_generated':
        console.log('📜 Final prescription received:', data.data);
        setIsGenerating(false);
        setIsAnalyzing(false);

        if (data.data.medical_summary) {
          setPrescription(data.data.medical_summary);
          setMetadata({
            summary_stats: data.data.summary_stats,
            categories_stats: data.data.categories_stats,
            context: data.data.context,
            ai_model: data.data.ai_model,
            model: data.data.ai_model,
            duration: data.data.summary_stats?.duration_ms || 0,
            tokens: {
              input: data.data.summary_stats?.input_tokens || 0,
              output: data.data.summary_stats?.output_tokens || 0
            }
          });
        }

        if (data.data.medical_categories) {
          setCategories(data.data.medical_categories);
        }

        if (data.data.evaluation_result) {
          setEvaluationResult(data.data.evaluation_result);
          console.log('Evaluation result received:', data.data.evaluation_result);
        }

        setIsFinalized(true);
        break;

      // 🧾 Confirm transcript update
      case 'transcript_updated':
        console.log('Backend confirmed transcript update');
        break;

      // 🏁 Session ended
      case 'session_ended':
        setSessionActive(false);
        setSessionId(null);
        sessionIdRef.current = null;
        setIsRecording(false);
        setVadEnabled(false);
        setSpeechInProgress(false);
        console.log('Session ended with data:', data.data);

        if (data.data && data.data.diarization_results) {
          setDiarizationResults(data.data.diarization_results);
        }

        console.log('Session ended - no auto-display of medical data');
        break;

      // ⚠️ Error handling
      case 'error':
        console.error('WebSocket error:', data.message);
        setIsGenerating(false);
        setIsAnalyzing(false);
        alert('Error: ' + data.message);
        break;

      // ❓ Unknown type
      default:
        console.log('⚠️ Unknown message type:', data.type);
    }
  }, [isCleared, scrollToEvaluation]);


  // Initialize WebSocket on mount
  useEffect(() => {
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
      }
    };
  }, [connectWebSocket]);

  // UPDATED: Add VAD indicator to messages
  const addTranscriptMessage = (text, timestamp, speaker = null, isVadSourced = false) => {
    if (!text) return;

    const safeText = typeof text === 'string' ? text.trim() : JSON.stringify(text, null, 2);
    if (!safeText) return;

    let date;
    if (timestamp) {
      date = new Date(timestamp.endsWith("Z") ? timestamp : timestamp + "Z");
    } else {
      date = new Date();
    }

    const time = date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });

    const message = {
      text: safeText,
      time,
      speaker,
      index: messages.length,
      isVadSourced, // NEW: Track if message came from VAD
    };

    setMessages((prev) => [...prev, message]);
    setTranscript((prev) => (prev ? prev + " " : "") + safeText);
  };

  // Function to manually sync transcript with backend session
  const updateSessionTranscript = async () => {
    if (!sessionIdRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.log('No active session to update');
      return;
    }

    const currentTranscript = transcript.trim();
    if (!currentTranscript) return;

    try {
      // Send update to sync the transcript with backend session
      wsRef.current.send(JSON.stringify({
        type: 'update_transcript',
        session_id: sessionIdRef.current,
        transcript: currentTranscript,
        user_id: user?.id || user?.sub,
        username: getDisplayUsername()
      }));
      console.log('Session transcript updated with backend');
    } catch (error) {
      console.error('Error updating session transcript:', error);
    }
  };

  const startRecording = async () => {
    try {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.error('WebSocket is not connected');
        alert('Not connected to transcription service. Please try again.');
        return;
      }

      console.log('Starting recording process...');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      console.log('Audio stream obtained successfully');

      const audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      audioContextRef.current = audioContext;
      processorRef.current = processor;
      streamRef.current = stream;

      console.log('Audio context and processor set up');

      processor.onaudioprocess = (event) => {
        if (!sessionIdRef.current) {
          console.log('Waiting for session ID before sending audio...');
          return;
        }

        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          console.warn('WebSocket not available for audio transmission');
          return;
        }

        try {
          const inputData = event.inputBuffer.getChannelData(0);
          const pcmData = new Int16Array(inputData.length);

          for (let i = 0; i < inputData.length; i++) {
            const sample = Math.max(-1, Math.min(1, inputData[i]));
            pcmData[i] = Math.round(sample * 32767);
          }

          const uint8Array = new Uint8Array(pcmData.buffer);
          let binaryString = '';
          const chunkSize = 8192;

          for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.subarray(i, i + chunkSize);
            for (let j = 0; j < chunk.length; j++) {
              binaryString += String.fromCharCode(chunk[j]);
            }
          }

          const base64String = btoa(binaryString);

          wsRef.current.send(JSON.stringify({
            type: 'audio_stream',
            session_id: sessionIdRef.current,
            audio_data: base64String,
            format: 'pcm',
            sample_rate: 16000,
            timestamp: Date.now(),
            user_id: user?.id || user?.sub,
            username: getDisplayUsername()
          }));
        } catch (error) {
          console.error('Error processing audio chunk:', error);
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      // ✅ Only start a new session if one doesn't exist
      if (!sessionIdRef.current) {
        console.log('Starting NEW WebSocket session...');
        wsRef.current.send(JSON.stringify({
          type: 'start_session',
          preferred_language: 'en-IN',
          processing_mode: 'translate',
          code_switching_mode: true,
          doctor_known_languages: ['en-IN', 'hi-IN'],
          doctor_profile: {
            specialty: 'General Medicine',
            experience: '5 years'
          },
          context: selectedContext,
          user_id: user?.id || user?.sub,
          username: getDisplayUsername()
        }));
      } else {
        console.log('Resuming recording with EXISTING session:', sessionIdRef.current);
      }

      setIsRecording(true);
      console.log('Recording started successfully');

    } catch (error) {
      console.error('Recording error:', error);
      alert('Could not start recording: ' + error.message);
      stopRecordingCleanup();
    }
  };

  const stopRecordingCleanup = () => {
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch (e) {
        console.warn('Error disconnecting processor:', e);
      }
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {
        console.warn('Error closing audio context:', e);
      }
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach(track => track.stop());
      } catch (e) {
        console.warn('Error stopping stream tracks:', e);
      }
      streamRef.current = null;
    }
  };

  const stopRecording = () => {
    console.log('Stopping recording...');
    setIsRecording(false);

    // Clean up audio processing but DON'T end the session
    stopRecordingCleanup();

    console.log('Recording stopped but session remains active for editing');
  };

  // New function to explicitly end session and generate prescription
  const endSession = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && sessionIdRef.current) {
      console.log('Ending WebSocket session...');
      wsRef.current.send(JSON.stringify({
        type: 'end_session',
        session_id: sessionIdRef.current,
        // context: selectedContext,
        // ai_model: selectedModel,
        user_id: user?.id || user?.sub,
        username: getDisplayUsername()
      }));
    }
    sessionIdRef.current = null;
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // IMPROVED: Generate prescription using existing session or create new one
  const generatePrescription = async () => {
    debugTranscriptFlow(); // Add debugging

    // Get the current transcript (could be edited)
    const currentTranscript = transcript.trim();

    if (!currentTranscript) {
      alert('No transcript available. Please record some audio first.');
      return;
    }

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      alert('WebSocket connection not available. Please check your connection.');
      return;
    }

    // Add explicit logging of what we're sending
    console.log('Sending transcript to backend:', currentTranscript.substring(0, 200) + '...');
    console.log('Full transcript length:', currentTranscript.length);

    setIsGenerating(true);

    try {
      // FIXED: Always send the updated transcript, regardless of session state
      if (sessionIdRef.current) {
        // Use existing session
        console.log('Using existing session for prescription generation...');
        wsRef.current.send(JSON.stringify({
          type: 'generate_prescription',
          session_id: sessionIdRef.current,
          transcript: currentTranscript, // Always send current transcript
          context: selectedContext,
          ai_model: selectedModel,
          user_id: user?.id || user?.sub,
          username: getDisplayUsername()
        }));
      } else {
        // Create new session with the current transcript
        console.log('Creating new session with edited transcript...');

        // First create the session
        wsRef.current.send(JSON.stringify({
          type: 'start_session',
          preferred_language: 'en-IN',
          processing_mode: 'translate',
          code_switching_mode: true,
          doctor_known_languages: ['en-IN', 'hi-IN'],
          doctor_profile: {
            specialty: 'General Medicine',
            experience: '5 years'
          },
          context: selectedContext,
          user_id: user?.id || user?.sub,
          username: getDisplayUsername()
        }));

        // Wait a bit longer for session to be established
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check if session was created
        if (!sessionIdRef.current) {
          throw new Error('Failed to create session');
        }

        // Now send the prescription generation request with the current transcript
        wsRef.current.send(JSON.stringify({
          type: 'generate_prescription',
          session_id: sessionIdRef.current,
          transcript: currentTranscript, // Send the edited transcript
          context: selectedContext,
          ai_model: selectedModel,
          user_id: user?.id || user?.sub,
          username: getDisplayUsername()
        }));
      }
    } catch (error) {
      console.error('Error sending prescription generation request:', error);
      setIsGenerating(false);
      alert('Failed to generate prescription: ' + error.message);
    }
  };

  // IMPROVED: Analyze categories using existing session or create new one
  const analyzeCategories = async () => {
    debugTranscriptFlow();

    const currentTranscript = transcript.trim();

    if (!currentTranscript) {
      alert('No transcript available. Please record some audio first.');
      return;
    }

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      alert('WebSocket connection not available. Please check your connection.');
      return;
    }

    console.log('Sending transcript to backend for categories:', currentTranscript.substring(0, 200) + '...');
    console.log('Full transcript length:', currentTranscript.length);

    setIsAnalyzing(true);

    try {
      if (sessionIdRef.current) {
        console.log('Using existing session for category analysis...');
        wsRef.current.send(JSON.stringify({
          type: 'generate_prescription',
          session_id: sessionIdRef.current,
          transcript: currentTranscript,
          context: selectedContext,
          ai_model: selectedModel,
          user_id: user?.id || user?.sub,
          username: getDisplayUsername()
        }));
      } else {
        console.log('Creating new session with edited transcript for categories...');

        wsRef.current.send(JSON.stringify({
          type: 'start_session',
          preferred_language: 'en-IN',
          processing_mode: 'translate',
          code_switching_mode: true,
          doctor_known_languages: ['en-IN', 'hi-IN'],
          doctor_profile: {
            specialty: 'General Medicine',
            experience: '5 years'
          },
          context: selectedContext,
          user_id: user?.id || user?.sub,
          username: getDisplayUsername()
        }));

        await new Promise(resolve => setTimeout(resolve, 500));

        if (!sessionIdRef.current) {
          throw new Error('Failed to create session');
        }

        wsRef.current.send(JSON.stringify({
          type: 'generate_prescription',
          session_id: sessionIdRef.current,
          transcript: currentTranscript,
          context: selectedContext,
          ai_model: selectedModel,
          user_id: user?.id || user?.sub,
          username: getDisplayUsername()
        }));
      }
    } catch (error) {
      console.error('Error sending category analysis request:', error);
      setIsAnalyzing(false);
      alert('Failed to analyze categories: ' + error.message);
    }
  };

  // Function to call when transcript editing is complete
  const onTranscriptEditComplete = async () => {
    if (sessionIdRef.current) {
      console.log('Transcript editing complete, syncing with backend...');
      await updateSessionTranscript();
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('Uploading file:', file.name);

    const formData = new FormData();
    formData.append('audio', file);
    formData.append('user_id', user?.id || user?.sub || '');
    formData.append('username', getDisplayUsername());

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.transcript) {
        addTranscriptMessage(data.transcript, new Date().toLocaleTimeString());
        console.log('File upload successful');
      } else {
        throw new Error('No transcript returned');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload file: ' + error.message);
    }
  };

  const finalizePrescription = () => {
    if (!prescription?.trim()) {
      alert('No prescription available. Please generate or enter some text first.');
      return;
    }

    setIsFinalizing(true);

    setTimeout(() => {
      setIsFinalized(true);
      setIsFinalizing(false);
    }, 300);
  };

  // REMOVED: Old exportPDF function and formatPrescriptionToHTML function

  const copyTranscript = () => {
    if (transcript) {
      navigator.clipboard.writeText(transcript).then(() => {
        alert('Transcript copied to clipboard!');
      }).catch((error) => {
        console.error('Copy failed:', error);
        alert('Failed to copy transcript to clipboard.');
      });
    }
  };

  const highlightMessage = (index) => {
    setHighlightedMessageIndex(index);
    setTimeout(() => setHighlightedMessageIndex(null), 3000);
  };

  const clearAll = async () => {
    return new Promise((resolve) => {
      setIsEndingSession(true); // Set ending session state

      if (isRecording) {
        stopRecording();
      }

      // End session if one is active
      if (sessionIdRef.current) {
        endSession();

        // Add a small delay to ensure the session ending message is processed
        setTimeout(() => {
          resetState();
          setIsEndingSession(false); // Clear ending session state
          resolve();
        }, 1000);
      } else {
        resetState();
        setIsEndingSession(false); // Clear ending session state
        resolve();
      }
    });
  };

  // Extract state reset logic into a separate function
  const resetState = () => {
    setTranscript('');
    setMessages([]);
    setCategories({});
    setPrescription('');
    setMetadata(null);
    setIsFinalized(false);
    setHighlightedMessageIndex(null);
    setIsEditingTranscript(false);
    setIsEditingPrescription(false);
    setIsEditingCategories(false);
    setVadEnabled(false);
    setSpeechInProgress(false);
    setVadStats(null);
    setDiarizationResults(null);
    setTranscriptHighlight(null);
    setHighlightNotification(null);
    setEvaluationResult(null);
    setPatientDemographics({});
    setIsCleared(true);
    // ✅ Reset isCleared after cleanup to allow new sessions
    setTimeout(() => setIsCleared(false), 1500);
  };
  // NEW: VAD status indicator component
  const VadStatusIndicator = () => {
    if (!vadEnabled) return null;

    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center space-x-1">
          {speechInProgress ? (
            <Mic className="w-4 h-4 text-green-500 animate-pulse" />
          ) : (
            <MicOff className="w-4 h-4 text-gray-400" />
          )}
          <span className="text-sm font-medium text-blue-700">
            VAD: {speechInProgress ? 'Speaking' : 'Listening'}
          </span>
        </div>
        {vadStats && (
          <div className="text-xs text-blue-600">
            Duration: {Math.round(vadStats.duration)}s
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <GlobalHeader user={user} />

      <ControlsPanel
        isRecording={isRecording}
        toggleRecording={toggleRecording}
        handleFileUpload={handleFileUpload}
        clearAll={clearAll}
        fileInputRef={fileInputRef}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        selectedContext={selectedContext}
        setSelectedContext={setSelectedContext}
        connectionStatus={connectionStatus}
        sessionActive={sessionActive}
        vadEnabled={vadEnabled}
        speechInProgress={speechInProgress}
        isEndingSession={isEndingSession} // Pass the state
        transcript={transcript} // Pass transcript for unsaved changes check
        scrollToEvaluation={scrollToEvaluation}
      />

      {/* NEW: VAD Status Indicator */}
      <div className="px-6 py-2">
        <VadStatusIndicator />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 md:p-6 h-[calc(100dvh-100px)] max-h-[100dvh]">
        {/* 📝 Transcription Panel */}
        <div className="lg:col-span-6 flex flex-col h-full">
          <div className="flex-1 bg-white rounded-2xl shadow p-4 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto">
              <TranscriptionPanel
                messages={messages}
                transcript={transcript}
                setTranscript={setTranscript}
                setMessages={setMessages}
                isEditingTranscript={isEditingTranscript}
                setIsEditingTranscript={setIsEditingTranscript}
                copyTranscript={copyTranscript}
                highlightedMessageIndex={highlightedMessageIndex}
                highlightMessage={highlightMessage}
                connectionStatus={connectionStatus}
                sessionActive={sessionActive}
                onTranscriptEditComplete={onTranscriptEditComplete}
                sessionId={sessionId}
                sessionIdRef={sessionIdRef}
                wsRef={wsRef}
                user={user}
                highlightRange={transcriptHighlight}
              />
            </div>
          </div>
        </div>

        {/* 📄 Documentation Panel */}
        <div className="lg:col-span-6 flex flex-col h-full">
          <div className="flex-1 bg-white rounded-2xl shadow p-4 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto">
              <DocumentationPanel
                metadata={metadata}
                prescription={prescription}
                setPrescription={setPrescription}
                isEditingPrescription={isEditingPrescription}
                setIsEditingPrescription={setIsEditingPrescription}
                isGenerating={isGenerating}
                isFinalizing={isFinalizing}
                isFinalized={isFinalized}
                generatePrescription={generatePrescription}
                finalizePrescription={finalizePrescription}
                // REMOVED: exportPDF prop - DocumentationPanel now handles its own PDF export
                patientDemographics={patientDemographics} // ADDED: Pass patient demographics
                user={user} // ADDED: Pass user info for PDF
                transcript={transcript} // ADDED: Pass transcript for PDF appendix
                diarizationResults={diarizationResults} // ADDED: Pass diarization results
                onHighlightTranscript={handleHighlightTranscript}
                sessionId={sessionId}
                sessionIdRef={sessionIdRef}
                wsRef={wsRef}
              />
            </div>
          </div>
        </div>

        {/* ✅ FIXED: Evaluation Panel inside grid with proper layout */}
        {evaluationResult && (
          <div className="lg:col-span-12" ref={evaluationRef}>
            <EvaluationPanel
              evaluationResult={evaluationResult}
              sessionIdRef={sessionIdRef}
              sessionId={sessionId}
              wsRef={wsRef}
              user={user}
            />
          </div>
        )}
      </div>

    </div>
  );
};

MedicalTranscriptionSystem.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string,
    sub: PropTypes.string,
    email: PropTypes.string,
    name: PropTypes.string
  })
};

export default MedicalTranscriptionSystem;