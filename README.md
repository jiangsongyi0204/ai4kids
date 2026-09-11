# ai4kids · AI+教育的落地实践

> K12 AI 教育游戏平台 — 用一场「16 站时间旅行」读完人工智能简史

基于《AI时代教育全景导航》(guide.html) 的教育游戏系列。后端 **Node.js + Express + TypeScript**，前端纯 HTML/CSS/JS，零构建步骤，子应用自动扫描。

**当前线上内容**：首页《人工智能简史》16 站互动课程（第 1–6 站已上线）· 🏆 收获墙 · 《AI时代教育全景导航》。

---

## 快速开始

```bash
npm install        # 安装依赖
npm run dev        # 启动服务（监听模式：改 server 文件自动重启）
npm run dev:https  # 想用 HTTPS：自签证书，同时跑 80 + 443
```

服务运行在 `http://localhost:80`（Windows/Mac 权限受限时可 `PORT=8080 npm run dev`）。

| 命令 | 作用 |
|------|------|
| `npm run dev` | 开发（`node --watch`，改 `server/` 自动重启） |
| `npm run dev:https` | 本地 HTTPS（`scripts/dev-https.ps1`，自签证书，80 + 443 并存） |
| `npm start` | 生产启动（ts-node 直跑） |
| `npm run build` | TypeScript 编译（`tsc`，产物不参与运行） |
| `npm test` | 自动化测试（需服务已启动） |

> 💡 开发提示：改动 **前端** 文件（`public/` 下的 HTML/CSS/JS）**无需重启**，刷新浏览器即可；改动 **后端**（`server/`）文件，`npm run dev` 会自动重启。

### 本地 HTTPS（可选）

`npm run dev:https` 会用 Git 自带的 openssl 生成自签证书到 `.certs/`（已 gitignore，2 年有效，SAN = `localhost` + `127.0.0.1`），然后 **`https://localhost/` 与 `http://localhost/` 同时可用**（本地默认 `HTTP_REDIRECT=0`，不跳转，所以 `npm test` 照常能跑）。

浏览器会提示证书不受信任，点「高级 → 继续前往」即可；命令行用 `curl -k` 验证。想验证线上那种 80 → 443 的 301 跳转：`$env:HTTP_REDIRECT=1; npm run dev:https`。

---

## 访问地址

| 页面 | 本地 | 线上 |
|------|------|------|
| 首页（人工智能简史 · 课程目录） | `http://localhost/` | `https://ai4kids.online/` |
| 第 1–6 站课件 | `http://localhost/history/lesson1.html` … `lesson6.html` | `https://ai4kids.online/history/lesson1.html` … |
| 🏆 收获墙（学员收获卡片） | `http://localhost/harvest.html` | `https://ai4kids.online/harvest.html` |
| AI时代教育全景导航 | `http://localhost/guide.html` | `https://ai4kids.online/guide.html` |

> 端口默认 80，可用 `PORT=8080` 改；跑了 `npm run dev:https` 后把 `http://localhost/` 换成 `https://localhost/` 也能访问。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 运行时 | Node.js |
| 框架 | Express 4 |
| 后端语言 | TypeScript（ts-node 直跑） |
| 前端 | 原生 HTML/CSS/JS（无框架） |
| 数据存储 | Node 内置 `node:sqlite`（`database/ai4kids.db` · 收获墙）+ 浏览器 localStorage |

---

## 项目结构

