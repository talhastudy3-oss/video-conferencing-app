import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { meetingsAPI } from '../services/api';
import ThemeToggle from '../components/ThemeToggle';

const STATUS_STYLES = {
  live: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
  ended: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
};

const formatDate = (value) =>
  new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

const MeetingHistory = () => {
  const { isGuest } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    meetingsAPI
      .getHistory()
      .then(({ data }) => {
        if (!cancelled) setMeetings(data.meetings || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || 'Could not load your meeting history.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900 sm:px-6">
        <Link to="/dashboard" className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
          ← Dashboard
        </Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold text-gray-900 dark:text-gray-100">Meeting history</h1>

        {loading && <p className="text-gray-500 dark:text-gray-400">Loading your meetings...</p>}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-300">{error}</p>}

        {!loading && !error && isGuest && (
          <p className="text-gray-500 dark:text-gray-400">
            Guests don&apos;t have a meeting history. Sign up to keep track of your meetings.
          </p>
        )}

        {!loading && !error && !isGuest && meetings.length === 0 && (
          <p className="text-gray-500 dark:text-gray-400">No meetings yet. Start one from the dashboard!</p>
        )}

        <ul className="space-y-3">
          {meetings.map((m) => (
            <li key={m.roomId} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900 dark:text-gray-100">{m.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(m.scheduledTime || m.createdAt)} · {m.participants?.length || 0} participant
                    {(m.participants?.length || 0) === 1 ? '' : 's'}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-gray-400">{m.roomId}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[m.status] || STATUS_STYLES.ended}`}>
                    {m.status}
                  </span>
                  {m.status !== 'ended' && (
                    <Link to={`/meeting/${m.roomId}/lobby`} className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
                      Join
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
};

export default MeetingHistory;
