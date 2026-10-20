import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useAuth } from '../hooks/useAuth';

// The backend's /api/auth/google/callback redirects here with ?token=<jwt>.
// Store it, fetch the profile, then continue to the dashboard.
const OAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const ranOnce = useRef(false);

  useEffect(() => {
    if (ranOnce.current) return;
    ranOnce.current = true;

    const token = searchParams.get('token');
    if (!token) {
      navigate('/login?error=oauth_failed', { replace: true });
      return;
    }

    // The axios client reads the token from localStorage, so stash it first.
    localStorage.setItem('token', token);

    authAPI
      .getMe()
      .then(({ data }) => {
        loginWithToken(token, data.user);
        navigate('/dashboard', { replace: true });
      })
      .catch(() => {
        localStorage.removeItem('token');
        navigate('/login?error=oauth_failed', { replace: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-gray-500 dark:text-gray-400">Finishing sign-in...</p>
    </div>
  );
};

export default OAuthCallback;
