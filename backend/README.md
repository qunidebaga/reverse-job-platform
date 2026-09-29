# 反转求职平台・后端 MVP

求职者在平台上发布作品 / 项目卡片，企业主动浏览、筛选并发起约谈（与传统 "企业发职位、求职者海投" 相反）。

## 技术栈

* Node.js ≥ 22.5（使用内置 `node:sqlite`，**零编译依赖**）
* Express 4
* JWT（jsonwebtoken）+ bcrypt 密码加密

## 快速开始

```
npm install          # 安装依赖
npm run seed         # 生成演示数据（可选）
npm start            # 启动，默认 http://localhost:3000
```

生产环境务必设置环境变量 `JWT_SECRET`（强随机密钥）；数据库默认在 `data/reverse-job.db`，可用 `DB_PATH` 覆盖。

## 接口一览

| 方法     | 路径                    | 说明                                      | 权限   |
| ------ | --------------------- | --------------------------------------- | ---- |
| POST   | /api/auth/register    | 注册（role: jobseeker /company）            | 公开   |
| POST   | /api/auth/login       | 登录，返回 token                             | 公开   |
| GET    | /api/auth/me          | 当前用户                                    | 登录   |
| GET    | /api/users/:id        | 公开主页（含作品列表）                             | 公开   |
| PUT    | /api/users/me         | 更新资料（昵称 / 头像 / 简介 / 地区 / 标签 / 教育 / 期望）  | 登录   |
| POST   | /api/works            | 发布作品卡片                                  | 求职者  |
| GET    | /api/works            | 浏览列表，支持 category/tag/location/q/page 过滤 | 公开   |
| GET    | /api/works/:id        | 作品详情（含作者）                               | 公开   |
| PUT    | /api/works/:id        | 编辑作品                                    | 作者本人 |
| DELETE | /api/works/:id        | 删除作品（软删）                                | 作者本人 |
| POST   | /api/invitations      | 企业发起约谈（work_id + 留言）                   | 企业   |
| GET    | /api/invitations/mine | 我的约谈（企业 = 我发起的；求职者 = 我收到的）              | 登录   |
| PATCH  | /api/invitations/:id  | 状态流转：求职者 accept/reject；企业 cancel        | 相关方  |

鉴权方式：请求头 `Authorization: Bearer <token>`。

## 数据模型

* **users**：role（jobseeker/company）、username、password_hash、nickname、bio、location、tags(JSON)、education、expectation
* **works**：user_id、title、description、category (3d/ui/miniapp/video/other)、tags (JSON)、cover、media (JSON)、process (JSON 过程图，防盗图)、status (published/hidden/deleted)
* **invitations**：work_id、company_id、jobseeker_id、message、status(pending/accepted/rejected/cancelled)

约谈状态机：`pending` →（求职者）`accepted` / `rejected`；（企业）`cancelled`。

## 迁移到微信云开发（后续步骤）

业务逻辑不变，只需把路由改写为云函数（Node.js 运行时）：

1. users → `users` 集合，username 换为 openid 作为登录键；
2. works → `works` 集合，存储用云存储 fileID 替换 URL；
3. invitations → `invitations` 集合，约谈状态变化时用订阅消息模板通知对方；
4. JWT 换成云函数自带的 `cloud.getWXContext()` 身份，鉴权更简单。

## 演示账号（npm run seed 后）

| 账号            | 密码     | 角色             |
| ------------- | ------ | -------------- |
| demo_company | 123456 | 企业             |
| demo_3d      | 123456 | 求职者（3D 方向，带作品） |
| demo_miniapp | 123456 | 求职者（小程序方向，带作品） |
