import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import ProtectedRoute from './components/ProtectedRoute';

import AdminLayout from './components/AdminLayout';
import VoterLayout from './components/VoterLayout';

import LandingPage from './pages/LandingPage';
import AdminLoginPage from './pages/AdminLoginPage';
import VoterLoginPage from './pages/VoterLoginPage';
import AdminDashboard from './pages/AdminDashboard';
import CreateElectionPage from './pages/CreateElectionPage';
import CandidateManagementPage from './pages/CandidateManagementPage';
import VoterRegistrationPage from './pages/VoterRegistrationPage';
import RoomSettingsPage from './pages/RoomSettingsPage';
import BlockchainAuditPage from './pages/BlockchainAuditPage';
import BiometricVerificationPage from './pages/BiometricVerificationPage';
import BallotPage from './pages/BallotPage';
import VoteReceiptPage from './pages/VoteReceiptPage';
import PublishedResultsPage from './pages/PublishedResultsPage';

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LandingPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/voter/login" element={<VoterLoginPage />} />
          <Route path="/results" element={<PublishedResultsPage />} />
          
          <Route path="/admin" element={<ProtectedRoute role="admin" />}>
            <Route element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="create-election" element={<CreateElectionPage />} />
              <Route path="candidates" element={<CandidateManagementPage />} />
              <Route path="voters" element={<VoterRegistrationPage />} />
              <Route path="room-settings" element={<RoomSettingsPage />} />
              <Route path="audit" element={<BlockchainAuditPage />} />
            </Route>
          </Route>

          <Route path="/voter" element={<ProtectedRoute role="voter" />}>
            <Route element={<VoterLayout />}>
              <Route path="verify" element={<BiometricVerificationPage />} />
              <Route path="ballot" element={<BallotPage />} />
              <Route path="receipt" element={<VoteReceiptPage />} />
              <Route path="results" element={<PublishedResultsPage />} />
            </Route>
          </Route>
        </Routes>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
