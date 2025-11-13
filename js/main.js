// js/main.js
import { allPatterns as patternsData } from '../data/patterns.js';
import * as state from './state.js';
import * as dom from './dom.js';
import * as ui from './ui.js';
import * as api from './api.js';
import * as handlers from './handlers.js';
// [★ 삭제] import * as quiz from './quiz.js';
import * as speech from './speech.js';
import * as features from './features.js';

/**
 * 모든 이벤트 리스너를 설정합니다. (이벤트 위임 활용)
 */
function setupEventListeners() {
    
    // '새로운 패턴 보기' 버튼
    dom.newPatternBtn.addEventListener('click', () => {
         const newPatterns = state.loadDailyPatterns(); // loadDailyPatterns가 새로 생성/저장
         ui.renderPatterns(newPatterns);
         newPatterns.forEach((p, index) => {
             if (p.practice) {
                 setTimeout(() => handlers.handleNewPracticeRequest(p.pattern, index), 0);
             }
         });
         window.scrollTo(0, 0);
    });

    // --- 메인 패턴 컨테이너 (이벤트 위임) ---
    dom.patternContainer.addEventListener('click', (e) => {
        const target = e.target;
        
        // ... (learn-btn, start-chat-pattern-btn, next-practice-btn 로직은 동일) ...
        if (target.classList.contains('learn-btn')) {
            const pattern = target.dataset.pattern;
            state.learningCounts[pattern] = (state.learningCounts[pattern] || 0) + 1;
            state.saveCounts();
             const countDisplay = target.closest('div').querySelector('.count-display');
             if (countDisplay) {
                 countDisplay.textContent = state.learningCounts[pattern];
             }
        } 
        else if (target.closest('.start-chat-pattern-btn')) {
            const button = target.closest('.start-chat-pattern-btn');
            const patternString = button.dataset.patternString;
            if (patternString) {
                handlers.handleStartChatWithPattern(patternString);
            }
        }
        else if (target.closest('.next-practice-btn')) {
            const button = target.closest('.next-practice-btn');
            const practiceIndex = button.dataset.practiceIndex;
            const practiceContainer = document.getElementById(`practice-container-${practiceIndex}`);
            const patternString = practiceContainer.querySelector('.show-hint-btn')?.dataset.patternString;
            if (patternString) {
                handlers.handleNewPracticeRequest(patternString, practiceIndex);
            }
        }
        
        // [★ 수정] '연습문제 마이크' 버튼
        else if (target.closest('.practice-mic-btn')) {
            const button = target.closest('.practice-mic-btn');
            const practiceIndex = button.dataset.practiceIndex;
            const targetInput = document.getElementById(`practice-input-${practiceIndex}`);
            speech.toggleRecognition(button, { targetInput: targetInput }); // 'Input' 모드로 실행
        }
        
        // ... (check-practice-btn, show-hint-btn, retry-practice-btn 로직은 동일) ...
        else if (target.classList.contains('check-practice-btn')) {
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
                 if (counterEl) counterEl.textContent = '';
                 practiceContainer.dataset.spreeCount = '0';
            }

            resultDiv.innerHTML = resultMessageHtml + resultButtonsHtml;
            button.style.display = 'none';
            document.getElementById(`show-hint-btn-${index}`).style.display = 'none';
            document.getElementById(`practice-mic-btn-${index}`).style.display = 'none';
        }
        else if (target.closest('.show-hint-btn')) {
            const button = target.closest('.show-hint-btn');
            const newVocab = button.dataset.newVocab;
            const patternString = button.dataset.patternString;
            const hintTargetId = button.dataset.hintTarget;
            const hintDiv = document.getElementById(hintTargetId);
            
            let vocabSource = null;
            if (newVocab && newVocab !== '[]') {
                try { vocabSource = JSON.parse(newVocab); } catch(e) { vocabSource = null; }
            }
            if (!vocabSource) {
                const patternData = state.allPatterns.find(p => p.pattern === patternString);
                if (patternData && patternData.practiceVocab) vocabSource = patternData.practiceVocab;
            }
             if (vocabSource && vocabSource.length > 0) {
                const shuffledVocab = [...vocabSource].sort(() => 0.5 - Math.random());
                const hintsHtml = shuffledVocab.map(hint => `<div class="flex items-baseline" style="line-height: 1.3;"><span class="inline-block w-[30%] font-medium chinese-text pr-2">${hint?.word || '?'}</span><span class="inline-block w-[30%] text-sm text-gray-500 pr-2">${hint?.pinyin || '?'}</span><span class="inline-block w-[40%] text-sm text-gray-600">${hint?.meaning || '?'}</span></div>`).join('');
                hintDiv.innerHTML = `<div class="bg-yellow-50/50 rounded-md p-2 text-left"><div class="flex items-center mb-1"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 mr-0.5 text-yellow-500"><path d="M12 2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM18.894 6.166a.75.75 0 0 0-1.06-1.06l-1.591 1.59a.75.75 0 1 0 1.06 1.061l1.591-1.59ZM21.75 12a.75.75 0 0 1-.75.75h-2.25a.75.75 0 0 1 0-1.5h2.25a.75.75 0 0 1 .75.75ZM17.834 18.894a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 1 0-1.061 1.06l1.59 1.591ZM12 18a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-2.25A.75.75 0 0 1 12 18ZM7.758 17.303a.75.75 0 0 0-1.061-1.06l-1.591 1.59a.75.75 0 0 0 1.06 1.061l1.591-1.59ZM6 12a.75.75 0 0 1-.75.75H3a.75.75 0 0 1 0-1.5h2.25A.75.75 0 0 1 6 12ZM6.166 7.758a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 0 0-1.061 1.06l1.59 1.591Z" /></svg><span class="font-semibold text-sm text-gray-700">힌트</span></div><div class="border-t border-gray-300/50 pt-1">${hintsHtml}</div></div>`;
            } else {
                hintDiv.innerHTML = `<p class="text-sm text-gray-500">이 문장에 대한 핵심 단어 정보가 없습니다.</p>`;
            }
            button.disabled = true; button.classList.add('opacity-50', 'cursor-not-allowed');
        }
        else if (target.classList.contains('retry-practice-btn')) {
            const index = target.dataset.practiceIndex;
            document.getElementById(`practice-input-${index}`).value = '';
            document.getElementById(`practice-result-${index}`).innerHTML = '';
            document.getElementById(`practice-hint-${index}`).innerHTML = '';
            document.getElementById(`check-practice-btn-${index}`).style.display = '';
            const hintBtn = document.getElementById(`show-hint-btn-${index}`);
            hintBtn.style.display = '';
            hintBtn.disabled = false;
            hintBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            document.getElementById(`practice-mic-btn-${index}`).style.display = '';
            document.getElementById(`practice-input-${index}`).disabled = false;
            document.getElementById(`practice-input-${index}`).focus();
            
            const practiceContainer = document.getElementById(`practice-container-${index}`);
            const counterEl = document.getElementById(`practice-counter-${index}`);
            const currentCount = parseInt(practiceContainer.dataset.spreeCount, 10);
            const goal = parseInt(practiceContainer.dataset.spreeGoal, 10);
            if(counterEl) counterEl.textContent = `문제 ${currentCount} / ${goal}`;
        }
        else if (target.closest('.follow-speak-btn')) {
            const button = target.closest('.follow-speak-btn');
            const originalText = button.dataset.text; 
            if (originalText) {
                speech.toggleRecognition(button, { originalText: originalText }); // 'Evaluation' 모드로 실행
            }
        }
        else if (target.closest('.tts-btn')) {
            const ttsButton = target.closest('.tts-btn');
            if (ttsButton.classList.contains('is-playing')) {
                 api.playTTS(null, ttsButton); 
            } else {
                 const textToSpeak = ttsButton.dataset.text; 
                 // [★ 수정] 패턴 카드의 TTS는 화자 정보(speaker)가 없으므로 null 전달
                 if (textToSpeak) api.playTTS(textToSpeak, ttsButton, null, null);
            }
        }
    });

    dom.patternContainer.addEventListener('keydown', (e) => {
        if (e.target.id.startsWith('practice-input-') && e.key === 'Enter') {
            e.preventDefault();
            const checkButtonId = `check-practice-btn-${e.target.id.split('-').pop()}`;
            const checkButton = document.getElementById(checkButtonId);
            if (checkButton && checkButton.style.display !== 'none') {
                checkButton.click();
            }
        }
    });

    // ... (번역기, 작문 교정, 교정 노트, 알림, 전체 패턴 모달 리스너는 동일) ...
    dom.openTranslatorBtn.addEventListener('click', () => {
        dom.translatorModal.classList.remove('hidden');
        if (dom.fabContainer) dom.fabContainer.classList.remove('is-open');
    });
    dom.closeTranslatorBtn.addEventListener('click', () => {
        dom.translatorModal.classList.add('hidden');
        state.stopCurrentAudio();
    });
    dom.translateBtn.addEventListener('click', handlers.handleTranslation);
    dom.koreanInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handlers.handleTranslation();
        }
    });
    dom.translationResult.addEventListener('click', (e) => {
        const ttsButton = e.target.closest('.tts-btn');
        if (ttsButton) {
            const textToSpeak = ttsButton.dataset.text;
            if (textToSpeak) api.playTTS(textToSpeak, ttsButton, null, null);
        }
    });
    dom.openCorrectionBtn.addEventListener('click', () => {
        dom.correctionModal.classList.remove('hidden');
        if (dom.fabContainer) dom.fabContainer.classList.remove('is-open');
    });
    dom.closeCorrectionBtn.addEventListener('click', () => {
        dom.correctionModal.classList.add('hidden');
        state.stopCurrentAudio();
    });
    dom.correctWritingBtn.addEventListener('click', handlers.handleCorrectWriting);
    dom.getTopicBtn.addEventListener('click', handlers.handleGetWritingTopic);
    dom.correctionResult.addEventListener('click', (e) => {
        const ttsButton = e.target.closest('.tts-btn');
        if (ttsButton) {
            const textToSpeak = ttsButton.dataset.text;
            if (textToSpeak) api.playTTS(textToSpeak, ttsButton, null, null);
        }
    });
    dom.openCorrectionHistoryBtn.addEventListener('click', () => {
        ui.renderCorrectionHistory();
        dom.correctionHistoryModal.classList.remove('hidden');
    });
    dom.closeCorrectionHistoryBtn.addEventListener('click', () => {
        dom.correctionHistoryModal.classList.add('hidden');
    });
    dom.clearCorrectionHistoryBtn.addEventListener('click', () => {
        if (confirm('정말로 모든 교정 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
            state.correctionHistory.length = 0;
            state.saveCorrectionHistory();
            ui.renderCorrectionHistory();
        }
    });
    dom.correctionHistoryList.addEventListener('click', (e) => {
        const ttsButton = e.target.closest('.tts-btn');
        if (ttsButton) {
            const textToSpeak = ttsButton.dataset.text;
            if (textToSpeak) api.playTTS(textToSpeak, ttsButton, null, null);
        }
    });
    dom.customAlertCloseBtn.addEventListener('click', () => dom.customAlertModal.classList.add('hidden'));
    
    // [★ 수정] 'allPatternsBtn' 리스너 (FAB로 이동했지만 ID가 동일하므로 코드는 동일)
    dom.allPatternsBtn.addEventListener('click', () => {
        dom.allPatternsModal.classList.remove('hidden');
        if (dom.fabContainer) dom.fabContainer.classList.remove('is-open');
    });
    dom.closeAllPatternsBtn.addEventListener('click', () => dom.allPatternsModal.classList.add('hidden'));
    dom.allPatternsList.addEventListener('click', (e) => {
        const selectedPatternDiv = e.target.closest('[data-pattern-index]');
        if (selectedPatternDiv) {
            const patternIndex = parseInt(selectedPatternDiv.dataset.patternIndex, 10);
            const selectedPattern = state.allPatterns[patternIndex];
            if (selectedPattern) {
                ui.renderPatterns([selectedPattern]);
                if (selectedPattern.practice) {
                    setTimeout(() => handlers.handleNewPracticeRequest(selectedPattern.pattern, 0), 0);
                }
                dom.allPatternsModal.classList.add('hidden');
                window.scrollTo(0, 0);
            }
        }
    });

    // --- AI 채팅 모달 ---
    dom.closeChatBtn.addEventListener('click', () => {
        dom.chatModal.classList.add('hidden');
        speech.stopRecognition();
        state.stopCurrentAudio();
    });
    dom.sendChatBtn.addEventListener('click', handlers.handleSendMessage);
    dom.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handlers.handleSendMessage();
        }
    });
    dom.chatHistory.addEventListener('click', (e) => {
        const ttsButton = e.target.closest('.tts-btn');
        if (ttsButton) {
            const textToSpeak = ttsButton.dataset.text;
            if (textToSpeak) api.playTTS(textToSpeak, ttsButton, null, null);
            return;
        }
        const followSpeakButton = e.target.closest('.follow-speak-btn');
        if (followSpeakButton) {
            const originalText = followSpeakButton.dataset.text;
            if (originalText) {
                speech.toggleRecognition(followSpeakButton, { originalText: originalText });
            }
            return;
        }
        const suggestionChip = e.target.closest('.suggestion-chip');
        if (suggestionChip) {
            dom.chatInput.value = suggestionChip.dataset.text;
            dom.chatInput.focus();
            suggestionChip.closest('div.flex.justify-center').remove();
            return;
        }
    });
    dom.micBtn.addEventListener('click', () => {
        speech.toggleRecognition(dom.micBtn, { targetInput: dom.chatInput });
    });
    dom.suggestReplyBtn.addEventListener('click', handlers.handleSuggestReply);

    // [★ 삭제] 퀴즈 모달 리스너 삭제

    // --- FAB (플로팅 버튼) ---
    if (dom.fabMainBtn && dom.fabContainer) {
        dom.fabMainBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dom.fabContainer.classList.toggle('is-open');
        });
    }
    document.addEventListener('click', (e) => {
        if (dom.fabContainer && dom.fabContainer.classList.contains('is-open')) {
            if (!dom.fabContainer.contains(e.target)) {
                dom.fabContainer.classList.remove('is-open');
            }
        }
    });

    // --- 단어 학습 모달 ---
    dom.openWordBtn.addEventListener('click', () => {
        dom.wordModal.classList.remove('hidden');
        if (dom.fabContainer) dom.fabContainer.classList.remove('is-open');
        features.showNextWord();
    });
    dom.closeWordBtn.addEventListener('click', () => {
        dom.wordModal.classList.add('hidden');
        state.stopCurrentAudio();
    });
    dom.wordFlashcard.addEventListener('click', () => {
        dom.wordFlashcard.classList.toggle('is-flipped');
    });
    dom.showWordAnswerBtn.addEventListener('click', () => {
        dom.wordFlashcard.classList.add('is-flipped');
    });
    dom.nextWordBtn.addEventListener('click', features.showNextWord);
    dom.wordTtsBtn.addEventListener('click', (e) => {
        const textToSpeak = e.currentTarget.dataset.text;
        if (textToSpeak) api.playTTS(textToSpeak, e.currentTarget, null, null);
    });

    // --- 간체자 학습 모달 ---
    dom.openCharBtn.addEventListener('click', () => {
        dom.charModal.classList.remove('hidden');
        if (dom.fabContainer) dom.fabContainer.classList.remove('is-open');
        features.showNextCharacter();
    });
    dom.closeCharBtn.addEventListener('click', () => {
        dom.charModal.classList.add('hidden');
        state.stopCurrentAudio();
    });
    dom.nextCharBtn.addEventListener('click', features.showNextCharacter);
    dom.charTtsBtn.addEventListener('click', (e) => {
        const textToSpeak = e.currentTarget.dataset.text;
        if (textToSpeak) api.playTTS(textToSpeak, e.currentTarget, null, null);
    });
    dom.characterInfo.addEventListener('click', (e) => {
        const ttsButton = e.target.closest('.tts-btn');
        if (ttsButton) {
            const textToSpeak = ttsButton.dataset.text;
            if (textToSpeak) api.playTTS(textToSpeak, ttsButton, null, null);
        }
    });
    
    // --- 롤플레잉 모달 리스너 ---
    dom.openRoleplayBtn.addEventListener('click', () => {
        dom.roleplayModal.classList.remove('hidden');
        if (dom.fabContainer) dom.fabContainer.classList.remove('is-open');
    });
    dom.closeRoleplayBtn.addEventListener('click', () => {
        dom.roleplayModal.classList.add('hidden');
    });
    dom.roleplayScenarioList.addEventListener('click', (e) => {
        const scenarioButton = e.target.closest('[data-scenario]');
        if (scenarioButton) {
            const context = scenarioButton.dataset.scenario;
            dom.roleplayModal.classList.add('hidden');
            handlers.handleStartRoleplay(context);
        }
    });

    // --- [★ 수정] 듣기 학습 모달 리스너 ---
    dom.openListeningBtn.addEventListener('click', () => {
        dom.listeningModal.classList.remove('hidden');
        if (dom.fabContainer) dom.fabContainer.classList.remove('is-open');
    });

    dom.closeListeningBtn.addEventListener('click', () => {
        dom.listeningModal.classList.add('hidden');
        state.stopCurrentAudio();
        
        // [★ 수정] 모달 닫을 때 UI 초기화 (풀스크린 및 컨트롤 숨김 해제)
        dom.listeningModal.classList.remove('is-fullscreen'); // 풀스크린 해제
        dom.listeningControls.classList.remove('hidden'); // 컨트롤 보이기
        dom.listeningScriptDisplay.innerHTML = '<p class="text-gray-400 text-center">듣고 싶은 주제를 선택하세요.</p>';
        dom.listeningPlaybackControls.classList.add('hidden');
    });

    // '오늘의 패턴 대화 듣기' 버튼
    dom.getTodayConversationBtn.addEventListener('click', () => {
        handlers.handleTodayConversationRequest(); 
    });

    // '상황별 듣기' 버튼 (이벤트 위임)
    dom.situationalListeningControls.addEventListener('click', (e) => {
        const button = e.target.closest('.situational-listening-btn');
        if (button) {
            const scenario = button.dataset.scenario;
            handlers.handleSituationalListeningRequest(scenario); 
        }
    });

    // '전체 대화 듣기' 버튼
    dom.playAllScriptBtn.addEventListener('click', handlers.handlePlayAllListeningScript); 

    // 스크립트 개별 TTS 버튼 (이벤트 위임)
    dom.listeningScriptDisplay.addEventListener('click', (e) => {
        const ttsButton = e.target.closest('.tts-btn');
        if (ttsButton) {
            const lineElement = ttsButton.closest('.listening-line');
            const textToSpeak = lineElement?.dataset.text;
            // [★ 수정] 화자 정보(speaker)를 lineElement에서 가져와 전달
            const speaker = lineElement?.dataset.speaker || null; // 'Man' or 'Woman'
            
            if (textToSpeak) {
                // api.js의 playTTS를 수정하여 화자 정보(speaker)를 전달
                api.playTTS(textToSpeak, ttsButton, lineElement, speaker);
            }
        }
    });
}

