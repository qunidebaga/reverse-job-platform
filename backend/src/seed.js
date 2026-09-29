// 演示数据：跑 npm run seed 生成 1 个企业 + 2 个求职者（含作品），方便前后端联调
import bcrypt from 'bcryptjs';
import { db, parseJson } from './db.js';

function upsertUser(role, username, password, nickname, extra = {}) {
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) {
    return exists.id;
  }
  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare(
      `INSERT INTO users (role, username, password_hash, nickname, bio, location, tags, education, expectation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(role, username, hash, nickname, extra.bio || '', extra.location || '', JSON.stringify(extra.tags || []), extra.education || '', extra.expectation || '');
  return info.lastInsertRowid;
}

function upsertWork(userId, title, category, tags, description, cover, media, process) {
  const info = db
    .prepare(
      `INSERT INTO works (user_id, title, description, category, tags, cover, media, process)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(userId, title, description, category, JSON.stringify(tags), cover, JSON.stringify(media), JSON.stringify(process));
  return info.lastInsertRowid;
}

// 企业
const companyId = upsertUser('company', 'demo_company', '123456', '石家庄某某文化传媒有限公司', {
  bio: '专注品牌视觉与数字内容制作，长期招募 3D 设计师与小程序开发。',
  location: '石家庄',
  tags: ['品牌设计', '数字内容'],
});

// 求职者 A：3D 方向
const jobseeker3d = upsertUser('jobseeker', 'demo_3d', '123456', '小美（3D 设计师）', {
  bio: '美术科班出身，熟练 Blender 建模/材质/渲染，探索过 UE4 与全息投影方案。',
  location: '石家庄',
  tags: ['Blender', '3D建模', 'AR', '全息投影'],
  education: '河北东方学院 · 艺术设计相关专业',
  expectation: '3D 设计师 / AR 方向，接受实习与初级岗',
});

// 求职者 B：小程序方向
const jobseekerMini = upsertUser('jobseeker', 'demo_miniapp', '123456', '小刚（小程序开发）', {
  bio: '会微信小程序开发与 UI/UX 设计，擅长"设计稿转代码"一体化落地。',
  location: '石家庄',
  tags: ['微信小程序', 'UI/UX', 'HTML', 'AI工具'],
  education: '河北东方学院 · 艺术设计相关专业',
  expectation: '小程序开发 / 前端，接受调剂',
});

const work1 = upsertWork(
  jobseeker3d,
  '机械手表 3D 建模与渲染作品集',
  '3d',
  ['Blender', '硬表面建模', '渲染'],
  '围绕一只复古机械手表完成从建模、材质到布光渲染的全流程，含白模与最终渲染对比，可提供源文件截图。',
  '',
  ['https://example.com/work3d-cover.png'],
  ['https://example.com/work3d-process.png']
);

const work2 = upsertWork(
  jobseekerMini,
  '校园二手集市小程序（可扫码体验 Demo）',
  'miniapp',
  ['微信小程序', '云开发', 'UI设计'],
  '独立完成的小程序 Demo：商品发布、分类浏览、私信联系，界面由我亲自设计并转码实现。',
  '',
  ['https://example.com/workminiapp-cover.png'],
  ['https://example.com/workminiapp-process.png']
);

console.log('✅ 演示数据已生成：');
console.log(`   企业：demo_company / 123456`);
console.log(`   求职者A：demo_3d / 123456（作品 #${work1}）`);
console.log(`   求职者B：demo_miniapp / 123456（作品 #${work2}）`);
