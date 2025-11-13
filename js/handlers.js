// js/handlers.js

// 이 파일은 모든 'handle...' 이벤트 핸들러 로직을 포함합니다.
// api, ui, dom, state 모듈을 모두 가져와 사용합니다.

import * as dom from './dom.js';
import * as state from './state.js';
import * as api from './api.js';
import * as ui from './ui.js';

// [★ 새로 추가] AI 응답에서 JSON 블록만 추출하는 헬퍼 함수
/**
 * 텍스트에서 ```json ... ``` 블록을 추출합니다.
 * @param {string} text - AI가 응답한 전체 텍스트
 * @returns {string | null} - 추출된 JSON 문자열 또는 null
 */
function extractJson(text) {
    if (!text) return null;
    
    // 1. ```json ... ``` 블록 찾기
    const match = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
        return match[1].trim();
    }
    
    // 2. 만약 백틱이 없다면, 텍스트가 { 로 시작하고 } 로 끝나는지 확인
    const trimmedText = text.trim();
    if (trimmedText.startsWith('{') && trimmedText.endsWith('}')) {
        return trimmedText;
    }

    console.warn("Could not find or extract JSON block from text:", text);
    return null; // JSON을 찾지 못함
}


/**
 * 번역기 모달의 '번역하기' 버튼 핸들러
 */
