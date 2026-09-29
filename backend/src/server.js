// 反转求职平台后端 MVP —— 服务入口
// 启动：npm start（默认 http://localhost:3000）
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import workRoutes from './routes/works.js';
import invitationRoutes from './routes/invitations.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'reverse-job-backend', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/works', workRoutes);
app.use('/api/invitations', invitationRoutes);

// 统一 404 与错误处理
app.use((req, res) => res.status(404).json({ error: `接口不存在：${req.method} ${req.path}` }));
app.use((err, req, res, next) => {
  console.error('[server error]', err);
  res.status(500).json({ error: '服务器内部错误' });
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`✅ 反转求职平台后端已启动：http://localhost:${PORT}`);
  console.log('   健康检查：GET /api/health');
});
