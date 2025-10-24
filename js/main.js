import { allPatterns as patternsData } from '../data/patterns.js';

let allPatterns = [];
let learningCounts = {};
const audioCache = {};
let currentAudio = null;
let currentPlayingButton = null;
let wakeLock = null;
let conversationHistory = []; // AI 채팅 기록
let correctionHistory = []; // 작문 교정 기록

// DOM Elements
let patternContainer, currentDateEl, newPatternBtn, openTranslatorBtn, translatorModal,
    closeTranslatorBtn, translateBtn, koreanInput, translationResult, customAlertModal,
    customAlertMessage, customAlertCloseBtn, allPatternsBtn, allPatternsModal,
    closeAllPatternsBtn, allPatternsList, chatBtn, chatModal, closeChatBtn,
    chatHistory, chatInput, sendChatBtn, micBtn, suggestReplyBtn,
    dailyQuizBtn, quizModal, closeQuizBtn, quizContent,
    openCorrectionBtn, correctionModal, closeCorrectionBtn, correctionInput,
    correctWritingBtn, correctionResult, getTopicBtn, writingTopicDisplay,
    correctionHistoryModal, openCorrectionHistoryBtn, closeCorrectionHistoryBtn,
    correctionHistoryList, clearCorrectionHistoryBtn,
    fabContainer, fabMainBtn;

// 음성 인식 관련
let recognition = null;
let isRecognizing = false;
let currentRecognitionTargetInput = null;
let currentRecognitionMicButton = null;

// --- 퀴즈 상태 변수 ---
let quizQuestions = [];
let currentQuizQuestionIndex = 0;
let quizScore = 0;

function initializeDOM() {
    patternContainer = document.getElementById('pattern-container');
    currentDateEl = document.getElementById('current-date');
    newPatternBtn = document.getElementById('new-pattern-btn');
    openTranslatorBtn = document.getElementById('open-translator-btn');
    translatorModal = document.getElementById('translator-modal');
    closeTranslatorBtn = document.getElementById('close-translator-btn');
    translateBtn = document.getElementById('translate-btn');
    koreanInput = document.getElementById('korean-input');
    translationResult = document.getElementById('translation-result');
    customAlertModal = document.getElementById('custom-alert-modal');
    customAlertMessage = document.getElementById('custom-alert-message');
    customAlertCloseBtn = document.getElementById('custom-alert-close-btn');
    allPatternsBtn = document.getElementById('all-patterns-btn');
    allPatternsModal = document.getElementById('all-patterns-modal');
    closeAllPatternsBtn = document.getElementById('close-all-patterns-btn');
    allPatternsList = document.getElementById('all-patterns-list');
    chatBtn = document.getElementById('open-chat-btn');
    chatModal = document.getElementById('chat-modal');
    closeChatBtn = document.getElementById('close-chat-btn');
    chatHistory = document.getElementById('chat-history');
    chatInput = document.getElementById('chat-input');
    sendChatBtn = document.getElementById('send-chat-btn');
    micBtn = document.getElementById('mic-btn');
    suggestReplyBtn = document.getElementById('suggest-reply-btn');

    dailyQuizBtn = document.getElementById('daily-quiz-btn');
    quizModal = document.getElementById('quiz-modal');
    closeQuizBtn = document.getElementById('close-quiz-btn');
    quizContent = document.getElementById('quiz-content');

    openCorrectionBtn = document.getElementById('open-correction-btn');
    correctionModal = document.getElementById('correction-modal');
    closeCorrectionBtn = document.getElementById('close-correction-btn');
    correctionInput = document.getElementById('correction-input');
    correctWritingBtn = document.getElementById('correct-writing-btn');
    correctionResult = document.getElementById('correction-result');

    getTopicBtn = document.getElementById('get-topic-btn');
    writingTopicDisplay = document.getElementById('writing-topic-display');

    correctionHistoryModal = document.getElementById('correction-history-modal');
    openCorrectionHistoryBtn = document.getElementById('open-correction-history-btn');
    closeCorrectionHistoryBtn = document.getElementById('close-correction-history-btn');
    correctionHistoryList = document.getElementById('correction-history-list');
    clearCorrectionHistoryBtn = document.getElementById('clear-correction-history-btn');

    fabContainer = document.getElementById('fab-container');
    fabMainBtn = document.getElementById('fab-main-btn');
}

// --- 커스텀 알림 함수 ---
function showAlert(message) {
    customAlertMessage.textContent = message;
    customAlertModal.classList.remove('hidden');
}

// --- API 호출 공통 함수 ---
async function callGeminiAPI(action, body) {
    const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body })
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API ${action} failed`);
    }
    return response.json();
}

// --- TTS (Text-to-Speech) 함수 ---
async function playTTS(text, buttonElement) {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
        if (currentPlayingButton) currentPlayingButton.classList.remove('is-playing');
        if (currentPlayingButton === buttonElement) {
            currentPlayingButton = null;
            return;
        }
    }
    currentPlayingButton = buttonElement;
     if(buttonElement) buttonElement.classList.add('is-playing');
    try {
        let audioData = audioCache[text];
        if (!audioData) {
            const result = await callGeminiAPI('tts', { text });
            audioData = result.audioContent;
            audioCache[text] = audioData;
        }
        const audio = new Audio(`data:audio/mp3;base64,${audioData}`);
        currentAudio = audio;
        audio.play();
        audio.onended = () => {
            if(buttonElement) buttonElement.classList.remove('is-playing');
            currentAudio = null;
            currentPlayingButton = null;
        };
        audio.onerror = (e) => {
            console.error('Audio playback error:', e);
            showAlert('오디오 재생 중 오류가 발생했습니다.');
             if(buttonElement) buttonElement.classList.remove('is-playing');
            currentAudio = null;
            currentPlayingButton = null;
        };
    } catch (error) {
        console.error('TTS error:', error);
        showAlert(`음성(TTS)을 불러오는 데 실패했습니다: ${error.message}`);
         if(buttonElement) buttonElement.classList.remove('is-playing');
        currentPlayingButton = null;
    }
}

// --- 학습 카운트 관련 함수 ---
function initializeCounts() {
    const storedCounts = localStorage.getItem('chineseLearningCounts');
    learningCounts = storedCounts ? JSON.parse(storedCounts) : {};
}
function saveCounts() {
    localStorage.setItem('chineseLearningCounts', JSON.stringify(learningCounts));
}

// --- 교정 내역 저장/로드 ---
function initializeCorrectionHistory() {
    const storedHistory = localStorage.getItem('chineseCorrectionHistory');
    correctionHistory = storedHistory ? JSON.parse(storedHistory) : [];
}
function saveCorrectionHistory() {
    localStorage.setItem('chineseCorrectionHistory', JSON.stringify(correctionHistory));
}
function addCorrectionToHistory(original, corrected, explanation) {
    correctionHistory.unshift({ original, corrected, explanation, date: new Date().toISOString() });
    if (correctionHistory.length > 50) {
        correctionHistory = correctionHistory.slice(0, 50);
    }
    saveCorrectionHistory();
}
function renderCorrectionHistory() {
    if (!correctionHistoryList) return;
    if (correctionHistory.length === 0) {
        correctionHistoryList.innerHTML = `<p class="text-gray-500 text-center p-4">아직 교정 내역이 없습니다.</p>`;
        return;
    }

    correctionHistoryList.innerHTML = '';
    correctionHistory.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'p-4 hover:bg-gray-50';

        const itemDate = new Date(item.date);
        const dateString = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}-${String(itemDate.getDate()).padStart(2, '0')}`;

        itemEl.innerHTML = `
            <p class="text-sm text-gray-400 mb-1">${dateString}</p>
            <p class="text-gray-600 chinese-text"><strong>원본:</strong> ${item.original}</p>
            <div class="flex items-center mt-1 p-2 bg-green-50 rounded-lg">
                <p class="text-md chinese-text font-semibold text-green-800">${item.corrected}</p>
                <button class="tts-btn ml-2 p-1 rounded-full hover:bg-gray-200 transition-colors" data-text="${item.corrected}">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-500 pointer-events-none"><path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg>
                </button>
            </div>
            <p class="text-sm text-gray-700 mt-2 pt-2 border-t border-gray-200"><strong>AI 코멘트:</strong> ${item.explanation}</p>
        `;
        correctionHistoryList.appendChild(itemEl);
    });
}


