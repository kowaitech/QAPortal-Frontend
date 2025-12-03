
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../utils/authStore';
import { api } from '../../utils/axios';
import { useDialog } from '../../components/DialogProvider';
import CameraMonitor from '../../components/CameraMonitor';
import SimpleTextEditor from '../../components/SimpleTextEditor';

export default function TakeTest() {
  const { id } = useParams();
  const nav = useNavigate();
  const { accessToken } = useAuthStore.getState();
  const [test, setTest] = useState(null);
  const [domains, setDomains] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [section, setSection] = useState('A');
  const [started, setStarted] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [due, setDue] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [answers, setAnswers] = useState({});
  const [uploading, setUploading] = useState(false);
  const [testSubmitted, setTestSubmitted] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [hasExistingSession, setHasExistingSession] = useState(false);
  const [existingSession, setExistingSession] = useState(null);
  const warningTimeoutRef = useRef(null);
  const [cameraGranted, setCameraGranted] = useState(false);
  // Face detection removed; keep camera gating only
  const dialog = useDialog();
  const cameraRef = useRef(null);
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [snapshotUrl, setSnapshotUrl] = useState(null);
  const [referenceDescriptor, setReferenceDescriptor] = useState(null);

  // Timer effect
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load test and domains
  useEffect(() => {
    const loadTestData = async () => {
      try {
        const { data } = await api.get(`/tests/${id}`);
        setTest(data);
        const doms = await api.get('/domains');
        const dict = Object.fromEntries((doms.data.domains || doms.data).map(d => [d._id, d]));
        const allowed = (data.domains || []).map(x => dict[x._id || x]).filter(Boolean);
        setDomains(allowed);

        // Check if student already has an active test session
        try {
          const { data: myTests } = await api.get('/tests/student/my-tests');
          const activeTest = myTests.active?.find(t => t.test._id === id);
          if (activeTest) {
            // Store existing session info
            setHasExistingSession(true);
            setExistingSession(activeTest);
            
            // Check if this is a direct access to continue test (from "Your Tests" section)
            // If so, automatically resume the test
            const urlParams = new URLSearchParams(window.location.search);
            const continueTest = urlParams.get('continue');
            
            if (continueTest === 'true') {
              // Auto-resume the test session
              continueTestSession(activeTest);
            }
          }
        } catch (error) {
          console.log('No active test session found or error loading:', error);
        }
      } catch (error) {
        console.error('Error loading test data:', error);
        dialog.alert('Failed to load test data');
      }
    };

    loadTestData();
  }, [id, accessToken]);

  // Calculate remaining time
  const remaining = useMemo(() => {
    if (!due) return null;
    return Math.max(0, Math.floor((new Date(due).getTime() - now) / 1000));
  }, [due, now]);

  // Auto-submit when time expires
  useEffect(() => {
    if (remaining === 0 && started && !testSubmitted) {
      handleSubmitTest();
    }
  }, [remaining, started, testSubmitted]);

  // Show warning when 5 minutes remaining
  useEffect(() => {
    if (remaining && remaining <= 300 && remaining > 299) { // 5 minutes = 300 seconds
      setShowWarning(true);
      warningTimeoutRef.current = setTimeout(() => setShowWarning(false), 10000); // Hide after 10 seconds
    }

    return () => {
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
    };
  }, [remaining]);

  // Start test
  const startTest = async () => {
    if (!selectedDomain || !section) {
      dialog.alert('Please select both domain and section');
      return;
    }
    // Open capture modal first
    setShowCaptureModal(true);
  };

  // Continue existing test session
  const continueTestSession = async (activeTest) => {
    setUploading(true);
    try {
      // Set the session data
      setStarted(true);
      setSelectedDomain(activeTest.selectedDomain._id);
      setSection(activeTest.selectedSection);
      setDue(activeTest.dueTime);

      // Load questions for the resumed session
      const { data: questionsData } = await api.get(`/questions/domain/${activeTest.selectedDomain._id}?section=${activeTest.selectedSection}`);
      setQuestions(questionsData.questions || []);

      // Load existing answers
      const { data: answersData } = await api.get(`/student-answers/my-answers/${activeTest.selectedDomain._id}/${activeTest.selectedSection}`);
      const answersObj = {};
      answersData.answers.forEach(answer => {
        answersObj[answer.question._id] = {
          questionId: answer.question._id,
          domainId: activeTest.selectedDomain._id,
          section: activeTest.selectedSection,
          answerText: answer.answerText,
          uploaded: true
        };
      });
      setAnswers(answersObj);

      dialog.alert('Resumed your previous test session. Time continues from where you left off.');
    } catch (error) {
      console.error('Error continuing test:', error);
      dialog.alert('Failed to continue test session');
    } finally {
      setUploading(false);
    }
  };

  // Handle text typing and submission for a question
  const handleAnswerTextChange = (questionId, value) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        answerText: value,
        uploaded: false
      }
    }));
  };

  const handleTextSubmit = async (questionId) => {
    const text = answers[questionId]?.answerText || '';
    if (!text.trim()) {
      dialog.alert('Please type your answer before submitting.');
      return;
    }

    setUploading(true);
    try {
      const payload = {
        answerText: text,
        questionId: questionId,
        domainId: selectedDomain,
        section: section,
        examStartTime: new Date().toISOString(),
        testId: id
      };
      const { data } = await api.post('/student-answers/submit', payload);
      setAnswers(prev => ({
        ...prev,
        [questionId]: {
          ...prev[questionId],
          answerText: data?.answer?.answerText ?? text,
          uploaded: true
        }
      }));
      dialog.alert('Answer saved successfully!');
    } catch (error) {
      console.error('Error submitting answer text:', error);
      dialog.alert(error.response?.data?.message || 'Failed to save answer');
    } finally {
      setUploading(false);
    }
  };

  // Submit test
  const handleSubmitTest = async () => {
    if (testSubmitted) return;

    setTestSubmitted(true);
    try {
      await api.post(`/tests/${id}/submit`);
      dialog.alert('Test submitted successfully!');
      nav('/student');
    } catch (error) {
      console.error('Error submitting test:', error);
      dialog.alert(error.response?.data?.message || 'Failed to submit test');
    }
  };

  // Format time display
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!test) return <div className="text-center py-8">Loading test...</div>;

  // Domain and section selection screen
  if (!started) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Capture Snapshot Modal (before starting) */}
        {showCaptureModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[85vh] overflow-auto">
              <h3 className="text-lg font-semibold mb-4">Camera Check</h3>
              <p className="text-sm text-gray-600 mb-4">Please allow camera access and capture a photo before starting.</p>
              <div className="mb-4 flex flex-col md:flex-row gap-4 items-start">
                <div className="flex-1 min-w-[240px]">
                  <CameraMonitor ref={cameraRef} onError={() => {}} onStateChange={() => {}} />
                </div>
                {snapshotUrl && (
                  <div className="flex-1 min-w-[240px]">
                    <div className="text-sm font-medium mb-1">Snapshot preview:</div>
                    <img src={snapshotUrl} alt="Snapshot" loading="lazy" className="w-full h-56 object-contain rounded border bg-black/5" />
                  </div>
                )}
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={async () => {
                    if (!cameraRef.current) return;
                    const { dataUrl } = await cameraRef.current.captureSnapshotAndDescriptor();
                    if (!dataUrl) {
                      dialog.alert('Could not capture photo. Please ensure camera permission is granted and try again.');
                      return;
                    }
                    setSnapshotUrl(dataUrl);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {snapshotUrl ? 'Re-capture' : 'Capture'}
                </button>
                <button
                  onClick={async () => {
                    // If user hasn't captured yet, auto-capture once
                    if (!snapshotUrl && cameraRef.current) {
                      const { dataUrl } = await cameraRef.current.captureSnapshotAndDescriptor();
                      if (dataUrl) {
                        setSnapshotUrl(dataUrl);
                        return; // show the preview first; user confirms again
                      }
                    }
                    // Proceed to start test
                    setUploading(true);
                    try {
                      const { data } = await api.post(`/tests/${id}/start`, { domainId: selectedDomain, section });
                      setStarted(true);
                      setQuestions(data.questions);
                      setDue(data.dueTime);
                      const answersObj = {};
                      data.questions.forEach(q => {
                        answersObj[q._id] = { questionId: q._id, domainId: selectedDomain, section };
                      });
                      setAnswers(answersObj);
                      setShowCaptureModal(false);
                    } catch (error) {
                      console.error('Error starting test:', error);
                      dialog.alert(error.response?.data?.message || 'Failed to start test');
                    } finally {
                      setUploading(false);
                    }
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Confirm & Start
                </button>
                <button
                  onClick={() => setShowCaptureModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-3xl font-bold text-center mb-6">{test.title}</h2>

          {/* Existing Session Warning */}
          {hasExistingSession && existingSession && (
            <div className="mb-8 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="text-xl font-semibold text-yellow-800 mb-3">⚠️ Test Already In Progress</h3>
              <div className="space-y-2 text-sm text-yellow-700">
                <p><strong>Domain:</strong> {existingSession.selectedDomain.name}</p>
                <p><strong>Section:</strong> {existingSession.selectedSection}</p>
                <p><strong>Time Remaining:</strong> {formatTime(Math.max(0, Math.floor((new Date(existingSession.dueTime).getTime() - now) / 1000)))}</p>
              </div>
              <div className="mt-4 space-y-3">
                <p className="text-yellow-800">
                  You already have an active test session. You can continue your test or go to the dashboard.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => continueTestSession(existingSession)}
                    disabled={uploading}
                    className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {uploading ? 'Loading...' : 'Continue Test'}
                  </button>
                  <button
                    onClick={() => window.location.href = '/student'}
                    className="bg-yellow-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-yellow-700 transition-colors"
                  >
                    Go to Dashboard
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* New Test Section */}
          <div className={hasExistingSession ? 'opacity-50 pointer-events-none' : ''}>
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Start New Test</h3>
            <div className="grid md:grid-cols-2 gap-8">
            {/* Domain Selection */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-800">Choose Domain</h3>
              <div className="space-y-3">
                {domains.map(d => (
                  <button
                    key={d._id}
                    onClick={() => setSelectedDomain(d._id)}
                    className={`w-full p-4 text-left rounded-lg border-2 transition-all ${selectedDomain === d._id
                      ? 'border-[#552e81] bg-purple-50 text-[#552e81]'
                      : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <div className="font-medium">{d.name}</div>
                    <div className="text-sm text-gray-600">
                      Questions: {d.questionCounts ? `${d.questionCounts.sectionA + d.questionCounts.sectionB}` : 'N/A'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Section Selection */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-800">Choose Section</h3>
              <div className="space-y-3">
                {['A', 'B'].map(s => (
                  <button
                    key={s}
                    onClick={() => setSection(s)}
                    className={`w-full p-4 text-left rounded-lg border-2 transition-all ${section === s
                      ? 'border-[#552e81] bg-purple-50 text-[#552e81]'
                      : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <div className="font-medium">Section {s}</div>
                    <div className="text-sm text-gray-600">
                      {domains.find(d => d._id === selectedDomain)?.questionCounts?.[`section${s}`] || 0} questions
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Test Information */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold mb-3">Test Information</h4>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <strong>Duration:</strong>{' '}
                {(() => {
                  const mins = Number(test.durationMinutes || 60);
                  const hrs = Math.floor(mins / 60);
                  const rem = mins % 60;
                  return hrs > 0
                    ? `${hrs} hour${hrs>1?'s':''}${rem ? ` ${rem} minute${rem>1?'s':''}` : ''} (${mins} minutes)`
                    : `${mins} minute${mins>1?'s':''}`;
                })()}
              </div>
              <div>
                <strong>Start Window:</strong> {test.startDate ? new Date(test.startDate).toLocaleString() : '—'}
              </div>
              <div>
                <strong>End Window:</strong> {test.endDate ? new Date(test.endDate).toLocaleString() : '—'}
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-600 leading-5">
              <strong>Important:</strong> Your answer is saved only when you click "Save Answer" for each question. If you finish/submit the test without saving, any unsaved content will not be recorded.
            </div>
          </div>

            {/* Start Button */}
            <div className="mt-8 text-center">
              <button
                onClick={startTest}
                disabled={!selectedDomain || uploading || hasExistingSession}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {uploading ? 'Starting Test...' : 'Start Test'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Test taking screen
  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      {/* Header with Timer */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">{test.title}</h2>
            <p className="text-gray-600">
              Domain: {domains.find(d => d._id === selectedDomain)?.name} | Section: {section}
            </p>
          </div>

          <div className="text-center">
            <div className="text-3xl font-mono font-bold text-[#552e81]">
              ⏱ {formatTime(remaining)}
            </div>
            <div className="text-sm text-gray-500">Time Remaining</div>
          </div>
        </div>
      </div>

      {/* Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-6 max-w-md mx-4">
            <div className="text-center">
              <div className="text-4xl mb-4">⚠️</div>
              <h3 className="text-xl font-bold text-yellow-800 mb-2">Time Warning!</h3>
              <p className="text-yellow-700 mb-4">
                You have less than 5 minutes remaining. Please submit your test soon or it will auto-submit.
              </p>
              <button
                onClick={() => setShowWarning(false)}
                className="bg-yellow-500 text-white px-6 py-2 rounded hover:bg-yellow-600"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Monitor */}
      <div className="bg-white rounded-lg shadow-lg p-4">
        <CameraMonitor 
          onError={() => { }}
          onStateChange={({ cameraGranted }) => {
            setCameraGranted(!!cameraGranted);
          }}
        />
      </div>

      {/* Questions */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-semibold mb-6">Questions - Section {section}</h3>

        <div className="space-y-8">
          {questions.map((question, index) => (
            <div key={question._id} className="border-b border-gray-200 pb-6 last:border-b-0">
              <div className="mb-4">
                <h4 className="text-lg font-medium text-gray-800 mb-2">
                  Question {index + 1}: {question.title}
                </h4>
                <div className="text-gray-700 whitespace-pre-wrap">{question.description}</div>
              </div>

              {/* Answer Section */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h5 className="font-medium mb-3">Type Your Answer:</h5>
                <div className="space-y-3">
                  {(!cameraGranted) && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                      Enable camera to continue test
                    </div>
                  )}
                  {/* Only camera gating remains */}
                  <div className="border border-gray-300 rounded-lg overflow-hidden">
                    <SimpleTextEditor
                      value={answers[question._id]?.answerText || ''}
                      onChange={(content) => handleAnswerTextChange(question._id, content)}
                      placeholder="Type your answer here... You can paste images directly!"
                      disabled={!cameraGranted}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      Text editor with image support
                    </div>
                    <button
                      onClick={() => handleTextSubmit(question._id)}
                      disabled={uploading || !cameraGranted}
                      className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      {uploading ? 'Saving...' : 'Save Answer'}
                    </button>
                  </div>

                  {answers[question._id]?.uploaded && (
                    <div className="flex items-center gap-2 text-green-600">
                      <span>✅</span>
                      <span className="text-sm">Answer saved successfully</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Submit Button */}
      <div className="bg-white rounded-lg shadow-lg p-6 text-center">
        <button
          onClick={handleSubmitTest}
          disabled={testSubmitted || uploading || !cameraGranted}
          className="bg-green-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {testSubmitted ? 'Test Submitted' : 'Finish Test'}
        </button>

        {testSubmitted && (
          <p className="text-green-600 mt-2">Test has been submitted successfully!</p>
        )}
      </div>
      {/* Out-of-frame and face warnings removed */}
    </div>
  );
}
