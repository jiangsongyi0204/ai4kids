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
  console.log('   ai4kids · 儿童职业启蒙101 自动化测试');
  console.log('   BASE = ' + BASE);
  console.log('========================================\n');

  // 一、页面加载
  console.log('-- 1. 页面加载 --');
  await checkTitle('/', '首页', '儿童职业启蒙101');
  await checkTitle('/guide.html', '教育全景导航', 'AI时代教育全景导航');
  await checkTitle('/web-development/', 'Web开发课程', 'Web 开发');
  await checkTitle('/artificial-intelligence/', '人工智能课程', '人工智能');
  await checkTitle('/artificial-intelligence/neural-network.html', '神经网络实验', '神经网络');
  await checkTitle('/artificial-intelligence/mnist.html', '手写数字识别', '手写数字识别');
  await checkTitle('/artificial-intelligence/cnn.html', '卷积神经网络', '卷积神经网络');

  // 二、关键元素
  console.log('\n-- 2. 关键元素 --');
  await checkContains('/', '首页', '儿童职业启蒙', '顶栏文案');
  await checkContains('/', '首页', 'Web 开发', 'Web开发卡片');
  await checkContains('/', '首页', 'career101_unlocked', '解锁进度存储');
  await checkContains('/web-development/', 'Web开发', '时间轴', '时间轴组件');
  await checkContains('/web-development/', 'Web开发', '1989', '起点年份');
  await checkContains('/artificial-intelligence/', '人工智能', '时间轴', '时间轴组件');
  await checkContains('/artificial-intelligence/', '人工智能', '1950', '起点年份');
  await checkContains('/artificial-intelligence/neural-network.html', '神经网络', '10×10', '10x10地图');
  await checkContains('/artificial-intelligence/neural-network.html', '神经网络', '训练数据格式', '数据格式');
  await checkContains('/artificial-intelligence/mnist.html', '手写数字', '实际问题', '实际问题段落');
  await checkContains('/artificial-intelligence/mnist.html', '手写数字', '训练数据格式', '数据格式段落');
  await checkContains('/artificial-intelligence/mnist.html', '手写数字', 'ANN 可视化训练器', '可视化训练器');
  await checkContains('/artificial-intelligence/mnist.html', '手写数字', '互动演示', '互动演示段落');
  await checkContains('/artificial-intelligence/mnist.html', '手写数字', '200 组', '训练数据200组');
  await checkContains('/artificial-intelligence/cnn.html', '卷积', '实际问题', '实际问题段落');
  await checkContains('/artificial-intelligence/cnn.html', '卷积', '训练数据格式', '数据格式段落');
  await checkContains('/artificial-intelligence/cnn.html', '卷积', 'CNN 可视化训练器', '可视化训练器');
  await checkContains('/artificial-intelligence/cnn.html', '卷积', '互动演示', '互动演示段落');

  // 三、导航跳转
  console.log('\n-- 3. 导航跳转 --');
  const home = await fetchHtml('/');
  log(home.html.includes("'/'") || home.html.includes('"/"'), '首页 职业卡片跳转', '职业卡片链接到 /web-development/');
  log(home.html.includes('href="/guide.html"'), '首页 教育理念按钮', '链接到 guide.html');
  const wd = await fetchHtml('/web-development/');
  log(/location\.href\s*=\s*['"]\//.test(wd.html) || /href=["']\//.test(wd.html), 'Web开发 返回首页按钮', '可返回首页');
  const aiPage = await fetchHtml('/artificial-intelligence/');
  log(aiPage.html.includes('neural-network.html'), '人工智能 神经网络按钮', '链接到神经网络实验');
  log(aiPage.html.includes('mnist.html'), '人工智能 手写数字按钮', '链接到手写数字识别');
  log(aiPage.html.includes('cnn.html'), '人工智能 卷积网络按钮', '链接到卷积神经网络');

  // 四、API 端点
  console.log('\n-- 4. API --');
  const appsRes = await get('/api/apps');
  let appsData = null;
  try { appsData = await appsRes.json(); } catch {}
  log(appsRes.status === 200, 'GET /api/apps', `status=${appsRes.status}`);
  log(Array.isArray(appsData), '/api/apps 返回数组', `长度=${Array.isArray(appsData) ? appsData.length : 'N/A'}`);
  log(Array.isArray(appsData) && appsData.some(a => a.id === 'web-development'), '/api/apps 含 web-development',
    Array.isArray(appsData) && appsData.some(a => a.id === 'web-development') ? '找到' : '未找到');
  log(Array.isArray(appsData) && appsData.some(a => a.id === 'artificial-intelligence'), '/api/apps 含 artificial-intelligence',
    Array.isArray(appsData) && appsData.some(a => a.id === 'artificial-intelligence') ? '找到' : '未找到');

  console.log('\n' + '='.repeat(40));
  console.log(`结果: ${passed} 通过 / ${failed} 失败 / 共 ${total}`);
  console.log('='.repeat(40));
  process.exitCode = failed > 0 ? 1 : 0;
}

main();
