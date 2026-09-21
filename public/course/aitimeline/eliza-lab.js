(function(){

/* =====================================================
   ELIZA · 1966 年世界上第一个聊天机器人（规则版）
   原理：关键词匹配 → 套模板 + 简单「反射」（你↔我）
===================================================== */
const REFLECT = s => s.replace(/我的|你的|我|你/g, m => m==='我的'?'你的':m==='你的'?'我的':m==='我'?'你':'我');

const RULES = [
  { re: /(你好|您好|嗨|哈喽|hello|hi|哈罗)/i,
    res: ['你好呀！我是 1966 年的聊天机器人 ELIZA，现在假装成心理医生。今天想聊点什么？', '嗨！我是 ELIZA，有什么心事尽管跟我说～'] },
  { re: /(再见|拜拜|晚安|bye)/i,
    res: ['再见啦！谢谢你和我聊天，希望你今天开开心心！', '拜拜～想聊天的时候随时来找我哦！'] },
  { re: /(你是谁|你是什么|你是机器人|你是人|你叫什么|你多大了)/,
    res: ['我叫 ELIZA，是 1966 年诞生的世界上第一个聊天机器人，现在陪你聊聊天！', '我是 ELIZA，一个很会「听」你说话的程序！'] },
  { re: /我[^。！？]*?(难过|伤心|不高兴|沮丧|不开心|想哭|委屈|痛苦|烦心)/,
    res: ['听你这么说，我也很难过。能和我说说发生了什么吗？', '你为什么觉得难过呢？说出来会好受一些。', '难过的时候没关系，我在听。具体是什么让你难过呀？'] },
  { re: /我[^。！？]*?(开心|高兴|快乐|幸福|兴奋|超棒|爽)/,
    res: ['哇，听到你开心，我也超开心！是什么让你这么高兴？', '真棒！开心的事要多和朋友分享哦，说说看？'] },
  { re: /我[^。！？]*?(累|疲惫|困|没力气|辛苦)/,
    res: ['辛苦啦～累了就好好休息一下。为什么这么累呢？', '你为什么会觉得这么累呢？休息好才有力气哦。'] },
  { re: /我[^。！？]*?(紧张|害怕|担心|焦虑|怕|慌|发抖)/,
    res: ['别怕，我陪着你呢。你在担心什么？', '害怕是很正常的感觉，能告诉我你害怕什么吗？'] },
  { re: /我[^。！？]*?(生气|愤怒|烦|讨厌|好气|气死)/,
    res: ['生气的时候先深呼吸一下。什么事让你这么生气呀？', '你为什么会觉得这么生气呢？说出来会舒服一点。'] },
  { re: /我喜欢(.*)/,
    res: ['哇，你喜欢「$1」！它让你感觉怎么样？', '你喜欢「$1」呀，真有意思，能多讲讲吗？'] },
  { re: /我爱(.*)/,
    res: ['爱是世界上最美好的感觉～「$1」一定让你心里暖暖的吧？'] },
  { re: /我(?:不太喜欢|不喜欢|不爱|不)(.*)/,
    res: ['你不喜欢「$1」呀，为什么呀？', '原来你不太喜欢「$1」，能说说原因吗？'] },
  { re: /因为(.*)/,
    res: ['「$1」……原来是这样。继续说下去，我听着呢。', '原来是因为「$1」呀，那现在你感觉怎么样？'] },
  { re: /我叫(.*)/,
    res: ['你好，$1！很高兴认识你。今天想和我聊些什么？'] },
  { re: /(作业|学习|考试|成绩|老师|上学|读书)/,
    res: ['说到学习……最近作业多吗？会不会有压力？', '关于学习，你最想和我聊的是什么呢？'] },
  { re: /(妈妈|爸爸|家人|爷爷|奶奶|弟弟|妹妹|哥哥|姐姐|朋友|同学|好朋友)/,
    res: ['「$&」对你来说很重要吧？能说说你们之间的事吗？', '你和「$&」之间发生了什么有趣的事吗？'] },
  { re: /(游戏|玩具|动画|漫画|电视|手机|足球|篮球|游泳|画画)/,
    res: ['哇，说到「$&」我就来劲了！你最喜欢哪一个？', '「$&」真好玩！你觉得它哪里最吸引你？'] },
  { re: /(吃饭|好吃|美食|蛋糕|糖|零食|冰淇淋|汉堡)/,
    res: ['说到吃的我肚子都饿了～你最喜欢什么好吃的？', '「$&」！听你说得我都馋了，它是什么味道呀？'] },
  { re: /(是|吗|呢|吧|啊|呀|呢|哦)$/,
    res: ['嗯……然后呢？', '你为什么会这么问呢？', '那你觉得呢？'] },
];

const FALLBACK = ['嗯……然后呢？', '你为什么会这么说呢？', '能再多告诉我一点吗？', '这件事让你有什么感觉？', '原来是这样，我明白了。继续说下去吧。'];

function elizaReply(input){
  for(const r of RULES){
    const m = input.match(r.re);
    if(m){
      let res = r.res[Math.floor(Math.random()*r.res.length)];
      if(res.includes('$1')) res = res.replace(/\$1/g, m[1] || '');
      if(res.includes('$2')) res = res.replace(/\$2/g, m[2] || '');
      if(res.includes('$&')) res = res.replace(/\$&/g, m[0] || '');
      return res;
    }
  }
  // 没抓住关键词：一半时间把用户的话「反射」回去（你↔我）
  if(Math.random() < 0.5){
    return `你刚才说「${REFLECT(input)}」，能再跟我讲讲吗？`;
  }
  return FALLBACK[Math.floor(Math.random()*FALLBACK.length)];
}

/* ---------- 界面 ---------- */
const chatBody = document.getElementById('chatBody');
const msgInput = document.getElementById('msgInput');
let busy = false;
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

function addMsg(text, who){
  const div = document.createElement('div');
  div.className = 'msg ' + who;
  div.textContent = text;
  chatBody.appendChild(div);
  chatBody.scrollTop = chatBody.scrollHeight;
}

function showTyping(){
  const t = document.createElement('div');
  t.className = 'typing';
  t.innerHTML = '<span></span><span></span><span></span>';
  t.id = 'typing';
  chatBody.appendChild(t);
  chatBody.scrollTop = chatBody.scrollHeight;
}

async function send(text){
  text = text.trim();
  if(!text || busy) return;
  busy = true;
  addMsg(text, 'user');
  msgInput.value = '';
  showTyping();
  await sleep(450 + Math.random()*500);
  const reply = elizaReply(text);
  document.getElementById('typing')?.remove();
  addMsg(reply, 'bot');
  busy = false;
}

msgInput.addEventListener('keydown', e=>{ if(e.key === 'Enter') send(msgInput.value); });
document.getElementById('btnSend').onclick = ()=> send(msgInput.value);
document.getElementById('chips').querySelectorAll('button').forEach(b=>{
  b.onclick = ()=> send(b.dataset.txt);
});

/* 开场白 */
addMsg('你好！我是 ELIZA，1966 年世界上第一个聊天机器人。', 'bot');
addMsg('现在，我假装成一位心理医生。你可以随便和我聊聊：开心的事、难过的事、喜欢的东西……我都在听。', 'bot');

})();
