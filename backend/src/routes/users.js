// 用户路由：公开主页（含作品列表）、个人资料更新
import { Router } from 'express';
import { db, parseJson } from '../db.js';
import { publicUser, requireAuth } from '../middleware.js';

const router = Router();

// GET /api/users/:id —— 公开主页（含该用户已发布的作品）
router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: '无效的用户 id' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  const works = db
    .prepare(
      `SELECT id, title, description, category, tags, cover, media, created_at
       FROM works WHERE user_id = ? AND status = 'published'
       ORDER BY created_at DESC`
    )
    .all(id)
    .map((w) => ({
      ...w,
      tags: parseJson(w.tags),
      media: parseJson(w.media),
    }));

  res.json({ user: publicUser(user), works });
});

// PUT /api/users/me —— 更新个人资料（仅登录用户本人）
router.put('/me', requireAuth, (req, res) => {
  const b = req.body || {};
  const allowed = ['nickname', 'avatar', 'bio', 'location', 'education', 'expectation'];
  const sets = [];
  const values = [];
  for (const key of allowed) {
    if (typeof b[key] === 'string') {
      sets.push(`${key} = ?`);
      values.push(b[key].trim());
    }
  }
  if (Array.isArray(b.tags)) {
    const cleaned = b.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 30);
    sets.push('tags = ?');
    values.push(JSON.stringify(cleaned));
  }
  if (!sets.length) {
    return res.status(400).json({ error: '没有可更新的字段' });
  }
  values.push(req.userId);
  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...values);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  res.json({ user: publicUser(user) });
});

export default router;
