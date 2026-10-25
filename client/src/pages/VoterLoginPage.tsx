import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import './AuthPages.css';

const VoterLoginPage = () => {
  const [roomNumber, setRoomNumber] = useState('');
  const [voterId, setVoterId] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
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
      </div>
    </div>
  );
};
export default VoterLoginPage;
