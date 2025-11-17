// js/api.js
import * as state from './state.js';
import { showAlert } from './ui.js';

/**
 * Gemini API를 호출하는 공통 함수
 * @param {string} action - API 엔드포인트에서 처리할 작업 (예: 'translate', 'chat')
 * @param {object} body - API에 전송할 데이터
 * @returns {Promise<object>} - API 응답 JSON
 */
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

/**
 * [★ 수정] 텍스트를 음성(TTS)으로 재생합니다. (speaker 인자 추가)
 * (전체 듣기 기능을 위해 Promise를 반환하고, lineElement 하이라이트를 지원하도록 수정)
 * @param {string} text - 재생할 텍스트
 * @param {HTMLElement | null} buttonElement - (선택) 클릭된 TTS 버튼
 * @param {HTMLElement | null} lineElement - (선택) 하이라이트할 대화 라인 요소
 * @param {string | null} speaker - (선택) 'Man' or 'Woman', 목소리 구분을 위함
 * @returns {Promise<void>} - (lineElement가 있을 경우) 재생이 완료/중지되면 resolve/reject되는 Promise
 */
export function playTTS(text, buttonElement = null, lineElement = null, speaker = null) {
    // Promise로 감싸서 비동기 재생 완료를 핸들링
    const playPromise = new Promise(async (resolve, reject) => {
        if (state.runTimeState.currentAudio) {
            // 다른 오디오가 재생 중이면 중지
            state.stopCurrentAudio();
            
            // 만약 '중지' 버튼으로 동일한 버튼을 누른 거라면, 여기서 재생을 멈추고 resolve
            if (state.runTimeState.currentPlayingButton === buttonElement) {
                state.runTimeState.currentPlayingButton = null;
                resolve();
                return;
            }
        }
        
        // 새 오디오 재생 시작
        state.runTimeState.currentPlayingButton = buttonElement;
        if(buttonElement) buttonElement.classList.add('is-playing');
        if(lineElement) lineElement.classList.add('is-playing');

        try {
            // [★ 수정] 캐시 키를 텍스트 + 화자로 구성 (목소리가 다를 수 있으므로)
            const cacheKey = `${speaker || 'default'}:${text}`;
            let audioData = state.audioCache[cacheKey];
            
            if (!audioData) {
                // [★ 수정] speaker 정보(Man/Woman)를 API로 전송
                const result = await callGeminiAPI('tts', { text, speaker });
                audioData = result.audioContent;
                state.audioCache[cacheKey] = audioData;
            }
            
            const audio = new Audio(`data:audio/mp3;base64,${audioData}`);
            state.runTimeState.currentAudio = audio;
            audio.play();
            
            // --- 오디오 이벤트 핸들러 ---
            
            audio.onended = () => {
                if(buttonElement) buttonElement.classList.remove('is-playing');
                if(lineElement) lineElement.classList.remove('is-playing');
                state.runTimeState.currentAudio = null;
                state.runTimeState.currentPlayingButton = null;
                resolve(); // 재생 완료
            };
            
            audio.onerror = (e) => {
                console.error('Audio playback error:', e);
                showAlert('오디오 재생 중 오류가 발생했습니다.');
                if(buttonElement) buttonElement.classList.remove('is-playing');
                if(lineElement) lineElement.classList.remove('is-playing');
                state.runTimeState.currentAudio = null;
                state.runTimeState.currentPlayingButton = null;
                reject(new Error('Audio playback error')); // 오류로 reject
            };

            // [★ 추가] stopCurrentAudio()에 의해 .pause()가 호출될 때
            audio.onpause = () => {
                 if(buttonElement) buttonElement.classList.remove('is-playing');
                 if(lineElement) lineElement.classList.remove('is-playing');
                 // currentAudio가 null이 된 것은 stopCurrentAudio()가 원인임
                 if (state.runTimeState.currentAudio === null) {
                    reject(new Error('Playback stopped')); // 중지로 reject
                 }
                 // (그 외의 이유로 pause되면 아무것도 하지 않음)
            };

        } catch (error) {
            console.error('TTS error:', error);
            showAlert(`음성(TTS)을 불러오는 데 실패했습니다: ${error.message}`);
            if(buttonElement) buttonElement.classList.remove('is-playing');
            if(lineElement) lineElement.classList.remove('is-playing');
            state.runTimeState.currentPlayingButton = null;
            reject(error); // TTS API 오류로 reject
        }
    });

    // lineElement가 제공되지 않은 경우 (일반 버튼 클릭) 
    // Promise를 반환하지 않고, 오류만 콘솔에 기록 (기존 방식)
    if (!lineElement) {
        playPromise.catch(error => {
            // "Playback stopped"는 사용자가 의도한 중지이므로 콘솔에 오류를 찍지 않음
            if (error && error.message !== 'Playback stopped') {
                console.error("TTS playback error (unhandled):", error);
            }
        });
        return; // undefined 반환
    }

    // lineElement가 제공된 경우 (전체 듣기) Promise 반환
    return playPromise;
}

