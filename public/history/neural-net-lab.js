(function(){

/* ============================================================
   1. 神经网络核心 (8-8-4, sigmoid + MSE)  —— 来自 ANN 调试器
============================================================ */
class NeuralNetwork {
  constructor(inputSize = 8, hiddenSize = 8, outputSize = 4) {
    this.inputSize = inputSize; this.hiddenSize = hiddenSize; this.outputSize = outputSize;
    this.W1 = this.randomMat(hiddenSize, inputSize);
    this.b1 = this.randomVec(hiddenSize);
    this.W2 = this.randomMat(outputSize, hiddenSize);
    this.b2 = this.randomVec(outputSize);
    this.cache = {}; this.grads = {}; this.stepCount = 0; this.loss = null;
  }
  randomMat(rows, cols){ return Array.from({length:rows}, ()=>Array.from({length:cols}, ()=>(Math.random()-0.5)*0.6)); }
  randomVec(n){ return Array.from({length:n}, ()=>(Math.random()-0.5)*0.6); }
  sigmoid(x){ return 1/(1+Math.exp(-x)); }
  sigmoidDeriv(x){ const s=this.sigmoid(x); return s*(1-s); }

  forward(input){
    const x = input.slice();
    const z1 = this.W1.map(row=>{ let s=0; for(let i=0;i<row.length;i++) s+=row[i]*x[i]; return s; });
    for(let i=0;i<z1.length;i++) z1[i]+=this.b1[i];
    const a1 = z1.map(v=>this.sigmoid(v));
    const z2 = this.W2.map(row=>{ let s=0; for(let i=0;i<row.length;i++) s+=row[i]*a1[i]; return s; });
    for(let i=0;i<z2.length;i++) z2[i]+=this.b2[i];
    const a2 = z2.map(v=>this.sigmoid(v));
    this.cache = { x, z1, a1, z2, a2 };
    return a2;
  }
  computeLoss(target){
    const a2 = this.cache.a2; let loss = 0;
    for(let i=0;i<a2.length;i++) loss += 0.5*(a2[i]-target[i])**2;
    this.loss = loss; return loss;
  }
  backward(target){
    const { x, z1, a1, z2, a2 } = this.cache;
    const dz2 = a2.map((a,i)=>(a-target[i])*this.sigmoidDeriv(z2[i]));
    const dw2 = dz2.map(d=>a1.map(a=>d*a));
    const db2 = dz2.slice();
    const dz1 = Array(z1.length).fill(0);
    for(let j=0;j<z1.length;j++){
      let s=0; for(let k=0;k<this.outputSize;k++) s+=dz2[k]*this.W2[k][j];
      dz1[j] = s*this.sigmoidDeriv(z1[j]);
    }
    const dw1 = dz1.map(d=>x.map(xv=>d*xv));
    const db1 = dz1.slice();
    this.grads = { dz2, dw2, db2, dz1, dw1, db1 };
    return this.grads;
  }
  update(lr){
    const { dw1, db1, dw2, db2 } = this.grads;
    for(let i=0;i<this.W1.length;i++){
      for(let j=0;j<this.W1[i].length;j++) this.W1[i][j] -= lr*dw1[i][j];
      this.b1[i] -= lr*db1[i];
    }
    for(let i=0;i<this.W2.length;i++){
      for(let j=0;j<this.W2[i].length;j++) this.W2[i][j] -= lr*dw2[i][j];
      this.b2[i] -= lr*db2[i];
    }
    this.stepCount++;
  }
  step(input, target, lr){
    this.forward(input); this.computeLoss(target); this.backward(target); this.update(lr);
    return { loss:this.loss, output:this.cache.a2 };
  }
  predict(input){ return this.forward(input); }
  reset(){
    this.W1=this.randomMat(this.hiddenSize,this.inputSize); this.b1=this.randomVec(this.hiddenSize);
    this.W2=this.randomMat(this.outputSize,this.hiddenSize); this.b2=this.randomVec(this.outputSize);
    this.cache={}; this.grads={}; this.stepCount=0; this.loss=null;
  }
}

/* ============================================================
   2. 数据生成 (100 组)
      一个样本 = 扫地机器人看到的 8 个方向，每个方向有垃圾(1)或没有(0)
      三种情况都会出现：① 一个方向有垃圾  ② 多个方向有垃圾  ③ 没有垃圾
============================================================ */
const ACTION_MAP = { '上':[1,0,0,0], '左':[0,1,0,0], '下':[0,0,1,0], '右':[0,0,0,1] };
// 8 个方向 → 归属的 4 个移动方向（斜角同时算给相邻两个方向）
const DIR_GROUPS = { '上':[0,1,2], '左':[0,3,5], '下':[5,6,7], '右':[2,4,7] };
// 平手优先级：先水平（左/右）再垂直（上/下）——和「对角线优先水平」一致
const PRIORITY = ['左','右','上','下'];

// 根据 8 方向输入算出该往哪走（上/左/下/右）
function buildTarget(inp){
  let best = '上', bestScore = -1;
  for(const g of PRIORITY){
    let sc = 0; for(const i of DIR_GROUPS[g]) sc += inp[i];
    if(sc > bestScore){ bestScore = sc; best = g; }
  }
  if(bestScore === 0) return '上';   // 8 个方向都没有垃圾 → 往上走继续找
  return best;
}

// 核心生成器：mix 控制「没有垃圾 / 一个垃圾 / 多个垃圾」的比例
function generateDataSet(n = 100, mix = {}){
  const p0 = mix.noFoodP !== undefined ? mix.noFoodP : 0.20;   // 没有垃圾
  const p1 = mix.oneFoodP !== undefined ? mix.oneFoodP : 0.35; // 只有一个垃圾
  const data = []; let attempts = 0;
  while(data.length < n && attempts < 10000){
    attempts++;
    const r = Math.random();
    let nFood;
    if(r < p0) nFood = 0;
    else if(r < p0 + p1) nFood = 1;
    else nFood = 2 + Math.floor(Math.random()*2);   // 2~3 个垃圾
    const inp = Array(8).fill(0);
    const dirs = []; let guard = 0;
    while(dirs.length < nFood && guard++ < 20){
      const d = Math.floor(Math.random()*8);
      if(!dirs.includes(d)) dirs.push(d);
    }
    for(const d of dirs) inp[d] = 1;
    const action = buildTarget(inp);
    data.push({ input:inp, target:ACTION_MAP[action], action, nFood });
  }
  return data;
}

function generateData(n = 100){ return generateDataSet(n, { noFoodP:0.20, oneFoodP:0.35 }); }
function generateTestData(n = 100){ return generateDataSet(n, { noFoodP:0.30, oneFoodP:0.30 }); }

/* ============================================================
   3. 应用状态
============================================================ */
const app = { nn: new NeuralNetwork(8,8,4), data: [], testData: [], currentIdx: 0 };
Object.defineProperty(app, 'currentSample', { get(){ return this.data[this.currentIdx] || null; } });
Object.defineProperty(app, 'currentInput', { get(){ return this.currentSample ? this.currentSample.input : null; } });
Object.defineProperty(app, 'currentTarget', { get(){ return this.currentSample ? this.currentSample.target : null; } });

// 固定种子，数据可复现
(function seedRandom(){
  let s = 42;
  const orig = Math.random;
  Math.random = function(){ s=(s*9301+49297)%233280; return s/233280; };
  app.data = generateData(100);
  Math.random = orig;
})();
// 测试集：不同种子 + 不同抽样分布，保证与训练集明显不同（网络没见过的新样本）
(function seedTestRandom(){
  let s = 2024;
  const orig = Math.random;
  Math.random = function(){ s=(s*9301+49297)%233280; return s/233280; };
  app.testData = generateTestData(100);
  Math.random = orig;
})();

const DIR_LABELS = ['左上','上','右上','左','右','左下','下','右下'];
const ACTION_LABELS = ['上','左','下','右'];
const MOVES = [[0,-1],[-1,0],[0,1],[1,0]];   // 上、左、下、右
const SENSE8 = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];

/* ============================================================
   4. UI 渲染
============================================================ */
function renderNetViz(){
  const el = document.getElementById('netViz');
  if(!el) return;
  const nn = app.nn, cache = nn.cache;
  const NIN=8, NH=8, NOUT=4, r=14;
  const xIn=64, xHid=270, xOut=510, xTgt=596;
  const yIn = i=> 38 + i*52;
  const yHid = j=> 38 + j*52;
  const yOut = k=> 78 + k*70;
  const W=640, H=470;
  // 线宽 = |权重| 归一化；红=正值，蓝=负值
  let maxAbs = 1e-6;
  for(const v of nn.W1.flat()) if(Math.abs(v)>maxAbs) maxAbs=Math.abs(v);
  for(const v of nn.W2.flat()) if(Math.abs(v)>maxAbs) maxAbs=Math.abs(v);
  const thickness = v => Math.max(0.5, Math.abs(v)/maxAbs*6);
  const color = v => v>=0 ? '#ef4444' : '#3b82f6';
  let s = `<svg viewBox="0 0 ${W} ${H}">`;
  // 连线 W1（隐藏层 × 输入层）
  for(let j=0;j<NH;j++) for(let i=0;i<NIN;i++){
    const v = nn.W1[j][i];
    s += `<line x1="${xIn+r}" y1="${yIn(i)}" x2="${xHid-r}" y2="${yHid(j)}" stroke="${color(v)}" stroke-width="${thickness(v).toFixed(2)}" opacity="0.7"/>`;
  }
  // 连线 W2（输出层 × 隐藏层）
  for(let k=0;k<NOUT;k++) for(let j=0;j<NH;j++){
    const v = nn.W2[k][j];
    s += `<line x1="${xHid+r}" y1="${yHid(j)}" x2="${xOut-r}" y2="${yOut(k)}" stroke="${color(v)}" stroke-width="${thickness(v).toFixed(2)}" opacity="0.7"/>`;
  }
  // 输入层节点（右侧显示输入值）
  for(let i=0;i<NIN;i++){
    const hot = !!(cache && cache.x && cache.x[i]);
    const val = cache && cache.x ? cache.x[i] : 0;
    s += `<circle cx="${xIn}" cy="${yIn(i)}" r="${r}" fill="${hot?'#5a6bff':'#fff'}" stroke="#7c8bff" stroke-width="2"/>`;
    s += `<text x="${xIn+r+6}" y="${yIn(i)+5}" font-size="12" fill="#3a4470">${val}</text>`;
  }
  // 隐藏层节点（右侧显示激活值 a1）
  for(let j=0;j<NH;j++){
    const a = cache && cache.a1 ? cache.a1[j] : null;
    const hot = a!==null && a>0.5;
    const val = a!==null ? a.toFixed(2) : '·';
    s += `<circle cx="${xHid}" cy="${yHid(j)}" r="${r}" fill="${hot?'#34d399':'#fff'}" stroke="#34d399" stroke-width="2"/>`;
    s += `<text x="${xHid+r+6}" y="${yHid(j)+5}" font-size="12" fill="#3a4470">${val}</text>`;
  }
  // 输出层节点（动作名在圆内，右侧显示输出值 a2）
  const acts = ['上','左','下','右'];
  for(let k=0;k<NOUT;k++){
    const a = cache && cache.a2 ? cache.a2[k] : null;
    const hot = a!==null && a>0.5;
    const val = a!==null ? a.toFixed(2) : '·';
    s += `<circle cx="${xOut}" cy="${yOut(k)}" r="${r}" fill="${hot?'#ec4899':'#fff'}" stroke="#ec4899" stroke-width="2"/>`;
    s += `<text x="${xOut}" y="${yOut(k)+5}" font-size="12" font-weight="700" fill="#c44a8f" text-anchor="middle">${acts[k]}</text>`;
    s += `<text x="${xOut+r+6}" y="${yOut(k)+5}" font-size="12" fill="#3a4470">${val}</text>`;
  }
  // 目标列（最右：显示当前样本的目标 one-hot，1 亮起）
  const tgt = app.currentSample ? app.currentSample.target : null;
  for(let k=0;k<NOUT;k++){
    const t = tgt ? tgt[k] : null;
    const hot = t===1;
    s += `<circle cx="${xTgt}" cy="${yOut(k)}" r="${r}" fill="${hot?'#f59e0b':'#fff'}" stroke="#f59e0b" stroke-width="2"/>`;
    s += `<text x="${xTgt}" y="${yOut(k)+5}" font-size="12" font-weight="700" fill="${hot?'#fff':'#b45309'}" text-anchor="middle">${t!==null?t:'·'}</text>`;
  }
  // 层标签
  s += `<text x="${xIn}" y="20" font-size="13" font-weight="800" fill="#2f4a8a" text-anchor="middle">输入层</text>`;
  s += `<text x="${xHid}" y="20" font-size="13" font-weight="800" fill="#2f4a8a" text-anchor="middle">隐藏层</text>`;
  s += `<text x="${xOut}" y="20" font-size="13" font-weight="800" fill="#2f4a8a" text-anchor="middle">输出层</text>`;
  s += `<text x="${xTgt}" y="20" font-size="13" font-weight="800" fill="#b45309" text-anchor="middle">目标</text>`;
  s += `</svg>`;
  el.innerHTML = s;
}
function renderDataPanel(){
  const panel = document.getElementById('dataPanel');
  const sample = app.currentSample;
  if(!sample){ panel.innerHTML='<div class="muted">没有数据</div>'; return; }
  const nn = app.nn, cache = nn.cache, grads = nn.grads;
  let h = '';
  if(cache.z1){
    h += `<div class="data-row"><span class="label">🧩 隐藏 z1</span><span class="value">[ ${cache.z1.map(v=>v.toFixed(4)).join(' ')} ]</span></div>`;
    h += `<div class="data-row"><span class="label">🧩 隐藏 a1</span><span class="value">[ ${cache.a1.map(v=>v.toFixed(4)).join(' ')} ]</span></div>`;
  }
  if(cache.z2) h += `<div class="data-row"><span class="label">🧩 输出 z2</span><span class="value">[ ${cache.z2.map(v=>v.toFixed(4)).join(' ')} ]</span></div>`;
  if(grads.dz2){
    h += `<div class="data-row" style="border-top:2px solid #e6edf4;padding-top:8px;margin-top:4px;"><span class="label fw">📐 梯度</span><span></span></div>`;
    h += `<div class="data-row"><span class="label">dz2</span><span class="value">[ ${grads.dz2.map(v=>v.toFixed(5)).join(' ')} ]</span></div>`;
    h += `<div class="data-row"><span class="label">dz1</span><span class="value">[ ${grads.dz1.map(v=>v.toFixed(5)).join(' ')} ]</span></div>`;
    const n1 = Math.sqrt(grads.dw1.flat().reduce((s,v)=>s+v*v,0)).toFixed(6);
    const n2 = Math.sqrt(grads.dw2.flat().reduce((s,v)=>s+v*v,0)).toFixed(6);
    h += `<div class="data-row"><span class="label">‖∇W1‖</span><span class="value">${n1}</span></div>`;
    h += `<div class="data-row"><span class="label">‖∇W2‖</span><span class="value">${n2}</span></div>`;
  }
  h += `<div class="data-row" style="border-top:2px solid #e6edf4;padding-top:8px;margin-top:4px;"><span class="label fw">⚖️ 权重</span><span></span></div>`;
  h += `<div class="data-row"><span class="label">W1</span><span class="value" style="font-size:11px;">[ ${nn.W1[0].map(v=>v.toFixed(3)).join(' ')} ]…</span></div>`;
  h += `<div class="data-row"><span class="label">W2</span><span class="value" style="font-size:11px;">[ ${nn.W2[0].map(v=>v.toFixed(3)).join(' ')} ]…</span></div>`;
  h += `<div class="data-row"><span class="label">b1</span><span class="value" style="font-size:11px;">[ ${nn.b1.map(v=>v.toFixed(3)).join(' ')} ]</span></div>`;
  h += `<div class="data-row"><span class="label">b2</span><span class="value" style="font-size:11px;">[ ${nn.b2.map(v=>v.toFixed(3)).join(' ')} ]</span></div>`;
  panel.innerHTML = h;
  document.getElementById('dataPanelBadge').textContent = `样本 #${app.currentIdx} · 步数 ${app.nn.stepCount}`;
  renderDataList();
  renderMini9();
}
function updateStatus(msg, loss, step){
  document.getElementById('statusText').textContent = msg || app.status;
  if(loss!==undefined) document.getElementById('lossDisplay').textContent = (loss!==null&&loss!=='—')?loss.toFixed(6):'—';
  if(step!==undefined) document.getElementById('stepDisplay').textContent = step;
}
// 8 方向九宫格（左侧顶部：8 个方向放垃圾，中间放扫地机器人）
function renderMini9(inpOverride){
  const el = document.getElementById('mini9');
  if(!el) return;
  const inp = inpOverride || (app.currentSample ? app.currentSample.input : [0,0,0,0,0,0,0,0]);
  // 标题动态显示当前看到了几个垃圾
  const title = document.querySelector('.mini9-wrap .panel-title');
  if(title){
    const cnt = inp.filter(Boolean).length;
    title.textContent = cnt===0 ? '🧭 视野 · 没有垃圾' : `🧭 视野 · 看到 ${cnt} 个垃圾 🧹`;
  }
  // 网络输出：argmax → 预测方向（上0/左1/下2/右3）
  let pred = null;
  try{
    const a2 = app.nn.predict(inp);
    let mi = 0; for(let k=1;k<a2.length;k++) if(a2[k]>a2[mi]) mi=k;
    pred = mi;
  }catch(e){}
  const ARROWS = ['↑','←','↓','→'];
  const labels = ['左上','上','右上','左','','右','左下','下','右下']; // 8 方向标签 → 文字
  const map = [0,1,2,3,-1,4,5,6,7]; // 3x3 格子位置 -> 输入索引（-1=中心）
  el.innerHTML = map.map((idx,pos)=>{
    if(idx===-1){
      const arrow = pred!==null ? ARROWS[pred] : '·';
      return `<div class="m9 center" style="flex-direction:column;gap:1px;">
        <span style="font-size:14px;line-height:1;">🤖</span>
        <span style="font-size:20px;font-weight:800;color:#1d9e5c;line-height:1.15;">${arrow}</span>
      </div>`;
    }
    const has = inp[idx]===1;
    return `<div class="m9 ${has?'food':'empty'}">${has?'🧹':''}<span class="tag">${labels[pos]}</span></div>`;
  }).join('');
}

// 训练数据集列表（左侧，列出全部样本，点击加载）
function renderDataList(){  const el = document.getElementById('dataList');
  if(!el) return;
  el.innerHTML = app.data.map((d,i)=>{
    return `<div class="dl-row${i===app.currentIdx?' active':''}" data-i="${i}">
      <span class="dl-idx">#${i}</span>
      <span class="dl-in">[${d.input.join('')}]</span>
      <span class="dl-out">→ ${d.action}</span>
    </div>`;
  }).join('');
  el.querySelectorAll('.dl-row').forEach(r=>{
    r.onclick = ()=>{ loadSample(+r.dataset.i); };
  });
}
function scrollDataListToActive(){
  const row = document.querySelector('#dataList .dl-row.active');
  if(row) row.scrollIntoView({ block:'nearest' });
}

// 测试数据集列表（左侧下方，点击加载到网络里看看）
function renderTestList(){
  const el = document.getElementById('testList');
  if(!el) return;
  el.innerHTML = app.testData.map((d,i)=>{
    return `<div class="dl-row" data-i="${i}">
      <span class="dl-idx">#${i}</span>
      <span class="dl-in">[${d.input.join('')}]</span>
      <span class="dl-out">→ ${d.action}</span>
    </div>`;
  }).join('');
  el.querySelectorAll('.dl-row').forEach(r=>{
    r.onclick = ()=>{
      const i = +r.dataset.i;
      const s = app.testData[i];
      app.nn.forward(s.input); app.nn.computeLoss(s.target);
      el.querySelectorAll('.dl-row').forEach(x=>x.classList.remove('active'));
      r.classList.add('active');
      renderNetViz();
      renderMini9(s.input);
      updateStatus(`测试样本 #${i}（未参与训练）`, app.nn.loss, app.nn.stepCount);
    };
  });
}

function refreshUI(msg, loss, step){
  renderDataPanel(); updateStatus(msg, loss, step); renderNetViz();
}

/* ============================================================
   5. 可视化训练（新增）：整段训练动画 + 损失曲线
============================================================ */
const trainBtn = document.getElementById('btnTrain');
let training = false;
const EPOCHS = 150;

function drawLossCurve(losses, tests){
  const canvas = document.getElementById('lossCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = '#f8fafc'; ctx.fillRect(0,0,W,H);
  let maxLoss = 0.6;
  for(const l of losses) if(l>maxLoss) maxLoss=l;
  if(tests) for(const l of tests) if(l>maxLoss) maxLoss=l;
  maxLoss = Math.max(maxLoss, 0.01);
  const padL=34,padR=10,padT=10,padB=22, plotW=W-padL-padR, plotH=H-padT-padB;
  // 网格
  ctx.strokeStyle='#e6edf4'; ctx.lineWidth=1;
  for(let i=0;i<=4;i++){ const y=padT+(plotH/4)*i; ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+plotW,y); ctx.stroke(); }
  // 轴
  ctx.strokeStyle='#d1d9e6';
  ctx.beginPath(); ctx.moveTo(padL,padT); ctx.lineTo(padL,padT+plotH); ctx.lineTo(padL+plotW,padT+plotH); ctx.stroke();
  // 图例
  ctx.font='10px sans-serif';
  ctx.textAlign='left';
  ctx.fillStyle='#5a6bff'; ctx.fillText('— 训练集', padL+4, 12);
  if(tests){ ctx.fillStyle='#f59e0b'; ctx.fillText('— 测试集', padL+4, 24); }
  ctx.fillStyle='#6b7f94'; ctx.textAlign='right';
  ctx.fillText(maxLoss.toFixed(2), padL-4, padT+4); ctx.fillText('0', padL-4, padT+plotH);
  ctx.textAlign='left'; ctx.fillText('训练 epoch →', padL+4, padT+plotH+14);
  const plot = (arr, color, fillColor)=>{
    if(!arr || arr.length<=1) return;
    ctx.beginPath();
    ctx.moveTo(padL, padT+plotH-(arr[0]/maxLoss)*plotH);
    for(let i=1;i<arr.length;i++) ctx.lineTo(padL+(i/(EPOCHS-1))*plotW, padT+plotH-(arr[i]/maxLoss)*plotH);
    ctx.lineTo(padL+((arr.length-1)/(EPOCHS-1))*plotW, padT+plotH);
    ctx.lineTo(padL, padT+plotH);
    ctx.closePath();
    ctx.fillStyle = fillColor; ctx.fill();
    ctx.strokeStyle=color; ctx.lineWidth=2.5; ctx.beginPath();
    for(let i=0;i<arr.length;i++){
      const x=padL+(i/(EPOCHS-1))*plotW;
      const y=padT+plotH-(arr[i]/maxLoss)*plotH;
      i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    }
    ctx.stroke();
    const last=arr[arr.length-1];
    const lx=padL+((arr.length-1)/(EPOCHS-1))*plotW;
    const ly=padT+plotH-(last/maxLoss)*plotH;
    ctx.fillStyle=color; ctx.beginPath(); ctx.arc(lx,ly,4,0,Math.PI*2); ctx.fill();
  };
  plot(losses, '#5a6bff', 'rgba(124,139,255,.12)');
  if(tests) plot(tests, '#f59e0b', 'rgba(245,158,11,.10)');
}
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function shuffleData(a){ for(let i=a.length-1;i>0;i--){ const r=Math.floor(Math.random()*(i+1)); [a[i],a[r]]=[a[r],a[i]]; } }

async function visualTrain(){
  if(training) return;
  training = true; trainBtn.disabled = true;
  const lr = parseFloat(document.getElementById('lrInput').value) || 0.5;
  const losses = [], tests = [];
  app.nn.reset();
  document.getElementById('epochDisplay').textContent = '0';
  drawLossCurve([0.6], null);
  updateStatus('训练开始…', null, app.nn.stepCount);

  for(let e=1; e<=EPOCHS; e++){
    shuffleData(app.data);
    let total = 0;
    for(const s of app.data){ app.nn.step(s.input, s.target, lr); total += app.nn.loss; }
    const avg = total / app.data.length;
    losses.push(avg);
    // 每个 epoch 在「没见过的测试集」上算一次平均损失
    let ttotal = 0;
    for(const ts of app.testData){ app.nn.forward(ts.input); app.nn.computeLoss(ts.target); ttotal += app.nn.loss; }
    tests.push(ttotal / app.testData.length);
    document.getElementById('epochDisplay').textContent = e;
    // 随机挑一个样本做前向，展示神经元点亮 + 数据面板（输入/目标/输出保持一致）
    const idx = Math.floor(Math.random()*app.data.length);
    app.currentIdx = idx;
    const s = app.data[idx];
    app.nn.forward(s.input); app.nn.computeLoss(s.target);
    renderDataPanel(); renderNetViz();
    drawLossCurve(losses, tests);
    updateStatus(`训练中 epoch ${e}/${EPOCHS}`, avg, app.nn.stepCount);
    await sleep(14);
  }
  training = false; trainBtn.disabled = false;
  updateStatus('✅ 训练完成', app.nn.loss, app.nn.stepCount);
}
trainBtn.onclick = visualTrain;

/* ============================================================
   6. 单步调试控制（前向 / 反向 / 更新 / 单步 / 多步 / 重置）
============================================================ */
function loadSample(idx){
  idx = Math.min(Math.max(0,idx), app.data.length-1);
  app.currentIdx = idx;
  const s = app.currentSample;
  if(s){ app.nn.forward(s.input); app.nn.computeLoss(s.target); refreshUI(`已加载样本 #${idx}`, app.nn.loss, app.nn.stepCount); }
}
document.getElementById('btnStep').onclick = ()=>{
  const lr=parseFloat(document.getElementById('lrInput').value)||0.5;
  // 1. 在训练数据集中随机取一条数据
  const idx = Math.floor(Math.random()*app.data.length);
  app.currentIdx = idx;
  const s = app.currentSample;
  if(!s) return;
  // 2. 设置到 8 方向感知（九宫格）
  renderMini9();
  // 3. 前向计算 + 4. 反向计算（并更新权重，完成一步学习）
  app.nn.step(s.input, s.target, lr);
  // 5. 更新神经网络图像 + 6. 更新右侧相关数据
  renderDataList();
  scrollDataListToActive();
  refreshUI(`单步 #${idx} (η=${lr})`, app.nn.loss, app.nn.stepCount);
};
document.getElementById('btnReset').onclick = ()=>{
  app.nn.reset();
  const s=app.currentSample;
  if(s){ app.nn.forward(s.input); app.nn.computeLoss(s.target); }
  drawLossCurve([], null);
  document.getElementById('epochDisplay').textContent='0';
  refreshUI('网络已重置', app.nn.loss, app.nn.stepCount);
};
/* ============================================================
   7. 互动演示：10×10 地图，扫地机器人用网络找垃圾
============================================================ */
const N = 10;
let grid = [], bx=0, by=0, score=0, steps=0;
const gridEl=document.getElementById('grid');
function valid(x,y){ return x>=0&&x<N&&y>=0&&y<N; }
function resetMap(){
  grid = Array.from({length:N},()=>Array(N).fill(0));
  let placed=0;
  const FOOD_TOTAL = Math.floor(N*N*0.5); // 垃圾数量 = 格子总数的 50%
  while(placed<FOOD_TOTAL){ const x=Math.floor(Math.random()*N), y=Math.floor(Math.random()*N);
    if(grid[y][x]===0){ grid[y][x]=1; placed++; } }
  do{ bx=Math.floor(Math.random()*N); by=Math.floor(Math.random()*N); }while(grid[by][bx]===1);
  score=0; steps=0; renderMap();
}
function sense(){
  return SENSE8.map(([dx,dy])=>{ const nx=bx+dx,ny=by+dy; return (valid(nx,ny)&&grid[ny][nx]===1)?1:0; });
}
function renderMap(){
  gridEl.innerHTML='';
  for(let y=0;y<N;y++) for(let x=0;x<N;x++){
    const c=document.createElement('div'); c.className='cell';
    if(grid[y][x]===1) c.classList.add('food');
    if(x===bx&&y===by) c.classList.add('bact');
    if(SENSE8.some(([dx,dy])=>x===bx+dx&&y===by+dy)) c.classList.add('seen');
    gridEl.appendChild(c);
  }
  document.getElementById('statScore').textContent=score;
  document.getElementById('statSteps').textContent=steps;
}
function move(){
  const inp=sense();
  const p=app.nn.predict(inp);
  const order=[0,1,2,3].sort((a,b)=>p[b]-p[a]);
  for(const mi of order){ const [dx,dy]=MOVES[mi]; const nx=bx+dx,ny=by+dy;
    if(valid(nx,ny)){ bx=nx; by=ny; break; } }
  if(grid[by][bx]===1){ grid[by][bx]=0; score++; }
  steps++; renderMap();
}
document.getElementById('stepBtn').onclick = move;
document.getElementById('resetBtn').onclick = resetMap;
let running=false;
document.getElementById('runBtn').onclick = ()=>{
  if(running){ running=false; document.getElementById('runBtn').textContent='▶️ 连续走'; return; }
  running=true; document.getElementById('runBtn').textContent='⏸ 暂停';
  (async function loop(){
    while(running){
      move();
      if(score>=12){ running=false; document.getElementById('runBtn').textContent='▶️ 连续走'; alert('🎉 全部 12 处垃圾都扫干净啦！'); break; }
      await sleep(120);
    }
  })();
};

/* ============================================================
   7.5 全屏切换（ANN 训练器）
============================================================ */
const annCard = document.getElementById('annCard');
const annFsBtn = document.getElementById('annFsBtn');
annFsBtn.onclick = ()=>{
  if(document.fullscreenElement){
    document.exitFullscreen();
  } else if(annCard.requestFullscreen){
    annCard.requestFullscreen().catch(()=>{});
  }
};
document.addEventListener('fullscreenchange', ()=>{
  const on = !!document.fullscreenElement;
  annFsBtn.textContent = on ? '✕' : '⛶';
  annFsBtn.title = on ? '退出全屏' : '全屏';
});

/* ============================================================
   8. 初始化
============================================================ */
/* 实际问题卡片右侧：红色扫地机器人随机移动吃垃圾（独立于神经网络演示） */
const RM_N = 10;
let rmGrid = [], rmx = 0, rmy = 0, rmTimerOn = false;
const rmEl = document.getElementById('randomMap');
function rmInit(){
  rmGrid = Array.from({length:RM_N},()=>Array(RM_N).fill(0));
  let placed = 0;
  const FOOD_TOTAL = Math.floor(RM_N * RM_N * 0.4);   // 垃圾约占地图 40%
  while(placed < FOOD_TOTAL){ const x=Math.floor(Math.random()*RM_N), y=Math.floor(Math.random()*RM_N); if(rmGrid[y][x]===0){ rmGrid[y][x]=1; placed++; } }
  do { rmx=Math.floor(Math.random()*RM_N); rmy=Math.floor(Math.random()*RM_N); } while(rmGrid[rmy][rmx]===1);
  rmRender();
  if(!rmTimerOn){ rmTimerOn=true; setInterval(rmStep, 400); }
}
function rmRender(){
  rmEl.innerHTML = '';
  for(let y=0;y<RM_N;y++) for(let x=0;x<RM_N;x++){
    const c = document.createElement('div'); c.className='cell';
    if(rmGrid[y][x]===1) c.classList.add('food');
    if(x===rmx && y===rmy) c.classList.add('bact-red');
    rmEl.appendChild(c);
  }
}
function rmStep(){
  const dirs = [[0,-1],[0,1],[-1,0],[1,0]];
  const d = dirs[Math.floor(Math.random()*4)];
  const nx = rmx+d[0], ny = rmy+d[1];
  if(nx>=0 && nx<RM_N && ny>=0 && ny<RM_N){ rmx=nx; rmy=ny; }
  if(rmGrid[rmy][rmx]===1){ rmGrid[rmy][rmx]=0; }
  rmRender();
}

function init(){
  renderNetViz(); renderDataList(); renderTestList(); renderMini9();
  app.currentIdx=0;
  const s=app.currentSample;
  if(s){ app.nn.forward(s.input); app.nn.computeLoss(s.target); }
  drawLossCurve([], null);
  refreshUI('就绪', app.nn.loss, app.nn.stepCount);
  resetMap();
  rmInit();
}
init();

})();
