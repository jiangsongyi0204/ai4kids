# ai4kids · AI+教育的落地实践

> K12 AI 教育游戏平台 — 把「职业启蒙」变成一场点亮星球的游戏

基于《AI时代教育全景导航》(guide.html) 的教育游戏系列。项目结构对齐 **sx-aitrialclass（课程星云）**：后端 **Node.js + Express + TypeScript**，前端纯 HTML/CSS/JS，零构建步骤，子应用自动扫描。

---

## 快速开始

```bash
npm install        # 安装依赖
npm run dev        # 启动服务（监听模式：改 server 文件自动重启）
```

服务运行在 `http://localhost:80`（Windows/Mac 权限受限时可 `PORT=8080 npm run dev`）。

> 💡 开发提示：改动 **前端** 文件（`public/` 下的 HTML/CSS/JS）**无需重启**，刷新浏览器即可；改动 **后端**（`server/`）文件，`npm run dev` 会自动重启。

---

## 访问地址

| 页面 | 地址 |
|------|------|
| 首页（人工智能简史 · 课程目录） | `http://localhost:80/` |
| AI时代教育全景导航 | `http://localhost:80/guide.html` |
| 第 1–6 站课件 | `http://localhost:80/experience/E04/lesson1.html` … `lesson6.html` |
| 🏆 收获墙（学员收获卡片） | `http://localhost:80/harvest.html` |

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
│   ├── js/                        # 课件公共脚本（cloud-records / lesson-recorder / tracker / classroom-float）
│   ├── fonts/                     # Orbitron 字体（课件用）
│   └── experience/E04/            # 人工智能简史 · 课件（已移植第 1–6 站）
│       ├── lesson1.html … lesson6.html
│       ├── lesson.css / lesson.js
│       ├── *-lab.css / *-lab.js   # 各站互动实验室（图灵 / 谜题 / 感知机 / ELIZA / 专家系统 / 神经网络）
│       └── img/                   # 配图
├── app/                           # （可选，当前不存在）子应用目录：建 app/<name>/index.html 即自动注册到 /<name>/
├── database/                      # 运行时数据（AI 生成物 + SQLite）
│   ├── images/                    # 大模型生成的图像
│   ├── text/                      # 大模型生成的文字
│   ├── videos/                    # 大模型生成的视频
│   ├── music/                     # 大模型生成的音乐
│   └── ai4kids.db                 # SQLite 数据库（harvests 表 = 收获墙，首次启动自动建表）
├── tests/                         # 自动化测试
│   └── check.js                   # 页面完整性 + API 检查
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

## 🧭 儿童职业启蒙101

把「职业启蒙」变成一场点亮星球的游戏：

- **首页（`public/index.html`）**：排布 **101 个职业卡片**，分成 10 大类（科技 / 医疗健康 / 教育 / 艺术创意 / 建造制造 / 商业财经 / 法律公共 / 科学探索 / 媒体传播 / 生活服务）。
- **点亮机制**：当前只有 **Web 开发** 已点亮（金色发光卡片），其余 100 个职业为灰色 🔒 锁定。
- **职业详情页**：点进已点亮的职业卡片进入时间轴课程页，用 **时间轴（timeline）** 从 1989 年到现在，列出该职业历史上所有重要节点。
- **节点即课程**：时间轴上每个节点就是 **一堂课**（Web 开发共 16 堂），每一堂都达到可以给小朋友讲课的水平，包含：
  1. 🕰️ **故事时间** —— 用孩子听得懂的语言讲那个年代发生了什么
  2. 📖 **知识小课堂** —— 核心概念讲解（比喻成积木、餐厅、快递等孩子熟悉的例子）
  3. 🖐️ **动手小任务** —— 在家就能做的手工/游戏/小实验
  4. ❓ **小测试** —— 选择题，答对立刻给解释
  5. 💭 **思考时间** —— 和爸爸妈妈聊天的开放式问题
