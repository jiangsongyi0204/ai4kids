// Grokking 顿悟扫描（优化版）：等价于页面 grokking.html 的模型
// 用 Float64Array 扁平化 + 预分配缓冲区，比嵌套数组快数倍。
// 结构：[a, b, =] 双向注意力 + FFN + softmax(P)，full-batch AdamW + WD。

function rand(n, s){ const a=new Float64Array(n); for(let i=0;i<n;i++) a[i]=(Math.random()*2-1)*s; return a; }
function zeros(n){ return new Float64Array(n); }

class Model {
  constructor(P, C=128, nHead=2, scale=0.5){
    this.P=P; this.V=P; this.Vocab=P+1; this.T=3; this.EQ=P;
    this.C=C; this.nHead=nHead; this.H=(C/nHead)|0;
    const Vb=this.Vocab, T=this.T, H=this.H;
    this.Ce=rand(Vb*C,scale); this.Pe=rand(T*C,scale);
    this.Wq=Array.from({length:nHead},()=>rand(H*H,scale));
    this.Wk=Array.from({length:nHead},()=>rand(H*H,scale));
    this.Wv=Array.from({length:nHead},()=>rand(H*H,scale));
    this.Wproj=rand(C*C,scale);
    this.W1=rand(C*C,scale); this.b1=rand(C,scale);
    this.W2=rand(C*C,scale); this.b2=rand(C,scale);
    this.Wl=rand(P*C,scale); this.bl=rand(P,scale);
    // 预分配缓冲区
    this.x=zeros(T*C); this.attConcat=zeros(T*C); this.proj=zeros(T*C); this.x2=zeros(T*C);
    this.z1=zeros(T*C); this.h1=zeros(T*C); this.z2=zeros(T*C); this.out=zeros(T*C);
    this.logits=zeros(P); this.probs=zeros(P);
    this.heads=Array.from({length:nHead},()=>({q:zeros(T*H),k:zeros(T*H),v:zeros(T*H),wei:zeros(T*T),att:zeros(T*H)}));
    this.cacheIdx=null;
  }
  scale(){ return 1/Math.sqrt(this.H); }
  softmax(src, n, dst){ let m=-1e9; for(let i=0;i<n;i++) if(src[i]>m)m=src[i]; let s=0;
    for(let i=0;i<n;i++){ const e=Math.exp(src[i]-m); dst[i]=e; s+=e; } for(let i=0;i<n;i++) dst[i]/=s; }
  softmaxAt(w, t){ const T=this.T; let m=-1e9; for(let s=0;s<T;s++){ const v=w[t*T+s]; if(v>m)m=v; }
    let sum=0; for(let s=0;s<T;s++){ const e=Math.exp(w[t*T+s]-m); w[t*T+s]=e; sum+=e; }
    for(let s=0;s<T;s++) w[t*T+s]/=sum; }
  forward(a,b){
    const T=this.T,C=this.C,P=this.P,H=this.H,nHead=this.nHead;
    const idx=[a,b,this.EQ];
    for(let t=0;t<T;t++){ const off=t*C, ci=idx[t]*C, pi=t*C; for(let c=0;c<C;c++) this.x[off+c]=this.Ce[ci+c]+this.Pe[pi+c]; }
    const scale=1/Math.sqrt(H);
    for(let h=0;h<nHead;h++){
      const head=this.heads[h], off=h*H, Wq=this.Wq[h], Wk=this.Wk[h], Wv=this.Wv[h];
      for(let t=0;t<T;t++){ const xo=t*C+off, qo=t*H;
        for(let o=0;o<H;o++){ let sq=0,sk=0,sv=0;
          for(let i=0;i<H;i++){ const xv=this.x[xo+i]; sq+=xv*Wq[i*H+o]; sk+=xv*Wk[i*H+o]; sv+=xv*Wv[i*H+o]; }
          head.q[qo+o]=sq; head.k[qo+o]=sk; head.v[qo+o]=sv; } }
      for(let t=0;t<T;t++){ const wo=t*T;
        for(let s=0;s<T;s++){ let d=0; for(let i=0;i<H;i++) d+=head.q[t*H+i]*head.k[s*H+i]; head.wei[wo+s]=d*scale; } }
      for(let t=0;t<T;t++) this.softmaxAt(head.wei, t);
      for(let t=0;t<T;t++){ const ao=t*H;
        for(let i=0;i<H;i++){ let s=0; for(let s2=0;s2<T;s2++) s+=head.wei[t*T+s2]*head.v[s2*H+i]; head.att[ao+i]=s; } }
      for(let t=0;t<T;t++) for(let i=0;i<H;i++) this.attConcat[t*C+off+i]=head.att[t*H+i];
    }
    for(let t=0;t<T;t++){ const xo=t*C;
      for(let o=0;o<C;o++){ let s=0; for(let i=0;i<C;i++) s+=this.attConcat[xo+i]*this.Wproj[i*C+o]; this.proj[xo+o]=s; }
      for(let i=0;i<C;i++) this.x2[xo+i]=this.x[xo+i]+this.proj[xo+i]; }
    for(let t=0;t<T;t++){ const xo=t*C;
      for(let o=0;o<C;o++){ let s=this.b1[o]; for(let i=0;i<C;i++) s+=this.x2[xo+i]*this.W1[i*C+o]; this.z1[xo+o]=s; }
      for(let i=0;i<C;i++) this.h1[xo+i]=Math.max(0,this.z1[xo+i]);
      for(let o=0;o<C;o++){ let s=this.b2[o]; for(let i=0;i<C;i++) s+=this.h1[xo+i]*this.W2[i*C+o]; this.z2[xo+o]=s; }
      for(let i=0;i<C;i++) this.out[xo+i]=this.x2[xo+i]+this.z2[xo+i]; }
    const lo=(T-1)*C;
    for(let k=0;k<P;k++){ let s=this.bl[k]; const wl=k*C; for(let i=0;i<C;i++) s+=this.out[lo+i]*this.Wl[wl+i]; this.logits[k]=s; }
    this.softmax(this.logits, P, this.probs);
    this.cacheIdx=[a,b,this.EQ];
    return this.probs;
  }
  backward(target){
    const T=this.T,C=this.C,P=this.P,H=this.H,nHead=this.nHead,Vb=this.Vocab;
    const g={ dCe:zeros(Vb*C), dPe:zeros(T*C),
      dWk:Array.from({length:nHead},()=>zeros(H*H)), dWq:Array.from({length:nHead},()=>zeros(H*H)),
      dWv:Array.from({length:nHead},()=>zeros(H*H)), dWproj:zeros(C*C),
      dW1:zeros(C*C), db1:zeros(C), dW2:zeros(C*C), db2:zeros(C), dWl:zeros(P*C), dbl:zeros(P) };
    const dlast=zeros(P), dout=zeros(T*C), dx2=zeros(T*C), dz2=zeros(T*C),
          dh1=zeros(T*C), dz1=zeros(T*C), dx=zeros(T*C), dproj=zeros(T*C), datt=zeros(T*C);
    for(let k=0;k<P;k++) dlast[k]= (k===target ? this.probs[k]-1 : this.probs[k]);
    const lo=(T-1)*C;
    for(let k=0;k<P;k++){ const wl=k*C; for(let i=0;i<C;i++) g.dWl[wl+i]+=dlast[k]*this.out[lo+i]; g.dbl[k]+=dlast[k]; }
    for(let i=0;i<C;i++){ let s=0; for(let k=0;k<P;k++) s+=dlast[k]*this.Wl[k*C+i]; dout[lo+i]=s; }
    for(let i=0;i<C;i++){ dx2[lo+i]+=dout[lo+i]; dz2[lo+i]+=dout[lo+i]; }
    for(let j=0;j<C;j++){ let s=0; for(let i=0;i<C;i++) s+=dz2[lo+i]*this.W2[j*C+i]; dh1[lo+j]=s; }
    for(let j=0;j<C;j++){ const w2=j*C; for(let i=0;i<C;i++) g.dW2[w2+i]+=dz2[lo+i]*this.h1[lo+j]; g.db2[j]+=dz2[lo+j]; }
    for(let j=0;j<C;j++) dz1[lo+j]=dh1[lo+j]*(this.z1[lo+j]>0?1:0);
    for(let i=0;i<C;i++){ let s=0; for(let j=0;j<C;j++) s+=dz1[lo+j]*this.W1[i*C+j]; dx2[lo+i]+=s; }
    for(let j=0;j<C;j++){ for(let i=0;i<C;i++) g.dW1[i*C+j]+=dz1[lo+j]*this.x2[lo+i]; g.db1[j]+=dz1[lo+j]; }
    for(let t=0;t<T;t++){ const o=t*C; for(let i=0;i<C;i++){ dx[o+i]+=dx2[o+i]; dproj[o+i]+=dx2[o+i]; } }
    for(let t=0;t<T;t++){ const o=t*C;
      for(let i=0;i<C;i++){ let s=0; for(let j=0;j<C;j++) s+=dproj[o+j]*this.Wproj[i*C+j]; datt[o+i]=s; }
      for(let i=0;i<C;i++) for(let j=0;j<C;j++) g.dWproj[i*C+j]+=this.attConcat[o+i]*dproj[o+j]; }
    const t=T-1;
    for(let h=0;h<nHead;h++){
      const head=this.heads[h], off=h*H;
      const dwei=zeros(T*T), dv=zeros(T*H);
      for(let s=0;s<T;s++) for(let i=0;i<H;i++){ dwei[t*T+s]+=datt[t*C+off+i]*head.v[s*H+i]; dv[s*H+i]+=head.wei[t*T+s]*datt[t*C+off+i]; }
      const dq=zeros(T*H), dk=zeros(T*H);
      let sum=0; for(let s=0;s<T;s++) sum+=dwei[t*T+s]*head.wei[t*T+s];
      for(let s=0;s<T;s++){ const dl=head.wei[t*T+s]*(dwei[t*T+s]-sum); for(let i=0;i<H;i++){ dq[t*H+i]+=dl*head.k[s*H+i]*this.scale(); dk[s*H+i]+=dl*head.q[t*H+i]*this.scale(); } }
      for(let t2=0;t2<T;t2++){ const xo=t2*C+off;
        for(let o=0;o<H;o++){ for(let i=0;i<H;i++){ g.dWk[h][i*H+o]+=dk[t2*H+o]*this.x[xo+i]; g.dWq[h][i*H+o]+=dq[t2*H+o]*this.x[xo+i]; g.dWv[h][i*H+o]+=dv[t2*H+o]*this.x[xo+i]; } }
        for(let i=0;i<H;i++){ let s=0; for(let o=0;o<H;o++){ s+=dk[t2*H+o]*this.Wk[h][i*H+o]; s+=dq[t2*H+o]*this.Wq[h][i*H+o]; s+=dv[t2*H+o]*this.Wv[h][i*H+o]; } dx[xo+i]+=s; } }
    }
    const idx=this.cacheIdx;
    for(let t3=0;t3<T;t3++){ const ch=idx[t3], o=t3*C; for(let i=0;i<C;i++){ g.dCe[ch*C+i]+=dx[o+i]; g.dPe[o+i]+=dx[o+i]; } }
    return g;
  }
  evaluate(samples){
    let correct=0; for(const s of samples){ const p=this.forward(s.a,s.b); let mx=0; for(let k=1;k<this.P;k++) if(p[k]>p[mx]) mx=k; if(mx===s.t) correct++; }
    return correct/samples.length;
  }
}

