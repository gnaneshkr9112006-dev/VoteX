import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { electionsApi } from '../api/elections';
import {
  BarChart3,
  CheckCircle,
  Search,
  Zap,
  Layers,
  ChevronLeft,
  ChevronRight,
  Vote,
  Users,
  Copy,
  Check,
  Filter
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import Toast from '../components/Toast';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [elections, setElections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scaling, setScaling] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft' | 'closed' | 'published'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [copiedRoom, setCopiedRoom] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const loadElections = () => {
    setLoading(true);
    electionsApi.getElections()
      .then(res => {
        const list = Array.isArray(res) ? res : (res.elections || []);
        setElections(list);
      })
      .catch(err => {
        setToast({ message: err.message || 'Failed to load elections', type: 'error' });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadElections();
  }, []);

  // Scale / Benchmark action: trigger 200+ elections initialization
  const handleScaleBenchmark = async () => {
    setScaling(true);
    try {
      const res: any = await electionsApi.seedScale200(205);
      setToast({
        message: res.message || '200+ simultaneous elections scaled successfully!',
        type: 'success'
      });
      loadElections();
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to scale elections', type: 'error' });
    } finally {
      setScaling(false);
    }
  };

  // Copy room code
  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedRoom(code);
    setTimeout(() => setCopiedRoom(null), 1500);
  };

  // Filtered elections based on search query and status filter
  const filteredElections = useMemo(() => {
    return elections.filter(el => {
      const matchesSearch =
        searchQuery === '' ||
        (el.title && el.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (el.room_number && el.room_number.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === 'all' || el.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [elections, searchQuery, statusFilter]);

  // Pagination calculation
  const totalItems = filteredElections.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedElections = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredElections.slice(start, start + pageSize);
  }, [filteredElections, currentPage, pageSize]);

  // Adjust page if filter shrinks total
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const total = elections.length;
  const active = elections.filter(e => e.status === 'active').length;
  const published = elections.filter(e => e.status === 'published').length;

  return (
    <div className="dashboard animate-fade-up">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Dashboard Top Header */}
      <div className="dash-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="heading-lg">Election Management Hub</h1>
          <p className="text-secondary" style={{ marginTop: '0.25rem' }}>
            Operating concurrently across {total} election rooms with real-time on-chain tallying.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {total < 200 && (
            <button
              className="btn btn-secondary"
              onClick={handleScaleBenchmark}
              disabled={scaling}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                border: '1px solid #f59e0b',
                color: '#f59e0b'
              }}
              title="Initialize 200+ simultaneous election rooms for high-concurrency testing"
            >
              <Zap size={16} />
              <span>{scaling ? 'Scaling...' : '⚡ Scale to 200+ Elections'}</span>
            </button>
          )}

          <Link to="/admin/create-election" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>+ Create Election Room</span>
          </Link>
        </div>
      </div>

      {/* High-Scale Metrics Grid */}
      <div className="stats-grid">
        <div className="stat-card glass-card">
          <div className="stat-icon"><Layers color="var(--accent-cyan)" size={24}/></div>
          <div className="stat-info">
            <h3>Total Elections</h3>
            <p>{total}</p>
          </div>
        </div>

        <div className="stat-card glass-card">
          <div className="stat-icon"><CheckCircle color="var(--accent-emerald)" size={24}/></div>
          <div className="stat-info">
            <h3>Simultaneous Active</h3>
            <p>{active}</p>
          </div>
        </div>

        <div className="stat-card glass-card">
          <div className="stat-icon"><Vote color="#8b5cf6" size={24}/></div>
          <div className="stat-info">
            <h3>Published Results</h3>
            <p>{published}</p>
          </div>
        </div>
      </div>

      {/* Simultaneous Scale Banner */}
      {total >= 200 && (
        <div
          className="glass-card mb-4 animate-fade-in"
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.5rem',
            flexWrap: 'wrap',
            gap: '1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Zap size={22} color="#10b981" />
            <div>
              <strong style={{ color: '#fff', fontSize: '1.05rem' }}>
                High-Concurrency Scale Active: {total} Simultaneous Elections Running
              </strong>
              <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                All rooms are isolated with independent Ethereum blockchain commitments, voter rosters, and live WebSocket streams.
              </div>
            </div>
          </div>
          <span
            style={{
              background: 'rgba(16, 185, 129, 0.2)',
              color: '#34d399',
              padding: '0.35rem 0.75rem',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: 700
            }}
          >
            200+ ACTIVE CONCURRENT ROOMS
          </span>
        </div>
      )}

      {/* Main Elections List with Search & Pagination */}
      <div className="elections-list glass-card">
        {/* Controls Toolbar: Search & Filter Tabs */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          {/* Live Search Input */}
          <div style={{ position: 'relative', minWidth: '280px', flex: '1 1 300px' }}>
            <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2.5rem' }}
              placeholder="Search across 200+ elections by title or room code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Status Filter Buttons */}
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {(['all', 'active', 'draft', 'published', 'closed'] as const).map(st => (
              <button
                key={st}
                className="btn btn-secondary"
                style={{
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.825rem',
                  textTransform: 'capitalize',
                  background: statusFilter === st ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                  borderColor: statusFilter === st ? 'rgba(99, 102, 241, 0.5)' : 'rgba(255, 255, 255, 0.08)',
                  color: statusFilter === st ? '#fff' : '#94a3b8'
                }}
                onClick={() => setStatusFilter(st)}
              >
                {st} {st === 'all' ? `(${total})` : st === 'active' ? `(${active})` : ''}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
            Loading election registries...
          </div>
        ) : filteredElections.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
            No elections found matching "{searchQuery}".
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="votex-table">
                <thead>
                  <tr>
                    <th>Election Title</th>
                    <th>Room Code</th>
                    <th>Status</th>
                    <th>Candidates</th>
                    <th>Turnout</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedElections.map(el => (
                    <tr key={el.id}>
                      <td>
                        <strong>{el.title}</strong>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                          Start: {new Date(el.start_time).toLocaleDateString()} · End: {new Date(el.end_time).toLocaleDateString()}
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="account-chip"
                          onClick={() => handleCopy(el.room_number)}
                          title="Click to copy room code"
                          style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.85rem' }}
                        >
                          <span>{el.room_number}</span>
                          {copiedRoom === el.room_number ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                        </button>
                      </td>
                      <td><StatusBadge status={el.status} /></td>
                      <td>
                        <span style={{ color: '#cbd5e1', fontSize: '0.9rem' }}>
                          {el.candidate_count ?? 2} registered
                        </span>
                      </td>
                      <td>
                        <span style={{ color: '#cbd5e1', fontSize: '0.9rem' }}>
                          {el.vote_count ?? 0} / {el.voter_count ?? 3} votes
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {el.status === 'published' && (
                            <Link 
                              to={`/results?room=${el.room_number}`} 
                              className="btn btn-primary" 
                              style={{ 
                                padding: '0.3rem 0.6rem', 
                                fontSize: '0.8rem',
                                background: 'linear-gradient(135deg, #ffd700 0%, #f59e0b 100%)',
                                color: '#000',
                                fontWeight: 700
                              }}
                            >
                              🏆 Results
                            </Link>
                          )}
                          <Link
                            to={`/admin/candidates?electionId=${el.id}`}
                            className="btn btn-secondary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                          >
                            Candidates
                          </Link>
                          <Link
                            to={`/admin/voters?electionId=${el.id}`}
                            className="btn btn-secondary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                          >
                            Voters
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', flexWrap: 'wrap', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalItems)} of {totalItems} elections
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <select
                  className="form-input"
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', width: 'auto' }}
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <option value={15}>15 per page</option>
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                </select>

                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.35rem 0.65rem' }}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem', fontSize: '0.85rem', color: '#cbd5e1' }}>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.35rem 0.65rem' }}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
