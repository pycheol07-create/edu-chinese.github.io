import { allPatterns as patternsData } from './patterns.js';

let allPatterns = patternsData;
let learningCounts = {};
const audioCache = {};
let currentAudio = null;
let currentPlayingButton = null;
let conversationHistory = [];

// DOM 요소 참조
const patternContainer = document.getElementById('pattern-container');
const newPatternBtn = document.getElementById('new-pattern-btn');
const allPatternsBtn = document.getElementById('all-patterns-btn');
const currentDateEl = document.getElementById('current-date');

// --- 로컬 데이터 관리 ---
function initializeCounts() {
  const stored = localStorage.getItem('chineseLearningCounts');
  learningCounts = stored ? JSON.parse(stored) : {};
}
function saveCounts() {
  localStorage.setItem('chineseLearningCounts', JSON.stringify(learningCounts));
}
function cleanupOldStorage() {
  const now = Date.now();
  const lastClean = localStorage.getItem('storageCleanTime');
  if (!lastClean || now - lastClean > 1000 * 60 * 60 * 24 * 30) {
    localStorage.removeItem('dailyChinesePatterns');
    localStorage.setItem('storageCleanTime', now);
  }
}
cleanupOldStorage();

// --- 오늘 날짜 ---
function getTodayString() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
}
function displayDate() {
  const t = new Date();
  currentDateEl.textContent = `${t.getFullYear()}년 ${t.getMonth()+1}월 ${t.getDate()}일`;
}

// --- 패턴 렌더링 ---
function renderPatterns(patterns) {
  patternContainer.innerHTML = patterns.map((p, i) => {
    const exHTML = p.examples.map(ex => `
      <div class="mt-3">
        <div class="flex items-center">
          <p class="text-lg chinese-text text-gray-800">${ex.chinese}</p>
        </div>
        <p class="text-sm text-gray-500">${ex.pinyin}</p>
        <p class="text-md text-gray-600">${ex.korean}</p>
      </div>`).join('');
    const vocabHTML = p.vocab?.map(v => `
      <div class="flex items-baseline">
        <p class="w-1/3 text-md chinese-text text-gray-700 font-medium">${v.word}</p>
        <p class="w-1/3 text-sm text-gray-500">${v.pinyin}</p>
        <p class="w-1/3 text-sm text-gray-600">${v.meaning}</p>
      </div>`).join('') || '';
    return `
      <div class="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition mb-6">
        <div class="flex justify-between items-center mb-3">
          <h2 class="text-2xl font-bold text-gray-800 chinese-text">${p.pattern}</h2>
          <button class="learn-btn bg-yellow-400 hover:bg-yellow-500 text-white text-sm font-bold py-1 px-3 rounded-full" data-pattern="${p.pattern}">학습 완료!</button>
        </div>
        <p class="text-blue-700 font-semibold mb-2">${p.meaning}</p>
        <p class="text-sm text-gray-500 bg-gray-100 p-2 rounded-md mb-3">${p.structure || ''}</p>
        <div class="mt-2">${exHTML}</div>
        ${vocabHTML ? `<div class="mt-4"><h3 class="font-bold">📌 주요 단어</h3>${vocabHTML}</div>`:''}
      </div>`;
  }).join('');
}

// --- 오늘 패턴 표시 ---
function loadDailyPatterns() {
  const today = getTodayString();
  const stored = JSON.parse(localStorage.getItem('dailyChinesePatterns'));
  if (stored && stored.date === today) {
    renderPatterns(stored.patterns);
  } else {
    const shuffled = [...allPatterns].sort(() => Math.random() - 0.5);
    const newP = shuffled.slice(0,2);
    localStorage.setItem('dailyChinesePatterns', JSON.stringify({ date: today, patterns: newP }));
    renderPatterns(newP);
  }
}

// --- 이벤트 설정 ---
newPatternBtn.addEventListener('click', () => {
  const shuffled = [...allPatterns].sort(() => Math.random() - 0.5);
  const newP = shuffled.slice(0,2);
  localStorage.setItem('dailyChinesePatterns', JSON.stringify({ date: getTodayString(), patterns: newP }));
  renderPatterns(newP);
});
allPatternsBtn.addEventListener('click', () => {
  renderPatterns(allPatterns);
});

// --- 초기화 ---
initializeCounts();
displayDate();
loadDailyPatterns();

console.log("✅ 복구판 main.js 로드 완료");
