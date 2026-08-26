// 数值梯度检查：验证 grokking_scan_ln.js 里 Model 的前向+反向传播是否正确
// （重点检查新增的 LayerNorm 反向传播）
const { Model } = require('./grokking_scan_ln.js');

const P=5, C=16, nHead=2;
const m = new Model(P, C, nHead);
const a=3, b=2, t=(a+b)%P;

function loss(){
  m.forward(a,b);
  const p = m.probs[t];
  return -Math.log(p + 1e-12);
}

// 解析梯度
m.forward(a,b);
const g = m.backward(t);

function numGrad(w, j, eps=1e-5){
  const o = w[j];
  w[j] = o + eps; const lp = loss();
  w[j] = o - eps; const lm = loss();
  w[j] = o;
  return (lp - lm) / (2*eps);
}

function picks(len){
  return [...new Set([0, 1, (len/2)|0, len-1])];
}

function check(name, w, gw, extra){
  const idx = picks(w.length);
  let maxErr=0, worst='';
  for(const j of idx){
    const ng = numGrad(w, j);
    const ag = gw[j];
    const err = Math.abs(ng - ag);
    if(err > maxErr){ maxErr=err; worst=`[${j}] num=${ng.toFixed(5)} ana=${ag.toFixed(5)}`; }
  }
  const ok = maxErr < 1e-3;
  console.log(`  ${ok?'✓':'✗'} ${name}${extra||''}  maxErr=${maxErr.toExponential(2)}  ${ok?'':worst}`);
  return ok;
}

console.log(`模型 P=${P} C=${C} nHead=${nHead} F=${m.F}，样本 ${a}+${b}=${t}：`);
let allOk = true;
allOk &= check('Ce', m.Ce, g.dCe);
allOk &= check('Pe', m.Pe, g.dPe);
for(let h=0;h<nHead;h++){
  allOk &= check(`Wq[${h}]`, m.Wq[h], g.dWq[h]);
  allOk &= check(`Wk[${h}]`, m.Wk[h], g.dWk[h]);
  allOk &= check(`Wv[${h}]`, m.Wv[h], g.dWv[h]);
}
allOk &= check('Wproj', m.Wproj, g.dWproj);
allOk &= check('W1', m.W1, g.dW1);
allOk &= check('b1', m.b1, g.db1);
allOk &= check('W2', m.W2, g.dW2);
allOk &= check('b2', m.b2, g.db2);
allOk &= check('Wl', m.Wl, g.dWl);
allOk &= check('bl', m.bl, g.dbl);
allOk &= check('ln1g', m.ln1g, g.dln1g);
allOk &= check('ln1b', m.ln1b, g.dln1b);
allOk &= check('ln2g', m.ln2g, g.dln2g);
allOk &= check('ln2b', m.ln2b, g.dln2b);
console.log(allOk ? '\n全部梯度正确 ✅' : '\n存在梯度错误 ❌');