// --- 날짜 및 패턴 렌더링 함수 ---
function getTodayString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
function displayDate() {
    const today = new Date();
    currentDateEl.textContent = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
}
function getRandomPatterns() {
    const shuffled = [...allPatterns].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 2);
}

function renderPatterns(patterns, showIndex = false) {
    patternContainer.innerHTML = '';
    patterns.forEach((p, index) => {
        const count = learningCounts[p.pattern] || 0;
        const card = document.createElement('div');
        card.className = 'bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300';

        const examplesHtml = p.examples.map(ex => `
            <div class="mt-3">
                <div class="flex items-center">
                    <p class="text-lg chinese-text text-gray-800">${ex.chinese}</p>
                    <button class="tts-btn ml-2 p-1 rounded-full hover:bg-gray-200 transition-colors" data-text="${ex.chinese}">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-500 pointer-events-none"><path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg>
                    </button>
                </div>
                <p class="text-sm text-gray-500">${ex.pinyin}</p>
                <p class="text-md text-gray-600">${ex.korean}</p>
            </div>`).join('');

        const vocabHtml = p.vocab.map(v => `
            <div class="flex items-baseline">
                <p class="w-1/3 text-md chinese-text text-gray-700 font-medium">${v.word}</p>
                <p class="w-1/3 text-sm text-gray-500">${v.pinyin}</p>
                <p class="w-1/3 text-sm text-gray-600">${v.meaning}</p>
            </div>`).join('');

        const indexHtml = showIndex ? `<span class="bg-blue-100 text-blue-800 text-sm font-semibold mr-3 px-3 py-1 rounded-full">${index + 1}</span>` : '';

        // [수정] 직접 말해보기 섹션 HTML 레이아웃 및 아이콘 변경
        const practiceHtml = p.practice ? `
            <div class="mt-6">
                <h3 class="text-lg font-bold text-gray-700 border-b pb-1">🗣️ 직접 말해보기</h3>
                <div id="practice-container-${index}" class="mt-3 bg-sky-50 p-4 rounded-lg relative" data-spree-count="0" data-spree-goal="5">
                    {/* [수정] 힌트 버튼 SVG 위의 주석 제거 */}
                    <button id="show-hint-btn-${index}" title="힌트 보기" data-pattern-string="${p.pattern}" data-hint-target="practice-hint-${index}" class="show-hint-btn absolute top-3 right-3 bg-gray-300 hover:bg-gray-400 text-yellow-500 p-1.5 rounded-full" style="display: none;">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 pointer-events-none">
                          <path d="M12 2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM18.894 6.166a.75.75 0 0 0-1.06-1.06l-1.591 1.59a.75.75 0 1 0 1.06 1.061l1.591-1.59ZM21.75 12a.75.75 0 0 1-.75.75h-2.25a.75.75 0 0 1 0-1.5h2.25a.75.75 0 0 1 .75.75ZM17.834 18.894a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 1 0-1.061 1.06l1.59 1.591ZM12 18a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-2.25A.75.75 0 0 1 12 18ZM7.758 17.303a.75.75 0 0 0-1.061-1.06l-1.591 1.59a.75.75 0 0 0 1.06 1.061l1.591-1.59ZM6 12a.75.75 0 0 1-.75.75H3a.75.75 0 0 1 0-1.5h2.25A.75.75 0 0 1 6 12ZM6.166 7.758a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 0 0-1.061 1.06l1.59 1.591Z" />
                        </svg>
                    </button>
                    <p class="text-md text-gray-700 mb-2">다음 문장을 중국어로 입력해보세요:</p>
                    <p id="practice-korean-${index}" class="text-md font-semibold text-sky-800 mb-3">""</p>
                    <div class="flex items-center space-x-2 min-w-0">
                        <button id="practice-mic-btn-${index}" title="음성 입력" data-practice-index="${index}" class="practice-mic-btn mic-btn p-1.5 rounded-full text-gray-500 hover:bg-gray-200 flex-shrink-0" style="display: none;">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 pointer-events-none">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 0 0 6-6V7.5a6 6 0 0 0-12 0v5.25a6 6 0 0 0 6 6Z" />
                                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5v2.25a7.5 7.5 0 0 1-15 0v-2.25" />
                                <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 18.75a8.25 8.25 0 0 0 10.5 0" />
                            </svg>
                        </button>
                        <input type="text" id="practice-input-${index}" class="flex-1 p-2 border border-gray-300 rounded-md chinese-text min-w-0" placeholder="중국어를 입력하세요..." disabled>
                    </div>
                    <div class="mt-3 flex justify-between items-center">
                        <div class="flex-1 text-center">
                            <button id="check-practice-btn-${index}" data-answer="" data-pinyin="" data-input-id="practice-input-${index}" class="check-practice-btn bg-sky-500 hover:bg-sky-600 text-white font-bold py-2 px-4 rounded-lg whitespace-nowrap inline-block" style="display: none;">정답 확인</button>
                        </div>
                        <div id="practice-counter-${index}" class="text-sm text-gray-500 flex-shrink-0 ml-2">AI 연습문제 로딩 중...</div>
                    </div>
                    <div id="practice-hint-${index}" class="mt-3"></div>
                    <div id="practice-result-${index}" class="mt-3 text-center"></div>
                </div>
            </div>` : '';
        // [수정 완료]

        card.innerHTML = `
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center">${indexHtml}<div><h2 class="text-2xl font-bold text-gray-800 chinese-text">${p.pattern}</h2><p class="text-md text-gray-500">${p.pinyin}</p></div></div>
                <div class="text-right">
                    <button data-pattern="${p.pattern}" class="learn-btn bg-yellow-400 hover:bg-yellow-500 text-white text-sm font-bold py-1 px-3 rounded-full transition-colors">학습 완료!</button>
                    <p class="text-xs text-gray-500 mt-1">학습 <span class="font-bold text-red-500 count-display">${count}</span>회</p>
                    <button data-pattern-string="${p.pattern}" class="start-chat-pattern-btn mt-2 bg-purple-100 hover:bg-purple-200 text-purple-700 text-xs font-bold py-1 px-3 rounded-full transition-colors w-full text-center">
                        💬 이 패턴으로 대화
                    </button>
                </div>
            </div>
            <div class="mt-4"><p class="text-lg text-blue-700 font-semibold mb-2">${p.meaning}</p><p class="text-sm text-gray-500 bg-gray-100 p-2 rounded-md"><b>🤔 어떻게 사용할까요?</b> ${p.structure || '구조 정보 없음'}</p></div>
            <div class="mt-4"><h3 class="text-lg font-bold text-gray-700 border-b pb-1">💡 예문 살펴보기</h3>${examplesHtml}</div>
            <div class="mt-6"><h3 class="text-lg font-bold text-gray-700 border-b pb-1">📌 주요 단어</h3><div class="mt-3 space-y-2">${vocabHtml}</div></div>
            ${practiceHtml}`;
        patternContainer.appendChild(card);

        if (p.practice) {
            setTimeout(() => {
                const practiceContainerDiv = document.getElementById(`practice-container-${index}`);
                 if (practiceContainerDiv) {
                     practiceContainerDiv.dataset.spreeCount = '0';
                     handleNewPracticeRequest(p.pattern, index);
                 } else {
                     console.error(`Practice container practice-container-${index} not found immediately after render.`);
                 }
            }, 0);
        }
    });
}

function loadDailyPatterns() {
    const todayStr = getTodayString();
    const storedData = JSON.parse(localStorage.getItem('dailyChinesePatterns'));
    if (storedData && storedData.date === todayStr) {
        renderPatterns(storedData.patterns);
    } else {
        const newPatterns = getRandomPatterns();
        localStorage.setItem('dailyChinesePatterns', JSON.stringify({ date: todayStr, patterns: newPatterns }));
        renderPatterns(newPatterns);
    }
}
function renderAllPatternsList() {
    allPatternsList.innerHTML = '';
    allPatterns.forEach((p, index) => {
        const patternItem = document.createElement('div');
        patternItem.className = 'p-4 hover:bg-gray-100 cursor-pointer';
        patternItem.dataset.patternIndex = index;
        patternItem.innerHTML = `
            <div class="flex items-start pointer-events-none">
                <span class="mr-3 text-gray-500 font-medium w-8 text-right">${index + 1}.</span>
                <div>
                    <p class="text-lg font-semibold chinese-text text-gray-800">${p.pattern}</p>
                    <p class="text-sm text-gray-600">${p.meaning}</p>
                </div>
            </div>`;
        allPatternsList.appendChild(patternItem);
    });
}

