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

    const status = studentTest?.status || test.status;
    const statusColor = getStatusColor(status);
    
    return (
      <div className="group relative bg-white border-2 border-gray-200 rounded-xl p-6 shadow-md hover:shadow-xl hover:border-purple-300 transition-all duration-300 overflow-hidden">
        {/* Color-coded accent bar */}
        <div className={`absolute top-0 left-0 right-0 h-1.5 ${
          status === 'active' ? 'bg-green-500' :
          status === 'inactive' ? 'bg-yellow-500' :
          status === 'completed' ? 'bg-blue-500' :
          status === 'in-progress' ? 'bg-orange-500' :
          'bg-gray-400'
        }`}></div>
        
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1 min-w-0 pr-3">
            <h3 className="font-bold text-xl text-gray-900 mb-2 line-clamp-2">{test.title}</h3>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-sm ${statusColor}`}>
                {getStatusText(status)}
              </span>
              {hasActiveSession && (
                <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-orange-100 text-orange-800 shadow-sm flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  In Progress
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3 text-sm mb-6 border-t border-gray-100 pt-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <div className="flex-1">
              <span className="text-gray-500 font-medium block mb-1">Domains</span>
              <span className="text-gray-800 font-semibold">{test.domains?.map(d => d.name).join(', ') || 'N/A'}</span>
            </div>
          </div>
          {studentTest?.selectedDomain && (
            <div className="flex items-start gap-3 bg-purple-50 p-3 rounded-lg">
              <svg className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <span className="text-gray-500 font-medium block mb-1">Selected Domain</span>
                <span className="text-purple-700 font-bold">{studentTest.selectedDomain.name}</span>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <span className="text-gray-500 text-xs block">Duration</span>
                <span className="text-gray-800 font-semibold text-sm">{test.durationMinutes || 60} min</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div>
                <span className="text-gray-500 text-xs block">Start Date</span>
                <span className="text-gray-800 font-semibold text-sm">{new Date(test.startDate).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          {studentTest?.startTime && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-xs font-medium">Started: {new Date(studentTest.startTime).toLocaleString()}</span>
              </div>
            </div>
          )}
          {studentTest?.endTime && (
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="flex items-center gap-2 text-green-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs font-medium">Submitted: {new Date(studentTest.endTime).toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        {showDomainSelection && test.status === 'active' && (
          <>
            {hasActiveSession ? (
              <div className="space-y-3">
                <button
                  disabled
                  className="w-full bg-gray-200 text-gray-500 py-3 px-4 rounded-xl cursor-not-allowed font-semibold shadow-sm"
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Test In Progress
                  </span>
                </button>
                <div className="text-center">
                  <button
                    onClick={() => setActiveTab('your-tests')}
                    className="text-[#552e81] hover:text-[#4b2a72] text-sm font-semibold underline transition-colors"
                  >
                    Go to "Your Tests" to continue →
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => handleTestStart(test)}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 px-4 rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all font-bold shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Start Test
                </span>
              </button>
            )}
          </>
        )}

        {studentTest?.status === 'in-progress' && (
          <button
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 px-4 rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all font-bold shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
            onClick={() => {
              // Navigate to test taking page with continue parameter
              window.location.href = `/student/take/${studentTest.test._id}?continue=true`;
            }}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Continue Test
            </span>
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6 min-h-screen bg-[#F9FAFB]">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-8 text-white shadow-lg mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-1">Student Dashboard</h1>
            <p className="text-purple-100 text-sm">View and manage your tests</p>
          </div>
        </div>
      </div>

      {/* Enhanced Navigation Tabs */}
      <div className="flex space-x-2 border-b-2 border-gray-200 pb-0 mb-6">
        <button
          onClick={() => setActiveTab('available')}
          className={`px-6 py-3 rounded-t-xl font-semibold transition-all relative ${
            activeTab === 'available' 
              ? 'bg-[#552e81] text-white shadow-lg' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Available Tests
          </span>
          {activeTab === 'available' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#552e81]"></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('your-tests')}
          className={`px-6 py-3 rounded-t-xl font-semibold transition-all relative ${
            activeTab === 'your-tests' 
              ? 'bg-[#552e81] text-white shadow-lg' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Your Tests
          </span>
          {activeTab === 'your-tests' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#552e81]"></div>
          )}
        </button>
      </div>

      {/* Available Tests Tab */}
      {activeTab === 'available' && (
        <div className="space-y-8">
          {availableLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#552e81]"></div>
              <p className="mt-4 text-gray-600">Loading available tests...</p>
            </div>
          ) : (
            <>
              {/* Upcoming Tests */}
              <div>
                <h2 className="text-2xl font-bold mb-6 text-gray-900 flex items-center gap-3">
                  <div className="w-1 h-8 bg-gradient-to-b from-yellow-400 to-yellow-600 rounded-full"></div>
                  <span>Upcoming Tests</span>
                  {availableTests?.upcoming?.length > 0 && (
                    <span className="ml-auto px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-semibold">
                      {availableTests.upcoming.length}
                    </span>
                  )}
                </h2>
                {availableTests?.upcoming?.length > 0 ? (
                  <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {availableTests.upcoming.map((test) => (
                      <TestCard key={test._id} test={test} category="upcoming" />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white p-12 rounded-xl text-center border-2 border-dashed border-gray-300 shadow-sm">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 mb-4">
                      <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-500 font-medium">No upcoming tests</p>
                    <p className="text-gray-400 text-sm mt-1">Check back later for new tests</p>
                  </div>
                )}
              </div>

              {/* Active Tests */}
              <div>
                <h2 className="text-2xl font-bold mb-6 text-gray-900 flex items-center gap-3">
                  <div className="w-1 h-8 bg-gradient-to-b from-green-400 to-green-600 rounded-full"></div>
                  <span>Active Tests</span>
                  {availableTests?.active?.length > 0 && (
                    <span className="ml-auto px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                      {availableTests.active.length}
                    </span>
                  )}
                </h2>
                {availableTests?.active?.length > 0 ? (
                  <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {availableTests.active.map((test) => (
                      <TestCard key={test._id} test={test} category="active" showDomainSelection={true} />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white p-8 rounded-xl text-center text-gray-500 border border-gray-200 shadow-sm">
                    <p className="text-gray-400">No active tests available</p>
                  </div>
                )}
              </div>

              {/* Completed Tests */}
              <div>
                <h2 className="text-2xl font-bold mb-6 text-gray-900 flex items-center gap-3">
                  <div className="w-1 h-8 bg-gradient-to-b from-gray-400 to-gray-600 rounded-full"></div>
                  <span>Completed Tests</span>
                  {availableTests?.completed?.length > 0 && (
                    <span className="ml-auto px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-semibold">
                      {availableTests.completed.length}
                    </span>
                  )}
                </h2>
                {availableTests?.completed?.length > 0 ? (
                  <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {availableTests.completed.map((test) => (
                      <TestCard key={test._id} test={test} category="completed" />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white p-8 rounded-xl text-center text-gray-500 border border-gray-200 shadow-sm">
                    <p className="text-gray-400">No completed tests</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Your Tests Tab */}
      {activeTab === 'your-tests' && (
        <div className="space-y-8">
          {yourTestsLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#552e81]"></div>
              <p className="mt-4 text-gray-600">Loading your tests...</p>
            </div>
          ) : (
            <>
              {/* Upcoming Your Tests */}
              <div>
                <h2 className="text-2xl font-bold mb-6 text-gray-900 flex items-center gap-3">
                  <div className="w-1 h-8 bg-gradient-to-b from-yellow-400 to-yellow-600 rounded-full"></div>
                  <span>Your Upcoming Tests</span>
                  {yourTests?.upcoming?.length > 0 && (
                    <span className="ml-auto px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-semibold">
                      {yourTests.upcoming.length}
                    </span>
                  )}
                </h2>
                {yourTests?.upcoming?.length > 0 ? (
                  <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
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
                  <div className="bg-white p-12 rounded-xl text-center border-2 border-dashed border-gray-300 shadow-sm">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 mb-4">
                      <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-500 font-medium">No upcoming tests in your queue</p>
                    <p className="text-gray-400 text-sm mt-1">Tests you start will appear here</p>
                  </div>
                )}
              </div>

              {/* Active Your Tests */}
              <div>
                <h2 className="text-2xl font-bold mb-6 text-gray-900 flex items-center gap-3">
                  <div className="w-1 h-8 bg-gradient-to-b from-blue-400 to-blue-600 rounded-full"></div>
                  <span>Your Active Tests</span>
                  {yourTests?.active?.length > 0 && (
                    <span className="ml-auto px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                      {yourTests.active.length}
                    </span>
                  )}
                </h2>
                {yourTests?.active?.length > 0 ? (
                  <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
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
                  <div className="bg-white p-12 rounded-xl text-center border-2 border-dashed border-gray-300 shadow-sm">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
                      <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <p className="text-gray-500 font-medium">No tests currently in progress</p>
                    <p className="text-gray-400 text-sm mt-1">Start a test to see it here</p>
                  </div>
                )}
              </div>

              {/* Completed Your Tests */}
              <div>
                <h2 className="text-2xl font-bold mb-6 text-gray-900 flex items-center gap-3">
                  <div className="w-1 h-8 bg-gradient-to-b from-green-400 to-green-600 rounded-full"></div>
                  <span>Your Completed Tests</span>
                  {yourTests?.completed?.length > 0 && (
                    <span className="ml-auto px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                      {yourTests.completed.length}
                    </span>
                  )}
                </h2>
                {yourTests?.completed?.length > 0 ? (
                  <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
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
                  <div className="bg-white p-12 rounded-xl text-center border-2 border-dashed border-gray-300 shadow-sm">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-500 font-medium">No completed tests yet</p>
                    <p className="text-gray-400 text-sm mt-1">Completed tests will appear here</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Terms and Conditions Modal */}
      {showTerms && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200">
            <h3 className="text-2xl font-bold mb-6 text-center text-gray-900">Terms and Conditions</h3>

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

            <div className="flex gap-3 mt-6">
              <button
                onClick={acceptTerms}
                className="flex-1 bg-green-600 text-white py-3 px-6 rounded-xl hover:bg-green-700 transition-colors font-semibold shadow-md"
              >
                ✅ I Accept Terms and Start Test
              </button>
              <button
                onClick={() => setShowTerms(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-xl hover:bg-gray-300 transition-colors font-semibold"
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
