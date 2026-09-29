// 数据库层：使用 Node 22 内置 node:sqlite（零编译依赖）
// 表结构：users（求职者/企业双身份）、works（作品卡片）、invitations（约谈）
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.DB_PATH || join(dataDir, 'reverse-job.db');
export const db = new DatabaseSync(dbPath);

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  role          TEXT    NOT NULL CHECK (role IN ('jobseeker', 'company')),
  username      TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  nickname      TEXT    NOT NULL DEFAULT '',
  avatar        TEXT    NOT NULL DEFAULT '',
  bio           TEXT    NOT NULL DEFAULT '',
  location      TEXT    NOT NULL DEFAULT '',
  tags          TEXT    NOT NULL DEFAULT '[]',      -- JSON 数组：技能标签
  education     TEXT    NOT NULL DEFAULT '',
  expectation   TEXT    NOT NULL DEFAULT '',        -- 期望方向 / 薪资
  created_at    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS works (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  category    TEXT    NOT NULL DEFAULT 'other',     -- 3d / ui / miniapp / video / other
  tags        TEXT    NOT NULL DEFAULT '[]',        -- JSON 数组
  cover       TEXT    NOT NULL DEFAULT '',
  media       TEXT    NOT NULL DEFAULT '[]',        -- JSON 数组：作品图/视频 URL
  process     TEXT    NOT NULL DEFAULT '[]',        -- JSON 数组：过程图/源文件截图（防盗图）
  status      TEXT    NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden', 'deleted')),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS invitations (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id      INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  company_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jobseeker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message      TEXT    NOT NULL DEFAULT '',
  status       TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_works_user   ON works(user_id);
CREATE INDEX IF NOT EXISTS idx_works_status ON works(status);
CREATE INDEX IF NOT EXISTS idx_inv_company  ON invitations(company_id);
CREATE INDEX IF NOT EXISTS idx_inv_jobseeker ON invitations(jobseeker_id);
CREATE INDEX IF NOT EXISTS idx_inv_status   ON invitations(status);
`);

// ---- 小工具：JSON 字段读写 ----
export function parseJson(text, fallback = []) {
  try {
    const v = JSON.parse(text);
    return Array.isArray(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

export function now() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}
