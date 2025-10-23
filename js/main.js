import { allPatterns as patternsData } from '../data/patterns.js';

function safeGetJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('[safeGetJSON] parse fail', e);
    localStorage.removeItem(key);
    return fallback;
  }
}
function saveJSON(k,v){localStorage.setItem(k,JSON.stringify(v));}
function shuffle(a){return [...a].sort(()=>Math.random()-.5);}
function getTodayString(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function displayDate(){const d=new Date();document.getElementById('current-date').textContent=`${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`;}

// Clean old cache
(function(){const now=Date.now();const last=+localStorage.getItem('storageCleanTime')||0;const THIRTY=1000*60*60*24*30;if(!last||now-last>THIRTY){localStorage.removeItem('dailyChinesePatterns');localStorage.setItem('storageCleanTime',String(now));console.log('🧹 cleaned old cache');}})();

const learningKey='chineseLearningCounts';
let learningCounts=safeGetJSON(learningKey,{});
let currentList=[];

function speakChinese(text){
  try{
    const u=new SpeechSynthesisUtterance(text);
    u.lang='zh-CN';u.rate=0.95;window.speechSynthesis.cancel();window.speechSynthesis.speak(u);
  }catch(e){alert('브라우저가 음성 합성을 지원하지 않습니다.');}
}

const container=document.getElementById('pattern-container');
function patternCardHTML(p){
  const ex=(p.examples||[]).map(ex=>`
  <div class='mb-3 p-3 rounded-lg bg-gray-50'>
    <div class='flex items-center justify-between'><p class='text-lg chinese-text'>${ex.chinese}</p>
    <div class='flex gap-1'><button class='btn-tts text-xs border px-2 py-1' data-text='${ex.chinese}'>듣기</button><button class='btn-copy text-xs border px-2 py-1' data-text='${ex.chinese}'>복사</button></div></div>
    <p class='text-sm text-gray-500'>${ex.pinyin||''}</p>
    <p class='text-sm text-gray-600'>${ex.korean||''}</p></div>`).join('');
  const vocab=(p.vocab||[]).map(v=>`<div class='text-sm'><span class='chinese-text font-medium'>${v.word}</span> (${v.pinyin}) - ${v.meaning}</div>`).join('');
  const learned=learningCounts[p.pattern]||0;
  return `<article class='bg-white p-6 rounded-xl shadow'>
  <div class='flex justify-between'><div><h2 class='text-2xl font-bold chinese-text'>${p.pattern}</h2><p class='text-blue-700 font-semibold'>${p.meaning||''}</p></div>
  <div class='text-right'><button class='btn-learn bg-yellow-400 hover:bg-yellow-500 text-white text-xs py-1 px-2 rounded-full' data-pattern='${p.pattern}'>학습 완료</button><div class='text-xs text-gray-500 mt-1'>누적 ${learned}회</div></div></div>
  <div class='mt-3'>${ex}</div>
  ${vocab?`<div class='mt-3 border-t pt-2'><h4 class='font-semibold mb-1'>📌 주요 단어</h4>${vocab}</div>`:''}
  </article>`;
}

function render(list){currentList=list;const limit=Number(document.getElementById('limit-select').value||0);const show=limit>0?list.slice(0,limit):list;container.innerHTML=show.map(patternCardHTML).join('');}
function loadDaily(){const today=getTodayString();const c=safeGetJSON('dailyChinesePatterns',null);if(c&&c.date===today){render(c.patterns);return;}const nl=shuffle(patternsData).slice(0,2);saveJSON('dailyChinesePatterns',{date:today,patterns:nl});render(nl);}
function loadAll(){render(patternsData);}

function search(q){const n=q.toLowerCase();if(!n){loadAll();return;}const r=patternsData.filter(p=>[p.pattern,p.meaning,p.structure].some(x=>x?.toLowerCase().includes(n))||(p.examples||[]).some(ex=>[ex.chinese,ex.korean,ex.pinyin].some(x=>x?.toLowerCase().includes(n))));render(r);}

displayDate();loadDaily();

document.getElementById('new-pattern-btn').addEventListener('click',()=>{const nl=shuffle(patternsData).slice(0,2);saveJSON('dailyChinesePatterns',{date:getTodayString(),patterns:nl});render(nl);});
document.getElementById('all-patterns-btn').addEventListener('click',loadAll);
document.getElementById('limit-select').addEventListener('change',()=>render(currentList));
document.getElementById('clear-search').addEventListener('click',()=>{document.getElementById('search-input').value='';loadAll();});
document.getElementById('search-input').addEventListener('input',e=>search(e.target.value));
container.addEventListener('click',e=>{const t=e.target;if(t.classList.contains('btn-tts'))speakChinese(t.dataset.text);if(t.classList.contains('btn-copy')){navigator.clipboard?.writeText(t.dataset.text);t.textContent='복사됨';setTimeout(()=>t.textContent='복사',1200);}if(t.classList.contains('btn-learn')){const p=t.dataset.pattern;learningCounts[p]=(learningCounts[p]||0)+1;saveJSON(learningKey,learningCounts);t.nextElementSibling.textContent=`누적 ${learningCounts[p]}회`;t.textContent='✔ 완료';setTimeout(()=>t.textContent='학습 완료',1200);}});

console.log('✅ Vercel-ready main.js loaded');
