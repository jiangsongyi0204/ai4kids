/* ============================================================
   ai4kids · 公共脚本 (common.js)
   全站共享的工具函数
   ============================================================ */

/* localStorage 读写（容错） */
function load(k, d){ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch(e){ return d; } }
function save(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }

/* Toast 底部提示 */
let toastTimer;
function toast(msg){
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove('show'), 2400);
}
