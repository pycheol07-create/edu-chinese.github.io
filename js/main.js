import { allPatterns as patternsData } from '../data/patterns.js';

let allPatterns = [];
let learningCounts = {};
const audioCache = {};
let currentAudio = null;
let currentPlayingButton = null;
let wakeLock = null;
let conversationHistory = []; // AI 채팅 기록

// DOM Elements
let patternContainer, currentDateEl, newPatternBtn, openTranslatorBtn, translatorModal,
    closeTranslatorBtn, translateBtn, koreanInput, translationResult, customAlertModal,
    customAlertMessage, customAlertCloseBtn, allPatternsBtn, allPatternsModal,
    closeAllPatternsBtn, allPatternsList, chatBtn, chatModal, closeChatBtn,
    chatHistory, chatInput, sendChatBtn, micBtn, suggestReplyBtn;

// 음성 인식 관련
let recognition = null;
let isRecognizing = false;

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
    chatBtn = document.getElementById('chat-btn');
    chatModal = document.getElementById('chat-modal');
    closeChatBtn = document.getElementById('close-chat-btn');
    chatHistory = document.getElementById('chat-history');
    chatInput = document.getElementById('chat-input');
    sendChatBtn = document.getElementById('send-chat-btn');
    micBtn = document.getElementById('mic-btn');
    suggestReplyBtn = document.getElementById('suggest-reply-btn');
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
    buttonElement.classList.add('is-playing');
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
            buttonElement.classList.remove('is-playing');
            currentAudio = null;
            currentPlayingButton = null;
        };
        audio.onerror = (e) => {
            console.error('Audio playback error:', e);
            showAlert('오디오 재생 중 오류가 발생했습니다.');
            buttonElement.classList.remove('is-playing');
            currentAudio = null;
            currentPlayingButton = null;
        };
    } catch (error) {
        console.error('TTS error:', error);
        showAlert(`음성(TTS)을 불러오는 데 실패했습니다: ${error.message}`);
        buttonElement.classList.remove('is-playing');
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

// --- 날짜 및 패턴 렌더링 함수 ---
function getTodayString() { return new Date().toISOString().split('T')[0]; }
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
        const examplesHtml = p.examples.map(ex => `...`).join(''); // 예문 HTML (생략)
        const vocabHtml = p.vocab.map(v => `...`).join(''); // 단어 HTML (생략)
        const indexHtml = showIndex ? `...` : ''; // 인덱스 HTML (생략)
        const practiceHtml = p.practice ? `...` : ''; // 연습 HTML (생략 - 이전 버전과 동일)
        card.innerHTML = `...`; // 카드 전체 HTML (생략 - 이전 버전과 동일)
        patternContainer.appendChild(card);
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
    allPatterns.forEach((p, index) => { /* ... 이전 코드와 동일 ... */ });
}

// --- 화면 꺼짐 방지 ---
async function setupScreenWakeLock() { /* ... 이전 코드와 동일 ... */ }

// --- AI 채팅 관련 함수 ---
function addMessageToHistory(sender, messageData) { /* ... 이전 코드와 동일 ... */ }

