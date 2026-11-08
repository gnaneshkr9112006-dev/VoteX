import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../api/auth';
import {
  ShieldAlert,
  ArrowLeft,
  Phone,
  KeyRound,
  CheckCircle2,
  RefreshCw,
  Send,
  MessageSquare,
  AlertCircle,
  Lock
} from 'lucide-react';
import './AuthPages.css';

const VoterLoginPage = () => {
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [roomNumber, setRoomNumber] = useState('');
  const [voterId, setVoterId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [gatewayNotice, setGatewayNotice] = useState<string>('');
  const [carrierDelivered, setCarrierDelivered] = useState<boolean>(true);
  const [countdown, setCountdown] = useState(0);

  // Auto-filled phone security state
  const [phoneLocked, setPhoneLocked] = useState(false);
  const [phoneLookupLoading, setPhoneLookupLoading] = useState(false);
  const [voterDetails, setVoterDetails] = useState<{
    fullName?: string;
    voterId?: string;
    maskedPhone?: string;
    hasVoted?: boolean;
  } | null>(null);
  const [lookupNotice, setLookupNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  // Prefill active room number from localStorage if present
  useEffect(() => {
    try {
      const active = localStorage.getItem('votex_active_election');
      if (active) {
        const parsed = JSON.parse(active);
        if (parsed?.room_number && !roomNumber) {
          setRoomNumber(parsed.room_number);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Handle Resend Countdown Timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Lookup voter's registered phone number from server
  const performPhoneLookup = async (rNum: string, vId: string) => {
    const cleanRoom = rNum.trim();
    const cleanVoter = vId.trim();

    if (!cleanRoom || !cleanVoter) {
      setPhoneNumber('');
      setPhoneLocked(false);
      setVoterDetails(null);
      setLookupNotice(null);
      return;
    }

    setPhoneLookupLoading(true);
    setLookupNotice(null);

    try {
      const res: any = await authApi.lookupVoterPhone({
        roomNumber: cleanRoom,
        voterId: cleanVoter
      });

      if (res.found && res.phoneNumber) {
        setPhoneNumber(res.phoneNumber);
        setPhoneLocked(true);
        setVoterDetails({
          fullName: res.fullName,
          voterId: res.voterId,
          maskedPhone: res.maskedPhone,
          hasVoted: res.hasVoted
        });

        if (res.hasVoted) {
          setError(`Voter ${res.voterId} (${res.fullName}) has already cast their ballot in room ${cleanRoom}.`);
          setLookupNotice({
            type: 'error',
            text: `Ballot already cast for this voter in room ${cleanRoom}.`
          });
        } else {
          setError('');
          setLookupNotice({
            type: 'success',
            text: `Registered phone automatically linked to ${res.fullName} (${res.voterId}). Phone block is locked.`
          });
        }
      }
    } catch (err: any) {
      setPhoneNumber('');
      setPhoneLocked(false);
      setVoterDetails(null);
      setLookupNotice({
        type: 'error',
        text: err.message || `No registered record found for Voter ID "${cleanVoter}" in room "${cleanRoom}".`
      });
    } finally {
      setPhoneLookupLoading(false);
    }
  };

  // Debounced auto-fetch phone when user finishes entering Voter ID
  useEffect(() => {
    const cleanRoom = roomNumber.trim();
    const cleanVoter = voterId.trim();

    if (!cleanVoter) {
      setPhoneNumber('');
      setPhoneLocked(false);
      setVoterDetails(null);
      setLookupNotice(null);
      return;
    }

    if (cleanRoom && cleanVoter.length >= 2) {
      const timer = setTimeout(() => {
        performPhoneLookup(cleanRoom, cleanVoter);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [voterId, roomNumber]);

  // Quick Demo Autofill Helper
  const handleDemoFill = () => {
    setRoomNumber('VOTEX-2026');
    setVoterId('V001');
    setError('');
    performPhoneLookup('VOTEX-2026', 'V001');
  };

  // STEP 1: Submit Credentials & Request OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneLocked || !phoneNumber) {
      setError('Please enter a valid registered Voter ID to auto-fill and lock your phone number.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res: any = await authApi.sendVoterOtp({
        roomNumber: roomNumber.trim(),
        voterId: voterId.trim(),
        phoneNumber: phoneNumber.trim()
      });

      setMaskedPhone(res.maskedPhone || phoneNumber);
      if (res.gatewayNotice) {
        setGatewayNotice(res.gatewayNotice);
      } else {
        setGatewayNotice('');
      }
      setCarrierDelivered(res.carrierDelivered !== false);
      setStep('otp');
      setCountdown(60);
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please check your room and voter ID.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (countdown > 0) return;
    setError('');
    setLoading(true);
    try {
      const res: any = await authApi.sendVoterOtp({
        roomNumber: roomNumber.trim(),
        voterId: voterId.trim(),
        phoneNumber: phoneNumber.trim()
      });
      if (res.gatewayNotice) {
        setGatewayNotice(res.gatewayNotice);
      }
      setCarrierDelivered(res.carrierDelivered !== false);
      setCountdown(60);
    } catch (err: any) {
      setError(err.message || 'Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Verify OTP and Proceed to Biometrics
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await login('voter', {
        roomNumber: roomNumber.trim(),
        voterId: voterId.trim(),
        phoneNumber: phoneNumber.trim(),
        otp: otp.trim()
      });
      // Proceed to the next step: Biometric Verification
      navigate('/voter/verify');
    } catch (err: any) {
      setError(err.message || 'Invalid or expired OTP code. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card glass-card animate-fade-up">
        <Link to="/" className="back-link">
          <ArrowLeft size={16} /> Back to home
        </Link>
        
        <h2 className="text-gradient" style={{ backgroundImage: 'var(--gradient-emerald)' }}>
          Voter Portal
        </h2>
        <p className="auth-desc">
          {step === 'credentials'
            ? 'Enter your election room and Voter ID. Your registered phone number will be automatically retrieved and locked.'
            : 'Enter the 6-digit one-time code dispatched to your registered phone number.'}
        </p>

        {error && (
          <div className="error-box">
            <ShieldAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: Enter Room Number & Voter ID (Phone is auto-filled and locked) */}
        {step === 'credentials' && (
          <form onSubmit={handleRequestOtp}>
            <div className="form-group">
              <label className="form-label">Room Number</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. SIT-9026 or VOTEX-2026"
                value={roomNumber}
                onChange={e => {
                  setRoomNumber(e.target.value.toUpperCase());
                }}
                required
              />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label className="form-label" style={{ margin: 0 }}>Voter ID</label>
                {phoneLookupLoading && (
                  <span style={{ fontSize: '0.74rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <RefreshCw size={11} className="spin" /> Checking voter roll...
                  </span>
                )}
              </div>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. V001 or VTR-003"
                value={voterId}
                onChange={e => {
                  setVoterId(e.target.value);
                  if (!e.target.value.trim()) {
                    setPhoneNumber('');
                    setPhoneLocked(false);
                    setVoterDetails(null);
                    setLookupNotice(null);
                  }
                }}
                onBlur={() => {
                  if (roomNumber.trim() && voterId.trim()) {
                    performPhoneLookup(roomNumber, voterId);
                  }
                }}
                required
              />
            </div>

            {/* Phone Number Block - STRICTLY AUTO-FILLED AND LOCKED */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                  <Phone size={14} color={phoneLocked ? '#10b981' : '#06b6d4'} />
                  <span>Phone Number</span>
                </label>
                {phoneLocked ? (
                  <span style={{
                    fontSize: '0.74rem',
                    color: '#10b981',
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: 600
                  }}>
                    <Lock size={11} /> Auto-filled &amp; Locked
                  </span>
                ) : (
                  <span style={{ fontSize: '0.74rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Lock size={11} /> Auto-linked from Voter ID
                  </span>
                )}
              </div>

              <div style={{ position: 'relative' }}>
                <input
                  type="tel"
                  className="form-input"
                  placeholder={
                    phoneLookupLoading
                      ? "Fetching registered phone..."
                      : phoneLocked
                        ? phoneNumber
                        : "Enter Voter ID above to automatically load phone..."
                  }
                  value={phoneNumber}
                  readOnly={true} // STRICT: User cannot type any other phone number
                  tabIndex={-1}
                  style={{
                    background: phoneLocked ? 'rgba(16, 185, 129, 0.08)' : 'rgba(15, 23, 42, 0.55)',
                    borderColor: phoneLocked ? 'rgba(16, 185, 129, 0.45)' : 'rgba(255, 255, 255, 0.08)',
                    color: phoneLocked ? '#6ee7b7' : '#94a3b8',
                    cursor: 'not-allowed',
                    fontWeight: phoneLocked ? 600 : 400,
                    letterSpacing: phoneLocked ? '0.06em' : 'normal',
                    paddingRight: '2.5rem'
                  }}
                  required
                />
                <div style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  color: phoneLocked ? '#10b981' : '#64748b'
                }}>
                  <Lock size={16} />
                </div>
              </div>

              {/* Status and Verification Badges */}
              {phoneLocked && voterDetails && (
                <div style={{
                  marginTop: '0.45rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  background: 'rgba(16, 185, 129, 0.09)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.78rem',
                  color: '#34d399'
                }}>
                  <CheckCircle2 size={15} style={{ flexShrink: 0, color: '#10b981' }} />
                  <span>
                    Linked to <strong>{voterDetails.fullName}</strong> ({voterDetails.voterId}). Phone is locked to prevent unauthorized numbers.
                  </span>
                </div>
              )}

              {lookupNotice?.type === 'error' && (
                <div style={{
                  marginTop: '0.45rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.78rem',
                  color: '#f87171'
                }}>
                  <AlertCircle size={15} style={{ flexShrink: 0, color: '#ef4444' }} />
                  <span>{lookupNotice.text}</span>
                </div>
              )}

              {!phoneLocked && !lookupNotice && (
                <span style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginTop: '0.35rem' }}>
                  🔒 Phone number is automatically retrieved and locked from your voter record to ensure identity integrity.
                </span>
              )}
            </div>

            {/* Quick Demo Fill Pill */}
            <div style={{
              background: 'rgba(6, 182, 212, 0.08)',
              border: '1px dashed rgba(6, 182, 212, 0.3)',
              borderRadius: '8px',
              padding: '0.6rem 0.85rem',
              marginBottom: '1rem',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem'
            }}>
              <div>
                <span style={{ color: '#94a3b8' }}>Demo Record: </span>
                <strong style={{ color: '#38bdf8' }}>V001</strong>
                <span style={{ color: '#64748b', margin: '0 0.3rem' }}>•</span>
                <span style={{ color: '#cbd5e1' }}>Gnanesh K R</span>
              </div>
              <button
                type="button"
                onClick={handleDemoFill}
                style={{
                  background: 'rgba(6, 182, 212, 0.2)',
                  border: 'none',
                  color: '#38bdf8',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}
              >
                Auto-fill
              </button>
            </div>

            <button
              type="submit"
              className="btn btn-primary full-width mt-4"
              style={{
                background: 'var(--gradient-emerald)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                opacity: (!phoneNumber || !phoneLocked || phoneLookupLoading) ? 0.7 : 1,
                cursor: (!phoneNumber || !phoneLocked || phoneLookupLoading) ? 'not-allowed' : 'pointer'
              }}
              disabled={loading || phoneLookupLoading || !phoneLocked || !phoneNumber}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="spin" />
                  <span>Verifying voter record...</span>
                </>
              ) : phoneLookupLoading ? (
                <>
                  <RefreshCw size={16} className="spin" />
                  <span>Retrieving official phone...</span>
                </>
              ) : !phoneLocked ? (
                <>
                  <Lock size={16} />
                  <span>Enter Voter ID to Unlock SMS</span>
                </>
              ) : (
                <>
                  <Send size={16} />
                  <span>Send Verification Code (SMS)</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: Enter & Verify OTP */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp}>
            <div style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '12px',
              padding: '1.25rem 1rem',
              marginBottom: '1.5rem',
              textAlign: 'center'
            }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                marginBottom: '0.6rem'
              }}>
                <CheckCircle2 size={22} />
              </div>
              <h4 style={{ margin: '0 0 0.35rem 0', color: '#10b981', fontSize: '1rem', fontWeight: 600 }}>
                Verification Code Sent via SMS
              </h4>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#cbd5e1' }}>
                A 6-digit verification code has been dispatched via SMS to <strong style={{ color: '#fff' }}>{maskedPhone}</strong>.
              </p>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                Please check your mobile phone's SMS messages and enter the code below.
              </p>
            </div>

            {/* Carrier Gateway Notice */}
            {gatewayNotice && (
              <div style={{
                background: 'rgba(234, 179, 8, 0.1)',
                border: '1px solid rgba(234, 179, 8, 0.35)',
                borderRadius: '10px',
                padding: '0.85rem 1rem',
                marginBottom: '1rem',
                fontSize: '0.82rem',
                color: '#fef08a',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem'
              }}>
                <AlertCircle size={18} color="#eab308" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1, lineHeight: 1.45 }}>
                  <strong style={{ display: 'block', color: '#fbbf24', marginBottom: '0.2rem' }}>
                    Carrier Delivery Notice:
                  </strong>
                  <span>{gatewayNotice}</span>
                  {gatewayNotice.toLowerCase().includes('twilio') && (
                    <div style={{ marginTop: '0.45rem', fontSize: '0.78rem', color: '#fef9c3' }}>
                      💡 <strong>How to fix for physical SMS:</strong> Since your Twilio account is a Trial account, Twilio restricts outbound SMS to registered numbers. Add your phone number at <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 4px', borderRadius: '4px' }}>twilio.com/console/phone-numbers/verified</code> to receive physical SMS on trial.
                    </div>
                  )}
                </div>
              </div>
            )}


            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <KeyRound size={14} color="#10b981" />
                <span>6-Digit Verification Code</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                className="form-input"
                style={{
                  fontSize: '1.4rem',
                  letterSpacing: '0.35em',
                  textAlign: 'center',
                  fontWeight: 700,
                  fontFamily: 'monospace'
                }}
                placeholder="••••••"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoFocus
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary full-width mt-4"
              style={{
                background: 'var(--gradient-emerald)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
              disabled={loading || otp.length !== 6}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="spin" />
                  <span>Verifying code...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Verify OTP &amp; Proceed to Biometrics</span>
                </>
              )}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', fontSize: '0.82rem' }}>
              <button
                type="button"
                onClick={() => { setStep('credentials'); setOtp(''); }}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <ArrowLeft size={13} /> Edit phone or ID
              </button>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={countdown > 0 || loading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: countdown > 0 ? '#64748b' : '#38bdf8',
                  cursor: countdown > 0 ? 'not-allowed' : 'pointer',
                  fontWeight: 600
                }}
              >
                {countdown > 0 ? `Resend SMS in ${countdown}s` : 'Resend Code'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default VoterLoginPage;
