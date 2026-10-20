import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import JoinGuest from './pages/JoinGuest';
import OAuthCallback from './pages/OAuthCallback';
import Dashboard from './pages/Dashboard';
import MeetingHistory from './pages/MeetingHistory';
import MeetingLobby from './pages/MeetingLobby';
import MeetingRoom from './pages/MeetingRoom';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/join-guest" element={<JoinGuest />} />
      <Route path="/oauth/callback" element={<OAuthCallback />} />

      {/* Protected */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <MeetingHistory />
          </ProtectedRoute>
        }
      />
      <Route
        path="/meeting/:roomId/lobby"
        element={
          <ProtectedRoute>
            <MeetingLobby />
          </ProtectedRoute>
        }
      />
      <Route
        path="/meeting/:roomId"
        element={
          <ProtectedRoute>
            <MeetingRoom />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
