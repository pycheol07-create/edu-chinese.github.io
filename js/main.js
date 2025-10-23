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
    chatHistory, chatInput, sendChatBtn, micBtn, suggestReplyBtn,
    dailyQuizBtn, quizModal, closeQuizBtn, quizContent,
    openCorrectorBtn, correctorModal, closeCorrectorBtn, writingInput, correctWritingBtn, correctionResult;


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
    micBtn = document.getElementById('mic-btn'); // Chat mic
    suggestReplyBtn = document.getElementById('suggest-reply-btn');

    dailyQuizBtn = document.getElementById('daily-quiz-btn');
    quizModal = document.getElementById('quiz-modal');
    closeQuizBtn = document.getElementById('close-quiz-btn');
    quizContent = document.getElementById('quiz-content');

    // 작문 교정 DOM 초기화
    openCorrectorBtn = document.getElementById('open-corrector-btn');
    correctorModal = document.getElementById('corrector-modal');
    closeCorrectorBtn = document.getElementById('close-corrector-btn');
    writingInput = document.getElementById('writing-input');
    correctWritingBtn = document.getElementById('correct-writing-btn');
    correctionResult = document.getElementById('correction-result');
    if (!openCorrectorBtn || !correctorModal || !closeCorrectorBtn || !writingInput || !correctWritingBtn || !correctionResult) {
        console.error("One or more corrector modal elements not found in the DOM!");
    }
}

// --- 커스텀 알림 함수 ---
function showAlert(message) {
    if (!customAlertModal || !customAlertMessage) return; // DOM 요소 확인
    customAlertMessage.textContent = message;
    customAlertModal.classList.remove('hidden');
}

// --- API 호출 공통 함수 ---
async function callGeminiAPI(action, body) {
    try {
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ...body })
        });
        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                // If response is not JSON
                errorData = { error: `API ${action} failed with status ${response.status}: ${response.statusText}` };
            }
            throw new Error(errorData.error || `API ${action} failed`);
        }
        return response.json();
    } catch (error) {
         console.error(`Error calling API action ${action}:`, error);
         throw error; // Re-throw the error to be caught by the caller
    }
}

// --- TTS (Text-to-Speech) 함수 ---
async function playTTS(text, buttonElement) {
    if (!text) {
        console.warn("TTS requested for empty text.");
        return;
    }
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
        if (currentPlayingButton) {
            currentPlayingButton.classList.remove('is-playing');
            // If the clicked button was the one playing, just stop
            if (currentPlayingButton === buttonElement) {
                currentPlayingButton = null;
                return;
            }
        }
    }
    currentPlayingButton = buttonElement;
     if(buttonElement) buttonElement.classList.add('is-playing');
    try {
        let audioData = audioCache[text];
        if (!audioData) {
            console.log(`TTS Cache miss for: "${text}". Fetching...`);
            const result = await callGeminiAPI('tts', { text });
            if (!result || !result.audioContent) {
                throw new Error("Invalid TTS response from API.");
            }
            audioData = result.audioContent;
            audioCache[text] = audioData;
            console.log(`TTS fetched and cached for: "${text}"`);
        } else {
             console.log(`TTS Cache hit for: "${text}"`);
        }
        const audio = new Audio(`data:audio/mp3;base64,${audioData}`);
        currentAudio = audio;
        audio.play();
        audio.onended = () => {
            if(buttonElement) buttonElement.classList.remove('is-playing');
            // Check if this audio instance is still the current one before nullifying
            if (currentAudio === audio) {
                currentAudio = null;
                currentPlayingButton = null;
            }
            console.log("TTS playback finished.");
        };
        audio.onerror = (e) => {
            console.error('Audio playback error:', e);
            showAlert('오디오 재생 중 오류가 발생했습니다.');
             if(buttonElement) buttonElement.classList.remove('is-playing');
             if (currentAudio === audio) {
                currentAudio = null;
                currentPlayingButton = null;
             }
        };
    } catch (error) {
        console.error('TTS error:', error);
        showAlert(`음성(TTS)을 불러오는 데 실패했습니다: ${error.message}`);
         if(buttonElement) buttonElement.classList.remove('is-playing');
        // Ensure cleanup even on fetch error
        currentAudio = null;
        currentPlayingButton = null;
    }
}

