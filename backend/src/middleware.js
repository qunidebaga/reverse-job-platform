// 鉴权中间件：JWT（Bearer token）
// 生产环境务必通过环境变量 JWT_SECRET 设置强密钥
import jwt from 'jsonwebtoken';
import { db, parseJson } from './db.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';
const TOKEN_TTL = process.env.JWT_TTL || '30d';

export function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

// 公开用户信息（绝不含 password_hash）
export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    role: row.role,
    username: row.username,
    nickname: row.nickname,
    avatar: row.avatar,
    bio: row.bio,
    location: row.location,
    tags: parseJson(row.tags),
    education: row.education,
    expectation: row.expectation,
    created_at: row.created_at,
  };
}

// 需要登录的接口
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    return res.status(401).json({ error: '未登录' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
    if (!user) {
      return res.status(401).json({ error: '用户不存在' });
    }
    req.user = user;
    req.userId = user.id;
    next();
  } catch {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

// 仅允许指定角色
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: `仅限 ${roles.join('/')} 操作` });
    }
    next();
  };
}
