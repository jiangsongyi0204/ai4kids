"use strict";

const CloudRecords = (function () {
    const API = "/api/exam/records";
    const LOCAL_KEY = "ai_literacy_exam_records";

    function isLocalMode() {
        return window.location.protocol === "file:"
            || ((window.location.hostname === "localhost"
                || window.location.hostname === "127.0.0.1")
                && window.location.port !== ""
                && window.location.port !== "80");
    }

    function getToken() {
        return localStorage.getItem("ai_literacy_token") || "";
    }

    function readTokenUser() {
        var token = getToken();
        if (!token) return null;
        try {
            return JSON.parse(atob(token.split(".")[0] || token));
        } catch (e) {
            return null;
        }
    }

    function readLocalRecords() {
        try {
            return JSON.parse(localStorage.getItem(LOCAL_KEY)) || [];
        } catch (e) {
            return [];
        }
    }

    function saveLocalRecord(payload) {
        var user = readTokenUser() || { username: "anonymous" };
        var now = Date.now();
        var record = Object.assign({}, payload, {
            recordId: "local:" + user.username + ":" + now,
            username: user.username,
            realname: payload.realname || user.realname || "本地用户",
            createdAt: now,
            time: new Date(now).toLocaleString("zh-CN")
        });
        var records = readLocalRecords();
        records.unshift(record);
        if (records.length > 300) records = records.slice(0, 300);
        localStorage.setItem(LOCAL_KEY, JSON.stringify(records));
        return { ok: true, record: record, local: true };
    }

    // ---- 成果仓库保存 (Achievement Warehouse) ----
    var ACH_API = "/api/achievements";

    async function saveAchievement(title, html, courseCode, folder) {
        if (isLocalMode()) {
            // 本地模式也尝试发送（只要服务器在运行即可）
        }
        try {
            var res = await fetch(ACH_API, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + getToken()
                },
                body: JSON.stringify({
                    title: title,
                    html: html,
                    courseCode: courseCode || "",
                    folder: folder || ""
                })
            });
            return await res.json();
        } catch (e) {
            return { ok: false, msg: "网络错误，请稍后重试" };
        }
    }

    async function save(payload) {
        var normalized = Object.assign({
            kind: "learning",
            type: "保存记录",
            title: "学习记录",
            courseCode: "",
            fields: {}
        }, payload || {});

        if (isLocalMode()) {
            return saveLocalRecord(normalized);
        }

        try {
            var res = await fetch(API, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + getToken()
                },
                body: JSON.stringify(normalized)
            });
            return await res.json();
        } catch (e) {
            return { ok: false, msg: "网络错误，请稍后重试" };
        }
    }

    function message(result, successText) {
        if (result && result.ok) return successText || "✅ 已保存到我的记录";
        return "⚠️ " + ((result && result.msg) || "保存失败");
    }

    return {
        save: save,
        saveAchievement: saveAchievement,
        message: message
    };
})();
