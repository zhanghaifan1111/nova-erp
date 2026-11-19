# 部署到 Render（免费、真实后端）

本项目是 Express 后端 + React 前端的全栈应用，Render 免费 Web Service 可以完整运行它。
项目已经改造为**部署就绪**：`render.yaml` 已配好，代码已初始化 Git 并提交一个版本。

你只需要三步：建 GitHub 仓库 → 推送代码 → 在 Render 导入。

---

## 准备工作

- 一个 GitHub 账号（没有就去 github.com 免费注册）
- 一个 Render 账号（render.com，用 GitHub 一键登录，免信用卡）

---

## 第 1 步：在 GitHub 建一个空仓库

1. 打开 https://github.com/new
2. Repository name 填：`nova-erp`（名字随意，记住即可）
3. 选择 **Private**（私有，推荐）或 Public 都行
4. **不要**勾选 "Add a README"、".gitignore"、"license"——保持完全空仓库
5. 点 **Create repository**

创建后会看到一段带地址的命令，形如：
```
https://github.com/你的用户名/nova-erp.git
```
复制这个地址。

---

## 第 2 步：把代码推送上去

在本机打开终端（PowerShell 或 Git Bash），执行下面三行。把第二行里的地址换成你刚复制的：

```bash
cd "C:\Users\75871\WorkBuddy\2026-11-19-15-50-29\erp-system"
git remote add origin https://github.com/你的用户名/nova-erp.git
git branch -M main
git push -u origin main
```

> 如果 push 时弹出 GitHub 登录：现在 GitHub 用 Personal Access Token 代替密码。
> 去 https://github.com/settings/tokens → Generate new token (classic) → 勾选 `repo` → 生成后把 token 当密码粘贴。
> 提示：本机 Git 用户已配置为 `zhang <3038045604@qq.com>`，GitHub 按邮箱识别提交者，不影响推送。

---

## 第 3 步：在 Render 部署

1. 打开 https://dashboard.render.com → 用 GitHub 登录
2. 点右上角 **New** → **Blueprint**
3. 授权 Render 访问你的 GitHub，选中刚才的 `nova-erp` 仓库
4. Render 会自动识别到 `render.yaml`，点 **Apply**
5. 它会自动执行 `npm install && npm run build && npm start`（约 2-5 分钟）
6. 部署完成后得到一个网址：`https://nova-erp-xxxx.onrender.com`

打开这个网址，就是完整的 ERP 系统了。

---

## 免费版的已知限制（务必看）

| 限制 | 说明 | 应对 |
|---|---|---|
| **自动休眠** | 15 分钟无人访问会休眠，下次打开要等 30-60 秒冷启动 | 已内置自动保活：Render 提供服务期间会每 10 分钟自我 ping，只要服务在线就不会休眠 |
| **数据非永久** | 免费版文件系统是临时的，Render 每次重新部署会重置数据 | 日常使用不受影响；重新部署后数据回到初始演示状态。要永久保存数据需接外部数据库（见下） |
| **单次额度** | 750 小时/月（足够一个服务全天候运行） | 单个服务够用 |

**关于数据持久化**：当前数据存在项目内 `data/db.json`。免费版重启/重部署会重置。
如果你后面要真正长期保存数据（比如真拿去卖），我可以帮你改接 **MongoDB Atlas 免费层**（永久 512MB 免费）或 **Supabase 免费 Postgres**，改造量不大，跟我说一声即可。

---

## 更新代码后如何重新部署

以后改了代码，在本机执行：
```bash
cd "C:\Users\75871\WorkBuddy\2026-11-19-15-50-29\erp-system"
git add .
git commit -m "更新说明"
git push
```
Render 检测到 push 会自动重新构建部署（注意：重部署会重置数据）。

---

## 当前本机状态

- 服务已在 http://localhost:3001 运行（前端+后端一体）
- Git 仓库已初始化，首个提交 `4869f92` 就绪
- 接下来只差你建 GitHub 仓库并推送
