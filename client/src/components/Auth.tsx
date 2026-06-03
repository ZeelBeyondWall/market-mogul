import React, { useState, useEffect } from 'react';
import { supabase } from '../net/supabase';
import { useGame } from '../store/gameStore';
import { Audio } from '../audio/audio';

export function Auth() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const setSession = useGame(s => s.setSession);
  const pushToast = useGame(s => s.pushToast);

  // Clear errors when toggling modes
  useEffect(() => {
    setError('');
  }, [isRegister]);

  const validateInputs = () => {
    const userTrim = username.trim();
    if (userTrim.length < 3) {
      setError('Username must be at least 3 characters.');
      return false;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(userTrim)) {
      setError('Username can only contain letters, numbers, and underscores.');
      return false;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');

    if (!validateInputs()) {
      Audio.click(); // play click or error sound if available
      return;
    }

    setLoading(true);
    const userTrim = username.trim();
    const mockEmail = `${userTrim.toLowerCase()}@marketmogul.com`;

    try {
      if (isRegister) {
        // Sign Up
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email: mockEmail,
          password: password,
          options: {
            data: {
              username: userTrim,
            }
          }
        });

        if (signUpErr) {
          if (signUpErr.message.includes('already registered') || signUpErr.status === 422) {
            setError('Username is already taken.');
          } else {
            setError(signUpErr.message);
          }
          Audio.click();
        } else if (data?.user) {
          pushToast('✓ Account created successfully! Logging you in...', 'ok');
          // Sign in after sign up to make sure session is active
          const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
            email: mockEmail,
            password: password,
          });
          if (signInErr) {
            setError(signInErr.message);
          } else if (signInData?.session) {
            setSession(signInData.session);
            Audio.buy(); // Success sound
          }
        }
      } else {
        // Sign In
        const { data, error: signInErr } = await supabase.auth.signInWithPassword({
          email: mockEmail,
          password: password,
        });

        if (signInErr) {
          if (signInErr.message.includes('Invalid login credentials')) {
            setError('Invalid username or password.');
          } else {
            setError(signInErr.message);
          }
          Audio.click();
        } else if (data?.session) {
          setSession(data.session);
          pushToast(`Welcome back, ${userTrim}!`, 'ok');
          Audio.buy(); // Success sound
        }
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred.');
      Audio.click();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-fullscreen">
      <div className="bg-grid" />
      <style>{`
        .auth-fullscreen {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at center, #0b111e 0%, #030508 100%);
          font-family: 'Outfit', sans-serif;
          overflow: hidden;
        }
        .auth-glow-orb {
          position: absolute;
          width: 500px;
          height: 500px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(0, 240, 255, 0.08) 0%, rgba(255, 0, 128, 0.02) 70%, transparent 100%);
          filter: blur(40px);
          pointer-events: none;
        }
        .auth-card {
          position: relative;
          width: 100%;
          max-width: 440px;
          padding: 40px;
          background: rgba(10, 15, 26, 0.65);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(0, 240, 255, 0.15);
          border-radius: 16px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), 
                      0 0 40px rgba(0, 240, 255, 0.05),
                      inset 0 1px 0 rgba(255, 255, 255, 0.05);
          display: flex;
          flex-direction: column;
          align-items: center;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .auth-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 10%;
          right: 10%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(0, 240, 255, 0.5), transparent);
        }
        .auth-logo-area {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 30px;
        }
        .auth-logo-svg {
          width: 56px;
          height: 56px;
          fill: var(--cyan, #00f0ff);
          filter: drop-shadow(0 0 10px rgba(0, 240, 255, 0.4));
          margin-bottom: 12px;
          animation: logo-float 4s ease-in-out infinite;
        }
        @keyframes logo-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .auth-logo-area h1 {
          font-size: 26px;
          font-weight: 800;
          letter-spacing: 2px;
          margin: 0;
          background: linear-gradient(135deg, #ffffff 30%, #00f0ff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 0 30px rgba(0, 240, 255, 0.1);
        }
        .auth-logo-area p {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin: 4px 0 0 0;
        }
        .auth-tabs {
          display: flex;
          width: 100%;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 8px;
          padding: 4px;
          margin-bottom: 24px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .auth-tab {
          flex: 1;
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.5);
          font-size: 13px;
          font-weight: 600;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .auth-tab.active {
          background: rgba(0, 240, 255, 0.15);
          color: #ffffff;
          border: 1px solid rgba(0, 240, 255, 0.2);
          text-shadow: 0 0 8px rgba(0, 240, 255, 0.5);
        }
        .auth-form {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .auth-input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
          width: 100%;
        }
        .auth-input-group label {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 1px;
          font-weight: 600;
        }
        .auth-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }
        .auth-input {
          width: 100%;
          background: rgba(5, 8, 15, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #ffffff;
          padding: 12px 14px;
          border-radius: 8px;
          font-size: 14px;
          font-family: inherit;
          transition: all 0.2s ease;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);
        }
        .auth-input:focus {
          outline: none;
          border-color: rgba(0, 240, 255, 0.6);
          box-shadow: 0 0 12px rgba(0, 240, 255, 0.15), inset 0 2px 4px rgba(0,0,0,0.5);
        }
        .auth-submit-btn {
          margin-top: 10px;
          background: linear-gradient(135deg, #00f0ff 0%, #0077ff 100%);
          color: #ffffff;
          border: none;
          border-radius: 8px;
          padding: 14px;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 1px;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 15px rgba(0, 119, 255, 0.3);
          text-transform: uppercase;
          position: relative;
          overflow: hidden;
        }
        .auth-submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(0, 240, 255, 0.4);
          filter: brightness(1.1);
        }
        .auth-submit-btn:active:not(:disabled) {
          transform: translateY(1px);
        }
        .auth-submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          background: #121b2b;
          box-shadow: none;
        }
        .auth-error {
          width: 100%;
          background: rgba(255, 0, 77, 0.1);
          border: 1px solid rgba(255, 0, 77, 0.3);
          color: #ff3366;
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 12px;
          line-height: 1.4;
          text-align: center;
          animation: shake 0.3s ease-in-out;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .auth-hint {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.3);
          text-align: center;
          margin-top: 12px;
          line-height: 1.5;
        }
        .spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-radius: 50%;
          border-top-color: #fff;
          animation: spin 0.8s linear infinite;
          margin-right: 8px;
          vertical-align: middle;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div className="auth-glow-orb" style={{ top: '20%', left: '30%' }} />
      <div className="auth-glow-orb" style={{ bottom: '15%', right: '25%', background: 'radial-gradient(circle, rgba(255, 0, 128, 0.08) 0%, rgba(0, 240, 255, 0.02) 70%, transparent 100%)' }} />

      <div className="auth-card">
        <div className="auth-logo-area">
          <svg className="auth-logo-svg">
            <use href="#logoFull" />
          </svg>
          <h1>MARKETVERSEX</h1>
          <p>Multiplayer Cyber-Trading</p>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${!isRegister ? 'active' : ''}`}
            onClick={() => { setIsRegister(false); Audio.click(); }}
          >
            Sign In
          </button>
          <button
            className={`auth-tab ${isRegister ? 'active' : ''}`}
            onClick={() => { setIsRegister(true); Audio.click(); }}
          >
            Register
          </button>
        </div>

        {error && <div className="auth-error">⚠️ {error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-input-group">
            <label htmlFor="username">Username</label>
            <div className="auth-input-wrapper">
              <input
                id="username"
                type="text"
                className="auth-input"
                placeholder="e.g. Trader_X"
                value={username}
                onChange={e => setUsername(e.target.value)}
                disabled={loading}
                required
                autoComplete="username"
                maxLength={20}
              />
            </div>
          </div>

          <div className="auth-input-group">
            <label htmlFor="password">Password</label>
            <div className="auth-input-wrapper">
              <input
                id="password"
                type="password"
                className="auth-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading && <span className="spinner" />}
            {isRegister ? 'Create Account' : 'Access Terminal'}
          </button>
        </form>

        <p className="auth-hint">
          {isRegister
            ? 'Your account handles persistent cloud synchronization of your portfolio and cash balance.'
            : 'Enter your credentials to restore your live trading environment.'}
        </p>
      </div>
    </div>
  );
}
