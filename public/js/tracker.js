/**
 * 学习行为追踪器 — 前端模块
 * 
 * 功能：
 *   1. 页面进入/离开时自动上报 session_log（时长追踪）
 *   2. 每 5 分钟 idle 心跳
 *   3. 提供 trackEvent() 供业务代码手动埋点
 *
 * 使用方式：
 *   <script src="/js/tracker.js"></script>
 *   然后在课件页面调用：
 *     Tracker.init('E01-L1');          // 页面加载时初始化
 *     Tracker.track('answer_change', { question: 'Q1', from: 'A', to: 'B' });
 */

(function () {
    'use strict';

    var API = '/api/tracker';
    var HEARTBEAT_MS = 5 * 60 * 1000; // 5 分钟

    var courseCode = '';
    var enterTime = 0;
    var heartbeatTimer = null;

    function getToken() {
        return localStorage.getItem('ai_literacy_token') || '';
    }

    function post(path, body) {
        var payload = JSON.stringify(body);
        // 使用 sendBeacon 在页面卸载时也能发送
        if (navigator.sendBeacon) {
            var blob = new Blob([payload], { type: 'application/json' });
            navigator.sendBeacon(API + path, blob);
        } else {
            // 回退到同步 XHR（页面卸载时 fetch 不可靠）
            try {
                var xhr = new XMLHttpRequest();
                xhr.open('POST', API + path, false); // 同步
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.setRequestHeader('Authorization', 'Bearer ' + getToken());
                xhr.send(payload);
            } catch (e) { /* 静默失败 */ }
        }
    }

    function postAsync(path, body) {
        fetch(API + path, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + getToken(),
            },
            body: JSON.stringify(body),
        }).catch(function () { /* 静默失败 */ });
    }

    function sendHeartbeat() {
        if (!courseCode) return;
        postAsync('/session', {
            courseCode: courseCode,
            action: 'idle',
            timestamp: Date.now(),
        });
    }

    /**
     * 初始化追踪器（每个课件页面调用一次）
     * @param {string} code - 课程代码，如 'E01-L1'
     */
    function init(code) {
        courseCode = code;
        enterTime = Date.now();

        // 上报进入事件
        postAsync('/session', {
            courseCode: courseCode,
            action: 'enter',
            timestamp: enterTime,
            pageUrl: window.location.href,
        });

        // 启动心跳
        heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_MS);

        // 页面离开时上报退出
        window.addEventListener('beforeunload', function () {
            if (heartbeatTimer) clearInterval(heartbeatTimer);
            var duration = Math.round((Date.now() - enterTime) / 1000);
            post('/session', {
                courseCode: courseCode,
                action: 'exit',
                timestamp: Date.now(),
                duration: duration,
                pageUrl: window.location.href,
            });
        });

        // 页面隐藏时也上报（移动端切后台）
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                var duration = Math.round((Date.now() - enterTime) / 1000);
                post('/session', {
                    courseCode: courseCode,
                    action: 'exit',
                    timestamp: Date.now(),
                    duration: duration,
                    pageUrl: window.location.href,
                });
            } else {
                // 恢复时重新记录进入
                enterTime = Date.now();
                postAsync('/session', {
                    courseCode: courseCode,
                    action: 'enter',
                    timestamp: enterTime,
                    pageUrl: window.location.href,
                });
            }
        });
    }

    /**
     * 手动埋点
     * @param {string} eventType - 事件类型：'click' | 'scroll_depth' | 'video_play' | 'video_complete' | 'answer_change' | 'retry' | 自定义
     * @param {object} data - 附加数据
     */
    function track(eventType, data) {
        if (!courseCode) return;
        postAsync('/event', {
            courseCode: courseCode,
            eventType: eventType,
            eventData: data || {},
        });
    }

    // 暴露到全局
    window.Tracker = {
        init: init,
        track: track,
    };
})();
