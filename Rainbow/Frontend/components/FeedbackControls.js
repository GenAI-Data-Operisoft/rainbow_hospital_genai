import React, { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, MessageSquare } from 'lucide-react';

const FeedbackControls = ({ sessionIdRef, sessionId, wsRef, user, panelName }) => {
  const [selected, setSelected] = useState(null);
  const [showFeedbackBox, setShowFeedbackBox] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');

  // Log when session updates (helps debugging)
  useEffect(() => {
    console.log(
      `[${panelName}] FeedbackControls mounted. sessionIdRef.current =`,
      sessionIdRef?.current,
      ' sessionId =',
      sessionId
    );
  }, [sessionIdRef?.current, sessionId, panelName]);

  // Send feedback via WebSocket
  const sendFeedback = (type, text = null) => {
    const activeSessionId = sessionIdRef?.current || sessionId;

    if (!activeSessionId || !wsRef?.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn(`⚠️ No active session for panel "${panelName}" — feedback not sent`);
      return;
    }

    const payload = {
      type: 'submit_feedback',
      session_id: activeSessionId,
      panel: panelName,
      feedback_type: type,
      feedback_text: text,
      user_id: user?.id || user?.sub,
      timestamp: Date.now(),
    };

    wsRef.current.send(JSON.stringify(payload));
    console.log('✅ Feedback sent:', payload);
  };

  const handleClick = (type) => {
    setSelected(type);
    sendFeedback(type);
  };

  const handleFeedbackSubmit = () => {
    if (!selected) {
      alert('Please select thumbs up or down first.');
      return;
    }
    sendFeedback(selected, feedbackText);
    setFeedbackText('');
    setShowFeedbackBox(false);
  };

  const activeSessionId = sessionIdRef?.current || sessionId;
  const isDisabled = !activeSessionId;

  return (
    <div className="flex items-center gap-2 mt-3">
      <button
        onClick={() => handleClick('up')}
        disabled={isDisabled}
        className={`p-2 rounded-full ${
          selected === 'up'
            ? 'bg-green-100 text-green-600'
            : 'bg-gray-100 hover:bg-gray-200'
        } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <ThumbsUp className="h-4 w-4" />
      </button>

      <button
        onClick={() => handleClick('down')}
        disabled={isDisabled}
        className={`p-2 rounded-full ${
          selected === 'down'
            ? 'bg-red-100 text-red-600'
            : 'bg-gray-100 hover:bg-gray-200'
        } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <ThumbsDown className="h-4 w-4" />
      </button>

      <button
        onClick={() => setShowFeedbackBox(!showFeedbackBox)}
        disabled={isDisabled}
        className={`p-2 rounded-full bg-gray-100 hover:bg-gray-200 ${
          isDisabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        <MessageSquare className="h-4 w-4" />
      </button>

      {showFeedbackBox && (
        <div className="ml-2 flex flex-col gap-2">
          <textarea
            className="p-2 border rounded-md text-sm w-60"
            placeholder="Additional feedback..."
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
          />
          <button
            onClick={handleFeedbackSubmit}
            className="px-3 py-1 text-xs bg-[#8E3B7A] text-white rounded-md hover:bg-[#D22078]"
          >
            Submit
          </button>
        </div>
      )}
    </div>
  );
};

export default FeedbackControls;
