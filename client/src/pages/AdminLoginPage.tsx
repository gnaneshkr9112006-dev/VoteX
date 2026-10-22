import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import './AuthPages.css';

const AdminLoginPage = () => {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login('admin', { loginId, password });
      navigate('/admin');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  const handleGoogleSuccess = async (idToken: string) => {
    try {
      setGoogleLoading(true);
      setError('');
      const res = await googleLogin(idToken, undefined, 'admin');
      if (res.redirectTo) {
        navigate(res.redirectTo);
      } else {
        navigate('/admin');
      }
    } catch (err: any) {
      setError(err.message || 'Google authentication failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card glass-card animate-fade-up">
        <Link to="/" className="back-link"><ArrowLeft size={16}/> Back to home</Link>
        <h2 className="text-gradient">Admin Login</h2>
        <p className="auth-desc">Secure access to election management.</p>
        
        {error && (
          <div className="error-box">
            <ShieldAlert size={18}/>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Login ID</label>
            <input 
              type="text" 
              className="form-input"
              value={loginId}
              onChange={e => setLoginId(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input 
              type="password" 
              className="form-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary full-width mt-4">Login to Dashboard</button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', margin: '1.25rem 0', color: '#64748b', fontSize: '0.82rem' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
          <span style={{ padding: '0 0.75rem' }}>or sign in with Google</span>
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
export default AdminLoginPage;
