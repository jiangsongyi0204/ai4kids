/* ========== 第5课 · 专家系统「小医生问诊」可视化演示 ========== */
(function () {
    var wrap = document.getElementById('esWrap');
    if (!wrap) return;
    var SYMS = [
        { id: 'fever', icon: '🌡️', name: '发烧' },
        { id: 'cough', icon: '😮‍💨', name: '咳嗽' },
        { id: 'sneeze', icon: '🤧', name: '打喷嚏' },
        { id: 'runny', icon: '💧', name: '流鼻涕' },
        { id: 'stomach', icon: '🤢', name: '肚子疼' },
        { id: 'nausea', icon: '🤮', name: '恶心想吐' },
        { id: 'itchy', icon: '👀', name: '眼睛痒红' },
        { id: 'rash', icon: '🌸', name: '皮肤出疹' }
    ];
    var SYM = {};
    SYMS.forEach(function (s) { SYM[s.id] = s; });
    // 规则：if 里 {k, not?:没有, opt?:可有可无}
    var RULES = [
        { id: 'R1', name: '着凉 / 轻感冒', if: [{ k: 'sneeze' }, { k: 'runny' }, { k: 'fever', not: 1 }],
          then: '🤧 普通感冒（着凉）', adv: '多喝温水、好好休息、别吹风～' },
        { id: 'R2', name: '感冒 / 流感', if: [{ k: 'fever' }, { k: 'runny', opt: 1 }, { k: 'cough', opt: 1 }, { k: 'sneeze', opt: 1 }],
          then: '😷 感冒或流感', adv: '量体温、多休息；不舒服就让大人带你去看医生。' },
        { id: 'R3', name: '急性肠胃炎', if: [{ k: 'stomach' }, { k: 'nausea' }],
          then: '🤢 急性肠胃炎（可能）', adv: '吃清淡些、别喝冰的，早点儿去看医生。' },
        { id: 'R4', name: '过敏', if: [{ k: 'sneeze' }, { k: 'itchy' }],
          then: '🤧 过敏反应', adv: '远离让你痒的东西：花粉、灰尘、毛绒玩具……' },
        { id: 'R5', name: '出疹 + 发烧', if: [{ k: 'rash' }, { k: 'fever' }],
          then: '🩹 感染性出疹（可能）', adv: '别抓挠，尽快去医院让医生看一看。' }
    ];
    var state = { busy: false, selected: {} };
    function esc(t) { return String(t).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
    function symLabel(id) { return SYM[id] ? SYM[id].icon + ' ' + SYM[id].name : id; }
    function selKeys() { return Object.keys(state.selected).filter(function (k) { return state.selected[k]; }); }
    function factsTxt() { var a = selKeys(); return a.length ? a.map(symLabel).join('、') : '（还没选症状）'; }
    function condTxt(r) {
        var req = [], no = [], op = [];
        r.if.forEach(function (c) { if (c.not) no.push(symLabel(c.k)); else if (c.opt) op.push(symLabel(c.k)); else req.push(symLabel(c.k)); });
        var parts = [];
        if (req.length) parts.push(req.join('、'));
        if (no.length) parts.push('没有' + no.join('、'));
        var s = parts.join('　并且　');
        if (op.length) s += '（可兼有：' + op.join('、') + '）';
        return s;
    }
    function paintSyms() {
        var box = document.getElementById('esSyms');
        box.innerHTML = SYMS.map(function (s) {
            return '<button type="button" class="es-sym' + (state.selected[s.id] ? ' on' : '') + '" data-k="' + s.id + '">' + s.icon + '<span>' + s.name + '</span></button>';
        }).join('');
        Array.prototype.forEach.call(box.querySelectorAll('.es-sym'), function (b) {
            b.addEventListener('click', function () {
                if (state.busy) return;
                var k = b.getAttribute('data-k');
                state.selected[k] = !state.selected[k];
                b.classList.toggle('on', !!state.selected[k]);
                logLine('✍️ 现在症状：' + factsTxt(), '');
            });
        });
    }
    function paintRules() {
        var box = document.getElementById('esRules');
        box.innerHTML = RULES.map(function (r) {
            return '<div class="es-rule idle" id="esRule-' + r.id + '"><span class="es-rid">' + r.id + '</span><div class="es-rb"><b>' + esc(r.name) + '</b><p>如果 ' + esc(condTxt(r)) + '，就 → ' + esc(r.then) + '</p></div><span class="es-state">待匹配</span></div>';
        }).join('');
    }
    function logLine(html, cls) {
        var d = document.createElement('div');
        d.className = 'es-line' + (cls ? ' ' + cls : '');
        d.innerHTML = html;
        var lg = document.getElementById('esLog');
        lg.appendChild(d);
        lg.scrollTop = lg.scrollHeight;
    }
    function setRule(id, st, txt) {
        var el = document.getElementById('esRule-' + id);
        if (!el) return;
        el.className = 'es-rule ' + st;
        var sEl = el.querySelector('.es-state');
        sEl.textContent = txt;
    }
    function setRunUi(dis) {
        state.busy = dis;
        document.getElementById('esRun').disabled = dis;
        document.getElementById('esWeird').disabled = dis;
    }
    function matchRule(r) {
        var missing = [], blocks = [];
        r.if.forEach(function (c) {
            var has = !!state.selected[c.k];
            if (c.not) { if (has) blocks.push('没有' + symLabel(c.k)); }
            else if (!c.opt && !has) missing.push(symLabel(c.k));
        });
        return { ok: missing.length === 0 && blocks.length === 0, missing: missing, blocks: blocks };
    }
    function showDx(conclusions, weird) {
        var el = document.getElementById('esResult');
        el.className = 'es-result';
        if (conclusions.length) {
            var cards = conclusions.map(function (c) {
                var emo = (c.then.split(' ')[0]) || '🩺';
                return '<div class="es-dx-card"><span class="es-dx-emo">' + emo + '</span><div><b>' + esc(c.then) + '</b><p>' + esc(c.adv) + '</p></div></div>';
            }).join('');
            el.innerHTML = '<div class="es-dx-ok">' + cards + '</div><p class="es-note">✅ 专家系统把“如果…就…”规则一条条拿出来比对，命中的点亮——这就是它的“推理机”。</p>';
            el.className = 'es-result ok';
        } else {
            var head = weird ? '这是条“规则外的怪病”——我知识库里真的没有！' : '病人表现太多样，我知识库里没查到能对上的组合……';
            el.innerHTML = '<p class="es-fail">🤷 ' + head + '</p><p class="es-note">这就是专家系统的“软肋”：<b>知识库没写到的，它再聪明也不会</b>。规则写了多少，它就懂多少——所以它当“顾问”很在行，却不会像人类那样自己想出新办法。</p>';
            el.className = 'es-result no';
        }
    }
    function run(weird) {
        if (state.busy) return;
        if (!weird && selKeys().length === 0) { logLine('⚠️ 请先在下面点选病人的症状，再按开始～', 'warn'); return; }
        setRunUi(true);
        if (weird) { Object.keys(state.selected).forEach(function (k) { state.selected[k] = false; }); ['cough', 'nausea', 'rash'].forEach(function (k) { state.selected[k] = true; }); paintSyms(); }
        document.getElementById('esLog').innerHTML = '';
        document.getElementById('esResult').innerHTML = '';
        document.getElementById('esResult').className = 'es-result';
        RULES.forEach(function (r) { setRule(r.id, 'idle', '待匹配'); });
        logLine(weird ? '🦩 病人得了一种“怪病”：' + factsTxt() + '……专家系统开始翻知识库。' : '🧪 <b>推理开始</b>　已知症状：' + factsTxt(), 'ok');
        var conclusions = [];
        RULES.forEach(function (r, idx) {
            setTimeout(function () {
                var m = matchRule(r);
                if (m.ok) {
                    conclusions.push({ then: r.then, adv: r.adv });
                    setRule(r.id, 'ok', '✓ 命中');
                    logLine('✅ <b>' + r.id + '</b> 条件都满足 → 结论「' + esc(r.then) + '」', 'ok');
                } else {
                    var why = [];
                    if (m.blocks.length) why.push('但病人有' + m.blocks.join('、'));
                    if (m.missing.length) why.push('还缺' + m.missing.join('、'));
                    setRule(r.id, 'no', '✗ 没对上');
                    logLine('❌ <b>' + r.id + '</b> 没对上：' + esc(why.join('，')), 'no');
                }
                if (idx === RULES.length - 1) {
                    setTimeout(function () { showDx(conclusions, weird); setRunUi(false); logLine('🏁 推理结束。', 'ok'); }, 320);
                }
            }, 500 * (idx + 1));
        });
    }
    document.getElementById('esRun').addEventListener('click', function () { run(false); });
    document.getElementById('esWeird').addEventListener('click', function () { run(true); });
    document.getElementById('esReset').addEventListener('click', function () {
        if (state.busy) return;
        Object.keys(state.selected).forEach(function (k) { state.selected[k] = false; });
        document.getElementById('esResult').innerHTML = '';
        document.getElementById('esResult').className = 'es-result';
        paintSyms();
        RULES.forEach(function (r) { setRule(r.id, 'idle', '待匹配'); });
        document.getElementById('esLog').innerHTML = '';
        logLine('🔄 已重置。请重新给病人选症状～', 'warn');
    });
    document.getElementById('esHow').addEventListener('click', function () {
        logLine('📖 <b>玩法</b>：点症状小圆点给“病人”挑症状（再点可取消）；按「▶ 开始推理诊断」，看推理机把 5 条规则逐条拿出来比对——命中的点亮并记下结论。最后试试「🦩 规则外的怪病」，看看知识库没写时会怎样。', 'warn');
    });
    paintSyms();
    paintRules();
    logLine('👋 你好，我是“小医生”专家系统。先点几个症状，再按 ▶ 开始～', '');
})();
