/**
 * ai4kids · 人工智能的未来 Express 入口
 *
 * 结构对齐 sx-aitrialclass（课程星云）：
 *   - public/    主站前端（静态服务，根目录）
 *   - app/       子应用源码（自动扫描 + 自动注册静态路由）
 *   - database/  运行时数据（AI 生成的图像/文字/视频/音乐 + SQLite）
 *   - tests/     自动化测试
 *
 * 启动：npm run dev   （监听模式，改 server 文件自动重启）
 *       npm start     （生产模式，ts-node 直跑）
 * 如需改端口：PORT=8080 npm run dev
 *
 * HTTPS（不用 Nginx，Node 自己扛）：
 *   TLS_DIR      证书目录，默认 /etc/letsencrypt/live/ai4kids.online
 *   HTTPS_PORT   HTTPS 端口，默认 443
 *   ACME_WEBROOT certbot 的 HTTP-01 验证目录，默认 /var/www/certbot
 *   → 证书存在：443 跑 HTTPS，80 的请求 301 跳过去（ACME 验证路径除外）
 *   → 证书不存在：只跑 HTTP（本地开发就是这种情况）
 */
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import http from 'http';
import https from 'https';
import { openHarvestStore } from './db';

const app = express();
// 生产环境跑在 HTTPS 反向代理/负载均衡后面时，让 req.protocol / req.ip 取到真实值
app.set('trust proxy', true);
const PORT = Number(process.env.PORT) || 80;
const HOST = process.env.HOST || '0.0.0.0';
// HTTPS：证书存在时自动在 HTTPS_PORT 上开 TLS，并把 80 的请求 301 跳过去
const HTTPS_PORT = Number(process.env.HTTPS_PORT) || 443;
const TLS_DIR = process.env.TLS_DIR || '/etc/letsencrypt/live/ai4kids.online';
// certbot 的 HTTP-01 验证文件目录（申请/续期证书时由本服务在 80 端口提供）
const ACME_WEBROOT = process.env.ACME_WEBROOT || '/var/www/certbot';

const APPS_DIR = path.join(__dirname, '../app');
const PUBLIC_DIR = path.join(__dirname, '../public');
const DATABASE_DIR = path.join(__dirname, '../database');

// 确保 database/ 分类子目录存在（AI 生成物：图像/文字/视频/音乐 + 未来 SQLite）
const DATABASE_SUBDIRS = ['images', 'text', 'videos', 'music'];
for (const sub of DATABASE_SUBDIRS) {
  fs.mkdirSync(path.join(DATABASE_DIR, sub), { recursive: true });
}

// 收获墙数据库（SQLite，文件落在 database/ai4kids.db）
const harvestStore = openHarvestStore(path.join(DATABASE_DIR, 'ai4kids.db'));

// 中间件
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// 静态文件响应头（更新后立即生效，防止缓存）
const noCache = (_res: express.Response) => {
  _res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  _res.setHeader('Pragma', 'no-cache');
  _res.setHeader('Expires', '0');
};

// 主站前端静态服务
app.use(express.static(PUBLIC_DIR, { setHeaders: noCache }));

// ========== 自动注册 app/ 目录下的子应用 ==========
// app/ 不存在时也能正常启动；要新增子应用，建 app/<name>/index.html（+ config.json）即可
const APPS: string[] = [];
const appEntries = fs.existsSync(APPS_DIR) ? fs.readdirSync(APPS_DIR, { withFileTypes: true }) : [];
for (const d of appEntries) {
  if (!d.isDirectory()) continue;
  const name = d.name;
  const appDir = path.join(APPS_DIR, name);
  // 只有包含 index.html 的目录才作为子应用注册
  if (!fs.existsSync(path.join(appDir, 'index.html'))) continue;
  APPS.push(name);
  // 子应用静态文件（源码目录，无需构建）
  app.use(`/${name}`, express.static(appDir, { setHeaders: noCache }));
  // SPA 回退（非 API 请求返回子应用 index.html）
  app.get(`/${name}/*`, (req, res) => {
    if (req.path.startsWith(`/${name}/api/`)) return;
    res.sendFile(path.join(appDir, 'index.html'));
  });
}

// ========== 自动扫描 app 目录 → 课程卡片 ==========
app.get('/api/apps', (_req, res) => {
  try {
    const apps = APPS.map((name) => {
      const configPath = path.join(APPS_DIR, name, 'config.json');
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        return {
          id: name,
          name: config.name || name,
          desc: config.desc || config.description || '',
          audience: config.audience || '',
          direction: config.direction || '',
          status: config.status || '公开',
          creator: config.creator || '未知',
          code: config.code || 0,
          url: `/${name}/`,
        };
      } catch {
        // config.json 不存在或解析失败，使用文件夹名
        return {
          id: name,
          name,
          desc: '',
          audience: '',
          direction: '',
          status: '公开',
          creator: '未知',
          code: 0,
          url: `/${name}/`,
        };
      }
    });
    res.json(apps);
  } catch (err) {
    res.status(500).json({ error: '无法读取应用列表' });
  }
});

