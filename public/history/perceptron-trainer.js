
/* Toast 底部提示（原 common.js 内联） */
let toastTimer;
function toast(msg){
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove('show'), 2400);
}

/* =====================================================
   单层感知机 · 真实实现
   模型：y = step(w1*x1 + w2*x2 + b)
   学习：w += η·(答案 - 预测)·x   （做错了才更新）
===================================================== */
const TASKS = {
  AND: { name:'与 AND',  desc:'两个输入都是 1，答案才是 1', data:[[0,0,0],[0,1,0],[1,0,0],[1,1,1]] },
  OR:  { name:'或 OR',   desc:'只要有一个输入是 1，答案就是 1', data:[[0,0,0],[0,1,1],[1,0,1],[1,1,1]] },
  XOR: { name:'异或 XOR',desc:'两个输入不一样，答案才是 1（单层学不会！）', data:[[0,0,0],[0,1,1],[1,0,1],[1,1,0]] }
};
let task = 'AND';
let W = [0,0,0];           // w1, w2, b
let lr = 0.4;
let stepCount = 0, epochCount = 0, errHistory = [];
let autoTimer = null;
let lastX = [0,0];   // 最近一次展示的输入（用于网络图节点数值）

/* ---------- 模型 ---------- */
function predict(x){ return (x[0]*W[0] + x[1]*W[1] + W[2]) > 0 ? 1 : 0; }
function stepOne(sample){
  const [x1,x2,t] = sample;
  lastX = [x1,x2];
  const pred = predict([x1,x2]);
  if(pred !== t){
    W[0] += lr * (t - pred) * x1;
    W[1] += lr * (t - pred) * x2;
    W[2] += lr * (t - pred) * 1;
    return false; // 错了
  }
  return true;
}

