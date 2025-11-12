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
 * 텍스트를 음성(TTS)으로 재생합니다.
 * (수정: state.currentAudio -> state.runTimeState.currentAudio)
 * @param {string} text - 재생할 텍스트
 * @param {HTMLElement} buttonElement - 클릭된 TTS 버튼
 */
export async function playTTS(text, buttonElement) {
    // (수정) state.runTimeState 객체의 속성으로 접근
    if (state.runTimeState.currentAudio) {
        state.runTimeState.currentAudio.pause();
        state.runTimeState.currentAudio = null;
        if (state.runTimeState.currentPlayingButton) {
            state.runTimeState.currentPlayingButton.classList.remove('is-playing');
        }
        if (state.runTimeState.currentPlayingButton === buttonElement) {
            state.runTimeState.currentPlayingButton = null;
            return;
        }
    }
    
    state.runTimeState.currentPlayingButton = buttonElement; // (수정)
    if(buttonElement) buttonElement.classList.add('is-playing');

    try {
        let audioData = state.audioCache[text];
        if (!audioData) {
            const result = await callGeminiAPI('tts', { text });
            audioData = result.audioContent;
            state.audioCache[text] = audioData;
        }
        
        const audio = new Audio(`data:audio/mp3;base64,${audioData}`);
        state.runTimeState.currentAudio = audio; // (수정)
        audio.play();
        
        audio.onended = () => {
            if(buttonElement) buttonElement.classList.remove('is-playing');
            state.runTimeState.currentAudio = null; // (수정)
            state.runTimeState.currentPlayingButton = null; // (수정)
        };
        
        audio.onerror = (e) => {
            console.error('Audio playback error:', e);
            showAlert('오디오 재생 중 오류가 발생했습니다.');
            if(buttonElement) buttonElement.classList.remove('is-playing');
            state.runTimeState.currentAudio = null; // (수정)
            state.runTimeState.currentPlayingButton = null; // (수정)
        };
    } catch (error) {
        console.error('TTS error:', error);
        showAlert(`음성(TTS)을 불러오는 데 실패했습니다: ${error.message}`);
        if(buttonElement) buttonElement.classList.remove('is-playing');
        state.runTimeState.currentPlayingButton = null; // (수정)
    }
}

// --- API를 호출하는 핸들러 함수들 ---

/**
 * 한국어 텍스트를 중국어로 번역 (API 호출)
 * @param {string} text - 번역할 한국어
 * @returns {Promise<object>} - Gemini API 응답
 */
export function translateText(text) {
    const patternList = state.allPatterns.map(p => p.pattern).join(", ");
    const systemPrompt = `You are a professional Korean-to-Chinese translator and language teacher. Translate the following Korean sentence into natural, native-sounding Chinese. Provide: 1. The main Chinese translation. 2. The pinyin for the main translation. 3. (Optional) 1-2 alternative natural expressions if applicable. 4. A concise explanation (in Korean) of why this expression is natural, what the key vocabulary or grammar point is.
Format your response as a single, valid JSON object with keys "chinese", "pinyin", "alternatives" (string array), "explanation" (string, in Korean), and "usedPattern" (string or null).
Do not include markdown backticks.
IMPORTANT: After translating, analyze your Chinese translation. If it uses one of the following patterns: [${patternList}], set the "usedPattern" key to the matching pattern string. If no pattern matches, set "usedPattern" to null.`;
    
    return callGeminiAPI('translate', { text, systemPrompt });
}

/**
 * AI 채팅 응답 요청 (API 호출)
 * @param {string} text - 사용자 입력
 * @param {Array} history - 대화 기록
 * @returns {Promise<object>} - Gemini API 응답
 */
export function getChatResponse(text, history) {
    return callGeminiAPI('chat', { text, history });
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