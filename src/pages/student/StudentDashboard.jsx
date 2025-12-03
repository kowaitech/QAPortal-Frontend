import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../utils/axios';
import { useDialog } from '../../components/DialogProvider';

export default function StudentDashboard() {
  const qc = useQueryClient();
  const dialog = useDialog();
  const [activeTab, setActiveTab] = useState('available');
  const [selectedTest, setSelectedTest] = useState(null);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [selectedSection, setSelectedSection] = useState('A');
  const [showTerms, setShowTerms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Fetch available tests (categorized)
  const { data: availableTests, isLoading: availableLoading } = useQuery({
    queryKey: ['student-tests'],
    queryFn: async () => (await api.get('/tests/student')).data,
  });

  // Fetch "Your Tests" (tests the student has started)
  const { data: yourTests, isLoading: yourTestsLoading } = useQuery({
    queryKey: ['your-tests'],
    queryFn: async () => (await api.get('/tests/student/my-tests')).data,
  });

  // Start test mutation
  const startTest = useMutation({
    mutationFn: ({ testId, domainId, section }) =>
      api.post(`/tests/${testId}/start`, { domainId, section }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['your-tests'] });
      // Redirect to test taking page or handle test start
      dialog.alert('Test started successfully!');
      setSelectedTest(null);
      setSelectedDomain('');
    },
    onError: (error) => {
      dialog.alert(error.response?.data?.message || 'Failed to start test');
    },
  });

  const handleStartTest = () => {
    if (!selectedDomain) {
      dialog.alert('Please select a domain');
      return;
    }
    startTest.mutate({
      testId: selectedTest._id,
      domainId: selectedDomain,
      section: selectedSection,
    });
  };

  const handleTestStart = (test) => {
    setSelectedTest(test);
    setShowTerms(true);
  };

  const acceptTerms = () => {
    setTermsAccepted(true);
    setShowTerms(false);
    // Navigate to test page
    window.location.href = `/student/take/${selectedTest._id}`;
  };

  const TestCard = ({ test, category, showDomainSelection = false, studentTest = null }) => {
    // Check if this test has an active session in "Your Tests"
    const hasActiveSession = yourTests?.active?.some(activeTest => 
      activeTest.test._id === test._id
    );

    const getStatusColor = (status) => {
      switch (status) {
        case 'inactive': return 'bg-yellow-100 text-yellow-800';
        case 'active': return 'bg-green-100 text-green-800';
        case 'finished': return 'bg-gray-100 text-gray-800';
        case 'in-progress': return 'bg-blue-100 text-blue-800';
        case 'completed': return 'bg-green-100 text-green-800';
        case 'expired': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
      }
    };

    const getStatusText = (status) => {
      switch (status) {
        case 'inactive': return 'Upcoming';
        case 'active': return 'Active';
        case 'finished': return 'Finished';
        case 'in-progress': return 'In Progress';
        case 'completed': return 'Completed';
        case 'expired': return 'Expired';
        default: return status;
      }
    };

    return (
      <div className="bg-white border rounded-lg p-4 shadow-sm">
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-semibold text-lg">{test.title}</h3>
          <div className="flex flex-col items-end space-y-1">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(studentTest?.status || test.status)}`}>
              {getStatusText(studentTest?.status || test.status)}
            </span>
            {hasActiveSession && (
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                In Progress
              </span>
            )}
          </div>
        </div>

        <div className="space-y-2 text-sm text-gray-600 mb-4">
          <div>
            <strong>Domains:</strong> {test.domains?.map(d => d.name).join(', ') || 'N/A'}
          </div>
          {studentTest?.selectedDomain && (
            <div>
              <strong>Selected Domain:</strong> {studentTest.selectedDomain.name}
            </div>
          )}
          <div>
            <strong>Duration:</strong> {test.durationMinutes || 60} minutes
          </div>
          <div>
            <strong>Start:</strong> {new Date(test.startDate).toLocaleString()}
          </div>
          <div>
            <strong>End:</strong> {new Date(test.endDate).toLocaleString()}
          </div>
          {studentTest?.startTime && (
            <div>
              <strong>Started:</strong> {new Date(studentTest.startTime).toLocaleString()}
            </div>
          )}
          {studentTest?.endTime && (
            <div>
              <strong>Submitted:</strong> {new Date(studentTest.endTime).toLocaleString()}
            </div>
          )}
        </div>

        {showDomainSelection && test.status === 'active' && (
          <>
            {hasActiveSession ? (
              <div className="space-y-2">
                <button
                  disabled
                  className="w-full bg-gray-400 text-white py-2 px-4 rounded cursor-not-allowed"
                >
                  Test In Progress
                </button>
                <div className="text-center">
                  <button
                    onClick={() => setActiveTab('your-tests')}
                    className="text-blue-600 hover:text-blue-800 text-sm underline"
                  >
                    Go to "Your Tests" to continue
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => handleTestStart(test)}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
              >
                Start Test
              </button>
            )}
          </>
        )}

        {studentTest?.status === 'in-progress' && (
          <button
            className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition-colors"
            onClick={() => {
              // Navigate to test taking page with continue parameter
              window.location.href = `/student/take/${studentTest.test._id}?continue=true`;
            }}
          >
            Continue Test
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50">
      <h1 className="text-2xl font-bold mb-4">Student Dashboard</h1>

      {/* Navigation Tabs */}
      <div className="flex space-x-4 border-b pb-2">
        <button
          onClick={() => setActiveTab('available')}
          className={`px-4 py-2 rounded-t-lg ${activeTab === 'available' ? 'bg-blue-600 text-white' : 'bg-gray-100'
            }`}
        >
          Available Tests
        </button>
        <button
          onClick={() => setActiveTab('your-tests')}
          className={`px-4 py-2 rounded-t-lg ${activeTab === 'your-tests' ? 'bg-blue-600 text-white' : 'bg-gray-100'
            }`}
        >
          Your Tests
        </button>
      </div>

      {/* Available Tests Tab */}
      {activeTab === 'available' && (
        <div className="space-y-6">
          {availableLoading ? (
            <div className="text-center py-8">Loading available tests...</div>
          ) : (
            <>
              {/* Upcoming Tests */}
              <div>
                <h2 className="text-xl font-semibold mb-4 text-yellow-700">Upcoming Tests</h2>
                {availableTests?.upcoming?.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {availableTests.upcoming.map((test) => (
                      <TestCard key={test._id} test={test} category="upcoming" />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white p-6 rounded-lg text-center text-gray-500">
                    No upcoming tests
                  </div>
                )}
              </div>

              {/* Active Tests */}
              <div>
                <h2 className="text-xl font-semibold mb-4 text-green-700">Active Tests</h2>
                {availableTests?.active?.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {availableTests.active.map((test) => (
                      <TestCard key={test._id} test={test} category="active" showDomainSelection={true} />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white p-6 rounded-lg text-center text-gray-500">
                    No active tests available
                  </div>
                )}
              </div>

              {/* Completed Tests */}
              <div>
                <h2 className="text-xl font-semibold mb-4 text-gray-700">Completed Tests</h2>
                {availableTests?.completed?.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {availableTests.completed.map((test) => (
                      <TestCard key={test._id} test={test} category="completed" />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white p-6 rounded-lg text-center text-gray-500">
                    No completed tests
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Your Tests Tab */}
      {activeTab === 'your-tests' && (
        <div className="space-y-6">
          {yourTestsLoading ? (
            <div className="text-center py-8">Loading your tests...</div>
          ) : (
            <>
              {/* Upcoming Your Tests */}
              <div>
                <h2 className="text-xl font-semibold mb-4 text-yellow-700">Your Upcoming Tests</h2>
                {yourTests?.upcoming?.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {yourTests.upcoming.map((studentTest) => (
                      <TestCard
                        key={studentTest._id}
                        test={studentTest.test}
                        category="upcoming"
                        studentTest={studentTest}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white p-6 rounded-lg text-center text-gray-500">
                    No upcoming tests in your queue
                  </div>
                )}
              </div>

              {/* Active Your Tests */}
              <div>
                <h2 className="text-xl font-semibold mb-4 text-blue-700">Your Active Tests</h2>
                {yourTests?.active?.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {yourTests.active.map((studentTest) => (
                      <TestCard
                        key={studentTest._id}
                        test={studentTest.test}
                        category="active"
                        studentTest={studentTest}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white p-6 rounded-lg text-center text-gray-500">
                    No tests currently in progress
                  </div>
                )}
              </div>

              {/* Completed Your Tests */}
              <div>
                <h2 className="text-xl font-semibold mb-4 text-green-700">Your Completed Tests</h2>
                {yourTests?.completed?.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {yourTests.completed.map((studentTest) => (
                      <TestCard
                        key={studentTest._id}
                        test={studentTest.test}
                        category="completed"
                        studentTest={studentTest}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white p-6 rounded-lg text-center text-gray-500">
                    No completed tests yet
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Terms and Conditions Modal */}
      {showTerms && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-semibold mb-6 text-center">Terms and Conditions</h3>

            <div className="space-y-4 mb-6 text-sm">
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <h4 className="font-semibold text-red-800 mb-2">⚠️ IMPORTANT - READ CAREFULLY</h4>
                <p className="text-red-700">
                  By accepting these terms, you agree to the following conditions for taking this test.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-lg">Test Rules and Regulations:</h4>

                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-red-500 font-bold">1.</span>
                    <p><strong>Test Duration:</strong> The test will automatically submit after the scheduled duration from when you start.</p>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-red-500 font-bold">2.</span>
                    <p><strong>Camera Monitoring:</strong> Your webcam will be continuously active during the entire test duration for security purposes.</p>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-red-500 font-bold">3.</span>
                    <p><strong>Motion Detection:</strong> Advanced motion detection technology will monitor your movements. Excessive movement may result in test termination.</p>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-red-500 font-bold">4.</span>
                    <p><strong>Tab Switching Prohibition:</strong> You must not switch browser tabs or leave the test window. This will be detected and may result in immediate test termination.</p>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-red-500 font-bold">5.</span>
                    <p><strong>Answer Requirements:</strong> You must provide text answers for each question. Type your answers directly in the text area provided.</p>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-red-500 font-bold">6.</span>
                    <p><strong>Test Integrity:</strong> Any attempt to cheat, copy, or violate these terms will result in immediate disqualification and potential academic consequences.</p>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-red-500 font-bold">7.</span>
                    <p><strong>Technical Requirements:</strong> Ensure your webcam, microphone, and internet connection are stable before starting the test.</p>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mt-4">
                  <h5 className="font-semibold text-blue-800 mb-2">📋 Test Information:</h5>
                  <p className="text-blue-700">
                    <strong>Test:</strong> {selectedTest?.title}<br />
                    <strong>Duration:</strong> {selectedTest?.durationMinutes || 60} minutes<br />
                    <strong>Questions:</strong> 5 questions with text answer requirements<br />
                    <strong>Auto-submit:</strong> Enabled after scheduled duration
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={acceptTerms}
                className="flex-1 bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                ✅ I Accept Terms and Start Test
              </button>
              <button
                onClick={() => setShowTerms(false)}
                className="flex-1 bg-gray-300 text-gray-700 py-3 px-6 rounded-lg hover:bg-gray-400 transition-colors font-medium"
              >
                ❌ Decline and Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instructions card removed per request */}
    </div>
  );
}
