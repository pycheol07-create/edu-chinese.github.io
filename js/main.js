import { allPatterns as patternsData } from '../data/patterns.js';

let allPatterns = [];
let learningCounts = {};
const audioCache = {};
let currentAudio = null;
let currentPlayingButton = null;
let wakeLock = null;
let conversationHistory = [];

// DOM Elements
let patternContainer, currentDateEl, newPatternBtn, openTranslatorBtn, translatorModal,
    closeTranslatorBtn, translateBtn, koreanInput, translationResult, customAlertModal,
    customAlertMessage, customAlertCloseBtn, allPatternsBtn, allPatternsModal,
    closeAllPatternsBtn, allPatternsList, chatBtn, chatModal, closeChatBtn,
    chatHistory, chatInput, sendChatBtn;

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
}

function initializeCounts() {
    const storedCounts = localStorage.getItem('chineseLearningCounts');
    learningCounts = storedCounts ? JSON.parse(storedCounts) : {};
}

function saveCounts() {
    localStorage.setItem('chineseLearningCounts', JSON.stringify(learningCounts));
}

function getTodayString() {
    return new Date().toISOString().split('T')[0];
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
                    <button class="tts-btn ml-2 p-1 rounded-full hover:bg-gray-200 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-500 pointer-events-none">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                        </svg>
                    </button>
                </div>
                <p class="text-sm text-gray-500">${ex.pinyin}</p>
                <p class="text-md text-gray-600">${ex.korean}</p>
            </div>
        `).join('');

        const vocabHtml = p.vocab.map(v => `
            <div class="flex items-baseline">
                <p class="w-1/3 text-md chinese-text text-gray-700 font-medium">${v.word}</p>
                <p class="w-1/3 text-sm text-gray-500">${v.pinyin}</p>
                <p class="w-1/3 text-sm text-gray-600">${v.meaning}</p>
            </div>
        `).join('');

        const indexHtml = showIndex ? `<span class="bg-blue-100 text-blue-800 text-sm font-semibold mr-3 px-3 py-1 rounded-full">${index + 1}</span>` : '';
        
        const practiceHtml = p.practice ? `
            <div class="mt-6">
                <h3 class="text-lg font-bold text-gray-700 border-b pb-1">✍️ 직접 말해보기</h3>
                <div class="mt-3 bg-sky-50 p-4 rounded-lg relative">
                    <button id="show-hint-btn-${index}" data-pattern-string="${p.pattern}" data-hint-target="practice-hint-${index}" class="show-hint-btn absolute top-3 right-3 bg-gray-300 hover:bg-gray-400 text-gray-700 font-bold py-1 px-2 rounded-lg text-xs whitespace-nowrap flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.898 20.572L16.25 21.75l-.648-1.178a2.625 2.625 0 00-1.933-1.933L12.5 18l1.178-.648a2.625 2.625 0 001.933-1.933L16.25 14.25l.648 1.178a2.625 2.625 0 001.933 1.933L20 18l-1.178.648a2.625 2.625 0 00-1.933 1.933z" />
                        </svg>
                        힌트
                    </button>
                    <p class="text-md text-gray-700 mb-2">다음 문장을 중국어로 입력해보세요:</p>
                    <p class="text-md font-semibold text-sky-800 mb-3">"${p.practice.korean}"</p>
                    <div class="flex items-center space-x-2">
                        <input type="text" id="practice-input-${index}" class="w-full p-2 border border-gray-300 rounded-md chinese-text" placeholder="중국어를 입력하세요...">
                        <button id="check-practice-btn-${index}" data-answer="${p.practice.chinese}" data-pinyin="${p.practice.pinyin}" data-input-id="practice-input-${index}" class="check-practice-btn bg-sky-500 hover:bg-sky-600 text-white font-bold py-2 px-4 rounded-lg whitespace-nowrap">정답 확인</button>
                    </div>
                    <div id="practice-hint-${index}" class="mt-3"></div>
                    <div id="practice-result-${index}" class="mt-3 text-center"></div>
                </div>
            </div>
        ` : '';

        card.innerHTML = `
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center">
                    ${indexHtml}
                    <div>
                       <h2 class="text-2xl font-bold text-gray-800 chinese-text">${p.pattern}</h2>
                       <p class="text-md text-gray-500">${p.pinyin}</p>
                    </div>
                </div>
                <div class="text-right">
                     <button data-pattern="${p.pattern}" class="learn-btn bg-yellow-400 hover:bg-yellow-500 text-white text-sm font-bold py-1 px-3 rounded-full transition-colors">학습 완료!</button>
                     <p class="text-xs text-gray-500 mt-1">학습 <span class="font-bold text-red-500 count-display">${count}</span>회</p>
                </div>
            </div>
            <div class="mt-4">
                <p class="text-lg text-blue-700 font-semibold mb-2">${p.meaning}</p>
                <p class="text-sm text-gray-500 bg-gray-100 p-2 rounded-md"><b>🤔 어떻게 사용할까요?</b> ${p.structure || '구조 정보 없음'}</p>
            </div>
            
            <div class="mt-4">
                <h3 class="text-lg font-bold text-gray-700 border-b pb-1">💡 예문 살펴보기</h3>
                ${examplesHtml}
            </div>

            <div class="mt-6">
                <h3 class="text-lg font-bold text-gray-700 border-b pb-1">📌 주요 단어</h3>
                <div class="mt-3 space-y-2">
                   ${vocabHtml}
                </div>
            </div>
            ${practiceHtml}
        `;
        patternContainer.appendChild(card);
    });
}
// ... (rest of the file is the same, no need to repeat)
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
            </div>
        `;
        allPatternsList.appendChild(patternItem);
    });
}

