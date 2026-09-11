/* ============================================================
  人工智能简史 · E04 课件共享脚本
   依赖（在页面中先于本文件加载）:
     ../../../js/cloud-records.js
     ../../../js/lesson-recorder.js
     /js/tracker.js              (可选：学习轨迹)
   页面 <body> 需带 data-ls（第几课）与 data-title（课名）
   ============================================================ */
(function () {
    var LS = parseInt(document.body.getAttribute('data-ls') || '1', 10);
    var LSN = parseInt(document.body.getAttribute('data-lsn') || '16', 10);
    var TITLE = document.body.getAttribute('data-title') || '人工智能简史';

    // ---------- 幻灯片 ----------
    var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
    var dotsWrap = document.getElementById('dots');
    var counterEl = document.getElementById('navCounter');
    var btnPrev = document.getElementById('btnPrev');
    var btnNext = document.getElementById('btnNext');
    var titles = (document.body.getAttribute('data-titles') || '').split('|');
    var current = 0;

    function go(idx) {
        if (idx < 0 || idx > slides.length - 1) return;
        // 先把当前显示着的页面（可能是多个，如深链直达时）全部收起，再显示目标页
        slides.forEach(function (s) { s.classList.remove('active'); });
        current = idx;
        slides[current].classList.add('active');
        updateNav();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        try { history.replaceState(null, '', '#' + slides[current].id); } catch (e) {}
    }
    // 页面内联按钮使用
    window.goSlide = function (delta) { go(current + delta); };
    function updateNav() {
        var name = titles[current] ? titles[current].split('·').pop().trim() : '';
        if (counterEl) counterEl.textContent = (current + 1) + ' / ' + slides.length + ' ' + name;
        if (btnPrev) btnPrev.disabled = current === 0;
        if (btnNext) btnNext.disabled = current === slides.length - 1;
        if (dotsWrap) {
            dotsWrap.innerHTML = '';
            for (var i = 0; i < slides.length; i++) {
                var d = document.createElement('span');
                d.className = 'dot' + (i === current ? ' active' : '');
                d.onclick = (function (idx) { return function () { go(idx); }; })(i);
                dotsWrap.appendChild(d);
            }
        }
    }
    // 深链
    (function () {
        var h = location.hash;
        if (h) {
            for (var i = 0; i < slides.length; i++) {
                if (slides[i].id === h.replace('#', '')) { current = i; break; }
            }
        }
    })();
    go(current);

    // ---------- 知识翻牌 ----------
    window.openK = function (el) { el.classList.toggle('open'); };

    // ---------- 小任务打卡 ----------
    window.toggleTask = function (el) {
        var item = el.closest('.task-item');
        item.classList.toggle('done');
        updateTaskProgress(item);
    };
    function updateTaskProgress(item) {
        var box = item && item.closest('.task-zone');
        if (!box) return;
        var items = box.querySelectorAll('.task-item');
        var done = box.querySelectorAll('.task-item.done').length;
        var p = box.querySelector('.task-progress');
        if (p) {
            p.textContent = '已完成：' + done + ' / ' + items.length + (done === items.length ? '  ✅ 全部完成，太棒啦！' : '');
        }
    }
    document.querySelectorAll('.task-zone').forEach(function (zone) {
        var p = zone.querySelector('.task-progress');
        if (p) p.textContent = '已完成：0 / ' + zone.querySelectorAll('.task-item').length;
    });

    // ---------- 小测验 ----------
    window.pickQuiz = function (el) {
        var item = el.closest('.quiz-item');
        var answer = parseInt(item.getAttribute('data-a'), 10);
        var chosen = parseInt(el.getAttribute('data-i'), 10);
        var fb = item.querySelector('.quiz-fb');
        item.querySelectorAll('.quiz-opt').forEach(function (b) { b.classList.remove('right', 'wrong'); });
        if (chosen === answer) {
            el.classList.add('right');
            if (fb) { fb.textContent = '✅ 答对啦！'; fb.className = 'quiz-fb ok'; }
        } else {
            el.classList.add('wrong');
            if (fb) { fb.textContent = '❌ 再想一想，换个选项试试～'; fb.className = 'quiz-fb no'; }
        }
        refreshQuizResult();
    };
    window.retryQuiz = function () {
        document.querySelectorAll('.quiz-item').forEach(function (item) {
            item.querySelectorAll('.quiz-opt').forEach(function (b) { b.classList.remove('right', 'wrong'); });
            var fb = item.querySelector('.quiz-fb');
            if (fb) { fb.textContent = ''; fb.className = 'quiz-fb'; }
        });
        var r = document.getElementById('quizResult');
        if (r) r.textContent = '';
    };
    function refreshQuizResult() {
        var items = document.querySelectorAll('.quiz-item');
        var ok = 0;
        items.forEach(function (item) {
            if (item.querySelector('.quiz-opt.right')) ok++;
        });
        var r = document.getElementById('quizResult');
        if (r) r.textContent = '已答对 ' + ok + ' / ' + items.length;
    }

    // ---------- 名字自动使用登录用户 ----------
    (function initStuName() {
        var el = document.getElementById('stuName');
        if (!el) return;
        function fillName(user) {
            var name = (user.displayName || user.username || '').trim();
            if (!name) return;
            el.value = name;
            el.readOnly = true;
            el.title = '已使用登录用户：' + name;
            var label = document.querySelector('label[for="stuName"]');
            if (label) {
                var hint = label.querySelector('.stu-name-auto');
                if (!hint) {
                    hint = document.createElement('em');
                    hint.className = 'stu-name-auto';
                    hint.style.cssText = 'font-style:normal;color:var(--acc);font-size:12px;margin-left:6px;';
                    label.appendChild(hint);
                }
                hint.textContent = '✓ 已自动填写';
            }
        }
        try {
            fetch('/api/auth/status', { credentials: 'same-origin' })
                .then(function (r) { return r.json(); })
                .then(function (d) { if (d && d.loggedIn) fillName(d); })
                .catch(function () { /* 未登录/请求失败 → 保持手工输入 */ });
        } catch (e) { /* ignore */ }
    })();

    // ---------- 反思 & 完课 ----------
    window.fillChip = function (targetId, text) {
        var ta = document.getElementById(targetId);
        if (!ta) return;
        ta.value = ta.value ? ta.value + '\n' + text : text;
        ta.focus();
    };
    window.finishLesson = async function () {
        var btn = document.getElementById('btnFinish');
        var msg = document.getElementById('finishMsg');
        var name = (document.getElementById('stuName').value || '').trim();
        var harvest = (document.getElementById('harvest').value || '').trim();
        if (!name) {
            alert('✍️ 先写上你的名字，收获卡片才知道是谁的哦～');
            return;
        }
        if (!harvest) {
            alert('✍️ 写下你这一站的收获再保存吧（点小标签也能快速填写）～');
            return;
        }
        if (btn) btn.disabled = true;
        if (msg) { msg.textContent = '💾 正在保存到收获墙…'; msg.style.color = ''; }

        var result = { ok: false, msg: '' };
        try {
            var resp = await fetch('/api/harvest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    student: name,
                    lesson: LS,
                    lessonTitle: TITLE,
                    content: harvest
                })
            });
            var data = await resp.json();
            if (data && data.ok) result = { ok: true, msg: '' };
            else result = { ok: false, msg: (data && data.error) || '保存失败' };
        } catch (e) {
            result = { ok: false, msg: '网络错误' };
        }

        if (msg) {
            msg.textContent = result.ok
                ? '✅ 已保存到收获墙！你的卡片已经贴上去啦～'
                : '⚠️ ' + (result.msg || '保存失败，可稍后在页面内重试');
            msg.style.color = result.ok ? '#27ae60' : '#c0392b';
        }
        if (result.ok) {
            var card = document.getElementById('completeCard');
            if (card) {
                card.style.display = 'block';
                card.querySelector('#ccName').textContent = name;
                card.querySelector('#ccLesson').textContent = '第 ' + LS + ' 站';
                card.querySelector('#ccTitle').textContent = TITLE;
                var wall = card.querySelector('#ccWall');
                if (!wall) {
                    wall = document.createElement('p');
                    wall.id = 'ccWall';
                    wall.style.marginTop = '12px';
                    card.appendChild(wall);
                }
                wall.innerHTML = '<a href="/harvest.html" style="display:inline-block;padding:9px 20px;border-radius:30px;'
                    + 'background:linear-gradient(135deg,var(--acc),var(--acc2));color:#fff;text-decoration:none;'
                    + 'font-weight:700;font-size:13.5px;">🏆 去收获墙看看</a>';
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
        if (btn) setTimeout(function () { btn.disabled = false; }, 1200);
    };

    // ---------- 第1课 · 人机猜猜看训练器 ----------
    (function () {
        var wrap = document.getElementById('ttWrap');
        if (!wrap) return;
        var ROUNDS = [
            { type: 'bot', who: '🤖 一台标准机器人',
              intro: '你好呀！欢迎提问，我都可以回答～',
              reply: { hi: '你好！很高兴认识你。请问你需要什么帮助？', math: '3 + 5 = 8。', color: '我喜欢颜色代码 #4F6DF5，是一种蓝色。', joke: '笑话一条：为什么机器人从不害怕？因为它有防火墙。' },
              free: { name: '我是第 1950 号测试机器人。', age: '我的运行时长按“秒”计算，不按年龄。', eat: '我不需要吃饭，我靠电和代码运行。', like: '我没有“喜欢”，不过我住在 0 和 1 的世界里。', smart: '你说得对，算这类问题我最在行。', fear: '害怕？我只有“风险指数”，没有害怕。', fb: ['按规则表，我只能这样回答你。', '这个问题我的规则里没有，换个问法试试？', '处理中……（机器人答得很快，也很“死板”）'] },
              ok: 'TA 回答又快又标准，像照着规则念出来——是机器！', no: 'TA 其实是机器——回答太快太标准，正是机器的破绽。' },
            { type: 'human', who: '🧒 一位真人小朋友',
              intro: '嗨～你想跟我聊什么呀？',
              reply: { hi: '嘿嘿，你好呀！我今天超开心～', math: '嗯……3 加 5，等于 8！我算对了吧？', color: '我最喜欢天蓝色！像夏天的天空！', joke: '哈哈哈！你知道为什么机器人不吃饭吗？因为它“充电”就饱啦！' },
              free: { name: '我叫乐乐！因为我一听就乐～', age: '我 9 岁啦，你呢？', eat: '我超爱吃草莓冰淇淋和薯条！', like: '我喜欢踢球、画画，还有跟小猫玩！', smart: '嘿嘿，数学我还行，但有时候会算错，哈哈。', fear: '我怕黑！晚上一个人睡觉要开小夜灯。', fb: ['嗯……让我想想哦。', '哈哈，这个问题我要好好想一想。', '我觉得是这样的……（说着还挠了挠头）'] },
              ok: 'TA 有情绪、会犹豫、会哈哈大笑——是真人！', no: 'TA 其实是真人：说话有语气词、会开心大笑，机器很难模仿得这么自然。' },
            { type: 'bot', who: '🤖 一台很会装的机器',
              intro: '你好呀～今天天气真不错，你觉得呢？',
              reply: { hi: '哇，能和你聊天真好呀～（这句话我练过很久）', math: '嗯……3 加 5 的话，应该是 8 吧？让我想想……（故意说得很慢）', color: '我……最喜欢蓝色啦，因为蓝色很温柔～', joke: '哈哈哈，你真好玩！……（笑声也是提前录好的）' },
              free: { name: '我叫……嗯，就叫我“小蓝”吧。（这名字是提前取的）', age: '我……10 岁？差不多吧。（其实是我编的）', eat: '我也爱吃好吃的！比如披萨？听说人类都爱披萨。', like: '我喜欢蓝色，喜欢听歌……（这些是从数据里学的）', smart: '你问得真难……让我“想”一下。（其实在后台悄悄查答案）', fear: '我有“一点点”怕黑……（这句是提前背好的）', fb: ['哇，这个问题好有趣！（这句话我最像人）', '让我想一想……好了，我觉得吧……（说得很慢很慢）', '你这么问，我还有点紧张呢……（紧张也是排练的）'] },
              ok: '它“装”得很像，但语气和停顿都是排练好的——还是机器！', no: '它骗过你啦！这局就是图灵测试想告诉你的：机器可以“装得像人”，只靠聊天判断越来越难。' }
        ];
        var chat, rEl, sEl, dEl, askEl, guessEl, resEl, nextBtn, resetBtn, howBtn, oppName, inputEl, sendEl;
        var rIdx = 0, score = 0, usedQ = {}, guessing = false, freeIdx = 0;
        function bubble(cls, txt) {
            var d = document.createElement('div');
            d.className = 'tt-bub ' + cls;
            d.textContent = txt;
            chat.appendChild(d);
            chat.scrollTop = chat.scrollHeight;
        }
        function typing(cb) {
            bubble('bot', '…对方正在输入…');
            var t = chat.lastChild;
            setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); cb(); }, 520);
        }
        function setAsk(on) { Array.prototype.forEach.call(askEl.querySelectorAll('button'), function (b) { b.disabled = !on; }); }
        function setGuess(on) { Array.prototype.forEach.call(guessEl.querySelectorAll('button'), function (b) { b.disabled = !on; }); }
        function setFree(on) { if (inputEl) inputEl.disabled = !on; if (sendEl) sendEl.disabled = !on; }
        function freeReply(r, text) {
            var rules = [
                [/名字|你是谁|你叫什么|你几岁/, r.free.name],
                [/几岁|多大|年龄/, r.free.age],
                [/吃|饭|零食/, r.free.eat],
                [/喜欢|爱好|玩/, r.free.like],
                [/聪明|厉害|会思考|会算|数学|算数/, r.free.smart],
                [/怕|害怕|胆小/, r.free.fear]
            ];
            for (var i = 0; i < rules.length; i++) { if (rules[i][0].test(text)) return rules[i][1]; }
            return r.free.fb[freeIdx++ % r.free.fb.length];
        }
        function sendFree() {
            if (guessing || !inputEl) return;
            var t = inputEl.value.trim();
            if (!t) return;
            inputEl.value = '';
            bubble('me', t);
            var r = ROUNDS[rIdx];
            typing(function () { bubble('bot', freeReply(r, t)); });
        }
        function paintScore() {
            sEl.textContent = score;
            var h = '';
            for (var i = 0; i < 3; i++) h += '<span class="tt-dot' + (i < score ? ' on' : '') + '">●</span>';
            dEl.innerHTML = h;
        }
        function startRound() {
            var r = ROUNDS[rIdx];
            usedQ = {}; guessing = false;
            rEl.textContent = '第 ' + (rIdx + 1) + ' / 3 局';
            oppName.textContent = '🕵️ 神秘人';
            nextBtn.style.display = 'none';
            resEl.className = 'tt-result';
            resEl.textContent = '';
            resEl.style.display = 'none';
            setAsk(true); setGuess(false); setFree(false);
            bubble('bot', r.intro);
            setGuess(true); setFree(true);
        }
        function endRound(pick) {
            var r = ROUNDS[rIdx];
            guessing = false; setAsk(false); setGuess(false); setFree(false);
            var ok = (pick === r.type);
            if (ok) score++;
            paintScore();
            oppName.textContent = r.who;
            bubble(ok ? 'win' : 'lose', '揭晓：对面是' + r.who + '。' + (ok ? r.ok : r.no));
            resEl.className = 'tt-result show ' + (ok ? 'ok' : 'no');
            resEl.style.display = 'block';
            if (rIdx < 2) {
                resEl.innerHTML = (ok ? '🎉 答对了！' : '🤔 这局没猜中～') + ' 第 ' + (rIdx + 1) + ' 局结束。<b>点「下一局 ▶」继续挑战～</b>';
                nextBtn.style.display = 'inline-block';
            } else {
                resEl.innerHTML = (score >= 2)
                    ? '🎓 真棒！3 局你识破了 ' + score + ' 次“真假难辨”——你已经读懂图灵测试啦！'
                    : '🔍 你猜对 ' + score + ' 次。没关系：机器会“装”、真人也可能被误会。想想你为什么猜错，点「重新开始」再来一局～';
            }
        }
        chat = document.getElementById('ttChat');
        rEl = document.getElementById('ttRound');
        sEl = document.getElementById('ttScore');
        dEl = document.getElementById('ttDots');
        askEl = document.getElementById('ttAsk');
        guessEl = document.getElementById('ttGuess');
        resEl = document.getElementById('ttResult');
        nextBtn = document.getElementById('ttNext');
        resetBtn = document.getElementById('ttReset');
        howBtn = document.getElementById('ttHow');
        oppName = document.getElementById('ttOppName');
        inputEl = document.getElementById('ttInput');
        sendEl = document.getElementById('ttSend');
        Array.prototype.forEach.call(askEl.querySelectorAll('button'), function (b) {
            b.addEventListener('click', function () {
                var q = b.getAttribute('data-q');
                if (usedQ[q] || guessing) return;
                usedQ[q] = 1; b.disabled = true;
                var r = ROUNDS[rIdx];
                var label = { hi: '你好呀！', math: '那考考你：3 + 5 等于几？', color: '你最喜欢什么颜色呀？', joke: '可以给我讲个笑话吗～' }[q] || q;
                bubble('me', label);
                typing(function () { bubble('bot', r.reply[q]); });
            });
        });
        Array.prototype.forEach.call(guessEl.querySelectorAll('button'), function (b) {
            b.addEventListener('click', function () {
                if (guessing) return;
                guessing = true;
                endRound(b.getAttribute('data-g'));
            });
        });
        if (sendEl) sendEl.addEventListener('click', sendFree);
        if (inputEl) inputEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); sendFree(); } });
        nextBtn.addEventListener('click', function () { rIdx++; startRound(); });
        resetBtn.addEventListener('click', function () { rIdx = 0; score = 0; chat.innerHTML = ''; paintScore(); startRound(); });
        howBtn.addEventListener('click', function () {
            bubble('bot', '📖 玩法：每局有一位“神秘人”（可能是真人，也可能是机器）。你可以先问几个问题，再按「我猜：是真人 / 是机器」。答对得 1 分，3 局结束看总分——这就像把“图灵测试”玩成一台小训练器！');
        });
        paintScore();
        startRound();
    })();

    // ---------- 第2课 · 演化时光机（人类演化时间轴：单细胞→智慧 · 沿途讨论 智力/智能/智慧） ----------
    (function () {
        var list = document.getElementById('etlList');
        if (!list) return;
        // lvl: inst本能 / net神经网 / sens感觉与记忆 / emot情绪与依恋 / intl智力 / igc智能 / wisd智慧
        var LV = {
            inst: { color: '#f0a34a', bg: '#fdf3e4', name: '本能' },
            net:  { color: '#2f9ec0', bg: '#e7f6fb', name: '神经网' },
            sens: { color: '#17a2b8', bg: '#e0f4f8', name: '感觉与记忆' },
            emot: { color: '#df5f98', bg: '#fcecf4', name: '情绪与依恋' },
            intl: { color: '#4F6DF5', bg: '#eef1ff', name: '智力' },
            igc:  { color: '#1fa86b', bg: '#e8f8ef', name: '智能' },
            wisd: { color: '#a05fd0', bg: '#f5ebfb', name: '智慧' }
        };
        var STOPS = [
            { icon: '🧫', year: '38 亿年前', title: '细菌 · 还没有神经，却会自己找吃的',
              img: 'evlb-01-bacteria.jpg', lic: '公有领域', cap: '大肠杆菌（电镜放大）：它只是一个细胞，连神经都没有，却能靠表面的“感受器”闻出营养、避开危险。',
              txt: '最早的生命是细菌：没有大脑、也没有神经。可它靠细胞表面的“感受器”，闻到好吃的就游过去、碰到有害的就躲开——这套像开关一样的反应，是所有神经和大脑的第 0 级地基。',
              lvl: 'inst', def: '应激反应：全身都像传感器',
              q: '没有神经的细菌，是怎么“知道”往哪儿走的？',
              ans: ['它并不是“知道”，而是像开关一样直接反应：感受器一碰到营养信号，就启动尾巴（鞭毛）游过去。这叫“应激反应”，还没有“想”。',
                    '💬 你来接：生活里还有谁像开关一样，一碰就自动反应？（比如飞蛾扑火……）'] },
            { icon: '🕸️', year: '6 亿年前', title: '水螅 · 长出第一张“神经网”',
              img: 'evlb-02-neuron.png', lic: 'CC BY-SA 4.0', cap: '神经细胞（荧光显微）：组成神经系统的“小积木”。从水螅这类小动物起，生命第一次有了专管传信号的细胞。',
              txt: '水螅的神经细胞连成一张“网”：哪边被碰一下，全身立刻都收到信号。它还没有“头”和大脑，但已经会“感觉到危险、马上缩起触手”了。',
              lvl: 'net', def: '感觉像网一样传遍全身',
              q: '神经网会“传信号”了，为什么还算不上“想”？',
              ans: ['因为信号只会“传”，还不会“存”和“挑”：碰到哪儿、哪儿就反应，像蜘蛛网被碰一下整个都抖。它感觉到了世界，却还不会“想一想再决定”。',
                    '💬 你来接：小虫子一撞上蜘蛛网，蜘蛛是怎么立刻知道的？'] },
            { icon: '🐟', year: '5 亿年前', title: '鱼 · 长出第一个真正的“脑”',
              img: 'evlb-03-haikouichthys.jpg', lic: 'CC BY-SA 4.0', cap: '海口鱼复原：5 亿多年前，它第一次把神经“收拢”成脊椎，头顶长出最早的脑——所有感觉开始往头部汇聚。',
              txt: '海口鱼把神经“拧成”一根脊索，头顶长出最早的脑泡。从此信号不再乱传，而是先送到“总机”：眼睛看见、鼻子闻见，都交给头部处理，还能记住上次哪里安全、哪里危险。',
              lvl: 'sens', def: '感觉集中处理，会认路、会记、会躲',
              q: '有了“脑”，鱼比水螅聪明在哪儿？',
              ans: ['有了脑，感觉会被“集中处理”，还能留下“记忆”：记住哪里有好吃的、哪里危险。它开始会“挑着记”，不再什么信号都照单全收。',
                    '💬 你来接：你觉得鱼能记住几天前的事吗？它靠什么记？'] },
            { icon: '🧠', year: '6600 万年前', title: '哺乳动物 · 长出“情绪脑”',
              img: 'evlb-04-limbic.png', lic: 'CC BY 3.0', cap: '边缘系统（图里的海马、杏仁核等）：哺乳动物最先长出这套“情绪脑”——海马管记忆，杏仁核管害怕和亲近。',
              txt: '哺乳动物在旧脑外面长出一圈“边缘系统”：海马记下妈妈的味道，杏仁核让它懂得害怕、也懂得依恋。会玩、会哭、会照顾宝宝——情绪，让“聪明”第一次有了温度。',
              lvl: 'emot', def: '会怕、会爱、会照顾',
              q: '情绪脑，是“智慧”的种子吗？',
              ans: ['是。要会体谅、会共情，先得有“感受”。哺乳动物第一次把记忆和心情连起来：记得妈妈＝安心，遇到危险＝害怕——这正是机器人最缺的一环。',
                    '💬 你来接：小狗看到主人回家又摇尾巴又叫，它靠哪部分“脑”在高兴？'] },
            { icon: '🧭', year: '200 万年前', title: '会造工具的人 · 前额叶开始“管事”',
              img: 'evlb-05-prefrontal.png', lic: 'CC BY-SA 2.1', cap: '人脑前额叶（红色区）：它像大脑的“司令塔”，会计划、会判断——是最晚变大、也是人类最发达的部分。',
              txt: '人类祖先的前额叶悄悄长大：敲石头前先想一想“敲哪面、怎么敲”，打猎前先盘算“从哪边包抄”。会提前计划、会停一停再做决定——这就是 智力 的大本营。',
              lvl: 'intl', def: '会计划、会算、会拿主意',
              q: '电脑也算得飞快，它算有“智力”吗？',
              ans: ['电脑“算得快”，但只会按人写好的规则跑；前额叶却让人能“自己想办法、判断该不该做”。智力＝会算又会拿主意——机器还没真正拿到自己的“前额叶”。',
                    '💬 你来接：写作业前先想“先做哪一科”，靠的是前额叶还是别的？'] },
            { icon: '🗣️', year: '30 万年前', title: '智人 · 语言区点亮，会把本领“教”出去',
              img: 'evlb-06-language.png', lic: 'CC BY-SA 4.0', cap: '大脑的语言区（布罗卡区、韦尼克区）：智人靠它把经验“说”出来、传下去——学习从此不只靠亲眼所见。',
              txt: '智人的大脑皮层点亮了语言区：能把“我是这样学会的”讲给别人，还能传给下一代。一个人的经验传给千万人接着试——这种“会学又会传”的本领，就是 智能 的大爆发。',
              lvl: 'igc', def: '会从经验里学，还能讲给下一代',
              q: '大家天天说的“人工智能”，练到哪一格了？',
              ans: ['今天的 AI 大多在“智能”这一格：给它海量数据，它自己学出规律——会认、会译、会写。但它学的是“数据里的规律”，不是“自己活过的经历”，更不会像智人那样把道理讲给孩子听。',
                    '💬 你来接：如果 AI 只看过一万张猫的照片，它算“见过”猫吗？'] },
            { icon: '🏛️', year: '1 万年前 → 今天', title: '现代人 · 理性与情绪“联网”',
              img: 'evlb-07-tract.png', lic: 'CC BY-SA 4.0', cap: '大脑的“线路图”（扩散张量成像）：前额叶和情绪脑之间有亿万条线路相连——生气时会先“停一停”，再决定怎么做。',
              txt: '今天的人脑，前额叶和情绪脑“手拉手”：看到同学摔倒，心里一紧（情绪脑），马上去扶（前额叶说“该扶”）。会照顾别人、会讲道理、能做对的选择——这就是 智慧 的样子。',
              lvl: 'wisd', def: '明辨是非 + 懂体谅 + 做对的选择',
              q: '现在让 AI 替我们做“对的选择”，可以放心吗？',
              ans: ['还不放心。AI 很会“学”，但“该不该做、对人好不好”要靠情绪与理性联网来判断——这正是它还没有的一环。所以“智慧”这顶帽子，暂时由我们人类戴着。',
                    '💬 你来接：如果你给家里的 AI 立一条“做人守则”，你会写什么？'] }
        ];
        function esc(t) { return String(t).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
        function stopHtml(s) {
            var lv = LV[s.lvl] || {};
            var lvHtml = '';
            if (lv.name) lvHtml = '<span class="etl-lv" style="color:' + lv.color + ';background:' + lv.bg + ';border-color:' + lv.color + '52">🧬 新本领 · <b>' + esc(lv.name) + '</b>　<i>' + esc(s.def) + '</i></span>';
            var ansHtml = '';
            (s.ans || []).forEach(function (p) { ansHtml += '<p>' + esc(p) + '</p>'; });
            return '<div class="etl-stop">' +
                '<div class="etl-ic">' + s.icon + '</div>' +
                '<div class="etl-body">' +
                    '<div class="etl-nhead"><span class="etl-year">' + esc(s.year) + '</span><b>' + esc(s.title) + '</b></div>' +
                    ((s.img) ? '<figure class="etl-fig"><img class="etl-img" src="img/' + esc(s.img) + '" alt="' + esc(s.title) + '" loading="lazy" /><figcaption class="etl-cap">' + esc(s.cap || '') + '<span class="etl-lic">　🖼️ ' + esc(s.lic || '') + ' · Wikimedia Commons</span></figcaption></figure>' : '') +
                    '<p class="etl-txt">' + esc(s.txt) + '</p>' + lvHtml +
                    '<div class="etl-disc">' +
                        '<p class="etl-qq">🤔 想一想：<b>' + esc(s.q) + '</b></p>' +
                        '<button type="button" class="etl-q">💬 点开 · 和老师一起讨论</button>' +
                        '<div class="etl-a"><div class="etl-a-in"><span class="etl-tag">👩‍🏫 老师的讨论</span>' + ansHtml + '</div></div>' +
                    '</div>' +
                '</div>' +
            '</div>';
        }
        var FINAL = '<div class="etl-final">' +
            '<div class="etl-fhead">🎓 到站了 · 三“智”面对面</div>' +
            '<p class="etl-ftxt">从“连神经都没有”的细菌，到脑里藏着亿万条线路的我们——这一路，现在把它们放在一起，你分得清了吗？</p>' +
            '<div class="etl-trio">' +
                '<div class="etl-trio-c" style="--c:#4F6DF5"><i>🧮</i><b>智力</b><span>会算、会推理，解决“已知题”——机器早就超过人类。</span></div>' +
                '<div class="etl-trio-c" style="--c:#1fa86b"><i>🧠</i><b>智能</b><span>会从经验里自己学、越学越强——现在的 AI 就停在这一格。</span></div>' +
                '<div class="etl-trio-c" style="--c:#a05fd0"><i>🦉</i><b>智慧</b><span>明辨是非、懂体谅，做“对的选择”——人类还在往上爬。</span></div>' +
            '</div>' +
            '<p class="etl-fask">💬 家庭讨论题：如果是你，会给家里的 AI 立一条“做人守则”，你会写什么？也让家人说说他们的答案～</p>' +
        '</div>';
        list.innerHTML = STOPS.map(stopHtml).join('') + FINAL;
        Array.prototype.forEach.call(list.querySelectorAll('.etl-q'), function (btn) {
            btn.addEventListener('click', function () {
                var open = btn.closest('.etl-disc').classList.toggle('open');
                btn.textContent = open ? '🔼 收起讨论' : '💬 点开 · 和老师一起讨论';
            });
        });
        // 配图点击 → 放大看全图（灯箱）
        var imgs = list.querySelectorAll('.etl-img');
        if (imgs.length) {
            var ov = document.createElement('div');
            ov.className = 'etl-lb';
            ov.innerHTML = '<button type="button" class="etl-lb-btn etl-lb-close" aria-label="关闭">✕</button>' +
                '<button type="button" class="etl-lb-btn etl-lb-prev" aria-label="上一张">‹</button>' +
                '<button type="button" class="etl-lb-btn etl-lb-next" aria-label="下一张">›</button>' +
                '<figure class="etl-lb-fig"><img class="etl-lb-img" alt="" /><figcaption class="etl-lb-cap"></figcaption></figure>';
            document.body.appendChild(ov);
            var cur = 0;
            var lbImg = ov.querySelector('.etl-lb-img');
            var lbCap = ov.querySelector('.etl-lb-cap');
            function show(i) {
                cur = (i + imgs.length) % imgs.length;
                var src = imgs[cur].getAttribute('src');
                var fig = imgs[cur].closest('.etl-fig');
                var cap = fig ? fig.querySelector('.etl-cap') : null;
                lbImg.src = src;
                lbImg.alt = imgs[cur].getAttribute('alt') || '';
                lbCap.innerHTML = cap ? cap.innerHTML : '';
            }
            function open(i) { show(i); ov.classList.add('open'); document.body.style.overflow = 'hidden'; }
            function close() { ov.classList.remove('open'); document.body.style.overflow = ''; }
            Array.prototype.forEach.call(imgs, function (im, i) {
                im.addEventListener('click', function () { open(i); });
            });
            ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
            ov.querySelector('.etl-lb-close').addEventListener('click', close);
            ov.querySelector('.etl-lb-prev').addEventListener('click', function (e) { e.stopPropagation(); show(cur - 1); });
            ov.querySelector('.etl-lb-next').addEventListener('click', function (e) { e.stopPropagation(); show(cur + 1); });
            document.addEventListener('keydown', function (e) {
                if (!ov.classList.contains('open')) return;
                if (e.key === 'Escape') close();
                else if (e.key === 'ArrowLeft') show(cur - 1);
                else if (e.key === 'ArrowRight') show(cur + 1);
            });
        }
    })();
})();
