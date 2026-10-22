import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { resultsApi } from '../api/results';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Clock, Trophy, Scale, CheckCircle2, ShieldCheck, ArrowLeft, RefreshCw, Search } from 'lucide-react';

const CHART_COLORS = ['#00f2fe', '#7f00ff', '#00e676', '#ff6b35', '#ffd700', '#ff4757', '#00b0ff', '#e040fb'];

const PublishedResultsPage = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [searchParams, setSearchParams] = useSearchParams();
  const [resultsData, setResultsData] = useState<any>(null);
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchRoomInput, setSearchRoomInput] = useState('');

  const targetRoom = searchParams.get('room') || user?.roomNumber || localStorage.getItem('votex_voter_room') || 'VOTEX-2026';

  const fetchResults = async (room: string) => {
    if (!room) return;
    setLoading(true);
    try {
      const res = await resultsApi.getResultsByRoom(room);
      if (res.published === false) {
        setPublished(false);
        setResultsData(null);
      } else {
        setResultsData(res);
        setPublished(true);
      }
    } catch (err) {
      setPublished(false);
      setResultsData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults(targetRoom);
    if (socket && targetRoom) {
      socket.emit('joinRoom', targetRoom);
      socket.on('resultsPublished', () => {
        fetchResults(targetRoom);
      });
    }
    return () => { socket?.off('resultsPublished'); };
  }, [socket, targetRoom]);

  const handleRoomSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchRoomInput.trim()) {
      const formatted = searchRoomInput.trim().toUpperCase();
      setSearchParams({ room: formatted });
      fetchResults(formatted);
    }
  };

  if (loading) {
    return (
      <div className="glass-card text-center animate-fade-up" style={{ padding: '4rem 2rem' }}>
        <RefreshCw size={48} className="animate-spin" color="var(--accent-cyan)" style={{ margin: '0 auto 1.5rem' }} />
        <h2>Loading Official Certified Results...</h2>
        <p className="text-secondary mt-2">Connecting to Ethereum blockchain state...</p>
      </div>
    );
  }

  if (!published || !resultsData) {
    return (
      <div className="glass-card text-center animate-fade-up" style={{ padding: '4rem 2rem', maxWidth: '650px', margin: '2rem auto' }}>
        <Clock size={64} color="var(--accent-cyan)" style={{ margin: '0 auto 1.5rem' }} />
        <h2>Results Pending</h2>
        <p className="text-secondary mt-4">
          Results for room <strong style={{ color: 'var(--accent-cyan)' }}>{targetRoom}</strong> have not been published by the administrator yet.
        </p>

        <form onSubmit={handleRoomSearch} style={{ marginTop: '2rem', display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <input 
            type="text" 
            className="form-input" 
            placeholder="Search another room (e.g. VOTEX-2026)" 
            value={searchRoomInput}
            onChange={e => setSearchRoomInput(e.target.value.toUpperCase())}
            style={{ maxWidth: '300px' }}
          />
          <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Search size={16} /> Search Room
          </button>
        </form>

        <div style={{ marginTop: '2rem' }}>
          <button className="btn btn-secondary" onClick={() => fetchResults(targetRoom)}>
            Check Again
          </button>
        </div>
      </div>
    );
  }

  // Extract election & candidate data
  const { election, candidates, totalVotes, totalVoters } = resultsData;

  // Compute Winner & Statistics
  const sortedCandidates = [...candidates].sort((a: any, b: any) => (b.votes || 0) - (a.votes || 0));
  const maxVotes = sortedCandidates.length > 0 ? (sortedCandidates[0].votes || 0) : 0;
  const topCandidates = sortedCandidates.filter((c: any) => (c.votes || 0) === maxVotes && maxVotes > 0);
  const isTie = topCandidates.length > 1;
  const winner = topCandidates.length === 1 ? topCandidates[0] : null;
  const runnerUp = sortedCandidates.length > 1 ? sortedCandidates[1] : null;
  const margin = (winner && runnerUp) ? ((winner.votes || 0) - (runnerUp.votes || 0)) : (winner ? winner.votes : 0);
  const winnerPercent = (winner && totalVotes > 0) ? (((winner.votes || 0) / totalVotes) * 100).toFixed(1) : '0';
  const turnoutPercent = totalVoters > 0 ? ((totalVotes / totalVoters) * 100).toFixed(1) : '0';

  const chartData = candidates.map((c: any) => ({
    name: c.name,
    votes: c.votes || 0,
    code: c.code || ''
  }));

  return (
    <div className="animate-fade-up" style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Back / Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <Link to="/" style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}>
          <ArrowLeft size={16} /> Back to Portal
        </Link>
        <span style={{ fontSize: '0.85rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
          <ShieldCheck size={18} /> Official Blockchain Certified Tally
        </span>
      </div>

      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="heading-lg" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Election Results</h1>
        <p style={{ fontSize: '1.2rem', color: '#f8fafc', fontWeight: 600, margin: 0 }}>
          {election.title}
        </p>
        <p className="text-secondary mt-1">
          Room Code: <code style={{ color: 'var(--accent-cyan)', fontSize: '1.1rem', fontWeight: 700 }}>{election.roomNumber}</code>
          {' • '}
          Turnout: <strong style={{ color: '#fff' }}>{totalVotes} / {totalVoters}</strong> ({turnoutPercent}%)
        </p>
      </div>

      {/* 🏆 WINNER SHOWCASE BANNER */}
      {winner ? (
        <div className="glass-card mb-4" style={{
          padding: '2.25rem 2rem',
          background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(16, 185, 129, 0.10) 100%)',
          border: '2px solid rgba(255, 215, 0, 0.5)',
          boxShadow: '0 0 35px rgba(255, 215, 0, 0.18)',
          borderRadius: '16px',
          textAlign: 'center',
          position: 'relative'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.4rem 1.25rem',
            background: 'rgba(255, 215, 0, 0.25)',
            border: '1px solid rgba(255, 215, 0, 0.45)',
            borderRadius: '999px',
            color: '#ffd700',
            fontWeight: 800,
            fontSize: '0.85rem',
            textTransform: 'uppercase',
            letterSpacing: '1.2px',
            marginBottom: '1rem'
          }}>
            <Trophy size={18} color="#ffd700" /> Winner Declared
          </div>

          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#ffffff', margin: '0.2rem 0' }}>
            {winner.name}
          </h2>

          <p style={{ fontSize: '1.2rem', color: 'var(--accent-cyan)', fontWeight: 600, margin: '0 0 1.75rem' }}>
            {winner.party || 'Independent'} {winner.code ? `• (${winner.code})` : ''}
          </p>

          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '2.5rem',
            flexWrap: 'wrap',
            paddingTop: '1.25rem',
            borderTop: '1px solid rgba(255, 215, 0, 0.2)'
          }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>Total Ballots Won</p>
              <p style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: '#ffd700' }}>
                {winner.votes} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#94a3b8' }}>votes</span>
              </p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>Vote Share</p>
              <p style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: '#10b981' }}>
                {winnerPercent}%
              </p>
            </div>
            {runnerUp && (
              <div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>Victory Margin</p>
                <p style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                  +{margin} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#94a3b8' }}>lead</span>
                </p>
              </div>
            )}
          </div>
        </div>
      ) : isTie ? (
        <div className="glass-card mb-4" style={{
          padding: '2rem',
          background: 'rgba(245, 158, 11, 0.12)',
          border: '2px solid rgba(245, 158, 11, 0.45)',
          borderRadius: '16px',
          textAlign: 'center'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.4rem 1.25rem',
            background: 'rgba(245, 158, 11, 0.25)',
            borderRadius: '999px',
            color: '#fbbf24',
            fontWeight: 800,
            fontSize: '0.85rem',
            marginBottom: '0.75rem'
          }}>
            <Scale size={18} /> Election Result: Tied
          </div>
          <h3 style={{ color: '#fff', fontSize: '1.8rem', margin: '0.5rem 0' }}>
            Tie Between {topCandidates.map((c: any) => c.name).join(' & ')}
          </h3>
          <p style={{ color: '#cbd5e1', margin: 0 }}>
            Both candidates received an equal share of <strong>{maxVotes} votes</strong> each.
          </p>
        </div>
      ) : (
        <div className="glass-card mb-4 text-center" style={{ padding: '1.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '14px' }}>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '1.05rem' }}>
            No votes were cast in this election room before closing.
          </p>
        </div>
      )}

      {/* Bar Chart Visualization */}
      <div className="glass-card mb-4" style={{ height: '320px', padding: '1.5rem 1rem' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#f8fafc' }}>Vote Distribution</h3>
        <ResponsiveContainer width="100%" height="85%">
          <BarChart data={chartData}>
            <XAxis dataKey="name" stroke="var(--text-secondary)" />
            <YAxis stroke="var(--text-secondary)" allowDecimals={false} />
            <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', borderRadius: '8px' }} />
            <Bar dataKey="votes" radius={[6, 6, 0, 0]}>
              {chartData.map((entry: any, index: number) => {
                const isWinner = winner && winner.name === entry.name;
                return (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={isWinner ? 'var(--accent-gold)' : CHART_COLORS[index % CHART_COLORS.length]} 
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed Table Breakdown */}
      <div className="glass-card">
        <h3 className="mb-4" style={{ fontSize: '1.2rem' }}>Detailed Candidate Breakdown</h3>
        <div className="table-responsive">
          <table className="votex-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Party</th>
                <th>Code</th>
                <th>Votes</th>
                <th>Percentage</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedCandidates.map((c: any) => {
                const isWinner = winner && winner.id === c.id;
                const percent = totalVotes > 0 ? (((c.votes || 0) / totalVotes) * 100).toFixed(1) : '0';
                return (
                  <tr key={c.id} style={isWinner ? { background: 'rgba(255,215,0,0.08)' } : {}}>
                    <td>
                      <strong>{c.name}</strong>
                    </td>
                    <td>{c.party || 'Independent'}</td>
                    <td><code>{c.code || '-'}</code></td>
                    <td style={{ fontWeight: 'bold', fontSize: '1.05rem', color: isWinner ? '#ffd700' : '#fff' }}>
                      {c.votes || 0}
                    </td>
                    <td>{percent}%</td>
                    <td>
                      {isWinner ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.2rem 0.6rem',
                          background: 'rgba(255, 215, 0, 0.2)',
                          color: '#ffd700',
                          borderRadius: '6px',
                          fontWeight: 700,
                          fontSize: '0.8rem'
                        }}>
                          <Trophy size={14} /> Winner
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Participant</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default PublishedResultsPage;
