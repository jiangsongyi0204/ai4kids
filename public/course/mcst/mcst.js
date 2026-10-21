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
    var STEP_MS = 460;

    var el = {
        board: document.getElementById('board'),
        status: document.getElementById('status'),
        statusText: document.getElementById('statusText'),
        restart: document.getElementById('restart'),
        sims: document.getElementById('sims'),
        animate: document.getElementById('animate'),
        thinkMeta: document.getElementById('thinkMeta'),
        decisionEmpty: document.getElementById('decisionEmpty'),
        cands: document.getElementById('cands'),
        dyn: [document.getElementById('dyn1'), document.getElementById('dyn2'), document.getElementById('dyn3'), document.getElementById('dyn4')]
    };
    var stepEls = [].slice.call(document.querySelectorAll('.step'));
    var cells = [];

    var state = {
        board: new Array(9).fill(EMPTY),
        turn: WHITE,
        over: false,
        winLine: null,
        thinking: false,
        sims: 6000,
        animate: true,
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
        while (true) {
            var r = resultOf(b);
            if (r) return { winner: r.winner, plies: plies };
            var avail = movesOf(b);
            b[avail[Math.floor(Math.random() * avail.length)]] = p;
            p = other(p);
            plies++;
        }
    }

    function snapshot(node) {
        return { move: node.move, player: node.player, visits: node.visits, wins: node.wins };
    }

    /** 一次完整迭代：选择 → 扩展 → 模拟 → 反向传播 */
    function iterate(root) {
        var path = [];
        var node = root;
        while (true) {
            path.push(node);
            if (resultOf(node.board)) break;      // 已分胜负 / 平局
            if (node.untried.length > 0) break;   // 还有没试过的走法 → 扩展点
            node = bestUCT(node);
            if (!node) break;
        }

        var selection = path.map(snapshot);
        var expandedMove = -1;
        var expandedPlayer = EMPTY;
        var simWinner = 0;
        var plies = 0;

        var term = resultOf(node.board);
        if (term) {
            simWinner = term.winner;
        } else if (node.untried.length > 0) {
            // ② 扩展
            var mv = node.untried.shift();
            expandedMove = mv;
            expandedPlayer = node.player;
            var nb = node.board.slice();
            nb[mv] = node.player;
            var child = makeNode(nb, other(node.player), node, mv);
            node.children.push(child);
            node = child;
            path.push(node);
            // ③ 模拟
            var sim = rollout(node.board, node.player);
            simWinner = sim.winner;
            plies = sim.plies;
        } else {
            var r2 = resultOf(node.board);
            simWinner = r2 ? r2.winner : 0;
        }

        // ④ 反向传播
        for (var n = node; n; n = n.parent) {
            n.visits++;
            n.wins += scoreFor(n.player, simWinner);
        }

        return {
            selection: selection,
            expandedMove: expandedMove,
            expandedPlayer: expandedPlayer,
            simWinner: simWinner,
            plies: plies,
            backprop: path.map(snapshot)
        };
    }

    function mcts(board, aiColor, iterations) {
        var root = makeNode(board.slice(), aiColor, null, -1);
        var deepest = null;
        var deepestDepth = -1;
        var deepestExpand = null;
        var deepestExpandDepth = -1;
        for (var i = 0; i < iterations; i++) {
            var trace = iterate(root);
            // 选一次「选择」层次最深的迭代做示例，比第 1 次更能看清四步；
            // 优先选真正走完扩展 + 模拟的迭代，四步才都有内容。
            if (trace.selection.length > deepestDepth) {
                deepestDepth = trace.selection.length;
                deepest = trace;
            }
            if (trace.expandedMove >= 0 && trace.selection.length > deepestExpandDepth) {
                deepestExpandDepth = trace.selection.length;
                deepestExpand = trace;
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
        return { best: best, stats: stats, iterations: iterations, trace: deepestExpand || deepest };
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

    function resetSteps() {
        clearTimers();
        for (var i = 0; i < stepEls.length; i++) stepEls[i].classList.remove('is-active', 'is-done');
        for (var j = 0; j < el.dyn.length; j++) el.dyn[j].innerHTML = '<span class="muted">等待 AI 思考…</span>';
        el.cands.innerHTML = '';
        el.decisionEmpty.style.display = '';
    }

    function chipsHTML(nodes) {
        var html = '';
        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            if (i > 0) html += '<span class="arrow">→</span>';
            if (n.move < 0) {
                html += '<span class="chip root">根局面</span>';
            } else {
                html += '<span class="chip">' + colorName(other(n.player)) + ' ' + CELL_NAMES[n.move] + '</span>';
            }
        }
        return html;
    }

    function renderTrace(search, elapsed) {
        var t = search.trace;
        var chosen = search.best ? search.best.move : -1;

        if (!t) {
            el.dyn[0].innerHTML = '<span class="muted">本次没有可用的模拟记录。</span>';
            return;
        }

        // ① 选择
        el.dyn[0].innerHTML =
            '从根局面往下走，每一步都挑「胜率高 + 试得少」的分支：<br>' +
            chipsHTML(t.selection);

        // ② 扩展
        if (t.expandedMove >= 0) {
            el.dyn[1].innerHTML =
                '在末端局面里试一个<b>还没试过</b>的走法，长出新节点：<br>' +
                '<span class="chip new">新增 · ' + colorName(t.expandedPlayer) + ' ' + CELL_NAMES[t.expandedMove] + '</span>';
        } else {
            el.dyn[1].innerHTML = '<span class="muted">这次直接走到了终局局面，不需要扩展。</span>';
        }

        // ③ 模拟
        if (t.expandedMove >= 0) {
            var simText = t.simWinner === 0 ? '<b>平局</b>' : '<b>' + colorName(t.simWinner) + '胜</b>';
            var plyText = t.plies > 0
                ? '从新节点开始，双方随机下完 <b>' + t.plies + '</b> 手 → '
                : '新节点本身已经是终局 → ';
            el.dyn[2].innerHTML = plyText + simText +
                '（这一局按黑棋视角记 ' + scoreFor(BLACK, t.simWinner) + ' 分）';
        } else {
            el.dyn[2].innerHTML = '<span class="muted">终局已知，直接得到结果。</span>';
        }

        // ④ 反向传播
        var back = '';
        for (var i = 0; i < t.backprop.length; i++) {
            var n = t.backprop[i];
            if (i > 0) back += '<span class="arrow">→</span>';
            var label = n.move < 0 ? '根局面' : colorName(other(n.player)) + ' ' + CELL_NAMES[n.move];
            back += '<span class="chip">' + label + ' N=' + n.visits + '</span>';
        }
        el.dyn[3].innerHTML =
            '结果沿原路回传：路径上每个节点的访问次数 N 都 +1，胜分 W 加上这局结果（各按自己那一方计分）。<br>' + back +
            (chosen >= 0 ? '<br>上面的路径只是其中一次迭代。全部模拟结束后，访问次数最多的是 <b>' + CELL_NAMES[chosen] + '</b>，AI 就下这里。' : '');

        // 候选统计
        renderCands(search.stats, chosen);

        el.thinkMeta.textContent = '第 ' + search.iterations + ' 次模拟 · ' + elapsed + ' ms';
        playSteps();
    }

    function renderCands(stats, bestMove) {
        el.cands.innerHTML = '';
        if (!stats.length) {
            el.decisionEmpty.style.display = '';
            return;
        }
        el.decisionEmpty.style.display = 'none';
        var maxV = stats[0].visits || 1;
        for (var i = 0; i < stats.length && i < 6; i++) {
            var s = stats[i];
            var row = document.createElement('div');
            row.className = 'cand' + (s.move === bestMove ? ' best' : '');
            row.innerHTML =
                '<span class="cand-name">' + CELL_NAMES[s.move] + (s.move === bestMove ? ' ⭐' : '') + '</span>' +
                '<span class="bar"><i style="width:' + Math.max(2, Math.round(s.visits / maxV * 100)) + '%"></i></span>' +
                '<span class="cand-num">' + s.visits + ' 次 · ' + Math.round(s.rate * 100) + '%</span>';
            el.cands.appendChild(row);
        }
        var note = document.createElement('p');
        note.className = 'cands-note';
        note.textContent = '访问次数 = AI 在这个落点上模拟了多少局；百分比 = 模拟中黑棋的胜率（平局算半胜）。';
        el.cands.appendChild(note);
    }

    function playSteps() {
        clearTimers();
        for (var i = 0; i < stepEls.length; i++) stepEls[i].classList.remove('is-active', 'is-done');
        if (!state.animate) {
            for (var j = 0; j < stepEls.length; j++) stepEls[j].classList.add('is-done');
            return;
        }
        var idx = 0;
        function next() {
            if (idx > 0) {
                stepEls[idx - 1].classList.remove('is-active');
                stepEls[idx - 1].classList.add('is-done');
            }
            if (idx >= stepEls.length) return;
            stepEls[idx].classList.add('is-active');
            idx++;
            later(next, STEP_MS);
        }
        next();
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
        state.sims = Number(el.sims.value) || 6000;
        state.animate = el.animate.checked;
        resetSteps();
        el.thinkMeta.textContent = '等待开局';
        render();
        setStatus('轮到你（白棋，先手）：点一个空格落子。', 'you');
    }

    /* ---------------- 初始化 ---------------- */
    buildBoard();
    render();
    el.restart.addEventListener('click', newGame);
    el.sims.addEventListener('change', function () { state.sims = Number(el.sims.value) || 6000; });
    el.animate.addEventListener('change', function () { state.animate = el.animate.checked; });

    // 页面打开即开一局（人类先手）
    newGame();
})();