async function setupScreenWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => console.log('Screen Wake Lock released'));
            console.log('Screen Wake Lock active');
        } catch (err) { console.error(`${err.name}, ${err.message}`); }
    } else { console.log('Screen Wake Lock API not supported.'); }
}

function addMessageToHistory(sender, messageData) {
    if (sender === 'user') {
        const messageElement = document.createElement('div');
        messageElement.className = 'flex justify-end';
        messageElement.innerHTML = `<div class="bg-purple-500 text-white p-3 rounded-lg max-w-xs">${messageData.text}</div>`;
        chatHistory.appendChild(messageElement);
    } else { // AI
        if (messageData.correction && messageData.correction.corrected) {
            const correctionElement = document.createElement('div');
            correctionElement.className = 'flex justify-center my-2';
            correctionElement.innerHTML = `
                <div class="bg-yellow-50 p-3 rounded-lg text-sm w-full max-w-xs border border-yellow-300">
                    <h4 class="font-semibold text-yellow-800">💡 표현 교정</h4>
                    <p class="text-gray-500 mt-1">"<s>${messageData.correction.original || '...'}</s>"</p>
                    <p class="text-green-700 font-medium chinese-text mt-1">→ ${messageData.correction.corrected}</p>
                    <p class="text-gray-700 mt-2 pt-2 border-t border-yellow-200">${messageData.correction.explanation || '자연스러운 표현으로 수정했어요.'}</p>
                </div>`;
            chatHistory.appendChild(correctionElement);
        }
        const messageElement = document.createElement('div');
        messageElement.className = 'flex justify-start';
        messageElement.innerHTML = `
            <div class="bg-white p-3 rounded-lg max-w-xs border">
                <div class="flex items-center">
                    <p class="text-lg chinese-text text-gray-800">${messageData.chinese}</p>
                    <button class="tts-btn ml-2 p-1 rounded-full hover:bg-gray-200 transition-colors" data-text="${messageData.chinese}">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-500 pointer-events-none"><path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg>
                    </button>
                </div>
                <p class="text-sm text-gray-500">${messageData.pinyin || ''}</p>
                <p class="text-sm text-gray-600 border-t mt-2 pt-2">${messageData.korean || ''}</p>
            </div>`;
        chatHistory.appendChild(messageElement);
    }
    if (chatHistory) chatHistory.scrollTop = chatHistory.scrollHeight;
}
function addSuggestionToHistory(suggestions) {
    const suggestionElement = document.createElement('div');
    suggestionElement.className = 'flex justify-center my-2';
    const buttonsHtml = suggestions.map(suggestion =>
        `<button class="suggestion-chip bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-sm hover:bg-blue-200 mx-1 mb-1 flex flex-col items-center" data-text="${suggestion.chinese}">
            <span class="chinese-text font-medium">${suggestion.chinese}</span>
            <span class="text-xs text-gray-500 mt-0.5">${suggestion.pinyin}</span>
            <span class="text-xs text-gray-600 mt-0.5">${suggestion.korean}</span>
         </button>`
    ).join('');
    suggestionElement.innerHTML = `
        <div class="bg-gray-100 p-2 rounded-lg text-center w-full">
            <p class="text-xs text-gray-600 mb-1">이렇게 답해보세요:</p>
            <div class="flex flex-wrap justify-center">${buttonsHtml}</div>
        </div>`;
    chatHistory.appendChild(suggestionElement);
    suggestionElement.querySelectorAll('.suggestion-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            chatInput.value = chip.dataset.text;
            chatInput.focus();
            suggestionElement.remove();
        });
    });
    chatHistory.scrollTop = chatHistory.scrollHeight;
}
async function handleSendMessage() {
    const userInput = chatInput.value.trim();
    if (!userInput) return;
    chatHistory.querySelectorAll('.suggestion-chip').forEach(chip => chip.closest('div.flex.justify-center')?.remove());
    addMessageToHistory('user', { text: userInput });
    chatInput.value = '';
    const loadingElement = document.createElement('div');
    loadingElement.className = 'flex justify-start';
    loadingElement.id = 'chat-loading';
    loadingElement.innerHTML = `<div class="bg-white p-3 rounded-lg border"><div class="loader"></div></div>`;
    chatHistory.appendChild(loadingElement);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    try {
        conversationHistory.push({ role: 'user', parts: [{ text: userInput }] });
        const result = await callGeminiAPI('chat', { text: userInput, history: conversationHistory });

        let aiResponseData;
        if (result.candidates && result.candidates[0]?.content?.parts?.[0]) {
            const aiResponseText = result.candidates[0].content.parts[0].text;

            if (!aiResponseText || !aiResponseText.trim().startsWith('{')) {
                console.error("AI response is not valid JSON (or is empty):", aiResponseText);
                aiResponseData = {
                    chinese: "哎呀，我好像走神了...",
                    pinyin: "Āiyā, wǒ hǎoxiàng zǒushén le...",
                    korean: "어머, 제가 잠시 딴생각을 했나 봐요. 다시 한 번 말씀해 주시겠어요?"
                };
            } else {
                try {
                    // [수정] JSON 파싱 시 ```json 마크다운 제거
                    const cleanedText = aiResponseText.trim().replace(/^```json\s*|\s*```$/g, '');
                    aiResponseData = JSON.parse(cleanedText);
                    // history에는 원본 텍스트를 저장할 수도 있고, cleanedText를 저장할 수도 있음. 여기선 원본 저장.
                    conversationHistory.push({ role: 'model', parts: [{ text: aiResponseText }] });
                } catch (e) {
                    console.error("AI response looked like JSON but failed to parse:", aiResponseText, e);
                    aiResponseData = {
                        chinese: "糟糕... (zāogāo)",
                        pinyin: "",
                        korean: "이런... 응답 형식을 처리하는 데 실패했어요. 다시 시도해주세요."
                    };
                    conversationHistory.push({ role: 'model', parts: [{ text: aiResponseText }] });
                }
            }
        } else {
             console.error("Invalid response structure from chat API:", result);
             aiResponseData = {
                chinese: "(응답 없음)",
                pinyin: "",
                korean: "AI로부터 유효한 응답을 받지 못했습니다."
             };
        }
        addMessageToHistory('ai', aiResponseData);
    } catch (error) {
        console.error('Chat error:', error);
        showAlert(`대화 중 오류가 발생했습니다: ${error.message}`);
    } finally {
        const loadingEl = document.getElementById('chat-loading');
        if (loadingEl) loadingEl.remove();
    }
}
async function handleStartChatWithPattern(patternString) {
    chatModal.classList.remove('hidden');
    if (fabContainer) fabContainer.classList.remove('is-open');
    chatHistory.innerHTML = '';
    conversationHistory = [];
    chatHistory.querySelectorAll('.suggestion-chip').forEach(chip => chip.closest('div.flex.justify-center')?.remove());
    chatInput.value = '';

    const loadingElement = document.createElement('div');
    loadingElement.className = 'flex justify-start';
    loadingElement.id = 'chat-loading';
    loadingElement.innerHTML = `<div class="bg-white p-3 rounded-lg border"><div class="loader"></div></div>`;
    chatHistory.appendChild(loadingElement);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    try {
        const result = await callGeminiAPI('start_chat_with_pattern', { pattern: patternString });

        let aiResponseData;
        if (result.candidates && result.candidates[0]?.content?.parts?.[0]) {
            const aiResponseText = result.candidates[0].content.parts[0].text;
            if (!aiResponseText || !aiResponseText.trim().startsWith('{')) {
                console.error("AI response is not valid JSON (or is empty) in start_chat_with_pattern:", aiResponseText);
                aiResponseData = {
                    chinese: "哎呀，我好像走神了...",
                    pinyin: "Āiyā, wǒ hǎoxiàng zǒushén le...",
                    korean: "어머, 제가 잠시 딴생각을 했나 봐요. '패턴으로 대화' 버튼을 다시 한 번 눌러주시겠어요?"
                };
            } else {
                try {
                    // [수정] JSON 파싱 시 ```json 마크다운 제거
                    const cleanedText = aiResponseText.trim().replace(/^```json\s*|\s*```$/g, '');
                    aiResponseData = JSON.parse(cleanedText);
                    conversationHistory.push({ role: 'model', parts: [{ text: aiResponseText }] });
                } catch (e) {
                    console.error("AI response looked like JSON but failed to parse in start_chat_with_pattern:", aiResponseText, e);
                    aiResponseData = {
                        chinese: "糟糕... (zāogāo)",
                        pinyin: "",
                        korean: "이런... 응답 형식을 처리하는 데 실패했어요. 다시 시도해주세요."
                    };
                    conversationHistory.push({ role: 'model', parts: [{ text: aiResponseText }] });
                }
            }
        } else {
             console.error("Invalid response structure from start_chat_with_pattern API:", result);
             aiResponseData = {
                chinese: "(응답 없음)",
                pinyin: "",
                korean: "AI로부터 유효한 응답을 받지 못했습니다."
             };
        }
        addMessageToHistory('ai', aiResponseData);
    } catch (error) {
        console.error('Start chat with pattern error:', error);
        showAlert(`대화 시작 중 오류가 발생했습니다: ${error.message}`);
    } finally {
        const loadingEl = document.getElementById('chat-loading');
        if (loadingEl) loadingEl.remove();
    }
}
async function handleSuggestReply() {
    chatHistory.querySelectorAll('.suggestion-chip').forEach(chip => chip.closest('div.flex.justify-center')?.remove());
    if (conversationHistory.length === 0) {
        showAlert('추천할 답변을 생성하기 위한 대화 내용이 없습니다.');
        return;
    }
    suggestReplyBtn.disabled = true;
    suggestReplyBtn.textContent = '추천 생성 중...';
    try {
        const result = await callGeminiAPI('suggest_reply', { history: conversationHistory });
        // [수정] 응답 데이터 처리 로직 강화 (candidates 확인)
        let suggestions = [];
        if (result.candidates && result.candidates[0]?.content?.parts?.[0]) {
            const suggestionText = result.candidates[0].content.parts[0].text.trim().replace(/^```json\s*|\s*```$/g, '');
            try {
                const parsedData = JSON.parse(suggestionText);
                if (parsedData.suggestions && Array.isArray(parsedData.suggestions)) {
                    suggestions = parsedData.suggestions;
                } else {
                     console.warn("Received data has no 'suggestions' array:", parsedData);
                }
            } catch (e) {
                console.error("Failed to parse suggestion JSON:", suggestionText, e);
            }
        } else {
            console.error("Invalid response structure for suggestions:", result);
        }

        if (suggestions.length > 0 && suggestions.every(s => s.chinese && s.pinyin && s.korean)) {
            addSuggestionToHistory(suggestions);
        } else {
             console.warn("Received suggestions are empty or have invalid format:", suggestions);
            showAlert('추천할 만한 답변을 찾지 못했거나 형식이 잘못되었습니다.');
        }
    } catch (error) {
        console.error('Suggest reply error:', error);
        showAlert(`답변 추천 중 오류 발생: ${error.message}`);
    } finally {
        suggestReplyBtn.disabled = false;
        suggestReplyBtn.textContent = '💡 답변 추천받기';
    }
}

