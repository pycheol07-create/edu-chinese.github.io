// js/events/practiceEvents.js
import * as dom from '../dom.js';
import * as state from '../state.js';
import * as handlers from '../handlers.js';
import * as speech from '../speech.js';
import * as api from '../api.js';

export function setupPracticeEvents() {
    // --- 메인 패턴 컨테이너 (이벤트 위임) ---
    dom.patternContainer.addEventListener('click', (e) => {
        const target = e.target;
        
        // 1. 학습 완료 버튼
        if (target.classList.contains('learn-btn')) {
            const pattern = target.dataset.pattern;
            state.learningCounts[pattern] = (state.learningCounts[pattern] || 0) + 1;
            state.saveCounts();
             const countDisplay = target.closest('div').querySelector('.count-display');
             if (countDisplay) {
                 countDisplay.textContent = state.learningCounts[pattern];
             }
        } 
        // 2. 패턴으로 대화하기 버튼
        else if (target.closest('.start-chat-pattern-btn')) {
            const button = target.closest('.start-chat-pattern-btn');
            const patternString = button.dataset.patternString;
            if (patternString) {
                handlers.handleStartChatWithPattern(patternString);
            }
        }
        // 3. 연습문제: 다음 문제 버튼
        else if (target.closest('.next-practice-btn')) {
            const button = target.closest('.next-practice-btn');
            const practiceIndex = button.dataset.practiceIndex;
            const practiceContainer = document.getElementById(`practice-container-${practiceIndex}`);
            const patternString = practiceContainer.querySelector('.show-hint-btn')?.dataset.patternString;
            if (patternString) {
                handlers.handleNewPracticeRequest(patternString, practiceIndex);
            }
        }
        // 4. 연습문제: 마이크 버튼
        else if (target.closest('.practice-mic-btn')) {
            const button = target.closest('.practice-mic-btn');
            const practiceIndex = button.dataset.practiceIndex;
            const targetInput = document.getElementById(`practice-input-${practiceIndex}`);
            speech.toggleRecognition(button, { targetInput: targetInput });
        }
        // 5. 연습문제: 정답 확인 버튼
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
        // 6. 연습문제: 힌트 보기
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
        // 7. 연습문제: 다시하기 버튼
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
        // 8. 따라 말하기 버튼 (발음 평가)
        else if (target.closest('.follow-speak-btn')) {
            const button = target.closest('.follow-speak-btn');
            const originalText = button.dataset.text; 
            if (originalText) {
                speech.toggleRecognition(button, { originalText: originalText });
            }
        }
        // 9. TTS 버튼
        else if (target.closest('.tts-btn')) {
            const ttsButton = target.closest('.tts-btn');
            if (ttsButton.classList.contains('is-playing')) {
                 api.playTTS(null, ttsButton, null, null);
            } else {
                 const textToSpeak = ttsButton.dataset.text; 
                 if (textToSpeak) api.playTTS(textToSpeak, ttsButton, null, null);
            }
        }
    });

    // --- 연습문제 엔터키 입력 ---
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
}