```
ai4kids/
├── server/                        # 后端（TypeScript + Express）
│   ├── server.ts                  # Express 入口，静态服务，/api/apps 自动扫描，/api/harvest 收获墙
│   └── db.ts                      # SQLite 数据层（Node 内置 node:sqlite，无第三方依赖）
├── public/                        # 主站前端（静态服务根目录）
│   ├── index.html                 # 首页：「人工智能简史」课程目录（16 站时间轴）
│   ├── harvest.html               # 🏆 收获墙：所有学员的收获卡片
│   ├── guide.html                 # AI时代教育全景导航
│   ├── css/                       # common.css（主站公共样式）+ style.css（课件样式）
│   ├── js/                        # 公共脚本（tracker / classroom-float / cloud-records / lesson-recorder）
│   ├── fonts/                     # Orbitron 字体（课件用）
│   └── history/                   # 人工智能简史 · 课件（已上线第 1–6 站，URL = /history/lessonN.html）
│       ├── index.html             # 仅 meta 跳回 / 的兼容页
│       ├── lesson1.html … lesson6.html
│       ├── lesson.css / lesson.js # 各站共享样式与交互脚本
│       ├── *-lab.css / *-lab.js   # 各站互动实验室（图灵 / 谜题 / 感知机 / ELIZA / 专家系统 / 神经网络）
│       └── img/                   # 配图
├── app/                           # （当前不存在）子应用：建 app/<name>/index.html + config.json 即自动注册到 /<name>/，/api/apps 现返回空数组
├── database/                      # 运行时数据（AI 生成物 + SQLite）
│   ├── images/ text/ videos/ music/   # 大模型生成的图像 / 文字 / 视频 / 音乐（启动时自动创建）
│   └── ai4kids.db                 # SQLite 数据库（harvests 表 = 收获墙，首次启动自动建表）
├── tests/
│   └── check.js                   # 自动化测试：页面加载 + 关键元素 + 导航 + API（43 条断言）
├── scripts/dev-https.ps1          # 本地 HTTPS：自签证书 + 启动服务（Windows）
├── deploy/setup-https.sh          # 线上一次性配置：certbot 签证书 + 续期自动重启
├── ecosystem.config.js            # PM2 配置（PORT=80 / HTTPS_PORT=443 / TLS_DIR / ACME_WEBROOT）
├── .certs/                        # 本地自签证书（gitignore）
├── package.json
├── tsconfig.json
└── .github/workflows/deploy.yml   # 阿里云 ECS 自动部署
```

---

## 🔒 HTTPS 部署（ai4kids.online）

线上不装 Nginx，**Express 自己监听 80 与 443**：

```
浏览器 ── https:443 ──> Express（PM2: ai4kids）
        ── http:80  ──> Express：放行 /.well-known/acme-challenge，其余 301 跳 https
```

- 证书放在 `/etc/letsencrypt/live/ai4kids.online/`（`privkey.pem` + `fullchain.pem`）
- **检测到证书** → 443 自动启用 HTTPS，80 的请求全部 301 跳过去
- **没检测到证书** → 只跑 HTTP（本地开发、首次部署都是这种状态，不会启动失败）
- 绑定 80/443 需要 root，项目的 PM2 就是以 root 运行的

### 一次性配置（在 ECS 上，只需跑一次）

```bash
cd /root/projects/ai4kids
bash deploy/setup-https.sh 你的邮箱@example.com
```

脚本自动完成：装 certbot → 用 `ecosystem.config.js` 重启 Node（监听 80）→ 校验 `/.well-known/acme-challenge/` 是否通畅 → 用 webroot 方式申请 Let's Encrypt 证书（一张证书同时覆盖 `ai4kids.online` 与 `www.ai4kids.online`）→ 重启 Node 让 443 生效 → 配好续期后自动重启 Node。

> 全程 Node 都待在 80 端口上，不存在端口交接，**几乎没有中断**。

### 需要人工确认的 3 件事

| 项 | 说明 |
|---|---|
| DNS 解析 | `ai4kids.online` 和 `www.ai4kids.online` 的 A 记录都要指向 ECS 公网 IP |
| 阿里云安全组 | 入方向放行 **80** 与 **443** |
| ICP 备案 | 大陆节点绑域名必须备案，否则会被拦截（这是访问不通最常见的原因） |

### 之后的日常发布

push 到 `main` 会自动部署，`deploy.yml` 每次都执行：

```bash
pm2 startOrRestart ecosystem.config.js --update-env
```

Node 一直占着 80 端口，加证书不改变端口，所以**部署过程不会导致站点中断**。

### 相关文件

| 文件 | 用途 |
|---|---|
| `ecosystem.config.js` | PM2 配置：`PORT=80`、`HTTPS_PORT=443`、`TLS_DIR`、`ACME_WEBROOT`（certbot 的 webroot；验证文件实际落在 `<ACME_WEBROOT>/.well-known/acme-challenge/`） |
| `deploy/setup-https.sh` | 一次性脚本（装 certbot + 签证书 + 配续期重启） |
| `server/server.ts` | 启动时读证书：有则起 HTTPS + 80 跳转，无则只跑 HTTP |

### 常用排查

```bash
pm2 logs ai4kids                                        # Node 日志（看是否打印 🔒 HTTPS 已启动）
curl -I http://127.0.0.1/                               # 本机 80
curl -I --resolve ai4kids.online:443:127.0.0.1 https://ai4kids.online/   # 本机 443
ss -lntp | grep -E ':(80|443)\b'                        # 端口是否被 Node 监听
ls -l /etc/letsencrypt/live/ai4kids.online/             # 证书是否存在
certbot renew --dry-run                                 # 试跑一次续期
```

---

## 🧠 人工智能简史（当前首页）