async function handleNewPracticeRequest(patternString, practiceIndex) {
    const koreanEl = document.getElementById(`practice-korean-${practiceIndex}`);
    const inputEl = document.getElementById(`practice-input-${practiceIndex}`);
    const checkBtn = document.getElementById(`check-practice-btn-${practiceIndex}`);
    const hintBtn = document.getElementById(`show-hint-btn-${practiceIndex}`);
    const micBtnPractice = document.getElementById(`practice-mic-btn-${practiceIndex}`);
    const resultEl = document.getElementById(`practice-result-${practiceIndex}`);
    const hintDataEl = document.getElementById(`practice-hint-${practiceIndex}`);

    const practiceContainer = document.getElementById(`practice-container-${practiceIndex}`);
    const counterEl = document.getElementById(`practice-counter-${practiceIndex}`);
    let currentCount = parseInt(practiceContainer.dataset.spreeCount, 10);
    const goal = parseInt(practiceContainer.dataset.spreeGoal, 10);
    let nextCount = currentCount + 1;

    koreanEl.textContent = '...';
    inputEl.value = '';
    resultEl.innerHTML = '';
    hintDataEl.innerHTML = '';
    checkBtn.style.display = 'none';
    hintBtn.style.display = 'none';
    micBtnPractice.style.display = 'none';
    inputEl.disabled = true;

    // [수정] 카운터 위치 변경으로 인해 innerHTML 대신 textContent 사용 고려 (또는 아래 로직 유지)
    counterEl.innerHTML = `<div class="loader-sm mx-auto"></div>`; // 로딩 표시만

    try {
        const result = await callGeminiAPI('generate_practice', { pattern: patternString });

        let practiceData;
        if (result.candidates && result.candidates[0]?.content?.parts?.[0]) {
            const practiceText = result.candidates[0].content.parts[0].text.trim().replace(/^```json\s*|\s*```$/g, '');
            try {
                if (!practiceText || !practiceText.startsWith('{')) {
                    throw new Error("AI response for practice is not valid JSON.");
                }
                practiceData = JSON.parse(practiceText);

                koreanEl.textContent = `"${practiceData.korean}"`;
                checkBtn.dataset.answer = practiceData.chinese;
                checkBtn.dataset.pinyin = practiceData.pinyin;

                hintBtn.dataset.newVocab = JSON.stringify(practiceData.practiceVocab || []);

                practiceContainer.dataset.spreeCount = nextCount;

                checkBtn.style.display = '';
                hintBtn.style.display = '';
                micBtnPractice.style.display = '';
                inputEl.disabled = false;
                hintBtn.disabled = false;
                hintBtn.classList.remove('opacity-50', 'cursor-not-allowed');

                counterEl.textContent = `문제 ${nextCount} / ${goal}`; // 카운터 업데이트
                inputEl.focus();

            } catch (e) {
                console.error("Failed to parse practice data:", practiceText, e);
                koreanEl.textContent = "오류: 새 문제를 불러오지 못했습니다.";
                counterEl.textContent = '오류';
                practiceContainer.dataset.spreeCount = currentCount;
                inputEl.disabled = true;
            }
        } else {
            console.error("Invalid response structure from generate_practice API:", result);
            koreanEl.textContent = "오류: AI 응답이 없습니다.";
            counterEl.textContent = '오류';
            practiceContainer.dataset.spreeCount = currentCount;
            inputEl.disabled = true;
        }
    } catch (error) {
        console.error('New practice request error:', error);
        koreanEl.textContent = `오류: ${error.message}`;
        counterEl.textContent = '오류';
        practiceContainer.dataset.spreeCount = currentCount;
        inputEl.disabled = true;
    }
}