// --- 학습 카운트 관련 함수 ---
function initializeCounts() {
    try {
        const storedCounts = localStorage.getItem('chineseLearningCounts');
        learningCounts = storedCounts ? JSON.parse(storedCounts) : {};
    } catch (e) {
        console.error("Failed to load or parse learning counts from localStorage:", e);
        learningCounts = {}; // Reset to empty object on error
    }
}
function saveCounts() {
    try {
        localStorage.setItem('chineseLearningCounts', JSON.stringify(learningCounts));
    } catch (e) {
         console.error("Failed to save learning counts to localStorage:", e);
         showAlert("학습 횟수를 저장하는데 실패했습니다.");
    }
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
    if (!currentDateEl) return;
    const today = new Date();
    currentDateEl.textContent = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
}
function getRandomPatterns() {
    if (!allPatterns || allPatterns.length === 0) return [];
    // Ensure we don't try to slice more than available
    const count = Math.min(2, allPatterns.length);
    const shuffled = [...allPatterns].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

function renderPatterns(patterns, showIndex = false) {
    if (!patternContainer) {
        console.error("Pattern container element not found!");
        return;
    }
    patternContainer.innerHTML = ''; // Clear previous patterns
    if (!patterns || patterns.length === 0) {
        patternContainer.innerHTML = '<p class="text-center text-gray-500">표시할 패턴이 없습니다.</p>';
        return;
    }

    patterns.forEach((p, index) => {
        // Basic validation for pattern object
        if (!p || !p.pattern || !p.meaning || !Array.isArray(p.examples) || !Array.isArray(p.vocab)) {
            console.warn("Skipping invalid pattern data:", p);
            return; // Skip rendering this invalid pattern
        }

        const count = learningCounts[p.pattern] || 0;
        const card = document.createElement('div');
        card.className = 'bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300';

        const examplesHtml = p.examples.map(ex => {
            if (!ex || !ex.chinese || !ex.korean) return ''; // Skip invalid examples
            return `
            <div class="mt-3">
                <div class="flex items-center">
                    <p class="text-lg chinese-text text-gray-800 break-words">${ex.chinese}</p>
                    <button class="tts-btn ml-2 p-1 rounded-full hover:bg-gray-200 transition-colors flex-shrink-0" data-text="${ex.chinese}">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-500 pointer-events-none"><path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg>
                    </button>
                </div>
                <p class="text-sm text-gray-500 break-words">${ex.pinyin || ''}</p>
                <p class="text-md text-gray-600 break-words">${ex.korean}</p>
            </div>`;
            }).join('');

        const vocabHtml = p.vocab.map(v => {
             if (!v || !v.word || !v.meaning) return ''; // Skip invalid vocab
             return `
            <div class="flex items-baseline">
                <p class="w-1/3 text-md chinese-text text-gray-700 font-medium break-words">${v.word}</p>
                <p class="w-1/3 text-sm text-gray-500 break-words">${v.pinyin || ''}</p>
                <p class="w-1/3 text-sm text-gray-600 break-words">${v.meaning}</p>
            </div>`;
            }).join('');

        const indexHtml = showIndex ? `<span class="bg-blue-100 text-blue-800 text-sm font-semibold mr-3 px-3 py-1 rounded-full">${index + 1}</span>` : '';

        // Practice section - Ensure p.practice exists and has needed properties
        const practiceHtml = (p.practice && p.practice.korean && p.practice.chinese) ? `
            <div class="mt-6">
                <h3 class="text-lg font-bold text-gray-700 border-b pb-1">✍️ AI 연습 문제 (5개)</h3>
                <div id="practice-container-${index}" class="mt-3 bg-sky-50 p-4 rounded-lg relative" data-spree-count="0" data-spree-goal="5">
                    <button id="show-hint-btn-${index}" title="힌트 보기" data-pattern-string="${p.pattern}" data-hint-target="practice-hint-${index}" class="show-hint-btn absolute top-3 right-3 bg-gray-300 hover:bg-gray-400 text-gray-700 p-1.5 rounded-full" style="display: none;">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 pointer-events-none"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.355a11.95 11.95 0 0 1-8.25 0m11.25 0a11.95 11.95 0 0 0-8.25 0M9 7.5a9 9 0 1 1 6 0a9 9 0 0 1-6 0Z" /></svg>
                    </button>
                    <p class="text-md text-gray-700 mb-2">다음 문장을 중국어로 입력해보세요:</p>
                    <p id="practice-korean-${index}" class="text-md font-semibold text-sky-800 mb-3">""</p> {/* Will be loaded by AI */}
                    <div class="flex items-center space-x-2">
                        <button id="practice-mic-btn-${index}" title="음성 입력" data-practice-index="${index}" class="practice-mic-btn mic-btn p-2 rounded-full text-gray-500 hover:bg-gray-200 flex-shrink-0" style="display: none;">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 pointer-events-none"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 0 0 6-6V7.5a6 6 0 0 0-12 0v5.25a6 6 0 0 0 6 6Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5v2.25a7.5 7.5 0 0 1-15 0v-2.25" /><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 18.75a8.25 8.25 0 0 0 10.5 0" /></svg>
                        </button>
                        <input type="text" id="practice-input-${index}" class="flex-grow p-2 border border-gray-300 rounded-md chinese-text" placeholder="중국어를 입력하세요..." disabled>
                        <button id="check-practice-btn-${index}" data-answer="" data-pinyin="" data-input-id="practice-input-${index}" class="check-practice-btn bg-sky-500 hover:bg-sky-600 text-white font-bold py-2 px-4 rounded-lg whitespace-nowrap flex-shrink-0" style="display: none;">정답 확인</button>
                    </div>
                    <div id="practice-hint-${index}" class="mt-3"></div>
                    <div id="practice-result-${index}" class="mt-3 text-center"></div>
                    <div id="practice-counter-${index}" class="text-sm text-gray-500 mt-2 text-center">AI 연습문제 로딩 중...</div>
                </div>
            </div>` : '';


        card.innerHTML = `
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center">${indexHtml}<div><h2 class="text-2xl font-bold text-gray-800 chinese-text break-words">${p.pattern}</h2><p class="text-md text-gray-500 break-words">${p.pinyin || ''}</p></div></div>
                <div class="text-right flex-shrink-0 ml-4"> {/* Added flex-shrink-0 and margin */}
                    <button data-pattern="${p.pattern}" class="learn-btn bg-yellow-400 hover:bg-yellow-500 text-white text-sm font-bold py-1 px-3 rounded-full transition-colors mb-1">학습 완료!</button> {/* Added mb-1 */}
                    <p class="text-xs text-gray-500">학습 <span class="font-bold text-red-500 count-display">${count}</span>회</p>
                    <button data-pattern-string="${p.pattern}" class="start-chat-pattern-btn mt-2 bg-purple-100 hover:bg-purple-200 text-purple-700 text-xs font-bold py-1 px-3 rounded-full transition-colors w-full text-center">
                        💬 이 패턴으로 대화
                    </button>
                </div>
            </div>
            <div class="mt-4"><p class="text-lg text-blue-700 font-semibold mb-2 break-words">${p.meaning}</p><p class="text-sm text-gray-500 bg-gray-100 p-2 rounded-md break-words"><b>🤔 어떻게 사용할까요?</b> ${p.structure || '구조 정보 없음'}</p></div>
            <div class="mt-4"><h3 class="text-lg font-bold text-gray-700 border-b pb-1">💡 예문 살펴보기</h3>${examplesHtml}</div>
            <div class="mt-6"><h3 class="text-lg font-bold text-gray-700 border-b pb-1">📌 주요 단어</h3><div class="mt-3 space-y-2">${vocabHtml}</div></div>
            ${practiceHtml}`;
        patternContainer.appendChild(card);

        // Auto-start practice problems if the section exists
        if (p.practice && p.practice.korean && p.practice.chinese) {
            setTimeout(() => {
                const practiceContainerDiv = document.getElementById(`practice-container-${index}`);
                 if (practiceContainerDiv) {
                     // Check if practice has already started (e.g., due to fast re-render)
                     if (parseInt(practiceContainerDiv.dataset.spreeCount, 10) === 0) {
                        handleNewPracticeRequest(p.pattern, index);
                     }
                 } else {
                     console.error(`Practice container practice-container-${index} not found immediately after render.`);
                 }
            }, 50);
        }
    });
}

function loadDailyPatterns() {
    const todayStr = getTodayString();
    let patternsToShow = null;
    try {
        const storedData = JSON.parse(localStorage.getItem('dailyChinesePatterns'));
        if (storedData && storedData.date === todayStr && Array.isArray(storedData.patterns)) {
            patternsToShow = storedData.patterns;
            console.log("Loaded patterns from localStorage for today.");
        }
    } catch (e) {
        console.error("Failed to load or parse daily patterns from localStorage:", e);
    }

    if (!patternsToShow) {
        patternsToShow = getRandomPatterns();
        try {
            localStorage.setItem('dailyChinesePatterns', JSON.stringify({ date: todayStr, patterns: patternsToShow }));
            console.log("Generated and stored new patterns for today.");
        } catch(e) {
            console.error("Failed to save new daily patterns to localStorage:", e);
            showAlert("오늘의 패턴을 저장하는데 실패했습니다.");
        }
    }
    renderPatterns(patternsToShow);
}

function renderAllPatternsList() {
    if (!allPatternsList) return;
    allPatternsList.innerHTML = ''; // Clear previous list
    if (!allPatterns || allPatterns.length === 0) {
        allPatternsList.innerHTML = '<p class="text-center text-gray-500">패턴 목록이 비어 있습니다.</p>';
        return;
    }
    allPatterns.forEach((p, index) => {
        if (!p || !p.pattern || !p.meaning) return; // Skip invalid patterns

        const patternItem = document.createElement('div');
        patternItem.className = 'p-4 hover:bg-gray-100 cursor-pointer';
        patternItem.dataset.patternIndex = index;
        patternItem.innerHTML = `
            <div class="flex items-start pointer-events-none">
                <span class="mr-3 text-gray-500 font-medium w-8 text-right">${index + 1}.</span>
                <div>
                    <p class="text-lg font-semibold chinese-text text-gray-800 break-words">${p.pattern}</p>
                    <p class="text-sm text-gray-600 break-words">${p.meaning}</p>
                </div>
            </div>`;
        allPatternsList.appendChild(patternItem);
    });
}

async function setupScreenWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            // Release any existing lock first
            if (wakeLock) {
                await wakeLock.release();
                wakeLock = null;
                console.log('Previous Screen Wake Lock released.');
            }
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => {
                 console.log('Screen Wake Lock released.');
                 // Optional: Re-acquire lock if needed and document is visible
                 // if (document.visibilityState === 'visible') {
                 //   setupScreenWakeLock();
                 // }
             });
            console.log('Screen Wake Lock active');
        } catch (err) {
            console.error(`Screen Wake Lock request failed: ${err.name}, ${err.message}`);
            wakeLock = null; // Ensure wakeLock is null on failure
        }
    } else {
        console.log('Screen Wake Lock API not supported.');
    }
    // Re-acquire lock on visibility change
    document.addEventListener('visibilitychange', async () => {
        if (wakeLock !== null && document.visibilityState === 'visible') {
           await setupScreenWakeLock(); // Request again when tab becomes visible
        }
    });
}

