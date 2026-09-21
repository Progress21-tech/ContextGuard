import React, { useState } from 'react';

interface LoginViewProps {
  onLogin: (userId: string, password: string) => Promise<boolean>;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [userId, setUserId] = useState('USR-012');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const success = await onLogin(userId, password);
    setLoading(false);
    if (!success) {
      setError('Invalid Staff ID or password. Please try demo credentials below.');
    }
  };

  const handleSelectDemo = (id: string) => {
    setUserId(id);
    setPassword('password123');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f7faf8', padding: '20px' }}>
      <div style={{ maxWidth: '440px', width: '100%', background: 'white', border: '1px solid #dce8e5', borderRadius: '12px', padding: '32px', boxShadow: '0 8px 30px #0001' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ background: '#b8efca', color: '#102f30', fontWeight: 800, width: '36px', height: '36px', display: 'grid', placeItems: 'center', borderRadius: '10px', fontSize: '18px' }}>C</div>
          <div>
            <strong style={{ fontSize: '18px', display: 'block', color: '#102a2b' }}>ContextGuard</strong>
            <span style={{ fontSize: '11px', color: '#617879' }}>Clinical Access Control & Security Gateway</span>
          </div>
        </div>

        <h2 style={{ fontSize: '20px', margin: '0 0 6px', color: '#102a2b' }}>Sign in to Clinical Gateway</h2>
        <p style={{ fontSize: '12px', color: '#617879', margin: '0 0 20px', lineHeight: 1.5 }}>
          Authentication enforces server-side JWT verification. Least privilege access is determined from real-time care context.
        </p>

        {error && (
          <div style={{ background: '#fde9ea', color: '#a23c45', padding: '10px 12px', borderRadius: '6px', fontSize: '12px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#617879', marginBottom: '6px' }}>
            Staff Credential ID (e.g. USR-012)
            <input
              type="text"
              value={userId}
              onChange={e => setUserId(e.target.value)}
              required
              style={{ display: 'block', width: '100%', padding: '10px', marginTop: '4px', border: '1px solid #cfe0db', borderRadius: '6px', fontSize: '13px' }}
            />
          </label>

          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#617879', margin: '14px 0 6px' }}>
            Password
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{ display: 'block', width: '100%', padding: '10px', marginTop: '4px', border: '1px solid #cfe0db', borderRadius: '6px', fontSize: '13px' }}
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="primary-button"
            style={{ width: '100%', marginTop: '20px', padding: '12px', fontSize: '13px' }}
          >
            {loading ? 'Verifying Credentials...' : 'Sign In to Gateway'}
          </button>
        </form>

        <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid #dce8e5' }}>
          <p style={{ fontSize: '10px', fontFamily: 'DM Mono', color: '#2b8873', margin: '0 0 10px', letterSpacing: '0.8px' }}>
            HACKATHON DEMO ACCOUNTS (Password: password123)
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button className="ghost-button" style={{ marginLeft: 0, textAlign: 'left', fontSize: '10px' }} onClick={() => handleSelectDemo('USR-012')}>
              Dr. David Ade<br /><small style={{ color: '#617879' }}>Doctor (ED)</small>
            </button>
            <button className="ghost-button" style={{ marginLeft: 0, textAlign: 'left', fontSize: '10px' }} onClick={() => handleSelectDemo('USR-004')}>
              Nurse Chinedu<br /><small style={{ color: '#617879' }}>Nurse (ED)</small>
            </button>
            <button className="ghost-button" style={{ marginLeft: 0, textAlign: 'left', fontSize: '10px' }} onClick={() => handleSelectDemo('USR-001')}>
              Ada Nwosu<br /><small style={{ color: '#617879' }}>Records Clerk</small>
            </button>
            <button className="ghost-button" style={{ marginLeft: 0, textAlign: 'left', fontSize: '10px' }} onClick={() => handleSelectDemo('USR-024')}>
              Kemi Yusuf<br /><small style={{ color: '#617879' }}>System Admin</small>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