- **进度保存**：孩子学到哪一课，保存在**本机浏览器**（localStorage），完成全部课程即可「点亮下一颗职业星球」。

### 📁 课程一览（Web 开发时间轴）
| 年份 | 节点 | 一句话 |
|---|---|---|
| 1989 | 🌐 万维网的诞生 | HTML/URL/HTTP 三件宝贝 |
| 1991 | 📄 第一个网页上线 | 写网页=搭积木 |
| 1993 | 🧭 浏览器出现了 | 浏览器=魔法望远镜 |
| 1994 | 🛒 域名与第一次网购 | DNS=电话簿 |
| 1995 | ⚡ JavaScript 诞生 | 网页有了大脑 |
| 1995 | 🗄️ 前端与后端 | 点菜与厨房 |
| 1998 | 🔍 Google 与搜索 | 搜索引擎三步骤 |
| 2004 | 👥 Web 2.0 社交时代 | 人人可创作 |
| 2007 | 📱 智能手机时代 | 响应式设计 |
| 2008 | 🧱 HTML5 新标准 | 网页的新积木 |
| 2009 | 🚂 Node.js 全栈时代 | 一个语言通吃前后端 |
| 2013 | ⚛️ 前端框架时代 | 组件化乐高 |
| 2016 | 🧰 前后端分离与工程化 | API=点菜窗口 |
| 2019 | ☁️ 云计算与 Serverless | 网站住进云端 |
| 2022 | 🤖 AI 辅助编程 | 和 AI 做队友 |
| 2024 | 🌟 AI 智能体时代 | 指挥 AI 的导演 |

### 子应用与首页卡片

首页通过 `/api/apps` 自动扫描 `app/` 目录下的 `config.json` 生成课程卡片，每个子应用独立运行在各自的路由下。新增职业/游戏时，只需在 `app/` 下新建文件夹并添加 `index.html` + `config.json` 即可自动出现在首页。

```json
{
  "name": "Web 开发",
  "desc": "从1989年到现在的时间轴课程，16堂课学懂Web开发的前世今生",
  "audience": "5-12岁",
  "direction": "职业启蒙",
  "status": "公开",
  "creator": "蒋宋义",
  "code": 1
}
```

> 管理员可在首页切换状态标签（公开 ⇄ 隐藏），隐藏的子应用对普通用户不可见（预留能力）。

---

## API 路由

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/apps` | 自动扫描 `app/` 目录，返回所有子应用信息 |
| `PUT` | `/api/apps/:id/status` | 切换子应用公开/隐藏状态 |

---

## 测试

```bash
npm test            # 页面完整性 + API 检查（需先启动服务）
```

---

## 🚀 部署（对齐 `.github/workflows/deploy.yml`，阿里云 ECS）

1. 推送 `main` 分支，GitHub Actions 自动 SSH 到服务器执行：`git pull` → `npm install` → `pm2 start npm -- run start`
2. 服务器通过 `npm start` 启动 `server/server.ts`（Express + ts-node，**监听 80 端口**），访问 `https://你的域名/` 直接进入游戏
3. 本地验证：`npm start` 后打开 `http://localhost:80/`（Windows/Mac 可用 `PORT=8080 npm start` 避开权限）

> 若改为部署到 GitHub Pages：把 `public/` 和 `app/` 下的内容推到仓库根目录，开启 **Settings → Pages**（main / root）即可（注意相对链接需改为绝对路径）。

---

## 🔒 隐私与数据

- 孩子的学习进度仅保存在**本机浏览器**（localStorage），不会上传。

## 系列规划（待续）

- 目标：根据 guide 设计一系列小游戏，辅助孩子成长为一技之长 + 完整人格的「四种人」
- 本作以「职业启蒙 + 时间轴课程」为切入点，后续可为 101 个职业逐个添加 `app/<职业名>/` 时间轴课程子应用