// Helper function to safely parse JSON, removing markdown backticks
function safeJsonParse(jsonString) {
    if (!jsonString || typeof jsonString !== 'string') {
        console.warn("Invalid input to safeJsonParse:", jsonString);
        return null;
    }
    try {
        const cleanedString = jsonString.trim().replace(/^```json\s*|\s*```$/g, '');
        // Check if the cleaned string is potentially valid JSON
        if ((!cleanedString.startsWith('{') || !cleanedString.endsWith('}')) &&
            (!cleanedString.startsWith('[') || !cleanedString.endsWith(']'))) {
             console.warn("Cleaned string doesn't look like a valid JSON object or array:", cleanedString);
             // Depending on expected output, you might try parsing anyway or return null
             // For this app, we strictly expect objects or specific arrays (suggestions)
             return null;
        }
        return JSON.parse(cleanedString);
    } catch (e) {
        console.error("Failed to parse JSON string:", jsonString, e);
        return null;
    }
}


function addMessageToHistory(sender, messageData) {
    if (!chatHistory || !messageData) return;
    if (sender === 'user') {
        const messageElement = document.createElement('div');
        messageElement.className = 'flex justify-end mb-2'; // Added margin
        messageElement.innerHTML = `<div class="bg-purple-500 text-white p-3 rounded-lg max-w-xs break-words shadow">${messageData.text}</div>`; // Added shadow
        chatHistory.appendChild(messageElement);
    } else { // AI
        if (messageData.correction && messageData.correction.corrected) {
            const correctionElement = document.createElement('div');
            correctionElement.className = 'flex justify-center my-2';
            correctionElement.innerHTML = `
                <div class="bg-yellow-50 p-3 rounded-lg text-sm w-full max-w-xs border border-yellow-300 shadow-sm">
                    <h4 class="font-semibold text-yellow-800">💡 표현 교정</h4>
                    <p class="text-gray-500 mt-1 break-words">"<s>${messageData.correction.original || '...'}</s>"</p>
                    <p class="text-green-700 font-medium chinese-text mt-1 break-words">→ ${messageData.correction.corrected}</p>
                    <p class="text-gray-700 mt-2 pt-2 border-t border-yellow-200 break-words">${messageData.correction.explanation || '자연스러운 표현으로 수정했어요.'}</p>
                </div>`;
            chatHistory.appendChild(correctionElement);
        }
        const messageElement = document.createElement('div');
        messageElement.className = 'flex justify-start mb-2'; // Added margin
        messageElement.innerHTML = `
            <div class="bg-white p-3 rounded-lg max-w-xs border shadow-sm">
                <div class="flex items-center">
                    <p class="text-lg chinese-text text-gray-800 break-words">${messageData.chinese || '(내용 없음)'}</p>
                    ${messageData.chinese ?
                        `<button class="tts-btn ml-2 p-1 rounded-full hover:bg-gray-200 transition-colors flex-shrink-0" data-text="${messageData.chinese}">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-500 pointer-events-none"><path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg>
                        </button>`
                        : ''
                    }
                </div>
                <p class="text-sm text-gray-500 break-words mt-1">${messageData.pinyin || ''}</p>
                ${messageData.korean ? `<p class="text-sm text-gray-600 border-t mt-2 pt-2 break-words">${messageData.korean}</p>` : ''}
            </div>`;
        chatHistory.appendChild(messageElement);
    }
     // Scroll smoothly to the bottom
     chatHistory.scrollTo({ top: chatHistory.scrollHeight, behavior: 'smooth' });
}
function addSuggestionToHistory(suggestions) {
     if (!chatHistory || !suggestions || suggestions.length === 0) return;
    const suggestionElement = document.createElement('div');
    suggestionElement.className = 'flex justify-center my-2';
    const buttonsHtml = suggestions.map(suggestion => {
        // Ensure suggestion has required properties
        const chinese = suggestion.chinese || '';
        const pinyin = suggestion.pinyin || '';
        const korean = suggestion.korean || '';
        return `<button class="suggestion-chip bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-sm hover:bg-blue-200 mx-1 mb-1 flex flex-col items-center shadow-sm" data-text="${chinese}">
            <span class="chinese-text font-medium">${chinese}</span>
            <span class="text-xs text-gray-500 mt-0.5">${pinyin}</span>
            <span class="text-xs text-gray-600 mt-0.5">${korean}</span>
         </button>`;
        }).join('');
    suggestionElement.innerHTML = `
        <div class="bg-gray-50 p-3 rounded-lg text-center w-full shadow-sm border">
            <p class="text-xs text-gray-600 mb-2 font-medium">💡 이렇게 답해보세요:</p>
            <div class="flex flex-wrap justify-center">${buttonsHtml}</div>
        </div>`;
    chatHistory.appendChild(suggestionElement);
    suggestionElement.querySelectorAll('.suggestion-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            if (chatInput) {
                chatInput.value = chip.dataset.text;
                chatInput.focus();
            }
            suggestionElement.remove(); // Remove suggestions after one is clicked
        });
    });
    chatHistory.scrollTo({ top: chatHistory.scrollHeight, behavior: 'smooth' });
}
async function handleSendMessage() {
    if (!chatInput || !chatHistory || !sendChatBtn) return;
    const userInput = chatInput.value.trim();
    if (!userInput) return;

    // Remove any existing suggestion chips immediately
    chatHistory.querySelectorAll('.suggestion-chip').forEach(chip => chip.closest('div.flex.justify-center')?.remove());

    addMessageToHistory('user', { text: userInput });
    chatInput.value = ''; // Clear input after sending
    chatInput.focus(); // Keep focus on input

    const loadingElement = document.createElement('div');
    loadingElement.className = 'flex justify-start mb-2'; // Added margin
    loadingElement.id = 'chat-loading';
    loadingElement.innerHTML = `<div class="bg-white p-3 rounded-lg border shadow-sm"><div class="loader"></div></div>`;
    chatHistory.appendChild(loadingElement);
    chatHistory.scrollTo({ top: chatHistory.scrollHeight, behavior: 'smooth' });

    try {
        conversationHistory.push({ role: 'user', parts: [{ text: userInput }] });
        // Use a temporary history to prevent modifying the main one if API fails
        const currentHistory = [...conversationHistory];
        const result = await callGeminiAPI('chat', { text: userInput, history: currentHistory }); // Pass current history

        let aiResponseData;
        let aiRawText = ''; // Store raw text for history
        if (result.candidates && result.candidates[0]?.content?.parts?.[0]) {
            aiRawText = result.candidates[0].content.parts[0].text; // Get raw/cleaned text from backend
            aiResponseData = safeJsonParse(aiRawText);

            if (!aiResponseData) {
                console.error("Failed to parse chat AI response:", aiRawText);
                aiResponseData = {
                    chinese: "哎呀...", pinyin: "Āiyā...",
                    korean: "죄송해요, 응답을 처리하는 데 문제가 발생했어요. 다시 시도해주세요."
                };
                // Do not add failed parse response to history
            } else {
                 // Add the raw/cleaned text to history only on successful parse
                 conversationHistory.push({ role: 'model', parts: [{ text: aiRawText }] });
            }
        } else {
             console.error("Invalid response structure from chat API:", result);
             aiResponseData = { chinese: "(응답 없음)", korean: "AI 응답 구조 오류" };
        }
        // Remove loading indicator *before* adding the final AI message
        const loadingEl = document.getElementById('chat-loading');
        if (loadingEl) loadingEl.remove();
        addMessageToHistory('ai', aiResponseData); // Add AI response or error message

    } catch (error) {
        console.error('Chat error:', error);
        showAlert(`대화 중 오류 발생: ${error.message}`);
        // Remove loading indicator on error
        const loadingEl = document.getElementById('chat-loading');
        if (loadingEl) loadingEl.remove();
        // Display error in chat history as well
        addMessageToHistory('ai', { chinese: "(오류 발생)", korean: `오류: ${error.message}` });
        // Optionally remove the last user message from history if API call failed
        // conversationHistory.pop();
    }
}
async function handleStartChatWithPattern(patternString) {
    if (!chatModal || !chatHistory || !chatInput) return;
    chatModal.classList.remove('hidden');
    chatHistory.innerHTML = '';
    conversationHistory = [];
    chatHistory.querySelectorAll('.suggestion-chip').forEach(chip => chip.closest('div.flex.justify-center')?.remove());
    chatInput.value = '';

    const loadingElement = document.createElement('div');
    loadingElement.className = 'flex justify-start mb-2';
    loadingElement.id = 'chat-loading';
    loadingElement.innerHTML = `<div class="bg-white p-3 rounded-lg border shadow-sm"><div class="loader"></div></div>`;
    chatHistory.appendChild(loadingElement);
    chatHistory.scrollTo({ top: chatHistory.scrollHeight, behavior: 'smooth' });

    try {
        const result = await callGeminiAPI('start_chat_with_pattern', { pattern: patternString });
        let aiResponseData;
        let aiRawText = '';
        if (result.candidates && result.candidates[0]?.content?.parts?.[0]) {
            aiRawText = result.candidates[0].content.parts[0].text;
            aiResponseData = safeJsonParse(aiRawText);

            if (!aiResponseData) {
                 console.error("Failed to parse start_chat AI response:", aiRawText);
                 aiResponseData = { chinese: "哎呀...", korean: "대화 시작 중 오류가 발생했어요. 다시 시도해주세요." };
            } else {
                 conversationHistory.push({ role: 'model', parts: [{ text: aiRawText }] });
            }
        } else {
             console.error("Invalid response structure from start_chat_with_pattern API:", result);
             aiResponseData = { chinese: "(응답 없음)", korean: "AI 응답 구조 오류" };
        }
        const loadingEl = document.getElementById('chat-loading');
        if (loadingEl) loadingEl.remove();
        addMessageToHistory('ai', aiResponseData);
    } catch (error) {
        console.error('Start chat with pattern error:', error);
        showAlert(`대화 시작 중 오류 발생: ${error.message}`);
        const loadingEl = document.getElementById('chat-loading');
        if (loadingEl) loadingEl.remove();
        addMessageToHistory('ai', { chinese: "(오류 발생)", korean: `오류: ${error.message}` });
    }
}
async function handleSuggestReply() {
    if (!suggestReplyBtn || !chatHistory) return;
    // Immediately remove existing suggestions if any
    chatHistory.querySelectorAll('.suggestion-chip').forEach(chip => chip.closest('div.flex.justify-center')?.remove());

    if (conversationHistory.length === 0) {
        showAlert('추천할 답변을 생성하기 위한 대화 내용이 없습니다.');
        return;
    }
    suggestReplyBtn.disabled = true;
    suggestReplyBtn.innerHTML = '<div class="loader-sm mx-auto"></div>'; // Show loader in button

    try {
        // Pass only the relevant history (maybe limit length if too long?)
        const historyForSuggestion = [...conversationHistory];
        const result = await callGeminiAPI('suggest_reply', { history: historyForSuggestion });

        // Backend now directly returns { suggestions: [...] } or throws error
        const suggestions = result.suggestions || [];

        if (suggestions.length > 0) {
            addSuggestionToHistory(suggestions);
        } else {
             console.warn("Received empty suggestions array.");
             showAlert('추천할 만한 답변을 찾지 못했습니다.');
        }
    } catch (error) {
        console.error('Suggest reply error:', error);
        showAlert(`답변 추천 중 오류 발생: ${error.message}`);
    } finally {
        if(suggestReplyBtn) {
             suggestReplyBtn.disabled = false;
             suggestReplyBtn.innerHTML = '💡 답변 추천받기'; // Restore text
        }
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

    if (!koreanEl || !inputEl || !checkBtn || !hintBtn || !micBtnPractice || !resultEl || !hintDataEl || !practiceContainer || !counterEl) {
        console.error(`One or more practice elements for index ${practiceIndex} not found.`);
        return;
    }

    let currentCount = parseInt(practiceContainer.dataset.spreeCount, 10);
    const goal = parseInt(practiceContainer.dataset.spreeGoal, 10);
    let nextCount = currentCount + 1;

    // Reset UI
    koreanEl.textContent = '...'; inputEl.value = ''; resultEl.innerHTML = ''; hintDataEl.innerHTML = '';
    checkBtn.style.display = 'none'; hintBtn.style.display = 'none'; micBtnPractice.style.display = 'none';
    inputEl.disabled = true;
    counterEl.innerHTML = `<div class="loader-sm mx-auto"></div> AI가 문제 ${nextCount}번을 만들고 있어요...`;

    try {
        const result = await callGeminiAPI('generate_practice', { pattern: patternString });
        let practiceData;
        if (result.candidates && result.candidates[0]?.content?.parts?.[0]) {
            const practiceText = result.candidates[0].content.parts[0].text;
            practiceData = safeJsonParse(practiceText);

            if (!practiceData || typeof practiceData.korean !== 'string' || typeof practiceData.chinese !== 'string') {
                 console.error("Parsed practice data is invalid:", practiceData);
                 throw new Error("AI 응답 데이터 형식이 올바르지 않습니다.");
            }

            // Update UI
            koreanEl.textContent = `"${practiceData.korean}"`;
            checkBtn.dataset.answer = practiceData.chinese;
            checkBtn.dataset.pinyin = practiceData.pinyin || '';
            hintBtn.dataset.newVocab = JSON.stringify(practiceData.practiceVocab || []);
            practiceContainer.dataset.spreeCount = nextCount;

            // Show elements
            checkBtn.style.display = ''; hintBtn.style.display = ''; micBtnPractice.style.display = '';
            inputEl.disabled = false; hintBtn.disabled = false; hintBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            counterEl.textContent = `문제 ${nextCount} / ${goal}`;
            inputEl.focus();

        } else {
            console.error("Invalid response structure from generate_practice API:", result);
            throw new Error("AI 응답 구조가 유효하지 않습니다.");
        }
    } catch (error) {
        console.error('New practice request error:', error);
        koreanEl.textContent = "오류: 새 문제를 불러오지 못했습니다.";
        counterEl.textContent = '오류 발생';
        practiceContainer.dataset.spreeCount = currentCount;
        inputEl.disabled = true;
    }
}

async function handleTranslation() {
    if (!koreanInput || !translateBtn || !translationResult) return;
    const text = koreanInput.value.trim();
    if (!text) {
        showAlert('번역할 한국어 문장을 입력하세요.');
        return;
    }
    translateBtn.disabled = true;
    translationResult.innerHTML = '<div class="loader mx-auto"></div>';
    try {
        const patternList = allPatterns.map(p => p.pattern).join(", ");
        const systemPrompt = `You are a professional Korean-to-Chinese translator... Format... JSON object with keys "chinese", "pinyin", "alternatives", "explanation", and "usedPattern"...`;

        const result = await callGeminiAPI('translate', { text, systemPrompt });
        let translationData;
        if (result.candidates && result.candidates[0]?.content?.parts?.[0]) {
            const translationText = result.candidates[0].content.parts[0].text;
            translationData = safeJsonParse(translationText);
            if (!translationData) {
                 console.error("AI translation response failed to parse:", translationText);
                 translationData = { chinese: "(파싱 오류)", korean: "AI 응답 처리 오류." };
            }
        } else {
             console.error("Invalid response structure from translate API:", result);
             translationData = { chinese: "(응답 없음)", korean: "AI 응답 구조 오류." };
        }

        // Display logic (ensure properties exist)
        let alternativesHtml = (translationData.alternatives && Array.isArray(translationData.alternatives) && translationData.alternatives.length > 0)
            ? `<p class="text-sm text-gray-500 mt-3">다른 표현:</p><ul class="list-disc list-inside text-sm text-gray-600 chinese-text">${translationData.alternatives.map(alt => `<li>${alt}</li>`).join('')}</ul>`
            : '';
        let patternHtml = translationData.usedPattern
            ? `<div class="mt-4 pt-3 border-t"><h4 class="text-sm font-semibold text-green-700">💡 학습 패턴 발견!</h4><p class="text-sm text-gray-600 mt-1">이 문장은 <strong>'${translationData.usedPattern}'</strong> 패턴을 사용했어요!</p></div>`
            : '';
        let explanationHtml = translationData.explanation
            ? `<div class="mt-4 pt-3 border-t"><h4 class="text-sm font-semibold text-gray-700">💡 표현 꿀팁:</h4><p class="text-sm text-gray-600 mt-1 break-words">${translationData.explanation.replace(/\n/g, '<br>')}</p></div>`
            : '';

        translationResult.innerHTML = `
            <div class="flex items-center">
                 <p class="text-xl chinese-text font-bold text-gray-800 break-words">${translationData.chinese || ''}</p>
                 ${translationData.chinese ? `<button class="tts-btn ml-2 p-1 rounded-full hover:bg-gray-200 transition-colors flex-shrink-0" data-text="${translationData.chinese}">
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-500 pointer-events-none"><path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg>
                 </button>` : ''}
            </div>
            <p class="text-md text-gray-500 mt-1 break-words">${translationData.pinyin || '(병음 정보 없음)'}</p>
            ${alternativesHtml}
            ${patternHtml}
            ${explanationHtml}`;

    } catch (error) {
        console.error('Translation error:', error);
        translationResult.innerHTML = `<p class="text-red-500 text-center">번역 중 오류 발생: ${error.message}</p>`;
    } finally {
        if(translateBtn) translateBtn.disabled = false;
    }
}

async function handleCorrectWriting() {
    if (!writingInput || !correctWritingBtn || !correctionResult) {
        console.error("Corrector elements not initialized.");
        showAlert("작문 교정 기능을 초기화하는 중 오류가 발생했습니다.");
        return;
    }
    const text = writingInput.value.trim();
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
            const correctionText = result.candidates[0].content.parts[0].text;
            correctionData = safeJsonParse(correctionText);

            if (!correctionData || typeof correctionData.corrected_sentence !== 'string' || typeof correctionData.explanation !== 'string') {
                 console.error("Failed to parse correction data or missing keys:", correctionText, correctionData);
                 throw new Error("AI 응답 처리 중 문제가 발생했습니다 (데이터 형식 오류).");
            }

            // Display result
            let originalSentenceHtml = (correctionData.corrected_sentence !== text)
                 ? `<p class="text-sm text-gray-500 mt-1">원본: <s class="chinese-text break-words">${text}</s></p>`
                 : ''; // If correct, don't show original strikethrough

            correctionResult.innerHTML = `
                ${originalSentenceHtml}
                <div class="flex items-center mt-2">
                     <p class="text-lg chinese-text font-semibold text-gray-800 break-words">${correctionData.corrected_sentence}</p>
                     ${correctionData.corrected_sentence ? `<button class="tts-btn ml-2 p-1 rounded-full hover:bg-gray-200 transition-colors flex-shrink-0" data-text="${correctionData.corrected_sentence}">
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-500 pointer-events-none"><path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg>
                     </button>` : ''}
                </div>
                <div class="mt-3 pt-3 border-t">
                    <h4 class="text-sm font-semibold text-gray-700">💡 설명:</h4>
                    <p class="text-sm text-gray-600 mt-1 break-words">${correctionData.explanation.replace(/\n/g, '<br>')}</p>
                </div>`;

        } else {
             console.error("Invalid response structure from correct_writing API:", result);
             throw new Error("AI로부터 유효한 응답 구조를 받지 못했습니다.");
        }
    } catch (error) {
        console.error('Writing correction error:', error);
        correctionResult.innerHTML = `<p class="text-red-500 text-center">교정 중 오류 발생: ${error.message}</p>`;
    } finally {
        if(correctWritingBtn) correctWritingBtn.disabled = false;
    }
}


