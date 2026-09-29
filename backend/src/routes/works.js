// 作品卡片路由：求职者发布作品，企业按标签/地区/类型筛选浏览
import { Router } from 'express';
import { db, parseJson, now } from '../db.js';
import { requireAuth, requireRole, publicUser } from '../middleware.js';

const router = Router();

const VALID_CATEGORIES = ['3d', 'ui', 'miniapp', 'video', 'other'];

function serializeWork(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    description: row.description,
    category: row.category,
    tags: parseJson(row.tags),
    cover: row.cover,
    media: parseJson(row.media),
    process: parseJson(row.process),
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// POST /api/works —— 求职者发布作品卡片
router.post('/', requireAuth, requireRole('jobseeker'), (req, res) => {
  const b = req.body || {};
  if (!b.title || typeof b.title !== 'string' || !b.title.trim()) {
    return res.status(400).json({ error: '作品标题必填' });
  }
  if (b.category && !VALID_CATEGORIES.includes(b.category)) {
    return res.status(400).json({ error: `category 必须是 ${VALID_CATEGORIES.join('/')}` });
  }
  const toArray = (v) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : []);
  const info = db
    .prepare(
      `INSERT INTO works (user_id, title, description, category, tags, cover, media, process)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.userId,
      b.title.trim(),
      (b.description || '').trim(),
      b.category || 'other',
      JSON.stringify(toArray(b.tags).slice(0, 30)),
      (b.cover || '').trim(),
      JSON.stringify(toArray(b.media).slice(0, 9)),
      JSON.stringify(toArray(b.process).slice(0, 9))
    );

  const work = db.prepare('SELECT * FROM works WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ work: serializeWork(work) });
});

// GET /api/works —— 公开列表（企业浏览用）
// 支持过滤：category、tag、location、q（标题/描述关键词）、page、pageSize
router.get('/', (req, res) => {
  const { category, tag, location, q } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 12));

  const where = [`w.status = 'published'`];
  const params = [];
  if (category && VALID_CATEGORIES.includes(category)) {
    where.push('w.category = ?');
    params.push(category);
  }
  if (tag) {
    where.push("w.tags LIKE ?");
    params.push(`%"${String(tag).trim()}"%`);
  }
  if (location) {
    where.push('u.location LIKE ?');
    params.push(`%${String(location).trim()}%`);
  }
  if (q) {
    where.push('(w.title LIKE ? OR w.description LIKE ?)');
    const kw = `%${String(q).trim()}%`;
    params.push(kw, kw);
  }
  const whereSql = where.join(' AND ');

  const total = db.prepare(`SELECT COUNT(*) AS c FROM works w JOIN users u ON u.id = w.user_id WHERE ${whereSql}`).get(...params).c;
  const rows = db
    .prepare(
      `SELECT w.*, u.nickname AS author_name, u.location AS author_location, u.avatar AS author_avatar
       FROM works w JOIN users u ON u.id = w.user_id
       WHERE ${whereSql}
       ORDER BY w.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, (page - 1) * pageSize);

  res.json({
    total,
    page,
    pageSize,
    works: rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      category: r.category,
      tags: parseJson(r.tags),
      cover: r.cover,
      media: parseJson(r.media),
      created_at: r.created_at,
      author: {
        id: r.user_id,
        nickname: r.author_name,
        location: r.author_location,
        avatar: r.author_avatar,
      },
    })),
  });
});

// GET /api/works/:id —— 详情（含作者与过程图）
router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: '无效的作品 id' });
  }
  const row = db
    .prepare(
      `SELECT w.*, u.nickname AS author_name, u.location AS author_location, u.avatar AS author_avatar,
              u.bio AS author_bio, u.tags AS author_tags, u.education AS author_education
       FROM works w JOIN users u ON u.id = w.user_id
       WHERE w.id = ?`
    )
    .get(id);
  if (!row) {
    return res.status(404).json({ error: '作品不存在' });
  }
  res.json({
    work: {
      ...serializeWork(row),
      author: {
        id: row.user_id,
        nickname: row.author_name,
        location: row.author_location,
        avatar: row.author_avatar,
        bio: row.author_bio,
        tags: parseJson(row.author_tags),
        education: row.author_education,
      },
    },
  });
});

// PUT /api/works/:id —— 作者本人编辑
router.put('/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const work = db.prepare('SELECT * FROM works WHERE id = ?').get(id);
  if (!work) {
    return res.status(404).json({ error: '作品不存在' });
  }
  if (work.user_id !== req.userId) {
    return res.status(403).json({ error: '只能编辑自己的作品' });
  }

  const b = req.body || {};
  const sets = [];
  const values = [];
  const str = (v, d) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : d);
  const arr = (v, d) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : d);

  sets.push('title = ?'); values.push(str(b.title, work.title));
  sets.push('description = ?'); values.push(typeof b.description === 'string' ? b.description.trim() : work.description);
  if (b.category && VALID_CATEGORIES.includes(b.category)) {
    sets.push('category = ?'); values.push(b.category);
  }
  if (Array.isArray(b.tags)) { sets.push('tags = ?'); values.push(JSON.stringify(arr(b.tags, []).slice(0, 30))); }
  if (typeof b.cover === 'string') { sets.push('cover = ?'); values.push(b.cover.trim()); }
  if (Array.isArray(b.media)) { sets.push('media = ?'); values.push(JSON.stringify(arr(b.media, []).slice(0, 9))); }
  if (Array.isArray(b.process)) { sets.push('process = ?'); values.push(JSON.stringify(arr(b.process, []).slice(0, 9))); }
  sets.push('updated_at = ?'); values.push(now());
  values.push(id);

  db.prepare(`UPDATE works SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM works WHERE id = ?').get(id);
  res.json({ work: serializeWork(updated) });
});

// DELETE /api/works/:id —— 作者本人软删除
router.delete('/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const work = db.prepare('SELECT * FROM works WHERE id = ?').get(id);
  if (!work) {
    return res.status(404).json({ error: '作品不存在' });
  }
  if (work.user_id !== req.userId) {
    return res.status(403).json({ error: '只能删除自己的作品' });
  }
  db.prepare(`UPDATE works SET status = 'deleted', updated_at = ? WHERE id = ?`).run(now(), id);
  res.json({ ok: true });
});

export default router;
