import { allPatterns as patternsData } from './patterns.js';

// 안전한 JSON 파싱 유틸
function safeGetJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`[safeGetJSON] '${key}' 파싱 실패 → 초기화`, e);
    localStorage.removeItem(key);
    return fallback;
  }
}

// 오래된 패턴 자동삭제
function cleanupOldStorage() {
  const now = Date.now();
  const lastClean = localStorage.getItem('storageCleanTime');
  if (!lastClean || now - lastClean > 1000 * 60 * 60 * 24 * 30) {
    console.log("🧹 오래된 데이터 삭제");
    localStorage.removeItem('dailyChinesePatterns');
    localStorage.setItem('storageCleanTime', now);
  }
}
cleanupOldStorage();

// 날짜 표시
const currentDateEl = document.getElementById('current-date');
const patternContainer = document.getElementById('pattern-container');
const newPatternBtn = document.getElementById('new-pattern-btn');
const allPatternsBtn = document.getElementById('all-patterns-btn');

function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function displayDate() {
  const d = new Date();
  currentDateEl.textContent = `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`;
}
displayDate();

// 렌더링 함수
function renderPatterns(patterns) {
  patternContainer.innerHTML = patterns.map(p => `
    <div class="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition">
      <h2 class="text-2xl font-bold chinese-text mb-2">${p.pattern}</h2>
      <p class="text-blue-700 font-semibold mb-3">${p.meaning}</p>
      <div class="mb-3">
        ${(p.examples || []).map(ex => `
          <div class="mb-2">
            <p class="text-lg chinese-text">${ex.chinese}</p>
            <p class="text-sm text-gray-500">${ex.pinyin}</p>
            <p class="text-sm text-gray-600">${ex.korean}</p>
          </div>
        `).join('')}
      </div>
      ${(p.vocab || []).length > 0 ? `<div class="mt-4 border-t pt-2"><h3 class="font-bold mb-2">📌 주요 단어</h3>${p.vocab.map(v => `<div><span class='chinese-text'>${v.word}</span> (${v.pinyin}) - ${v.meaning}</div>`).join('')}</div>`:''}
    </div>
  `).join('');
}

// 오늘 패턴 로드
function loadDailyPatterns() {
  const today = getTodayString();
  const stored = safeGetJSON('dailyChinesePatterns', null);
  if (stored && stored.date === today) {
    renderPatterns(stored.patterns);
  } else {
    const shuffled = [...patternsData].sort(() => Math.random() - 0.5);
    const newP = shuffled.slice(0,2);
    localStorage.setItem('dailyChinesePatterns', JSON.stringify({date: today, patterns: newP}));
    renderPatterns(newP);
  }
}
loadDailyPatterns();

// 버튼 이벤트
newPatternBtn.addEventListener('click', () => {
  const shuffled = [...patternsData].sort(() => Math.random() - 0.5);
  const newP = shuffled.slice(0,2);
  localStorage.setItem('dailyChinesePatterns', JSON.stringify({date: getTodayString(), patterns: newP}));
  renderPatterns(newP);
});
allPatternsBtn.addEventListener('click', () => renderPatterns(patternsData));

console.log("✅ Today_Chinese_Pattern_Final loaded");
