/* ============================================================
   ai4kids · 时间轴课程引擎 (timeline.js)
   Web 开发 & 人工智能 两个课程页共用

   用法（在课程页的 <script> 中）：
     const COURSES = [ ...课程数据... ];
     initTimeline({ courses: COURSES, careerKey: 'web-development', name: 'Web 开发' });
   ============================================================ */
function initTimeline({ courses, careerKey, name }){
  const KEY = 'career101_done';
  let done = load(KEY, {});
  let doneSet = new Set(done[careerKey] || []);

  function persist(){
    done[careerKey] = [...doneSet];
    save(KEY, done);
  }

  const tl = document.getElementById('tl');
  const modal = document.getElementById('modal');
  const lesson = document.getElementById('lesson');
  let current = 0;

  function renderTimeline(){
    tl.innerHTML = courses.map((c,i)=>{
      const isDone = doneSet.has(c.year);
      const cls = isDone ? 'done' : (i===0 ? 'cur' : '');
      const state = isDone ? '✅' : (i===0 ? '▶️' : '🔓');
      return `<div class="node">
        <div class="dot">${c.emoji}</div>
        <div class="ncard ${cls}" data-i="${i}">
          <span class="year">${c.year}</span>
          <div class="row">
            <span class="em">${c.emoji}</span>
            <span class="tt"><b>${i+1}. ${c.title}</b><span>${c.brief}</span></span>
            <span class="state">${state}</span>
          </div>
        </div>
      </div>`;
    }).join('');
    tl.querySelectorAll('.ncard').forEach(el=>{
      el.onclick = ()=>{ current = +el.dataset.i; openLesson(); };
    });
  }

  function updateProgress(){
    document.getElementById('pr').textContent = `已学 ${doneSet.size}/${courses.length}`;
  }

  function renderLesson(){
    const c = courses[current];
    const doneNow = doneSet.has(c.year);
    const isLast = current === courses.length-1;
    const isFirst = current === 0;
    lesson.innerHTML = `
      <div class="l-head">
        <span class="lyear">${c.year} 年</span>
        <span class="lemo">${c.emoji}</span>
        <h2>${current+1}. ${c.title}</h2>
        <span class="ltag">${c.tag} · ${name}时间轴第 ${current+1} 站</span>
      </div>
      <div class="sec story"><h4>🕰️ 故事时间 · 那时候发生了什么？</h4><p>${c.story}</p></div>
      <div class="sec teach"><h4>📖 知识小课堂 · 记住这个魔法！</h4><p>${c.teach}</p></div>
      <div class="sec act"><h4>🖐️ 动手小任务 · 亲自试一试</h4><ol>${c.activity.steps.map(s=>`<li>${s}</li>`).join('')}</ol></div>
      <div class="sec quiz" id="quizBox">
        <h4>❓ 小测试 · 你学会了吗？</h4>
        <p class="quiz-q">${c.quiz.q}</p>
        ${c.quiz.options.map((o,i)=>`<button class="opt" data-i="${i}">${String.fromCharCode(65+i)}. ${o}</button>`).join('')}
        <div class="quiz-fb" id="fb"></div>
      </div>
      <div class="sec think"><h4>💭 思考时间 · 和爸爸妈妈聊一聊</h4><p>${c.think}</p></div>
      <div class="l-nav">
        <button class="btn-prev" id="prevBtn" ${isFirst?'disabled style="opacity:.4"':''}>← 上一课</button>
        <button class="btn-next ${doneNow?'done':''}" id="nextBtn">${isLast?'🏁 完成全部课程':(doneNow?'✅ 已完成 · 下一课 →':'🎯 完成本课 · 下一课 →')}</button>
      </div>`;

    /* 小测试交互 */
    const opts = lesson.querySelectorAll('.opt');
    const fb = lesson.querySelector('#fb');
    let answered = false;
    opts.forEach(o=>{
      o.onclick = ()=>{
        if(answered) return; answered = true;
        const i = +o.dataset.i;
        opts.forEach(x=>x.disabled = true);
        if(i === c.quiz.answer){
          o.classList.add('right');
          fb.className = 'quiz-fb show ok';
          fb.innerHTML = `🎉 答对啦！${c.quiz.explain}`;
        } else {
          o.classList.add('wrong');
          opts[c.quiz.answer].classList.add('right');
          fb.className = 'quiz-fb show no';
          fb.innerHTML = `🤔 再想想哦！正确答案是 ${String.fromCharCode(65+c.quiz.answer)}。${c.quiz.explain}`;
        }
      };
    });

    lesson.querySelector('#prevBtn').onclick = ()=>{ if(!isFirst){ current--; renderLesson(); } };
    lesson.querySelector('#nextBtn').onclick = ()=>{
      if(!doneSet.has(c.year)){
        doneSet.add(c.year); persist(); updateProgress(); renderTimeline();
        toast(`✅ 完成 ${c.year} 年 · ${c.title}！`);
      }
      if(isLast){ closeLesson(); renderTimeline(); }
      else { current++; renderLesson(); }
    };
  }

  function openLesson(){ renderLesson(); modal.classList.add('open'); document.body.style.overflow='hidden'; }
  function closeLesson(){ modal.classList.remove('open'); document.body.style.overflow=''; }
  window.closeLesson = closeLesson;
  modal.addEventListener('click', e=>{ if(e.target === modal) closeLesson(); });

  renderTimeline();
  updateProgress();
}