async function handleTranslation() {
    const text = koreanInput.value.trim();
    if (!text) {
        showAlert('번역할 한국어 문장을 입력하세요.');
        return;
    }
    translateBtn.disabled = true;
    translationResult.innerHTML = '<div class="loader mx-auto"></div>';
    try {
        const patternList = allPatterns.map(p => p.pattern).join(", ");
        const systemPrompt = `You are a professional Korean-to-Chinese translator and language teacher. Translate the following Korean sentence into natural, native-sounding Chinese. Provide: 1. The main Chinese translation. 2. The pinyin for the main translation. 3. (Optional) 1-2 alternative natural expressions if applicable. 4. A concise explanation (in Korean) of why this expression is natural, what the key vocabulary or grammar point is.
Format your response as a single, valid JSON object with keys "chinese", "pinyin", "alternatives" (string array), "explanation" (string, in Korean), and "usedPattern" (string or null).
Do not include markdown backticks.
IMPORTANT: After translating, analyze your Chinese translation. If it uses one of the following patterns: [${patternList}], set the "usedPattern" key to the matching pattern string. If no pattern matches, set "usedPattern" to null.`;

        const result = await callGeminiAPI('translate', { text, systemPrompt });
        let translationData;
        if (result.candidates && result.candidates[0]?.content?.parts?.[0]) {
            const translationText = result.candidates[0].content.parts[0].text;
            try {
                const cleanedText = translationText.trim().replace(/^```json\s*|\s*```$/g, '');
                translationData = JSON.parse(cleanedText);
            } catch (e) {
                console.error("AI translation response is not valid JSON:", translationText, e);
                translationData = { chinese: translationText, pinyin: "(JSON 파싱 오류)", alternatives: [], explanation: "(설명 파싱 오류)", usedPattern: null };
            }
        } else {
             console.error("Invalid response structure from translate API:", result);
             translationData = { chinese: "(유효하지 않은 응답)", pinyin: "", alternatives: [], explanation: "", usedPattern: null };
        }
        let alternativesHtml = '';
        if (translationData.alternatives && Array.isArray(translationData.alternatives) && translationData.alternatives.length > 0) {
            alternativesHtml = `<p class="text-sm text-gray-500 mt-3">다른 표현:</p><ul class="list-disc list-inside text-sm text-gray-600 chinese-text">${translationData.alternatives.map(alt => `<li>${alt}</li>`).join('')}</ul>`;
        }
        let patternHtml = '';
        if (translationData.usedPattern) {
            patternHtml = `<div class="mt-4 pt-3 border-t"><h4 class="text-sm font-semibold text-green-700">💡 학습 패턴 발견!</h4><p class="text-sm text-gray-600 mt-1">이 문장은 <strong>'${translationData.usedPattern}'</strong> 패턴을 사용했어요!</p></div>`;
        }
        let explanationHtml = '';
        if (translationData.explanation) {
            explanationHtml = `<div class="mt-4 pt-3 border-t"><h4 class="text-sm font-semibold text-gray-700">💡 표현 꿀팁:</h4><p class="text-sm text-gray-600 mt-1">${translationData.explanation.replace(/\n/g, '<br>')}</p></div>`;
        }
        translationResult.innerHTML = `
            <div class="flex items-center">
                <p class="text-xl chinese-text font-bold text-gray-800">${translationData.chinese}</p>
                <button class="tts-btn ml-2 p-1 rounded-full hover:bg-gray-200 transition-colors" data-text="${translationData.chinese}">
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-500 pointer-events-none"><path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg>
                </button>
            </div>
            <p class="text-md text-gray-500">${translationData.pinyin || '(병음 정보 없음)'}</p>
            ${alternativesHtml}
            ${patternHtml}
            ${explanationHtml}`;
    } catch (error) {
        console.error('Translation error:', error);
        translationResult.innerHTML = `<p class="text-red-500 text-center">번역 중 오류가 발생했습니다: ${error.message}</p>`;
    } finally {
        translateBtn.disabled = false;
    }
}

// --- AI 작문 교정 함수 ---
async function handleCorrectWriting() {
    const text = correctionInput.value.trim();
    if (!text) {
        showAlert('교정받을 중국어 문장을 입력하세요.');
        return;
    }
    correctWritingBtn.disabled = true;
    correctionResult.innerHTML = '<div class="loader mx-auto"></div>';

    try {
        const result = await callGeminiAPI('correct_writing', { text });

        let correctionData;
        if (result.candidates && result.candidates[0]?.content?.parts?.[0]) {
            const correctionText = result.candidates[0].content.parts[0].text.trim().replace(/^```json\s*|\s*```$/g, '');

            if (!correctionText || !correctionText.startsWith('{')) {
                 throw new Error("AI가 유효한 JSON 형식으로 응답하지 않았습니다.");
            }

            try {
                correctionData = JSON.parse(correctionText);
            } catch (e) {
                console.error("AI correction response is not valid JSON:", correctionText, e);
                correctionData = { corrected_sentence: "(JSON 파싱 오류)", explanation: "AI 응답을 처리하는 중 오류가 발생했습니다. 다시 시도해주세요." };
            }
        } else {
             console.error("Invalid response structure from correct_writing API:", result);
             correctionData = { corrected_sentence: "(유효하지 않은 응답)", explanation: "AI로부터 유효한 응답을 받지 못했습니다." };
        }

        if (correctionData.corrected_sentence && correctionData.explanation) {
             addCorrectionToHistory(text, correctionData.corrected_sentence, correctionData.explanation);
        }

        let explanationHtml = '';
        if (correctionData.explanation) {
            explanationHtml = `
                <h4 class="text-md font-semibold text-gray-700 mt-4 pt-3 border-t">✍️ AI 코멘트:</h4>
                <p class="text-md text-gray-600 mt-1">${correctionData.explanation.replace(/\n/g, '<br>')}</p>`;
        }

        correctionResult.innerHTML = `
            <div>
                <h4 class="text-md font-semibold text-gray-700">💡 교정된 문장:</h4>
                <div class="flex items-center mt-1 p-3 bg-green-50 rounded-lg">
                    <p class="text-lg chinese-text font-bold text-green-800">${correctionData.corrected_sentence}</p>
                    <button class="tts-btn ml-2 p-1 rounded-full hover:bg-gray-200 transition-colors" data-text="${correctionData.corrected_sentence}">
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-500 pointer-events-none"><path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg>
                    </button>
                </div>
                ${explanationHtml}
            </div>`;

    } catch (error) {
        console.error('Correction error:', error);
        correctionResult.innerHTML = `<p class="text-red-500 text-center">교정 중 오류가 발생했습니다: ${error.message}</p>`;
    } finally {
        correctWritingBtn.disabled = false;
    }
}

// --- 작문 주제 추천 함수 ---
async function handleGetWritingTopic() {
    getTopicBtn.disabled = true;
    getTopicBtn.textContent = '주제 생성 중...';
    writingTopicDisplay.innerHTML = '<div class="loader-sm mx-auto"></div>';

    try {
        const result = await callGeminiAPI('get_writing_topic', {});

        let topicData;
        if (result.candidates && result.candidates[0]?.content?.parts?.[0]) {
            const topicText = result.candidates[0].content.parts[0].text.trim().replace(/^```json\s*|\s*```$/g, '');

            if (!topicText || !topicText.startsWith('{')) {
                 throw new Error("AI가 유효한 JSON 형식으로 응답하지 않았습니다.");
            }

            try {
                topicData = JSON.parse(topicText);
            } catch (e) {
                console.error("AI topic response is not valid JSON:", topicText, e);
                throw new Error("AI 응답을 처리하는 중 오류가 발생했습니다.");
            }
        } else {
             console.error("Invalid response structure from get_writing_topic API:", result);
             throw new Error("AI로부터 유효한 응답을 받지 못했습니다.");
        }

        if (topicData.topic) {
            writingTopicDisplay.textContent = `"${topicData.topic}"`;
            writingTopicDisplay.classList.remove('italic');
            writingTopicDisplay.classList.add('font-semibold');
        } else {
            throw new Error("AI 응답에 'topic' 키가 없습니다.");
        }

    } catch (error) {
        console.error('Get topic error:', error);
        writingTopicDisplay.textContent = `오류: ${error.message}`;
        writingTopicDisplay.classList.remove('font-semibold');
        writingTopicDisplay.classList.add('italic', 'text-red-500');
    } finally {
        getTopicBtn.disabled = false;
        getTopicBtn.textContent = '💡 다른 주제 추천받기';
    }
}