export async function handleTranslation() {
    // ... (기존 코드) ...
    dom.translateBtn.disabled = true;
    dom.translationResult.innerHTML = '<div class="loader mx-auto"></div>';
    
    try {
        const result = await api.translateText(text);
        
        let translationData;
        if (result.candidates && result.candidates[0]?.content?.parts?.[0]) {
            // [★ 수정] JSON 추출 로직 변경
            const translationText = result.candidates[0].content.parts[0].text;
            const cleanedText = extractJson(translationText); 

            try {
                if (!cleanedText) { // JSON 추출 실패
                     throw new Error("AI translation response is not valid JSON.");
                }
                translationData = JSON.parse(cleanedText);
            } catch (e) {
                console.error("AI translation response is not valid JSON:", translationText, e);
                // [★ 수정] AI가 JSON이 아닌 일반 텍스트를 보냈을 경우를 대비한 방어 코드
                translationData = { chinese: translationText.replace(/```/g, ''), pinyin: "(AI 응답 파싱 오류)", alternatives: [], explanation: "(AI가 JSON 형식으로 응답하지 않았습니다.)", usedPattern: null };
            }
        } else {
             console.error("Invalid response structure from translate API:", result);
             translationData = { chinese: "(유효하지 않은 응답)", pinyin: "", alternatives: [], explanation: "", usedPattern: null };
        }

        // ... (이하 동일) ...
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
        
        dom.translationResult.innerHTML = `
            <div class="flex items-center">
                <p class="text-xl chinese-text font-bold text-gray-800">${translationData.chinese}</p>
                <button class="tts-btn ml-2 p-1 rounded-full hover:bg-gray-200 transition-colors" data-text="${translationData.chinese}">
                     <svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-500 pointer-events-none"><path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.Sina.com'da 0.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg>
                </button>
            </div>
            <p class="text-md text-gray-500">${translationData.pinyin || '(병음 정보 없음)'}</p>
            ${alternativesHtml}
            ${patternHtml}
            ${explanationHtml}`;
            
    } catch (error) {
        console.error('Translation error:', error);
        dom.translationResult.innerHTML = `<p class="text-red-500 text-center">번역 중 오류가 발생했습니다: ${error.message}</p>`;
    } finally {
        dom.translateBtn.disabled = false;
    }
}

/**
 * AI 채팅 '전송' 버튼 핸들러 (롤플레잉 문맥 인식)
 */
export async function handleSendMessage() {
    // ... (기존 코드와 동일) ...
    const userInput = dom.chatInput.value.trim();
    if (!userInput) return;
    
    dom.chatHistory.querySelectorAll('.suggestion-chip').forEach(chip => chip.closest('div.flex.justify-center')?.remove());
    
    ui.addMessageToHistory('user', { text: userInput });
    dom.chatInput.value = '';
    
    const loadingElement = document.createElement('div');
    loadingElement.className = 'flex justify-start';
    loadingElement.id = 'chat-loading';
    loadingElement.innerHTML = `<div class="bg-white p-3 rounded-lg border"><div class="loader"></div></div>`;
    dom.chatHistory.appendChild(loadingElement);
    dom.chatHistory.scrollTop = dom.chatHistory.scrollHeight;
    
    try {
        const roleContext = state.conversationHistory.find(m => m.role === 'system')?.context || null;
        
        state.conversationHistory.push({ role: 'user', parts: [{ text: userInput }] });
        
        const result = await api.getChatResponse(userInput, state.conversationHistory, roleContext);

        let aiResponseData;
        if (result.candidates && result.candidates[0]?.content?.parts?.[0]) {
            const aiResponseText = result.candidates[0].content.parts[0].text;

            // [★ 수정] JSON 추출 로직 변경
            const cleanedText = extractJson(aiResponseText);

            if (!cleanedText) { // JSON 추출 실패
                console.error("AI response is not valid JSON (or is empty):", aiResponseText);
                aiResponseData = {
                    chinese: "哎呀，我好像走神了...",
                    pinyin: "Āiyā, wǒ hǎoxiàng zǒushén le...",
                    korean: "어머, 제가 잠시 딴생각을 했나 봐요. 다시 한 번 말씀해 주시겠어요?"
                };
            } else {
                try {
                    aiResponseData = JSON.parse(cleanedText);
                    // [★ 수정] 원본 AI 응답(JSON 텍스트)을 히스토리에 저장
                    state.conversationHistory.push({ role: 'model', parts: [{ text: cleanedText }] });
                } catch (e) {
                    console.error("AI response looked like JSON but failed to parse:", aiResponseText, e);
                    aiResponseData = {
                        chinese: "糟糕... (zāogāo)",
                        pinyin: "",
                        korean: "이런... 응답 형식을 처리하는 데 실패했어요. 다시 시도해주세요."
                    };
                    state.conversationHistory.push({ role: 'model', parts: [{ text: aiResponseText }] }); // 파싱 실패 시 원본 텍스트 저장
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
        ui.addMessageToHistory('ai', aiResponseData);
        
    } catch (error) {
        console.error('Chat error:', error);
        ui.showAlert(`대화 중 오류가 발생했습니다: ${error.message}`);
    } finally {
        const loadingEl = document.getElementById('chat-loading');
        if (loadingEl) loadingEl.remove();
    }
}

/**
 * '이 패턴으로 대화' 버튼 핸들러
 * @param {string} patternString - 대화를 시작할 패턴
 */
export async function handleStartChatWithPattern(patternString) {
    // ... (기존 코드와 동일) ...
    dom.chatModal.classList.remove('hidden');
    if (dom.fabContainer) dom.fabContainer.classList.remove('is-open');
    
    dom.chatHistory.innerHTML = '';
    state.conversationHistory.length = 0; // 대화 기록 초기화
    dom.chatInput.value = '';
    
    const loadingElement = document.createElement('div');
    loadingElement.className = 'flex justify-start';
    loadingElement.id = 'chat-loading';
    loadingElement.innerHTML = `<div class="bg-white p-3 rounded-lg border"><div class="loader"></div></div>`;
    dom.chatHistory.appendChild(loadingElement);
    dom.chatHistory.scrollTop = dom.chatHistory.scrollHeight;

    try {
        const result = await api.startChatWithPattern(patternString);

        let aiResponseData;
        if (result.candidates && result.candidates[0]?.content?.parts?.[0]) {
            const aiResponseText = result.candidates[0].content.parts[0].text;
            
            // [★ 수정] JSON 추출 로직 변경
            const cleanedText = extractJson(aiResponseText);

            if (!cleanedText) { // JSON 추출 실패
                console.error("AI response is not valid JSON (or is empty) in start_chat_with_pattern:", aiResponseText);
                aiResponseData = {
                    chinese: "哎呀，我好像走神了...",
                    pinyin: "Āiyā, wǒ hǎoxiàng zǒushén le...",
                    korean: "어머, 제가 잠시 딴생각을 했나 봐요. '패턴으로 대화' 버튼을 다시 한 번 눌러주시겠어요?"
                };
            } else {
                try {
                    aiResponseData = JSON.parse(cleanedText);
                    state.conversationHistory.push({ role: 'model', parts: [{ text: cleanedText }] });
                } catch (e) {
                    console.error("AI response looked like JSON but failed to parse in start_chat_with_pattern:", aiResponseText, e);
                    aiResponseData = {
                        chinese: "糟糕... (zāogāo)",
                        pinyin: "",
                        korean: "이런... 응답 형식을 처리하는 데 실패했어요. 다시 시도해주세요."
                    };
                    state.conversationHistory.push({ role: 'model', parts: [{ text: aiResponseText }] });
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
        ui.addMessageToHistory('ai', aiResponseData);
        
    } catch (error) {
        console.error('Start chat with pattern error:', error);
        ui.showAlert(`대화 시작 중 오류가 발생했습니다: ${error.message}`);
    } finally {
        const loadingEl = document.getElementById('chat-loading');
        if (loadingEl) loadingEl.remove();
    }
}

/**
 * '상황별 대화' 시나리오 시작 핸들러
 * @param {string} context - 롤플레잉 상황 (e.g., 'restaurant')
 */
export async function handleStartRoleplay(context) {
    // ... (기존 코드와 동일) ...
    dom.chatModal.classList.remove('hidden');
    if (dom.fabContainer) dom.fabContainer.classList.remove('is-open');
    
    dom.chatHistory.innerHTML = '';
    state.conversationHistory.length = 0; // 대화 기록 초기화
    dom.chatInput.value = '';
    
    const loadingElement = document.createElement('div');
    loadingElement.className = 'flex justify-start';
    loadingElement.id = 'chat-loading';
    loadingElement.innerHTML = `<div class="bg-white p-3 rounded-lg border"><div class="loader"></div></div>`;
    dom.chatHistory.appendChild(loadingElement);
    dom.chatHistory.scrollTop = dom.chatHistory.scrollHeight;

    try {
        state.conversationHistory.push({ role: 'system', context: context });
        const result = await api.startRoleplayChat(context);

        let aiResponseData;
        if (result.candidates && result.candidates[0]?.content?.parts?.[0]) {
            const aiResponseText = result.candidates[0].content.parts[0].text;
            
            // [★ 수정] JSON 추출 로직 변경
            const cleanedText = extractJson(aiResponseText);
            
            if (!cleanedText) { // JSON 추출 실패
                throw new Error("AI response is not valid JSON.");
            } else {
                try {
                    aiResponseData = JSON.parse(cleanedText);
                    state.conversationHistory.push({ role: 'model', parts: [{ text: cleanedText }] });
                } catch (e) {
                    throw new Error("AI response parsing failed.");
                }
            }
        } else {
             throw new Error("Invalid response structure from start_roleplay_chat API.");
        }
        ui.addMessageToHistory('ai', aiResponseData);
        
    } catch (error) {
        console.error('Start role-play error:', error);
        ui.showAlert(`대화 시작 중 오류가 발생했습니다: ${error.message}`);
        state.conversationHistory.length = 0;
        dom.chatModal.classList.add('hidden');
    } finally {
        const loadingEl = document.getElementById('chat-loading');
        if (loadingEl) loadingEl.remove();
    }
}


/**
 * '답변 추천받기' 버튼 핸들러
 */
export async function handleSuggestReply() {
    // ... (기존 코드와 동일) ...
    dom.chatHistory.querySelectorAll('.suggestion-chip').forEach(chip => chip.closest('div.flex.justify-center')?.remove());
    
    if (state.conversationHistory.length === 0) {
        ui.showAlert('추천할 답변을 생성하기 위한 대화 내용이 없습니다.');
        return;
    }
    
    dom.suggestReplyBtn.disabled = true;
    dom.suggestReplyBtn.textContent = '추천 생성 중...';
    
    try {
        const filteredHistory = state.conversationHistory.filter(
            m => m.role === 'user' || m.role === 'model'
        );
        
        // [★ 수정]
        // 이 API 호출은 서버(api/gemini.js)에서 오류가 발생한 것입니다.
        // 클라이언트(handlers.js) 측 코드는 정상입니다.
        // 서버 측에서 'AI로부터 유효한 답변 추천...' 오류를 던졌습니다. (오류 로그 3번 참조)
        // 이 파일(handlers.js)을 수정한 뒤, api/gemini.js 파일도 수정해야 합니다.
        const result = await api.getSuggestedReplies(filteredHistory);
        
        let suggestions = [];
        // [★ 수정] 서버가 이제 파싱된 JSON을 반환하므로 result.candidates가 없음
        if (result.suggestions && Array.isArray(result.suggestions)) {
            suggestions = result.suggestions;
        } 
        // [★ 삭제] result.candidates... 관련 로직 삭제
        // else if (result.candidates && ...) 

        else {
            // [★ 수정] 서버가 suggestions를 주지 않았을 때의 오류
            console.error("Invalid response structure for suggestions:", result);
        }

        if (suggestions.length > 0 && suggestions.every(s => s.chinese && s.pinyin && s.korean)) {
            ui.addSuggestionToHistory(suggestions);
        } else {
             console.warn("Received suggestions are empty or have invalid format:", suggestions);
            ui.showAlert('추천할 만한 답변을 찾지 못했거나 형식이 잘못되었습니다.');
        }
        
    } catch (error) {
        // [★] 'Suggest reply error: Error: AI로부터 유효한 답변 추천...'
        // 이 오류 메시지는 api/gemini.js에서 보낸 오류 메시지입니다.
        console.error('Suggest reply error:', error);
        ui.showAlert(`답변 추천 중 오류 발생: ${error.message}`);
    } finally {
        dom.suggestReplyBtn.disabled = false;
        dom.suggestReplyBtn.textContent = '💡 답변 추천받기';
    }
}

/**
 * '직접 말해보기' 섹션의 새 문제 요청 핸들러
 * @param {string} patternString - 문제를 생성할 패턴
 * @param {number} practiceIndex - 패턴 카드의 인덱스
 */
export async function handleNewPracticeRequest(patternString, practiceIndex) {
    // ... (기존 코드와 동일) ...
    const koreanEl = document.getElementById(`practice-korean-${practiceIndex}`);
    const inputEl = document.getElementById(`practice-input-${practiceIndex}`);
    const checkBtn = document.getElementById(`check-practice-btn-${practiceIndex}`);
    // ... (기타 dom 요소)
    const practiceContainer = document.getElementById(`practice-container-${practiceIndex}`);
    const counterEl = document.getElementById(`practice-counter-${practiceIndex}`);
    if (!practiceContainer) {
        console.error(`Practice container practice-container-${practiceIndex} not found.`);
        return;
    }
    // ... (로딩 UI 설정) ...
    koreanEl.textContent = '...';
    inputEl.value = '';
    // ...
    counterEl.innerHTML = `<div class="loader-sm mx-auto"></div>`;
    try {
        const result = await api.getNewPractice(patternString);
        let practiceData;
        if (result.candidates && result.candidates[0]?.content?.parts?.[0]) {
            // [★ 수정] JSON 추출 로직 변경 (오류 1번의 원인)
            const aiResponseText = result.candidates[0].content.parts[0].text;
            const practiceText = extractJson(aiResponseText);

            try {
                if (!practiceText) { // (line 365)
                    throw new Error("AI response for practice is not valid JSON.");
                }
                practiceData = JSON.parse(practiceText);
                
                // [★ 추가] AI가 만든 퀴즈(오류 로그)가 아니라 작문 문제를 요구해야 함
                if (practiceData.question || !practiceData.korean || !practiceData.chinese) {
                    console.error("AI returned a quiz instead of a practice problem:", practiceData);
                    throw new Error("AI가 연습문제가 아닌 퀴즈를 반환했습니다.");
                }

                koreanEl.textContent = `"${practiceData.korean}"`;
                checkBtn.dataset.answer = practiceData.chinese;
                checkBtn.dataset.pinyin = practiceData.pinyin;
                // ... (이하 UI 설정 동일)
                hintBtn.dataset.newVocab = JSON.stringify(practiceData.practiceVocab || []);
                practiceContainer.dataset.spreeCount = nextCount;
                checkBtn.style.display = '';
                hintBtn.style.display = '';
                micBtnPractice.style.display = '';
                inputEl.disabled = false;
                hintBtn.disabled = false;
                hintBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                counterEl.textContent = `문제 ${nextCount} / ${goal}`;
                inputEl.focus();
            } catch (e) { // (line 382)
                console.error("Failed to parse practice data:", aiResponseText, e); // [★ 수정] 원본 텍스트(aiResponseText) 로깅
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

/**
 * '작문 교정하기' 버튼 핸들러
 */
export async function handleCorrectWriting() {
    // ... (기존 코드와 동일) ...
    const text = dom.correctionInput.value.trim();
    if (!text) {
        ui.showAlert('교정받을 중국어 문장을 입력하세요.');
        return;
    }
    dom.correctWritingBtn.disabled = true;
    dom.correctionResult.innerHTML = '<div class="loader mx-auto"></div>';
    try {
        const result = await api.correctWriting(text);
        let correctionData;
        if (result.candidates && result.candidates[0]?.content?.parts?.[0]) {
            const correctionText = result.candidates[0].content.parts[0].text;
            
            // [★ 수정] JSON 추출 로직 변경
            const cleanedText = extractJson(correctionText);

            if (!cleanedText) { // JSON 추출 실패
                 throw new Error("AI가 유효한 JSON 형식으로 응답하지 않았습니다.");
            }
            try {
                correctionData = JSON.parse(cleanedText);
            } catch (e) {
                console.error("AI correction response is not valid JSON:", correctionText, e);
                correctionData = { corrected_sentence: "(JSON 파싱 오류)", explanation: "AI 응답을 처리하는 중 오류가 발생했습니다. 다시 시도해주세요." };
            }
        } else {
             console.error("Invalid response structure from correct_writing API:", result);
             correctionData = { corrected_sentence: "(유효하지 않은 응답)", explanation: "AI로부터 유효한 응답을 받지 못했습니다." };
        }
        
        // ... (이하 동일) ...
        if (correctionData.corrected_sentence && correctionData.explanation) {
             state.addCorrectionToHistory(text, correctionData.corrected_sentence, correctionData.explanation);
        }
        let explanationHtml = '';
        if (correctionData.explanation) {
            explanationHtml = `
                <h4 class="text-md font-semibold text-gray-700 mt-4 pt-3 border-t">✍️ AI 코멘트:</h4>
                <p class="text-md text-gray-600 mt-1">${correctionData.explanation.replace(/\n/g, '<br>')}</p>`;
        }
        dom.correctionResult.innerHTML = `
            <div>
                <h4 class="text-md font-semibold text-gray-700">💡 교정된 문장:</h4>
                <div class="flex items-center mt-1 p-3 bg-green-50 rounded-lg">
                    <p class="text-lg chinese-text font-bold text-green-800">${correctionData.corrected_sentence}</p>
                    <button class="tts-btn ml-2 p-1 rounded-full hover:bg-gray-200 transition-colors" data-text="${correctionData.corrected_sentence}">
                         <svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-500 pointer-events-none"><path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.Sina.com'da 0.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg>
                    </button>
                </div>
                ${explanationHtml}
            </div>`;
    } catch (error) {
        console.error('Correction error:', error);
        dom.correctionResult.innerHTML = `<p class="text-red-500 text-center">교정 중 오류가 발생했습니다: ${error.message}</p>`;
    } finally {
        dom.correctWritingBtn.disabled = false;
    }
}

/**
 * '작문 주제 추천' 버튼 핸들러
 */
export async function handleGetWritingTopic() {
    // ... (기존 코드와 동일) ...
    dom.getTopicBtn.disabled = true;
    dom.getTopicBtn.textContent = '주제 생성 중...';
    dom.writingTopicDisplay.innerHTML = '<div class="loader-sm mx-auto"></div>';
    try {
        const result = await api.getWritingTopic();
        let topicData;
        if (result.candidates && result.candidates[0]?.content?.parts?.[0]) {
            const topicText = result.candidates[0].content.parts[0].text;

            // [★ 수정] JSON 추출 로직 변경
            const cleanedText = extractJson(topicText);

            if (!cleanedText) { // JSON 추출 실패
                 throw new Error("AI가 유효한 JSON 형식으로 응답하지 않았습니다.");
            }
            try {
                topicData = JSON.parse(cleanedText);
            } catch (e) {
                console.error("AI topic response is not valid JSON:", topicText, e);
                throw new Error("AI 응답을 처리하는 중 오류가 발생했습니다.");
            }
        } else {
             console.error("Invalid response structure from get_writing_topic API:", result);
             throw new Error("AI로부터 유효한 응답을 받지 못했습니다.");
        }
        
        // ... (이하 동일) ...
        if (topicData.topic) {
            dom.writingTopicDisplay.textContent = `"${topicData.topic}"`;
            dom.writingTopicDisplay.classList.remove('italic');
            dom.writingTopicDisplay.classList.add('font-semibold');
        } else {
            throw new Error("AI 응답에 'topic' 키가 없습니다.");
        }
    } catch (error) {
        console.error('Get topic error:', error);
        dom.writingTopicDisplay.textContent = `오류: ${error.message}`;
        dom.writingTopicDisplay.classList.remove('font-semibold');
        dom.writingTopicDisplay.classList.add('italic', 'text-red-500');
    } finally {
        dom.getTopicBtn.disabled = false;
        dom.getTopicBtn.textContent = '💡 다른 주제 추천받기';
    }
}


// --- [★ 새로 추가] 듣기 학습 핸들러 ---

/**
 * '오늘의 패턴 대화 듣기' 버튼 핸들러
 */
export async function handleTodayConversationRequest() {
    const dailyPatterns = state.loadDailyPatterns(); // 현재 로드된 오늘의 패턴 가져오기
    if (!dailyPatterns || dailyPatterns.length < 2) {
        ui.showAlert("오늘의 패턴 2개를 먼저 불러와주세요.");
        return;
    }
    const pattern1 = dailyPatterns[0].pattern;
    const pattern2 = dailyPatterns[1].pattern;

    dom.listeningScriptDisplay.innerHTML = '<div class="loader mx-auto"></div>';
    dom.listeningPlaybackControls.classList.add('hidden');
    dom.getTodayConversationBtn.disabled = true;
    dom.getTodayConversationBtn.textContent = '대화 생성 중...';
    dom.situationalListeningControls.querySelectorAll('button').forEach(btn => btn.disabled = true);

    try {
        const result = await api.getTodayConversationScript(pattern1, pattern2); 
        
        let scriptData;
        if (result.candidates && result.candidates[0]?.content?.parts?.[0]) {
            // [★ 수정] JSON 추출 로직 변경
            const scriptText = result.candidates[0].content.parts[0].text;
            const cleanedText = extractJson(scriptText);

            if (!cleanedText) { // JSON 추출 실패
                 throw new Error("AI가 유효한 JSON 형식으로 응답하지 않았습니다.");
            }
            scriptData = JSON.parse(cleanedText); // { title: "...", script: [...] }
        } else {
            throw new Error("AI로부터 유효한 스크립트를 받지 못했습니다.");
        }

        if (scriptData.script) {
            ui.renderListeningScript(scriptData.title, scriptData.script); 
            dom.listeningPlaybackControls.classList.remove('hidden');
        } else {
            throw new Error("AI 응답에 'script' 키가 없습니다.");
        }
    } catch (error) {
        console.error('Today Conversation error:', error);
        dom.listeningScriptDisplay.innerHTML = `<p class="text-red-500 text-center">대화 생성 중 오류가 발생했습니다: ${error.message}</p>`;
    } finally {
        dom.getTodayConversationBtn.disabled = false;
        dom.getTodayConversationBtn.textContent = '오늘의 패턴 대화 듣기';
        dom.situationalListeningControls.querySelectorAll('button').forEach(btn => btn.disabled = false);
    }
}

/**
 * '상황별 듣기' 버튼 핸들러
 * @param {string} scenario - 선택된 시나리오 (e.g., 'restaurant')
 */
export async function handleSituationalListeningRequest(scenario) {
    dom.listeningScriptDisplay.innerHTML = '<div class="loader mx-auto"></div>';
    dom.listeningPlaybackControls.classList.add('hidden');
    
    // 모든 버튼 비활성화
    dom.getTodayConversationBtn.disabled = true;
    dom.situationalListeningControls.querySelectorAll('button').forEach(btn => btn.disabled = true);

    try {
        const result = await api.getSituationalListeningScript(scenario); 

        let scriptData;
        if (result.candidates && result.candidates[0]?.content?.parts?.[0]) {
            // [★ 수정] JSON 추출 로직 변경
            const scriptText = result.candidates[0].content.parts[0].text;
            const cleanedText = extractJson(scriptText);

            if (!cleanedText) { // JSON 추출 실패
                 throw new Error("AI가 유효한 JSON 형식으로 응답하지 않았습니다.");
            }
            scriptData = JSON.parse(cleanedText);
        } else {
            throw new Error("AI로부터 유효한 스크립트를 받지 못했습니다.");
        }

        if (scriptData.script) {
            ui.renderListeningScript(scriptData.title, scriptData.script);
            dom.listeningPlaybackControls.classList.remove('hidden');
        } else {
            throw new Error("AI 응답에 'script' 키가 없습니다.");
        }
    } catch (error) {
        console.error('Situational Listening error:', error);
        dom.listeningScriptDisplay.innerHTML = `<p class="text-red-500 text-center">대화 생성 중 오류가 발생했습니다: ${error.message}</p>`;
    } finally {
        // 모든 버튼 다시 활성화
        dom.getTodayConversationBtn.disabled = false;
        dom.situationalListeningControls.querySelectorAll('button').forEach(btn => btn.disabled = false);
    }
}

/**
 * 비동기 딜레이를 위한 헬퍼 함수
 * @param {number} ms - 기다릴 시간 (밀리초)
 */
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * '전체 대화 듣기' 버튼 핸들러 (스크립트 순차 재생)
 */
export async function handlePlayAllListeningScript() {
    const lines = dom.listeningScriptDisplay.querySelectorAll('.listening-line');
    if (lines.length === 0) return;

    // 이미 재생 중일 때 클릭하면 중지
    if (state.runTimeState.currentAudio) {
        state.stopCurrentAudio();
        return;
    }

    dom.playAllScriptBtn.disabled = true;
    dom.playAllScriptBtn.textContent = '...전체 대화 재생 중... (중지하려면 클릭)';

    try {
        for (const line of lines) {
            const text = line.dataset.text;
            const ttsButton = line.querySelector('.tts-btn');
            if (!text) continue;

            // api.js의 playTTS는 3번째 인자로 lineElement를 받아
            // 재생 시작 시 'is-playing' 클래스를 추가하고,
            // 재생 종료 시(onended, onerror, onpause) 클래스를 제거하며
            // Promise를 반환하도록 수정될 예정입니다.
            await api.playTTS(text, ttsButton, line);

            // 재생이 (오류나 중지 없이) 정상 종료되었는지 확인
            // stopCurrentAudio가 호출되면 currentAudio가 null이 됩니다.
            // [★ 수정] currentAudio가 null이 아니면 (즉, 정상 종료되면) 대기
            if (state.runTimeState.currentAudio === null) {
                 // 사용자가 중지했음 (stopCurrentAudio가 호출됨)
                 console.log("Playback stopped.");
                 break; // 루프 탈출
            }

            await wait(300); // 대사 사이 0.3초 쉼
        }
    } catch (error) {
        console.error("Play All error:", error);
        // "Playback stopped"는 stopCurrentAudio에 의해 발생하는 예상된 오류(Promise reject)
        if (error && error.message !== 'Playback stopped') { 
           ui.showAlert(`전체 재생 중 오류가 발생했습니다: ${error.message}`);
        }
    } finally {
        dom.playAllScriptBtn.disabled = false;
        dom.playAllScriptBtn.textContent = '▶︎ 전체 대화 듣기';
        lines.forEach(line => line.classList.remove('is-playing'));
        // 루프가 끝나거나 중지되었을 때 오디오 상태 최종 정리
        if (state.runTimeState.currentAudio) {
            state.stopCurrentAudio();
        }
    }
}