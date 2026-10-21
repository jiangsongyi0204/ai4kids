/* ============================================================
 * MCST 图解 · 井字棋互动
 * 人类执白（先手），AI 执黑（后手，UCT 蒙特卡洛树搜索）
 * 四步：选择 Selection → 扩展 Expansion → 模拟 Simulation → 反向传播 Backpropagation
 * ============================================================ */
(function () {
    'use strict';

    var EMPTY = 0, BLACK = 1, WHITE = 2;
    var LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    var CELL_NAMES = ['左上', '上中', '右上', '左中', '正中', '右中', '左下', '下中', '右下'];
    var UCT_C = 1.4;
    var PHASE_MS = 520;              // 一次搜索里四步之间自动切换的间隔
    var PHASE_NAMES = ['① 选择', '② 扩展', '③ 模拟', '④ 反向传播'];
    var nodeSeq = 1;

    var el = {
        board: document.getElementById('board'),
        status: document.getElementById('status'),
        statusText: document.getElementById('statusText'),
        restart: document.getElementById('restart'),
        sims: document.getElementById('sims'),
        stepMode: document.getElementById('stepMode'),
        thinkMeta: document.getElementById('thinkMeta'),
        decisionEmpty: document.getElementById('decisionEmpty'),
        cands: document.getElementById('cands'),
        iters: document.getElementById('iters'),
        itersMeta: document.getElementById('itersMeta'),
        itersSubMeta: document.getElementById('itersSubMeta'),
        tree: document.getElementById('tree'),
        treeBar: document.getElementById('treeBar'),
        treePrev: document.getElementById('treePrev'),
        treeNext: document.getElementById('treeNext'),
        treePlay: document.getElementById('treePlay'),
        treeStep: document.getElementById('treeStep'),
        treePhase: document.getElementById('treePhase'),
        simsHint: document.getElementById('simsHint')
    };
    var cells = [];

    var state = {
        board: new Array(9).fill(EMPTY),
        turn: WHITE,
        over: false,
        winLine: null,
        thinking: false,
        sims: 100,
        lastTraces: [],
        metaText: '',
        lastTree: [],
        bestId: -1,
        currentTrace: 0,
        treeStep: 0,        // 第几次搜索（1 起）
        treeTotal: 0,
        phase: 0,           // 这次搜索走到第几步：0 选择 / 1 扩展 / 2 模拟 / 3 反向传播
        phaseTimer: null,
        shownRows: 0,
        treeTimer: null,
        stepMode: false,
        pendingMove: -1,
        timers: []
    };

    /* ---------------- 规则 ---------------- */
    function resultOf(b) {
        for (var i = 0; i < LINES.length; i++) {
            var L = LINES[i];
            if (b[L[0]] !== EMPTY && b[L[0]] === b[L[1]] && b[L[0]] === b[L[2]]) return { winner: b[L[0]], line: L };
        }
        for (var j = 0; j < 9; j++) if (b[j] === EMPTY) return null;
        return { winner: 0, line: null };
    }

    function movesOf(b) {
        var out = [];
        for (var i = 0; i < 9; i++) if (b[i] === EMPTY) out.push(i);
        return out;
    }

    function other(p) { return p === BLACK ? WHITE : BLACK; }
    function colorName(p) { return p === BLACK ? '黑棋' : '白棋'; }
    function scoreFor(player, winner) { return winner === 0 ? 0.5 : (winner === player ? 1 : 0); }
    function shuffle(a) {
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
    }

    /* ---------------- MCTS 内核 ---------------- */
    function makeNode(board, player, parent, move) {
        return {
            id: nodeSeq++,
            pid: parent ? parent.id : -1,
            board: board,
            player: player,
            parent: parent,
            move: move,
            children: [],
            untried: shuffle(movesOf(board)),
            visits: 0,
            wins: 0
        };
    }

    function bestUCT(node) {
        var logN = Math.log(node.visits || 1);
        var best = null, bestVal = -Infinity;
        for (var i = 0; i < node.children.length; i++) {
            var c = node.children[i];
            // 子节点记录的是「轮到对手走」时的胜率，所以父节点视角要取 1 - rate
            var exploit = c.visits ? 1 - c.wins / c.visits : 1;
            var explore = c.visits ? Math.sqrt(logN / c.visits) : 1;
            var val = exploit + UCT_C * explore;
            if (val > bestVal) { bestVal = val; best = c; }
        }
        return best;
    }

    function rollout(board, player) {
        var b = board.slice();
        var p = player;
        var plies = 0;
        var path = [];
        while (true) {
            var r = resultOf(b);
            if (r) return { winner: r.winner, plies: plies, board: b, path: path };
            var avail = movesOf(b);
            b[avail[Math.floor(Math.random() * avail.length)]] = p;
            p = other(p);
            plies++;
            path.push(b.slice());
        }
    }

    function snapshot(node) {
        return {
            id: node.id, pid: node.pid, move: node.move, player: node.player,
            visits: node.visits, wins: node.wins, board: node.board.slice()
        };
    }

    /** 一次完整迭代：选择 → 扩展 → 模拟 → 反向传播 */
    function iterate(root) {
        var path = [];
        var node = root;
        while (true) {
            path.push(node);
            if (resultOf(node.board)) break;      // 已分胜负 / 平局
            if (node.untried.length > 0) break;   // 还有没试过的走法 → 扩展点
            var next = bestUCT(node);
            if (!next) break;
            node = next;
        }

        var selection = path.map(snapshot);
        var expanded = null;
        var sim = { winner: 0, plies: 0, board: node.board.slice() };

        var term = resultOf(node.board);
        if (term) {
            sim = { winner: term.winner, plies: 0, board: node.board.slice() };
        } else if (node.untried.length > 0) {
            // ② 扩展
            var mv = node.untried.shift();
            var nb = node.board.slice();
            nb[mv] = node.player;
            var child = makeNode(nb, other(node.player), node, mv);
            node.children.push(child);
            node = child;
            path.push(node);
            expanded = snapshot(child);           // 新节点，W / V 都还是 0
            // ③ 模拟
            sim = rollout(node.board, node.player);
        }

        // ④ 反向传播
        for (var n = node; n; n = n.parent) {
            n.visits++;
            n.wins += scoreFor(n.player, sim.winner);
        }

        return {
            selection: selection,
            expanded: expanded,
            sim: sim,
            backprop: path.map(snapshot)          // 回传后的 W / V
        };
    }

    function demoIndices(total) {
        // 次数不多时全部展示；次数很多时按对数采样，避免几千行
        if (total <= 100) {
            var all = [];
            for (var n = 0; n < total; n++) all.push(n);
            return all;
        }
        var base = [0, 1, 3, 10, 30, 100, 300, 1000, 3000];
        var out = [];
        for (var i = 0; i < base.length; i++) {
            var v = Math.min(base[i], total - 1);
            if (out.indexOf(v) < 0) out.push(v);
        }
        if (out.indexOf(total - 1) < 0) out.push(total - 1);
        return out.sort(function (a, b) { return a - b; });
    }

    function mcts(board, aiColor, iterations) {
        nodeSeq = 1;
        var root = makeNode(board.slice(), aiColor, null, -1);
        var marks = demoIndices(iterations);
        var traces = [];
        for (var i = 0; i < iterations; i++) {
            var trace = iterate(root);
            if (marks.indexOf(i) >= 0) {
                trace.n = i;
                traces.push(trace);
            }
        }
        var stats = [];
        var best = null;
        for (var k = 0; k < root.children.length; k++) {
            var ch = root.children[k];
            stats.push({
                move: ch.move,
                visits: ch.visits,
                // 子节点是「对手视角」的胜分，1 - rate 才是 AI 的模拟胜率
                rate: ch.visits ? 1 - ch.wins / ch.visits : 0
            });
            if (!best || ch.visits > best.visits) best = ch;
        }
        stats.sort(function (a, b) { return b.visits - a.visits; });
        return {
            best: best, stats: stats, iterations: iterations, traces: traces,
            tree: serializeTree(root), bestId: best ? best.id : -1,
            rootWins: root.wins, rootVisits: root.visits
        };
    }

    /** 取搜索树的前两层节点（根 + 全部一级候选 + 前 5 个候选各自的 2 个子节点） */
    function serializeTree(root) {
        var out = [];
        out.push(treeSnapshot(root, 0));
        var kids = root.children.slice().sort(function (a, b) { return b.visits - a.visits; });
        for (var i = 0; i < kids.length && i < 9; i++) out.push(treeSnapshot(kids[i], 1));
        for (var j = 0; j < kids.length && j < 5; j++) {
            var gk = kids[j].children.slice().sort(function (a, b) { return b.visits - a.visits; });
            for (var k = 0; k < gk.length && k < 2; k++) out.push(treeSnapshot(gk[k], 2));
        }
        return out;
    }

    function treeSnapshot(n, depth) {
        return {
            id: n.id, pid: n.pid, depth: depth, move: n.move,
            player: n.player, w: n.wins, v: n.visits, board: n.board.slice()
        };
    }

    /* ---------------- 渲染 ---------------- */
    function buildBoard() {
        el.board.innerHTML = '';
        cells = [];
        for (var i = 0; i < 9; i++) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'cell';
            b.dataset.idx = String(i);
            b.setAttribute('role', 'gridcell');
            b.setAttribute('aria-label', CELL_NAMES[i] + '（空格）');
            b.addEventListener('click', onCellClick);
            el.board.appendChild(b);
            cells.push(b);
        }
    }

    function render() {
        for (var i = 0; i < 9; i++) {
            var c = cells[i], v = state.board[i];
            var cls = 'cell';
            if (v !== EMPTY) cls += ' taken';
            if (state.over) cls += ' disabled';
            c.className = cls;
            c.innerHTML = v === EMPTY ? '' : (v === BLACK
                ? '<span class="mark black" aria-hidden="true"></span>'
                : '<span class="mark white" aria-hidden="true"></span>');
            c.setAttribute('aria-label', CELL_NAMES[i] + '（' + (v === EMPTY ? '空格' : colorName(v)) + '）');
            c.setAttribute('aria-disabled', state.over ? 'true' : 'false');
        }
        if (state.winLine) {
            for (var j = 0; j < state.winLine.length; j++) cells[state.winLine[j]].classList.add('win');
        }
    }

    function setStatus(text, tone) {
        el.statusText.textContent = text;
        el.status.className = 'status' + (tone ? ' ' + tone : '');
    }

    function clearTimers() {
        for (var i = 0; i < state.timers.length; i++) window.clearTimeout(state.timers[i]);
        state.timers = [];
    }

    function later(fn, ms) {
        state.timers.push(window.setTimeout(fn, ms));
    }

    function resetPanel() {
        clearTimers();
        stopPhase();
        state.lastTraces = [];
        state.metaText = '';
        state.lastTree = [];
        state.bestId = -1;
        state.currentTrace = 0;
        state.pendingMove = -1;
        stopTreePlay();
        state.treeStep = state.stepMode ? 1 : 0;
        state.treeTotal = 0;
        state.phase = 0;
        state.shownRows = 0;
        if (el.treeStep) el.treeStep.textContent = '—';
        if (el.treePhase) el.treePhase.classList.add('is-hidden');
        renderTree();
        renderIters();
        el.itersMeta.textContent = '等待 AI 思考…';
        el.itersSubMeta.textContent = 'AI 思考后，这里逐条列出每次搜索的四步';
        el.cands.innerHTML = '';
        el.decisionEmpty.style.display = '';
    }

    function fmtNum(v) {
        return String(Math.round(v * 10) / 10);
    }

    function miniBoard(board, isNew) {
        var d = document.createElement('div');
        d.className = 'mini' + (isNew ? ' new' : '');
        for (var i = 0; i < 9; i++) {
            var c = document.createElement('span');
            c.className = 'mc' + (board[i] === BLACK ? ' b' : (board[i] === WHITE ? ' w' : ''));
            d.appendChild(c);
        }
        return d;
    }

    function thumb(node, opts) {
        opts = opts || {};
        var wrap = document.createElement('div');
        wrap.className = 'mnode';
        wrap.appendChild(miniBoard(node.board, opts.isNew));
        if (!opts.noCap) {
            var cap = document.createElement('span');
            cap.className = 'mcap';
            cap.textContent = 'W:' + fmtNum(node.wins) + ' V:' + node.visits + ' P:' + node.pid;
            cap.title = 'W = 胜分（按该节点轮到走棋的一方计）\nV = 访问次数\nP = 父节点编号（-1 表示根节点）';
            wrap.appendChild(cap);
        }
        return wrap;
    }

    function arrowEl() {
        var s = document.createElement('span');
        s.className = 'marr';
        s.textContent = '→';
        return s;
    }

    function badge(text, cls) {
        var s = document.createElement('span');
        s.className = 'mbadge' + (cls ? ' ' + cls : '');
        s.textContent = text;
        return s;
    }

    function statsMap(backprop) {
        var m = {};
        for (var i = 0; i < backprop.length; i++) m[backprop[i].id] = backprop[i];
        return m;
    }

    /** 一次搜索 = 一行：① 选择 → ② 扩展 → ③ 模拟 → ④ 反向传播 */
    function renderIter(t, idx) {
        var row = document.createElement('div');
        row.className = 'iter' + (t.slot === state.currentTrace ? ' is-current' : '');
        if (typeof t.slot === 'number') row.setAttribute('data-slot', String(t.slot));

        var head = document.createElement('div');
        head.className = 'iter-head';
        head.innerHTML = '<b>第 ' + ((typeof t.n === 'number' ? t.n : idx) + 1) + ' 次</b>' +
            (t.expanded
                ? '<span>新节点 #' + t.expanded.id + ' · 父节点 #' + t.expanded.pid + '</span>'
                : '<span>直接走到终局，没有扩展</span>');
        row.appendChild(head);

        var line = document.createElement('div');
        line.className = 'iter-line';
        var map = statsMap(t.backprop);

        line.appendChild(phaseTag('① 选择'));
        if (t.selection.length > 1) {
            for (var i = 0; i < t.selection.length; i++) {
                if (i > 0) line.appendChild(arrowEl());
                var n = t.selection[i];
                var after = map[n.id] || n;
                line.appendChild(thumb({ board: n.board, wins: after.wins, visits: after.visits, pid: n.pid }));
            }
        } else {
            line.appendChild(badge('根节点还有没试过的走法，跳过选择'));
        }

        line.appendChild(arrowEl());
        line.appendChild(phaseTag('② 扩展'));
        if (t.expanded) {
            var ae = map[t.expanded.id] || t.expanded;
            line.appendChild(thumb(
                { board: t.expanded.board, wins: ae.wins, visits: ae.visits, pid: t.expanded.pid },
                { isNew: true }
            ));
            line.appendChild(badge(colorName(other(t.expanded.player)) + ' ' + CELL_NAMES[t.expanded.move] + ' · #' + t.expanded.id));
        } else {
            line.appendChild(badge('已经到终局，不再扩展'));
        }

        line.appendChild(arrowEl());
        line.appendChild(phaseTag('③ 模拟'));
        line.appendChild(thumb({ board: t.sim.board, wins: 0, visits: 0, pid: 0 }, { noCap: true }));
        line.appendChild(badge(resultText(t.sim), simClass(t.sim)));

        line.appendChild(arrowEl());
        line.appendChild(phaseTag('④ 反向传播'));
        var rootAfter = t.backprop[0] || { wins: 0, visits: 0 };
        line.appendChild(badge('路径 ' + t.backprop.length + ' 个节点 · 根 V:' + rootAfter.visits + ' W:' + fmtNum(rootAfter.wins)));

        row.appendChild(line);
        row.addEventListener('click', function () {
            if (typeof t.slot !== 'number') return;
            state.currentTrace = t.slot;
            if (state.stepMode && state.treeTotal) {
                state.treeStep = Math.min(state.treeTotal, t.slot + 1);
                startPhases();
                playPhases();
            } else {
                renderTree();
                renderIters();
            }
        });
        return row;
    }

    function phaseTag(text) {
        var s = document.createElement('span');
        s.className = 'ptag';
        s.textContent = text;
        return s;
    }

    function resultText(sim) {
        return (sim.winner === 0 ? '平局' : colorName(sim.winner) + '胜') + ' · ' + sim.plies + ' 手';
    }

    function simClass(sim) {
        return sim.winner === BLACK ? 'black' : (sim.winner === WHITE ? 'white' : 'draw');
    }

    var SVG_NS = 'http://www.w3.org/2000/svg';
    var NB = 34;            // 树上每个节点的棋盘边长
    var NC = NB / 3;

    function svgEl(tag, attrs) {
        var e = document.createElementNS(SVG_NS, tag);
        for (var k in attrs) {
            if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]);
        }
        return e;
    }

    /** 以 (x, y) 为中心画一个小棋盘；o.move 是这步落子的位置，用圆环标出来 */
    function drawMiniBoard(g, x, y, board, o) {
        var left = x - NB / 2, top = y - NB / 2;
        g.appendChild(svgEl('rect', {
            x: left, y: top, width: NB, height: NB, rx: 6,
            fill: o.fill, stroke: o.stroke, 'stroke-width': o.strokeWidth,
            'stroke-dasharray': o.dash || ''
        }));
        for (var i = 1; i < 3; i++) {
            g.appendChild(svgEl('line', {
                x1: left + NC * i, y1: top + 2.5, x2: left + NC * i, y2: top + NB - 2.5,
                stroke: '#e3e9f9', 'stroke-width': 1
            }));
            g.appendChild(svgEl('line', {
                x1: left + 2.5, y1: top + NC * i, x2: left + NB - 2.5, y2: top + NC * i,
                stroke: '#e3e9f9', 'stroke-width': 1
            }));
        }
        for (var k = 0; k < 9; k++) {
            if (board[k] === EMPTY) continue;
            var cx = left + NC * (k % 3) + NC / 2;
            var cy = top + NC * Math.floor(k / 3) + NC / 2;
            g.appendChild(svgEl('circle', {
                cx: cx, cy: cy, r: 4.2,
                fill: board[k] === BLACK ? '#2b3050' : '#ffffff',
                stroke: board[k] === BLACK ? '#2b3050' : '#98a0c4',
                'stroke-width': 1.1
            }));
        }
        if (o.move >= 0) {
            var mx = left + NC * (o.move % 3) + NC / 2;
            var my = top + NC * Math.floor(o.move / 3) + NC / 2;
            g.appendChild(svgEl('circle', {
                cx: mx, cy: my, r: 6.4, fill: 'none',
                stroke: o.moveStroke, 'stroke-width': 1.5
            }));
        }
    }

    function stopTreePlay() {
        if (state.treeTimer) {
            window.clearInterval(state.treeTimer);
            state.treeTimer = null;
        }
        if (el.treePlay) el.treePlay.textContent = '▶ 单步播放';
    }

    function stopPhase() {
        if (state.phaseTimer) {
            window.clearTimeout(state.phaseTimer);
            state.phaseTimer = null;
        }
    }

    /** 停在 ① 选择：还没点「下一步」时树里只有已经长出来的节点 */
    function startPhases() {
        stopPhase();
        state.phase = 0;
        renderTree();
    }

    /** 从当前阶段起自动演示 ② 扩展 → ③ 模拟 → ④ 反向传播 */
    function playPhases() {
        stopPhase();
        function tick() {
            if (state.phase >= 3) return;
            state.phaseTimer = window.setTimeout(function () {
                state.phase++;
                renderTree();
                tick();
            }, PHASE_MS);
        }
        tick();
    }

    /** 点「下一步」：这次搜索还没演完就先演完，演完了再进下一次搜索 */
    function advance() {
        if (!state.stepMode || !state.treeTotal) return;
        if (state.phase < 3) { playPhases(); return; }
        if (state.treeStep >= state.treeTotal) return;
        state.treeStep++;
        state.phase = 0;
        renderTree();
        playPhases();
    }

    function goStep(delta) {
        if (!state.stepMode || !state.treeTotal) return;
        stopTreePlay();
        if (delta > 0) { advance(); return; }
        stopPhase();
        if (state.treeStep > 1) {
            state.treeStep--;
            state.phase = 3;
        } else {
            state.phase = 0;      // 退回到最初：只有一个根节点
        }
        renderTree();
    }

    function toggleTreePlay() {
        if (state.treeTimer) { stopTreePlay(); return; }
        if (!state.treeTotal || state.treeTotal <= 1) return;
        if (state.treeStep >= state.treeTotal && state.phase >= 3) {
            state.treeStep = 1;
            state.phase = 0;
            renderTree();
        }
        el.treePlay.textContent = '⏸ 暂停';
        advance();
        state.treeTimer = window.setInterval(function () {
            if (state.treeStep >= state.treeTotal && state.phase >= 3) { stopTreePlay(); return; }
            advance();
        }, PHASE_MS * 4 + 320);
    }

    /** 每个节点是在第几次搜索里被创建出来的 */
    function createdMap() {
        var m = {};
        var traces = state.lastTraces || [];
        for (var i = 0; i < traces.length; i++) {
            if (traces[i].expanded) m[traces[i].expanded.id] = i + 1;
        }
        return m;
    }

    /** 完成 k 次搜索后，每个节点的 W / V 分别是多少（用来演示反向传播一点点把数值加上去） */
    function valuesAt(k) {
        var vals = {};
        var traces = state.lastTraces || [];
        for (var i = 0; i < k && i < traces.length; i++) {
            var bp = traces[i].backprop || [];
            for (var j = 0; j < bp.length; j++) vals[bp[j].id] = { w: bp[j].wins, v: bp[j].visits };
        }
        return vals;
    }

    function phaseText(t) {
        if (!t) return '';
        var sel = t.selection;
        var last = sel[sel.length - 1];
        var mover = t.expanded ? colorName(other(t.expanded.player)) : '';
        if (state.phase === 0) {
            return '① 选择：' + (sel.length > 1
                ? '按 UCB 从根局面往下走 ' + (sel.length - 1) + ' 层，走到节点 #' + last.id
                : '根节点还有没试过的走法，不用往下选，直接进入扩展');
        }
        if (state.phase === 1) {
            return '② 扩展：' + (t.expanded
                ? '在 #' + t.expanded.pid + ' 上新增节点 #' + t.expanded.id + '（' + mover + ' ' + CELL_NAMES[t.expanded.move] + '）'
                : '这个节点已经是终局，不再扩展');
        }
        if (state.phase === 2) {
            return '③ 模拟：' + (t.expanded ? '从新节点开始随机下完 → ' : '直接从终局出发 → ') +
                resultText(t.sim);
        }
        return '④ 反向传播：把结果沿原路回传，路径上 ' + t.backprop.length + ' 个节点都 V+1、W+' +
            fmtNum(t.backprop[0] ? t.backprop[0].wins - (valuesAt(state.treeStep - 1)[t.backprop[0].id] || { w: 0 }).w : 0);
    }

    /** 搜索树：根 → 一级候选 → 部分二级节点；一次搜索的四步都在这里演示 */
    function renderTree() {
        var svg = el.tree;
        if (!svg) return;
        while (svg.firstChild) svg.removeChild(svg.firstChild);

        if (el.treeBar) el.treeBar.classList.toggle('is-hidden', !state.stepMode);

        var traces = state.lastTraces || [];
        var base = (state.lastTree || []).slice();
        if (!base.length) {
            if (el.treeStep) el.treeStep.textContent = '—';
            if (el.treePhase) el.treePhase.classList.add('is-hidden');
            return;
        }

        var N = traces.length;
        state.treeTotal = N;
        if (!state.stepMode) {
            state.treeStep = N;
            state.phase = 3;
        } else {
            if (!state.treeStep || state.treeStep < 1) state.treeStep = 1;
            if (state.treeStep > N) state.treeStep = N;
            if (state.phase < 0 || state.phase > 3) state.phase = 0;
            state.currentTrace = state.treeStep - 1;
        }

        var k = state.treeStep, ph = state.phase;
        var t = traces[state.stepMode ? k - 1 : state.currentTrace] || traces[traces.length - 1] || null;
        var created = createdMap();

        // 把这次搜索走过的深层节点补进树里（最多到第 4 层），保证「新节点」能出现在图上
        if (t) {
            var finals = statsMap(t.backprop);
            var pathNodes = t.selection.concat(t.expanded ? [t.expanded] : []);
            var have = {};
            base.forEach(function (n) { have[n.id] = 1; });
            for (var pi = 0; pi < pathNodes.length && pi < 4; pi++) {
                var pn = pathNodes[pi];
                if (have[pn.id]) continue;
                var fin = finals[pn.id] || {};
                base.push({
                    id: pn.id, pid: pn.pid, depth: pi, move: pn.move, player: pn.player,
                    w: typeof fin.wins === 'number' ? fin.wins : pn.wins,
                    v: typeof fin.visits === 'number' ? fin.visits : pn.visits,
                    board: pn.board.slice()
                });
                have[pn.id] = 1;
            }
        }

        base.sort(function (a, b) { return a.id - b.id; });
        var allNodes = base;

        // 还没被搜索到 / 还没被扩展出来的节点先不画
        var nodes = allNodes.filter(function (n) {
            var c = created[n.id];
            if (c && c > k) return false;
            if (t && t.expanded && n.id === t.expanded.id && ph === 0) return false;
            return true;
        });

        var vals = valuesAt(ph === 3 ? k : k - 1);
        function valOf(n) {
            var v = vals[n.id];
            return v ? v : { w: 0, v: 0 };
        }

        if (el.treeStep) {
            el.treeStep.textContent = state.stepMode
                ? '第 ' + k + ' / ' + N + ' 次搜索'
                : '共 ' + N + ' 次搜索';
        }
        if (el.treePrev) el.treePrev.disabled = !state.stepMode || (k <= 1 && ph === 0);
        if (el.treeNext) el.treeNext.disabled = !state.stepMode || (k >= N && ph >= 3);
        if (el.treePhase) {
            if (state.stepMode && t) {
                el.treePhase.classList.remove('is-hidden');
                el.treePhase.textContent = PHASE_NAMES[ph] + ' · ' + phaseText(t).replace(/^[①②③④]\s*[^：]*：/, '');
            } else {
                el.treePhase.classList.add('is-hidden');
                el.treePhase.textContent = '';
            }
        }

        var W = 660;

        var byDepth = {};
        for (var i = 0; i < nodes.length; i++) {
            var d = nodes[i].depth;
            (byDepth[d] = byDepth[d] || []).push(nodes[i]);
        }

        var Y = [30, 108, 186, 258];
        var pos = {};
        var root = (byDepth[0] || [])[0];
        if (root) pos[root.id] = { x: W / 2, y: Y[0] };

        var l1 = byDepth[1] || [];
        for (var a = 0; a < l1.length; a++) {
            pos[l1[a].id] = {
                x: l1.length === 1 ? W / 2 : 46 + (W - 92) * a / (l1.length - 1),
                y: Y[1]
            };
        }

        [2, 3].forEach(function (lv) {
            var items = (byDepth[lv] || []).filter(function (n) { return !!pos[n.pid]; });
            if (!items.length) return;
            items.sort(function (a, b) {
                return (pos[a.pid].x - pos[b.pid].x) || (a.id - b.id);
            });
            var counts = {}, seen = {};
            items.forEach(function (n) { counts[n.pid] = (counts[n.pid] || 0) + 1; });
            var GAP = 48, LO = 24, HI = W - 24;
            items.forEach(function (n) {
                var kk = seen[n.pid] = (seen[n.pid] === undefined ? 0 : seen[n.pid] + 1);
                var off = counts[n.pid] === 1 ? 0 : (kk - (counts[n.pid] - 1) / 2) * GAP;
                n.slotX = Math.max(LO, Math.min(HI, pos[n.pid].x + off));
            });
            for (var i2 = 1; i2 < items.length; i2++) {
                items[i2].slotX = Math.max(items[i2].slotX, items[i2 - 1].slotX + GAP);
            }
            var over = items[items.length - 1].slotX - HI;
            if (over > 0) {
                items.forEach(function (n) { n.slotX -= over; });
            }
            items.forEach(function (n) { pos[n.id] = { x: n.slotX, y: Y[lv] }; });
        });

        var maxY = 0;
        nodes.forEach(function (n) {
            if (pos[n.id]) maxY = Math.max(maxY, pos[n.id].y);
        });
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + (maxY + 52));

        var hi = {};
        var newId = -1;
        if (t) {
            if (ph === 3) {
                t.backprop.forEach(function (s) { hi[s.id] = 1; });
            } else {
                t.selection.forEach(function (s) { hi[s.id] = 1; });
            }
            if (t.expanded && ph >= 1) {
                hi[t.expanded.id] = 1;
                newId = t.expanded.id;
            }
        }

        nodes.forEach(function (n) {
            var p = pos[n.pid], c = pos[n.id];
            if (!p || !c) return;
            var on = hi[n.id] && hi[n.pid];
            svg.appendChild(svgEl('line', {
                x1: p.x, y1: p.y + NB / 2, x2: c.x, y2: c.y - NB / 2,
                stroke: on ? '#5b6ee8' : '#dfe6ff',
                'stroke-width': on ? 2.2 : 1.4
            }));
        });

        nodes.forEach(function (n) {
            var p = pos[n.id];
            if (!p) return;
            var isNew = n.id === newId;
            var on = !!hi[n.id];
            var vv = valOf(n);
            var g = svgEl('g', {});

            var title = svgEl('title', {});
            title.textContent = '节点 #' + n.id + ' · 父节点 #' + n.pid +
                ' · W:' + fmtNum(vv.w) + ' V:' + vv.v +
                (n.move >= 0 ? ' · ' + colorName(other(n.player)) + ' ' + CELL_NAMES[n.move] : ' · 根局面');
            g.appendChild(title);

            drawMiniBoard(g, p.x, p.y, n.board, {
                fill: isNew ? '#fffaf0' : (on ? '#eef2ff' : '#ffffff'),
                stroke: isNew ? '#e8a33d' : (on ? '#5b6ee8' : '#dbe3fb'),
                strokeWidth: isNew ? 2.3 : (on ? 1.9 : 1.2),
                dash: isNew ? '4 3' : '',
                move: n.move,
                moveStroke: isNew ? '#e8a33d' : (on ? '#5b6ee8' : '#c3cbeb')
            });

            var vcap = svgEl('text', {
                x: p.x, y: p.y + NB / 2 + 10, 'text-anchor': 'middle', 'font-size': 8.5,
                'font-weight': 800, fill: on ? '#2f3f8f' : '#6b729a'
            });
            vcap.textContent = 'V' + vv.v;
            g.appendChild(vcap);

            var wcap = svgEl('text', {
                x: p.x, y: p.y + NB / 2 + 19, 'text-anchor': 'middle', 'font-size': 8, fill: '#9aa0bd'
            });
            wcap.textContent = 'W' + fmtNum(vv.w);
            g.appendChild(wcap);

            if (state.bestId === n.id && ph === 3) {
                var star = svgEl('text', {
                    x: p.x + NB / 2 + 5, y: p.y - NB / 2 + 4, 'text-anchor': 'middle', 'font-size': 10
                });
                star.textContent = '⭐';
                g.appendChild(star);
            }

            // ④ 反向传播：路径上的节点标出这次 V+1
            if (ph === 3 && on && state.stepMode) {
                var plus = svgEl('text', {
                    x: p.x, y: p.y + NB / 2 + 29, 'text-anchor': 'middle', 'font-size': 8,
                    'font-weight': 800, fill: '#2f9e6f'
                });
                plus.textContent = 'V+1';
                g.appendChild(plus);
            }

            // ③ 模拟：在新节点下方给出这局的胜负
            if (isNew && ph >= 2 && t && t.sim) {
                var res = svgEl('text', {
                    x: p.x, y: p.y - NB / 2 - 6, 'text-anchor': 'middle', 'font-size': 9,
                    'font-weight': 800, fill: t.sim.winner === 0 ? '#8b90ad' : (t.sim.winner === BLACK ? '#1e2440' : '#5b6ee8')
                });
                res.textContent = (t.sim.winner === 0 ? '平局' : colorName(t.sim.winner) + '胜');
                g.appendChild(res);
            }

            svg.appendChild(g);
        });

        // 单步显示模式：所有搜索都演完，AI 才落子
        if (state.pendingMove >= 0) {
            var finished = k >= N;
            if (!finished) {
                setStatus('单步显示中：继续点「下一步」（第 ' + k + ' / ' + N + ' 次），走完 AI 才落子。', 'thinking');
            } else {
                setStatus('搜索树走完了，AI 落子…', 'thinking');
                stopTreePlay();
                var mv = state.pendingMove;
                state.pendingMove = -1;
                window.setTimeout(function () {
                    if (state.over || state.turn !== BLACK || state.board[mv] !== EMPTY) return;
                    place(mv, BLACK);
                    if (!checkEnd()) setStatus('轮到你（白棋）：点一个空格落子。', 'you');
                }, 260);
            }
        }

        syncIters();
    }

    function renderIters() {
        el.iters.innerHTML = '';
        var traces = state.lastTraces || [];
        if (!traces.length) {
            el.iters.innerHTML = '<p class="iters-empty">AI 每走一步，这里会逐条列出每次搜索的四个步骤（选择 → 扩展 → 模拟 → 反向传播）。</p>';
            return;
        }
        el.itersMeta.textContent = state.metaText;
        for (var k = 0; k < traces.length; k++) el.iters.appendChild(renderIter(traces[k], k));

        var empty = document.createElement('p');
        empty.className = 'iters-empty iters-wait';
        empty.id = 'itersWait';
        empty.textContent = '点「下一步」开始演示第 1 次搜索的四步，记录也会一行一行加上来。';
        el.iters.appendChild(empty);

        state.shownRows = -1;
        syncIters();
    }

    /** 单步显示时，逐次记录也只露出已经演完的那几次搜索 */
    function syncIters() {
        if (!el.iters) return;
        var rows = el.iters.querySelectorAll('.iter');
        var total = state.treeTotal;
        var shown = state.stepMode ? (state.phase >= 3 ? state.treeStep : state.treeStep - 1) : total;
        for (var i = 0; i < rows.length; i++) {
            var slot = Number(rows[i].getAttribute('data-slot'));
            var visible = !state.stepMode || slot < shown;
            rows[i].classList.toggle('is-hidden', !visible);
            rows[i].classList.toggle('is-current', visible && slot === state.currentTrace);
        }
        var wait = document.getElementById('itersWait');
        if (wait) wait.classList.toggle('is-hidden', !state.stepMode || shown > 0);
        if (state.stepMode) {
            el.itersSubMeta.textContent = '已显示 ' + Math.max(0, Math.min(shown, total)) + ' / ' + total +
                ' 条记录 · 点「下一步」一条一条往下加';
        } else {
            el.itersSubMeta.textContent = '共 ' + total + ' 条记录 · 点击某一行可以让搜索树跳到那一次';
        }
        if (state.stepMode && shown > state.shownRows) {
            el.iters.scrollTop = el.iters.scrollHeight;
        }
        state.shownRows = shown;
    }

    function renderTrace(search, elapsed) {
        var traces = search.traces || [];
        var chosen = search.best ? search.best.move : -1;

        state.lastTraces = traces;
        traces.forEach(function (tr, idx) { tr.slot = idx; });
        // 非单步显示时，树上高亮一次「新节点在前两层」的搜索，保证路径和新节点都画得出来
        var pick = 0;
        for (var pi = 0; pi < traces.length; pi++) {
            if (traces[pi].expanded && traces[pi].selection.length <= 2) { pick = pi; break; }
        }
        state.currentTrace = traces.length ? pick : 0;
        state.lastTree = search.tree || [];
        state.bestId = typeof search.bestId === 'number' ? search.bestId : -1;
        stopTreePlay();
        stopPhase();
        state.treeTotal = traces.length;
        state.treeStep = state.stepMode ? 1 : traces.length;
        state.phase = state.stepMode ? 0 : 3;
        state.currentTrace = state.stepMode ? 0 : state.currentTrace;
        state.metaText = '共 ' + search.iterations + ' 次搜索 · ' +
            (traces.length === search.iterations ? '全部展示' : '展示 ' + traces.length + ' 个时间点') +
            ' · ' + elapsed + ' ms';
        if (state.stepMode) startPhases();
        else renderTree();
        renderIters();

        renderCands(search.stats, chosen);
        el.thinkMeta.textContent = '搜索 ' + search.iterations + ' 次 · ' + elapsed + ' ms';

        if (state.stepMode) {
            state.pendingMove = search.best ? search.best.move : -1;
            setStatus('AI 已经想好了：点「下一步」把每一次搜索走完，AI 才会落子。', 'thinking');
        }
    }

    function renderCands(stats, bestMove) {
        el.cands.innerHTML = '';
        if (!stats.length) {
            el.decisionEmpty.style.display = '';
            return;
        }
        el.decisionEmpty.style.display = 'none';
        var maxV = stats[0].visits || 1;
        for (var i = 0; i < stats.length && i < 8; i++) {
            var s = stats[i];
            var row = document.createElement('div');
            row.className = 'cand' + (s.move === bestMove ? ' best' : '');

            var b = state.board.slice();
            b[s.move] = BLACK;
            row.appendChild(miniBoard(b));

            var name = document.createElement('span');
            name.className = 'cand-name';
            name.textContent = CELL_NAMES[s.move] + (s.move === bestMove ? ' ⭐' : '');
            row.appendChild(name);

            var bar = document.createElement('span');
            bar.className = 'bar';
            bar.innerHTML = '<i style="width:' + Math.max(2, Math.round(s.visits / maxV * 100)) + '%"></i>';
            row.appendChild(bar);

            var num = document.createElement('span');
            num.className = 'cand-num';
            num.textContent = 'V:' + s.visits + ' · ' + Math.round(s.rate * 100) + '%';
            row.appendChild(num);

            el.cands.appendChild(row);
        }
        var note = document.createElement('p');
        note.className = 'cands-note';
        note.textContent = 'V = 该落点被模拟的次数；百分比 = 模拟中黑棋的胜率（平局算半胜）。访问次数最多的就是 AI 的选择。';
        el.cands.appendChild(note);
    }

    /* ---------------- 对局流程 ---------------- */
    function place(index, player) {
        state.board[index] = player;
        state.turn = other(player);
        render();
    }

    function checkEnd() {
        var r = resultOf(state.board);
        if (!r) return false;
        state.over = true;
        state.winLine = r.line;
        render();
        if (r.winner === 0) setStatus('平局！棋盘满了，谁也没连成三个。', 'draw');
        else if (r.winner === WHITE) setStatus('🎉 你赢了！白棋连成三个。', 'win');
        else setStatus('AI 赢了：黑棋连成三个。再来一局？', 'lose');
        return true;
    }

    function onCellClick(e) {
        var i = Number(e.currentTarget.dataset.idx);
        if (state.over || state.thinking || state.turn !== WHITE) return;
        if (state.board[i] !== EMPTY) return;
        place(i, WHITE);
        if (checkEnd()) return;
        startAI();
    }

    function startAI() {
        if (state.over || state.thinking) return;
        state.thinking = true;
        setStatus('AI（黑棋）正在思考：选择 → 扩展 → 模拟 → 反向传播…', 'thinking');
        el.thinkMeta.textContent = '模拟中…';
        later(runSearch, 120);
    }

    function runSearch() {
        if (state.over) { state.thinking = false; return; }
        var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
        var search = mcts(state.board, BLACK, state.sims);
        var t1 = (window.performance && performance.now) ? performance.now() : Date.now();
        var elapsed = Math.round(t1 - t0);
        state.thinking = false;

        if (!search.best) {
            state.over = true;
            render();
            setStatus('棋盘已满，游戏结束。', 'draw');
            return;
        }

        renderTrace(search, elapsed);

        if (state.stepMode) return;   // 等用户把搜索树一步一步走完，再落子

        place(search.best.move, BLACK);
        if (checkEnd()) return;
        setStatus('轮到你（白棋）：点一个空格落子。', 'you');
    }

    function newGame() {
        clearTimers();
        state.board = new Array(9).fill(EMPTY);
        state.turn = WHITE;
        state.over = false;
        state.winLine = null;
        state.thinking = false;
        state.sims = Number(el.sims.value) || 100;
        resetPanel();
        el.thinkMeta.textContent = '等待开局';
        render();
        setStatus('轮到你（白棋，先手）：点一个空格落子。', 'you');
    }

    /* ---------------- 初始化 ---------------- */
    function updateSimsHint() {
        var n = Number(el.sims.value) || 100;
        el.simsHint.textContent = n <= 20 ? '（次数很少：AI 只有十几次模拟，落子会比较随意）' : '';
    }

    buildBoard();
    render();
    el.restart.addEventListener('click', newGame);
    el.sims.addEventListener('change', function () {
        state.sims = Number(el.sims.value) || 100;
        updateSimsHint();
    });
    el.stepMode.addEventListener('change', function () {
        state.stepMode = el.stepMode.checked;
        stopTreePlay();
        stopPhase();
        if (state.stepMode && state.treeTotal) {
            state.treeStep = 1;
            startPhases();
        } else {
            state.phase = 3;
            state.treeStep = state.treeTotal;
            renderTree();
            renderIters();
        }
    });
    el.treePrev.addEventListener('click', function () { goStep(-1); });
    el.treeNext.addEventListener('click', function () { goStep(1); });
    el.treePlay.addEventListener('click', toggleTreePlay);
    updateSimsHint();

    // 页面打开即开一局（人类先手）
    newGame();
})();
