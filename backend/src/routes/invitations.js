// 约谈路由：企业主动邀约求职者，求职者接受/拒绝 —— 平台核心动作
import { Router } from 'express';
import { db, parseJson, now } from '../db.js';
import { requireAuth, requireRole } from '../middleware.js';

const router = Router();

function serializeInv(row) {
  if (!row) return null;
  return {
    id: row.id,
    work_id: row.work_id,
    work_title: row.work_title,
    company_id: row.company_id,
    company_name: row.company_name,
    jobseeker_id: row.jobseeker_id,
    jobseeker_name: row.jobseeker_name,
    message: row.message,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// POST /api/invitations —— 企业发起约谈
router.post('/', requireAuth, requireRole('company'), (req, res) => {
  const workId = Number(req.body?.work_id);
  if (!Number.isInteger(workId)) {
    return res.status(400).json({ error: 'work_id 必填' });
  }
  const work = db.prepare('SELECT * FROM works WHERE id = ?').get(workId);
  if (!work || work.status !== 'published') {
    return res.status(404).json({ error: '作品不存在或已下架' });
  }
  if (work.user_id === req.userId) {
    return res.status(400).json({ error: '不能约谈自己的作品' });
  }

  // 同一企业不可对同一作品重复发起有效约谈
  const dup = db
    .prepare(`SELECT id FROM invitations WHERE company_id = ? AND work_id = ? AND status IN ('pending', 'accepted')`)
    .get(req.userId, workId);
  if (dup) {
    return res.status(409).json({ error: '你已对该作品发起过约谈，等待对方回应即可' });
  }

  const info = db
    .prepare('INSERT INTO invitations (work_id, company_id, jobseeker_id, message) VALUES (?, ?, ?, ?)')
    .run(workId, req.userId, work.user_id, (req.body?.message || '').trim().slice(0, 500));

  const row = db
    .prepare(
      `SELECT i.*, w.title AS work_title,
              c.nickname AS company_name, j.nickname AS jobseeker_name
       FROM invitations i
       JOIN works w ON w.id = i.work_id
       JOIN users c ON c.id = i.company_id
       JOIN users j ON j.id = i.jobseeker_id
       WHERE i.id = ?`
    )
    .get(info.lastInsertRowid);
  res.status(201).json({ invitation: serializeInv(row) });
});

// GET /api/invitations/mine —— 我的约谈列表（企业=我发起的；求职者=我收到的）
router.get('/mine', requireAuth, (req, res) => {
  const { status } = req.query;
  const isCompany = req.user.role === 'company';

  const where = [];
  const params = [];
  if (isCompany) {
    where.push('i.company_id = ?');
    params.push(req.userId);
  } else {
    where.push('i.jobseeker_id = ?');
    params.push(req.userId);
  }
  if (status && ['pending', 'accepted', 'rejected', 'cancelled'].includes(status)) {
    where.push('i.status = ?');
    params.push(status);
  }

  const rows = db
    .prepare(
      `SELECT i.*, w.title AS work_title, w.category AS work_category, w.cover AS work_cover,
              c.nickname AS company_name, j.nickname AS jobseeker_name
       FROM invitations i
       JOIN works w ON w.id = i.work_id
       JOIN users c ON c.id = i.company_id
       JOIN users j ON j.id = i.jobseeker_id
       WHERE ${where.join(' AND ')}
       ORDER BY i.created_at DESC`
    )
    .all(...params);

  res.json({
    invitations: rows.map((r) => ({
      ...serializeInv(r),
      work_category: r.work_category,
      work_cover: r.work_cover,
    })),
  });
});

// PATCH /api/invitations/:id —— 状态流转：求职者 accept/reject；企业 cancel
router.patch('/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const action = req.body?.action;
  const row = db.prepare('SELECT * FROM invitations WHERE id = ?').get(id);
  if (!row) {
    return res.status(404).json({ error: '约谈不存在' });
  }

  const isJobseeker = req.user.role === 'jobseeker' && row.jobseeker_id === req.userId;
  const isCompany = req.user.role === 'company' && row.company_id === req.userId;
  if (!isJobseeker && !isCompany) {
    return res.status(403).json({ error: '无权操作该约谈' });
  }
  if (row.status !== 'pending') {
    return res.status(409).json({ error: `该约谈已处于 ${row.status} 状态，不能重复操作` });
  }

  let next = null;
  if (isJobseeker && action === 'accept') next = 'accepted';
  else if (isJobseeker && action === 'reject') next = 'rejected';
  else if (isCompany && action === 'cancel') next = 'cancelled';
  else {
    return res.status(400).json({ error: '无效操作：求职者可 accept/reject，企业可 cancel' });
  }

  db.prepare(`UPDATE invitations SET status = ?, updated_at = ? WHERE id = ?`).run(next, now(), id);

  const updated = db
    .prepare(
      `SELECT i.*, w.title AS work_title,
              c.nickname AS company_name, j.nickname AS jobseeker_name
       FROM invitations i
       JOIN works w ON w.id = i.work_id
       JOIN users c ON c.id = i.company_id
       JOIN users j ON j.id = i.jobseeker_id
       WHERE i.id = ?`
    )
    .get(id);
  res.json({ invitation: serializeInv(updated) });
});

export default router;
