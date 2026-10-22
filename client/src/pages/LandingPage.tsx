import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, Vote, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { useAuth } from '../contexts/AuthContext';
import './LandingPage.css';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { googleLogin, unifiedSelectRole } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal / prompt for first-time Google users who haven't yet picked a role
  const [pendingUser, setPendingUser] = useState<{
    identifier: string;
    name: string;
    avatar?: string;
  } | null>(null);

  const handleGoogleSuccess = async (idToken: string) => {
    try {
      setLoading(true);
      setError(null);
      setSuccessMsg(null);

      const res = await googleLogin(idToken);

      if (res.redirectTo) {
        setSuccessMsg(`Welcome, ${res.user?.name || 'User'}! Redirecting...`);
        setTimeout(() => {
          navigate(res.redirectTo);
        }, 600);
        return;
      }

      if (res.needsRoleSelection) {
        setPendingUser({
          identifier: res.identifier,
          name: res.name || 'Verified User',
          avatar: res.avatar
        });
      }
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      setError(err.message || 'Google authentication was not completed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSelection = async (role: 'admin' | 'voter') => {
    if (!pendingUser) return;
    try {
      setLoading(true);
      setError(null);
      const res = await unifiedSelectRole({
        identifier: pendingUser.identifier,
        role,
        name: pendingUser.name,
        roomNumber: 'VOTEX-2026'
      });

      if (res.redirectTo) {
        navigate(res.redirectTo);
      } else {
        navigate(role === 'admin' ? '/admin' : '/voter/verify');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to select role.');
      setLoading(false);
    }
  };

  return (
    <div className="landing-page">
      <div className="landing-bg"></div>

      <div className="landing-content animate-fade-up">
        {/* 1. Inserted VoteX Official Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
          <img
            src="/votex-logo.png"
            alt="VoteX Logo"
            style={{
              width: '125px',
              height: '125px',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 24px rgba(59, 130, 246, 0.55))'
            }}
          />
        </div>

        {/* 2. VoteX Brand Header */}
        <h1 className="heading-xl text-gradient">VoteX</h1>
        <p className="tagline">Secure. Transparent. Decentralized.</p>

        {/* 3. Official Google Verification on Starting Page */}
        <div
          className="glass-card"
          style={{
            maxWidth: '440px',
            margin: '0 auto 2.5rem',
            padding: '1.4rem 1.75rem',
            borderRadius: '18px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginBottom: '0.85rem' }}>
            <Sparkles size={16} color="#60a5fa" />
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#e2e8f0', letterSpacing: '0.2px' }}>
              Sign In with Google
            </span>
          </div>

          <GoogleSignInButton
            onSuccess={handleGoogleSuccess}
            onError={(msg) => setError(msg)}
            loading={loading}
          />

          {error && (
            <div
              style={{
                marginTop: '0.85rem',
                padding: '0.55rem 0.85rem',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                textAlign: 'left'
              }}
            >
              <ShieldAlert size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div
              style={{
                marginTop: '0.85rem',
                padding: '0.55rem 0.85rem',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#6ee7b7',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                textAlign: 'left'
              }}
            >
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* 4. Original Architecture: Dual Portal Cards */}
        <div className="cards-container">
          <div className="glass-card role-card">
            <ShieldCheck size={48} className="role-icon" color="var(--accent-violet)" />
            <h3>Administrator</h3>
            <p>Manage elections, candidates, and voters securely.</p>
            <Link to="/admin/login" className="btn btn-secondary full-width">
              Admin Login
            </Link>
          </div>

          <div className="glass-card role-card">
            <Vote size={48} className="role-icon" color="var(--accent-cyan)" />
            <h3>Voter</h3>
            <p>Cast your vote safely with biometric verification.</p>
            <Link to="/voter/login" className="btn btn-primary full-width">
              Voter Login
            </Link>
          </div>
        </div>
      </div>

      {/* Role Selection Modal (First-time Google Sign-In) */}
      {pendingUser && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem'
          }}
        >
          <div
            className="glass-card animate-fade-up"
            style={{
              maxWidth: '460px',
              width: '100%',
              padding: '2rem',
              borderRadius: '20px',
              textAlign: 'center'
            }}
          >
            <h3 style={{ fontSize: '1.35rem', marginBottom: '0.5rem', color: '#f8fafc' }}>
              Welcome, {pendingUser.name}!
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.75rem' }}>
              Your Google account (<strong style={{ color: '#e2e8f0' }}>{pendingUser.identifier}</strong>) is verified. Please choose your portal:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <button
                onClick={() => handleRoleSelection('voter')}
                className="btn btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.6rem',
                  padding: '0.85rem'
                }}
                disabled={loading}
              >
                <Vote size={20} />
                <span>Enter as Voter (Election VOTEX-2026)</span>
              </button>

              <button
                onClick={() => handleRoleSelection('admin')}
                className="btn btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.6rem',
                  padding: '0.85rem'
                }}
                disabled={loading}
              >
                <ShieldCheck size={20} />
                <span>Enter as Administrator Dashboard</span>
              </button>
            </div>

            <button
              onClick={() => setPendingUser(null)}
              style={{
                marginTop: '1.25rem',
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <footer className="landing-footer">
        Powered by Blockchain Technology
      </footer>
    </div>
  );
};

export default LandingPage;
