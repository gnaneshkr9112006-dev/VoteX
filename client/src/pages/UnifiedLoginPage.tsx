import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  ShieldCheck,
  Vote,
  Mail,
  Phone,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import Toast from '../components/Toast';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import './UnifiedLogin.css';

const UnifiedLoginPage = () => {
  const navigate = useNavigate();
  const { unifiedLogin, unifiedSelectRole, googleLogin } = useAuth();

  // Input States
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Role Selection State (Appears ONLY AFTER user authenticates if they are new)
  const [needsRoleSelection, setNeedsRoleSelection] = useState(false);
  const [pendingIdentifier, setPendingIdentifier] = useState('');
  const [pendingName, setPendingName] = useState('');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'voter'>('voter');
  const [roomNumberInput, setRoomNumberInput] = useState('VOTEX-2026');

  // Direct Redirection State (for Repeat Logins)
  const [redirectingMessage, setRedirectingMessage] = useState<string | null>(null);

  /**
   * Handle Official Google Sign-In Success
   * Receives verified ID Token returned by Google's official account selector
   */
  const handleGoogleSuccess = async (idToken: string) => {
    setLoading(true);
    setToast(null);

    try {
      const res = await googleLogin(idToken, roomNumberInput);

      // CASE A: User has signed in before and already has an assigned role!
      // Direct redirection to their respective dashboard
      if (!res.needsRoleSelection && res.role) {
        setRedirectingMessage(
          `Welcome back, ${res.user?.name || res.user?.email || 'User'}! Redirecting directly to your portal...`
        );
        setToast({
          message: `Identified as ${res.role.toUpperCase()}. Directing to your portal...`,
          type: 'success'
        });

        setTimeout(() => {
          if (res.role === 'admin') {
            navigate('/admin');
          } else {
            navigate('/voter/verify');
          }
        }, 800);
        return;
      }

      // CASE B: First-time user! Transition to role selection screen.
      setNeedsRoleSelection(true);
      setPendingIdentifier(res.identifier || res.user?.email || '');
      setPendingName(
        res.name ||
          res.user?.name ||
          (res.identifier?.includes('@') ? res.identifier.split('@')[0] : 'User')
      );
      setToast({
        message: 'Google account verified! Please select whether you are an Administrator or a Voter.',
        type: 'info'
      });
    } catch (err: any) {
      setToast({ message: err.message || 'Google authentication error', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = (errorMessage: string) => {
    setToast({ message: errorMessage, type: 'error' });
  };

  /**
   * Execute email or phone authentication attempt
   */
  const handleAuthSubmit = async (targetId: string, provider: 'email' | 'phone') => {
    if (!targetId || !targetId.trim()) {
      setToast({ message: 'Please enter a valid email or phone number', type: 'error' });
      return;
    }

    setLoading(true);
    setToast(null);

    try {
      const res = await unifiedLogin({
        identifier: targetId.trim(),
        authProvider: provider
      });

      // CASE A: User has signed in before and already has an assigned role!
      if (!res.needsRoleSelection && res.role) {
        setRedirectingMessage(
          `Welcome back, ${res.user?.name || targetId}! Redirecting directly to your portal...`
        );
        setToast({
          message: `Identified as ${res.role.toUpperCase()}. Directing to your portal...`,
          type: 'success'
        });

        setTimeout(() => {
          if (res.role === 'admin') {
            navigate('/admin');
          } else {
            navigate('/voter/verify');
          }
        }, 800);
        return;
      }

      // CASE B: First-time user! Transition to role selection screen.
      setNeedsRoleSelection(true);
      setPendingIdentifier(res.identifier || targetId.trim());
      setPendingName(res.name || (targetId.includes('@') ? targetId.split('@')[0] : targetId));
      setToast({
        message: 'Account verified! Please select whether you are an Administrator or a Voter.',
        type: 'info'
      });
    } catch (err: any) {
      setToast({ message: err.message || 'Authentication error', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Confirm role selection for first-time user
   */
  const handleConfirmRole = async () => {
    if (!pendingIdentifier) return;
    setLoading(true);

    try {
      const res = await unifiedSelectRole({
        identifier: pendingIdentifier,
        role: selectedRole,
        name: pendingName,
        roomNumber: selectedRole === 'voter' ? roomNumberInput : undefined
      });

      setToast({
        message: `Registered as ${selectedRole.toUpperCase()}! Redirecting...`,
        type: 'success'
      });

      setTimeout(() => {
        if (res.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/voter/verify');
        }
      }, 700);
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to set role', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const isPhoneNumber = /^\+?[0-9\s\-()]{7,}$/.test(identifier.trim());

  return (
    <div className="unified-login-container">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="login-glass-card animate-fade-up">
        {/* Brand Header: Logo & Title */}
        <div className="login-brand">
          <div className="login-brand-logo-wrapper">
            <img
              src="/votex-logo.png"
              alt="VoteX Logo"
              className="login-brand-logo-img"
            />
          </div>
          <h1 className="text-gradient">VoteX</h1>
          <p>Secure Biometric & Blockchain Voting Network</p>
        </div>

        {/* Direct Redirection Banner for Returning Users */}
        {redirectingMessage && (
          <div className="direct-redirect-banner animate-fade-in">
            <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 0.5rem auto' }} />
            <h3>Signing In...</h3>
            <p>{redirectingMessage}</p>
          </div>
        )}

        {/* FIRST PAGE VIEW:
            Only Google (Official GIS) and Phone/Email login are visible.
            Admin and Voter options appear only after authentication. */}
        {!needsRoleSelection && !redirectingMessage && (
          <div className="animate-fade-in">
            {/* Primary Action: Official Google Sign-In button */}
            <div style={{ marginBottom: '1rem', width: '100%', display: 'flex', justifyContent: 'center' }}>
              <GoogleSignInButton
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                loading={loading}
              />
            </div>

            {/* Subtle Divider */}
            <div className="divider">
              <span>or continue with email / phone</span>
            </div>

            {/* Email or Phone Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAuthSubmit(identifier, isPhoneNumber ? 'phone' : 'email');
              }}
            >
              <div className="form-group mb-4">
                <div style={{ position: 'relative' }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#94a3b8'
                    }}
                  >
                    {isPhoneNumber ? <Phone size={18} /> : <Mail size={18} />}
                  </span>
                  <input
                    type="text"
                    className="form-input"
                    style={{ paddingLeft: '2.75rem' }}
                    placeholder="Email address or phone number"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={loading || !identifier.trim()}
                style={{ padding: '0.85rem' }}
              >
                <span>{loading ? 'Verifying...' : 'Continue'}</span>
                <ArrowRight size={16} />
              </button>
            </form>
          </div>
        )}

        {/* POST-LOGIN VIEW (ROLE SELECTION):
            Appears ONLY AFTER user authenticates if they are new! */}
        {needsRoleSelection && (
          <div className="animate-fade-in">
            <div className="role-selection-prompt">
              <span
                style={{
                  display: 'inline-block',
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: '#818cf8',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  marginBottom: '0.75rem'
                }}
              >
                Signed In: {pendingIdentifier}
              </span>
              <h2 style={{ fontSize: '1.4rem', margin: '0 0 0.5rem 0', color: '#fff' }}>
                Select Your Role
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
                Choose your role to access VoteX. This choice will be remembered for all future logins.
              </p>
            </div>

            <div className="role-cards-grid">
              {/* Option A: Administrator */}
              <div
                className={`role-option-card ${selectedRole === 'admin' ? 'selected-admin' : ''}`}
                onClick={() => setSelectedRole('admin')}
              >
                <div className="role-icon-box admin">
                  <ShieldCheck size={26} />
                </div>
                <div className="role-info">
                  <h4>Administrator</h4>
                  <p>Create & oversee election rooms, enroll voter photos, register candidates, and publish on-chain results.</p>
                </div>
              </div>

              {/* Option B: Voter */}
              <div
                className={`role-option-card ${selectedRole === 'voter' ? 'selected-voter' : ''}`}
                onClick={() => setSelectedRole('voter')}
              >
                <div className="role-icon-box voter">
                  <Vote size={26} />
                </div>
                <div className="role-info">
                  <h4>Voter</h4>
                  <p>Authenticate with AI facial recognition & hardware passkeys to cast confidential blockchain ballots.</p>
                </div>
              </div>
            </div>

            {/* Voter Room selection field if voter selected */}
            {selectedRole === 'voter' && (
              <div
                className="form-group mb-4"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  padding: '0.85rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}
              >
                <label className="form-label" style={{ fontSize: '0.825rem' }}>
                  Election Room Code
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={roomNumberInput}
                  onChange={(e) => setRoomNumberInput(e.target.value.toUpperCase())}
                  placeholder="e.g. VOTEX-2026 or VOTEX-E001"
                />
                <small style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', marginTop: '0.25rem' }}>
                  Default room: <code>VOTEX-2026</code> (200+ concurrent election rooms active).
                </small>
              </div>
            )}

            <button
              className="btn btn-primary w-full mb-3"
              onClick={handleConfirmRole}
              disabled={loading}
              style={{
                padding: '0.85rem',
                background: selectedRole === 'admin'
                  ? 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)'
                  : 'linear-gradient(135deg, #06b6d4 0%, #2563eb 100%)'
              }}
            >
              <span>{loading ? 'Configuring...' : `Proceed as ${selectedRole === 'admin' ? 'Administrator' : 'Voter'}`}</span>
              <ArrowRight size={18} />
            </button>

            <button
              type="button"
              className="btn btn-secondary w-full"
              style={{ fontSize: '0.85rem', padding: '0.5rem' }}
              onClick={() => setNeedsRoleSelection(false)}
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UnifiedLoginPage;
