import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface GoogleSignInButtonProps {
  onSuccess: (idToken: string) => void;
  onError: (errorMessage: string) => void;
  loading: boolean;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onSuccess,
  onError,
  loading
}) => {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [gisLoaded, setGisLoaded] = useState(false);

  const clientId = (String((import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '')).trim();

  // Monitor loading of official Google Identity Services library
  useEffect(() => {
    if (window.google?.accounts?.id) {
      setGisLoaded(true);
      return;
    }

    const interval = setInterval(() => {
      if (window.google?.accounts?.id) {
        setGisLoaded(true);
        clearInterval(interval);
      }
    }, 150);

    return () => clearInterval(interval);
  }, []);

  // Initialize and render official Google Identity Services button
  useEffect(() => {
    if (!gisLoaded || !buttonRef.current || !clientId) return;

    try {
      window.google!.accounts.id.initialize({
        client_id: clientId,
        callback: (response: { credential: string }) => {
          if (!response || !response.credential) {
            onError('Google authentication was cancelled or returned no credentials.');
            return;
          }
          onSuccess(response.credential);
        },
        auto_select: false,
        cancel_on_tap_outside: true
      });

      buttonRef.current.innerHTML = '';
      window.google!.accounts.id.renderButton(buttonRef.current, {
        type: 'standard',
        theme: 'filled_blue',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: 380
      });
    } catch (err: any) {
      console.error('Failed to initialize Google Identity Services button:', err);
      onError('Google Identity Services error: ' + err.message);
    }
  }, [gisLoaded, clientId, onSuccess, onError]);

  return (
    <div className="google-auth-wrapper" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div
        ref={buttonRef}
        className="official-google-btn-container"
        style={{
          display: loading ? 'none' : 'flex',
          justifyContent: 'center',
          width: '100%',
          minHeight: '44px'
        }}
      />
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#818cf8', fontSize: '0.85rem', padding: '0.6rem 0' }}>
          <Loader2 size={18} className="animate-spin" />
          <span>Authenticating with Google...</span>
        </div>
      )}
    </div>
  );
};
