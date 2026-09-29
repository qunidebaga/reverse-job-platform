// 认证路由：注册（求职者/企业）、登录、当前用户
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, parseJson } from '../db.js';
import { signToken, publicUser, requireAuth } from '../middleware.js';

const router = Router();

function validateRegister(body) {
  const errors = [];
  if (!['jobseeker', 'company'].includes(body.role)) {
    errors.push('role 必须是 jobseeker 或 company');
  }
  if (typeof body.username !== 'string' || body.username.trim().length < 2) {
    errors.push('username 至少 2 个字符');
  }
  if (typeof body.password !== 'string' || body.password.length < 6) {
    errors.push('password 至少 6 位');
  }
  return errors;
}

// POST /api/auth/register
router.post('/register', (req, res) => {
  const body = req.body || {};
  const errors = validateRegister(body);
  if (errors.length) {
    return res.status(400).json({ error: errors.join('；') });
  }

  const username = body.username.trim();
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) {
    return res.status(409).json({ error: '该用户名已被注册' });
  }

  const hash = bcrypt.hashSync(body.password, 10);
  const info = db
    .prepare('INSERT INTO users (role, username, password_hash, nickname) VALUES (?, ?, ?, ?)')
    .run(body.role, username, hash, body.nickname?.trim() || username);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  return res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: '请输入用户名和密码' });
  }
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username).trim());
  if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  return res.json({ token: signToken(user.id), user: publicUser(user) });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export default router;