// --- 음성 인식 초기화 (자동 제출 기능 포함) ---
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

            const targetInput = currentRecognitionTargetInput; // Capture before potential async cleanup

            if (targetInput) {
                targetInput.value = speechResult;
                // Add a slight delay to ensure the value is set before triggering click
                setTimeout(() => {
                    if (targetInput === chatInput && sendChatBtn) {
                        console.log("Auto-submitting chat message...");
                        sendChatBtn.click();
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
                }, 150); // Slightly increased delay
            } else {
                console.warn("Recognition result received but no target input was set.");
                if (chatInput) chatInput.value = speechResult; // Fallback
            }
            // Let onend handle the cleanup reliably
        };

        recognition.onspeechend = () => {
            console.log("Speech Recognition: Speech has stopped being detected.");
             // Usually triggers stop automatically, but just in case for some browsers:
             // setTimeout(() => { if (isRecognizing) recognition.stop(); }, 500);
        };

        recognition.onnomatch = () => {
            console.log("Speech Recognition: No match found.");
            showAlert('음성을 인식하지 못했습니다. 다시 시도해주세요.');
             // Cleanup handled by onend
        };

        recognition.onerror = (event) => {
            console.error("Speech Recognition Error:", event.error, event.message);
            if (event.error !== 'no-speech' && event.error !== 'aborted' && event.error !== 'not-allowed') {
                 showAlert(`음성 인식 오류: ${event.error}. 마이크 권한을 확인하세요.`);
            } else if (event.error === 'not-allowed') {
                 showAlert('마이크 사용 권한이 거부되었습니다. 브라우저 설정을 확인해주세요.');
            } else if (event.error === 'no-speech') {
                 showAlert('음성이 감지되지 않았습니다. 다시 시도해주세요.');
            }
            // Cleanup handled by onend
        };

         recognition.onend = () => {
            console.log("Speech Recognition: Service ended.");
            if (currentRecognitionMicButton) {
                currentRecognitionMicButton.classList.remove('is-recording');
            }
            // Reliably reset state variables
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
     if (!quizModal || !quizContent) return;
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
    if (allPatterns.length < 4) { // Need at least 1 correct + 3 wrong options
        showAlert("퀴즈를 생성하기에 패턴 수가 부족합니다.");
        return;
    }

    const shuffledPatterns = [...allPatterns].sort(() => 0.5 - Math.random());
    quizQuestions = shuffledPatterns.slice(0, 5); // Take first 5 for the quiz
    // Ensure we actually got 5 questions if patterns are fewer than 5
    quizQuestions = quizQuestions.slice(0, Math.min(5, allPatterns.length));

    if (quizQuestions.length === 0) {
        showAlert("퀴즈 질문을 생성할 수 없습니다.");
        return;
    }

    currentQuizQuestionIndex = 0;
    quizScore = 0;

    renderQuizQuestion();
    quizModal.classList.remove('hidden');
}

