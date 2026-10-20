import { useState } from 'react';
import { meetingsAPI } from '../services/api';

const ScheduleMeetingModal = ({ onClose, onScheduled }) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [shareLink, setShareLink] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!title.trim() || !date || !time) {
      setError('Please fill in all fields');
      return;
    }

    const scheduledTime = new Date(`${date}T${time}`);
    if (Number.isNaN(scheduledTime.getTime()) || scheduledTime <= new Date()) {
      setError('Please pick a time in the future');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await meetingsAPI.schedule(title.trim(), scheduledTime.toISOString());
      setShareLink(`${window.location.origin}/meeting/${data.meeting.roomId}`);
      onScheduled?.(data.meeting);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not schedule the meeting');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
    } catch {
      // clipboard can be unavailable in insecure contexts; link is shown regardless
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg dark:bg-gray-900">
        {shareLink ? (
          <>
            <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Meeting scheduled!</h2>
            <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">Share this link with participants:</p>
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-gray-200 p-2 dark:border-gray-700">
              <input readOnly value={shareLink} className="flex-1 truncate bg-transparent text-xs outline-none dark:text-gray-200" />
              <button onClick={handleCopy} className="rounded bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700">
                Copy
              </button>
            </div>
            <button onClick={onClose} className="w-full rounded-lg bg-gray-100 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200">
              Done
            </button>
          </>
        ) : (
          <>
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Schedule a meeting</h2>
            {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950">{error}</p>}
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Team sync"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
              <div className="mb-4 flex gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Time</label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="flex-1 rounded-lg bg-gray-100 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                  {submitting ? 'Scheduling...' : 'Schedule'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ScheduleMeetingModal;
