/* ============================================================
   恩尼格玛 · 破译可视化（lesson1 彩蛋2）
   图灵思路：用“已知明文片段(crib)”+ 穷举起始位置来找对密钥
   真实里还要排除转子顺序/插线板，所以需要 Bombe —— 这里只演示
   “固定其它条件时，为什么试到 17576 种起始位就一定能撞对”
   ============================================================ */
(function () {
  var root = document.getElementById('enigmaBreakLab');
  if (!root) return;

  var ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var WIRING = { I: 'EKMFLGDQVZNTOWYHXUSPAIBRCJ', II: 'AJDKSIRUXBLHWTMCQGZNPYFVOE', III: 'BDFHJLCPRTXVZNYEIWGAKMUSQO' };
  var REF = 'YRUHQSLDPXNGOKMIEBFZCWVJAT';
  var REFARR = [];
  for (var q = 0; q < 26; q++) REFARR.push(REF.charCodeAt(q) - 65);

  function mk(name) {
    var w = [], inv = [];
    for (var i = 0; i < 26; i++) w.push(WIRING[name].charCodeAt(i) - 65);
    for (var x = 0; x < 26; x++) for (var p = 0; p < 26; p++) if (w[p] === x) inv[x] = p;
    return { w: w, inv: inv };
  }
  var MR = mk('I'), MM = mk('II'), ML = mk('III'); // 右 / 中 / 左
  function step() {
    if (MM.pos === 4) ML.pos = (ML.pos + 1) % 26;      // Ⅱ notch E
    if (MR.pos === 16) MM.pos = (MM.pos + 1) % 26;     // Ⅰ notch Q
    MR.pos = (MR.pos + 1) % 26;
  }
  function encOne(i) {
    step();
    var s = i;
    s = (MR.w[(s + MR.pos) % 26] - MR.pos + 26) % 26;
    s = (MM.w[(s + MM.pos) % 26] - MM.pos + 26) % 26;
    s = (ML.w[(s + ML.pos) % 26] - ML.pos + 26) % 26;
    s = REFARR[s];
    s = (ML.inv[(s + ML.pos) % 26] - ML.pos + 26) % 26;
    s = (MM.inv[(s + MM.pos) % 26] - MM.pos + 26) % 26;
    s = (MR.inv[(s + MR.pos) % 26] - MR.pos + 26) % 26;
    return s;
  }
  // 用某个起始位置(0..17575)跑一遍明文/密文
  function run(text, keyIdx) {
    ML.pos = Math.floor(keyIdx / 676);
    MM.pos = Math.floor(keyIdx / 26) % 26;
    MR.pos = keyIdx % 26;
    var out = '';
    for (var k = 0; k < text.length; k++) out += ALPHA[encOne(text.charCodeAt(k) - 65)];
    return out;
  }
  function keyLetters(idx) {
    return ALPHA[Math.floor(idx / 676)] + ALPHA[Math.floor(idx / 26) % 26] + ALPHA[idx % 26];
  }

  // 固定的“密文内容线索”：德军天气报告总以 WETTER 开头（这就是 crib）
  var PLAIN = 'WETTERVORHERSAGE';   // 我们“偷看到的明文”形状
  var CRIB = 'WETTERVORH';
  var TOTAL = 26 * 26 * 26;

  var elCipher = document.getElementById('bkCipher');
  var elDialL = document.getElementById('bkDialL'), elDialM = document.getElementById('bkDialM'), elDialR = document.getElementById('bkDialR');
  var elTry = document.getElementById('bkTry'), elStatus = document.getElementById('bkStatus'), elResult = document.getElementById('bkResult');
  var btnRun = document.getElementById('bkRun'), btnNew = document.getElementById('bkNew');

  var cipher = '', running = false, cur = 0, timer = null;

  function newReport() {
    stopRun();
    // 随机选一个“当天密钥”（起始位置）生成一封密报
    var k = Math.floor(Math.random() * TOTAL);
    cipher = run(PLAIN, k);
    elCipher.textContent = cipher;
    cur = 0; elTry.textContent = '0';
    elDialL.textContent = elDialM.textContent = elDialR.textContent = 'A';
    elResult.className = 'bk-result';
    elResult.textContent = '';
    elStatus.innerHTML = '密报已截获。点「开始破译」让机器从 <b>AAA</b> 一路试到 <b>ZZZ</b>，找开头能拼出 <b>' + CRIB + '</b>… 的那组起始位置。';
  }
  function paint() {
    elTry.textContent = String(Math.min(cur, TOTAL));
    elDialL.textContent = ALPHA[Math.floor(cur / 676)];
    elDialM.textContent = ALPHA[Math.floor(cur / 26) % 26];
    elDialR.textContent = ALPHA[cur % 26];
  }
  function stopRun() {
    running = false;
    if (timer) { clearTimeout(timer); timer = null; }
    btnRun.disabled = false; btnNew.disabled = false;
  }
  function startRun() {
    if (running || !cipher) return;
    running = true; btnRun.disabled = true; btnNew.disabled = true;
    cur = 0; paint();
    elResult.className = 'bk-result';
    elResult.textContent = '';
    elStatus.innerHTML = '搜索中… 正在试起始位置 <b>AAA</b> 开始，逐个解密并与 ' + CRIB + ' 比对';
    chunk();
  }
  function chunk() {
    var end = Math.min(cur + 240, TOTAL);
    for (; cur < end; cur++) {
      var dec = run(cipher, cur);
      if (dec.indexOf(CRIB) === 0) { found(cur, dec); return; }
    }
    paint();
    if (cur >= TOTAL) { elStatus.textContent = '居然没找到？换一封密报再试。'; stopRun(); return; }
    timer = setTimeout(chunk, 0);
  }
  function found(idx, dec) {
    elTry.textContent = String(idx + 1);
    elDialL.textContent = ALPHA[Math.floor(idx / 676)];
    elDialM.textContent = ALPHA[Math.floor(idx / 26) % 26];
    elDialR.textContent = ALPHA[idx % 26];
    elResult.className = 'bk-result ok';
    elResult.innerHTML =
      '<div class="bk-found">找到了起始位置 = <b>' + keyLetters(idx) + '</b>（只试了 ' + (idx + 1) + ' 次）</div>' +
      '<div class="bk-line">用它解开密报开头：' + dec.slice(0, 10) + '… 对上了 WETTER！</div>' +
      '<div class="bk-line">完整明文：<b>' + dec + '</b></div>';
    elStatus.innerHTML = '破译成功！只要“固定词(crib)”够长，错误的起始位置很快就会被排除。';
    stopRun();
  }

  btnRun.onclick = startRun;
  btnNew.onclick = newReport;

  newReport();
})();