/* ---------- 渲染 ---------- */
function renderTasks(){
  const pick = document.getElementById('taskPicker');
  pick.innerHTML = Object.keys(TASKS).map(k=>
    `<button class="task-btn ${k===task?'active':''} ${k==='XOR'?'xor':''}" data-k="${k}">${TASKS[k].name}</button>`
  ).join('');
  pick.querySelectorAll('.task-btn').forEach(b=>{
    b.onclick = ()=>{ task = b.dataset.k; reset(); renderTasks(); renderData(); };
  });
  document.getElementById('taskDesc').textContent = TASKS[task].desc;
}
function renderTruth(){
  const tb = document.getElementById('truthTable');
  tb.innerHTML = '<tr><th>x₁</th><th>x₂</th><th>答案</th></tr>' +
    TASKS[task].data.map(([a,b,t])=>`<tr><td>${a}</td><td>${b}</td><td class="${t?'out1':'out0'}">${t}</td></tr>`).join('');
}
function renderData(){
  const dl = document.getElementById('dataList');
  dl.innerHTML = TASKS[task].data.map(([a,b,t],i)=>{
    const pred = predict([a,b]);
    return `<div class="dl-row" data-i="${i}">
      <span class="dl-idx">#${i}</span>
      <span class="dl-in">[${a}, ${b}]</span>
      <span class="dl-out">→ ${t}${pred===t?'':'  ✗'}</span>
    </div>`;
  }).join('');
  dl.querySelectorAll('.dl-row').forEach(r=>{
    r.onclick = ()=>{
      const i = +r.dataset.i;
      stepOne(TASKS[task].data[i]); stepCount++;
      update();
      const row = dl.querySelector(`.dl-row[data-i="${i}"]`);
      if(row) row.classList.add('active');
    };
  });
}
function renderNet(){
  const wScale = v => Math.max(2, Math.min(9, Math.abs(v)*6 + 2));
  const hot = Math.max(Math.abs(W[0]),Math.abs(W[1]),Math.abs(W[2]));
  const x1 = lastX[0], x2 = lastX[1];
  const sum = W[0]*x1 + W[1]*x2 + W[2];
  const yv = sum > 0 ? 1 : 0;
  const w1c = W[0]>=0 ? '#3b82f6' : '#ef4444';
  const w2c = W[1]>=0 ? '#3b82f6' : '#ef4444';
  const bc  = W[2]>=0 ? '#3b82f6' : '#ef4444';
  const html = `<svg viewBox="0 0 520 250">
    <text x="70" y="22" font-size="13" fill="#8a93b8" text-anchor="middle" font-weight="700">输入层</text>
    <circle cx="70" cy="58" r="24" fill="#a7d0ff" stroke="#3a5bb0" stroke-width="3"/>
    <text x="70" y="53" font-size="13" fill="#1c2f6b" text-anchor="middle">x₁</text>
    <text x="70" y="71" font-size="16" fill="#1c2f6b" text-anchor="middle" font-weight="800">${x1}</text>
    <circle cx="70" cy="128" r="24" fill="#a7d0ff" stroke="#3a5bb0" stroke-width="3"/>
    <text x="70" y="123" font-size="13" fill="#1c2f6b" text-anchor="middle">x₂</text>
    <text x="70" y="141" font-size="16" fill="#1c2f6b" text-anchor="middle" font-weight="800">${x2}</text>
    <circle cx="70" cy="198" r="22" fill="#dbe4f0" stroke="#64748b" stroke-width="3"/>
    <text x="70" y="204" font-size="16" fill="#334155" text-anchor="middle">1</text>
    <line x1="92" y1="60" x2="300" y2="118" stroke="${w1c}" stroke-width="${wScale(W[0])}" stroke-linecap="round"/>
    <line x1="92" y1="128" x2="302" y2="130" stroke="${w2c}" stroke-width="${wScale(W[1])}" stroke-linecap="round"/>
    <line x1="92" y1="196" x2="300" y2="142" stroke="${bc}" stroke-width="${wScale(W[2])}" stroke-linecap="round"/>
    <text x="196" y="84" font-size="14" fill="#3a4470" text-anchor="middle" font-weight="700">w₁=${W[0].toFixed(2)}</text>
    <text x="200" y="150" font-size="14" fill="#3a4470" text-anchor="middle" font-weight="700">w₂=${W[1].toFixed(2)}</text>
    <text x="196" y="174" font-size="14" fill="#3a4470" text-anchor="middle" font-weight="700">b=${W[2].toFixed(2)}</text>
    <text x="330" y="196" font-size="12" fill="#8a93b8" text-anchor="middle">求和 + 激活</text>
    <circle cx="330" cy="128" r="44" fill="#ffe9f5" stroke="#ec4899" stroke-width="4"/>
    <text x="330" y="121" font-size="20" fill="#c44a8f" text-anchor="middle" font-weight="800">Σ</text>
    <text x="330" y="147" font-size="14" fill="#c44a8f" text-anchor="middle" font-weight="800">${sum.toFixed(2)}</text>
    <line x1="374" y1="128" x2="430" y2="128" stroke="#ec4899" stroke-width="4" stroke-linecap="round"/>
    <circle cx="452" cy="128" r="28" fill="#d1fae5" stroke="#34d399" stroke-width="4"/>
    <text x="452" y="121" font-size="15" fill="#177a45" text-anchor="middle" font-weight="800">y</text>
    <text x="452" y="141" font-size="16" fill="#177a45" text-anchor="middle" font-weight="800">${yv}</text>
    <text x="452" y="176" font-size="12" fill="#8a93b8" text-anchor="middle" font-weight="700">输出层</text>
    <text x="330" y="238" font-size="13" fill="#6b7f94" text-anchor="middle">Σ &gt; 0 → 1，否则 → 0（step 激活）</text>
  </svg>`;
  document.getElementById('netViz').innerHTML = html;
  const _h = hot; // keep
}
function renderStatus(){
  document.getElementById('stStep').textContent = stepCount;
  document.getElementById('stEpoch').textContent = epochCount;
  const errNow = TASKS[task].data.reduce((n,[a,b,t])=> n + (predict([a,b])!==t ? 1 : 0), 0);
  document.getElementById('stErr').textContent = errNow;
  const msg = document.getElementById('stMsg');
  if(errNow === 0 && stepCount > 0){ msg.textContent = '🎉 学会啦！'; }
  else if(task === 'XOR' && stepCount > 20 && errNow >= 2){ msg.textContent = '😅 单层学不会 XOR（线性不可分）'; }
  else { msg.textContent = stepCount>0 ? '🤔 还在练习' : '还没开始训练'; }
}
function drawLoss(){
  const c = document.getElementById('lossCanvas');
  const ctx = c.getContext('2d');
  const W = c.width, H = c.height;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = '#f8fafc'; ctx.fillRect(0,0,W,H);
  const padL = 30, padR = 10, padT = 20, padB = 18;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const maxE = Math.max(4, ...errHistory);
  const n = errHistory.length;
  const px = i => n<=1 ? padL + plotW/2 : padL + (i/(n-1))*plotW;
  const py = e => padT + plotH - (e/maxE)*plotH;
  // 网格线
  ctx.strokeStyle = '#eef2f8'; ctx.lineWidth = 1;
  [0,0.5,1].forEach(f=>{ ctx.beginPath(); ctx.moveTo(padL, padT+plotH*f); ctx.lineTo(W-padR, padT+plotH*f); ctx.stroke(); });
  if(n>0){
    // 渐变填充
    ctx.beginPath();
    ctx.moveTo(px(0), py(errHistory[0]));
    for(let i=1;i<n;i++) ctx.lineTo(px(i), py(errHistory[i]));
    ctx.lineTo(px(n-1), padT+plotH);
    ctx.lineTo(px(0), padT+plotH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, padT, 0, padT+plotH);
    grad.addColorStop(0, 'rgba(124,139,255,.30)');
    grad.addColorStop(1, 'rgba(124,139,255,.04)');
    ctx.fillStyle = grad; ctx.fill();
    // 折线
    ctx.beginPath();
    ctx.moveTo(px(0), py(errHistory[0]));
    for(let i=1;i<n;i++) ctx.lineTo(px(i), py(errHistory[i]));
    ctx.strokeStyle = '#7c8bff'; ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
    // 数据点
    errHistory.forEach((e,i)=>{
      ctx.beginPath(); ctx.arc(px(i), py(e), 3.5, 0, Math.PI*2);
      ctx.fillStyle = e===0 ? '#22c55e' : '#7c8bff';
      ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    });
  }
  // 坐标轴 + 标签
  ctx.strokeStyle = '#dbe4f0';
  ctx.beginPath(); ctx.moveTo(padL,padT); ctx.lineTo(padL,padT+plotH); ctx.lineTo(W-padR,padT+plotH); ctx.stroke();
  ctx.fillStyle = '#8a93b8'; ctx.font = '10px sans-serif';
  ctx.fillText('错误数（每轮）', padL, 12);
  ctx.fillText(''+maxE, 6, padT+4);
  ctx.fillText('0', 10, padT+plotH+4);
  ctx.fillText('0 = 学会 ✓', W-70, H-4);
}
function drawDemo(){
  const c = document.getElementById('demoCanvas');
  const ctx = c.getContext('2d');
  const Wd = c.width, H = c.height, pad = 34, S = Wd-2*pad;
  ctx.clearRect(0,0,Wd,H);
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,Wd,H);
  // axes
  ctx.strokeStyle = '#dbe4f0';
  ctx.beginPath(); ctx.moveTo(pad,pad); ctx.lineTo(pad,pad+S); ctx.lineTo(pad+S,pad+S); ctx.stroke();
  ctx.fillStyle = '#8a93b8'; ctx.font='11px sans-serif';
  ctx.fillText('x₁ →', pad+S-34, H-6);
  ctx.fillText('x₂ ↑', 6, pad+12);
  ctx.fillText('0', pad-14, pad+S+4); ctx.fillText('1', pad+S+6, pad+S+4);
  // 决策边界：w1*x1 + w2*x2 + b = 0（把它的方程也显示出来），裁剪到单位方格 [0,1]² 内
  const eps = 1e-9;
  const [w1,w2,b] = W;
  const fmt = v => { const r = Math.round(v*100)/100; return r === 0 ? '0' : String(r); };
  let eq = '';
  const inBox = (x,y)=> x>=-eps && x<=1+eps && y>=-eps && y<=1+eps;
  const cand = [];
  if(Math.abs(w2) > eps){
    const m = -w1/w2, c = -b/w2;               // y = m·x + c
    if(Math.abs(m) <= eps) eq = 'x₂ = ' + fmt(c);
    else if(Math.abs(c) <= eps) eq = 'x₂ = ' + fmt(m) + '·x₁';
    else eq = 'x₂ = ' + fmt(m) + '·x₁' + (c > 0 ? ' + ' : ' − ') + fmt(Math.abs(c));
    if(inBox(0,c)) cand.push([0,c]);
    if(inBox(1,m+c)) cand.push([1,m+c]);
    if(Math.abs(m) > eps){
      if(inBox(-c/m,0)) cand.push([-c/m,0]);    // y=0 交点
      if(inBox((1-c)/m,1)) cand.push([(1-c)/m,1]); // y=1 交点
    }
  } else if(Math.abs(w1) > eps){
    const x = -b/w1;                            // 竖直线 x₁ = -b/w1
    eq = 'x₁ = ' + fmt(x);
    if(inBox(x,0)) cand.push([x,0]);
    if(inBox(x,1)) cand.push([x,1]);
  }
  const seen = new Set(), pts = [];
  cand.forEach(([x,y])=>{
    const k = x.toFixed(4)+','+y.toFixed(4);
    if(!seen.has(k)){ seen.add(k); pts.push([x,y]); }
  });
  if(pts.length >= 2){
    const toX = px => pad + px*S;
    const toY = py => pad + (1-py)*S;
    ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(toX(pts[0][0]), toY(pts[0][1]));
    ctx.lineTo(toX(pts[1][0]), toY(pts[1][1]));
    ctx.stroke();
    const mx=(pts[0][0]+pts[1][0])/2, my=(pts[0][1]+pts[1][1])/2;
    ctx.fillStyle='#3b82f6'; ctx.font='12px sans-serif'; ctx.textAlign='center';
    ctx.fillText('分界线', toX(mx), toY(my)-8);
    if(eq){
      ctx.font='11px sans-serif';
      ctx.fillText(eq, toX(mx), toY(my)+16);
    }
    ctx.textAlign='left';
  } else if(!eq){
    ctx.fillStyle='#a4afc9'; ctx.font='11px sans-serif'; ctx.textAlign='center';
    ctx.fillText('开始训练后，它会画出「分界线」并给出方程', pad+S/2, H-12);
    ctx.textAlign='left';
  }
  // points
  TASKS[task].data.forEach(([a,b,t])=>{
    const px = pad + a*S, py = pad + (1-b)*S;
    ctx.beginPath(); ctx.arc(px,py,11,0,Math.PI*2);
    ctx.fillStyle = t ? '#22c55e' : '#ef4444';
    ctx.fill();
    ctx.lineWidth=3; ctx.strokeStyle='#fff'; ctx.stroke();
    ctx.fillStyle='#fff'; ctx.font='11px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(`${a},${b}`, px, py);
  });
  ctx.textAlign='left';
}
function update(){ renderData(); renderNet(); renderStatus(); drawLoss(); drawDemo(); }

