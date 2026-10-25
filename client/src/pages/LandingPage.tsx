import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Vote } from 'lucide-react';
import './LandingPage.css';

const LandingPage: React.FC = () => {
  return (
    <div className="landing-page">
      <div className="landing-bg"></div>

      <div className="landing-content animate-fade-up">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
          <img
            src="/votex-logo.png"
            alt="VoteX Logo"
            style={{
              width: '120px',
              height: '120px',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 24px rgba(59, 130, 246, 0.55))'
            }}
          />
        </div>

        <h1 className="heading-xl text-gradient">VoteX</h1>
        <p className="tagline">Secure. Transparent. Decentralized.</p>

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

      <footer className="landing-footer">
        Powered by Blockchain Technology
      </footer>
    </div>
  );
};

export default LandingPage;
