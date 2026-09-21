/* ============================================================
   恩尼格玛密码机可视化 (lesson1 彩蛋)
   用真实 Enigma I 的 3 个转子(I/II/III) + 反射器B，无插线板
   - 每按一个字母：先转一格，再把电流右Ⅰ→中Ⅱ→左Ⅲ→反射→原路返回
   - 对称性：同一初始位置把密文再跑一遍 = 明文
   ============================================================ */
(function () {
  var root = document.getElementById('enigmaLab');
  if (!root) return;

  var ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var WIRING = { I: 'EKMFLGDQVZNTOWYHXUSPAIBRCJ', II: 'AJDKSIRUXBLHWTMCQGZNPYFVOE', III: 'BDFHJLCPRTXVZNYEIWGAKMUSQO' };
  var REFLECTOR = 'YRUHQSLDPXNGOKMIEBFZCWVJAT';   // 反射器 B
  var NOTCH = { I: 16, II: 4, III: 21 };            // Q E V

  function mkRotor(name) {
    var w = [], inv = [];
    for (var i = 0; i < 26; i++) w.push(WIRING[name].charCodeAt(i) - 65);
    for (var x = 0; x < 26; x++) for (var p = 0; p < 26; p++) if (w[p] === x) inv[x] = p;
    return { name: name, w: w, inv: inv, pos: 0 };
  }

  var REF = [];
  for (var r = 0; r < 26; r++) REF.push(REFLECTOR.charCodeAt(r) - 65);

  var machine = { right: mkRotor('I'), mid: mkRotor('II'), left: mkRotor('III') }; // 物理从左到右: 左Ⅲ 中Ⅱ 右Ⅰ(快)
  var MSG = '', idx = 0, running = false, ciphArr = [];
  var key = { L: 0, M: 0, R: 0 };   // 当天密钥 = 起始转轮位置（默认 AAA）

  var $ = function (id) { return document.getElementById(id); };
  var elDials = { L: $('egDialL'), M: $('egDialM'), R: $('egDialR') };
  var elLamps = [], lampsBox = $('egLamps');
  for (var L = 0; L < 26; L++) {
    var sp = document.createElement('div');
    sp.className = 'eg-lamp'; sp.textContent = ALPHA[L];
    lampsBox.appendChild(sp); elLamps.push(sp);
  }
  var elPlain = $('egPlain'), elCiph = $('egCipher'), elStatus = $('egStatus'),
      elLog = $('egLog'), elInput = $('egMsg'), elDecode = $('egDecode');

  function passF(r, i) { return (r.w[(i + r.pos) % 26] - r.pos + 26) % 26; }
  function passB(r, i) { return (r.inv[(i + r.pos) % 26] - r.pos + 26) % 26; }
  function stepRotors() {
    if (machine.mid.pos === NOTCH[machine.mid.name]) machine.left.pos = (machine.left.pos + 1) % 26;
    if (machine.right.pos === NOTCH[machine.right.name]) machine.mid.pos = (machine.mid.pos + 1) % 26;
    machine.right.pos = (machine.right.pos + 1) % 26;
  }
  function encIdx(ci) { // 先转一格，再加密（只返回最终密文）
    stepRotors();
    var s = ci;
    s = passF(machine.right, s); s = passF(machine.mid, s); s = passF(machine.left, s);
    s = REF[s];
    s = passB(machine.left, s); s = passB(machine.mid, s); s = passB(machine.right, s);
    return s;
  }
  function encTrace(ci) { // 返回完整路径：每经过一个转子/反射器，字母怎么变
    stepRotors();
    var pr = ALPHA[machine.right.pos], pm = ALPHA[machine.mid.pos], pl = ALPHA[machine.left.pos];
    var st = [], s = ci;
    function fw(rotor, nm, posL) { var f = s; s = passF(rotor, s); st.push({ f: ALPHA[f], nm: nm, pos: posL, t: ALPHA[s] }); }
    function bw(rotor, nm, posL) { var f = s; s = passB(rotor, s); st.push({ f: ALPHA[f], nm: nm, pos: posL, t: ALPHA[s] }); }
    fw(machine.right, '右转子Ⅰ', pr);
    fw(machine.mid, '中转子Ⅱ', pm);
    fw(machine.left, '左转子Ⅲ', pl);
    var fr = s; s = REF[s]; st.push({ f: ALPHA[fr], nm: '反射器', pos: '', t: ALPHA[s], ref: true });
    bw(machine.left, '左转子Ⅲ（往回走）', pl);
    bw(machine.mid, '中转子Ⅱ（往回走）', pm);
    bw(machine.right, '右转子Ⅰ（往回走）', pr);
    return { st: st, cipher: s };
  }

  function dialLetters() { return ALPHA[machine.left.pos] + ALPHA[machine.mid.pos] + ALPHA[machine.right.pos]; }
  function renderDials(hot) {
    elDials.L.textContent = ALPHA[machine.left.pos];
    elDials.M.textContent = ALPHA[machine.mid.pos];
    elDials.R.textContent = ALPHA[machine.right.pos];
    if (hot) { elDials.R.classList.remove('step'); void elDials.R.offsetWidth; elDials.R.classList.add('step'); }
  }
  function lampOffAll() { for (var i = 0; i < 26; i++) elLamps[i].className = 'eg-lamp'; }
  function lampIn(ci) { elLamps[ci].classList.add('in'); }
  function lampOn(co) { elLamps[co].className = 'eg-lamp on'; }

  function resetPositions() { machine.left.pos = machine.mid.pos = machine.right.pos = 0; renderDials(false); }
  function keyLetters() { return ALPHA[key.L] + ALPHA[key.M] + ALPHA[key.R]; }
  function applyKey() { machine.left.pos = key.L; machine.mid.pos = key.M; machine.right.pos = key.R; renderDials(false); }
  function idleStatus() { elStatus.innerHTML = '起始位置(当天密钥) = <b>' + keyLetters() + '</b>：点上方转子字母可换密钥；输入字母后按「自动加密」或「单步」开始。'; }

  function resetAll() {
    running = false;
    setBtns(true);
    applyKey(); idx = 0; ciphArr = [];
    elPlain.textContent = ''; elCiph.textContent = ''; elLog.textContent = '';
    lampOffAll();
    idleStatus();
    elDecode.style.display = 'none';
  }

  function appendLetter(ch) {
    var span = document.createElement('span');
    span.textContent = ch; span.className = 'ch fresh';
    elCiph.appendChild(span); elCiph.appendChild(document.createTextNode(' '));
  }

  function encOne() { // 加密当前 MSG[idx]，更新界面 + 详细路径日志
    if (idx >= MSG.length) return false;
    var ch = MSG[idx], ci = ch.charCodeAt(0) - 65;
    var before = dialLetters();
    var tr = encTrace(ci);
    var co = tr.cipher;
    var after = dialLetters();
    ciphArr.push(ALPHA[co]);
    // 界面
    lampOffAll(); lampIn(ci); lampOn(co);
    renderDials(true);
    elPlain.textContent = MSG.slice(0, idx + 1).split('').join(' ');
    appendLetter(ALPHA[co]);
    // 详细日志：逐段写明每个字母怎么变
    var box = document.createElement('div');
    box.className = 'eg-detail';
    var head = document.createElement('div');
    head.className = 'eg-line eg-top';
    head.innerHTML = '第<b>' + (idx + 1) + '</b>位　明文 <b>' + ch + '</b> → 密文 <b>' + ALPHA[co] + '</b>　<em>转轮 ' + before + ' → ' + after + '</em>';
    box.appendChild(head);
    for (var i = 0; i < tr.st.length; i++) {
      var x = tr.st[i];
      var l = document.createElement('div');
      l.className = 'eg-line eg-stage' + (x.ref ? ' eg-ref' : '');
      l.innerHTML = '<span class="eg-arr">　' + x.f + ' ──▶ ' + x.nm + (x.pos ? '（位置 ' + x.pos + '）' : '') + '</span> ──▶ <b>' + x.t + '</b>';
      box.appendChild(l);
    }
    elLog.insertBefore(box, elLog.firstChild);
    idx++;
    return true;
  }

  function finish() {
    running = false; setBtns(true);
    elStatus.innerHTML = '✅ 加密完成！这一句的密文是 <b>' + cipherText() + '</b><br>试试点「🔁 解密：原样再跑一次」——同一个机器、同一组转轮，就能把密文变回明文！';
    elDecode.style.display = '';
  }
  function cipherText() { return ciphArr.join(''); }

  function runAuto() {
    if (running || MSG.length === 0) return;
    running = true; setBtns(false); idx = 0; ciphArr = [];
    elPlain.textContent = ''; elCiph.textContent = ''; elLog.textContent = ''; lampOffAll();
    applyKey();
    elDecode.style.display = 'none';
    elStatus.innerHTML = '⏳ 开始加密…';
    tick();
    function tick() {
      if (!running) return;
      if (!encOne()) { finish(); return; }
      setTimeout(tick, 430);
    }
  }
  function stepOnce() {
    if (running || MSG.length === 0) return;
    if (idx >= MSG.length) { elStatus.innerHTML = '✅ 已经全部加密完了！密文：<b>' + cipherText() + '</b>（点「🔁 解密」可还原）'; elDecode.style.display = ''; return; }
    encOne();
    if (idx >= MSG.length) { elStatus.innerHTML = '🎉 全部加密完成！密文：<b>' + cipherText() + '</b>'; elDecode.style.display = ''; }
    else elStatus.innerHTML = '已加密 <b>' + idx + '</b>/' + MSG.length + ' 位，继续「👣 加密一个」或直接「▶ 自动加密」。';
  }

  function decode() {
    var c = cipherText();
    if (!c) return;
    resetAll();
    MSG = c;
    runAuto();
  }

  function setBtns(on) {
    $('egAuto').disabled = !on; $('egStep').disabled = !on; $('egReset').disabled = !on; $('egDecode').disabled = !on;
  }

  $('egAuto').onclick = function () { MSG = (elInput.value || '').toUpperCase().replace(/[^A-Z]/g, ''); runAuto(); };
  $('egStep').onclick = function () { MSG = (elInput.value || '').toUpperCase().replace(/[^A-Z]/g, ''); stepOnce(); };
  $('egReset').onclick = resetAll;
  $('egDecode').onclick = decode;
  elInput.addEventListener('input', function () { elInput.value = elInput.value.toUpperCase().replace(/[^A-Z]/g, ''); });

  // 点转子字母 → 设定“当天密钥”（起始位置 A~Z，每次前进一格）
  ['L', 'M', 'R'].forEach(function (side) {
    elDials[side].addEventListener('click', function () {
      if (running) return;
      key[side] = (key[side] + 1) % 26;
      applyKey(); idleStatus();
    });
  });

  resetAll();

  // 调试/测试钩子
  window._enigma = {
    enc: function (msg) { resetPositions(); var out = ''; for (var i = 0; i < msg.length; i++) out += ALPHA[encIdx(msg.charCodeAt(i) - 65)]; resetPositions(); return out; },
    reset: resetPositions
  };
})();
