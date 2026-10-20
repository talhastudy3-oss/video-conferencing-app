import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import ThemeToggle from '../components/ThemeToggle';

const FEATURES = [
  { icon: '🎥', title: 'Real-time video', text: 'Peer-to-peer WebRTC calls with a responsive gallery or speaker view.' },
  { icon: '🖥️', title: 'Screen sharing', text: 'Present your screen with one click and switch back to camera automatically.' },
  { icon: '💬', title: 'In-call chat', text: 'Send messages to everyone in the meeting without leaving the call.' },
  { icon: '🛡️', title: 'Host controls', text: 'Mute or remove participants, mute everyone, or end the meeting for all.' },
  { icon: '✋', title: 'Raise hand', text: 'Let people signal they want to speak; the host is notified instantly.' },
  { icon: '⏺️', title: 'Local recording', text: 'Record the whole meeting to a .webm file straight from your browser.' },
];

const STEPS = [
  { n: '1', title: 'Sign up or join as guest', text: 'Create an account, use Google, or just enter your name.' },
  { n: '2', title: 'Start or schedule', text: 'Get a shareable link like abc-defg-hij in one click.' },
  { n: '3', title: 'Meet', text: 'Share the link. Everyone joins from their browser — nothing to install.' },
];

const Landing = () => {
  const { isAuthenticated, loading } = useAuth();

  // Signed-in users have no use for the marketing page.
  if (!loading && isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="h-8 w-8 rounded-lg bg-brand-600" />
          <span className="text-lg font-semibold">MeetUp</span>
        </div>
        <nav className="flex items-center gap-1 sm:gap-3">
          <ThemeToggle />
          <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800">
            Log in
          </Link>
          <Link to="/signup" className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            Sign up
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-4 pb-16 pt-12 text-center sm:px-6 sm:pt-20">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Video meetings, <span className="text-brand-600 dark:text-brand-400">without the friction</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-gray-600 dark:text-gray-400 sm:text-lg">
          Start a call in one click, share a link, and talk face to face. Screen sharing, chat, host controls
          and recording are built in.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/signup" className="w-full rounded-xl bg-brand-600 px-6 py-3 text-base font-semibold text-white hover:bg-brand-700 sm:w-auto">
            Get started free
          </Link>
          <Link
            to="/join-guest"
            className="w-full rounded-xl border border-gray-300 px-6 py-3 text-base font-semibold hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900 sm:w-auto"
          >
            Join as guest
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
              <div className="text-2xl">{f.icon}</div>
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gray-50 py-16 dark:bg-gray-900">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">How it works</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 font-semibold text-white">
                  {s.n}
                </div>
                <h3 className="mt-3 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        MeetUp — a full-stack WebRTC project built with React, Node.js, Socket.IO and MongoDB.
      </footer>
    </div>
  );
};

export default Landing;
