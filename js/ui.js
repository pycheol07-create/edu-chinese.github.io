// js/ui.js
import * as dom from './dom.js';
import * as state from './state.js';
import { playTTS } from './api.js'; // 예문 TTS를 위해 import

// ... (showAlert, displayDate 함수는 동일) ...
export function showAlert(message) {
    if (dom.customAlertMessage && dom.customAlertModal) {
        dom.customAlertMessage.textContent = message;
        dom.customAlertModal.classList.remove('hidden');
    } else {
        alert(message);
    }
}
export function displayDate() {
    const today = new Date();
    if (dom.currentDateEl) {
        dom.currentDateEl.textContent = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
    }
}


/**
 * 메인 컨테이너에 패턴 카드들을 렌더링합니다.
 * @param {Array} patterns - 표시할 패턴 객체 배열
 * @param {boolean} [showIndex=false] - 전체 목록 보기에서처럼 인덱스를 표시할지 여부
 */
export function renderPatterns(patterns, showIndex = false) { 
    if (!dom.patternContainer) return;

    dom.patternContainer.innerHTML = '';
    patterns.forEach((p, index) => {
        const count = state.learningCounts[p.pattern] || 0;
        const card = document.createElement('div');
        card.className = 'bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300';

        // [★ 수정] "따라 말하기" 버튼 추가
        const examplesHtml = p.examples.map(ex => `
            <div class="mt-3">
                <div class="flex items-center">
                    <p class="text-lg chinese-text text-gray-800">${ex.chinese}</p>
                    <button class="tts-btn ml-2 p-1 rounded-full hover:bg-gray-200 transition-colors" data-text="${ex.chinese}" title="듣기">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-500 pointer-events-none"><path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg>
                    </button>
                    <button class="follow-speak-btn ml-1 p-1 rounded-full hover:bg-gray-200 transition-colors" data-text="${ex.chinese}" title="따라 말하기">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-500 pointer-events-none">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 0 0 6-6V7.5a6 6 0 0 0-12 0v5.25a6 6 0 0 0 6 6Z" />
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5v2.25a7.5 7.5 0 0 1-15 0v-2.25" />
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 18.75a8.25 8.25 0 0 0 10.5 0" />
                        </svg>
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

        const practiceHtml = p.practice ? `
            <div class="mt-6">
                <h3 class="text-lg font-bold text-gray-700 border-b pb-1">🗣️ 직접 말해보기</h3>
                <div id="practice-container-${index}" class="mt-3 bg-sky-50 p-4 rounded-lg relative" data-spree-count="0" data-spree-goal="5">
                    <button id="show-hint-btn-${index}" title="힌트 보기" data-pattern-string="${p.pattern}" data-hint-target="practice-hint-${index}" class="show-hint-btn absolute top-3 right-3 bg-gray-300 hover:bg-gray-400 text-yellow-500 p-1.5 rounded-full" style="display: none;">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 pointer-events-none">
                          <path d="M12 2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM18.894 6.166a.75.75 0 0 0-1.06-1.06l-1.591 1.59a.75.75 0 1 0 1.06 1.061l1.591-1.59ZM21.75 12a.75.75 0 0 1-.75.75h-2.25a.75.75 0 0 1 0-1.5h2.25a.75.75 0 0 1 .75.75ZM17.834 18.894a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 1 0-1.061 1.06l1.59 1.591ZM12 18a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-2.25A.75.75 0 0 1 12 18ZM7.758 17.303a.75.75 0 0 0-1.061-1.06l-1.591 1.59a.75.75 0 0 0 1.06 1.061l1.591-1.59ZM6 12a.75.75 0 0 1-.75.75H3a.75.75 0 0 1 0-1.5h2.25A.75.75 0 0 1 6 12ZM6.166 7.758a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 0 0-1.061 1.06l1.59 1.591Z" />
                        </svg>
                    </button>
                    <p class="text-md text-gray-700 mb-2">다음 문장을 중국어로 입력해보세요:</p>
                    <p id="practice-korean-${index}" class="text-md font-semibold text-sky-800 mb-3">""</p>
                    <div class="flex items-center space-x-1 min-w-0">
                        <button id="practice-mic-btn-${index}" title="음성 입력" data-practice-index="${index}" class="practice-mic-btn mic-btn p-1 rounded-full text-gray-500 hover:bg-gray-200 flex-shrink-0" style="display: none;"> <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 pointer-events-none">
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
        
        dom.patternContainer.appendChild(card);
    });
}

// ... (renderAllPatternsList 함수는 동일) ...
export function renderAllPatternsList() {
    if (!dom.allPatternsList) return;
    
    dom.allPatternsList.innerHTML = '';
    state.allPatterns.forEach((p, index) => {
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
        dom.allPatternsList.appendChild(patternItem);
    });
}


/**
 * 채팅 기록창에 메시지를 추가합니다.
 * @param {string} sender - 'user' 또는 'ai'
 * @param {object} messageData - 메시지 데이터
 */
export function addMessageToHistory(sender, messageData) {
    if (!dom.chatHistory) return;
    
    if (sender === 'user') {
        const messageElement = document.createElement('div');
        messageElement.className = 'flex justify-end';
        messageElement.innerHTML = `<div class="bg-purple-500 text-white p-3 rounded-lg max-w-xs">${messageData.text}</div>`;
        dom.chatHistory.appendChild(messageElement);
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
            dom.chatHistory.appendChild(correctionElement);
        }
        // [★ 수정] "따라 말하기" 버튼 추가
        const messageElement = document.createElement('div');
        messageElement.className = 'flex justify-start';
        messageElement.innerHTML = `
            <div class="bg-white p-3 rounded-lg max-w-xs border">
                <div class="flex items-center">
                    <p class="text-lg chinese-text text-gray-800">${messageData.chinese}</p>
                    <button class="tts-btn ml-2 p-1 rounded-full hover:bg-gray-200 transition-colors" data-text="${messageData.chinese}" title="듣기">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-500 pointer-events-none"><path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg>
                    </button>
                    <button class="follow-speak-btn ml-1 p-1 rounded-full hover:bg-gray-200 transition-colors" data-text="${messageData.chinese}" title="따라 말하기">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-500 pointer-events-none">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 0 0 6-6V7.5a6 6 0 0 0-12 0v5.25a6 6 0 0 0 6 6Z" />
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5v2.25a7.5 7.5 0 0 1-15 0v-2.25" />
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 18.75a8.25 8.25 0 0 0 10.5 0" />
                        </svg>
                    </button>
                </div>
                <p class="text-sm text-gray-500">${messageData.pinyin || ''}</p>
                <p class="text-sm text-gray-600 border-t mt-2 pt-2">${messageData.korean || ''}</p>
            </div>`;
        dom.chatHistory.appendChild(messageElement);
    }
    if (dom.chatHistory) dom.chatHistory.scrollTop = dom.chatHistory.scrollHeight;
}

