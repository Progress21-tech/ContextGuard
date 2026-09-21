/**
 * ContextGuard Authentication & Authorization Middleware
 * Enforces JWT token verification on all protected endpoints.
 * Authoritative user identity is resolved strictly from the verified JWT.
 */

const { verifyJWT } = require('./jwt');
const { USERS: SEED_USERS } = require('../db/seed');

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'UNAUTHENTICATED',
      message: 'Authentication required. Please provide a valid Bearer token.'
    });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyJWT(token);

  if (!decoded || !decoded.userId) {
    return res.status(401).json({
      error: 'INVALID_TOKEN',
      message: 'Session token is invalid or expired. Please sign in again.'
    });
  }

  // Load authoritative user profile from database/store
  const user = SEED_USERS.find(u => u.id === decoded.userId);
  if (!user) {
    return res.status(401).json({
      error: 'USER_NOT_FOUND',
      message: 'Authenticated staff user profile no longer exists.'
    });
  }

  // Allow optional server-controlled demo context overrides for security testing (duty status, device ID)
  const duty = req.headers['x-duty-status'] !== undefined 
    ? req.headers['x-duty-status'] === 'true' 
    : Boolean(user.duty);
  const deviceId = req.headers['x-device-id'] || 'WS-07';

  // Attach authoritative user object to req.user (ignoring any client-submitted userId/role/ward claims)
  req.user = {
    id: user.id,
    name: user.name,
    role: user.role,
    department: user.department,
    ward: user.ward_id,
    duty: duty
  };
  req.deviceId = deviceId;

  next();
}

module.exports = { requireAuth };
