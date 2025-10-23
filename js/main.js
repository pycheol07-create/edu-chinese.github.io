import { allPatterns as patternsData } from '../data/patterns.js';

let recognition = null;
let isRecognizing = false;
let chatHistory = [
  // 시스템 프롬프트 (필요에 따라 수정)
  {
    role: "model",
    parts: [{ text: "你是我的中文老师。请用中文和我对话。当我用韩语说话时, 请用中文回答我。 (당신은 나의 중국어 선생님입니다. 저와 중국어로 대화해 주세요. 제가 한국어로 말하면 중국어로 대답해 주세요.)" }]
  }
]; // AI 채팅 기록 저장

function cleanupOldStorage() {
  const now = Date.now();
  const last = +localStorage.getItem('storageCleanTime') || 0;
  if (!last || now - last > 1000 * 60 * 60 * 24 * 30) {
    // 오래된 'dailyChinesePatterns' 외에 다른 것도 정리할 수 있습니다.
    localStorage.removeItem('dailyChinesePatterns');
    localStorage.removeItem('patternDate');
    localStorage.setItem('storageCleanTime', String(now));
    console.log('🧹 오래된 스토리지 데이터 정리 완료');
  }
}
cleanupOldStorage();

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

function initSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return console.warn('SpeechRecognition not supported.');
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
    console.log('Speech recognition ended.');
    isRecognizing = false;
    document.getElementById('mic-btn')?.classList.remove('is-recording');
  };
}

/**
 * (기존 함수 유지)
 * 중국어 문장 교정 함수 (현재 HTML에 연결된 버튼이 없음)
 */
async function handleCorrection() {
  // 이 함수는 'correction-input', 'correction-result' ID를 사용합니다.
  // 현재 index.html에는 이 ID들이 없습니다.
  const input = document.getElementById('correction-input')?.value.trim();
  const resultDiv = document.getElementById('correction-result');
  if (!input) return alert('교정할 문장을 입력하세요.');
  if (!resultDiv) return;

  resultDiv.innerHTML = 'AI 교정 중...';
  try {
    const data = await callGeminiAPI('correction', { text: input });
    const txt = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let parsed;
    try {
      parsed = JSON.parse(txt);
    } catch {
      parsed = { corrected: txt, pinyin: '(JSON 파싱 오류)', explanation: 'AI 응답을 이해하지 못했습니다.' };
    }
    resultDiv.innerHTML = `<p><b>교정:</b> ${parsed.corrected}</p><p>${parsed.pinyin}</p><p>${parsed.explanation}</p>`;
  } catch (e) {
    resultDiv.innerHTML = `<p class='text-red-500'>교정 오류: ${e.message}</p>`;
  }
}

/**
 * [신규] 오늘의 패턴을 가져오는 함수 (LocalStorage 기반)
 * @param {number} count - 가져올 패턴 개수
 */
function getDailyPatterns(count = 2) {
  const today = new Date().toDateString();
  const storedDate = localStorage.getItem('patternDate');
  const storedPatterns = localStorage.getItem('dailyChinesePatterns');

  if (storedDate === today && storedPatterns) {
    console.log('🔄 캐시에서 오늘 자 패턴 로드');
    try {
      return JSON.parse(storedPatterns);
    } catch (e) {
      console.error("캐시 파싱 오류:", e);
      // 오류 발생 시 캐시 삭제
      localStorage.removeItem('dailyChinesePatterns');
      localStorage.removeItem('patternDate');
    }
  }

  console.log('✨ 새로운 패턴 생성 중...');
  // 데이터 셔플 (Fisher-Yates shuffle)
  const shuffled = [...patternsData];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const newPatterns = shuffled.slice(0, count);
  localStorage.setItem('dailyChinesePatterns', JSON.stringify(newPatterns));
  localStorage.setItem('patternDate', today);
  
  // cleanupOldStorage에서 사용하는 날짜도 갱신
  localStorage.setItem('storageCleanTime', String(Date.now()));
  return newPatterns;
}

/**
 * [수정] 오늘의 패턴을 렌더링하는 함수
 */