// --- 음성 인식 초기화 ---
function initializeSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.lang = 'zh-CN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
            console.log("Speech Recognition Result:", event.results);
            const speechResult = event.results[0][0].transcript;
            console.log("Recognized Text:", speechResult);

            const targetInput = currentRecognitionTargetInput;
            const targetMicButton = currentRecognitionMicButton;

            if (targetInput) {
                targetInput.value = speechResult;

                setTimeout(() => {
                    if (targetInput === chatInput) {
                        console.log("Auto-submitting chat message...");
                        if (sendChatBtn) sendChatBtn.click();
                    } else if (targetInput.id.startsWith('practice-input-')) {
                        console.log("Auto-submitting practice answer...");
                        const index = targetInput.id.split('-').pop();
                        const checkButton = document.getElementById(`check-practice-btn-${index}`);
                        if (checkButton && checkButton.style.display !== 'none') {
                           checkButton.click();
                        } else {
                            console.warn("Auto-submit skipped: Check button not found or not visible for", targetInput.id);
                        }
                    }
                }, 150);
            } else {
                console.warn("Recognition result received but no target input was set.");
                if (chatInput) chatInput.value = speechResult;
            }
        };

        recognition.onspeechend = () => {
            console.log("Speech Recognition: Speech has stopped being detected.");
        };

        recognition.onnomatch = () => {
            console.log("Speech Recognition: No match found.");
            showAlert('음성을 인식하지 못했습니다. 다시 시도해주세요.');
        };

        recognition.onerror = (event) => {
            console.error("Speech Recognition Error:", event.error, event.message);
            if (event.error !== 'no-speech' && event.error !== 'aborted' && event.error !== 'not-allowed') {
                 showAlert(`음성 인식 오류: ${event.error}. 마이크 권한을 확인하세요.`);
            } else if (event.error === 'not-allowed') {
                 showAlert('마이크 사용 권한이 거부되었습니다. 브라우저 설정을 확인해주세요.');
            }
        };

         recognition.onend = () => {
            console.log("Speech Recognition: Service ended.");
            if (currentRecognitionMicButton) {
                currentRecognitionMicButton.classList.remove('is-recording');
            }
            isRecognizing = false;
            currentRecognitionTargetInput = null;
            currentRecognitionMicButton = null;
        };

        console.log("Speech Recognition initialized for zh-CN.");

    } else {
        console.warn('Web Speech API is not supported in this browser.');
        showAlert('현재 브라우저에서는 음성 인식을 지원하지 않습니다.');
        document.querySelectorAll('.mic-btn').forEach(btn => btn.disabled = true);
    }
}

// --- 퀴즈 관련 함수 ---
function startQuiz() {
    const todayStr = getTodayString();
    const lastQuizDate = localStorage.getItem('lastQuizDate');

    if (lastQuizDate === todayStr) {
        quizContent.innerHTML = `
            <div class="text-center">
                <p class="text-lg mb-4">오늘의 퀴즈를 이미 완료했습니다. 훌륭해요! 👍</p>
                <p class="text-gray-600">내일 새로운 퀴즈로 다시 만나요.</p>
                <button id="close-quiz-modal-btn" class="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg">확인</button>
            </div>`;
        quizModal.classList.remove('hidden');
        return;
    }

    const shuffledPatterns = [...allPatterns].sort(() => 0.5 - Math.random());
    quizQuestions = shuffledPatterns.slice(0, 5);
    currentQuizQuestionIndex = 0;
    quizScore = 0;

    renderQuizQuestion();
    quizModal.classList.remove('hidden');
}

function renderQuizQuestion() {
    if (currentQuizQuestionIndex >= quizQuestions.length) {
        showQuizResult();
        return;
    }

    const correctPattern = quizQuestions[currentQuizQuestionIndex];
    const wrongPatterns = [...allPatterns].filter(p => p.pattern !== correctPattern.pattern).sort(() => 0.5 - Math.random()).slice(0, 3);
    const options = [...wrongPatterns, correctPattern].sort(() => 0.5 - Math.random());

    const optionsHtml = options.map(opt => `
        <button class="quiz-option-btn text-left w-full p-3 border rounded-lg hover:bg-gray-100 transition-colors" data-pattern="${opt.pattern}">
            <span class="font-medium chinese-text text-lg">${opt.pattern}</span><br>
            <span class="text-sm text-gray-500">${opt.pinyin}</span>
        </button>
    `).join('');

    quizContent.innerHTML = `
        <div>
            <p class="text-lg font-bold mb-3">"${correctPattern.meaning}"</p>
            <p class="text-sm text-gray-600 mb-4">위의 뜻을 가진 중국어 패턴을 고르세요.</p>
            <div class="space-y-3">${optionsHtml}</div>
            <p class="text-center text-sm text-gray-500 mt-6">문제 ${currentQuizQuestionIndex + 1} / ${quizQuestions.length}</p>
        </div>`;
}

function handleQuizAnswer(targetButton) {
    const selectedPattern = targetButton.dataset.pattern;
    const correctPattern = quizQuestions[currentQuizQuestionIndex].pattern;
    const allButtons = quizContent.querySelectorAll('.quiz-option-btn');

    allButtons.forEach(btn => {
        btn.disabled = true;
        if (btn.dataset.pattern === correctPattern) {
            btn.classList.add('bg-green-100', 'border-green-500', 'ring-2', 'ring-green-300');
        }
    });

    if (selectedPattern === correctPattern) {
        quizScore++;
    } else {
        targetButton.classList.add('bg-red-100', 'border-red-500', 'ring-2', 'ring-red-300');
    }

    setTimeout(() => {
        currentQuizQuestionIndex++;
        renderQuizQuestion();
    }, 2000);
}

function showQuizResult() {
    quizContent.innerHTML = `
        <div>
            <h2 class="text-2xl font-bold text-center mb-4">퀴즈 완료! 🎉</h2>
            <p class="text-center text-lg mb-6">
                총 ${quizQuestions.length}문제 중
                <span class="font-bold text-blue-600 text-xl">${quizScore}</span>개를 맞혔습니다!
            </p>
            <button id="close-quiz-modal-btn" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg">확인</button>
        </div>`;
    localStorage.setItem('lastQuizDate', getTodayString());
}


