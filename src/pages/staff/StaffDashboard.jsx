import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { api } from '../../utils/axios';
import { useDialog } from '../../components/DialogProvider';
import SimpleTextEditor from '../../components/SimpleTextEditor';

export default function StaffDashboard() {
  const dialog = useDialog();
  // lightweight toast just for this page
  const [toasts, setToasts] = useState([]);
  const showToast = (message, type = 'info', duration = 3000) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  };

  const [domains, setDomains] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [studentAnswers, setStudentAnswers] = useState([]);
  const [domainTests, setDomainTests] = useState([]);
  const [selectedTestId, setSelectedTestId] = useState('');
  const [markFilter, setMarkFilter] = useState('all'); // all | marked | unmarked
  const [sortMode, setSortMode] = useState('default'); // default | recent | dateDesc | dateAsc
  const [selectedDate, setSelectedDate] = useState(''); // YYYY-MM-DD
  const [completedUsers, setCompletedUsers] = useState([]);
  const [name, setName] = useState('');
  const [qform, setQform] = useState({
    title: '',
    description: '',
    section: 'A',
    difficulty: 'medium',
    answerText: ''
  });
  const [loading, setLoading] = useState(false);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);

  // Fetch domains
  const fetchDomains = async () => {
    try {
      const { data } = await api.get('/domains');
      setDomains(data.domains || []);
    } catch (e) {
      console.error("Fetch Domains Error:", e.response?.data || e.message);
    }
  };

  // Fetch questions for a domain
  const fetchQuestions = async (domainId) => {
    try {
      const { data } = await api.get(`/questions/domain/${domainId}`);
      setQuestions(data.questions || []);
    } catch (e) {
      console.error("Fetch Questions Error:", e.response?.data || e.message);
    }
  };

  // Fetch student answers for a domain
  const fetchStudentAnswers = async (domainId, testId) => {
    try {
      const { data } = await api.get(`/domains/${domainId}/answers${testId ? `?testId=${testId}` : ''}`);
      setStudentAnswers(data.answers || []);
    } catch (e) {
      console.error("Fetch Student Answers Error:", e.response?.data || e.message);
    }
  };

  useEffect(() => {
    fetchDomains();
  }, []);

  // Add domain
  const addDomain = async () => {
    if (!name) { showToast('Enter domain name', 'info'); return; }
    setLoading(true);
    try {
      await api.post('/domains', { name });
      setName('');
      fetchDomains();
    } catch (e) {
      console.error("Add Domain Error:", e.response?.data || e.message);
      showToast(e.response?.data?.message || 'Error adding domain', 'error');
    } finally { setLoading(false); }
  };

  // Delete domain
  const deleteDomain = async (id) => {
    const ok = await dialog.confirm('Delete domain? This will also delete all questions and student answers.');
    if (!ok) return;
    try {
      await api.delete('/domains/' + id);
      fetchDomains();
      if (selectedDomain && selectedDomain._id === id) {
        setSelectedDomain(null);
        setQuestions([]);
        setStudentAnswers([]);
      }
    } catch (e) {
      console.error("Delete Domain Error:", e.response?.data || e.message);
      showToast(e.response?.data?.message || 'Error deleting domain', 'error');
    }
  };

  // Create or update question
  const createQuestion = async () => {
    if (!qform.title || !qform.description || !selectedDomain) {
      showToast('Fill title, description and select a domain', 'info');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title: qform.title,
        description: qform.description,
        section: qform.section,
        difficulty: qform.difficulty,
        answerText: qform.answerText
      };

      if (editingQuestion) {
        await api.put(`/questions/${editingQuestion._id}`, payload);
        showToast('Question updated successfully', 'success');
      } else {
        await api.post(`/questions/domain/${selectedDomain._id}`, payload);
        showToast('Question created successfully', 'success');
      }

      setQform({
        title: '',
        description: '',
        section: 'A',
        difficulty: 'medium',
        answerText: ''
      });
      setShowQuestionForm(false);
      setEditingQuestion(null);
      fetchQuestions(selectedDomain._id);
      fetchDomains(); // Refresh to update question counts
    } catch (e) {
      console.error("Create/Update Question Error:", e.response?.data || e.message);
      showToast(e.response?.data?.message || 'Error saving question', 'error');
    } finally { setLoading(false); }
  };

  // Edit question
  const editQuestion = (question) => {
    setQform({
      title: question.title,
      description: question.description,
      section: question.section,
      difficulty: question.difficulty,
      answerText: question.answerText || ''
    });
    setEditingQuestion(question);
    setShowQuestionForm(true);
  };

  // Delete question
  const deleteQuestion = async (questionId) => {
    const ok = await dialog.confirm('Delete this question? This action cannot be undone.');
    if (!ok) return;

    setLoading(true);
    try {
      await api.delete(`/questions/${questionId}`);
      showToast('Question deleted successfully', 'success');
      fetchQuestions(selectedDomain._id);
      fetchDomains(); // Refresh to update question counts
    } catch (e) {
      console.error("Delete Question Error:", e.response?.data || e.message);
      showToast(e.response?.data?.message || 'Error deleting question', 'error');
    } finally { setLoading(false); }
  };

  // Cancel editing
  const cancelEdit = () => {
    setQform({
      title: '',
      description: '',
      section: 'A',
      difficulty: 'medium',
      answerText: ''
    });
    setEditingQuestion(null);
    setShowQuestionForm(false);
  };

  // Handle domain selection
  const handleDomainSelect = (domain) => {
    setSelectedDomain(domain);
    setShowQuestionForm(false);
    setShowAnswers(false);
    fetchQuestions(domain._id);
  };

  // Handle view student answers
  const handleViewAnswers = (domain) => {
    setSelectedDomain(domain);
    setShowAnswers(true);
    setShowQuestionForm(false);
    fetchStudentAnswers(domain._id, '');
    // load tests for filter
    api.get(`/domains/${domain._id}/tests`).then(({ data }) => setDomainTests(data.tests || [])).catch(() => setDomainTests([]));
    setSelectedTestId('');
  };

  const handleApplyFilter = () => {
    if (!selectedDomain) return;
    fetchStudentAnswers(selectedDomain._id, selectedTestId || '');
    api.get(`/domains/${selectedDomain._id}/completed-users${selectedTestId ? `?testId=${selectedTestId}` : ''}`)
      .then(({ data }) => setCompletedUsers(data.users || []))
      .catch(() => setCompletedUsers([]));
  };

  const addMark = async (answerId) => {
    const m = await dialog.prompt('Enter mark for this answer:', { defaultValue: '0' });
    if (m == null || m === false) return; // cancelled
    const mark = Number(m);
    if (Number.isNaN(mark) || mark < 0) {
      await dialog.alert('Please enter a non-negative number');
      return;
    }
    try {
      const { data } = await api.post('/student-answers/marks/add', { answerId, mark });
      showToast(data.message || 'Mark saved successfully', 'success');
      // update in UI
      setStudentAnswers(prev => prev.map(s => ({
        ...s,
        sections: {
          A: s.sections.A.map(a => a._id === answerId ? { ...a, mark, markSubmitted: true } : a),
          B: s.sections.B.map(a => a._id === answerId ? { ...a, mark, markSubmitted: true } : a)
        }
      })));
    } catch (e) {
      console.error('Add mark error', e.response?.data || e.message);
      dialog.alert(e.response?.data?.message || 'Failed to add mark');
    }
  };

  const editMark = async (answerId, currentMark) => {
    const m = await dialog.prompt('Edit mark for this answer:', { defaultValue: String(currentMark) });
    if (m == null || m === false) return; // cancelled
    const mark = Number(m);
    if (Number.isNaN(mark) || mark < 0) {
      await dialog.alert('Please enter a non-negative number');
      return;
    }
    try {
      const { data } = await api.put(`/student-answers/marks/edit/${answerId}`, { mark });
      showToast(data.message || 'Mark updated successfully', 'success');
      // update in UI
      setStudentAnswers(prev => prev.map(s => ({
        ...s,
        sections: {
          A: s.sections.A.map(a => a._id === answerId ? { ...a, mark } : a),
          B: s.sections.B.map(a => a._id === answerId ? { ...a, mark } : a)
        }
      })));
    } catch (e) {
      console.error('Edit mark error', e.response?.data || e.message);
      dialog.alert(e.response?.data?.message || 'Failed to update mark');
    }
  };

  const calculateTotalForStudent = async (studentId) => {
    if (!selectedDomain) return;
    try {
      const { data } = await api.post('/student-answers/calculate-total', {
        studentId,
        domainId: selectedDomain._id,
        testId: selectedTestId || undefined
      });
      showToast(`Total calculated: ${data.total}`, 'success');
      // attach total onto that student's card for display
      setStudentAnswers(prev => prev.map(s => s.student._id === studentId ? { ...s, totalMark: data.total } : s));
    } catch (e) {
      console.error('Calculate total error', e.response?.data || e.message);
      dialog.alert(e.response?.data?.message || 'Failed to calculate total');
    }
  };

  // Delete image from student answer
  const deleteImageFromAnswer = async (imageUrl, answerId) => {
    try {
      console.log('Deleting image URL:', imageUrl);
      
      // Call the backend endpoint which handles both Cloudinary and database deletion
      const response = await api.delete(`/student-answers/answers/image/${answerId}`, { 
        data: { imageUrl } 
      });
      
      console.log('Image deletion response:', response.data);
      showToast(response.data.message || 'Answer image deleted successfully', 'success');

      // Refresh the answers to show updated content
      if (selectedDomain) {
        fetchStudentAnswers(selectedDomain._id, selectedTestId || '');
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Failed to delete image';
      showToast(errorMessage, 'error');
    }
  };

  // Extract public ID from Cloudinary URL
  const extractPublicIdFromUrl = (url) => {
    console.log('Extracting public ID from URL:', url);
    
    if (!url) {
      console.log('No URL provided');
      return null;
    }
    
    // Handle base64 data URLs
    if (url.startsWith('data:')) {
      console.log('Base64 data URL detected');
      return null;
    }
    
    // Handle Cloudinary URLs
    if (!url.includes('cloudinary.com')) {
      console.log('Not a Cloudinary URL');
      return null;
    }

    try {
      const parts = url.split('/');
      const filename = parts[parts.length - 1];
      const publicId = filename.split('.')[0];

      // Reconstruct the full public ID with folder
      const folderIndex = url.indexOf('/exam-answers/');
      if (folderIndex !== -1) {
        const folderPath = url.substring(folderIndex + 1, url.lastIndexOf('/'));
        const fullPublicId = `${folderPath}/${publicId}`;
        console.log('Extracted public ID with folder:', fullPublicId);
        return fullPublicId;
      }

      console.log('Extracted public ID without folder:', publicId);
      return publicId;
    } catch (error) {
      console.error('Error extracting public ID:', error);
      return null;
    }
  };

  const allStudentsHaveTotals = studentAnswers.length > 0 && studentAnswers.every(s => typeof s.totalMark === 'number');

  // Build CSV strings for Excel (compatible)
  const downloadAnswersExcel = () => {
    if (!selectedDomain) return;
    const maxQ = Math.max(0, ...studentAnswers.map(s => (s.sections.A.length + s.sections.B.length)));
    const headers = ['Username', 'Email', ...Array.from({ length: maxQ }, (_, i) => `Q${i + 1} Mark`), 'Total'];

    const data = studentAnswers.map(s => {
      const marks = [...s.sections.A, ...s.sections.B].map(a => a.mark ?? 0);
      while (marks.length < maxQ) marks.push('');
      return { Username: s.student.name, 'User Email': s.student.email, ...Object.fromEntries(marks.map((m, i) => [`Q${i + 1} Mark`, m])), 'Total Mark': s.totalMark ?? '' };
    });

    const ws = XLSX.utils.json_to_sheet(data, { header: ['Username', 'User Email', ...Array.from({ length: maxQ }, (_, i) => `Q${i + 1} Mark`), 'Total Mark'] });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Answers & Marks');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const testPart = selectedTestId ? `_${domainTests.find(t => t._id === selectedTestId)?.title || 'test'}` : '';
    saveAs(blob, `answers_marks_${selectedDomain.name}${testPart}.xlsx`);
  };

  const downloadCompletedUsersExcel = () => {
    const data = completedUsers.map(u => ({ Username: u.student?.name || '', 'User Email': u.student?.email || '', 'Test Title': u.test?.title || '' }));
    const ws = XLSX.utils.json_to_sheet(data, { header: ['Username', 'User Email', 'Test Title'] });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Completed Users');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const testPart = selectedTestId ? `_${domainTests.find(t => t._id === selectedTestId)?.title || 'test'}` : '';
    const domainPart = selectedDomain ? `_${selectedDomain.name}` : '';
    saveAs(blob, `completed_users${domainPart}${testPart}.xlsx`);
  };

  return (
    <div className="grid gap-6">
      {/* Page toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-2 rounded-xl shadow-lg text-sm text-white backdrop-blur ${t.type === 'error' ? 'bg-red-600/90' : t.type === 'success' ? 'bg-green-600/90' : 'bg-blue-600/90'}`}>
            {t.message}
          </div>
        ))}
      </div>
      {/* Header */}
      <div className="card">
        <h2 className="text-2xl font-semibold mb-4">Staff Dashboard</h2>
        <p className="text-gray-600 mb-4">Manage domains, questions, and view student submissions.</p>
      </div>

      {/* Domain Management */}
      <div className="card">
        <h3 className="text-xl font-semibold mb-4">Domain Management</h3>

        {/* Add Domain */}
        <div className="flex gap-2 mb-4">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="New domain name"
            className="input flex-1"
          />
          <button
            className="btn-primary"
            onClick={addDomain}
            disabled={loading}
          >
            Add Domain
          </button>
        </div>

        {/* Domains List */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {domains.map(domain => (
            <div key={domain._id} className="p-4 border rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold">{domain.name}</h4>
                {domain.canEdit && (
                  <button
                    className="text-sm text-red-600 hover:text-red-800"
                    onClick={() => deleteDomain(domain._id)}
                  >
                    Delete
                  </button>
                )}
              </div>

              <p className="text-sm text-gray-600 mb-2">
                Created by: {domain.createdBy.name}
              </p>

              <div className="text-sm text-gray-600 mb-3">
                Section A: {domain.questionCounts.sectionA}/5 questions<br />
                Section B: {domain.questionCounts.sectionB}/5 questions
              </div>

              <div className="flex gap-2">
                {domain.canEdit && (
                  <button
                    className="btn-primary text-sm"
                    onClick={() => handleDomainSelect(domain)}
                  >
                    Manage Questions
                  </button>
                )}
                <button
                  className="btn-secondary text-sm"
                  onClick={() => handleViewAnswers(domain)}
                >
                  View Answers
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Question Management */}
      {selectedDomain && !showAnswers && (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">
              Questions for "{selectedDomain.name}"
            </h3>
            <button
              className="btn-primary"
              onClick={() => setShowQuestionForm(!showQuestionForm)}
            >
              {showQuestionForm ? 'Cancel' : 'Add Question'}
            </button>
          </div>

          {/* Add/Edit Question Form */}
          {/* {showQuestionForm && (
            <div className="p-4 border rounded-lg mb-4">
              <h4 className="font-semibold mb-3">
                {editingQuestion ? 'Edit Question' : 'Add New Question'}
              </h4>
              
              <input 
                placeholder="Question Title" 
                value={qform.title} 
                onChange={e=>setQform({...qform, title:e.target.value})} 
                className="input mb-3" 
              />
              
              <textarea 
                placeholder="Question Description" 
                value={qform.description} 
                onChange={e=>setQform({...qform, description:e.target.value})} 
                className="input mb-3" 
                rows={4} 
              />
              
              <div className="flex gap-2 mb-3">
                <select 
                  value={qform.section} 
                  onChange={e=>setQform({...qform, section:e.target.value})} 
                  className="input"
                >
                  <option value="A">Section A</option>
                  <option value="B">Section B</option>
                </select>
                
                <select 
                  value={qform.difficulty} 
                  onChange={e=>setQform({...qform, difficulty:e.target.value})} 
                  className="input"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">
                  Answer File (Optional)
                </label>
                <input 
                  type="file"
                  onChange={e=>setQform({...qform, answerFile:e.target.files[0]})}
                  className="input"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                />
              </div>
              
              <div className="flex gap-2">
                <button 
                  className="btn-primary" 
                  onClick={createQuestion} 
                  disabled={loading}
                >
                  {editingQuestion ? 'Update Question' : 'Create Question'}
                </button>
                {editingQuestion && (
                  <button 
                    className="btn-secondary" 
                    onClick={cancelEdit}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )} */}

          {/* Add/Edit Question Form */}
          {showQuestionForm && (
            <div className="p-4 border rounded-lg mb-4">
              <h4 className="font-semibold mb-3">
                {editingQuestion ? 'Edit Question' : 'Add New Question'}
              </h4>

              <input
                placeholder="Question Title"
                value={qform.title}
                onChange={e => setQform({ ...qform, title: e.target.value })}
                className="input mb-3"
              />

              <textarea
                placeholder="Question Description"
                value={qform.description}
                onChange={e => setQform({ ...qform, description: e.target.value })}
                className="input mb-3"
                rows={4}
              />

              <div className="flex gap-2 mb-3">
                <select
                  value={qform.section}
                  onChange={e => setQform({ ...qform, section: e.target.value })}
                  className="input"
                >
                  <option value="A">Section A</option>
                  <option value="B">Section B</option>
                </select>

                <select
                  value={qform.difficulty}
                  onChange={e => setQform({ ...qform, difficulty: e.target.value })}
                  className="input"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              {/* Answer Textarea for reference answer (optional) */}
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">
                  Reference Answer (Optional)
                </label>
                <textarea
                  placeholder="Enter reference answer (optional)"
                  value={qform.answerText}
                  onChange={e => setQform({ ...qform, answerText: e.target.value })}
                  className="input"
                  rows={4}
                />
              </div>

              <div className="flex gap-2">
                <button
                  className="btn-primary"
                  onClick={createQuestion}
                  disabled={loading}
                >
                  {editingQuestion ? 'Update Question' : 'Create Question'}
                </button>
                {editingQuestion && (
                  <button
                    className="btn-secondary"
                    onClick={cancelEdit}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}


          {/* Questions List */}
          <div className="space-y-3">
            {questions.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No questions added yet</p>
            ) : (
              questions.map(question => (
                <div key={question._id} className="p-3 border rounded">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h5 className="font-medium">{question.title}</h5>
                      <p className="text-sm text-gray-600 mt-1">{question.description}</p>
                      <div className="flex gap-4 mt-2 text-xs text-gray-500">
                        <span>Section {question.section}</span>
                        <span className="capitalize">{question.difficulty}</span>
                        {question.answerText && (
                          <span>📝 Has reference answer</span>
                        )}
                        {question.answerText && (
                          <span className="truncate max-w-[300px]">Preview: {question.answerText}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        className="text-sm text-blue-600 hover:text-blue-800"
                        onClick={() => editQuestion(question)}
                        disabled={loading}
                      >
                        Edit
                      </button>
                      <button
                        className="text-sm text-red-600 hover:text-red-800"
                        onClick={() => deleteQuestion(question._id)}
                        disabled={loading}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Student Answers */}
      {selectedDomain && showAnswers && (
        <div className="card">
          <h3 className="text-xl font-semibold mb-4">
            Student Answers for "{selectedDomain.name}"
          </h3>

          {/* Filters */}
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            <select value={selectedTestId} onChange={e => setSelectedTestId(e.target.value)} className="input max-w-xs">
              <option value="">All tests in this domain</option>
              {domainTests.map(t => (
                <option key={t._id} value={t._id}>{t.title}</option>
              ))}
            </select>
            <button className="btn-secondary" onClick={handleApplyFilter}>Apply Filter</button>

            <select value={markFilter} onChange={e => setMarkFilter(e.target.value)} className="input max-w-xs">
              <option value="all">All answers</option>
              <option value="marked">Marked only</option>
              <option value="unmarked">Unmarked only</option>
            </select>

            <select value={sortMode} onChange={e => setSortMode(e.target.value)} className="input max-w-xs">
              <option value="default">Sort: Default</option>
              <option value="recent">Sort: Recently updated</option>
              <option value="dateDesc">Sort: Date (Newest first)</option>
              <option value="dateAsc">Sort: Date (Oldest first)</option>
            </select>

            {/* Date filter (answers submitted/updated on a specific date) */}
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="input"
              title="Filter answers by specific date"
            />
            {selectedDate && (
              <button className="btn-secondary" onClick={() => setSelectedDate('')}>Clear Date</button>
            )}
            <button className={`btn-primary ${!allStudentsHaveTotals ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={!allStudentsHaveTotals} onClick={downloadAnswersExcel} title={!allStudentsHaveTotals ? 'Please enter marks for all questions before downloading.' : ''}>
              Download Answers & Marks
            </button>
            <button className="btn-secondary" onClick={downloadCompletedUsersExcel}>
              Download Completed Users
            </button>
          </div>

          {studentAnswers.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No student submissions yet</p>
          ) : (
            <div className="space-y-6">
              {(
                // Optionally sort students by aggregated timestamps
                (() => {
                  const arr = [...studentAnswers];
                  const maxTs = (s, field) => {
                    const all = [...s.sections.A, ...s.sections.B];
                    const pick = (a) => new Date((field === 'updated' ? (a.updatedAt || a.submittedAt) : (a.submittedAt || a.updatedAt))).getTime();
                    return all.length ? Math.max(...all.map(pick)) : 0;
                  };
                  if (sortMode === 'recent' || sortMode === 'dateDesc') {
                    return arr.sort((a, b) => maxTs(b, 'updated') - maxTs(a, 'updated'));
                  }
                  if (sortMode === 'dateAsc') {
                    return arr.sort((a, b) => maxTs(a, 'updated') - maxTs(b, 'updated'));
                  }
                  return studentAnswers;
                })()
              ).map((studentData, index) => (
                <div key={index} className="border rounded-lg p-6 bg-white">
                  <div className="border-b pb-4 mb-4">
                    <h4 className="text-lg font-semibold text-gray-800">
                      {studentData.student.name}
                    </h4>
                    <p className="text-sm text-gray-600">{studentData.student.email}</p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Section A: render only if there are submissions */}
                    {studentData.sections.A.length > 0 && (
                      <div className="space-y-3">
                        <h5 className="font-semibold text-blue-700 border-b border-blue-200 pb-2">
                          Section A
                        </h5>
                        <div className="space-y-3">
                          {studentData.sections.A
                            .filter(a => markFilter === 'all' ? true : markFilter === 'marked' ? (a.mark !== null && a.mark !== undefined) : (a.mark === null || a.mark === undefined))
                            .filter(a => {
                              if (!selectedDate) return true;
                              const d = new Date(a.updatedAt || a.submittedAt);
                              const iso = d.toISOString().slice(0,10);
                              return iso === selectedDate;
                            })
                            .sort((a, b) => {
                              const ta = new Date(a.updatedAt || a.submittedAt).getTime();
                              const tb = new Date(b.updatedAt || b.submittedAt).getTime();
                              if (sortMode === 'recent' || sortMode === 'dateDesc') return tb - ta;
                              if (sortMode === 'dateAsc') return ta - tb;
                              return 0;
                            })
                            .map((answer, idx) => (
                            <div key={answer._id || idx} className="bg-gray-50 p-3 rounded-lg border">
                              <div className="mb-2">
                                <h6 className="font-medium text-gray-800">
                                  Question {idx + 1}: {answer.question.title}
                                </h6>
                              </div>
                              {answer.answerText ? (
                                <div className="bg-blue-50 p-3 rounded border border-blue-200">
                                  <div className="text-sm font-medium text-blue-800 mb-1">Typed Answer</div>
                                  <div className="rich-text-content">
                                    <SimpleTextEditor
                                      value={answer.answerText}
                                      readOnly={true}
                                      onImageDelete={(imageUrl) => deleteImageFromAnswer(imageUrl, answer._id)}
                                    />
                                  </div>
                                </div>
                              ) : null}
                              <div className="text-xs text-gray-500 mt-2">
                                Submitted: {new Date(answer.submittedAt).toLocaleString()}
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                <span className="text-sm">Mark: <span className="font-semibold">{answer.mark !== null && answer.mark !== undefined ? answer.mark : 'Not marked'}</span></span>
                                {answer.mark !== null && answer.mark !== undefined ? (
                                  <button
                                    className="btn-secondary text-xs"
                                    title="Click to edit mark for this answer"
                                    onClick={() => editMark(answer._id, answer.mark)}
                                  >
                                    Edit Mark
                                  </button>
                                ) : (
                                  <button
                                    className="btn-primary text-xs"
                                    title="Click to add mark for this answer"
                                    onClick={() => addMark(answer._id)}
                                  >
                                    Add Mark
                                  </button>
                                )}
                                {answer.markSubmitted && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-600">Submitted</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Section B: render only if there are submissions */}
                    {studentData.sections.B.length > 0 && (
                      <div className="space-y-3">
                        <h5 className="font-semibold text-green-700 border-b border-green-200 pb-2">
                          Section B
                        </h5>
                        <div className="space-y-3">
                          {studentData.sections.B
                            .filter(a => markFilter === 'all' ? true : markFilter === 'marked' ? (a.mark !== null && a.mark !== undefined) : (a.mark === null || a.mark === undefined))
                            .filter(a => {
                              if (!selectedDate) return true;
                              const d = new Date(a.updatedAt || a.submittedAt);
                              const iso = d.toISOString().slice(0,10);
                              return iso === selectedDate;
                            })
                            .sort((a, b) => {
                              const ta = new Date(a.updatedAt || a.submittedAt).getTime();
                              const tb = new Date(b.updatedAt || b.submittedAt).getTime();
                              if (sortMode === 'recent' || sortMode === 'dateDesc') return tb - ta;
                              if (sortMode === 'dateAsc') return ta - tb;
                              return 0;
                            })
                            .map((answer, idx) => (
                            <div key={answer._id || idx} className="bg-gray-50 p-3 rounded-lg border">
                              <div className="mb-2">
                                <h6 className="font-medium text-gray-800">
                                  Question {idx + 1}: {answer.question.title}
                                </h6>
                              </div>
                              {answer.answerText ? (
                                <div className="bg-green-50 p-3 rounded border border-green-200">
                                  <div className="text-sm font-medium text-green-800 mb-1">Typed Answer</div>
                                  <div className="rich-text-content">
                                    <SimpleTextEditor
                                      value={answer.answerText}
                                      readOnly={true}
                                      onImageDelete={(imageUrl) => deleteImageFromAnswer(imageUrl, answer._id)}
                                    />
                                  </div>
                                </div>
                              ) : null}
                              <div className="text-xs text-gray-500 mt-2">
                                Submitted: {new Date(answer.submittedAt).toLocaleString()}
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                <span className="text-sm">Mark: <span className="font-semibold">{answer.mark !== null && answer.mark !== undefined ? answer.mark : 'Not marked'}</span></span>
                                {answer.mark !== null && answer.mark !== undefined ? (
                                  <button
                                    className="btn-secondary text-xs"
                                    title="Click to edit mark for this answer"
                                    onClick={() => editMark(answer._id, answer.mark)}
                                  >
                                    Edit Mark
                                  </button>
                                ) : (
                                  <button
                                    className="btn-primary text-xs"
                                    title="Click to add mark for this answer"
                                    onClick={() => addMark(answer._id)}
                                  >
                                    Add Mark
                                  </button>
                                )}
                                {answer.markSubmitted && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-600">Submitted</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Summary */}
                  <div className="mt-4 pt-4 border-t bg-gray-50 p-3 rounded">
                    <div className="grid grid-cols-4 gap-4 text-sm items-center">
                      <div>
                        <span className="font-medium text-gray-700">Total Questions:</span>
                        <span className="ml-2 text-gray-600">
                          {studentData.sections.A.length + studentData.sections.B.length}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Answers Submitted:</span>
                        <span className="ml-2 text-gray-600">
                          {studentData.sections.A.filter(a => a.answerText || a.answerFile).length +
                            studentData.sections.B.filter(a => a.answerText || a.answerFile).length}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Last Submission:</span>
                        <span className="ml-2 text-gray-600">
                          {new Date(Math.max(
                            ...studentData.sections.A.map(a => new Date(a.submittedAt)),
                            ...studentData.sections.B.map(a => new Date(a.submittedAt))
                          )).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-right">
                        {typeof studentData.totalMark === 'number' && (
                          <span className="mr-3 font-semibold text-emerald-700">Total: {studentData.totalMark}</span>
                        )}
                        <button className="btn-primary text-sm" onClick={() => calculateTotalForStudent(studentData.student._id)}>
                          Calculate Total
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
