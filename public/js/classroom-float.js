// ============================================================
//  班级悬浮小窗（返回课程后显示在课程页角落）
//  由 server 全局注入到所有 HTML 页面（classroom.html 除外）
//  依赖 sessionStorage：
//    activeClassroom = { classId, className }
//    screenShare   = '1'          （之前正在共享屏幕 → 提供「继续共享」）
//    screenWatch   = {userId,name}（之前正在观看某人屏幕 → 自动打开观看层继续实时看）
//  作用：保持在线（心跳）、显示在线人数、继续共享/观看、点击回到班级
// ============================================================
(function () {
    'use strict';
    if (window.top !== window.self) return; // 处于 iframe 内（班级页的课程 iframe）时不显示浮窗
    if (location.pathname.indexOf('classroom.html') >= 0) return; // 班级页本身不显示

    var raw = null;
    try { raw = sessionStorage.getItem('activeClassroom'); } catch (e) { return; }
    if (!raw) return;
    var info = null;
    try { info = JSON.parse(raw); } catch (e) { return; }
    if (!info || !info.classId) return;

    var classId = info.classId;
    var className = info.className || '班级';
    var wasSharing = false;
    var watchInfo = null;
    try { wasSharing = sessionStorage.getItem('screenShare') === '1'; } catch (e) {}
    try { var wr = sessionStorage.getItem('screenWatch'); if (wr) watchInfo = JSON.parse(wr); } catch (e) {}

    // --- 注入样式 ---
    var css = [
        '#classroomFloat{position:fixed;right:18px;bottom:18px;z-index:2147483000;display:flex;align-items:center;gap:8px;background:#FDFBF7;border:1px solid rgba(0,0,0,0.08);border-radius:40px;padding:8px 12px 8px 16px;box-shadow:0 8px 28px rgba(0,0,0,0.14);cursor:pointer;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;animation:classroomFloatIn .25s ease;-webkit-user-select:none;user-select:none;}',
        '@keyframes classroomFloatIn{from{transform:translateY(20px);opacity:0;}to{transform:translateY(0);opacity:1;}}',
        '#classroomFloat:hover{border-color:rgba(200,168,107,0.4);}',
        '#classroomFloat .cf-dot{width:9px;height:9px;border-radius:50%;background:#27ae60;box-shadow:0 0 0 3px rgba(39,174,96,0.15);flex-shrink:0;}',
        '#classroomFloat .cf-name{font-size:13px;font-weight:800;color:#1A1A1A;max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
        '#classroomFloat .cf-count{font-size:11px;color:#555;background:#F5F0E8;padding:3px 10px;border-radius:20px;font-weight:700;flex-shrink:0;}',
        '#classroomFloat .cf-btn{width:28px;height:28px;border-radius:50%;background:#F5F0E8;color:#333;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:none;cursor:pointer;font-family:inherit;}',
        '#classroomFloat .cf-btn:hover{background:#EDE8DE;}',
        '#classroomFloat .cf-btn.cf-share{color:#fff;background:#e74c3c;}',
        '#classroomFloat .cf-btn.cf-eye{color:#27ae60;}',
        /* 观看弹层 */
        '#classroomFloatViewer{position:fixed;inset:0;background:rgba(0,0,0,0.72);display:none;align-items:center;justify-content:center;z-index:2147483001;padding:20px;pointer-events:none;}',
        '#classroomFloatViewer.show{display:flex;}',
        '#classroomFloatViewer .cfv-box{background:#FDFBF7;border-radius:16px;padding:16px 18px;width:92vw;max-width:1000px;box-shadow:0 8px 28px rgba(0,0,0,0.2);pointer-events:auto;}',
        '#classroomFloatViewer .cfv-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:12px;}',
        '#classroomFloatViewer .cfv-head h3{font-size:15px;font-weight:800;color:#1A1A1A;margin:0;}',
        '#classroomFloatViewer .cfv-close{background:#F5F0E8;border:1px solid rgba(0,0,0,0.08);border-radius:20px;padding:6px 16px;font-size:13px;font-weight:700;cursor:pointer;color:#333;font-family:inherit;}',
        '#classroomFloatViewer .cfv-close:hover{background:#EDE8DE;}',
        '#classroomFloatViewer .cfv-stage{position:relative;width:100%;aspect-ratio:16/9;background:#111;border-radius:10px;overflow:hidden;display:flex;align-items:center;justify-content:center;}',
        '#classroomFloatViewer .cfv-stage img{width:100%;height:100%;object-fit:contain;display:none;}',
        '#classroomFloatViewer .cfv-wait{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#ccc;gap:10px;font-size:14px;text-align:center;}',
        '#classroomFloatViewer .cfv-wait .big{font-size:44px;}',
        '@media (max-width:640px){#classroomFloat{right:10px;bottom:10px;max-width:94vw;}#classroomFloat .cf-name{max-width:90px;}}'
    ].join('\n');
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    // --- 浮窗 DOM ---
    var bubble = document.createElement('div');
    bubble.id = 'classroomFloat';
    bubble.title = '回到班级';
    bubble.innerHTML =
        '<span class="cf-dot"></span>' +
        '<span class="cf-name"></span>' +
        '<span class="cf-count"></span>' +
        (wasSharing ? '<button class="cf-btn cf-share" title="继续共享屏幕">📺</button>' : '') +
        (watchInfo ? '<button class="cf-btn cf-eye" title="观看屏幕">👁</button>' : '') +
        '<span class="cf-btn cf-expand" title="回到班级">↗</span>';
    document.body.appendChild(bubble);
    bubble.querySelector('.cf-name').textContent = className;
    setCount(1);

    function setCount(n) {
        bubble.querySelector('.cf-count').textContent = n + ' 在线';
    }

    // --- 保活：加入 + 心跳 + 成员数 ---
    async function join() {
        try {
            var r = await fetch('/api/classroom/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ classId: classId, className: className })
            });
            var d = await r.json();
            if (d && d.ok) setCount((d.members || []).length);
        } catch (e) {}
    }
    async function heartbeat() {
        try {
            var r = await fetch('/api/classroom/rooms/' + encodeURIComponent(classId) + '/heartbeat', { method: 'POST' });
            var d = await r.json();
            if (d && d.ok === false) join(); // 已被清理则重新加入
        } catch (e) {}
    }
    async function refreshCount() {
        try {
            var r = await fetch('/api/classroom/rooms/' + encodeURIComponent(classId) + '/members');
            var d = await r.json();
            if (d && d.members) setCount(d.members.length);
        } catch (e) {}
    }
    join();
    setInterval(heartbeat, 10000);
    setInterval(refreshCount, 5000);

    // =====================================================
    //  屏幕共享中继（与班级页同一套 WS 协议）
    // =====================================================
    var ws = null;
    var watchingUserId = watchInfo ? watchInfo.userId : null;
    var watchingName = watchInfo ? watchInfo.name : '';

    function connectWS() {
        try {
            var proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
            ws = new WebSocket(proto + location.host + '/ws/classroom?classId=' + encodeURIComponent(classId));
            ws.onopen = function () {
                if (watchingUserId) ws.send(JSON.stringify({ type: 'watch', targetUserId: watchingUserId }));
            };
            ws.onmessage = function (ev) {
                var d;
                try { d = JSON.parse(ev.data); } catch (e) { return; }
                if (d.type === 'frame') handleScreenFrame(d);
                else if (d.type === 'screen-stop') handleScreenStop(d.userId);
            };
            ws.onclose = function () { setTimeout(connectWS, 2000); };
            ws.onerror = function () { try { ws.close(); } catch (e) {} };
        } catch (e) {}
    }

    // ---- 继续共享屏幕（浏览器要求用户手势才能恢复采集）----
    var shareStream = null;
    var shareTimer = null;
    var shareVideo = document.createElement('video');
    shareVideo.muted = true;
    var shareCanvas = document.createElement('canvas');
    var shareCtx = shareCanvas.getContext('2d');
    var shareBtn = bubble.querySelector('.cf-share');

    function captureFrame() {
        if (!shareStream || !shareVideo.videoWidth) return;
        // 最高清晰度：分辨率上限 4096（覆盖4K，等效全原生分辨率），JPEG 质量 1.0（最大，带宽最大）
        var maxW = 4096;
        var scale = Math.min(1, maxW / shareVideo.videoWidth);
        shareCanvas.width = Math.max(1, Math.round(shareVideo.videoWidth * scale));
        shareCanvas.height = Math.max(1, Math.round(shareVideo.videoHeight * scale));
        shareCtx.drawImage(shareVideo, 0, 0, shareCanvas.width, shareCanvas.height);
        var dataUrl;
        try { dataUrl = shareCanvas.toDataURL('image/jpeg', 1.0); } catch (e) { return; }
        if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'share', frame: dataUrl }));
    }
    function startShare() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            var ok = confirm('屏幕共享需要安全连接（HTTPS）。\n当前为 HTTP 访问，浏览器已禁用屏幕共享。\n\n点击「确定」自动切换到 HTTPS 安全地址（首次需在浏览器中信任证书）后重试。');
            if (ok) location.href = 'https://' + location.hostname + location.pathname + location.search;
            return;
        }
        navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 8 }, audio: false })
            .then(function (stream) {
                shareStream = stream;
                shareVideo.srcObject = stream;
                return shareVideo.play();
            })
            .then(function () {
                shareStream.getVideoTracks().forEach(function (t) {
                    t.addEventListener('ended', function () { stopShare(); });
                });
                shareTimer = setInterval(captureFrame, 300);
                try { sessionStorage.setItem('screenShare', '1'); } catch (e) {}
                if (shareBtn) { shareBtn.textContent = '⏹'; shareBtn.title = '停止共享屏幕'; }
            })
            .catch(function () { stopShare(); });
    }
    function stopShare() {
        if (shareTimer) { clearInterval(shareTimer); shareTimer = null; }
        if (shareStream) { shareStream.getTracks().forEach(function (t) { t.stop(); }); shareStream = null; }
        if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'stop' }));
        try { sessionStorage.removeItem('screenShare'); } catch (e) {}
        if (shareBtn) { shareBtn.textContent = '📺'; shareBtn.title = '继续共享屏幕'; }
    }
    if (shareBtn) {
        shareBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (shareStream) stopShare(); else startShare();
        });
    }

    // ---- 观看他人屏幕 ----
    var viewer = null;
    function ensureViewer() {
        if (viewer) return;
        viewer = document.createElement('div');
        viewer.id = 'classroomFloatViewer';
        viewer.innerHTML =
            '<div class="cfv-box">' +
                '<div class="cfv-head"><h3></h3><button class="cfv-close">✕ 关闭</button></div>' +
                '<div class="cfv-stage">' +
                    '<img alt="实时屏幕" />' +
                    '<div class="cfv-wait"><span class="big">🖥️</span><span></span></div>' +
                '</div>' +
            '</div>';
        document.body.appendChild(viewer);
        viewer.querySelector('.cfv-close').addEventListener('click', closeViewer);
    }
    function openViewer() {
        if (!watchInfo) return;
        watchingUserId = watchInfo.userId;
        watchingName = watchInfo.name || '学员';
        ensureViewer();
        viewer.classList.add('show');
        viewer.querySelector('.cfv-head h3').textContent = '👁 ' + watchingName + ' 的屏幕';
        setViewState('waiting', '等待对方共享屏幕…');
        if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'watch', targetUserId: watchingUserId }));
    }
    function closeViewer() {
        if (ws && ws.readyState === 1 && watchingUserId) ws.send(JSON.stringify({ type: 'unwatch' }));
        watchingUserId = null;
        try { sessionStorage.removeItem('screenWatch'); } catch (e) {}
        if (viewer) viewer.classList.remove('show');
    }
    function setViewState(mode, text) {
        if (!viewer) return;
        var img = viewer.querySelector('.cfv-stage img');
        var wait = viewer.querySelector('.cfv-wait');
        if (mode === 'live') {
            img.style.display = 'block';
            wait.style.display = 'none';
        } else {
            img.style.display = 'none';
            wait.style.display = 'flex';
            viewer.querySelector('.cfv-wait span:last-child').textContent = text || '等待对方共享屏幕…';
        }
    }
    function handleScreenFrame(d) {
        if (!viewer || d.userId !== watchingUserId) return;
        viewer.querySelector('.cfv-stage img').src = d.frame;
        setViewState('live');
    }
    function handleScreenStop(userId) {
        if (!viewer || userId !== watchingUserId) return;
        viewer.querySelector('.cfv-stage img').removeAttribute('src');
        setViewState('waiting', '对方已停止共享');
    }

    var eyeBtn = bubble.querySelector('.cf-eye');
    if (eyeBtn) eyeBtn.addEventListener('click', function (e) { e.stopPropagation(); openViewer(); });

    // --- 回到班级 ---
    function goToClassroom() {
        try { sessionStorage.removeItem('activeClassroom'); } catch (e) {}
        location.href = 'classroom.html?classId=' + encodeURIComponent(classId);
    }
    bubble.querySelector('.cf-expand').addEventListener('click', function (e) { e.stopPropagation(); goToClassroom(); });
    bubble.addEventListener('click', function (e) {
        if (e.target.closest('.cf-btn')) return;
        goToClassroom();
    });

    connectWS();
    if (watchInfo) openViewer();
})();
