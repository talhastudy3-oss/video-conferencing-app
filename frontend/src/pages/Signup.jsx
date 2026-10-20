import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import AuthLayout from '../components/AuthLayout';
import FormInput from '../components/FormInput';
import GoogleButton from '../components/GoogleButton';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validate = ({ name, email, password, confirmPassword }) => {
  const errors = {};
  if (!name.trim()) errors.name = 'Name is required';
  if (!email.trim()) errors.email = 'Email is required';
  else if (!EMAIL_REGEX.test(email)) errors.email = 'Enter a valid email address';
  if (!password) errors.password = 'Password is required';
  else if (password.length < 6) errors.password = 'Password must be at least 6 characters';
  if (confirmPassword !== password) errors.confirmPassword = 'Passwords do not match';
  return errors;
};

const Signup = () => {
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();

  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    const validationErrors = validate(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    try {
      const { data } = await authAPI.signup({
        name: form.name,
        email: form.email,
        password: form.password,
      });
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
      title="Create your account"
      subtitle="Start hosting meetings in seconds."
      footer={
        <>
          <p>
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
              Log in
            </Link>
          </p>
          <p>
            <Link to="/join-guest" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
              Continue as guest
            </Link>
          </p>
        </>
      }
    >
      {serverError && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-300">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <FormInput label="Full name" name="name" value={form.name} onChange={handleChange} error={errors.name} placeholder="Jane Doe" autoComplete="name" />
        <FormInput label="Email" name="email" type="email" value={form.email} onChange={handleChange} error={errors.email} placeholder="you@example.com" autoComplete="email" />
        <FormInput label="Password" name="password" type="password" value={form.password} onChange={handleChange} error={errors.password} placeholder="At least 6 characters" autoComplete="new-password" />
        <FormInput label="Confirm password" name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} error={errors.confirmPassword} placeholder="Re-enter your password" autoComplete="new-password" />
        <button
          type="submit"
          disabled={submitting}
          className="mt-2 w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? 'Creating account...' : 'Sign up'}
        </button>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-gray-400">
        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
        OR
        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
      </div>

      <GoogleButton label="Sign up with Google" />
    </AuthLayout>
  );
};

export default Signup;