// 切换子应用公开/隐藏状态
app.put('/api/apps/:id/status', (req, res) => {
  const configPath = path.join(APPS_DIR, req.params.id, 'config.json');
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const current = config.status || '公开';
    config.status = current === '隐藏' ? '公开' : '隐藏';
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    res.json({ status: config.status });
  } catch (err) {
    res.status(404).json({ error: '应用不存在或无法更新' });
  }
});

// ========== 收获墙（SQLite） ==========
// 课件「💾 保存收获 · 完成本站」提交一条收获
app.post('/api/harvest', (req, res) => {
  const body = (req.body || {}) as Record<string, unknown>;
  const student = String(body.student ?? '').trim();
  const content = String(body.content ?? '').trim();
  const lessonTitle = String(body.lessonTitle ?? '').trim().slice(0, 100);
  const lesson = Number(body.lesson);

  if (!student) return res.status(400).json({ ok: false, error: '请先写上你的名字哦～' });
  if (student.length > 20) return res.status(400).json({ ok: false, error: '名字太长啦（最多 20 个字）' });
  if (!content) return res.status(400).json({ ok: false, error: '还没有写收获哦，写一句也好呀～' });
  if (content.length > 1000) return res.status(400).json({ ok: false, error: '收获太长啦（最多 1000 字）' });
  if (!Number.isInteger(lesson) || lesson < 1 || lesson > 16) {
    return res.status(400).json({ ok: false, error: '站点编号不正确' });
  }

  try {
    const card = harvestStore.insert({ student, lesson, lessonTitle, content });
    res.json({ ok: true, card, stats: harvestStore.stats() });
  } catch (err) {
    console.error('保存收获失败：', err);
    res.status(500).json({ ok: false, error: '服务器保存失败，请稍后再试' });
  }
});

// 收获墙列表（可按站筛选）
app.get('/api/harvest', (req, res) => {
  try {
    const lessonQ = typeof req.query.lesson === 'string' ? Number(req.query.lesson) : NaN;
    const limitQ = typeof req.query.limit === 'string' ? Number(req.query.limit) : NaN;
    const lesson = Number.isInteger(lessonQ) && lessonQ >= 1 && lessonQ <= 16 ? lessonQ : undefined;
    const limit = Number.isInteger(limitQ) && limitQ > 0 ? Math.min(limitQ, 500) : 200;

    res.json({
      ok: true,
      items: harvestStore.list({ lesson, limit }),
      stats: harvestStore.stats(),
    });
  } catch (err) {
    console.error('读取收获墙失败：', err);
    res.status(500).json({ ok: false, error: '服务器读取失败，请稍后再试' });
  }
});

// Let's Encrypt 的 HTTP-01 验证文件（certbot 写到这里，必须能通过 80 端口访问到）
// 目录不存在时先建出来，避免 serve-static 因 root 不存在而抛 ENOENT
try { fs.mkdirSync(ACME_WEBROOT, { recursive: true }); } catch { /* 权限不足时忽略 */ }
app.use('/.well-known/acme-challenge', express.static(ACME_WEBROOT));
// 找不到验证文件就干脆 404，不要落到下面的 SPA 回退（否则 certbot 失败时只看到首页，难排查）
app.use('/.well-known/acme-challenge', (_req, res) => {
  res.status(404).type('text/plain').send('acme challenge not found');
});

// 其他未匹配请求回退到首页（SPA 支持）
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// ========== 启动（HTTP；证书存在时同时启动 HTTPS） ==========
function readCerts(): { key: Buffer; cert: Buffer } | null {
  try {
    return {
      key: fs.readFileSync(path.join(TLS_DIR, 'privkey.pem')),
      cert: fs.readFileSync(path.join(TLS_DIR, 'fullchain.pem')),
    };
  } catch {
    return null;
  }
}

const tlsCerts = readCerts();
const httpsOn = !!(tlsCerts && HTTPS_PORT > 0);

if (tlsCerts && HTTPS_PORT > 0) {
  https.createServer(tlsCerts, app).listen(HTTPS_PORT, HOST, () => {
    console.log(`🔒 HTTPS 已启动: https://${HOST}:${HTTPS_PORT}/   证书: ${TLS_DIR}`);
  });
}

http.createServer((req, res) => {
  const url = req.url || '/';
  // 证书验证请求必须留在 80 端口，不能跳转，否则 certbot 校验失败
  const isAcme = url.startsWith('/.well-known/acme-challenge/');
  if (httpsOn && !isAcme) {
    const host = String(req.headers.host || '').replace(/:\d+$/, '') || `localhost:${HTTPS_PORT}`;
    res.writeHead(301, { Location: `https://${host}${url}` });
    res.end();
    return;
  }
  app(req, res);
}).listen(PORT, HOST, () => {
  console.log('🚀 ai4kids · 人工智能的未来 服务器已启动');
  console.log(httpsOn
    ? `   HTTP : http://${HOST}:${PORT}/  → 301 跳转到 HTTPS`
    : `   HTTP : http://${HOST}:${PORT}/  （未检测到证书，本次只跑 HTTP）`);
  for (const name of APPS) {
    console.log(`   子应用: /${name}/`);
  }
});
