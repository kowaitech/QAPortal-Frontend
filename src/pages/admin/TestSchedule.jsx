import React, { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../../utils/authStore';
import { api } from '../../utils/axios';

export default function TestSchedule() {
  const { accessToken } = useAuthStore.getState();
  const apiBase = import.meta.env.VITE_API_BASE;

  // form state
  const [domains, setDomains] = useState([]);
  const [title, setTitle] = useState('');
  const [domainIds, setDomainIds] = useState([]);
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState(''); // hh:mm
  const [startMeridiem, setStartMeridiem] = useState('AM');
  const [endTime, setEndTime] = useState(''); // hh:mm
  const [endMeridiem, setEndMeridiem] = useState('AM');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [msg, setMsg] = useState('');

  // manage tests
  const [tests, setTests] = useState([]);
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    api.get(`/domains?createdBy=staff`, { headers, withCredentials: true })
      .then(r => setDomains(r.data)).catch(() => { });
    api.get(`/tests`, { headers, withCredentials: true })
      .then(r => setTests(r.data)).catch(() => { });
  }, []);

  const toIsoFromInputs = (d, t, meridiem) => {
    if (!d || !t) return null;
    const [hhStr, mmStr] = t.split(':');
    let hh = parseInt(hhStr || '0', 10);
    const mm = parseInt(mmStr || '0', 10);
    if (meridiem === 'PM' && hh !== 12) hh += 12;
    if (meridiem === 'AM' && hh === 12) hh = 0;
    const iso = new Date(`${d}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`);
    return iso.toISOString();
  };

  const startISO = useMemo(() => toIsoFromInputs(date, startTime, startMeridiem), [date, startTime, startMeridiem]);
  const endISO = useMemo(() => toIsoFromInputs(date, endTime, endMeridiem), [date, endTime, endMeridiem]);

  const onToggleDomain = (id) => {
    setDomainIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    try {
      // Validation: ensure date not in past and end after start
      const now = new Date();
      const start = startISO ? new Date(startISO) : null;
      const end = endISO ? new Date(endISO) : null;
      if (!start || !end) throw new Error('Please select date, start and end times.');
      if (start < new Date(now.toDateString())) throw new Error('Date cannot be in the past.');
      if (end <= start) throw new Error('End time must be after start time.');

      const { data } = await api.post(`/tests/admin`, { title, domains: domainIds, startDate: startISO, endDate: endISO, durationMinutes }, { headers, withCredentials: true });
      const resData = data;
      if (!resData?._id) throw new Error('Failed to save');
      setMsg('Test saved');
      // refresh tests list
      api.get(`/tests`, { headers, withCredentials: true }).then(r => setTests(r.data));
      // reset form
      setTitle(''); setDomainIds([]); setDate(''); setStartTime(''); setEndTime(''); setStartMeridiem('AM'); setEndMeridiem('AM'); setDurationMinutes(60);
    } catch (err) {
      setMsg(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this test?')) return; // replace with custom dialog later if TestSchedule is used
    const res = await api.delete(`/tests/${id}`, { headers, withCredentials: true });
    if (res.status === 200) setTests(prev => prev.filter(t => t._id !== id));
  };

  return (
    <div className="grid gap-8">
      <div>
        <h2 className="text-xl font-semibold mb-2">Create / Schedule Test</h2>
        <form className="space-y-4" onSubmit={onSubmit}>
          <label className="block">Title
            <input type="text" className="input" value={title} onChange={e => setTitle(e.target.value)} required />
          </label>

          <div>
            <div className="font-medium mb-1">Domains (staff-created)</div>
            <div className="flex flex-wrap gap-3">
              {domains.map(d => (
                <label key={d._id} className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={domainIds.includes(d._id)}
                    onChange={() => onToggleDomain(d._id)}
                  />
                  <span>{d.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block">Date
              <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} required min={new Date().toISOString().split('T')[0]} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">Start Time
                <input type="time" className="input" value={startTime} onChange={e => setStartTime(e.target.value)} required />
              </label>
              <label className="block">AM/PM
                <select className="input" value={startMeridiem} onChange={e => setStartMeridiem(e.target.value)}>
                  <option>AM</option>
                  <option>PM</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">End Time
                <input type="time" className="input" value={endTime} onChange={e => setEndTime(e.target.value)} required />
              </label>
              <label className="block">AM/PM
                <select className="input" value={endMeridiem} onChange={e => setEndMeridiem(e.target.value)}>
                  <option>AM</option>
                  <option>PM</option>
                </select>
              </label>
            </div>
            <label className="block">Duration (mins)
              <input type="number" className="input" value={durationMinutes} onChange={e => setDurationMinutes(+e.target.value)} min={1} />
            </label>
          </div>

          <button className="btn-primary w-max">Save</button>
          {msg && <div className="text-sm">{msg}</div>}
        </form>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">Manage Tests</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-2 text-left">Title</th>
                <th className="p-2">Start</th>
                <th className="p-2">End</th>
                <th className="p-2">Duration</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {tests.map(t => (
                <tr key={t._id} className="border-t">
                  <td className="p-2">{t.title}</td>
                  <td className="p-2">{new Date(t.startDate).toLocaleString()}</td>
                  <td className="p-2">{new Date(t.endDate).toLocaleString()}</td>
                  <td className="p-2 text-center">{t.durationMinutes}m</td>
                  <td className="p-2 text-right">
                    <button className="btn-danger" onClick={() => handleDelete(t._id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {tests.length === 0 && (
                <tr><td className="p-4 text-center text-gray-500" colSpan={5}>No tests yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}