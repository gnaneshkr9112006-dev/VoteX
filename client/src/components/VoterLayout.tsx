import React from 'react';
import { Outlet } from 'react-router-dom';
import './VoterLayout.css';

const VoterLayout = () => {
  return (
    <div className="voter-layout">
      <header className="voter-header glass-card">
        <h2 className="text-gradient">VoteX</h2>
      </header>
      <main className="voter-main animate-fade-up">
        <Outlet />
      </main>
    </div>
  );
};

export default VoterLayout;
