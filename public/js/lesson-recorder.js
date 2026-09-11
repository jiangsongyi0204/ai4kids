// 通用课件记录保存工具
// 所有课件通过 CloudRecords.save() 统一保存交互数据到云端
// 同时自动同步到成果仓库 (POST /api/achievements)

// HTML 转义工具
function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// 将 fields 对象构建为成果仓库 bodyHTML
function _buildAchBody(fields) {
    var html = '';
    var keys = Object.keys(fields);
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var v = fields[k];
        html += '<div class="ach-field"><div class="ach-label">' + escapeHTML(k) + '</div><div class="ach-val" style="white-space:pre-wrap;">' + escapeHTML(v) + '</div></div>';
    }
    return html;
}

// 标准成果HTML模板
var _achBaseStyle = '';

const LessonRecorder = {
    // 统一内部方法：保存后同步到成果仓库
    async _saveAndAchieve(courseCode, title, type, fields) {
        var result = await CloudRecords.save({ courseCode: courseCode, type: type, title: title, fields: fields });
        if (result && result.ok) {
            // 异步同步到成果仓库，不阻塞主流程
            var bodyHTML = _buildAchBody(fields);
            var achHTML = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><style>' +
                'body{font-family:"Noto Serif SC",serif;background:#fef9ef;color:#3d2b1f;padding:40px 24px;max-width:600px;margin:0 auto;line-height:2;}' +
                '.ach-icon{font-size:48px;text-align:center;margin-bottom:8px;}' +
                '.ach-title{font-size:20px;font-weight:700;text-align:center;margin-bottom:4px;color:#1a2a6c;}' +
                '.ach-meta{text-align:center;color:#8d6e63;font-size:13px;margin-bottom:20px;border-bottom:2px dashed #d4c5a9;padding-bottom:16px;}' +
                '.ach-field{background:#faf3e0;border-radius:10px;padding:12px 16px;margin:8px 0;}' +
                '.ach-field .ach-label{font-size:12px;color:#8d6e63;font-weight:700;margin-bottom:4px;}' +
                '.ach-field .ach-val{font-size:15px;color:#3d2b1f;}' +
                '</style></head><body>' +
                '<div class="ach-icon">🤖</div>' +
                '<div class="ach-title">' + escapeHTML(title) + '</div>' +
                '<div class="ach-meta">' + new Date().toLocaleDateString('zh-CN') + ' | ' + escapeHTML(courseCode) + '</div>' +
                bodyHTML +
                '</body></html>';
            CloudRecords.saveAchievement(title, achHTML, courseCode, 'general/T01').catch(function(){});
        }
        return result;
    },

    // 保存选择题结果
    async saveChoice(courseCode, title, question, chosen, correct, reason) {
        return this._saveAndAchieve(courseCode, title, '选择题', {
            '题目': question,
            '我的选择': chosen,
            '正确答案': correct || '',
            '得分': chosen === correct ? '✅ 正确' : '❌ 错误',
            '解析': reason || ''
        });
    },

    // 保存判断题结果
    async saveJudge(courseCode, title, question, myAnswer, correctAnswer, reason) {
        return this._saveAndAchieve(courseCode, title, '判断题', {
            '题目': question,
            '我的判断': myAnswer ? '正确' : '错误',
            '正确答案': correctAnswer ? '正确' : '错误',
            '结果': myAnswer === correctAnswer ? '✅ 正确' : '❌ 错误',
            '解析': reason || ''
        });
    },

    // 保存填空题
    async saveFill(courseCode, title, label, content) {
        var fields = {};
        fields[label] = content;
        return this._saveAndAchieve(courseCode, title, '填空题', fields);
    },

    // 保存反思/收获
    async saveReflection(courseCode, title, content) {
        return this._saveAndAchieve(courseCode, title, '学习收获', { '我的收获': content });
    },

    // 构建标准成果HTML文档并保存到成果仓库 (POST /api/achievements)
    async saveAchievementHTML(courseCode, title, bodyHTML, extraStyle) {
        var achHTML = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><style>' +
            'body{font-family:"Noto Serif SC",serif;background:#fef9ef;color:#3d2b1f;padding:40px 24px;max-width:600px;margin:0 auto;line-height:2;}' +
            '.ach-icon{font-size:48px;text-align:center;margin-bottom:8px;}' +
            '.ach-title{font-size:20px;font-weight:700;text-align:center;margin-bottom:4px;color:#1a2a6c;}' +
            '.ach-meta{text-align:center;color:#8d6e63;font-size:13px;margin-bottom:20px;border-bottom:2px dashed #d4c5a9;padding-bottom:16px;}' +
            '.ach-field{background:#faf3e0;border-radius:10px;padding:12px 16px;margin:8px 0;}' +
            '.ach-field .ach-label{font-size:12px;color:#8d6e63;font-weight:700;margin-bottom:4px;}' +
            '.ach-field .ach-val{font-size:15px;color:#3d2b1f;}' +
            (extraStyle || '') +
            '</style></head><body>' +
            '<div class="ach-icon">🤖</div>' +
            '<div class="ach-title">' + escapeHTML(title) + '</div>' +
            '<div class="ach-meta">' + new Date().toLocaleDateString('zh-CN') + ' | ' + escapeHTML(courseCode) + '</div>' +
            bodyHTML +
            '</body></html>';
        return CloudRecords.saveAchievement(title, achHTML, courseCode, 'general/T01');
    },

    // 批量保存（用于多题一起提交）
    async saveBatch(courseCode, type, title, items) {
        return this._saveAndAchieve(courseCode, title, type, {
            '得分': items.filter(function(i) { return i.correct; }).length + ' / ' + items.length,
            '答题详情': JSON.stringify(items.map(function(i) { return {
                question: i.question,
                answer: i.myAnswer,
                correct: i.correct ? '✅' : '❌'
            }; }))
        });
    }
};