function renderQuizQuestion() {
    if (!quizContent) return;
    if (currentQuizQuestionIndex >= quizQuestions.length) {
        showQuizResult();
        return;
    }

    const correctPattern = quizQuestions[currentQuizQuestionIndex];
    // Ensure correctPattern is valid
    if (!correctPattern || !correctPattern.pattern || !correctPattern.meaning) {
        console.error("Invalid quiz question data:", correctPattern);
        // Skip this question or show an error
        currentQuizQuestionIndex++;
        renderQuizQuestion();
        return;
    }

    const wrongPatterns = [...allPatterns]
        .filter(p => p.pattern !== correctPattern.pattern) // Exclude correct answer
        .sort(() => 0.5 - Math.random()) // Shuffle
        .slice(0, 3); // Take 3 wrong options

    // Check if we have enough wrong options (might happen if total patterns < 4)
    while (wrongPatterns.length < 3 && allPatterns.length > wrongPatterns.length + 1) {
       // If not enough unique wrong patterns, potentially add duplicates (or handle differently)
       // For simplicity, we might just proceed with fewer options if necessary
       console.warn("Not enough unique wrong patterns available for the quiz.");
       // Let's find any other pattern that's not the correct one
       const fallbackWrong = allPatterns.find(p => p.pattern !== correctPattern.pattern && !wrongPatterns.includes(p));
       if (fallbackWrong) wrongPatterns.push(fallbackWrong);
       else break; // Cannot add more
    }


    const options = [...wrongPatterns, correctPattern].sort(() => 0.5 - Math.random());

    const optionsHtml = options.map(opt => {
         if (!opt || !opt.pattern) return ''; // Skip invalid options
         return `
        <button class="quiz-option-btn text-left w-full p-3 border rounded-lg hover:bg-gray-100 transition-colors" data-pattern="${opt.pattern}">
            <span class="font-medium chinese-text text-lg break-words">${opt.pattern}</span><br>
            <span class="text-sm text-gray-500 break-words">${opt.pinyin || ''}</span>
        </button>`;
        }).join('');

    quizContent.innerHTML = `
        <div>
            <p class="text-lg font-bold mb-3 break-words">"${correctPattern.meaning}"</p>
            <p class="text-sm text-gray-600 mb-4">위의 뜻을 가진 중국어 패턴을 고르세요.</p>
            <div class="space-y-3">${optionsHtml}</div>
            <p class="text-center text-sm text-gray-500 mt-6">문제 ${currentQuizQuestionIndex + 1} / ${quizQuestions.length}</p>
        </div>`;
}