async function setupScreenWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => {
                console.log('Screen Wake Lock was released');
            });
            console.log('Screen Wake Lock is active');
        } catch (err) {
            if (err.name === 'NotAllowedError') {
                console.log('Screen Wake Lock request failed because access is disallowed by permissions policy.');
            } else {
                console.error(`${err.name}, ${err.message}`);
            }
        }
    } else {
        console.log('Screen Wake Lock API not supported.');
    }
}

function setupEventListeners() {
    newPatternBtn.addEventListener('click', () => {
         const newPatterns = getRandomPatterns();
         localStorage.setItem('dailyChinesePatterns', JSON.stringify({ date: getTodayString(), patterns: newPatterns }));
         renderPatterns(newPatterns);
         window.scrollTo(0, 0);
    });

    patternContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('learn-btn')) {
            const pattern = e.target.dataset.pattern;
            learningCounts[pattern] = (learningCounts[pattern] || 0) + 1;
            saveCounts();
            e.target.nextElementSibling.querySelector('.count-display').textContent = learningCounts[pattern];
        } else if (e.target.classList.contains('check-practice-btn')) {
            const button = e.target;
            const inputId = button.dataset.inputId;
            const index = inputId.split('-').pop();
            
            const correctAnswer = button.dataset.answer;
            const correctPinyin = button.dataset.pinyin;
            const userInput = document.getElementById(inputId).value.trim();
            const resultDiv = document.getElementById(`practice-result-${index}`);
            
            const normalize = (str) => str.replace(/[.,。，？！？!]/g, '').replace(/\s+/g, '');

            let resultMessageHtml = '';
            
            const answerHtml = `
                <div class="mt-2 p-2 bg-gray-100 rounded text-left">
                    <p class="text-sm">정답:</p>
                    <div class="flex items-center">
                        <p class="text-md chinese-text font-semibold text-gray-800">${correctAnswer}</p>
                        <button class="tts-btn ml-2 p-1 rounded-full hover:bg-gray-200 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-500 pointer-events-none">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                            </svg>
                        </button>
                    </div>
                    <p class="text-sm text-gray-500">${correctPinyin}</p>
                </div>
            `;

            if (normalize(userInput) === normalize(correctAnswer)) {
                resultMessageHtml = `<p class="text-green-600 font-bold text-lg">🎉 정답입니다!</p>` + answerHtml;
            } else {
                resultMessageHtml = `
                    <p class="text-red-500 font-bold text-lg">🤔 아쉽네요, 다시 시도해보세요.</p>
                    ${answerHtml}
                `;
            }

            resultDiv.innerHTML = `
                ${resultMessageHtml}
                <button class="retry-practice-btn mt-3 bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg" data-practice-index="${index}">
                    다시하기
                </button>
            `;
            
            button.style.display = 'none';
            document.getElementById(`show-hint-btn-${index}`).style.display = 'none';

        } else if (e.target.classList.contains('show-hint-btn')) {
            const button = e.target;
            const patternString = button.dataset.patternString;
            const hintTargetId = button.dataset.hintTarget;
            const hintDiv = document.getElementById(hintTargetId);

            const patternData = allPatterns.find(p => p.pattern === patternString);

            if (patternData && patternData.practiceVocab && patternData.practiceVocab.length > 0) {
                const shuffledVocab = [...patternData.practiceVocab].sort(() => 0.5 - Math.random());
                
                const hintsHtml = shuffledVocab.map(hint => `
                    <div class="flex items-baseline" style="line-height: 1.3;">
                        <span class="inline-block w-[40%] font-medium chinese-text pr-2">${hint.word}</span>
                        <span class="inline-block w-[40%] text-sm text-gray-500 pr-2">${hint.pinyin}</span>
                        <span class="inline-block w-[20%] text-sm text-gray-600">${hint.meaning}</span>
                    </div>
                `).join('');

                hintDiv.innerHTML = `
                <div class="bg-white/50 rounded-md p-2 text-left">
                    <div class="flex items-center mb-1">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-0.5 text-yellow-500">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.898 20.572L16.25 21.75l-.648-1.178a2.625 2.625 0 00-1.933-1.933L12.5 18l1.178-.648a2.625 2.625 0 001.933-1.933L16.25 14.25l.648 1.178a2.625 2.625 0 001.933 1.933L20 18l-1.178.648a2.625 2.625 0 00-1.933 1.933z" />
                        </svg>
                        <span class="font-semibold text-sm text-gray-700">힌트</span>
                    </div>
                    <div class="border-t border-gray-300/50 pt-1">${hintsHtml}</div>
                </div>`;
                
            } else {
                hintDiv.innerHTML = `<p class="text-sm text-gray-500">이 문장에 대한 핵심 단어 정보가 없습니다.</p>`;
            }
            
            button.disabled = true;
            button.classList.add('opacity-50', 'cursor-not-allowed');
        } else if (e.target.classList.contains('retry-practice-btn')) {
            const index = e.target.dataset.practiceIndex;

            document.getElementById(`practice-input-${index}`).value = '';
            document.getElementById(`practice-result-${index}`).innerHTML = '';
            document.getElementById(`practice-hint-${index}`).innerHTML = '';

            document.getElementById(`check-practice-btn-${index}`).style.display = '';
            const hintBtn = document.getElementById(`show-hint-btn-${index}`);
            hintBtn.style.display = '';
            hintBtn.disabled = false;
            hintBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    });
    
    // ... (other event listeners) ...
}


// ... (TTS, Translation, and other helper functions) ...

export function initializeApp(patterns) {
    allPatterns = patterns;
    document.addEventListener('DOMContentLoaded', () => {
        initializeDOM();
        displayDate();
        initializeCounts();
        loadDailyPatterns();
        renderAllPatternsList();
        setupScreenWakeLock();
        setupEventListeners();
    });
}

