const jwt = require('jsonwebtoken');
const { JWT_SECRET, ADMIN_PASSWORD } = require('./config');

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'token requerido' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'token inválido' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: `requiere rol ${role}` });
    }
    next();
  };
}

function issueToken({ name, role }) {
  return jwt.sign({ name, role }, JWT_SECRET, { expiresIn: '12h' });
}

function checkPassword(password) {
  return password === ADMIN_PASSWORD;
}

module.exports = { auth, requireRole, issueToken, checkPassword };