function handleQuizAnswer(targetButton) {
     if (!quizContent || !quizQuestions || quizQuestions.length === 0) return;

    const selectedPattern = targetButton.dataset.pattern;
    // Ensure the question exists
    if (currentQuizQuestionIndex >= quizQuestions.length) return;
    const correctPatternData = quizQuestions[currentQuizQuestionIndex];
    const correctPattern = correctPatternData.pattern;

    const allButtons = quizContent.querySelectorAll('.quiz-option-btn');

    allButtons.forEach(btn => {
        btn.disabled = true; // Disable all options
        // Highlight the correct answer
        if (btn.dataset.pattern === correctPattern) {
            btn.classList.remove('hover:bg-gray-100'); // Remove hover effect
            btn.classList.add('bg-green-100', 'border-green-500', 'ring-2', 'ring-green-300');
        }
    });

    // Mark the selected button if it was wrong
    if (selectedPattern === correctPattern) {
        quizScore++;
    } else {
        targetButton.classList.remove('hover:bg-gray-100');
        targetButton.classList.add('bg-red-100', 'border-red-500', 'ring-2', 'ring-red-300');
    }

    // Move to the next question after a delay
    setTimeout(() => {
        currentQuizQuestionIndex++;
        renderQuizQuestion(); // Render next or show results
    }, 1500); // Reduced delay slightly
}

function showQuizResult() {
    if (!quizContent) return;
     let message = `총 ${quizQuestions.length}문제 중 <span class="font-bold text-blue-600 text-xl">${quizScore}</span>개를 맞혔습니다!`;
     if (quizScore === quizQuestions.length) {
         message += " 🎉 완벽해요!";
     } else if (quizScore >= quizQuestions.length * 0.7) {
         message += " 👍 잘했어요!";
     }

    quizContent.innerHTML = `
        <div>
            <h2 class="text-2xl font-bold text-center mb-4">퀴즈 완료!</h2>
            <p class="text-center text-lg mb-6">${message}</p>
            <button id="close-quiz-modal-btn" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg">확인</button>
        </div>`;
     try {
        localStorage.setItem('lastQuizDate', getTodayString());
     } catch (e) {
         console.error("Failed to save last quiz date:", e);
         // Non-critical error
     }
}


