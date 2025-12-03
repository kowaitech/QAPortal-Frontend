

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../utils/axios";
import { useDialog } from "../../components/DialogProvider";

export default function AdminDashboard() {
  const qc = useQueryClient();
  const dialog = useDialog();
  const [activeTab, setActiveTab] = useState("users");
  const [userTab, setUserTab] = useState("pending");
  const [role, setRole] = useState("student");
  const [editingTest, setEditingTest] = useState(null);
  const [form, setForm] = useState({
    title: "",
    domains: [],
    date: "",
    startTime: "",
    startMeridiem: "AM",
    endTime: "",
    endMeridiem: "AM",
    durationMinutes: 60,
    eligibleStudents: [],
    isOpenToAll: true,
  });
  const [titleValidation, setTitleValidation] = useState({
    isValid: true,
    message: "",
    checking: false
  });

  // USERS QUERIES
  const { data: pendingUsers } = useQuery({
    queryKey: ["pending-users"],
    queryFn: async () => (await api.get("/admin/pending")).data,
  });
  const { data: registeredUsers } = useQuery({
    queryKey: ["registered-users"],
    queryFn: async () => (await api.get("/admin/registered")).data,
  });
  // DOMAINS QUERY

  const approve = useMutation({
    mutationFn: (id) => api.put(`/admin/approve/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-users"] });
      qc.invalidateQueries({ queryKey: ["registered-users"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id) => api.delete(`/admin/remove/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-users"] });
      qc.invalidateQueries({ queryKey: ["registered-users"] });
    },
  });
  // DOMAINS QUERY
  // const { data: domainData, isLoading: domainsLoading } = useQuery({
  //   queryKey: ["domains"],
  //   queryFn: async () => (await api.get("/domains")).data.domains,
  // });
  // DOMAINS QUERY
  const { data: domainData, isLoading: domainsLoading } = useQuery({
    queryKey: ["domains"],
    queryFn: async () => (await api.get("/domains")).data.domains,
  });

  // STUDENTS QUERY
  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ["students"],
    queryFn: async () => (await api.get("/admin/students")).data,
  });

  // DELETE TEST
  const deleteTest = useMutation({
    mutationFn: (id) => api.delete(`/tests/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tests"] }),
  });

  // TESTS QUERIES
  const { data: tests, isLoading } = useQuery({
    queryKey: ["tests"],
    queryFn: async () => (await api.get("/tests/list")).data,
  });

  const createTest = useMutation({
    mutationFn: (payload) => api.post("/tests/admin", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tests"] });
      setForm({ title: "", domains: [], date: "", startTime: "", startMeridiem: "AM", endTime: "", endMeridiem: "AM", durationMinutes: 60, eligibleStudents: [], isOpenToAll: true });
    },
  });



  const updateTest = useMutation({
    mutationFn: ({ id, payload }) =>
      api.put(`/tests/${id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tests"] });
      setEditingTest(null);
    },
  });

  // USERS DATA
  const users =
    userTab === "pending"
      ? pendingUsers?.users || []
      : registeredUsers?.users || [];
  const filteredUsers = users.filter((u) => u.role === role);

  // Check if test title exists
  const checkTitleExists = async (title) => {
    if (!title.trim()) {
      setTitleValidation({ isValid: true, message: "", checking: false });
      return;
    }

    setTitleValidation(prev => ({ ...prev, checking: true }));
    try {
      const { data } = await api.get(`/tests/check-title/${encodeURIComponent(title.trim())}`);
      setTitleValidation({
        isValid: !data.exists,
        message: data.exists ? "This test name is already used. Please choose another name." : "",
        checking: false
      });
    } catch (error) {
      setTitleValidation({
        isValid: true,
        message: "",
        checking: false
      });
    }
  };

  // Debounced title validation
  const debouncedCheckTitle = useMemo(() => {
    let timeoutId;
    return (title) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => checkTitleExists(title), 500);
    };
  }, []);

  const handleTitleChange = (e) => {
    const newTitle = e.target.value;
    setForm({ ...form, title: newTitle });
    debouncedCheckTitle(newTitle);
  };

  const parseDateParts = (d) => {
    if (!d) return null;
    // Accept dd-mm-yyyy and yyyy-mm-dd
    const dmY = /^(\d{2})-(\d{2})-(\d{4})$/;
    const ymD = /^(\d{4})-(\d{2})-(\d{2})$/;
    let y, m, day;
    if (dmY.test(d)) {
      const [, dd, mm, yyyy] = d.match(dmY);
      y = parseInt(yyyy, 10);
      m = parseInt(mm, 10);
      day = parseInt(dd, 10);
    } else if (ymD.test(d)) {
      const [, yyyy, mm, dd] = d.match(ymD);
      y = parseInt(yyyy, 10);
      m = parseInt(mm, 10);
      day = parseInt(dd, 10);
    } else {
      return null;
    }
    return { y, m, day };
  };

  const toIsoFromInputs = (d, t, meridiem) => {
    if (!d || !t) return null;
    const parts = parseDateParts(d);
    if (!parts) return null;
    const [hhStr, mmStr] = String(t).split(":");
    let hh = parseInt(hhStr || "0", 10);
    const mm = parseInt(mmStr || "0", 10);
    if (isNaN(hh) || isNaN(mm)) return null;
    // Support both 24-hour and 12-hour inputs:
    // - If user typed 13..23, treat as 24h and ignore meridiem toggle.
    // - If user typed 1..12, apply AM/PM conversion.
    if (hh >= 0 && hh <= 12) {
      if (meridiem === "PM" && hh !== 12) hh += 12;
      if (meridiem === "AM" && hh === 12) hh = 0;
    }
    const localDate = new Date(parts.y, parts.m - 1, parts.day, hh, mm, 0, 0);
    if (isNaN(localDate.getTime())) return null;
    return localDate.toISOString();
  };

  const handleTestSubmit = (e) => {
    e.preventDefault();
    if (form.domains.length === 0) {
      dialog.alert('Please select at least one domain');
      return;
    }

    if (!titleValidation.isValid) {
      dialog.alert('Please fix the test title validation error');
      return;
    }
    // Build ISO dates from 12-hour inputs
    const startISO = toIsoFromInputs(form.date, form.startTime, form.startMeridiem);
    const endISO = toIsoFromInputs(form.date, form.endTime, form.endMeridiem);
    if (!startISO || !endISO) {
      dialog.alert('Invalid date/time. Use date as dd-mm-yyyy or yyyy-mm-dd and time as HH:MM.');
      return;
    }
    const start = new Date(startISO);
    const end = new Date(endISO);
    const startOfToday = new Date();
    startOfToday.setHours(0,0,0,0);
    if (start < startOfToday) {
      dialog.alert('Date cannot be in the past');
      return;
    }
    if (end <= start) {
      dialog.alert('End time must be after start time');
      return;
    }

    // Prepare payload
    const payload = {
      title: form.title,
      domains: form.domains,
      startDate: startISO,
      endDate: endISO,
      durationMinutes: form.durationMinutes,
      eligibleStudents: form.isOpenToAll ? [] : form.eligibleStudents,
    };

    createTest.mutate(payload);
  };

  const handleDomainToggle = (domainId) => {
    setForm(prev => ({
      ...prev,
      domains: prev.domains.includes(domainId)
        ? prev.domains.filter(id => id !== domainId)
        : [...prev.domains, domainId]
    }));
  };

  const handleStudentToggle = (studentId) => {
    setForm(prev => ({
      ...prev,
      eligibleStudents: prev.eligibleStudents.includes(studentId)
        ? prev.eligibleStudents.filter(id => id !== studentId)
        : [...prev.eligibleStudents, studentId]
    }));
  };

  const handleEditTest = (test) => {
    setEditingTest({
      ...test,
      startDate: test.startDate ? new Date(test.startDate).toISOString().slice(0, 16) : "",
      endDate: test.endDate ? new Date(test.endDate).toISOString().slice(0, 16) : "",
    });
  };

  const handleUpdateTest = (e) => {
    e.preventDefault();
    if (editingTest.domains.length === 0) {
      dialog.alert('Please select at least one domain');
      return;
    }
    updateTest.mutate({
      id: editingTest._id,
      payload: editingTest
    });
  };

  return (
    <div className="p-6 space-y-6 min-h-screen bg-[#F9FAFB] text-[#1E293B]">
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>

      {/* MAIN TABS */}
      <div className="flex space-x-4 border-b pb-2">
        <button
          onClick={() => setActiveTab("users")}
          className={`px-4 py-2 rounded-t-lg ${activeTab === "users" ? "bg-[#552e81] text-white" : "bg-gray-100"
            }`}
        >
          Manage Users
        </button>
        <button
          onClick={() => setActiveTab("tests")}
          className={`px-4 py-2 rounded-t-lg ${activeTab === "tests" ? "bg-[#552e81] text-white" : "bg-gray-100"
            }`}
        >
          Manage Tests
        </button>
      </div>

      {/* USERS TAB */}
      {activeTab === "users" && (
        <div className="grid grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="col-span-1 bg-white rounded-lg shadow p-4">
            <h2 className="font-semibold mb-3">Filter by Role</h2>
            <button
              onClick={() => setRole("student")}
              className={`w-full mb-2 py-2 rounded-lg ${role === "student" ? "bg-[#552e81] text-white" : "bg-gray-200 hover:bg-[#A78BFA]"
                }`}
            >
              Students
            </button>
            <button
              onClick={() => setRole("staff")}
              className={`w-full py-2 rounded-lg ${role === "staff" ? "bg-[#552e81] text-white" : "bg-gray-200 hover:bg-[#A78BFA]"
                }`}
            >
              Staff
            </button>
          </div>

          {/* Content */}
          <div className="col-span-3 bg-white rounded-lg shadow p-4">
            {/* Sub Tabs */}
            <div className="flex space-x-4 mb-4 border-b pb-2">
              <button
                onClick={() => setUserTab("pending")}
                className={`px-4 py-2 rounded-t-lg ${userTab === "pending"
                  ? "bg-[#552e81] text-white"
                  : "bg-gray-200 hover:bg-[#A78BFA]"
                  }`}
              >
                Pending
              </button>
              <button
                onClick={() => setUserTab("registered")}
                className={`px-4 py-2 rounded-t-lg ${userTab === "registered"
                  ? "bg-[#552e81] text-white"
                  : "bg-gray-200 hover:bg-[#A78BFA]"
                  }`}
              >
                Registered
              </button>
            </div>

            {/* Users Table */}
            {filteredUsers.length ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">Email</th>
                    <th className="p-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u._id} className="border-t">
                      <td className="p-2">{u.name}</td>
                      <td className="p-2">{u.email}</td>
                      <td className="p-2 space-x-2">
                        {userTab === "pending" ? (
                          <>
                            <button
                              onClick={() => approve.mutate(u._id)}
                              className="bg-[#552e81] text-white px-3 py-1 rounded hover:bg-[#4b2a72]"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => remove.mutate(u._id)}
                              className="bg-gray-700 text-white px-3 py-1 rounded hover:bg-gray-800"
                            >
                              Reject
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => remove.mutate(u._id)}
                            className="bg-gray-700 text-white px-3 py-1 rounded hover:bg-gray-800"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No {userTab} {role}s</p>
            )}
          </div>
        </div>
      )}

      {/* TESTS TAB */}
      {/* TESTS TAB */}
      {activeTab === "tests" && (
        <div className="space-y-6">
          {/* Create Test Form */}
          <form
            onSubmit={handleTestSubmit}
            className="bg-white p-4 shadow rounded-lg space-y-3"
          >
            <h2 className="font-semibold text-lg">Create New Test</h2>
            <div className="space-y-1">
              <input
                type="text"
                placeholder="Title"
                value={form.title}
                onChange={handleTitleChange}
                className={`border p-2 rounded w-full ${
                  titleValidation.checking 
                    ? 'border-yellow-400' 
                    : titleValidation.isValid 
                      ? 'border-gray-300' 
                      : 'border-red-500'
                }`}
                required
              />
              {titleValidation.checking && (
                <div className="text-sm text-yellow-600">Checking title availability...</div>
              )}
              {!titleValidation.isValid && titleValidation.message && (
                <div className="text-sm text-red-600">{titleValidation.message}</div>
              )}
            </div>

            {/* Multiple Domain Selection */}
            <div className="border p-3 rounded w-full">
              <label className="block text-sm font-medium mb-2">Select Domains (multiple allowed):</label>
              {domainsLoading ? (
                <p className="text-gray-500">Loading domains...</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {domainData?.map((d) => (
                    <label key={d._id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.domains.includes(d._id)}
                        onChange={() => handleDomainToggle(d._id)}
                        className="rounded"
                      />
                      <span className="text-sm">
                        {d.name} {d.questionCounts && `(A:${d.questionCounts.sectionA}, B:${d.questionCounts.sectionB})`}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {form.domains.length > 0 && (
                <div className="mt-2 text-sm text-[#552e81]">
                  Selected: {form.domains.length} domain{form.domains.length > 1 ? 's' : ''}
                </div>
              )}
            </div>

            <input
              type="number"
              placeholder="Duration (minutes)"
              value={form.durationMinutes}
              onChange={(e) => setForm({ ...form, durationMinutes: parseInt(e.target.value) || 60 })}
              className="border p-2 rounded w-full"
              min="1"
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="block">
                <span className="text-sm">Date</span>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="border p-2 rounded w-full"
                  required
                  min={new Date().toISOString().split('T')[0]}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-sm">Start Time</span>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    className="border p-2 rounded w-full"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-sm">AM/PM</span>
                  <select
                    className="border p-2 rounded w-full"
                    value={form.startMeridiem}
                    onChange={(e) => setForm({ ...form, startMeridiem: e.target.value })}
                  >
                    <option>AM</option>
                    <option>PM</option>
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-sm">End Time</span>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    className="border p-2 rounded w-full"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-sm">AM/PM</span>
                  <select
                    className="border p-2 rounded w-full"
                    value={form.endMeridiem}
                    onChange={(e) => setForm({ ...form, endMeridiem: e.target.value })}
                  >
                    <option>AM</option>
                    <option>PM</option>
                  </select>
                </label>
              </div>
            </div>

            {/* Student Eligibility Selection */}
            <div className="border p-3 rounded w-full">
              <label className="block text-sm font-medium mb-2">Student Eligibility:</label>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="openToAll"
                    name="eligibility"
                    checked={form.isOpenToAll}
                    onChange={() => setForm({ ...form, isOpenToAll: true, eligibleStudents: [] })}
                    className="rounded"
                  />
                  <label htmlFor="openToAll" className="text-sm cursor-pointer">
                    Open to all registered students
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="specificStudents"
                    name="eligibility"
                    checked={!form.isOpenToAll}
                    onChange={() => setForm({ ...form, isOpenToAll: false })}
                    className="rounded"
                  />
                  <label htmlFor="specificStudents" className="text-sm cursor-pointer">
                    Limit to specific students
                  </label>
                </div>
              </div>

              {!form.isOpenToAll && (
                <div className="mt-3">
                  <label className="block text-sm font-medium mb-2">Select Students:</label>
                  {studentsLoading ? (
                    <p className="text-gray-500">Loading students...</p>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto border p-2 rounded">
                      {studentsData?.students?.map((student) => (
                        <label key={student._id} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.eligibleStudents.includes(student._id)}
                            onChange={() => handleStudentToggle(student._id)}
                            className="rounded"
                          />
                          <span className="text-sm">
                            {student.name} ({student.email})
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                  {form.eligibleStudents.length > 0 && (
                    <div className="mt-2 text-sm text-green-600">
                      Selected: {form.eligibleStudents.length} student{form.eligibleStudents.length > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="bg-[#552e81] text-white px-4 py-2 rounded hover:bg-[#4b2a72]"
              disabled={createTest.isLoading}
            >
              {createTest.isLoading ? "Creating..." : "Create Test"}
            </button>
          </form>

          {/* Test List */}
          <div className="bg-white p-4 shadow rounded-lg">
            <h2 className="font-semibold text-lg mb-3">Tests</h2>
            {isLoading ? (
              <p>Loading...</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left">Title</th>
                    <th className="p-2 text-left">Domains</th>
                    <th className="p-2 text-left">Eligible Students</th>
                    <th className="p-2 text-left">Schedule</th>
                    <th className="p-2 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tests?.map((t) => (
                    <tr key={t._id} className="border-t">
                      <td className="p-2">{t.title}</td>
                      <td className="p-2">
                        {t.domains?.map((d) => d.name).join(", ") || "—"}
                      </td>
                      <td className="p-2">
                        {t.eligibleStudents && t.eligibleStudents.length > 0
                          ? `${t.eligibleStudents.length} specific students`
                          : "All students"
                        }
                      </td>
                      <td className="p-2">
                        {t.startDate
                          ? new Date(t.startDate).toLocaleString(undefined, { hour12: true })
                          : "—"}{" "}
                        -{" "}
                        {t.endDate
                          ? new Date(t.endDate).toLocaleString(undefined, { hour12: true })
                          : "—"}
                      </td>
                      <td className="p-2">
                        <button
                          onClick={() => handleEditTest(t)}
                          className="bg-[#552e81] text-white px-3 py-1 rounded hover:bg-[#4b2a72]"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteTest.mutate(t._id)}
                          className="bg-red-600 text-white px-3 py-1 rounded"
                          disabled={deleteTest.isLoading}
                        >
                          {deleteTest.isLoading ? "Deleting..." : "Delete"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Edit Test Modal */}
      {editingTest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Edit Test: {editingTest.title}</h3>

            <form onSubmit={handleUpdateTest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Title:</label>
                <input
                  type="text"
                  value={editingTest.title}
                  onChange={(e) => setEditingTest({ ...editingTest, title: e.target.value })}
                  className="border p-2 rounded w-full"
                  required
                />
              </div>

              <div className="border p-3 rounded w-full">
                <label className="block text-sm font-medium mb-2">Select Domains (multiple allowed):</label>
                {domainsLoading ? (
                  <p className="text-gray-500">Loading domains...</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {domainData?.map((d) => (
                      <label key={d._id} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingTest.domains.includes(d._id)}
                          onChange={() => {
                            const newDomains = editingTest.domains.includes(d._id)
                              ? editingTest.domains.filter(id => id !== d._id)
                              : [...editingTest.domains, d._id];
                            setEditingTest({ ...editingTest, domains: newDomains });
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">
                          {d.name} {d.questionCounts && `(A:${d.questionCounts.sectionA}, B:${d.questionCounts.sectionB})`}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                {editingTest.domains.length > 0 && (
                  <div className="mt-2 text-sm text-[#552e81]">
                    Selected: {editingTest.domains.length} domain{editingTest.domains.length > 1 ? 's' : ''}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Duration (minutes):</label>
                <input
                  type="number"
                  value={editingTest.durationMinutes}
                  onChange={(e) => setEditingTest({ ...editingTest, durationMinutes: parseInt(e.target.value) || 60 })}
                  className="border p-2 rounded w-full"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Start Date & Time:</label>
                <input
                  type="datetime-local"
                  value={editingTest.startDate}
                  onChange={(e) => setEditingTest({ ...editingTest, startDate: e.target.value })}
                  className="border p-2 rounded w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">End Date & Time:</label>
                <input
                  type="datetime-local"
                  value={editingTest.endDate}
                  onChange={(e) => setEditingTest({ ...editingTest, endDate: e.target.value })}
                  className="border p-2 rounded w-full"
                  required
                />
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  type="submit"
                  disabled={updateTest.isLoading}
                  className="flex-1 bg-[#552e81] text-white py-2 px-4 rounded hover:bg-[#4b2a72] disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {updateTest.isLoading ? "Updating..." : "Update Test"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingTest(null)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


    </div>
  );
}