/* ---------- 训练动作 ---------- */
function trainEpoch(){
  const data = TASKS[task].data;
  let err = 0;
  data.forEach(s=>{ const ok = stepOne(s); stepCount++; if(!ok) err++; });
  epochCount++;
  errHistory.push(err);
  update();
  renderTruth();
  if(err===0) toast('🎉 学会啦！这个逻辑对单层感知机很简单');
  else if(task==='XOR') { /* 保持安静 */ }
}
function autoLearn(){
  if(autoTimer) return;
  autoTimer = setInterval(()=>{
    const errNow = TASKS[task].data.reduce((n,[a,b,t])=> n + (predict([a,b])!==t ? 1 : 0), 0);
    if(errNow===0){ clearInterval(autoTimer); autoTimer=null; }
    trainEpoch();
    if(errHistory.length>60){ clearInterval(autoTimer); autoTimer=null; toast('😅 试了 60 轮还是学不会——单层感知机的局限！'); }
  }, 120);
}
function reset(){
  clearInterval(autoTimer); autoTimer=null;
  W = [0,0,0]; stepCount=0; epochCount=0; errHistory=[]; lastX=[0,0];
  update(); renderTruth();
}
function toggleFS(btn){
  const card = btn.closest('.ann-card');
  if(!document.fullscreenElement) card.requestFullscreen ? card.requestFullscreen() : null;
  else document.exitFullscreen();
  setTimeout(update, 300);
}
document.addEventListener('fullscreenchange', ()=> setTimeout(update, 300));

function singleStep(){
  const data = TASKS[task].data;
  const s = data[Math.floor(Math.random()*data.length)];
  stepOne(s); stepCount++;
  update();
  const errNow = TASKS[task].data.reduce((n,[a,b,t])=> n + (predict([a,b])!==t ? 1 : 0), 0);
  if(errNow===0) toast('🎉 这步做对了！');
}

/* 学习法则弹层 */
function openRule(){
  document.getElementById('modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeRule(){
  document.getElementById('modal').classList.remove('open');
  document.body.style.overflow = '';
}
document.getElementById('modal').addEventListener('click', e=>{
  if(e.target === document.getElementById('modal')) closeRule();
});

/* 初始化 */
document.getElementById('lrInput').addEventListener('change', e=>{
  lr = Math.max(0.05, Math.min(1, parseFloat(e.target.value)||0.4));
  e.target.value = lr;
});
document.getElementById('btnTrain').onclick = autoLearn;
document.getElementById('btnStep').onclick = singleStep;
document.getElementById('btnReset').onclick = reset;
document.getElementById('btnRule').onclick = openRule;
renderTasks(); renderTruth(); update();