// --- API를 호출하는 핸들러 함수들 ---

/**
 * 한국어 텍스트를 중국어로 번역 (API 호출)
 * @param {string} text - 번역할 한국어
 * @returns {Promise<object>} - Gemini API 응답
 */
export function translateText(text) {
    // [★ 수정] AI가 영어 설명 대신 정확한 JSON을 반환하도록 강력한 프롬프트 작성
    const systemPrompt = `You are a professional Chinese translator and tutor.
Your goal is to translate the user's Korean text into natural, conversational Chinese.

**CRITICAL INSTRUCTIONS:**
1. Output MUST be a single, valid JSON object. 
2. Do NOT include markdown backticks (like \`\`\`json). Just the raw JSON string.
3. Do NOT explain in English. Use Korean for explanations.

**JSON Structure:**
{
  "chinese": "Translated Chinese text (Simplified)",
  "pinyin": "Pinyin with tone marks",
  "alternatives": ["Alternative expression 1", "Alternative expression 2"],
  "explanation": "A brief grammar or nuance explanation in Korean",
  "usedPattern": "Name of the grammar pattern used (or null if none)"
}

**User Input (Korean):** "${text}"`;

    return callGeminiAPI('translate', { text, systemPrompt });
}

/**
 * [★ 수정] AI 채팅 응답 요청 (API 호출)
 * @param {string} text - 사용자 입력
 * @param {Array} history - 대화 기록
 * @param {string | null} roleContext - (선택) 롤플레잉 상황
 * @returns {Promise<object>} - Gemini API 응답
 */
export function getChatResponse(text, history, roleContext = null) {
    return callGeminiAPI('chat', { text, history, roleContext });
}

/**
 * 패턴으로 AI 채팅 시작 (API 호출)
 * @param {string} pattern - 시작할 패턴
 * @returns {Promise<object>} - Gemini API 응답
 */
export function startChatWithPattern(pattern) {
    return callGeminiAPI('start_chat_with_pattern', { pattern });
}

/**
 * [★ 새 기능] 롤플레잉 채팅 시작 (API 호출)
 * @param {string} context - 롤플레잉 상황 (e.g., 'restaurant')
 * @returns {Promise<object>} - Gemini API 응답
 */
export function startRoleplayChat(context) {
    return callGeminiAPI('start_roleplay_chat', { roleContext: context });
}

/**
 * AI 답변 추천 요청 (API 호출)
 * @param {Array} history - 대화 기록
 * @returns {Promise<object>} - Gemini API 응답
 */
export function getSuggestedReplies(history) {
    return callGeminiAPI('suggest_reply', { history });
}

/**
 * 새 연습문제 생성 (API 호출)
 * @param {string} pattern - 연습문제를 만들 패턴
 * @returns {Promise<object>} - Gemini API 응답
 */
export function getNewPractice(pattern) {
    return callGeminiAPI('generate_practice', { pattern });
}

/**
 * 중국어 작문 교정 (API 호출)
 * @param {string} text - 교정할 텍스트
 * @returns {Promise<object>} - Gemini API 응답
 */
export function correctWriting(text) {
    return callGeminiAPI('correct_writing', { text });
}

/**
 * 작문 주제 추천 (API 호출)
 * @returns {Promise<object>} - Gemini API 응답
 */
export function getWritingTopic() {
    return callGeminiAPI('get_writing_topic', {});
}

/**
 * 간체자 정보 요청 (API 호출)
 * @param {string} char - 정보를 요청할 글자
 * @returns {Promise<object>} - Gemini API 응답
 */
export function getCharacterInfo(char) {
    return callGeminiAPI('get_character_info', { text: char });
}

/**
 * 발음 평가 요청 (API 호출)
 * @param {string} original - 원본 텍스트
 * @param {string} user - 사용자가 말한 텍스트
 * @returns {Promise<object>} - Gemini API 응답
 */
export function evaluatePronunciation(original, user) {
    return callGeminiAPI('evaluate_pronunciation', { originalText: original, userText: user });
}

// --- [★ 새로 추가] 듣기 학습 API 함수 ---

/**
 * '오늘의 대화' 스크립트 요청 (API 호출)
 * @param {string} pattern1 - 오늘 사용된 패턴 1
 * @param {string} pattern2 - 오늘 사용된 패턴 2
 * @returns {Promise<object>} - Gemini API 응답
 */
export function getTodayConversationScript(pattern1, pattern2) {
    return callGeminiAPI('generate_today_conversation', { pattern1, pattern2 });
}

/**
 * '상황별 듣기' 스크립트 요청 (API 호출)
 * @param {string} scenario - 듣기 시나리오 (e.g., 'restaurant')
 * @returns {Promise<object>} - Gemini API 응답
 */
export function getSituationalListeningScript(scenario) {
    return callGeminiAPI('generate_situational_listening', { scenario });
}