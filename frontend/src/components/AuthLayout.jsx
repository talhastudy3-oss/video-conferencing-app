import { Link } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';

/** Centered card shared by the Login, Signup and Guest pages. */
const AuthLayout = ({ title, subtitle, children, footer }) => (
  <div className="relative flex min-h-screen items-center justify-center px-4 py-8">
    <div className="absolute right-4 top-4">
      <ThemeToggle />
    </div>

    <div className="w-full max-w-sm">
      <Link to="/" className="mb-6 flex items-center justify-center gap-2">
        <span className="h-8 w-8 rounded-lg bg-brand-600" />
        <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">MeetUp</span>
      </Link>

      <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-900 sm:p-8">
        <h1 className="mb-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        {children}
      </div>

      {footer && (
        <div className="mt-4 space-y-2 text-center text-sm text-gray-500 dark:text-gray-400">{footer}</div>
      )}
    </div>
  </div>
);

export default AuthLayout;
