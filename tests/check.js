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
  await checkTitle('/course/aitimeline/', '人工智能简史 课程目录', '人工智能简史');
  await checkTitle('/guide.html', '教育全景导航', 'AI时代教育全景导航');
  await checkTitle('/course/aitimeline/lesson1.html', '简史第1站 图灵测试', '图灵测试');
  await checkTitle('/course/aitimeline/lesson2.html', '简史第2站 人工智能诞生', '人工智能诞生');
  await checkTitle('/course/aitimeline/lesson3.html', '简史第3站 感知机', '感知机');
  await checkTitle('/course/aitimeline/lesson4.html', '简史第4站 ELIZA', 'ELIZA');
  await checkTitle('/course/aitimeline/lesson5.html', '简史第5站 专家系统', '专家系统');
  await checkTitle('/course/aitimeline/lesson6.html', '简史第6站 反向传播', '反向传播');
  await checkTitle('/harvest.html', '收获墙', '收获墙');

  // 二、关键元素
  console.log('\n-- 2. 关键元素 --');
  await checkContains('/', '首页', '人工智能课堂', '平台标题');
  await checkContains('/', '首页', '课程一览', '课程卡片区标题');
  await checkContains('/', '首页', '人工智能简史', '课程卡片课程名');
  await checkContains('/', '首页', 'href="/course/aitimeline/"', '卡片链到课程目录');
  await checkContains('/', '首页', '/harvest.html', '收获墙入口（已移到首页）');
  await checkContains('/course/aitimeline/', '课程目录', '演化时间轴', '演化时间轴标题');
  await checkContains('/course/aitimeline/', '课程目录', 'lesson6.html', '16站目录含课件链接');
  await checkContains('/course/aitimeline/', '课程目录', 'MAX_LESSON = 6', '已上线站数开关');
  await checkContains('/course/aitimeline/lesson.css', '课件样式', '--acc', '课件样式表可用');
  await checkContains('/course/aitimeline/lesson1.html', '简史第1站', '返回课程', '返回课程目录按钮');
  await checkContains('/course/aitimeline/lesson1.html', '简史第1站', 'enigma-break.js', '谜题脚本');
  await checkContains('/course/aitimeline/lesson2.html', '简史第2站', 'lesson.js', '课件脚本接入');
  await checkContains('/course/aitimeline/lesson3.html', '简史第3站', 'perceptron-trainer.js', '感知机实验脚本');
  await checkContains('/course/aitimeline/lesson4.html', '简史第4站', 'eliza-lab.js', 'ELIZA 实验室脚本');
  await checkContains('/course/aitimeline/lesson5.html', '简史第5站', 'expert-lab.js', '专家系统实验室脚本');
  await checkContains('/course/aitimeline/lesson6.html', '简史第6站', '反向传播', '第6站正文');
  await checkContains('/course/aitimeline/lesson6.html', '简史第6站', 'neural-net-lab.js', '神经网络实验室脚本');
  await checkContains('/js/ai-evolution.js', '演化数据', '1950', '数据起点年份');

  // 三、导航跳转
  console.log('\n-- 3. 导航跳转 --');
  const home = await fetchHtml('/');
  log(!home.html.includes('class="tl"'), '首页 不再直接放时间轴', '时间轴已移到 /course/');
  log(home.html.includes('人工智能简史'), '首页 课程卡片含课程名', '人工智能简史');
  log(home.html.includes('href="/course/aitimeline/"'), '首页 卡片跳转课程目录', '/course/aitimeline/');
  log(home.html.includes('/harvest.html'), '首页 收获墙入口', '收获墙已移到首页');
  log(!home.html.includes('class="top"'), '首页 无顶部返回栏', '首页只保留 hero + 课程卡片');
  const course = await fetchHtml('/course/aitimeline/');
  log(course.html.includes('class="tl"'), '课程目录 时间轴容器', '16 站时间轴');
  log(course.html.includes('lesson16.html'), '课程目录 完整 16 站目录', '课程目录完整');
  log(course.html.includes('href="/"'), '课程目录 返回首页按钮', '可回到站点首页');
  log(!course.html.includes('wall-btn'), '课程目录 无收获墙按钮', '收获墙入口已移到首页');
  log(!course.html.includes('hero-btns'), '课程目录 无海报/打印按钮', '已移除课程海报与课程表打印入口');
  log(!course.html.includes('class="top"'), '课程目录 无顶部返回栏', '已移除顶部「首页 / 体验课」栏');
  log(course.html.includes('/css/style.css'), '课程目录 课件样式接入', 'style.css 路径已适配本站');
  const lesson1 = await fetchHtml('/course/aitimeline/lesson1.html');
  log(!lesson1.html.includes('E04'), '课件 无 E04 代号', '已移除课程代号 E04');
  log(lesson1.html.includes('href="/course/aitimeline/"'), '课件 返回课程目录', '指向 /course/aitimeline/');
  log(lesson1.html.includes('src="turing-lab.js'), '课件 互动实验脚本', '图灵实验室');
  log(!lesson1.html.includes('ai-fab'), '课件 无 AI 助手', '已移除「🤖 AI 讲解员」悬浮按钮与面板');
  log(!lesson1.html.includes('ai-service.js'), '课件 无 AI 服务依赖', '已移除 ai-service.js 引用');
  log(!lesson1.html.includes('experience-login-guard'), '课件 无平台登录守卫', '已移除 sx 平台鉴权');
  const gonePage = await fetchHtml('/artificial-intelligence/lab.html');
  log(gonePage.html.includes('人工智能课堂'), '旧子应用已下线', 'app/ 删除后回退到首页');
  const oldPath = await get('/history/lesson1.html', { redirect: 'manual' });
  log(oldPath.status === 301 && oldPath.headers.get('location') === '/course/aitimeline/lesson1.html',
    '旧课件路径 301 重定向', '/history/lessonN.html -> /course/aitimeline/lessonN.html');
  const bareCourse = await get('/course/', { redirect: 'manual' });
  log(bareCourse.status === 301 && bareCourse.headers.get('location') === '/',
    '/course/ 301 回首页', 'course/ 只是容器，没有自己的页面');
  const noSlash = await get('/course/aitimeline', { redirect: 'manual' });
  log(noSlash.status === 301 && noSlash.headers.get('location') === '/course/aitimeline/',
    '目录漏写末尾斜杠 301 补上', '/course/aitimeline -> /course/aitimeline/');

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
