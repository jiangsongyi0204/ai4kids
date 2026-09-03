// grokking_scan_mlp.js
// 忠实复刻「方案二」TF.js 模型（用户粘贴的 HTML）：
//   任务：模除法 a/b mod p（b≠0，用暴力求模逆元）
//   模型：多层 Dense MLP（buildTransformer 里全是 Dense，heads 参数未使用）
//   损失：softmax 交叉熵（权重衰减改用 AdamW 解耦，不再加 L2 到损失）
//   优化：AdamW（beta1=0.9, beta2=0.999, eps=1e-7）+ 解耦权重衰减 wd
//   训练：每个 epoch 打乱训练集 → mini-batch（batchSize=512）
// 用 Float64Array 实现，跑在 Node 里，比装 tfjs-node 快得多。

function rand(n, s){ const a=new Float64Array(n); for(let i=0;i<n;i++) a[i]=(Math.random()*2-1)*s; return a; }

class MLP {
  // dims：各层宽度，如 [2p, 128, 128, 128, 256, ..., p]
  constructor(dims){
    this.L = dims.length-1;
    this.dims = dims;
    this.W=[]; this.b=[]; this.z=[]; this.h=[];
    for(let i=0;i<this.L;i++){
      const fin=dims[i], fo=dims[i+1];
      const s=Math.sqrt(6/(fin+fo));   // glorotUniform
      this.W.push(rand(fin*fo, s));
      this.b.push(new Float64Array(fo));
      this.z.push(new Float64Array(fo));
      this.h.push(new Float64Array(fo));
    }
    this.inp=new Float64Array(dims[0]);
    this.probs=new Float64Array(dims[this.L]);
    // 预分配反向缓冲区
    this.dlog=new Float64Array(dims[this.L]);
    this.dz=[]; this.dh=[];
    for(let i=0;i<this.L;i++){ this.dz.push(new Float64Array(dims[i+1])); this.dh.push(new Float64Array(dims[i])); }
  }
  forward(a, b, p){
    const inp=this.inp;
    inp.fill(0); inp[a]=1; inp[p+b]=1;
    let hprev=inp;
    for(let i=0;i<this.L;i++){
      const W=this.W[i], b=this.b[i], z=this.z[i], h=this.h[i];
      const fin=this.dims[i], fo=this.dims[i+1];
      const last = (i===this.L-1);
      for(let o=0;o<fo;o++){
        let s=b[o];
        const off=o;
        for(let j=0;j<fin;j++) s+=hprev[j]*W[j*fo+off];
        z[o]=s;
        if(!last) h[o]=s>0?s:0;   // ReLU
      }
      hprev=h;
    }
    // softmax（数值稳定）
    const z=this.z[this.L-1], fo=this.dims[this.L];
    let m=-Infinity; for(let k=0;k<fo;k++) if(z[k]>m) m=z[k];
    let ssum=0; for(let k=0;k<fo;k++){ const e=Math.exp(z[k]-m); this.probs[k]=e; ssum+=e; }
    for(let k=0;k<fo;k++) this.probs[k]/=ssum;
    return this.probs;
  }
  // 返回该样本的梯度（仅交叉熵，梯度累加到 gW/gb；权重衰减由 AdamW 解耦处理）
  backward(target, gW, gb){
    const L=this.L, foLast=this.dims[L];
    const dlog=this.dlog;
    for(let k=0;k<foLast;k++) dlog[k]=this.probs[k]-(k===target?1:0);
    let dz=dlog;
    for(let i=L-1;i>=0;i--){
      const W=this.W[i], fin=this.dims[i], fo=this.dims[i+1];
      const hprev = (i===0)? this.inp : this.h[i-1];
      const gWi=gW[i], gbi=gb[i];
      for(let j=0;j<fin;j++){
        const hj=hprev[j], off=j*fo;
        for(let o=0;o<fo;o++) gWi[off+o]+=dz[o]*hj;
      }
      for(let o=0;o<fo;o++) gbi[o]+=dz[o];
      if(i>0){
        const dh=this.dh[i];
        const zPrev=this.z[i-1];
        const dzPrev=this.dz[i-1];
        for(let j=0;j<fin;j++){
          let s=0; const off=j*fo;
          for(let o=0;o<fo;o++) s+=W[off+o]*dz[o];
          dh[j]=s;
          dzPrev[j]=dh[j]*(zPrev[j]>0?1:0);
        }
        dz=dzPrev;
      }
    }
  }
}

function makeData(p, frac){
  const all=[];
  for(let a=0;a<p;a++){
    for(let b=1;b<p;b++){
      let inv=0; for(let i=1;i<p;i++){ if((b*i)%p===1){ inv=i; break; } }
      all.push({a,b,y:(a*inv)%p});
    }
  }
  for(let i=all.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; const t=all[i]; all[i]=all[j]; all[j]=t; }
  const n=Math.floor(all.length*frac);
  return { train: all.slice(0,n), val: all.slice(n) };
}

