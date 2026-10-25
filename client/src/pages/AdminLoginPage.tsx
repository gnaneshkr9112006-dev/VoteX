import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import './AuthPages.css';

const AdminLoginPage = () => {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
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
      </div>
    </div>
  );
};
export default AdminLoginPage;
