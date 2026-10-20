import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import AuthLayout from '../components/AuthLayout';
import FormInput from '../components/FormInput';

const JoinGuest = () => {
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();

  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    if (!name.trim()) {
      setError('Please enter a display name');
      return;
    }
    setError('');

    setSubmitting(true);
    try {
      const { data } = await authAPI.guestLogin(name.trim());
      loginWithToken(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      setServerError(err.response?.data?.message || 'Could not reach the server. Is the backend running?');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Join as guest"
      subtitle="No account needed — just tell us what to call you."
      footer={
        <p>
          Have an account?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
            Log in
          </Link>{' '}
          or{' '}
          <Link to="/signup" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
            sign up
          </Link>
        </p>
      }
    >
      {serverError && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-300">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <FormInput
          label="Display name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error}
          placeholder="e.g. Alex"
          autoComplete="name"
        />
        <button
          type="submit"
          disabled={submitting}
          className="mt-2 w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? 'Joining...' : 'Continue'}
        </button>
      </form>
    </AuthLayout>
  );
};

export default JoinGuest;