// --- [FEATURE UPDATE START: Suggest Reply with Pinyin & Korean Display] ---
// 답변 추천 UI 추가 함수
function addSuggestionToHistory(suggestions) { // suggestions는 [{chinese: "...", pinyin: "...", korean: "..."}, ...] 형태의 배열
    const suggestionElement = document.createElement('div');
    suggestionElement.className = 'flex justify-center my-2';

    // [수정] 버튼 내부에 chinese, pinyin, korean 표시
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

    // 추천 답변 클릭 시 입력창에 채우기
    suggestionElement.querySelectorAll('.suggestion-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            chatInput.value = chip.dataset.text; // chinese 텍스트만 입력
            chatInput.focus();
            suggestionElement.remove();
        });
    });

    chatHistory.scrollTop = chatHistory.scrollHeight;
}
// --- [FEATURE UPDATE END] ---


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
            try {
                aiResponseData = JSON.parse(aiResponseText);
                conversationHistory.push({ role: 'model', parts: [{ text: aiResponseText }] });
            } catch (e) {
                console.error("AI response is not valid JSON:", aiResponseText);
                aiResponseData = { chinese: aiResponseText, pinyin: "(JSON 파싱 오류)", korean: "(번역 오류)" };
                conversationHistory.push({ role: 'model', parts: [{ text: aiResponseText }] });
            }
        } else {
             console.error("Invalid response structure from chat API:", result);
             aiResponseData = { chinese: "(유효하지 않은 응답)", pinyin: "", korean: "" };
        }
        addMessageToHistory('ai', aiResponseData);
    } catch (error) {
        console.error('Chat error:', error);
        showAlert(`대화 중 오류가 발생했습니다: ${error.message}`);
    } finally {
        document.getElementById('chat-loading')?.remove();
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
        const suggestions = result.suggestions || []; // API 응답은 { suggestions: [{chinese:..., pinyin:..., korean:...}] } 형태여야 함
        if (suggestions.length > 0 && suggestions.every(s => s.chinese && s.pinyin && s.korean)) { // 데이터 구조 검증 강화
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


// --- 번역기 함수 ---
async function handleTranslation() {
     /* ... 이전 코드와 동일 ... */
    const text = koreanInput.value.trim();
    if (!text) {
        showAlert('번역할 한국어 문장을 입력하세요.');
        return;
    }

    translateBtn.disabled = true;
    translationResult.innerHTML = '<div class="loader mx-auto"></div>';

    try {
        const systemPrompt = `You are a professional Korean-to-Chinese translator and language teacher.
Translate the following Korean sentence into natural, native-sounding Chinese.
Provide:
1.  The main Chinese translation.
2.  The pinyin for the main translation.
3.  (Optional) 1-2 alternative natural expressions if applicable.
4.  A concise explanation (in Korean) of why this expression is natural, what the key vocabulary or grammar point is.

Format your response as a single, valid JSON object with keys "chinese", "pinyin", "alternatives" (string array), and "explanation" (string, in Korean).
Do not include markdown backticks.`;

        const result = await callGeminiAPI('translate', {
            text,
            systemPrompt
        });

        let translationData;
        if (result.candidates && result.candidates[0]?.content?.parts?.[0]) {
            const translationText = result.candidates[0].content.parts[0].text;
            try {
                translationData = JSON.parse(translationText);
            } catch (e) {
                console.error("AI translation response is not valid JSON:", translationText);
                translationData = { chinese: translationText, pinyin: "(JSON 파싱 오류)", alternatives: [], explanation: "(설명 파싱 오류)" };
            }
        } else {
             console.error("Invalid response structure from translate API:", result);
             translationData = { chinese: "(유효하지 않은 응답)", pinyin: "", alternatives: [], explanation: "" };
        }

        let alternativesHtml = '';
        if (translationData.alternatives && Array.isArray(translationData.alternatives) && translationData.alternatives.length > 0) {
            alternativesHtml = `
                <p class="text-sm text-gray-500 mt-3">다른 표현:</p>
                <ul class="list-disc list-inside text-sm text-gray-600 chinese-text">
                    ${translationData.alternatives.map(alt => `<li>${alt}</li>`).join('')}
                </ul>
            `;
        }

        let explanationHtml = '';
        if (translationData.explanation) {
            explanationHtml = `
                <div class="mt-4 pt-3 border-t">
                    <h4 class="text-sm font-semibold text-gray-700">💡 표현 꿀팁:</h4>
                    <p class="text-sm text-gray-600 mt-1">${translationData.explanation.replace(/\n/g, '<br>')}</p>
                </div>
            `;
        }

        translationResult.innerHTML = `
            <div class="flex items-center">
                <p class="text-xl chinese-text font-bold text-gray-800">${translationData.chinese}</p>
                <button class="tts-btn ml-2 p-1 rounded-full hover:bg-gray-200 transition-colors" data-text="${translationData.chinese}">
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-500 pointer-events-none">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                    </svg>
                </button>
            </div>
            <p class="text-md text-gray-500">${translationData.pinyin || '(병음 정보 없음)'}</p>
            ${alternativesHtml}
            ${explanationHtml}
        `;
    } catch (error) {
        console.error('Translation error:', error);
        translationResult.innerHTML = `<p class="text-red-500 text-center">번역 중 오류가 발생했습니다: ${error.message}</p>`;
    } finally {
        translateBtn.disabled = false;
    }
}

// --- 음성 인식 초기화 ---
function initializeSpeechRecognition() { /* ... 이전 코드와 동일 ... */ }

// --- 메인 이벤트 리스너 설정 ---
function setupEventListeners() { /* ... 이전 코드와 동일 ... */ }

// --- 앱 초기화 함수 ---
export function initializeApp(patterns) { /* ... 이전 코드와 동일 ... */ }

// --- 앱 실행 ---
initializeApp(patternsData);

// v.2025.10.20_1101-10