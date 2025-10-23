import { allPatterns as patternsData } from '../data/patterns.js';

let recognition = null;
let isRecognizing = false;

// 오래된 localStorage 자동 정리
function cleanupOldStorage() {
  const now = Date.now();
  const lastClean = +localStorage.getItem('storageCleanTime') || 0;
  if (!lastClean || now - lastClean > 1000 * 60 * 60 * 24 * 30) {
    localStorage.removeItem('dailyChinesePatterns');
    localStorage.setItem('storageCleanTime', String(now));
    console.log('🧹 오래된 localStorage 데이터 정리 완료');
  }
}
cleanupOldStorage();

// Gemini API 호출 함수
async function callGeminiAPI(action, body) {
  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'API 오류');
  }
  return res.json();
}

// 음성 인식 초기화
function initSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    console.warn('SpeechRecognition not supported');
    return;
  }
  recognition = new SR();
  recognition.lang = 'zh-CN';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = (e) => {
    const result = e.results[0][0].transcript;
    document.getElementById('chat-input')?.value = result;
  };
  recognition.onerror = (e) => {
    console.error('Speech recognition error:', e);
    isRecognizing = false;
    document.getElementById('mic-btn')?.classList.remove('is-recording');
    alert('음성 인식 오류: ' + e.error);
  };
  recognition.onend = () => {
    isRecognizing = false;
    document.getElementById('mic-btn')?.classList.remove('is-recording');
    console.log('🎤 음성 인식 종료');
  };
}

// 패턴 렌더링 함수
function renderPatterns(patterns) {
  const container = document.getElementById('pattern-container');
  container.innerHTML = patterns.map(p => `
    <div class="bg-white p-6 rounded-lg shadow mb-4">
      <h2 class="text-2xl font-bold chinese-text mb-1">${p.pattern}</h2>
      <p class="text-blue-700 font-semibold mb-2">${p.meaning}</p>
      ${(p.examples || []).map(ex => `
        <div class="mb-2">
          <p class="chinese-text">${ex.chinese}</p>
          <p class="text-sm text-gray-500">${ex.pinyin}</p>
          <p class="text-sm text-gray-600">${ex.korean}</p>
        </div>`).join('')}
    </div>`).join('');
}

// 오늘의 패턴 로드
function loadDailyPatterns() {
  const today = new Date().toISOString().split('T')[0];
  const stored = JSON.parse(localStorage.getItem('dailyChinesePatterns'));
  if (stored && stored.date === today) {
    renderPatterns(stored.patterns);
  } else {
    const newPatterns = [...patternsData].sort(() => Math.random() - 0.5).slice(0, 2);
    localStorage.setItem('dailyChinesePatterns', JSON.stringify({ date: today, patterns: newPatterns }));
    renderPatterns(newPatterns);
  }
}

// 교정 기능
async function handleCorrection() {
  const input = document.getElementById('correction-input').value.trim();
  const resultDiv = document.getElementById('correction-result');
  if (!input) return alert('교정할 문장을 입력하세요.');
  resultDiv.innerHTML = 'AI 교정 중...';
  try {
    const data = await callGeminiAPI('correction', { text: input });
    const txt = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let parsed;
    try { parsed = JSON.parse(txt); }
    catch { parsed = { corrected: txt, pinyin: '(JSON 파싱 오류)', explanation: 'AI 응답을 이해하지 못했습니다.' }; }
    resultDiv.innerHTML = `<p><b>교정:</b> ${parsed.corrected}</p><p>${parsed.pinyin}</p><p>${parsed.explanation}</p>`;
  } catch (e) {
    resultDiv.innerHTML = `<p class='text-red-500'>교정 오류: ${e.message}</p>`;
  }
}

// DOM 로드 후 초기화
document.addEventListener('DOMContentLoaded', () => {
  loadDailyPatterns();
  initSpeechRecognition();

  // 버튼 이벤트
  document.getElementById('new-pattern-btn')?.addEventListener('click', () => {
    const shuffled = [...patternsData].sort(() => Math.random() - 0.5);
    const newPatterns = shuffled.slice(0, 2);
    localStorage.setItem('dailyChinesePatterns', JSON.stringify({
      date: new Date().toISOString().split('T')[0],
      patterns: newPatterns
    }));
    renderPatterns(newPatterns);
  });

  document.getElementById('all-patterns-btn')?.addEventListener('click', () => renderPatterns(patternsData));

  const micBtn = document.getElementById('mic-btn');
  micBtn?.addEventListener('click', () => {
    if (!recognition) return alert('음성 인식이 지원되지 않습니다.');
    if (isRecognizing) { recognition.stop(); return; }
    try {
      recognition.start();
      isRecognizing = true;
      micBtn.classList.add('is-recording');
    } catch (e) {
      console.error('Speech start error:', e);
      isRecognizing = false;
      micBtn.classList.remove('is-recording');
      alert('음성 인식 시작 실패: ' + e.message);
    }
  });

  document.getElementById('correction-btn')?.addEventListener('click', handleCorrection);
});