function renderPatterns() {
  const container = document.getElementById('pattern-container');
  if (!container) return;
  
  const dailyPatterns = getDailyPatterns(2); // 2개 가져오기

  if (!dailyPatterns || !dailyPatterns.length) {
    container.innerHTML = '<p>패턴 데이터를 불러오지 못했습니다.</p>';
    return;
  }

  container.innerHTML = dailyPatterns.map(p => `
    <div class='bg-white p-6 rounded-lg shadow mb-4'>
      <h2 class='text-2xl font-bold chinese-text mb-1'>${p.pattern}</h2>
      <p class='text-blue-700 font-semibold mb-2'>${p.meaning}</p>
      ${(p.examples||[]).map(ex => `
        <div class='mb-2'>
          <p class='chinese-text'>${ex.chinese}</p>
          <p class='text-sm text-gray-500'>${ex.pinyin}</p>
          <p class='text-sm text-gray-600'>${ex.korean}</p>
        </div>`).join('')}
    </div>`).join('');
}

/**
 * [신규] '전체 패턴' 모달에 모든 패턴 목록을 렌더링하는 함수
 */
function renderAllPatterns() {
  const listContainer = document.getElementById('all-patterns-list');
  if (!listContainer) return;

  listContainer.innerHTML = patternsData.map((p, index) => `
    <div data-index="${index}" class='all-patterns-list-item py-3 px-2 hover:bg-gray-100 cursor-pointer rounded'>
      <p class='text-lg font-semibold chinese-text'>${p.pattern}</p>
      <p class='text-sm text-gray-600'>${p.meaning}</p>
    </div>
  `).join('');

  // '전체 패턴 보기' 목록에서 특정 패턴 클릭 시 동작
  listContainer.querySelectorAll('.all-patterns-list-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const index = e.currentTarget.dataset.index;
      if (index === null) return;
      
      const selectedPattern = patternsData[+index];
      if (!selectedPattern) return;

      // 메인 컨테이너에 해당 패턴 1개만 렌더링
      const container = document.getElementById('pattern-container');
      if (!container) return;
      
      container.innerHTML = `
        <div class='bg-white p-6 rounded-lg shadow mb-4'>
          <h2 class='text-2xl font-bold chinese-text mb-1'>${selectedPattern.pattern}</h2>
          <p class='text-blue-700 font-semibold mb-2'>${selectedPattern.meaning}</p>
          ${(selectedPattern.examples||[]).map(ex => `
            <div class='mb-2'>
              <p class='chinese-text'>${ex.chinese}</p>
              <p class='text-sm text-gray-500'>${ex.pinyin}</p>
              <p class='text-sm text-gray-600'>${ex.korean}</p>
            </div>`).join('')}
        </div>`;

      // 모달 닫기
      toggleModal('all-patterns-modal', false);
      // 페이지 상단으로 스크롤
      window.scrollTo(0, 0);
    });
  });
}

/**
 * [신규] '번역하기' 모달 기능 처리
 */
async function handleTranslation() {
  const inputEl = document.getElementById('korean-input');
  const resultDiv = document.getElementById('translation-result');
  
  if (!inputEl || !resultDiv) return;
  
  const input = inputEl.value.trim();
  if (!input) return alert('번역할 한국어 문장을 입력하세요.');
  
  resultDiv.innerHTML = '<div class="loader mx-auto"></div><p class="text-center mt-2">AI 번역 중...</p>'; // 로더 표시
  
  try {
    // gemini.js의 'translate' 액션 사용
    const data = await callGeminiAPI('translate', { text: input });
    const translatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '번역 결과를 받지 못했습니다.';
    
    // 번역 결과와 함께 교정 기능도 제안 (gemini.js의 'correction' 액션 사용)
    const correctionData = await callGeminiAPI('correction', { text: translatedText });
    const correctionText = correctionData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    let parsed;
    try {
      parsed = JSON.parse(correctionText);
    } catch {
      // 파싱 실패 시, 번역 결과만 표시
      parsed = { corrected: translatedText, pinyin: '(병음 정보 없음)', explanation: '번역이 완료되었습니다.' };
    }
    
    resultDiv.innerHTML = `
      <p class="text-lg font-semibold chinese-text">${parsed.corrected}</p>
      <p class="text-blue-600 mb-2">${parsed.pinyin}</p>
      <p class="text-gray-700">${parsed.explanation}</p>
    `;
    
  } catch (e) {
    resultDiv.innerHTML = `<p class='text-red-500'>번역 오류: ${e.message}</p>`;
  }
}

/**
 * [신규] 채팅 기록을 화면에 추가하는 함수
 * @param {string} sender - 'user' 또는 'model'
 * @param {string} message - 표시할 메시지
 */