// ... (addSuggestionToHistory, renderCorrectionHistory 함수는 동일) ...
export function addSuggestionToHistory(suggestions) {
    if (!dom.chatHistory) return;

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
    dom.chatHistory.appendChild(suggestionElement);    
    dom.chatHistory.scrollTop = dom.chatHistory.scrollHeight;
}
export function renderCorrectionHistory() {
    if (!dom.correctionHistoryList) return;
    
    if (state.correctionHistory.length === 0) {
        dom.correctionHistoryList.innerHTML = `<p class="text-gray-500 text-center p-4">아직 교정 내역이 없습니다.</p>`;
        return;
    }

    dom.correctionHistoryList.innerHTML = '';
    state.correctionHistory.forEach(item => {
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
        dom.correctionHistoryList.appendChild(itemEl);
    });
}


// --- [★ 수정] 듣기 스크립트 렌더링 함수 ---

/**
 * 듣기 모달에 AI가 생성한 스크립트를 렌더링합니다.
 * @param {string} title - 대화 제목
 * @param {Array<object>} scriptLines - 대화 스크립트 객체 배열
 */
export function renderListeningScript(title, scriptLines) {
    if (!dom.listeningScriptDisplay) return;

    // 스피커(화자) 아이콘 매핑
    const speakerIcons = {
        "Man": "👨‍💼",
        "Woman": "👩‍💼",
        "A": "🧑‍A",
        "B": "🧑‍B",
        "Male": "👨",
        "Female": "👩"
    };

    const scriptHtml = scriptLines.map((line, index) => {
        // AI 응답이 Man/Woman이 아닐 경우(e.g. A/B) 대비
        const icon = speakerIcons[line.speaker] || '👤'; 
        
        // [★ 수정] data-speaker 속성 추가 (남/녀 목소리 구분을 위해)
        return `
            <div id="listening-line-${index}" class="listening-line p-3 mb-2 bg-white rounded-lg border border-gray-200 transition-colors duration-300" data-text="${line.chinese}" data-speaker="${line.speaker}">
                <div class="flex items-center justify-between">
                    <span class="text-lg font-semibold">${icon} ${line.speaker}</span>
                    <button class="tts-btn p-1 rounded-full hover:bg-gray-200 transition-colors" data-text="${line.chinese}" title="듣기">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-500 pointer-events-none"><path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"></path></svg>
                    </button>
                </div>
                <p class="text-xl chinese-text text-gray-800 mt-2">${line.chinese}</p>
                <p class="text-md text-gray-500">${line.pinyin}</p>
                <p class="text-md text-gray-600 mt-2 pt-2 border-t border-gray-100">${line.korean}</p>
            </div>
        `;
    }).join('');

    dom.listeningScriptDisplay.innerHTML = `
        <h3 class="text-xl font-bold text-center mb-4">${title}</h3>
        <div class="space-y-2">
            ${scriptHtml}
        </div>
    `;
}