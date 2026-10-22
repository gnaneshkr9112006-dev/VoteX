import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import './AuthPages.css';

const VoterLoginPage = () => {
  const [roomNumber, setRoomNumber] = useState('');
  const [voterId, setVoterId] = useState('');
  const [error, setError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login('voter', { roomNumber, voterId });
      navigate('/voter/verify');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  const handleGoogleSuccess = async (idToken: string) => {
    try {
      setGoogleLoading(true);
      setError('');
      const targetRoom = (roomNumber || 'VOTEX-2026').trim().toUpperCase();
      const res = await googleLogin(idToken, targetRoom, 'voter');
      if (res.redirectTo) {
        navigate(res.redirectTo);
      } else {
        navigate('/voter/verify');
      }
    } catch (err: any) {
      setError(err.message || 'Google verification failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card glass-card animate-fade-up">
        <Link to="/" className="back-link"><ArrowLeft size={16}/> Back to home</Link>
        <h2 className="text-gradient" style={{ backgroundImage: 'var(--gradient-emerald)'}}>Voter Portal</h2>
        <p className="auth-desc">Enter your credentials to cast your vote.</p>
        
        {error && (
          <div className="error-box">
            <ShieldAlert size={18}/>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Room Number</label>
            <input 
              type="text" 
              className="form-input"
              placeholder="e.g. VOTEX-2026"
              value={roomNumber}
              onChange={e => setRoomNumber(e.target.value.toUpperCase())}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Voter ID</label>
            <input 
              type="text" 
              className="form-input"
              value={voterId}
              onChange={e => setVoterId(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary full-width mt-4" style={{ background: 'var(--gradient-emerald)'}}>Proceed to Verification</button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', margin: '1.25rem 0', color: '#64748b', fontSize: '0.82rem' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
          <span style={{ padding: '0 0.75rem' }}>or verify with Google</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
        </div>

        <GoogleSignInButton
          onSuccess={handleGoogleSuccess}
          onError={(err) => setError(err)}
          loading={googleLoading}
        />
      </div>
    </div>
  );
};
export default VoterLoginPage;
