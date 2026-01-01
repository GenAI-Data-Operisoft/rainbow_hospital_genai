import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, XCircle, TrendingUp, FileText, Star, Activity, ThumbsUp, ThumbsDown, MessageSquare } from 'lucide-react';


// FeedbackControls component
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
                className={`p-2 rounded-full ${selected === 'up'
                        ? 'bg-green-100 text-green-600'
                        : 'bg-gray-100 hover:bg-gray-200'
                    } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                <ThumbsUp className="h-4 w-4" />
            </button>

            <button
                onClick={() => handleClick('down')}
                disabled={isDisabled}
                className={`p-2 rounded-full ${selected === 'down'
                        ? 'bg-red-100 text-red-600'
                        : 'bg-gray-100 hover:bg-gray-200'
                    } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                <ThumbsDown className="h-4 w-4" />
            </button>

            <button
                onClick={() => setShowFeedbackBox(!showFeedbackBox)}
                disabled={isDisabled}
                className={`p-2 rounded-full bg-gray-100 hover:bg-gray-200 ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''
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

const EvaluationPanel = ({ evaluationResult, sessionIdRef, sessionId, wsRef, user }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);

    if (!evaluationResult) return null;

    // Parse the evaluation result - handle both direct object and nested parsed_evaluation
    const evaluation = evaluationResult.parsed_evaluation || evaluationResult;
    const stats = evaluationResult.stats || {};

    // Helper function to get color class based on score
    const getScoreColor = (score) => {
        if (score >= 8) return 'text-green-600 bg-green-50';
        if (score >= 6) return 'text-yellow-600 bg-yellow-50';
        return 'text-red-600 bg-red-50';
    };

    // Helper function to get icon based on score
    const getScoreIcon = (score) => {
        if (score >= 8) return <CheckCircle className="w-5 h-5" />;
        if (score >= 6) return <AlertCircle className="w-5 h-5" />;
        return <XCircle className="w-5 h-5" />;
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <Star className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Evaluation Results</h3>
                    {evaluation.overall_assessment_score && (
                        <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-sm ${getScoreColor(evaluation.overall_assessment_score)}`}>
                            {getScoreIcon(evaluation.overall_assessment_score)}
                            <span className="font-bold">{evaluation.overall_assessment_score}/10</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    {/* Feedback Controls inline */}
                    <FeedbackControls
                        sessionIdRef={sessionIdRef}
                        sessionId={sessionId}
                        wsRef={wsRef}
                        user={user}
                        panelName="evaluation"
                    />

                    {/* Collapse Button */}
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <div className={`transition-transform ${isCollapsed ? 'rotate-180' : ''}`}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </button>
                </div>
            </div>

            {!isCollapsed && (
                <div className="p-6 space-y-6">
                    {/* Overall Assessment Score */}
                    {evaluation.overall_assessment_score && (
                        <div className="bg-blue-50 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <h4 className="font-medium text-blue-900">Overall Assessment Score</h4>
                                <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${getScoreColor(evaluation.overall_assessment_score)}`}>
                                    {getScoreIcon(evaluation.overall_assessment_score)}
                                    <span className="font-bold">{evaluation.overall_assessment_score}/10</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Categories Evaluation */}
                    {evaluation.categories_evaluation && (
                        <div>
                            <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                                <TrendingUp className="w-5 h-5 mr-2" />
                                Categories Evaluation
                            </h4>
                            <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {evaluation.categories_evaluation.completeness_score && (
                                        <div className="bg-white rounded-lg p-3 shadow-sm">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-medium text-gray-700">Completeness</span>
                                                <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs ${getScoreColor(evaluation.categories_evaluation.completeness_score)}`}>
                                                    {getScoreIcon(evaluation.categories_evaluation.completeness_score)}
                                                    <span className="font-bold">{evaluation.categories_evaluation.completeness_score}/10</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {evaluation.categories_evaluation.accuracy_score && (
                                        <div className="bg-white rounded-lg p-3 shadow-sm">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-medium text-gray-700">Accuracy</span>
                                                <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs ${getScoreColor(evaluation.categories_evaluation.accuracy_score)}`}>
                                                    {getScoreIcon(evaluation.categories_evaluation.accuracy_score)}
                                                    <span className="font-bold">{evaluation.categories_evaluation.accuracy_score}/10</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Categories Reasoning */}
                                {/* {evaluation.categories_evaluation.reasoning && evaluation.categories_evaluation.reasoning.length > 0 && (
                                    <div className="mt-4">
                                        <h5 className="font-medium text-gray-800 mb-2">Analysis</h5>
                                        <div className="space-y-2">
                                            {evaluation.categories_evaluation.reasoning.map((reason, index) => (
                                                <div key={index} className="bg-white border-l-4 border-blue-200 p-3 rounded-r-lg">
                                                    <p className="text-sm text-gray-700">{reason}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )} */}
                            </div>
                        </div>
                    )}

                    {/* Prescription Evaluation */}
                    {evaluation.prescription_evaluation && (
                        <div>
                            <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                                <Activity className="w-5 h-5 mr-2" />
                                Prescription Evaluation
                            </h4>
                            <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {evaluation.prescription_evaluation.completeness_score && (
                                        <div className="bg-white rounded-lg p-3 shadow-sm">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-medium text-gray-700">Completeness</span>
                                                <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs ${getScoreColor(evaluation.prescription_evaluation.completeness_score)}`}>
                                                    {getScoreIcon(evaluation.prescription_evaluation.completeness_score)}
                                                    <span className="font-bold">{evaluation.prescription_evaluation.completeness_score}/10</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {evaluation.prescription_evaluation.overall_score && (
                                        <div className="bg-white rounded-lg p-3 shadow-sm border-2 border-green-200">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-medium text-green-700">Accuracy</span>
                                                <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs ${getScoreColor(evaluation.prescription_evaluation.overall_score)}`}>
                                                    {getScoreIcon(evaluation.prescription_evaluation.overall_score)}
                                                    <span className="font-bold">{evaluation.prescription_evaluation.overall_score}/10</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Prescription Reasoning */}
                                {/* {evaluation.prescription_evaluation.reasoning && evaluation.prescription_evaluation.reasoning.length > 0 && (
                                    <div className="mt-4">
                                        <h5 className="font-medium text-gray-800 mb-2">Analysis</h5>
                                        <div className="space-y-2">
                                            {evaluation.prescription_evaluation.reasoning.map((reason, index) => (
                                                <div key={index} className="bg-white border-l-4 border-green-200 p-3 rounded-r-lg">
                                                    <p className="text-sm text-gray-700">{reason}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )} */}
                            </div>
                        </div>
                    )}

                    {/* Critical Findings */}
                    {/* {evaluation.critical_findings && evaluation.critical_findings.length > 0 && (
                        <div>
                            <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                                <AlertCircle className="w-5 h-5 mr-2 text-red-600" />
                                Critical Findings
                            </h4>
                            <div className="space-y-3">
                                {evaluation.critical_findings.map((finding, index) => (
                                    <div key={index} className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-lg">
                                        <div className="flex items-start space-x-2">
                                            <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                                            <p className="text-sm text-red-800 font-medium">{finding}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )} */}

                    {/* Feedback Controls */}
                    {/* <div className="border-t pt-4">
                        <h4 className="font-medium text-gray-900 mb-2">Rate this evaluation</h4>
                        <FeedbackControls
                            sessionIdRef={sessionIdRef}
                            sessionId={sessionId}
                            wsRef={wsRef}
                            user={user}
                            panelName="evaluation"
                        />
                    </div> */}

                    {/* Raw JSON for debugging (collapsible) */}
                    {/* <details className="border-t pt-4">
                        <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800">
                            View Raw Evaluation Data
                        </summary>
                        <pre className="mt-3 bg-gray-50 rounded-lg p-4 text-xs overflow-x-auto">
                            {JSON.stringify(evaluationResult, null, 2)}
                        </pre>
                    </details> */}
                </div>
            )}
        </div>
    );
};

export default EvaluationPanel;