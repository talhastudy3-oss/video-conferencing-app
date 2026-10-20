const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Verifies the JWT in the Authorization header ("Bearer <token>").
 * Attaches req.user (decoded payload) and, for real accounts,
 * req.userDoc (the full Mongo document). Guest tokens skip the DB lookup.
 */
const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    if (!decoded.isGuest) {
      const userDoc = await User.findById(decoded.id);
      if (!userDoc) {
        return res.status(401).json({ message: 'Not authorized, user no longer exists' });
      }
      req.userDoc = userDoc;
    }

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized, token invalid or expired' });
  }
};

module.exports = { protect };