// --- 메인 이벤트 리스너 설정 ---
function setupEventListeners() {
    newPatternBtn.addEventListener('click', () => {
         const newPatterns = getRandomPatterns();
         localStorage.setItem('dailyChinesePatterns', JSON.stringify({ date: getTodayString(), patterns: newPatterns }));
         renderPatterns(newPatterns);
         window.scrollTo(0, 0);
    });

    patternContainer.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('learn-btn')) {
            const pattern = target.dataset.pattern;
            learningCounts[pattern] = (learningCounts[pattern] || 0) + 1;
            saveCounts();
             const countDisplay = target.closest('div').querySelector('.count-display');
             if (countDisplay) {
                 countDisplay.textContent = learningCounts[pattern];
             }
        } else if (target.closest('.start-chat-pattern-btn')) {
            const button = target.closest('.start-chat-pattern-btn');
            const patternString = button.dataset.patternString;
            if (patternString) {
                handleStartChatWithPattern(patternString);
            }

        } else if (target.closest('.next-practice-btn')) {
            const button = target.closest('.next-practice-btn');
            const practiceIndex = button.dataset.practiceIndex;
            const practiceContainer = document.getElementById(`practice-container-${practiceIndex}`);
            const patternString = practiceContainer.querySelector('.show-hint-btn')?.dataset.patternString;
            if (patternString) {
                handleNewPracticeRequest(patternString, practiceIndex);
            } else {
                console.error("Could not find pattern string for next practice button.");
            }

        } else if (target.closest('.practice-mic-btn')) {
            const button = target.closest('.practice-mic-btn');
            const practiceIndex = button.dataset.practiceIndex;
            const targetInput = document.getElementById(`practice-input-${practiceIndex}`);

            if (!recognition) {
                 showAlert('음성 인식이 지원되지 않거나 초기화되지 않았습니다.');
                 console.log("Recognition not available or not initialized.");
                return;
            }
            if (isRecognizing && currentRecognitionMicButton !== button) {
                 console.log("Stopping ongoing recognition initiated by another mic...");
                 recognition.stop();
                 setTimeout(() => startPracticeRecognition(button, targetInput), 300);
            } else if (isRecognizing) {
                console.log("Stopping recognition (from practice mic)...");
                recognition.stop();
            } else {
                 startPracticeRecognition(button, targetInput);
            }
        } else if (target.classList.contains('check-practice-btn')) {
            const button = target;
            const inputId = button.dataset.inputId;
            const index = inputId.split('-').pop();
            const correctAnswer = button.dataset.answer;
            const correctPinyin = button.dataset.pinyin;
            const userInput = document.getElementById(inputId).value.trim();
            const resultDiv = document.getElementById(`practice-result-${index}`);
            const normalize = (str) => str.replace(/[.,。，？！？!]/g, '').replace(/\s+/g, '');
            let resultMessageHtml = '';
            const answerHtml = `<div class="mt-2 p-2 bg-gray-100 rounded text-left"><p class="text-sm">정답:</p><div class="flex items-center"><p class="text-md chinese-text font-semibold text-gray-800">${correctAnswer}</p><button class="tts-btn ml-2 p-1 rounded-full hover:bg-gray-200 transition-colors" data-text="${correctAnswer}"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-500 pointer-events-none"><path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg></button></div><p class="text-sm text-gray-500">${correctPinyin}</p></div>`;

            const practiceContainer = document.getElementById(`practice-container-${index}`);
            const spreeCount = parseInt(practiceContainer.dataset.spreeCount, 10);
            const spreeGoal = parseInt(practiceContainer.dataset.spreeGoal, 10);

            let isCorrect = normalize(userInput) === normalize(correctAnswer);
            let resultButtonsHtml = '';

            if (isCorrect) {
                resultMessageHtml = `<p class="text-green-600 font-bold text-lg">🎉 정답입니다!</p>` + answerHtml;
            } else {
                resultMessageHtml = `<p class="text-red-500 font-bold text-lg">🤔 아쉽네요, 다시 시도해보세요.</p>${answerHtml}`;
            }

            resultButtonsHtml += `<button class="retry-practice-btn mt-3 bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg" data-practice-index="${index}">다시하기</button>`;

            if (spreeCount < spreeGoal) {
                resultButtonsHtml += `<button class="next-practice-btn mt-3 ml-2 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg" data-practice-index="${index}">➡️ 다음 문제 (${spreeCount + 1}/${spreeGoal})</button>`;
            } else if (isCorrect) {
                 resultMessageHtml += `<p class="text-green-600 font-bold text-lg mt-3">🎉 ${spreeGoal}문제 완료! 수고하셨습니다!</p>`;
                 const counterEl = document.getElementById(`practice-counter-${index}`);
                 if (counterEl) counterEl.textContent = ''; // 카운터 내용 지우기
                 practiceContainer.dataset.spreeCount = '0';
            }

            resultDiv.innerHTML = resultMessageHtml + resultButtonsHtml;

            button.style.display = 'none';
            const hintButton = document.getElementById(`show-hint-btn-${index}`); if(hintButton) hintButton.style.display = 'none';
            const micButtonPractice = document.getElementById(`practice-mic-btn-${index}`); if (micButtonPractice) micButtonPractice.style.display = 'none';

        } else if (target.closest('.show-hint-btn')) {
            const button = target.closest('.show-hint-btn');
            const newVocab = button.dataset.newVocab;
            const patternString = button.dataset.patternString;
            const hintTargetId = button.dataset.hintTarget;
            const hintDiv = document.getElementById(hintTargetId);
            let vocabSource = null;
            if (newVocab && newVocab !== '[]') {
                try {
                    vocabSource = JSON.parse(newVocab);
                    if (!Array.isArray(vocabSource)) vocabSource = null;
                } catch(e) { console.error("Failed to parse newVocab JSON", e); vocabSource = null; }
                if(vocabSource) console.log("Using new AI-generated vocab for hint.");
            }
            if (!vocabSource) {
                const patternData = allPatterns.find(p => p.pattern === patternString);
                if (patternData && patternData.practiceVocab && patternData.practiceVocab.length > 0) {
                    vocabSource = patternData.practiceVocab;
                    console.log("Using original practiceVocab for hint.");
                }
            }
             if (vocabSource && vocabSource.length > 0) {
                const shuffledVocab = [...vocabSource].sort(() => 0.5 - Math.random());
                // [수정] 각 항목의 너비 조정 (단어 30%, 병음 30%, 뜻 40%)
                const hintsHtml = shuffledVocab.map(hint => `<div class="flex items-baseline" style="line-height: 1.3;"><span class="inline-block w-[30%] font-medium chinese-text pr-2">${hint?.word || '?'}</span><span class="inline-block w-[30%] text-sm text-gray-500 pr-2">${hint?.pinyin || '?'}</span><span class="inline-block w-[40%] text-sm text-gray-600">${hint?.meaning || '?'}</span></div>`).join('');
                hintDiv.innerHTML = `<div class="bg-yellow-50/50 rounded-md p-2 text-left"><div class="flex items-center mb-1"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 mr-0.5 text-yellow-500"><path d="M12 2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM18.894 6.166a.75.75 0 0 0-1.06-1.06l-1.591 1.59a.75.75 0 1 0 1.06 1.061l1.591-1.59ZM21.75 12a.75.75 0 0 1-.75.75h-2.25a.75.75 0 0 1 0-1.5h2.25a.75.75 0 0 1 .75.75ZM17.834 18.894a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 1 0-1.061 1.06l1.59 1.591ZM12 18a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-2.25A.75.75 0 0 1 12 18ZM7.758 17.303a.75.75 0 0 0-1.061-1.06l-1.591 1.59a.75.75 0 0 0 1.06 1.061l1.591-1.59ZM6 12a.75.75 0 0 1-.75.75H3a.75.75 0 0 1 0-1.5h2.25A.75.75 0 0 1 6 12ZM6.166 7.758a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 0 0-1.061 1.06l1.59 1.591Z" /></svg><span class="font-semibold text-sm text-gray-700">힌트</span></div><div class="border-t border-gray-300/50 pt-1">${hintsHtml}</div></div>`;
            } else {
                console.log("No vocab found for hint.");
                hintDiv.innerHTML = `<p class="text-sm text-gray-500">이 문장에 대한 핵심 단어 정보가 없습니다.</p>`;
            }
            button.disabled = true; button.classList.add('opacity-50', 'cursor-not-allowed');

        } else if (target.classList.contains('retry-practice-btn')) {
            const index = target.dataset.practiceIndex;
            const inputEl = document.getElementById(`practice-input-${index}`);
            const resultEl = document.getElementById(`practice-result-${index}`);
            const hintEl = document.getElementById(`practice-hint-${index}`);
            const checkBtn = document.getElementById(`check-practice-btn-${index}`);
            const hintBtn = document.getElementById(`show-hint-btn-${index}`);
            const micBtnPractice = document.getElementById(`practice-mic-btn-${index}`);
            const counterEl = document.getElementById(`practice-counter-${index}`); // 카운터 요소 가져오기
            const practiceContainer = document.getElementById(`practice-container-${index}`); // 컨테이너 요소
            const currentCount = parseInt(practiceContainer.dataset.spreeCount, 10);
            const goal = parseInt(practiceContainer.dataset.spreeGoal, 10);


            if(inputEl) inputEl.value = '';
            if(resultEl) resultEl.innerHTML = '';
            if(hintEl) hintEl.innerHTML = '';
            if(checkBtn) checkBtn.style.display = '';
            if(hintBtn) {
                hintBtn.style.display = '';
                hintBtn.disabled = false;
                hintBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
             if(micBtnPractice) micBtnPractice.style.display = '';
             if(inputEl) inputEl.disabled = false;
             if(inputEl) inputEl.focus();
             // [수정] 다시하기 시 카운터 복원
             if(counterEl) counterEl.textContent = `문제 ${currentCount} / ${goal}`;


        } else if (target.closest('.tts-btn')) {
            const ttsButton = target.closest('.tts-btn');
            const textToSpeak = ttsButton.dataset.text; if (textToSpeak) playTTS(textToSpeak, ttsButton);
        }
    });

    patternContainer.addEventListener('keydown', (e) => {
        if (e.target.id.startsWith('practice-input-') && e.key === 'Enter') {
            e.preventDefault();
            const checkButtonId = `check-practice-btn-${e.target.id.split('-').pop()}`;
            const checkButton = document.getElementById(checkButtonId);
            if (checkButton && checkButton.style.display !== 'none') {
                checkButton.click();
            }
        }
    });

    // 번역기 모달 이벤트
    openTranslatorBtn.addEventListener('click', () => {
        translatorModal.classList.remove('hidden');
        if (fabContainer) fabContainer.classList.remove('is-open');
    });
    closeTranslatorBtn.addEventListener('click', () => { translatorModal.classList.add('hidden'); if (currentAudio) currentAudio.pause(); });
    translateBtn.addEventListener('click', handleTranslation);
    koreanInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTranslation(); } });
    translationResult.addEventListener('click', (e) => { const ttsButton = e.target.closest('.tts-btn'); if (ttsButton) { const textToSpeak = ttsButton.dataset.text; if (textToSpeak) playTTS(textToSpeak, ttsButton); } });

    // 작문 교정 모달 이벤트
    openCorrectionBtn.addEventListener('click', () => {
        correctionModal.classList.remove('hidden');
        if (fabContainer) fabContainer.classList.remove('is-open');
    });
    closeCorrectionBtn.addEventListener('click', () => { correctionModal.classList.add('hidden'); if (currentAudio) currentAudio.pause(); });
    correctWritingBtn.addEventListener('click', handleCorrectWriting);
    getTopicBtn.addEventListener('click', handleGetWritingTopic);
    correctionResult.addEventListener('click', (e) => {
        const ttsButton = e.target.closest('.tts-btn');
        if (ttsButton) {
            const textToSpeak = ttsButton.dataset.text;
            if (textToSpeak) playTTS(textToSpeak, ttsButton);
        }
    });

    // 교정 노트 모달 이벤트
    openCorrectionHistoryBtn.addEventListener('click', () => {
        renderCorrectionHistory();
        correctionHistoryModal.classList.remove('hidden');
    });
    closeCorrectionHistoryBtn.addEventListener('click', () => {
        correctionHistoryModal.classList.add('hidden');
    });
    clearCorrectionHistoryBtn.addEventListener('click', () => {
        if (confirm('정말로 모든 교정 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
            correctionHistory = [];
            saveCorrectionHistory();
            renderCorrectionHistory();
        }
    });
    correctionHistoryList.addEventListener('click', (e) => {
        const ttsButton = e.target.closest('.tts-btn');
        if (ttsButton) {
            const textToSpeak = ttsButton.dataset.text;
            if (textToSpeak) playTTS(textToSpeak, ttsButton);
        }
    });


    // 커스텀 알림
    customAlertCloseBtn.addEventListener('click', () => customAlertModal.classList.add('hidden'));

    // 전체 패턴 모달 이벤트
    allPatternsBtn.addEventListener('click', () => allPatternsModal.classList.remove('hidden'));
    closeAllPatternsBtn.addEventListener('click', () => allPatternsModal.classList.add('hidden'));
    allPatternsList.addEventListener('click', (e) => {
        const selectedPatternDiv = e.target.closest('[data-pattern-index]');
        if (selectedPatternDiv) {
            const patternIndex = parseInt(selectedPatternDiv.dataset.patternIndex, 10);
            const selectedPattern = allPatterns[patternIndex];
            if (selectedPattern) {
                renderPatterns([selectedPattern]);
                allPatternsModal.classList.add('hidden');
                window.scrollTo(0, 0);
            }
        }
    });

    // AI 채팅 모달 이벤트
    chatBtn.addEventListener('click', () => {
        chatModal.classList.remove('hidden');
        if (fabContainer) fabContainer.classList.remove('is-open');

        chatHistory.innerHTML = '';
        conversationHistory = [];
        chatInput.value = '';
        chatHistory.querySelectorAll('.suggestion-chip').forEach(chip => chip.closest('div.flex.justify-center')?.remove());

        const firstMsg = { chinese: '你好！我叫灵，很高兴认识你。我们用中文聊聊吧！', pinyin: 'Nǐ hǎo! Wǒ jiào Líng, hěn gāoxìng rènshi nǐ. Wǒmen yòng Zhōngwén liáoliao ba!', korean: '안녕하세요! 제 이름은 링이에요, 만나서 반가워요. 우리 중국어로 대화해요!' };
        addMessageToHistory('ai', firstMsg);
        conversationHistory.push({ role: 'model', parts: [{ text: JSON.stringify(firstMsg) }] });
    });
    closeChatBtn.addEventListener('click', () => {
        chatModal.classList.add('hidden');
        if (recognition && isRecognizing) {
            console.log("Stopping recognition due to modal close...");
            recognition.stop();
        }
    });
    sendChatBtn.addEventListener('click', handleSendMessage);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
    chatHistory.addEventListener('click', (e) => {
        const ttsButton = e.target.closest('.tts-btn');
        if (ttsButton) {
            const textToSpeak = ttsButton.dataset.text;
            if (textToSpeak) playTTS(textToSpeak, ttsButton);
        }
    });

    micBtn.addEventListener('click', () => {
        if (!recognition) {
             showAlert('음성 인식이 지원되지 않거나 초기화되지 않았습니다.');
             console.log("Recognition not available or not initialized.");
            return;
        }
        if (isRecognizing && currentRecognitionMicButton !== micBtn) {
             console.log("Stopping ongoing recognition initiated by another mic...");
             recognition.stop();
             setTimeout(() => startChatRecognition(), 300);
        } else if (isRecognizing) {
            console.log("Stopping recognition (from chat mic)...");
            recognition.stop();
        } else {
             startChatRecognition();
        }
    });

    suggestReplyBtn.addEventListener('click', handleSuggestReply);

    dailyQuizBtn.addEventListener('click', startQuiz);
    closeQuizBtn.addEventListener('click', () => quizModal.classList.add('hidden'));

    quizContent.addEventListener('click', (e) => {
        const targetButton = e.target.closest('.quiz-option-btn');
        if (targetButton) {
            handleQuizAnswer(targetButton);
            return;
        }

        if (e.target.id === 'close-quiz-modal-btn') {
            quizModal.classList.add('hidden');
            return;
        }
    });

    // Expandable FAB (플로팅 버튼 그룹)
    if (fabMainBtn && fabContainer) {
        fabMainBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fabContainer.classList.toggle('is-open');
        });
    }
    document.addEventListener('click', (e) => {
        if (fabContainer && fabContainer.classList.contains('is-open')) {
            if (!fabContainer.contains(e.target)) {
                fabContainer.classList.remove('is-open');
            }
        }
    });
}