// --- 메인 이벤트 리스너 설정 ---
function setupEventListeners() {
    // Add null checks for all elements before adding listeners
    if (newPatternBtn) newPatternBtn.addEventListener('click', () => {
         const newPatterns = getRandomPatterns();
         localStorage.setItem('dailyChinesePatterns', JSON.stringify({ date: getTodayString(), patterns: newPatterns }));
         renderPatterns(newPatterns);
         window.scrollTo(0, 0);
    });

    if (patternContainer) {
        patternContainer.addEventListener('click', (e) => {
            const target = e.target;
            const learnBtn = target.closest('.learn-btn');
            const chatPatternBtn = target.closest('.start-chat-pattern-btn');
            const nextPracticeBtn = target.closest('.next-practice-btn');
            const practiceMicBtn = target.closest('.practice-mic-btn');
            const checkPracticeBtn = target.classList.contains('check-practice-btn') ? target : null;
            const showHintBtn = target.closest('.show-hint-btn');
            const retryPracticeBtn = target.classList.contains('retry-practice-btn') ? target : null;
            const ttsBtn = target.closest('.tts-btn');

            if (learnBtn) {
                const pattern = learnBtn.dataset.pattern;
                learningCounts[pattern] = (learningCounts[pattern] || 0) + 1;
                saveCounts();
                 const countDisplay = learnBtn.closest('div').querySelector('.count-display');
                 if (countDisplay) countDisplay.textContent = learningCounts[pattern];

            } else if (chatPatternBtn) {
                const patternString = chatPatternBtn.dataset.patternString;
                if (patternString) handleStartChatWithPattern(patternString);

            } else if (nextPracticeBtn) {
                const practiceIndex = nextPracticeBtn.dataset.practiceIndex;
                const practiceContainer = document.getElementById(`practice-container-${practiceIndex}`);
                // Get pattern string from hint button's data attribute within the same container
                const patternString = practiceContainer?.querySelector('.show-hint-btn')?.dataset.patternString;
                if (patternString) handleNewPracticeRequest(patternString, practiceIndex);
                else console.error("Could not find pattern string for next practice button.");

            } else if (practiceMicBtn) {
                const practiceIndex = practiceMicBtn.dataset.practiceIndex;
                const targetInput = document.getElementById(`practice-input-${practiceIndex}`);
                if (!recognition) { showAlert('음성 인식이 지원되지 않습니다.'); return; }
                if (isRecognizing && currentRecognitionMicButton !== practiceMicBtn) {
                     console.log("Stopping ongoing recognition..."); recognition.stop();
                     setTimeout(() => startPracticeRecognition(practiceMicBtn, targetInput), 300);
                } else if (isRecognizing) {
                     console.log("Stopping recognition (practice)..."); recognition.stop();
                } else {
                     startPracticeRecognition(practiceMicBtn, targetInput);
                }

            } else if (checkPracticeBtn) {
                const inputId = checkPracticeBtn.dataset.inputId;
                const index = inputId.split('-').pop();
                const correctAnswer = checkPracticeBtn.dataset.answer;
                const correctPinyin = checkPracticeBtn.dataset.pinyin;
                const userInputEl = document.getElementById(inputId);
                const resultDiv = document.getElementById(`practice-result-${index}`);
                if (!userInputEl || !resultDiv) return; // Exit if elements not found

                const userInput = userInputEl.value.trim();
                const normalize = (str) => str ? str.replace(/[.,。，？！？!\s]/g, '') : ''; // Add null/space check
                let resultMessageHtml = '';
                const answerHtml = `...`; // Rebuild answerHtml here if needed or keep as before

                const practiceContainer = document.getElementById(`practice-container-${index}`);
                const spreeCount = parseInt(practiceContainer?.dataset.spreeCount || '0', 10);
                const spreeGoal = parseInt(practiceContainer?.dataset.spreeGoal || '5', 10);

                let isCorrect = normalize(userInput) === normalize(correctAnswer);
                let resultButtonsHtml = '';

                const fullAnswerHtml = `<div class="mt-2 p-2 bg-gray-100 rounded text-left"><p class="text-sm">정답:</p><div class="flex items-center"><p class="text-md chinese-text font-semibold text-gray-800 break-words">${correctAnswer}</p>${correctAnswer ? `<button class="tts-btn ml-2 p-1 rounded-full hover:bg-gray-200 transition-colors flex-shrink-0" data-text="${correctAnswer}"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-500 pointer-events-none"><path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg></button>`: ''}</div><p class="text-sm text-gray-500 mt-1 break-words">${correctPinyin || ''}</p></div>`;


                if (isCorrect) {
                    resultMessageHtml = `<p class="text-green-600 font-bold text-lg">🎉 정답입니다!</p>` + fullAnswerHtml;
                } else {
                    resultMessageHtml = `<p class="text-red-500 font-bold text-lg">🤔 아쉽네요, 다시 시도해보세요.</p>`+ fullAnswerHtml;
                }

                resultButtonsHtml += `<button class="retry-practice-btn mt-3 bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg" data-practice-index="${index}">다시하기</button>`;

                if (spreeCount < spreeGoal) {
                    resultButtonsHtml += `<button class="next-practice-btn mt-3 ml-2 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg" data-practice-index="${index}">➡️ 다음 문제 (${spreeCount + 1}/${spreeGoal})</button>`;
                } else if (isCorrect) {
                     resultMessageHtml += `<p class="text-green-600 font-bold text-lg mt-3">🎉 ${spreeGoal}문제 완료! 수고하셨습니다!</p>`;
                     const counterEl = document.getElementById(`practice-counter-${index}`);
                     if (counterEl) counterEl.textContent = '연습 완료!';
                     if (practiceContainer) practiceContainer.dataset.spreeCount = '0'; // Reset for potential restart
                     // Hide Retry/Next buttons on completion? Or just show Retry?
                     // resultButtonsHtml = `<button class="retry-practice-btn mt-3 bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg" data-practice-index="${index}">다시 시작?</button>`; // Example
                     resultButtonsHtml = ''; // Hide buttons on success completion
                }

                resultDiv.innerHTML = resultMessageHtml + resultButtonsHtml;

                checkPracticeBtn.style.display = 'none';
                const hintButton = document.getElementById(`show-hint-btn-${index}`); if(hintButton) hintButton.style.display = 'none';
                const micButtonPractice = document.getElementById(`practice-mic-btn-${index}`); if (micButtonPractice) micButtonPractice.style.display = 'none';

            } else if (showHintBtn) {
                const newVocabStr = showHintBtn.dataset.newVocab;
                const patternString = showHintBtn.dataset.patternString;
                const hintTargetId = showHintBtn.dataset.hintTarget;
                const hintDiv = document.getElementById(hintTargetId);
                if (!hintDiv) return;

                let vocabSource = null;
                if (newVocabStr && newVocabStr !== '[]') {
                    try { vocabSource = JSON.parse(newVocabStr); if (!Array.isArray(vocabSource)) vocabSource = null;}
                    catch(e) { console.error("Failed to parse newVocab JSON", e); vocabSource = null; }
                    if(vocabSource) console.log("Using new AI-generated vocab for hint.");
                }
                if (!vocabSource) { /* ... get from allPatterns ... */ }

                if (vocabSource && vocabSource.length > 0) { /* ... render hints ... */ }
                else { hintDiv.innerHTML = `<p class="text-sm text-gray-500">힌트 정보가 없습니다.</p>`; }
                showHintBtn.disabled = true; showHintBtn.classList.add('opacity-50', 'cursor-not-allowed');

            } else if (retryPracticeBtn) {
                const index = retryPracticeBtn.dataset.practiceIndex;
                const inputEl = document.getElementById(`practice-input-${index}`);
                const resultEl = document.getElementById(`practice-result-${index}`);
                const hintEl = document.getElementById(`practice-hint-${index}`);
                const checkBtnEl = document.getElementById(`check-practice-btn-${index}`);
                const hintBtnEl = document.getElementById(`show-hint-btn-${index}`);
                const micBtnEl = document.getElementById(`practice-mic-btn-${index}`);

                if(inputEl) inputEl.value = '';
                if(resultEl) resultEl.innerHTML = '';
                if(hintEl) hintEl.innerHTML = '';
                if(checkBtnEl) checkBtnEl.style.display = '';
                if(hintBtnEl) {
                    hintBtnEl.style.display = ''; hintBtnEl.disabled = false;
                    hintBtnEl.classList.remove('opacity-50', 'cursor-not-allowed');
                }
                if(micBtnEl) micBtnEl.style.display = '';
                if(inputEl) { inputEl.disabled = false; inputEl.focus(); }

            } else if (ttsBtn) {
                 if (ttsBtn.dataset.text) playTTS(ttsBtn.dataset.text, ttsBtn);
            }
        });

        patternContainer.addEventListener('keydown', (e) => {
            if (e.target.id.startsWith('practice-input-') && e.key === 'Enter') {
                e.preventDefault();
                const checkButtonId = `check-practice-btn-${e.target.id.split('-').pop()}`;
                const checkButton = document.getElementById(checkButtonId);
                if (checkButton && checkButton.style.display !== 'none') checkButton.click();
            }
        });
    } else {
        console.error("Pattern container not found!");
    }


    // 번역기 모달 이벤트
    if (openTranslatorBtn) openTranslatorBtn.addEventListener('click', () => translatorModal?.classList.remove('hidden'));
    if (closeTranslatorBtn) closeTranslatorBtn.addEventListener('click', () => { translatorModal?.classList.add('hidden'); if (currentAudio) currentAudio.pause(); });
    if (translateBtn) translateBtn.addEventListener('click', handleTranslation);
    if (koreanInput) koreanInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTranslation(); } });
    if (translationResult) translationResult.addEventListener('click', (e) => { const ttsButton = e.target.closest('.tts-btn'); if (ttsButton && ttsButton.dataset.text) playTTS(ttsButton.dataset.text, ttsButton); });

    // 커스텀 알림
    if (customAlertCloseBtn) customAlertCloseBtn.addEventListener('click', () => customAlertModal?.classList.add('hidden'));

    // 전체 패턴 모달 이벤트
    if (allPatternsBtn) allPatternsBtn.addEventListener('click', () => allPatternsModal?.classList.remove('hidden'));
    if (closeAllPatternsBtn) closeAllPatternsBtn.addEventListener('click', () => allPatternsModal?.classList.add('hidden'));
    if (allPatternsList) allPatternsList.addEventListener('click', (e) => {
        const selectedPatternDiv = e.target.closest('[data-pattern-index]');
        if (selectedPatternDiv) {
            const patternIndex = parseInt(selectedPatternDiv.dataset.patternIndex, 10);
            if (!isNaN(patternIndex) && allPatterns[patternIndex]) {
                renderPatterns([allPatterns[patternIndex]]); // Show only the selected one
                allPatternsModal?.classList.add('hidden');
                window.scrollTo(0, 0);
            }
        }
     });

    // AI 채팅 모달 이벤트
    if (chatBtn) chatBtn.addEventListener('click', () => {
        if (!chatModal) return;
        chatModal.classList.remove('hidden');
        if (chatHistory) chatHistory.innerHTML = ''; // Always clear history on open
        conversationHistory = [];
        if (chatInput) chatInput.value = '';
        chatHistory?.querySelectorAll('.suggestion-chip').forEach(chip => chip.closest('div.flex.justify-center')?.remove());

        const firstMsg = { chinese: '你好！我叫灵...', pinyin: 'Nǐ hǎo! ...', korean: '안녕하세요! ...' }; // Keep it short
        addMessageToHistory('ai', firstMsg);
        conversationHistory.push({ role: 'model', parts: [{ text: JSON.stringify(firstMsg) }] });
        if(chatInput) chatInput.focus(); // Focus input when modal opens
    });
    if (closeChatBtn) closeChatBtn.addEventListener('click', () => {
        chatModal?.classList.add('hidden');
        if (recognition && isRecognizing) { console.log("Stopping recognition due to modal close..."); recognition.stop(); }
    });
    if (sendChatBtn) sendChatBtn.addEventListener('click', handleSendMessage);
    if (chatInput) chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } });
    if (chatHistory) chatHistory.addEventListener('click', (e) => { const ttsButton = e.target.closest('.tts-btn'); if (ttsButton && ttsButton.dataset.text) playTTS(ttsButton.dataset.text, ttsButton); });
    if (micBtn) micBtn.addEventListener('click', () => { // Chat Mic Specific Listener
        if (!recognition) { showAlert('음성 인식이 지원되지 않습니다.'); return; }
        if (isRecognizing && currentRecognitionMicButton !== micBtn) {
             console.log("Stopping ongoing recognition..."); recognition.stop();
             setTimeout(() => startChatRecognition(), 300);
        } else if (isRecognizing) {
             console.log("Stopping recognition (chat)..."); recognition.stop();
        } else {
             startChatRecognition();
        }
    });
    if (suggestReplyBtn) suggestReplyBtn.addEventListener('click', handleSuggestReply);

    // 퀴즈 모달 이벤트 리스너
    if (dailyQuizBtn) dailyQuizBtn.addEventListener('click', startQuiz);
    if (closeQuizBtn) closeQuizBtn.addEventListener('click', () => quizModal?.classList.add('hidden'));
    if (quizContent) quizContent.addEventListener('click', (e) => {
        const targetButton = e.target.closest('.quiz-option-btn');
        if (targetButton) { handleQuizAnswer(targetButton); return; }
        if (e.target.id === 'close-quiz-modal-btn') { quizModal?.classList.add('hidden'); return; }
    });

    // 작문 교정 모달 이벤트 리스너
    if (openCorrectorBtn) openCorrectorBtn.addEventListener('click', () => correctorModal?.classList.remove('hidden'));
    if (closeCorrectorBtn) closeCorrectorBtn.addEventListener('click', () => { correctorModal?.classList.add('hidden'); if (currentAudio) currentAudio.pause(); });
    if (correctWritingBtn) correctWritingBtn.addEventListener('click', handleCorrectWriting);
    if (writingInput) writingInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCorrectWriting(); } });
    if (correctionResult) correctionResult.addEventListener('click', (e) => { const ttsButton = e.target.closest('.tts-btn'); if (ttsButton && ttsButton.dataset.text) playTTS(ttsButton.dataset.text, ttsButton); });
}