function addMessageToChatHistory(sender, message) {
  const chatHistoryDiv = document.getElementById('chat-history');
  if (!chatHistoryDiv) return;

  const msgDiv = document.createElement('div');
  msgDiv.classList.add('p-3', 'rounded-lg', 'max-w-[80%]');
  
  if (sender === 'user') {
    msgDiv.classList.add('bg-purple-600', 'text-white', 'self-end', 'ml-auto');
    msgDiv.textContent = message;
  } else if (sender === 'model') {
    msgDiv.classList.add('bg-gray-200', 'text-gray-800', 'self-start', 'mr-auto');
    // AI 응답은 중국어 폰트 적용
    msgDiv.classList.add('chinese-text'); 
    msgDiv.textContent = message;
  } else {
    // 시스템 메시지 (로딩 등)
    msgDiv.classList.add('text-gray-500', 'text-sm', 'text-center', 'w-full');
    msgDiv.innerHTML = message;
  }
  
  chatHistoryDiv.appendChild(msgDiv);
  // 새 메시지 추가 시 맨 아래로 스크롤
  chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight;
}

/**
 * [신규] AI 채팅 메시지 전송 처리
 */
async function handleChatSend() {
  const inputEl = document.getElementById('chat-input');
  if (!inputEl) return;
  
  const text = inputEl.value.trim();
  if (!text) return;

  // 1. 사용자 메시지 화면에 표시
  addMessageToChatHistory('user', text);
  // 2. 채팅 기록에 사용자 메시지 추가
  chatHistory.push({ role: "user", parts: [{ text }] });
  
  inputEl.value = ''; // 입력창 비우기
  
  // 3. AI 응답 대기 표시
  addMessageToChatHistory('system', '<div class="loader mx-auto" style="width: 24px; height: 24px; border-width: 3px;"></div>');

  try {
    // 4. gemini.js의 'chat' 액션 호출
    const data = await callGeminiAPI('chat', { 
      history: chatHistory.slice(0, -1), // 현재 사용자 입력을 제외한 기록
      text: text 
    });
    
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '...';
    
    // 5. 채팅 기록에 AI 응답 추가
    chatHistory.push({ role: "model", parts: [{ text: aiResponse }] });
    
    // 6. 로딩 메시지 삭제 (마지막 자식 노드)
    document.getElementById('chat-history')?.lastChild.remove();
    
    // 7. AI 응답 화면에 표시
    addMessageToChatHistory('model', aiResponse);

  } catch (e) {
    // 로딩 메시지 삭제
    document.getElementById('chat-history')?.lastChild.remove();
    addMessageToChatHistory('system', `<p class='text-red-500'>채팅 오류: ${e.message}</p>`);
  }
}

/**
 * [신규] AI 채팅 답변 추천 받기
 */
async function handleSuggestReply() {
  const chatHistoryDiv = document.getElementById('chat-history');
  if (!chatHistoryDiv) return;

  addMessageToChatHistory('system', '💡 AI가 답변 추천 중...');

  try {
    // gemini.js의 'suggest_reply' 액션 호출
    const data = await callGeminiAPI('suggest_reply', { 
      history: chatHistory 
    });
    
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '추천 답변을 생성하지 못했습니다.';
    
    // 로딩 메시지 삭제
    chatHistoryDiv.lastChild.remove();
    
    // 추천 답변 표시 (AI 응답과 다르게 스타일링)
    const suggestions = aiResponse.split('\n').filter(s => s.trim().length > 0);
    
    const suggestionHtml = suggestions.map(s => {
      // 예: "1. 你好 (nǐ hǎo) - 안녕하세요"
      // 간단한 파싱으로 클릭 가능한 버튼 생성
      const textOnly = s.replace(/^\d+\.\s*/, '').split('(')[0].trim();
      return `<button class="suggested-reply-item text-left w-full p-2 bg-blue-100 hover:bg-blue-200 rounded-md mb-2 chinese-text" data-text="${textOnly}">
                ${s}
              </button>`;
    }).join('');
    
    addMessageToChatHistory('system', `<div class="w-full">${suggestionHtml}</div>`);
    
    // 추천 답변 클릭 시 입력창에 채우기
    document.querySelectorAll('.suggested-reply-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const text = e.currentTarget.dataset.text;
        document.getElementById('chat-input').value = text;
        // 추천 답변 목록 삭제
        chatHistoryDiv.lastChild.remove();
      });
    });

  } catch (e) {
    chatHistoryDiv.lastChild.remove();
    addMessageToChatHistory('system', `<p class='text-red-500'>추천 오류: ${e.message}</p>`);
  }
}