/**
 * 앱을 초기화합니다.
 */
function initializeApp() {
    // 0. 원본 데이터 설정
    state.setAllPatterns(patternsData);
    
    // 1. DOM 요소 초기화 (가장 먼저 실행)
    dom.initializeDOM();
    
    // 2. UI 및 상태 초기화
    ui.displayDate();
    state.initializeCounts();
    state.initializeCorrectionHistory();
    state.initializeWordList();
    state.initializeCharacterList();
    
    // 3. 일일 패턴 로드 및 렌더링
    const dailyPatterns = state.loadDailyPatterns();
    ui.renderPatterns(dailyPatterns);
    
    // 4. 렌더링 후 연습문제 즉시 로드
    dailyPatterns.forEach((p, index) => {
        if (p.practice) {
            setTimeout(() => handlers.handleNewPracticeRequest(p.pattern, index), 0);
        }
    });
    
    // 5. 전체 패턴 목록 렌더링 (모달용)
    ui.renderAllPatternsList();
    
    // 6. 기타 기능 초기화
    state.setupScreenWakeLock();
    speech.initializeSpeechRecognition();
    
    // 7. 모든 이벤트 리스너 설정
    setupEventListeners();
    
    console.log("App initialized.");
}

// --- 앱 실행 ---
document.addEventListener('DOMContentLoaded', initializeApp);