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

        {/* Project Reports & Whitepapers Download Bar */}
        <div style={{
          marginTop: '2.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <a
            href="/VoteX_Project_Report.pdf"
            download="VoteX_Project_Report.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="btn"
            style={{
              background: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              color: '#93c5fd',
              fontSize: '0.85rem',
              padding: '0.55rem 1.1rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              borderRadius: '8px',
              textDecoration: 'none',
              transition: 'all 0.2s'
            }}
          >
            <span>📥</span>
            <span>Download Project Report (PDF)</span>
          </a>

          <a
            href="/VoteX_Blockchain_Architecture.pdf"
            download="VoteX_Blockchain_Architecture.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="btn"
            style={{
              background: 'rgba(168, 85, 247, 0.15)',
              border: '1px solid rgba(168, 85, 247, 0.35)',
              color: '#d8b4fe',
              fontSize: '0.85rem',
              padding: '0.55rem 1.1rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              borderRadius: '8px',
              textDecoration: 'none',
              transition: 'all 0.2s'
            }}
          >
            <span>📜</span>
            <span>Download Blockchain Concept (PDF)</span>
          </a>
        </div>
      </div>

      <footer className="landing-footer">
        Powered by Blockchain Technology • SHA-256 Ledger
      </footer>
    </div>
  );
};

export default LandingPage;