// --- 음성 인식 시작 헬퍼 함수 ---
function startPracticeRecognition(button, targetInput) {
    if (!recognition || !button || !targetInput) return;
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
     if (!recognition || !chatInput || !micBtn) return;
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
     // Avoid showing alert for 'InvalidStateError' as it's often a race condition
     else if (e.name === 'InvalidStateError') { console.warn("Attempted to start recognition while already active or stopping. Ignoring."); }
     else { showAlert("음성 인식을 시작할 수 없습니다. 잠시 후 다시 시도해주세요."); }
     if(button) button.classList.remove('is-recording');
     // Reset state only if it wasn't an InvalidStateError
     if (e.name !== 'InvalidStateError') {
         isRecognizing = false;
         currentRecognitionTargetInput = null;
         currentRecognitionMicButton = null;
     }
}

// --- 앱 초기화 함수 ---
export function initializeApp(patterns) {
    // Basic check on imported data
    if (!Array.isArray(patterns)) {
        console.error("Invalid patterns data received. Expected an array.");
        allPatterns = [];
    } else {
        allPatterns = patterns;
    }

    // Defer execution until the DOM is fully loaded
    document.addEventListener('DOMContentLoaded', () => {
        console.log("DOM fully loaded. Initializing app...");
        try {
            initializeDOM(); // Find elements first
            // Check if essential elements were found
            if (!patternContainer || !currentDateEl) {
                 throw new Error("Essential DOM elements (patternContainer or currentDateEl) not found.");
            }
            displayDate();
            initializeCounts();
            loadDailyPatterns(); // This calls renderPatterns which starts practice problems
            renderAllPatternsList();
            setupScreenWakeLock();
            initializeSpeechRecognition();
            setupEventListeners(); // Add listeners after elements are found
            console.log("App initialized successfully.");
        } catch (error) {
            console.error("Error during app initialization:", error);
            // Use showAlert if available, otherwise fallback to console/alert
            if (typeof showAlert === 'function') {
                showAlert("앱 초기화 중 심각한 오류가 발생했습니다. 페이지를 새로고침하거나 개발자에게 문의하세요.");
            } else {
                alert("앱 초기화 중 심각한 오류가 발생했습니다.");
            }
        }
    });
}

// --- 앱 실행 ---
initializeApp(patternsData);

// v.2025.10.23_1530