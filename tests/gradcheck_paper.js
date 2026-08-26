// 快速梯度检查：论文原格式模型（T=2, 无「=」）
const { Model } = require('./grokking_scan_paper.js');
const P=5, C=16, nHead=2;
const m = new Model(P, C, nHead);
const a=3, b=2, t=(a+b)%P;
function loss(){ m.forward(a,b); return -Math.log(m.probs[t] + 1e-12); }
m.forward(a,b); const g = m.backward(t);
function numGrad(w, j, eps=1e-5){ const o=w[j]; w[j]=o+eps; const lp=loss(); w[j]=o-eps; const lm=loss(); w[j]=o; return (lp-lm)/(2*eps); }
function picks(len){ return [...new Set([0,1,(len/2)|0,len-1])]; }
function check(name, w, gw){ let mx=0; for(const j of picks(w.length)) mx=Math.max(mx, Math.abs(numGrad(w,j)-gw[j])); const ok=mx<1e-3; console.log(`  ${ok?'✓':'✗'} ${name}  maxErr=${mx.toExponential(2)}`); return ok; }
let allOk=true;
allOk &= check('Ce', m.Ce, g.dCe);
allOk &= check('Pe', m.Pe, g.dPe);
for(let h=0;h<nHead;h++){ allOk &= check(`Wq[${h}]`,m.Wq[h],g.dWq[h]); allOk &= check(`Wk[${h}]`,m.Wk[h],g.dWk[h]); allOk &= check(`Wv[${h}]`,m.Wv[h],g.dWv[h]); }
allOk &= check('Wproj', m.Wproj, g.dWproj);
allOk &= check('W1', m.W1, g.dW1); allOk &= check('b1', m.b1, g.db1);
allOk &= check('W2', m.W2, g.dW2); allOk &= check('b2', m.b2, g.db2);
allOk &= check('Wl', m.Wl, g.dWl); allOk &= check('bl', m.bl, g.dbl);
allOk &= check('ln1g', m.ln1g, g.dln1g); allOk &= check('ln1b', m.ln1b, g.dln1b);
allOk &= check('ln2g', m.ln2g, g.dln2g); allOk &= check('ln2b', m.ln2b, g.dln2b);
console.log(allOk ? '论文模型梯度全部正确 ✅' : '论文模型梯度有错误 ❌');