// --- 음성 인식 시작 헬퍼 함수 ---
function startPracticeRecognition(button, targetInput) {
    try {
        console.log("Starting recognition (for practice input)...");
        currentRecognitionTargetInput = targetInput;
        currentRecognitionMicButton = button;
        recognition.start();
        button.classList.add('is-recording');
        isRecognizing = true;
    } catch(e) {
         handleRecognitionStartError(e, button);
    }
}

function startChatRecognition() {
    try {
        console.log("Starting recognition (for chat input)...");
        currentRecognitionTargetInput = chatInput;
        currentRecognitionMicButton = micBtn;
        recognition.start();
        micBtn.classList.add('is-recording');
        isRecognizing = true;
    } catch(e) {
         handleRecognitionStartError(e, micBtn);
    }
}

function handleRecognitionStartError(e, button) {
     console.error("Speech recognition start error:", e);
     if (e.name === 'NotAllowedError' || e.name === 'SecurityError') { showAlert("마이크 권한이 필요합니다. 브라우저 설정에서 허용해주세요."); }
     else if (e.name === 'InvalidStateError') { console.warn("Attempted to start recognition while already active. Ignoring."); }
     else { showAlert("음성 인식을 시작할 수 없습니다. 잠시 후 다시 시도해주세요."); }
     if(button) button.classList.remove('is-recording');
     if (e.name !== 'InvalidStateError') {
         isRecognizing = false;
         currentRecognitionTargetInput = null;
         currentRecognitionMicButton = null;
     }
}

// --- 앱 초기화 함수 ---
export function initializeApp(patterns) {
    allPatterns = patterns;
    document.addEventListener('DOMContentLoaded', () => {
        initializeDOM();
        displayDate();
        initializeCounts();
        initializeCorrectionHistory();
        loadDailyPatterns();
        renderAllPatternsList();
        setupScreenWakeLock();
        initializeSpeechRecognition();
        setupEventListeners();
    });
}

// --- 앱 실행 ---
initializeApp(patternsData);

// v.2025.10.24_0915