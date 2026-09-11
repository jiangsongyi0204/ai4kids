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
  await checkTitle('/', '首页（人工智能简史课程目录）', '人工智能简史');
  await checkTitle('/guide.html', '教育全景导航', 'AI时代教育全景导航');
  await checkTitle('/history/lesson1.html', '简史第1站 图灵测试', '图灵测试');
  await checkTitle('/history/lesson2.html', '简史第2站 人工智能诞生', '人工智能诞生');
  await checkTitle('/history/lesson3.html', '简史第3站 感知机', '感知机');
  await checkTitle('/history/lesson4.html', '简史第4站 ELIZA', 'ELIZA');
  await checkTitle('/history/lesson5.html', '简史第5站 专家系统', '专家系统');
  await checkTitle('/history/lesson6.html', '简史第6站 反向传播', '反向传播');
  await checkTitle('/harvest.html', '收获墙', '收获墙');

  // 二、关键元素
  console.log('\n-- 2. 关键元素 --');
  await checkContains('/', '首页', '人工智能简史', '站名文案');
  await checkContains('/', '首页', '演化时间轴', '演化时间轴标题');
  await checkContains('/', '首页', 'lesson6.html', '16站目录含课件链接');
  await checkContains('/', '首页', 'MAX_LESSON = 6', '已移植站数开关');
  await checkContains('/', '首页', '/harvest.html', '收获墙入口按钮');
  await checkContains('/history/lesson.css', '课件样式', '--acc', '课件样式表可用');
  await checkContains('/history/lesson1.html', '简史第1站', '返回课程', '返回课程目录按钮');
  await checkContains('/history/lesson1.html', '简史第1站', 'enigma-break.js', '谜题脚本');
  await checkContains('/history/lesson2.html', '简史第2站', 'lesson.js', '课件脚本接入');
  await checkContains('/history/lesson3.html', '简史第3站', 'perceptron-trainer.js', '感知机实验脚本');
  await checkContains('/history/lesson4.html', '简史第4站', 'eliza-lab.js', 'ELIZA 实验室脚本');
  await checkContains('/history/lesson5.html', '简史第5站', 'expert-lab.js', '专家系统实验室脚本');
  await checkContains('/history/lesson6.html', '简史第6站', '反向传播', '第6站正文');
  await checkContains('/history/lesson6.html', '简史第6站', 'neural-net-lab.js', '神经网络实验室脚本');
  await checkContains('/js/ai-evolution.js', '演化数据', '1950', '数据起点年份');

  // 三、导航跳转
  console.log('\n-- 3. 导航跳转 --');
  const home = await fetchHtml('/');
  log(home.html.includes('class="tl"'), '首页 时间轴容器', '16 站时间轴');
  log(home.html.includes('lesson16.html'), '首页 完整 16 站目录', '课程目录完整');
  log(!home.html.includes('hero-btns'), '首页 无海报/打印按钮', '已移除课程海报与课程表打印入口');
  log(!home.html.includes('class="top"'), '首页 无顶部返回栏', '已移除顶部「首页 / 体验课」栏');
  log(home.html.includes('/css/style.css'), '首页 课件样式接入', 'style.css 路径已适配本站');
  const lesson1 = await fetchHtml('/history/lesson1.html');
  log(!lesson1.html.includes('E04'), '课件 无 E04 代号', '已移除课程代号 E04');
  log(lesson1.html.includes('href="/"'), '课件 返回课程目录', '返回首页');
  log(lesson1.html.includes('src="turing-lab.js'), '课件 互动实验脚本', '图灵实验室');
  log(!lesson1.html.includes('ai-fab'), '课件 无 AI 助手', '已移除「🤖 AI 讲解员」悬浮按钮与面板');
  log(!lesson1.html.includes('ai-service.js'), '课件 无 AI 服务依赖', '已移除 ai-service.js 引用');
  log(!lesson1.html.includes('experience-login-guard'), '课件 无平台登录守卫', '已移除 sx 平台鉴权');
  const gonePage = await fetchHtml('/artificial-intelligence/lab.html');
  log(gonePage.html.includes('人工智能简史'), '旧子应用已下线', 'app/ 删除后回退到首页');

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