function makeData(P, ratio){
  const all=[]; for(let a=0;a<P;a++) for(let b=0;b<P;b++) all.push({a,b,t:(a+b)%P});
  for(let i=all.length-1;i>0;i--){ const r=(Math.random()*(i+1))|0; const t=all[i]; all[i]=all[r]; all[r]=t; }
  const nTrain=Math.max(1, Math.round(all.length*ratio/100));
  return { train: all.slice(0,nTrain), test: all.slice(nTrain) };
}

class AdamW {
  constructor(params, lr, wd){ this.lr=lr; this.wd=wd; this.b1=0.9; this.b2=0.98; this.eps=1e-8; this.t=0;
    this.params=params; this.m=params.map(p=>zeros(p.w.length)); this.v=params.map(p=>zeros(p.w.length)); }
  step(){
    this.t++; const bc1=1-Math.pow(this.b1,this.t), bc2=1-Math.pow(this.b2,this.t);
    for(let i=0;i<this.params.length;i++){ const {w,g}=this.params[i], m=this.m[i], v=this.v[i];
      for(let j=0;j<w.length;j++){ m[j]=this.b1*m[j]+(1-this.b1)*g[j]; v[j]=this.b2*v[j]+(1-this.b2)*g[j]*g[j];
        w[j]-= this.lr*(m[j]/bc1/(Math.sqrt(v[j]/bc2)+this.eps) + this.wd*w[j]); } }
  }
}

