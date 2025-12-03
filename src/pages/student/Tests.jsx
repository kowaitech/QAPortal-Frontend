import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../utils/authStore';

export default function Tests() {
  const { accessToken } = useAuthStore.getState();
  const apiBase = import.meta.env.VITE_API_BASE;
  const [data, setData] = useState({ upcoming: [], active: [], completed: [] });

  useEffect(() => {
    fetch(`${apiBase}/tests/student/categorized`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {});
  }, []);

  const Section = ({ title, items }) => (
    <div className="card mb-6">
      <div className="font-semibold mb-2">{title}</div>
      {items.length === 0 ? (
        <div className="text-sm text-gray-500">No tests</div>
      ) : (
        <ul className="space-y-2">
          {items.map(t => (
            <li key={t._id} className="flex items-center justify-between border rounded p-3">
              <div>
                <div className="font-medium">{t.title}</div>
                <div className="text-xs text-gray-500">
                  {new Date(t.startDate).toLocaleString()} → {new Date(t.endDate || (new Date(new Date(t.startDate).getTime() + (t.durationMinutes||60)*60000))).toLocaleString()}
                </div>
              </div>
              {/* CTA only for active */}
              {title === 'Active' && (
                <a href={`/student/take/${t._id}`} className="btn-primary text-sm">Start / Resume</a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="grid gap-6">
      <Section title="Upcoming" items={data.upcoming} />
      <Section title="Active" items={data.active} />
      <Section title="Completed" items={data.completed} />
    </div>
  );
}