首页（`public/index.html`）是 **16 站时间轴课程目录**，从 1950 年图灵测试一路走到今天。**第 1–6 站已上线**，第 7 站起在首页显示为「🚧 本站课件尚未上线」（置灰不可点）。

| 站 | 年份 | 主题 | 互动实验室 |
|---|---|---|---|
| 1 | 1950 | 图灵测试：机器会思考吗？ | 图灵机模拟（`turing-lab`）+ 谜题破译（`enigma-lab` / `enigma-break`） |
| 2 | 1956 | 人工智能诞生：一场改变世界的会议 | — |
| 3 | 1957 | 感知机：第一台会学习的机器 | 感知机训练器（`perceptron-trainer`） |
| 4 | 1966 | ELIZA：世界上第一个聊天机器人 | ELIZA 对话实验（`eliza-lab`） |
| 5 | 1980 | 专家系统：装进电脑的专家经验 | 专家系统推理（`expert-lab`） |
| 6 | 1986 | 反向传播：让神经网络学会纠错 | 神经网络实验室（`neural-net-lab`） |

每站课件都是同一套结构：🚀 出发 → 🕰️ 故事 → 📖 知识 → 🖐️ 小任务 → ❓ 小测验 → 🏁 完成，最后一步可以写下**收获**并提交到收获墙（`POST /api/harvest`）。

- 课件路径：`public/history/` → URL `/history/lessonN.html`
- 补齐后续站点课件后，把 `public/index.html` 里的 `MAX_LESSON = 6` 调大即可

---

## API 路由

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/apps` | 自动扫描 `app/` 目录返回子应用列表（当前 `app/` 不存在 → 空数组） |
| `PUT` | `/api/apps/:id/status` | 切换子应用公开/隐藏状态（写回 `config.json`） |
| `POST` | `/api/harvest` | 提交一条收获：`student` ≤20 字、`content` 1–1000 字、`lesson` 1–16，校验失败返回 400 + 中文提示 |
| `GET` | `/api/harvest` | 收获墙列表，`?lesson=` 按站筛选、`?limit=` 限制条数（默认 200、上限 500），返回 `{ ok, items, stats }` |

其他未匹配的路径回退到首页（SPA）；`/.well-known/acme-challenge/*` 由 Express 直接提供，用于 certbot 验证。

---

## 测试

```bash
npm test            # 页面完整性 + API 检查（需先启动服务）
```

共 **43 条断言**，分四组：页面加载（标题）/ 关键元素 / 导航跳转 / API 端点。改端口后可 `BASE=http://localhost:8080 npm test`。

---

## 🚀 部署（对齐 `.github/workflows/deploy.yml`，阿里云 ECS）

1. 推送 `main` 分支，GitHub Actions（`.github/workflows/deploy.yml`）自动 SSH 到服务器执行：
   `git reset --hard origin/main` + `git clean -fd` → `npm install` → `pm2 startOrRestart ecosystem.config.js --update-env` → `pm2 save`
2. 服务器上由 PM2 跑 `server/server.ts`（Express + ts-node，**同时监听 80 与 443**），访问 `https://ai4kids.online/` 直接进入课程；证书不存在时自动只跑 HTTP，部署不会失败
3. 本地验证：`npm run dev` 后打开 `http://localhost:80/`（权限受限时 `PORT=8080 npm run dev`）

> **前端缓存破坏在运行时完成**：`server.ts` 响应 HTML 时读取 `.css` / `.js` 文件的 mtime 并追加 `?v=<mtime>`（资源不变则 URL 不变，命中缓存；资源一变 URL 就变，客户端必然重新拉取）。部署脚本**不再改写仓库里的 HTML**，所以服务器工作区始终干净，手动 `git pull` 不会再有冲突。

> 因为 Node 始终占着 80 端口，加证书不改端口，所以**部署过程站点不中断**。详见上文「🔒 HTTPS 部署」。

---

## 🔒 隐私与数据

- 闯关进度（学到哪一课、测验答案）仅保存在**本机浏览器**（localStorage），不会上传。
- 🏆 **收获墙是唯一会上传的数据**：孩子在最后一屏**自愿**填写的「名字 + 收获」会存进服务器 SQLite（`database/ai4kids.db`）并在收获墙页公开展示；不填写就不会有任何上传。

## 系列规划（待续）

- 目标：根据 guide 设计一系列小游戏，辅助孩子成长为一技之长 + 完整人格的「四种人」
- 本作以「职业启蒙 + 时间轴课程」为切入点，后续可为 101 个职业逐个添加 `app/<职业名>/` 时间轴课程子应用