class AdamW {
  constructor(params, lr, wd){ this.lr=lr; this.wd=wd; this.b1=0.9; this.b2=0.999; this.eps=1e-7; this.t=0;
    this.params=params; this.m=params.map(p=>new Float64Array(p.length)); this.v=params.map(p=>new Float64Array(p.length)); }
  step(grads){
    this.t++; const bc1=1-Math.pow(this.b1,this.t), bc2=1-Math.pow(this.b2,this.t);
    for(let i=0;i<this.params.length;i++){
      const p=this.params[i], m=this.m[i], v=this.v[i], g=grads[i];
      for(let j=0;j<p.length;j++){ m[j]=this.b1*m[j]+(1-this.b1)*g[j]; v[j]=this.b2*v[j]+(1-this.b2)*g[j]*g[j];
        p[j]-= this.lr*(m[j]/bc1/(Math.sqrt(v[j]/bc2)+this.eps) + this.wd*p[j]); }
    }
  }
}

function evaluate(model, data, p){
  let loss=0, correct=0;
  for(const s of data){
    const probs=model.forward(s.a,s.b,p);
    loss-=Math.log(probs[s.y]+1e-12);
    let mx=0; for(let k=1;k<p;k++) if(probs[k]>probs[mx]) mx=k;
    if(mx===s.y) correct++;
  }
  return { loss: loss/data.length, acc: correct/data.length };
}

function buildDims(p, dim, depth){
  const d=[2*p, dim];
  for(let i=0;i<depth;i++){ d.push(dim, dim, dim*2, dim); }
  d.push(p);
  return d;
}

if(require.main===module){
  const p=97, frac=0.5, depth=2, dim=128, wd=1.0, lr=1e-3, batchSize=512, epochs=150;
  console.log(`=== 方案二复刻(AdamW)：模除法 p=${p} 50% · depth=${depth} dim=${dim} lr=${lr} wd=${wd} batch=${batchSize} epochs=${epochs} ===`);
  const data=makeData(p, frac);
  console.log(`    训练 ${data.train.length} 对 / 验证 ${data.val.length} 对`);
  const dims=buildDims(p, dim, depth);
  const model=new MLP(dims);
  // 参数列表：W 与 b 交替
  const params=[]; for(let i=0;i<model.L;i++){ params.push(model.W[i]); params.push(model.b[i]); }
  const opt=new AdamW(params, lr, wd);
  const gW=[], gb=[];
  for(let i=0;i<model.L;i++){ gW.push(new Float64Array(model.W[i].length)); gb.push(new Float64Array(model.b[i].length)); }
  const grads=[]; for(let i=0;i<model.L;i++){ grads.push(gW[i]); grads.push(gb[i]); }

  const t0=Date.now();
  const stepsPerEpoch=Math.ceil(data.train.length/batchSize);
  for(let epoch=0; epoch<epochs; epoch++){
    // 打乱
    const sh=[...data.train];
    for(let i=sh.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; const t=sh[i]; sh[i]=sh[j]; sh[j]=t; }
    // mini-batch
    for(let step=0; step<stepsPerEpoch; step++){
      const start=step*batchSize, end=Math.min(start+batchSize, sh.length);
      const bs=end-start;
      // 清零梯度
      for(let i=0;i<model.L;i++){ gW[i].fill(0); gb[i].fill(0); }
      for(let k=start;k<end;k++){
        const s=sh[k];
        model.forward(s.a,s.b,p);
        model.backward(s.y, gW, gb);
      }
      // 平均（对应 tf.grads 对 mean loss 求梯度）
      const inv=1/bs;
      for(let i=0;i<model.L;i++){ const g=gW[i]; for(let j=0;j<g.length;j++) g[j]*=inv; const b=gb[i]; for(let j=0;j<b.length;j++) b[j]*=inv; }
      opt.step(grads);
    }
    if(epoch%5===0 || epoch===epochs-1){
      const tr=evaluate(model, data.train, p), va=evaluate(model, data.val, p);
      const secs=((Date.now()-t0)/1000).toFixed(0);
      console.log(`    [epoch ${epoch+1}] trainLoss=${tr.loss.toFixed(4)} valLoss=${va.loss.toFixed(4)} trainAcc=${(tr.acc*100).toFixed(1)}% valAcc=${(va.acc*100).toFixed(1)}%  (${secs}s)`);
    }
  }
  const tr=evaluate(model, data.train, p), va=evaluate(model, data.val, p);
  console.log(`最终：训练准确率 ${(tr.acc*100).toFixed(2)}% · 验证准确率 ${(va.acc*100).toFixed(2)}% · 耗时 ${((Date.now()-t0)/1000).toFixed(0)}s`);
}
module.exports = { MLP, makeData, buildDims };
