/* ============ 图灵机纸带演示 (lesson1) — IIFE 自包含 ============ */
(function () {
  'use strict';
  var root = document.getElementById('tmlab');
  if (!root) return;
  var $ = function (id) { return document.getElementById(id); };

  // 纸带符号：'1' '0' '_'(空格)
  var PROGRAMS = [
    {
      name: '🅰️ 找到第一个 0 并改成 1',
      tape: ['1', '1', '0', '1', '0', '_', '_', '_', '_', '_'],
      start: 'q0',
      rules: [
        { s: 'q0', r: '1', w: '1', m: 'R', t: 'q0', note: '看到 1 → 原样写回，向右继续找' },
        { s: 'q0', r: '0', w: '1', m: 'R', t: 'qH', note: '看到 0 → 改成 1，向右一步，然后停机！' },
        { s: 'q0', r: '_', w: '_', m: 'S', t: 'qF', note: '纸带到头了还找不到 0 → 停机' }
      ],
      finish: function (t) { return '✅ 成功！纸带上第一个 0 已经变成了 1，机器停机。'; },
      fail: function (t) { return '⏹ 纸带上没有 0，机器到头就停了。'; }
    },
    {
      name: '🅱️ 把整条纸带的 1 都变成 0',
      tape: ['1', '0', '1', '1', '_', '_', '_', '_', '_', '_'],
      start: 'q0',
      rules: [
        { s: 'q0', r: '1', w: '0', m: 'R', t: 'q0', note: '看到 1 → 改成 0，向右继续' },
        { s: 'q0', r: '0', w: '0', m: 'R', t: 'q0', note: '看到 0 → 保持不变，向右继续' },
        { s: 'q0', r: '_', w: '_', m: 'S', t: 'qH', note: '碰到空格 → 全部改完，停机！' }
      ],
      finish: function (t) { return '✅ 纸带上的 1 全部变成了 0，机器停机！'; },
      fail: function (t) { return '⏹ 停机。'; }
    },
    {
      name: '🅲️ 向右移动，数一数纸带上写了几个 1',
      tape: ['1', '1', '1', '1', '_', '_', '_', '_', '_', '_'],
      start: 'q0',
      rules: [
        { s: 'q0', r: '1', w: '1', m: 'R', t: 'q0', note: '看到 1 → 不动它，向右继续数' },
        { s: 'q0', r: '_', w: '_', m: 'S', t: 'qH', note: '碰到空格 → 数完了，停机' }
      ],
      finish: function (t) { var n = 0; t.forEach(function (x) { if (x === '1') n++; }); return '✅ 机器把纸带走完就停了——一共有 ' + n + ' 个 1，你数对了吗？'; },
      fail: function (t) { return '⏹ 停机。'; }
    }
  ];

  // ---- 运行状态 ----
  var cur = 0;        // 当前程序
  var tape = [];      // 纸带拷贝
  var head = 0;       // 读写头位置
  var st = 'q0';      // 状态
  var stepN = 0;
  var halted = false;
  var timer = null;
  var running = false;
  var lastChanged = -1;

  // ---- DOM ----
  var elMissions = $('tmMissions'), elTape = $('tmTape'), elStatus = $('tmStatus');
  var elRules = $('tmRules'), elDone = $('tmDone'), elHeadline = $('tmHeadline');
  var btnAuto = $('tmAuto'), btnStep = $('tmStep'), btnReset = $('tmReset');

  function fmtState(s) { return s === 'qH' ? 'q₁ 停机✅' : s === 'qF' ? 'qF 没找到⏹' : s; }

  function resetProg(i, announce) {
    stopAuto();
    cur = i;
    var p = PROGRAMS[i];
    tape = p.tape.slice();
    head = 0; st = p.start; stepN = 0; halted = false; running = false; lastChanged = -1;
    elDone.classList.remove('show', 'ok', 'bad');
    btnAuto.textContent = '▶ 自动运行';
    btnAuto.disabled = false; btnStep.disabled = false;
    document.querySelectorAll('#tmMissions .tm-mis').forEach(function (b, bi) { b.classList.toggle('sel', bi === i); b.classList.remove('disable'); });
    render();
    elStatus.innerHTML = '🟢 准备就绪：' + (announce ? '' : '') + '从纸带最左端开始，状态 ' + fmtState(st) + '。<b>点「▶ 自动」或「👣 单步」</b>，看它怎么读、写、走。';
    elDone.textContent = '';
  }

  function render() {
    // 纸带
    elTape.innerHTML = '';
    tape.forEach(function (sym, i) {
      var d = document.createElement('div');
      d.className = 'tm-cell' + (sym === '_' ? ' blank' : '') + (sym === '1' ? ' b1' : '') + (i === head ? ' cur' : '') + (i === lastChanged ? ' changed' : '');
      d.innerHTML = '<span class="idx">' + i + '</span>' + (sym === '_' ? '▢' : sym);
      elTape.appendChild(d);
    });
    // 读写头（上指箭头，表示正在读这一格）：以第一格的真实偏移为基准，居中/滚动都对齐
    var firstCell = elTape.querySelector('.tm-cell');
    var cellStep = 50; // 46 格宽 + 4 间距
    var baseLeft = firstCell ? firstCell.offsetLeft + 23 : 25;
    var left = baseLeft + head * cellStep;
    elHeadline.innerHTML = '<span class="tm-arrow" style="left:' + left + 'px">▲</span>';
    // 规则表
    var p = PROGRAMS[cur];
    elRules.innerHTML = '';
    p.rules.forEach(function (rule, ri) {
      var d = document.createElement('div');
      d.className = 'tm-rule';
      if (halted) { if (rule.t === st) d.classList.add('hit'); }
      else if (!halted && rule.s === st && rule.r === tape[head]) d.classList.add('hit');
      d.innerHTML = '<span class="chip">' + rule.s + ' · 读到 ' + (rule.r === '_' ? '▢' : rule.r) + '</span>' +
        '<span class="arr">→</span> 写 ' + (rule.w === '_' ? '▢' : rule.w) +
        ' · ' + (rule.m === 'L' ? '◀ 向左' : rule.m === 'R' ? '▶ 向右' : '○ 不动') +
        ' · 去 ' + fmtState(rule.t) +
        '<span style="flex:1"></span><span style="font-size:11px;color:#8b93ad">' + rule.note + '</span>';
      elRules.appendChild(d);
    });
  }

  function stopAuto() {
    if (timer) { clearInterval(timer); timer = null; }
    running = false;
    btnAuto.textContent = '▶ 自动运行';
  }

  function stepOnce() {
    if (halted) return;
    var p = PROGRAMS[cur];
    var sym = tape[head] === undefined ? '_' : tape[head];
    var rule = null;
    for (var i = 0; i < p.rules.length; i++) {
      if (p.rules[i].s === st && p.rules[i].r === sym) { rule = p.rules[i]; break; }
    }
    stepN++;
    if (!rule) { halted = true; elStatus.innerHTML = '⛔ 没有匹配的规则（状态 ' + fmtState(st) + '，读到 ' + sym + '），机器只好停机。'; elDone.classList.add('show', 'bad'); elDone.textContent = '⏹ 没有规则可走，停机。'; render(); return; }
    // 执行：写 + 移动 + 换状态
    tape[head] = rule.w; lastChanged = head;
    var moved = '';
    if (rule.m === 'L') { head = Math.max(0, head - 1); moved = '向左走了一步'; }
    else if (rule.m === 'R') { head = Math.min(tape.length - 1, head + 1); moved = '向右走了一步'; }
    else moved = '原地不动';
    st = rule.t;
    var msg = '👣 第 ' + stepN + ' 步：状态 ' + rule.s + ' 读到 ' + (rule.r === '_' ? '▢' : rule.r) +
      ' → 执行「' + rule.note + '」，' + moved + '。现在状态：' + fmtState(st);
    elStatus.innerHTML = msg;
    if (st === 'qH' || st === 'qF') {
      halted = true; running = false;
      stopAuto();
      elStatus.innerHTML += '<br><b>' + (st === 'qH' ? p.finish(tape) : p.fail(tape)) + '</b>';
      elDone.classList.add('show', st === 'qH' ? 'ok' : 'bad');
      elDone.textContent = st === 'qH' ? p.finish(tape) : p.fail(tape);
    }
    render();
  }

  // ---- 事件 ----
  PROGRAMS.forEach(function (p, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'tm-mis' + (i === 0 ? ' sel' : '');
    b.textContent = p.name;
    b.onclick = function () { resetProg(i); };
    elMissions.appendChild(b);
  });

  btnStep.onclick = function () { stopAuto(); stepOnce(); };
  btnAuto.onclick = function () {
    if (halted) { resetProg(cur); return; }
    if (running) { stopAuto(); return; }
    running = true;
    btnAuto.textContent = '⏸ 暂停';
    stepOnce();
    if (!halted) {
      timer = setInterval(function () {
        if (halted) { stopAuto(); return; }
        stepOnce();
      }, 750);
    }
  };
  btnReset.onclick = function () { resetProg(cur); };

  // 初始
  resetProg(0);
})();
