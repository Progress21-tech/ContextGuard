/**
 * ContextGuard Real Authentication Module
 * Implements JWT token signing, verification, and bcrypt/crypto password hashing.
 * Server-side identity verification eliminates client-side identity spoofing.
 */

const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'CONTEXTGUARD_SECRET_SIGNING_KEY_2026_PRD';

let bcrypt;
try {
  bcrypt = require('bcryptjs');
} catch (e) {
  bcrypt = null;
}

// Password hashing function
function hashPassword(password) {
  if (bcrypt) {
    return bcrypt.hashSync(password, 10);
  }
  // Fallback SHA-256 HMAC hash
  return crypto.createHmac('sha256', JWT_SECRET).update(password).digest('hex');
}

function comparePassword(password, storedHash) {
  if (bcrypt && storedHash.startsWith('$2')) {
    return bcrypt.compareSync(password, storedHash);
  }
  const computed = hashPassword(password);
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(storedHash));
}

// JWT Helper Functions
function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return Buffer.from(str, 'base64').toString('utf8');
}

function signJWT(payload, expiresInSeconds = 86400) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyJWT(token) {
  if (!token) return null;
  const parts = token.replace('Bearer ', '').split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;

  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  if (signature !== expectedSignature) {
    return null; // Signature mismatch
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }
    return payload;
  } catch (e) {
    return null;
  }
}

module.exports = {
  hashPassword,
  comparePassword,
  signJWT,
  verifyJWT
};
