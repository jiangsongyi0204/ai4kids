/**
 * ai4kids · 儿童职业启蒙101 页面自动化检查脚本
 * 纯 HTTP 请求，无需浏览器，零依赖
 * 包含：页面加载 + 关键元素 + API 端点
 * 用法: node tests/check.js          （默认 http://localhost:80）
 *       BASE=http://localhost:8080 node tests/check.js
 */

const BASE = process.env.BASE || 'http://localhost:80';

let passed = 0, failed = 0, total = 0;
const results = [];

function log(ok, label, detail = '') {
  total++;
  if (ok) passed++; else failed++;
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
  results.push({ ok, label, detail });
}

async function get(path, opts = {}) {
  const headers = { Connection: 'close', ...(opts.headers || {}) };
  try { return await fetch(BASE + path, { ...opts, headers }); }
  catch (e) { return { status: 0, _error: e.message }; }
}

async function fetchHtml(path) {
  const res = await get(path, { redirect: 'follow' });
  return { res, html: res.status === 200 ? await res.text() : '' };
}

async function checkPage(path, name) {
  const res = await get(path, { redirect: 'follow' });
  log(res.status === 200, `${name} 页面加载`, `GET ${path} -> ${res.status}`);
  return res;
}

async function checkTitle(path, name, expectedText) {
  const { res, html } = await fetchHtml(path);
  if (res.status !== 200) { log(false, `${name} 标题`, `页面返回 ${res.status}`); return; }
  const m = html.match(/<title>([^<]*)<\/title>/i);
  const title = m ? m[1] : '';
  const ok = title.includes(expectedText);
  log(ok, `${name} 标题`, ok ? `"${title}"` : `期望含"${expectedText}" 实际"${title}"`);
}

async function checkContains(path, name, text, desc) {
  const { res, html } = await fetchHtml(path);
  if (res.status !== 200) { log(false, `${name} ${desc}`, `页面返回 ${res.status}`); return; }
  log(html.includes(text), `${name} ${desc}`, text.slice(0, 50));
}

// ========== 主测试 ==========
async function main() {
  console.log('\n========================================');
  console.log('   ai4kids · 人工智能的未来 自动化测试');
  console.log('   BASE = ' + BASE);
  console.log('========================================\n');

  // 一、页面加载
  console.log('-- 1. 页面加载 --');
  await checkTitle('/', '首页（课程一览）', '人工智能课堂');
  await checkTitle('/course/mcst/', 'MCST 图解', 'MCST');
  await checkTitle('/guide.html', '教育全景导航', 'AI时代教育全景导航');
  await checkTitle('/harvest.html', '收获墙', '收获墙');

  // 二、关键元素
  console.log('\n-- 2. 关键元素 --');
  await checkContains('/', '首页', '人工智能课堂', '平台标题');
  await checkContains('/', '首页', '课程一览', '课程卡片区标题');
  await checkContains('/', '首页', 'MCST 图解', 'MCST 课程卡片课程名');
  await checkContains('/', '首页', 'href="/course/mcst/"', '卡片链到 MCST 互动课');
  await checkContains('/', '首页', '/harvest.html', '收获墙入口（已移到首页）');
  await checkContains('/course/mcst/', 'MCST 图解', '选择', '四步之选择');
  await checkContains('/course/mcst/', 'MCST 图解', '反向传播', '四步之反向传播');
  await checkContains('/course/mcst/', 'MCST 图解', 'mcst.js', '互动脚本接入');
  await checkContains('/course/mcst/mcst.css', 'MCST 样式', '.board {', '棋盘样式可用');
  await checkContains('/course/mcst/mcst.js', 'MCST 脚本', 'function iterate', 'MCTS 四步内核');

  // 三、导航跳转
  console.log('\n-- 3. 导航跳转 --');
  const home = await fetchHtml('/');
  log(!home.html.includes('class="tl"'), '首页 不再直接放时间轴', '时间轴课程已删除');
  log(!home.html.includes('人工智能简史'), '首页 已移除人工智能简史卡片', '课程已删除');
  log(home.html.includes('href="/course/mcst/"'), '首页 MCST 卡片跳转', '/course/mcst/');
  log(home.html.includes('/harvest.html'), '首页 收获墙入口', '收获墙已移到首页');
  log(!home.html.includes('class="top"'), '首页 无顶部返回栏', '首页只保留 hero + 课程卡片');
  const goneCourse = await fetchHtml('/course/aitimeline/');
  log(goneCourse.html.includes('人工智能课堂'), '已删除课程回退首页', '/course/aitimeline/ -> 首页');
  const goneLesson = await fetchHtml('/course/aitimeline/lesson1.html');
  log(goneLesson.html.includes('人工智能课堂'), '已删除课件回退首页', '/course/aitimeline/lesson1.html -> 首页');
  const mcstPage = await fetchHtml('/course/mcst/');
  log(mcstPage.html.includes('href="/"'), '互动课 返回首页按钮', '可回到站点首页');
  const gonePage = await fetchHtml('/artificial-intelligence/lab.html');
  log(gonePage.html.includes('人工智能课堂'), '旧子应用已下线', 'app/ 删除后回退到首页');
  const bareCourse = await get('/course/', { redirect: 'manual' });
  log(bareCourse.status === 301 && bareCourse.headers.get('location') === '/',
    '/course/ 301 回首页', 'course/ 只是容器，没有自己的页面');
  const noSlash = await get('/course/mcst', { redirect: 'manual' });
  log(noSlash.status === 301 && noSlash.headers.get('location') === '/course/mcst/',
    '目录漏写末尾斜杠 301 补上', '/course/mcst -> /course/mcst/');

  // 四、API 端点
  console.log('\n-- 4. API --');
  const appsRes = await get('/api/apps');
  let appsData = null;
  try { appsData = await appsRes.json(); } catch {}
  log(appsRes.status === 200, 'GET /api/apps', `status=${appsRes.status}`);
  log(Array.isArray(appsData), '/api/apps 返回数组', `长度=${Array.isArray(appsData) ? appsData.length : 'N/A'}`);
  log(Array.isArray(appsData) && appsData.length === 0, '/api/apps 为空（app 已删除）', `长度=${appsData.length}`);

  // 收获墙 API
  const harvestRes = await get('/api/harvest');
  let harvestData = null;
  try { harvestData = await harvestRes.json(); } catch {}
  log(harvestRes.status === 200, 'GET /api/harvest', `status=${harvestRes.status}`);
  log(!!(harvestData && Array.isArray(harvestData.items)), '/api/harvest 返回卡片数组',
    `条数=${harvestData && Array.isArray(harvestData.items) ? harvestData.items.length : 'N/A'}`);
  log(!!(harvestData && harvestData.stats && typeof harvestData.stats.total === 'number'),
    '/api/harvest 返回统计', harvestData && harvestData.stats ? `总数=${harvestData.stats.total}` : 'N/A');

  // 校验：空字段应被拒绝（不会写入数据库）
  const badRes = await get('/api/harvest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ student: '', lesson: 1, content: '' }),
  });
  log(badRes.status === 400, 'POST /api/harvest 校验空字段', `status=${badRes.status}`);

  console.log('\n' + '='.repeat(40));
  console.log(`结果: ${passed} 通过 / ${failed} 失败 / 共 ${total}`);
  console.log('='.repeat(40));
  process.exitCode = failed > 0 ? 1 : 0;
}

main();
