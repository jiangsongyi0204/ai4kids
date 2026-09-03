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
 */
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

const app = express();
const PORT = Number(process.env.PORT) || 80;
const HOST = process.env.HOST || '0.0.0.0';

const APPS_DIR = path.join(__dirname, '../app');
const PUBLIC_DIR = path.join(__dirname, '../public');
const DATABASE_DIR = path.join(__dirname, '../database');

// 确保 database/ 分类子目录存在（AI 生成物：图像/文字/视频/音乐 + 未来 SQLite）
const DATABASE_SUBDIRS = ['images', 'text', 'videos', 'music'];
for (const sub of DATABASE_SUBDIRS) {
  fs.mkdirSync(path.join(DATABASE_DIR, sub), { recursive: true });
}

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
const APPS: string[] = [];
for (const d of fs.readdirSync(APPS_DIR, { withFileTypes: true })) {
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

// 其他未匹配请求回退到首页（SPA 支持）
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`🚀 ai4kids · 人工智能的未来 服务器已启动: http://${HOST}:${PORT}`);
  console.log(`   主站首页:  http://${HOST}:${PORT}/`);
  for (const name of APPS) {
    console.log(`   ${name}: http://${HOST}:${PORT}/${name}/`);
  }
});
