import React, { useState, useEffect } from 'react';
import {
  CheckCircle, AlertCircle, XCircle, TrendingUp,
  Star, Activity, ThumbsUp, ThumbsDown, MessageSquare, ChevronDown
} from 'lucide-react';

const FeedbackControls = ({ sessionIdRef, sessionId, wsRef, user, panelName }) => {
  const [selected, setSelected] = useState(null);
  const [showFeedbackBox, setShowFeedbackBox] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');

  useEffect(() => {
    console.log(`[${panelName}] FeedbackControls mounted. sessionIdRef.current =`, sessionIdRef?.current, ' sessionId =', sessionId);
  }, [sessionIdRef?.current, sessionId, panelName]);

  const sendFeedback = (type, text = null) => {
    const activeSessionId = sessionIdRef?.current || sessionId;
    if (!activeSessionId || !wsRef?.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn(`⚠️ No active session for panel "${panelName}" — feedback not sent`);
      return;
    }
    wsRef.current.send(JSON.stringify({
      type: 'submit_feedback', session_id: activeSessionId, panel: panelName,
      feedback_type: type, feedback_text: text, user_id: user?.id || user?.sub, timestamp: Date.now(),
    }));
  };

  const handleClick = (type) => { setSelected(type); sendFeedback(type); };
  const handleSubmit = () => {
    if (!selected) { alert('Please select thumbs up or down first.'); return; }
    sendFeedback(selected, feedbackText);
    setFeedbackText(''); setShowFeedbackBox(false);
  };

  const isDisabled = !(sessionIdRef?.current || sessionId);

  return (
    <div className="flex items-center gap-1.5">
      <button onClick={() => handleClick('up')} disabled={isDisabled}
        className={`p-1.5 rounded-lg transition-colors ${selected === 'up' ? 'bg-green-100 text-green-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-500'} disabled:opacity-40`}>
        <ThumbsUp className="h-4 w-4" />
      </button>
      <button onClick={() => handleClick('down')} disabled={isDisabled}
        className={`p-1.5 rounded-lg transition-colors ${selected === 'down' ? 'bg-red-100 text-red-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-500'} disabled:opacity-40`}>
        <ThumbsDown className="h-4 w-4" />
      </button>
      <button onClick={() => setShowFeedbackBox(!showFeedbackBox)} disabled={isDisabled}
        className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors disabled:opacity-40">
        <MessageSquare className="h-4 w-4" />
      </button>
      {showFeedbackBox && (
        <div className="absolute right-4 top-14 z-10 bg-white border border-gray-200 rounded-xl shadow-lg p-3 flex flex-col gap-2 w-64">
          <textarea className="p-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
            placeholder="Additional feedback..." value={feedbackText} onChange={e => setFeedbackText(e.target.value)} rows={3} />
          <button onClick={handleSubmit} className="px-3 py-1.5 text-xs bg-[#8E3B7A] text-white rounded-lg hover:bg-[#D22078] transition-colors font-medium">
            Submit
          </button>
        </div>
      )}
    </div>
  );
};

const ScoreBadge = ({ score }) => {
  if (!score) return null;
  const color = score >= 8 ? 'bg-green-100 text-green-700 border-green-200'
    : score >= 6 ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
    : 'bg-red-100 text-red-700 border-red-200';
  const Icon = score >= 8 ? CheckCircle : score >= 6 ? AlertCircle : XCircle;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-bold border ${color}`}>
      <Icon className="h-3.5 w-3.5" />
      {score}/10
    </span>
  );
};

const ScoreRow = ({ label, score }) => {
  if (!score) return null;
  const barColor = score >= 8 ? 'bg-green-500' : score >= 6 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 w-28 flex-shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${(score / 10) * 100}%` }} />
      </div>
      <ScoreBadge score={score} />
    </div>
  );
};

const EvaluationPanel = ({ evaluationResult, sessionIdRef, sessionId, wsRef, user }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  if (!evaluationResult) return null;

  const evaluation = evaluationResult.parsed_evaluation || evaluationResult;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <Star className="h-4 w-4 text-white" />
          </div>
          <h3 className="text-base font-bold text-white">Evaluation Results</h3>
          {evaluation.overall_assessment_score && (
            <span className="ml-1 px-2.5 py-0.5 bg-white/20 text-white text-sm font-bold rounded-full">
              {evaluation.overall_assessment_score}/10
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 relative">
          <FeedbackControls sessionIdRef={sessionIdRef} sessionId={sessionId} wsRef={wsRef} user={user} panelName="evaluation" />
          <button onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
            <ChevronDown className={`h-4 w-4 text-white transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="p-4 sm:p-6 space-y-5">
          {/* Overall Score */}
          {evaluation.overall_assessment_score && (
            <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <div>
                <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-0.5">Overall Assessment</p>
                <p className="text-sm text-blue-800 font-medium">Combined score across all categories</p>
              </div>
              <ScoreBadge score={evaluation.overall_assessment_score} />
            </div>
          )}

          {/* Categories Evaluation */}
          {evaluation.categories_evaluation && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-gray-500" />
                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Categories Evaluation</h4>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                <ScoreRow label="Completeness" score={evaluation.categories_evaluation.completeness_score} />
                <ScoreRow label="Accuracy" score={evaluation.categories_evaluation.accuracy_score} />
              </div>
            </div>
          )}

          {/* Prescription Evaluation */}
          {evaluation.prescription_evaluation && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Activity className="h-4 w-4 text-gray-500" />
                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Prescription Evaluation</h4>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                <ScoreRow label="Completeness" score={evaluation.prescription_evaluation.completeness_score} />
                <ScoreRow label="Overall" score={evaluation.prescription_evaluation.overall_score} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EvaluationPanel;
