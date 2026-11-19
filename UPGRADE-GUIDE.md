# 升级说明：登录系统 + 账号管理 + 数据持久化

v2.0 新增了完整的用户体系，并把数据从本地文件升级为支持 MongoDB 持久化。

## 新增功能

- **登录系统**：JWT 令牌认证，密码 bcrypt 加密，7 天免登录
- **默认管理员**：账号 `admin` / 密码 `admin123`（登录后请在「账号设置」修改密码）
- **账号管理**（管理员）：新增/编辑/删除账号、重置密码、启用停用
- **客户账号管理**（管理员）：为客户创建登录账号并绑定客户档案，客户登录后只能看自己的订单和资料
- **权限隔离**：客户账号只读，无法访问商品成本、采购、财务、账号管理等敏感模块
- **MongoDB 持久化**：配置 `MONGODB_URI` 后数据永久保存，未配置时自动用本地文件（保证任何环境都能跑）

## 第一部分：申请 MongoDB Atlas 免费数据库（永久免费，无需信用卡）

1. 打开 https://www.mongodb.com/atlas/database → 点 **Try Free** 注册（可用 Google 账号）
2. 注册后创建集群：
   - 选择 **M0 Free**（免费，永久）
   - Cloud Provider 选 **AWS**（或默认）
   - Region 选 **Singapore**（离你近）
   - Cluster Name 随意，如 `nova-erp`
   - 点 **Create Cluster**，等 1-3 分钟
3. 设置数据库用户（Database Access）：
   - 左侧 **Database Access** → **Add New Database User**
   - Authentication 选 **Password**，填用户名（如 `novaadmin`）和密码（自己设，记牢）
   - Database User Privileges 选 **Read and write to any database**
   - 点 **Add User**
4. 设置 IP 白名单（Network Access）：
   - 左侧 **Network Access** → **Add IP Address**
   - 选 **Allow Access from Anywhere**（填 `0.0.0.0/0`），确认（Render 需要这个）
5. 获取连接串：
   - 左侧 **Database** → 点集群的 **Connect** → **Connect your application**
   - Driver 选 **Node.js**，Version 选默认
   - 复制连接串，形如：`mongodb+srv://novaadmin:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
   - 把 `<password>` 换成你第 3 步设的实际密码

## 第二部分：在 Render 配置环境变量

1. 打开你的 Render 服务：https://dashboard.render.com → 进 `nova-erp`
2. 左侧点 **Environment**
3. 点 **Add Environment Variable**，加两个变量：

| Key | Value |
|---|---|
| `MONGODB_URI` | 上面复制的完整连接串（已替换密码） |
| `JWT_SECRET` | 随便写一段长随机字符串，如 `nova-erp-9f3a7c2e8b1d6f4a`（用于加密登录令牌，别泄露） |

4. 点 **Save Changes**，Render 会自动重新部署（约 2-5 分钟）

部署完成后，数据就永久保存在 MongoDB 了，重新部署也不会丢。

## 第三部分：验证

1. 打开 https://nova-erp-6mdl.onrender.com
2. 应该看到登录页，用 `admin` / `admin123` 登录
3. 进「账号设置」修改默认密码
4. 进「客户账号管理」，为客户创建登录账号
5. 用客户账号登录，验证只能看到该客户的订单

## 本地开发

```bash
cd erp-system
npm run dev        # 前端 5173，后端 3001
```
本地不配 MONGODB_URI 时数据存 `data/db.json`，重启不丢（除非手动删文件）。

## 安全提示

- 上线后第一件事：修改 admin 默认密码
- `JWT_SECRET` 要够随机、别用默认值
- 客户账号只给真正的客户用，不要共用
- MongoDB 连接串含密码，不要发给别人或提交到公开仓库（本项目 `.gitignore` 已排除 `.env`）
