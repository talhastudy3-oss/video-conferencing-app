import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { meetingsAPI } from '../services/api';
import { parseRoomIdInput } from '../utils/roomId';
import ScheduleMeetingModal from '../components/ScheduleMeetingModal';
import ThemeToggle from '../components/ThemeToggle';

const Dashboard = () => {
  const { user, isGuest, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // MeetingRoom redirects here with a short reason when it kicks someone
  // out ("The meeting has ended" / "You were removed from the meeting").
  const notice = location.state?.notice;

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);

  // Clear the notice from history state once it has been shown, so a page
  // refresh doesn't keep re-showing it.
  useEffect(() => {
    if (notice) navigate(location.pathname, { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Instant meeting: create it, then go straight in (the host skips the lobby).
  const handleNewMeeting = async () => {
    setCreateError('');
    setCreating(true);
    try {
      const { data } = await meetingsAPI.create();
      navigate(`/meeting/${data.meeting.roomId}`);
    } catch (err) {
      setCreateError(err.response?.data?.message || 'Could not start a meeting. Is the backend running?');
      setCreating(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setJoinError('');

    const roomId = parseRoomIdInput(joinInput);
    if (!roomId) {
      setJoinError('Enter a meeting code like abc-defg-hij, or paste an invite link.');
      return;
    }

    setJoining(true);
    try {
      await meetingsAPI.getByRoomId(roomId); // 404 = no such meeting, 410 = already ended
      navigate(`/meeting/${roomId}/lobby`);
    } catch (err) {
      setJoinError(err.response?.data?.message || 'Could not check that meeting.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="h-8 w-8 rounded-lg bg-brand-600" />
          <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">MeetUp</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          {isGuest && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900 dark:text-amber-200">
              Guest
            </span>
          )}
          <Link to="/history" className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
            History
          </Link>
          <ThemeToggle />
          <button onClick={handleLogout} className="text-sm font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white">
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col items-center px-4 py-12 text-center sm:py-20">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
          Welcome{user?.name ? `, ${user.name}` : ''}
        </h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">What would you like to do today?</p>

        {notice && (
          <p className="mt-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-200">
            {notice}
          </p>
        )}

        <div className="mt-10 grid w-full max-w-md gap-4">
          <button
            onClick={handleNewMeeting}
            disabled={creating}
            className="rounded-xl bg-brand-600 px-6 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            {creating ? 'Starting meeting...' : '+ New Meeting'}
          </button>
          {createError && <p className="text-sm text-red-500">{createError}</p>}

          <button
            onClick={() => setShowSchedule(true)}
            className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
          >
            Schedule Meeting
          </button>

          <form
            onSubmit={handleJoin}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <input
              type="text"
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value)}
              placeholder="Meeting code or invite link"
              className="min-w-0 flex-1 rounded-lg bg-transparent px-3 py-2 text-sm outline-none dark:text-gray-100"
            />
            <button
              type="submit"
              disabled={joining}
              className="shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-60 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              {joining ? 'Checking...' : 'Join'}
            </button>
          </form>
          {joinError && <p className="text-sm text-red-500">{joinError}</p>}
        </div>
      </main>

      {showSchedule && <ScheduleMeetingModal onClose={() => setShowSchedule(false)} />}
    </div>
  );
};

export default Dashboard;