/**
 * [신규] 모달 표시/숨김 헬퍼 함수
 * @param {string} modalId - 모달의 ID
 * @param {boolean} show - true: 표시, false: 숨김
 */
function toggleModal(modalId, show) {
  const modal = document.getElementById(modalId);
  if (modal) {
    if (show) {
      modal.classList.remove('hidden');
    } else {
      modal.classList.add('hidden');
    }
  }
}


/**
 * [수정] DOM 로드 완료 시 실행
 */
document.addEventListener('DOMContentLoaded', () => {
  // --- 1. 초기 렌더링 ---
  renderPatterns(); // '오늘의 패턴' 렌더링
  initSpeechRecognition(); // 음성 인식 초기화
  renderAllPatterns(); // '전체 패턴' 모달 내용 미리 렌더링

  // 헤더에 오늘 날짜 표시
  const dateEl = document.getElementById('current-date');
  if (dateEl) {
     const today = new Date();
     dateEl.textContent = today.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
     });
  }

  // --- 2. 모달 열기/닫기 버튼 ---
  // '번역하기' 모달
  document.getElementById('open-translator-btn')?.addEventListener('click', () => {
    toggleModal('translator-modal', true);
  });
  document.getElementById('close-translator-btn')?.addEventListener('click', () => {
    toggleModal('translator-modal', false);
  });

  // 'AI와 대화하기' 모달
  document.getElementById('open-chat-btn')?.addEventListener('click', () => {
    toggleModal('chat-modal', true);
  });
  document.getElementById('close-chat-btn')?.addEventListener('click', () => {
    toggleModal('chat-modal', false);
  });

  // '전체 패턴 보기' 모달
  document.getElementById('all-patterns-btn')?.addEventListener('click', () => {
    toggleModal('all-patterns-modal', true);
  });
  document.getElementById('close-all-patterns-btn')?.addEventListener('click', () => {
    toggleModal('all-patterns-modal', false);
  });
  
  // (커스텀 알림 모달 - 필요시 사용)
  document.getElementById('custom-alert-close-btn')?.addEventListener('click', () => {
    toggleModal('custom-alert-modal', false);
  });
  
  // 모달 외부 배경 클릭 시 닫기
  document.querySelectorAll('.fixed.inset-0.bg-black.bg-opacity-50').forEach(modalBackdrop => {
    modalBackdrop.addEventListener('click', (e) => {
      // 클릭된 대상이 정확히 배경(backdrop)일 때만 닫힘
      if (e.target === modalBackdrop) {
        modalBackdrop.classList.add('hidden');
      }
    });
  });

  // --- 3. 메인 기능 버튼 ---
  // '새로운 패턴 보기'
  document.getElementById('new-pattern-btn')?.addEventListener('click', () => {
    console.log('🔄 새로운 패턴 버튼 클릭');
    // 날짜와 캐시를 강제로 삭제
    localStorage.removeItem('dailyChinesePatterns');
    localStorage.removeItem('patternDate');
    // 패턴 다시 렌더링
    renderPatterns();
    // 페이지 상단으로 스크롤
    window.scrollTo(0, 0);
  });
  
  // '번역하기' 모달 내부의 '번역' 버튼
  document.getElementById('translate-btn')?.addEventListener('click', handleTranslation);

  // --- 4. 채팅 모달 내부 기능 ---
  // '전송' 버튼
  document.getElementById('send-chat-btn')?.addEventListener('click', handleChatSend);
  // 'Enter' 키로 전송
  document.getElementById('chat-input')?.addEventListener('keypress', (e) => {
     if(e.key === 'Enter' && !e.shiftKey) { // Shift+Enter는 줄바꿈
       e.preventDefault(); // 기본 Enter 동작(줄바꿈) 방지
       handleChatSend();
     }
  });
  
  // '답변 추천받기' 버튼
  document.getElementById('suggest-reply-btn')?.addEventListener('click', handleSuggestReply);

  // '음성 입력' (마이크) 버튼
  const micBtn = document.getElementById('mic-btn');
  micBtn?.addEventListener('click', () => {
    if (!recognition) {
      initSpeechRecognition(); // 혹시 초기화 안됐으면 다시 시도
      if (!recognition) return alert('음성 인식이 지원되지 않습니다.');
    }
    if (isRecognizing) { 
      recognition.stop(); 
      return; 
    }
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

  // (참고) 기존 handleCorrection 함수는 HTML에 'correction-btn' ID가 없으므로
  // 현재 연결되지 않은 상태입니다.
  // document.getElementById('correction-btn')?.addEventListener('click', handleCorrection);
});