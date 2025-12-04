import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../utils/axios";
import { useDialog } from "../../components/DialogProvider";

export default function AdminDashboard() {
  const qc = useQueryClient();
  const dialog = useDialog();
  const [activeTab, setActiveTab] = useState("users");
  const [userTab, setUserTab] = useState("registered");
  const [role, setRole] = useState("student");
  const [editingTest, setEditingTest] = useState(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
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
    checking: false,
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
    mutationFn: async (id) => {
      const response = await api.delete(`/admin/remove/${id}`);
      return { id, response };
    },
    onSuccess: (data) => {
      const message = data.response?.data?.message || "Deleted successfully";
      dialog.alert(message);
      qc.invalidateQueries({ queryKey: ["pending-users"] });
      qc.invalidateQueries({ queryKey: ["registered-users"] });
    },
    onError: (error) => {
      dialog.alert(error.response?.data?.message || "Failed to delete user");
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
      setForm({
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
    },
  });

  const updateTest = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/tests/${id}`, payload),
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

    setTitleValidation((prev) => ({ ...prev, checking: true }));
    try {
      const { data } = await api.get(
        `/tests/check-title/${encodeURIComponent(title.trim())}`
      );
      setTitleValidation({
        isValid: !data.exists,
        message: data.exists
          ? "This test name is already used. Please choose another name."
          : "",
        checking: false,
      });
    } catch (error) {
      setTitleValidation({
        isValid: true,
        message: "",
        checking: false,
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
      dialog.alert("Please select at least one domain");
      return;
    }

    if (!titleValidation.isValid) {
      dialog.alert("Please fix the test title validation error");
      return;
    }
    // Build ISO dates from 12-hour inputs
    const startISO = toIsoFromInputs(
      form.date,
      form.startTime,
      form.startMeridiem
    );
    const endISO = toIsoFromInputs(form.date, form.endTime, form.endMeridiem);
    if (!startISO || !endISO) {
      dialog.alert(
        "Invalid date/time. Use date as dd-mm-yyyy or yyyy-mm-dd and time as HH:MM."
      );
      return;
    }
    const start = new Date(startISO);
    const end = new Date(endISO);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (start < startOfToday) {
      dialog.alert("Date cannot be in the past");
      return;
    }
    if (end <= start) {
      dialog.alert("End time must be after start time");
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
    setForm((prev) => ({
      ...prev,
      domains: prev.domains.includes(domainId)
        ? prev.domains.filter((id) => id !== domainId)
        : [...prev.domains, domainId],
    }));
  };

  const handleStudentToggle = (studentId) => {
    setForm((prev) => ({
      ...prev,
      eligibleStudents: prev.eligibleStudents.includes(studentId)
        ? prev.eligibleStudents.filter((id) => id !== studentId)
        : [...prev.eligibleStudents, studentId],
    }));
  };

  const handleEditTest = (test) => {
    setEditingTest({
      ...test,
      startDate: test.startDate
        ? new Date(test.startDate).toISOString().slice(0, 16)
        : "",
      endDate: test.endDate
        ? new Date(test.endDate).toISOString().slice(0, 16)
        : "",
    });
  };

  const handleUpdateTest = (e) => {
    e.preventDefault();
    if (editingTest.domains.length === 0) {
      dialog.alert("Please select at least one domain");
      return;
    }
    updateTest.mutate({
      id: editingTest._id,
      payload: editingTest,
    });
  };

  return (
    <div className="p-6 space-y-6 min-h-screen bg-[#F9FAFB] text-[#1E293B]">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-8 text-white shadow-lg mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-1">Admin Dashboard</h1>
            <p className="text-purple-100 text-sm">Manage users and tests</p>
          </div>
        </div>
      </div>

      {/* Enhanced MAIN TABS */}
      <div className="flex space-x-2 border-b-2 border-gray-200 pb-0 mb-6">
        <button
          onClick={() => setActiveTab("users")}
          className={`px-6 py-3 rounded-t-xl font-semibold transition-all relative flex items-center gap-2 ${
            activeTab === "users"
              ? "bg-[#552e81] text-white shadow-lg"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          Manage Users
          {activeTab === "users" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#552e81]"></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab("tests")}
          className={`px-6 py-3 rounded-t-xl font-semibold transition-all relative flex items-center gap-2 ${
            activeTab === "tests"
              ? "bg-[#552e81] text-white shadow-lg"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Manage Tests
          {activeTab === "tests" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#552e81]"></div>
          )}
        </button>
      </div>

      {/* USERS TAB */}
      {activeTab === "users" && (
        <div className="grid grid-cols-4 gap-6">
          {/* Enhanced Sidebar */}
          <div className="col-span-1 bg-white rounded-xl shadow-lg border-2 border-gray-100 p-5">
            <h2 className="font-bold text-lg mb-4 text-gray-900 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              Filter by Role
            </h2>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setRole("student");
                  setUserTab("registered"); // Students don't have pending, so switch to registered
                }}
                className={`w-full py-3 px-4 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                  role === "student"
                    ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
                Students
              </button>
              <button
                onClick={() => {
                  setRole("staff");
                  setUserTab("pending"); // Staff can have pending, so switch to pending
                }}
                className={`w-full py-3 px-4 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                  role === "staff"
                    ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                Staff
              </button>
            </div>
          </div>

          {/* Enhanced Content */}
          <div className="col-span-3 bg-white rounded-xl shadow-lg border-2 border-gray-100 p-6">
            {/* Enhanced Sub Tabs - Only show Pending for Staff */}
            <div className="flex space-x-2 mb-6 border-b-2 border-gray-200 pb-0">
              {role === "staff" && (
                <button
                  onClick={() => setUserTab("pending")}
                  className={`px-6 py-3 rounded-t-xl font-semibold transition-all relative flex items-center gap-2 ${
                    userTab === "pending"
                      ? "bg-[#552e81] text-white shadow-lg"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Pending
                  {userTab === "pending" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#552e81]"></div>
                  )}
                </button>
              )}
              <button
                onClick={() => setUserTab("registered")}
                className={`px-6 py-3 rounded-t-xl font-semibold transition-all relative flex items-center gap-2 ${
                  userTab === "registered"
                    ? "bg-[#552e81] text-white shadow-lg"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Registered
                {userTab === "registered" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#552e81]"></div>
                )}
              </button>
            </div>

            {/* Enhanced Users Table */}
            {filteredUsers.length ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="p-4 text-left font-bold text-gray-900">
                        Name
                      </th>
                      <th className="p-4 text-left font-bold text-gray-900">
                        Email
                      </th>
                      <th className="p-4 text-center font-bold text-gray-900">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr
                        key={u._id}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="p-4 font-semibold text-gray-900">
                          {u.name}
                        </td>
                        <td className="p-4 text-gray-600">{u.email}</td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-2">
                            {userTab === "pending" ? (
                              <>
                                <button
                                  onClick={() => approve.mutate(u._id)}
                                  className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all font-semibold shadow-md hover:shadow-lg flex items-center gap-2"
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                  Approve
                                </button>
                                <button
                                  onClick={() => remove.mutate(u._id)}
                                  className="bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-xl hover:from-red-600 hover:to-red-700 transition-all font-semibold shadow-md hover:shadow-lg flex items-center gap-2"
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M6 18L18 6M6 6l12 12"
                                    />
                                  </svg>
                                  Reject
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => remove.mutate(u._id)}
                                className="bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-xl hover:from-red-600 hover:to-red-700 transition-all font-semibold shadow-md hover:shadow-lg flex items-center gap-2"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                  <svg
                    className="w-8 h-8 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                </div>
                <p className="text-gray-500 font-medium text-lg">
                  No {userTab} {role}s
                </p>
                <p className="text-gray-400 text-sm mt-1">
                  {userTab === "pending"
                    ? `No ${role}s are currently awaiting approval`
                    : `No ${role}s are currently registered`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TESTS TAB */}
      {activeTab === "tests" && (
        <div className="space-y-6">
          {/* Enhanced Create Test Form */}
          <form
            onSubmit={handleTestSubmit}
            className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-6 space-y-4"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </div>
              <h2 className="font-bold text-xl text-gray-900">
                Create New Test
              </h2>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                Test Title
              </label>
              <input
                type="text"
                placeholder="Enter test title..."
                value={form.title}
                onChange={handleTitleChange}
                className={`input w-full ${
                  titleValidation.checking
                    ? "border-yellow-400 focus:ring-yellow-300"
                    : titleValidation.isValid
                    ? ""
                    : "border-red-500 focus:ring-red-300"
                }`}
                required
              />
              {titleValidation.checking && (
                <div className="text-sm text-yellow-600">
                  Checking title availability...
                </div>
              )}
              {!titleValidation.isValid && titleValidation.message && (
                <div className="text-sm text-red-600">
                  {titleValidation.message}
                </div>
              )}
            </div>

            {/* Enhanced Multiple Domain Selection */}
            <div className="border-2 border-gray-200 p-5 rounded-xl bg-gradient-to-br from-purple-50 to-blue-50">
              <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                Select Domains (multiple allowed)
              </label>
              {domainsLoading ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <svg
                    className="animate-spin h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Loading domains...
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {domainData?.map((d) => {
                    const isSelected = form.domains.includes(d._id);
                    const sectionA = d.questionCounts?.sectionA || 0;
                    const sectionB = d.questionCounts?.sectionB || 0;
                    return (
                      <label
                        key={d._id}
                        className={`flex items-center space-x-3 cursor-pointer p-3 rounded-lg border-2 transition-all ${
                          isSelected
                            ? "bg-white border-purple-400 shadow-md"
                            : "bg-white/50 border-gray-200 hover:border-purple-300 hover:bg-white"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleDomainToggle(d._id)}
                          className="w-5 h-5 rounded text-purple-600 focus:ring-purple-500 focus:ring-2"
                        />
                        <div className="flex-1">
                          <span className="font-semibold text-gray-900">
                            {d.name}
                          </span>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-gray-600 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                              Section A: {sectionA}/5
                            </span>
                            <span className="text-xs text-gray-600 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-green-500"></span>
                              Section B: {sectionB}/5
                            </span>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
              {form.domains.length > 0 && (
                <div className="mt-4 px-4 py-2 bg-purple-100 rounded-lg border border-purple-300">
                  <div className="flex items-center gap-2 text-purple-700 font-semibold">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Selected: {form.domains.length} domain
                    {form.domains.length > 1 ? "s" : ""}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Duration (minutes)
              </label>
              <input
                type="number"
                placeholder="Enter duration in minutes..."
                value={form.durationMinutes}
                onChange={(e) =>
                  setForm({
                    ...form,
                    durationMinutes: parseInt(e.target.value) || 60,
                  })
                }
                className="input w-full"
                min="1"
                required
              />
            </div>

            {/* Enhanced Date & Time Selection */}
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                Test Schedule
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-gray-600">
                    Date
                  </label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="input w-full"
                    required
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-gray-600">
                    Start Time
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(e) =>
                        setForm({ ...form, startTime: e.target.value })
                      }
                      className="input w-full"
                      required
                    />
                    <select
                      className="input w-full"
                      value={form.startMeridiem}
                      onChange={(e) =>
                        setForm({ ...form, startMeridiem: e.target.value })
                      }
                    >
                      <option>AM</option>
                      <option>PM</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-gray-600">
                    End Time
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(e) =>
                        setForm({ ...form, endTime: e.target.value })
                      }
                      className="input w-full"
                      required
                    />
                    <select
                      className="input w-full"
                      value={form.endMeridiem}
                      onChange={(e) =>
                        setForm({ ...form, endMeridiem: e.target.value })
                      }
                    >
                      <option>AM</option>
                      <option>PM</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Enhanced Student Eligibility Selection */}
            <div className="border-2 border-gray-200 p-5 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50">
              <label className="block text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
                Student Eligibility
              </label>

              <div className="space-y-3 mb-4">
                <label
                  htmlFor="openToAll"
                  className={`flex items-center space-x-3 cursor-pointer p-4 rounded-xl border-2 transition-all ${
                    form.isOpenToAll
                      ? "bg-white border-blue-400 shadow-md"
                      : "bg-white/50 border-gray-200 hover:border-blue-300 hover:bg-white"
                  }`}
                >
                  <input
                    type="radio"
                    id="openToAll"
                    name="eligibility"
                    checked={form.isOpenToAll}
                    onChange={() =>
                      setForm({
                        ...form,
                        isOpenToAll: true,
                        eligibleStudents: [],
                      })
                    }
                    className="w-5 h-5 text-blue-600 focus:ring-blue-500 focus:ring-2"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">
                      Open to all registered students
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      All students can access this test
                    </div>
                  </div>
                  {form.isOpenToAll && (
                    <svg
                      className="w-6 h-6 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  )}
                </label>

                <label
                  htmlFor="specificStudents"
                  className={`flex items-center space-x-3 cursor-pointer p-4 rounded-xl border-2 transition-all ${
                    !form.isOpenToAll
                      ? "bg-white border-blue-400 shadow-md"
                      : "bg-white/50 border-gray-200 hover:border-blue-300 hover:bg-white"
                  }`}
                >
                  <input
                    type="radio"
                    id="specificStudents"
                    name="eligibility"
                    checked={!form.isOpenToAll}
                    onChange={() => setForm({ ...form, isOpenToAll: false })}
                    className="w-5 h-5 text-blue-600 focus:ring-blue-500 focus:ring-2"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">
                      Limit to specific students
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Select which students can access this test
                    </div>
                  </div>
                  {!form.isOpenToAll && (
                    <svg
                      className="w-6 h-6 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  )}
                </label>
              </div>

              {!form.isOpenToAll && (
                <div className="mt-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Select Students:
                  </label>

                  {/* Search Input */}
                  <div className="mb-3">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search students by name or email..."
                        value={studentSearchQuery}
                        onChange={(e) => setStudentSearchQuery(e.target.value)}
                        className={`input w-full h-11 pl-11 ${
                          studentSearchQuery ? "pr-11" : ""
                        }`}
                      />

                      {studentSearchQuery && (
                        <button
                          onClick={() => setStudentSearchQuery("")}
                          className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-300 rounded p-0.5"
                          type="button"
                          aria-label="Clear search"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {studentsLoading ? (
                    <div className="flex items-center gap-2 text-gray-500 p-4 bg-white rounded-lg">
                      <svg
                        className="animate-spin h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Loading students...
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                        {studentsData?.students
                          ?.filter((student) => {
                            if (!studentSearchQuery.trim()) return true;
                            const query = studentSearchQuery
                              .toLowerCase()
                              .trim();
                            return (
                              student.name?.toLowerCase().includes(query) ||
                              student.email?.toLowerCase().includes(query)
                            );
                          })
                          .map((student) => {
                            const isSelected = form.eligibleStudents.includes(
                              student._id
                            );
                            return (
                              <label
                                key={student._id}
                                className={`flex items-center space-x-3 cursor-pointer p-3 rounded-lg border-2 transition-all ${
                                  isSelected
                                    ? "bg-white border-blue-400 shadow-md"
                                    : "bg-white/50 border-gray-200 hover:border-blue-300 hover:bg-white"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() =>
                                    handleStudentToggle(student._id)
                                  }
                                  className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 focus:ring-2"
                                />
                                <div className="flex-1">
                                  <div className="font-semibold text-gray-900">
                                    {student.name}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {student.email}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                      </div>
                      {studentSearchQuery &&
                        studentsData?.students?.filter((student) => {
                          const query = studentSearchQuery.toLowerCase().trim();
                          return (
                            student.name?.toLowerCase().includes(query) ||
                            student.email?.toLowerCase().includes(query)
                          );
                        }).length === 0 && (
                          <div className="text-center py-8 text-gray-500">
                            <svg
                              className="w-12 h-12 mx-auto mb-2 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                              />
                            </svg>
                            <p className="text-sm font-medium">
                              No students found
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              Try a different search term
                            </p>
                          </div>
                        )}
                    </>
                  )}
                  {form.eligibleStudents.length > 0 && (
                    <div className="mt-4 px-4 py-2 bg-blue-100 rounded-lg border border-blue-300">
                      <div className="flex items-center gap-2 text-blue-700 font-semibold">
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        Selected: {form.eligibleStudents.length} student
                        {form.eligibleStudents.length > 1 ? "s" : ""}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all font-bold shadow-lg hover:shadow-xl flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={createTest.isLoading}
            >
              {createTest.isLoading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Creating...
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                  Create Test
                </>
              )}
            </button>
          </form>

          {/* Enhanced Test List */}
          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h2 className="font-bold text-xl text-gray-900">Tests</h2>
              {!isLoading && tests && (
                <span className="ml-auto px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-semibold">
                  {tests.length} {tests.length === 1 ? "test" : "tests"}
                </span>
              )}
            </div>
            {isLoading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#552e81]"></div>
                <p className="mt-4 text-gray-600">Loading tests...</p>
              </div>
            ) : tests?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="p-4 text-left font-bold text-gray-900">
                        Title
                      </th>
                      <th className="p-4 text-left font-bold text-gray-900">
                        Domains
                      </th>
                      <th className="p-4 text-left font-bold text-gray-900">
                        Eligible Students
                      </th>
                      <th className="p-4 text-left font-bold text-gray-900">
                        Schedule
                      </th>
                      <th className="p-4 text-center font-bold text-gray-900">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tests?.map((t) => {
                      const startDate = t.startDate
                        ? new Date(t.startDate)
                        : null;
                      const endDate = t.endDate ? new Date(t.endDate) : null;
                      const now = new Date();
                      const isActive =
                        startDate &&
                        endDate &&
                        now >= startDate &&
                        now <= endDate;
                      const isUpcoming = startDate && now < startDate;
                      const isFinished = endDate && now > endDate;

                      return (
                        <tr
                          key={t._id}
                          className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                        >
                          <td className="p-4">
                            <div className="font-semibold text-gray-900 mb-1">
                              {t.title}
                            </div>
                            <span
                              className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${
                                isActive
                                  ? "bg-green-100 text-green-800"
                                  : isUpcoming
                                  ? "bg-yellow-100 text-yellow-800"
                                  : isFinished
                                  ? "bg-gray-100 text-gray-800"
                                  : "bg-purple-100 text-purple-800"
                              }`}
                            >
                              {isActive
                                ? "Active"
                                : isUpcoming
                                ? "Upcoming"
                                : isFinished
                                ? "Finished"
                                : "Draft"}
                            </span>
                          </td>
                          <td className="p-4 text-gray-600">
                            {t.domains?.map((d) => d.name).join(", ") || "—"}
                          </td>
                          <td className="p-4 text-gray-600">
                            {t.eligibleStudents && t.eligibleStudents.length > 0
                              ? `${t.eligibleStudents.length} specific students`
                              : "All students"}
                          </td>
                          <td className="p-4 text-gray-600 text-sm">
                            {startDate && endDate ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <svg
                                    className="w-3.5 h-3.5 text-green-600 flex-shrink-0"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                                    />
                                  </svg>
                                  <span>
                                    Start:{" "}
                                    {startDate.toLocaleString(undefined, {
                                      hour12: true,
                                    })}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <svg
                                    className="w-3.5 h-3.5 text-red-600 flex-shrink-0"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M5 13l7 7 7-7M5 13V5h14v8"
                                    />
                                  </svg>
                                  <span>
                                    End:{" "}
                                    {endDate.toLocaleString(undefined, {
                                      hour12: true,
                                    })}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleEditTest(t)}
                                className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all font-semibold shadow-md hover:shadow-lg flex items-center gap-2"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm("Delete this test?")) {
                                    deleteTest.mutate(t._id);
                                  }
                                }}
                                className="bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-xl hover:from-red-600 hover:to-red-700 transition-all font-semibold shadow-md hover:shadow-lg flex items-center gap-2 disabled:opacity-50"
                                disabled={deleteTest.isLoading}
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                                {deleteTest.isLoading
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                  <svg
                    className="w-8 h-8 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <p className="text-gray-500 font-medium text-lg">
                  No tests created yet
                </p>
                <p className="text-gray-400 text-sm mt-1">
                  Create your first test using the form above
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Test Modal */}
      {editingTest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              Edit Test: {editingTest.title}
            </h3>

            <form onSubmit={handleUpdateTest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Title:</label>
                <input
                  type="text"
                  value={editingTest.title}
                  onChange={(e) =>
                    setEditingTest({ ...editingTest, title: e.target.value })
                  }
                  className="border p-2 rounded w-full"
                  required
                />
              </div>

              <div className="border p-3 rounded w-full">
                <label className="block text-sm font-medium mb-2">
                  Select Domains (multiple allowed):
                </label>
                {domainsLoading ? (
                  <p className="text-gray-500">Loading domains...</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {domainData?.map((d) => (
                      <label
                        key={d._id}
                        className="flex items-center space-x-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={editingTest.domains.includes(d._id)}
                          onChange={() => {
                            const newDomains = editingTest.domains.includes(
                              d._id
                            )
                              ? editingTest.domains.filter((id) => id !== d._id)
                              : [...editingTest.domains, d._id];
                            setEditingTest({
                              ...editingTest,
                              domains: newDomains,
                            });
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">
                          {d.name}{" "}
                          {d.questionCounts &&
                            `(A:${d.questionCounts.sectionA}, B:${d.questionCounts.sectionB})`}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                {editingTest.domains.length > 0 && (
                  <div className="mt-2 text-sm text-[#552e81]">
                    Selected: {editingTest.domains.length} domain
                    {editingTest.domains.length > 1 ? "s" : ""}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Duration (minutes):
                </label>
                <input
                  type="number"
                  value={editingTest.durationMinutes}
                  onChange={(e) =>
                    setEditingTest({
                      ...editingTest,
                      durationMinutes: parseInt(e.target.value) || 60,
                    })
                  }
                  className="border p-2 rounded w-full"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Start Date & Time:
                </label>
                <input
                  type="datetime-local"
                  value={editingTest.startDate}
                  onChange={(e) =>
                    setEditingTest({
                      ...editingTest,
                      startDate: e.target.value,
                    })
                  }
                  className="border p-2 rounded w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  End Date & Time:
                </label>
                <input
                  type="datetime-local"
                  value={editingTest.endDate}
                  onChange={(e) =>
                    setEditingTest({ ...editingTest, endDate: e.target.value })
                  }
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
