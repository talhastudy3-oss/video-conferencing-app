const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const JWT_EXPIRES_IN = '7d';

const signUserToken = (user) =>
  jwt.sign(
    { id: user._id, name: user.name, email: user.email, isGuest: false },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

const toSafeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  isGuest: false,
});

const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are all required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: 'An account with that email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const user = await User.create({ name, email: email.toLowerCase(), password: hashedPassword });

    const token = signUserToken(user);
    return res.status(201).json({ token, user: toSafeUser(user) });
  } catch (error) {
    console.error('Signup error:', error.message);
    return res.status(500).json({ message: 'Server error during signup' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !user.password) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = signUserToken(user);
    return res.status(200).json({ token, user: toSafeUser(user) });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({ message: 'Server error during login' });
  }
};

const guestLogin = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'A display name is required to join as a guest' });
    }

    const guestPayload = {
      id: `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      isGuest: true,
    };

    const token = jwt.sign(guestPayload, process.env.JWT_SECRET, { expiresIn: '12h' });
    return res.status(200).json({ token, user: { ...guestPayload, avatar: '' } });
  } catch (error) {
    console.error('Guest login error:', error.message);
    return res.status(500).json({ message: 'Server error during guest login' });
  }
};

const googleCallback = (req, res) => {
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim();
  try {
    const token = signUserToken(req.user);
    return res.redirect(`${frontendUrl}/oauth/callback?token=${token}`);
  } catch (error) {
    console.error('Google callback error:', error.message);
    return res.redirect(`${frontendUrl}/login?error=oauth_failed`);
  }
};

const getMe = async (req, res) => {
  if (req.user.isGuest) return res.status(200).json({ user: req.user });
  return res.status(200).json({ user: toSafeUser(req.userDoc) });
};

module.exports = { signup, login, guestLogin, googleCallback, getMe };