function addGrad(acc, g){ for(let i=0;i<acc.length;i++) acc[i]+=g[i]; }
function avgGrad(g, n){ for(let i=0;i<g.length;i++) g[i]/=n; }
function zeroGrad(g){ for(let i=0;i<g.length;i++) g[i]=0; }

function runOne(P, C, LR, WD, maxEpoch){
  const data=makeData(P,50), n=data.train.length;
  const m=new Model(P,C);
  const params=[
    {w:m.Ce,g:null},{w:m.Pe,g:null},
    ...m.Wq.map(w=>({w,g:null})), ...m.Wk.map(w=>({w,g:null})), ...m.Wv.map(w=>({w,g:null})),
    {w:m.Wproj,g:null},{w:m.W1,g:null},{w:m.b1,g:null},{w:m.W2,g:null},{w:m.b2,g:null},{w:m.Wl,g:null},{w:m.bl,g:null}
  ];
  const accGrad={ dCe:zeros(m.Vocab*m.C), dPe:zeros(m.T*m.C),
    dWk:Array.from({length:m.nHead},()=>zeros(m.H*m.H)), dWq:Array.from({length:m.nHead},()=>zeros(m.H*m.H)),
    dWv:Array.from({length:m.nHead},()=>zeros(m.H*m.H)), dWproj:zeros(m.C*m.C),
    dW1:zeros(m.C*m.C), db1:zeros(m.C), dW2:zeros(m.C*m.C), db2:zeros(m.C), dWl:zeros(m.P*m.C), dbl:zeros(m.P) };
  let pi=0;
  params[pi++].g=accGrad.dCe; params[pi++].g=accGrad.dPe;
  for(let h=0;h<m.nHead;h++) params[pi++].g=accGrad.dWk[h];
  for(let h=0;h<m.nHead;h++) params[pi++].g=accGrad.dWq[h];
  for(let h=0;h<m.nHead;h++) params[pi++].g=accGrad.dWv[h];
  params[pi++].g=accGrad.dWproj; params[pi++].g=accGrad.dW1; params[pi++].g=accGrad.db1;
  params[pi++].g=accGrad.dW2; params[pi++].g=accGrad.db2; params[pi++].g=accGrad.dWl; params[pi++].g=accGrad.dbl;
  const opt=new AdamW(params, LR, WD);

  let grokEpoch=null;
  const trace=[];
  const t0=Date.now();
  for(let ep=0; ep<maxEpoch; ep++){
    zeroGrad(accGrad.dCe); zeroGrad(accGrad.dPe);
    accGrad.dWk.forEach(zeroGrad); accGrad.dWq.forEach(zeroGrad); accGrad.dWv.forEach(zeroGrad);
    zeroGrad(accGrad.dWproj); zeroGrad(accGrad.dW1); zeroGrad(accGrad.db1);
    zeroGrad(accGrad.dW2); zeroGrad(accGrad.db2); zeroGrad(accGrad.dWl); zeroGrad(accGrad.dbl);
    for(const s of data.train){
      m.forward(s.a,s.b);
      const g=m.backward(s.t);
      addGrad(accGrad.dCe,g.dCe); addGrad(accGrad.dPe,g.dPe);
      for(let h=0;h<m.nHead;h++){ addGrad(accGrad.dWk[h],g.dWk[h]); addGrad(accGrad.dWq[h],g.dWq[h]); addGrad(accGrad.dWv[h],g.dWv[h]); }
      addGrad(accGrad.dWproj,g.dWproj); addGrad(accGrad.dW1,g.dW1); addGrad(accGrad.db1,g.db1);
      addGrad(accGrad.dW2,g.dW2); addGrad(accGrad.db2,g.db2); addGrad(accGrad.dWl,g.dWl); addGrad(accGrad.dbl,g.dbl);
    }
    avgGrad(accGrad.dCe,n); avgGrad(accGrad.dPe,n);
    accGrad.dWk.forEach(g=>avgGrad(g,n)); accGrad.dWq.forEach(g=>avgGrad(g,n)); accGrad.dWv.forEach(g=>avgGrad(g,n));
    avgGrad(accGrad.dWproj,n); avgGrad(accGrad.dW1,n); avgGrad(accGrad.db1,n);
    avgGrad(accGrad.dW2,n); avgGrad(accGrad.db2,n); avgGrad(accGrad.dWl,n); avgGrad(accGrad.dbl,n);
    for(let c=0;c<m.C;c++) accGrad.dCe[m.EQ*m.C+c]=0;
    opt.step();
    if(ep % 100 === 0){
      const te=m.evaluate(data.test);
      if(grokEpoch===null && te>0.9){ grokEpoch=ep; break; }
      if(ep % 200 === 0) trace.push({ep, train:+(m.evaluate(data.train)*100).toFixed(0), test:+(te*100).toFixed(0)});
    }
  }
  const finalTest=m.evaluate(data.test);
  const secs=((Date.now()-t0)/1000).toFixed(1);
  return { P, n, grokEpoch, finalTrain:+(m.evaluate(data.train)*100).toFixed(0), finalTest:+(finalTest*100).toFixed(0), trace, secs };
}

const C=128, LR=1e-3, WD=1.0, MAXE=3000;
for(const P of [13,17]){
  const r=runOne(P,C,LR,WD,MAXE);
  console.log(`P=${P}  train=${r.n}  grokEpoch=${r.grokEpoch===null?'未顿悟':r.grokEpoch}  finalTrain=${r.finalTrain}%  finalTest=${r.finalTest}%  耗时${r.secs}s`);
  console.log('  trace:', r.trace.map(x=>`${x.ep}(${x.train}/${x.test})`).join(' '));
}
