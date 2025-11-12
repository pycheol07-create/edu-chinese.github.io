// js/handlers.js

// 이 파일은 모든 'handle...' 이벤트 핸들러 로직을 포함합니다.
// api, ui, dom, state 모듈을 모두 가져와 사용합니다.

import * as dom from './dom.js';
import * as state from './state.js';
import * as api from './api.js';
import * as ui from './ui.js';

/**
 * 번역기 모달의 '번역하기' 버튼 핸들러
 */
export async function handleTranslation() {
    const text = dom.koreanInput.value.trim();
    if (!text) {
        ui.showAlert('번역할 한국어 문장을 입력하세요.');
        return;
    }
    dom.translateBtn.disabled = true;
    dom.translationResult.innerHTML = '<div class="loader mx-auto"></div>';
    
    try {
        const result = await api.translateText(text);
        
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
        
        dom.translationResult.innerHTML = `
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
        dom.translationResult.innerHTML = `<p class="text-red-500 text-center">번역 중 오류가 발생했습니다: ${error.message}</p>`;
    } finally {
        dom.translateBtn.disabled = false;
    }
}

/**
 * AI 채팅 '전송' 버튼 핸들러 (롤플레잉 문맥 인식)
 */
export async function handleSendMessage() {
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

            if (!aiResponseText || !aiResponseText.trim().startsWith('{')) {
                console.error("AI response is not valid JSON (or is empty):", aiResponseText);
                aiResponseData = {
                    chinese: "哎呀，我好像走神了...",
                    pinyin: "Āiyā, wǒ hǎoxiàng zǒushén le...",
                    korean: "어머, 제가 잠시 딴생각을 했나 봐요. 다시 한 번 말씀해 주시겠어요?"
                };
            } else {
                try {
                    const cleanedText = aiResponseText.trim().replace(/^```json\s*|\s*```$/g, '');
                    aiResponseData = JSON.parse(cleanedText);
                    state.conversationHistory.push({ role: 'model', parts: [{ text: aiResponseText }] });
                } catch (e) {
                    console.error("AI response looked like JSON but failed to parse:", aiResponseText, e);
                    aiResponseData = {
                        chinese: "糟糕... (zāogāo)",
                        pinyin: "",
                        korean: "이런... 응답 형식을 처리하는 데 실패했어요. 다시 시도해주세요."
                    };
                    state.conversationHistory.push({ role: 'model', parts: [{ text: aiResponseText }] });
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
            if (!aiResponseText || !aiResponseText.trim().startsWith('{')) {
                console.error("AI response is not valid JSON (or is empty) in start_chat_with_pattern:", aiResponseText);
                aiResponseData = {
                    chinese: "哎呀，我好像走神了...",
                    pinyin: "Āiyā, wǒ hǎoxiàng zǒushén le...",
                    korean: "어머, 제가 잠시 딴생각을 했나 봐요. '패턴으로 대화' 버튼을 다시 한 번 눌러주시겠어요?"
                };
            } else {
                try {
                    const cleanedText = aiResponseText.trim().replace(/^```json\s*|\s*```$/g, '');
                    aiResponseData = JSON.parse(cleanedText);
                    state.conversationHistory.push({ role: 'model', parts: [{ text: aiResponseText }] });
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
        // 1. 롤플레잉 문맥(context)을 대화 기록에 시스템 메시지로 추가
        state.conversationHistory.push({ role: 'system', context: context });

        // 2. 롤플레잉 시작 API 호출
        const result = await api.startRoleplayChat(context);

        let aiResponseData;
        if (result.candidates && result.candidates[0]?.content?.parts?.[0]) {
            const aiResponseText = result.candidates[0].content.parts[0].text;
            // [★ 오류 2 수정] AI가 JSON이 아닌 일반 텍스트로 응답할 경우를 대비
            if (!aiResponseText || !aiResponseText.trim().startsWith('{')) {
                console.error("AI response is not valid JSON:", aiResponseText);
                throw new Error("AI response is not valid JSON."); // 이 오류가 잡힙니다.
            }
            
            try {
                const cleanedText = aiResponseText.trim().replace(/^```json\s*|\s*```$/g, '');
                aiResponseData = JSON.parse(cleanedText);
                // 3. AI의 첫 메시지를 대화 기록에 추가
                state.conversationHistory.push({ role: 'model', parts: [{ text: aiResponseText }] });
            } catch (e) {
                console.error("AI response parsing failed:", e);
                throw new Error("AI response parsing failed.");
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
 * '듣기 훈련' 시나리오 시작 핸들러
 * @param {string} context - 듣기 상황 (e.g., 'restaurant')
 */
export async function handleStartListeningScript(context) {
    if (!dom.scriptPlayerModal || !dom.scriptContent) return;

    dom.scriptPlayerModal.classList.remove('hidden');
    if (dom.fabContainer) dom.fabContainer.classList.remove('is-open');

    // 로딩 상태 표시
    dom.scriptTitle.textContent = "대본 생성 중...";
    dom.scriptContent.innerHTML = '<div class="loader mx-auto"></div>';
    
    // 버튼 초기화
    dom.playAllScriptBtn.disabled = true;
    dom.toggleScriptBtn.disabled = true;

    try {
        const result = await api.getListeningScript(context);

        let scriptData;
        if (result.candidates && result.candidates[0]?.content?.parts?.[0]) {
            const scriptText = result.candidates[0].content.parts[0].text.trim().replace(/^```json\s*|\s*```$/g, '');
            if (!scriptText || !scriptText.startsWith('{')) {
                throw new Error("AI response is not valid JSON.");
            }
            try {
                scriptData = JSON.parse(scriptText);
            } catch (e) {
                console.error("AI script response is not valid JSON:", scriptText, e);
                throw new Error("AI 응답을 처리하는 중 오류가 발생했습니다.");
            }
        } else {
             console.error("Invalid response structure from get_listening_script API:", result);
             throw new Error("AI로부터 유효한 응답을 받지 못했습니다.");
        }

        if (scriptData.title && scriptData.dialogue) {
            // UI 렌더링
            ui.renderScriptPlayer(scriptData.title, scriptData.dialogue);
            dom.playAllScriptBtn.disabled = false;
            dom.toggleScriptBtn.disabled = false;
        } else {
            throw new Error("AI 응답에 'title' 또는 'dialogue' 키가 없습니다.");
        }

    } catch (error) {
        console.error('Start listening script error:', error);
        ui.showAlert(`대본 생성 중 오류가 발생했습니다: ${error.message}`);
        dom.scriptPlayerModal.classList.add('hidden');
    }
}


/**
 * '답변 추천받기' 버튼 핸들러
 */
export async function handleSuggestReply() {
    dom.chatHistory.querySelectorAll('.suggestion-chip').forEach(chip => chip.closest('div.flex.justify-center')?.remove());
    
    if (state.conversationHistory.length === 0) {
        ui.showAlert('추천할 답변을 생성하기 위한 대화 내용이 없습니다.');
        return;
    }
    
    dom.suggestReplyBtn.disabled = true;
    dom.suggestReplyBtn.textContent = '추천 생성 중...';
    
    try {
        // [★ 오류 3 수정] 'system' role을 API로 보내면 오류가 발생하므로, user/model 메시지만 필터링합니다.
        const filteredHistory = state.conversationHistory.filter(
            m => m.role === 'user' || m.role === 'model'
        );
        
        // 필터링된 기록으로 API 호출
        const result = await api.getSuggestedReplies(filteredHistory);
        
        let suggestions = [];
        if (result.suggestions && Array.isArray(result.suggestions)) {
            suggestions = result.suggestions;
        } else if (result.candidates && result.candidates[0]?.content?.parts?.[0]) {
             const suggestionText = result.candidates[0].content.parts[0].text.trim().replace(/^```json\s*|\s*```$/g, '');
             try {
                const parsedData = JSON.parse(suggestionText);
                if (parsedData.suggestions && Array.isArray(parsedData.suggestions)) {
                    suggestions = parsedData.suggestions;
                }
             } catch (e) {
                 console.error("Failed to parse suggestion JSON:", suggestionText, e);
             }
        } else {
            // 이 지점으로 오면 서버 500 오류가 발생했거나,
            // 200 OK를 받았지만 'suggestions' 키가 없는 경우입니다.
            // (사용자가 보고한 오류는 500 오류였으므로, 이 'else'는 아니었을 것입니다.)
            console.error("Invalid response structure for suggestions:", result);
        }

        if (suggestions.length > 0 && suggestions.every(s => s.chinese && s.pinyin && s.korean)) {
            ui.addSuggestionToHistory(suggestions);
        } else {
             console.warn("Received suggestions are empty or have invalid format:", suggestions);
            ui.showAlert('추천할 만한 답변을 찾지 못했거나 형식이 잘못되었습니다.');
        }
        
    } catch (error) {
        console.error('Suggest reply error:', error);
        // [★] 사용자가 본 오류가 여기서 표시됩니다.
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
    const koreanEl = document.getElementById(`practice-korean-${practiceIndex}`);
    const inputEl = document.getElementById(`practice-input-${practiceIndex}`);
    const checkBtn = document.getElementById(`check-practice-btn-${practiceIndex}`);
    const hintBtn = document.getElementById(`show-hint-btn-${practiceIndex}`);
    const micBtnPractice = document.getElementById(`practice-mic-btn-${practiceIndex}`);
    const resultEl = document.getElementById(`practice-result-${practiceIndex}`);
    const hintDataEl = document.getElementById(`practice-hint-${practiceIndex}`);
    const practiceContainer = document.getElementById(`practice-container-${practiceIndex}`);
    const counterEl = document.getElementById(`practice-counter-${practiceIndex}`);

    if (!practiceContainer) {
        console.error(`Practice container practice-container-${practiceIndex} not found.`);
        return;
    }

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
    counterEl.innerHTML = `<div class="loader-sm mx-auto"></div>`; // 로딩 표시

    try {
        const result = await api.getNewPractice(patternString);

        let practiceData;
        if (result.candidates && result.candidates[0]?.content?.parts?.[0]) {
            const practiceText = result.candidates[0].content.parts[0].text.trim().replace(/^```json\s*|\s*```$/g, '');
            try {
                if (!practiceText || !practiceText.startsWith('{')) {
                    throw new Error("AI response for practice is not valid JSON.");
                }
                practiceData = JSON.parse(practiceText);

                // [★ 오류 1 수정] AI가 키를 빠뜨렸는지 확인
                if (!practiceData.korean || !practiceData.chinese || !practiceData.pinyin) {
                    console.error("AI practice response missing required keys:", practiceData);
                    throw new Error("AI가 연습문제 형식을 올바르게 반환하지 못했습니다.");
                }

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
                // [★ 오류 1 수정] 사용자에게 오류 표시
                koreanEl.textContent = `오류: ${e.message}`;
                counterEl.textContent = '오류';
                practiceContainer.dataset.spreeCount = currentCount;
                inputEl.disabled = true;
            }
        } else {
            console.error("Invalid response structure from generate_practice API:", result);
            throw new Error("AI로부터 유효한 응답을 받지 못했습니다.");
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
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-500 pointer-events-none"><path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg>
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
    dom.getTopicBtn.disabled = true;
    dom.getTopicBtn.textContent = '주제 생성 중...';
    dom.writingTopicDisplay.innerHTML = '<div class="loader-sm mx-auto"></div>';

    try {
        const result = await api.getWritingTopic();

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