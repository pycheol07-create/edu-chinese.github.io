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
 * @param {string} text - 재생할 텍스트
 * @param {HTMLElement} buttonElement - 클릭된 TTS 버튼
 */
export async function playTTS(text, buttonElement) {
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
    
    state.runTimeState.currentPlayingButton = buttonElement;
    if(buttonElement) buttonElement.classList.add('is-playing');

    try {
        let audioData = state.audioCache[text];
        if (!audioData) {
            const result = await callGeminiAPI('tts', { text });
            audioData = result.audioContent;
            state.audioCache[text] = audioData;
        }
        
        const audio = new Audio(`data:audio/mp3;base64,${audioData}`);
        state.runTimeState.currentAudio = audio;
        audio.play();
        
        audio.onended = () => {
            if(buttonElement) buttonElement.classList.remove('is-playing');
            state.runTimeState.currentAudio = null;
            state.runTimeState.currentPlayingButton = null;
        };
        
        audio.onerror = (e) => {
            console.error('Audio playback error:', e);
            showAlert('오디오 재생 중 오류가 발생했습니다.');
            if(buttonElement) buttonElement.classList.remove('is-playing');
            state.runTimeState.currentAudio = null;
            state.runTimeState.currentPlayingButton = null;
        };
    } catch (error) {
        console.error('TTS error:', error);
        showAlert(`음성(TTS)을 불러오는 데 실패했습니다: ${error.message}`);
        if(buttonElement) buttonElement.classList.remove('is-playing');
        state.runTimeState.currentPlayingButton = null;
    }
}

// [★ 새 기능] 오디오를 순차적으로 재생하기 위한 헬퍼
function playAudioPromise(audioData) {
    return new Promise((resolve, reject) => {
        const audio = new Audio(`data:audio/mp3;base64,${audioData}`);
        // [수정] state.runTimeState.currentAudio에 현재 오디오를 할당해야
        // 다른 버튼 클릭 시 즉시 중지 가능
        state.runTimeState.currentAudio = audio; 
        audio.play();
        audio.onended = resolve;
        audio.onerror = reject;
    });
}

/**
 * [★ 새 기능] 여러 텍스트를 순차적으로 TTS 재생합니다 (전체 대본 듣기용).
 * @param {string[]} texts - 재생할 텍스트 배열
 * @param {HTMLElement} buttonElement - '전체 듣기' 버튼
 */
export async function playTTSequentially(texts = [], buttonElement) {
    // 다른 오디오가 재생 중이거나, 현재 버튼이 이미 재생 중(다시 클릭)
    if (state.runTimeState.currentAudio) {
        const wasPlaying = (state.runTimeState.currentPlayingButton === buttonElement);
        state.stopCurrentAudio(); // 모든 오디오 중지
        if (wasPlaying) return; // 재생 중지 (토글 끔)
    }

    state.runTimeState.currentPlayingButton = buttonElement;
    if (buttonElement) buttonElement.classList.add('is-playing');

    try {
        for (const text of texts) {
            // [수정] 현재 버튼이 is-playing이 아니게 되었다면 (사용자가 중지)
            if (!state.runTimeState.currentPlayingButton || !buttonElement.classList.contains('is-playing')) {
                 console.log("Sequential play stopped by user.");
                 state.stopCurrentAudio(); // 혹시 모를 오디오 정리
                 break;
            }
            
            let audioData = state.audioCache[text];
            if (!audioData) {
                const result = await callGeminiAPI('tts', { text });
                audioData = result.audioContent;
                state.audioCache[text] = audioData;
            }
            await playAudioPromise(audioData);
        }
    } catch (error) {
        console.error('Sequential TTS error:', error);
        showAlert('순차 재생 중 오류가 발생했습니다.');
    } finally {
        if (buttonElement) buttonElement.classList.remove('is-playing');
        state.runTimeState.currentPlayingButton = null;
        state.runTimeState.currentAudio = null; // 마지막 오디오 클리어
    }
}


// --- API를 호출하는 핸들러 함수들 ---

/**
 * 한국어 텍스트를 중국어로 번역 (API 호출)
 */
export function translateText(text) {
    const patternList = state.allPatterns.map(p => p.pattern).join(", ");
    const systemPrompt = `... (생략) ...`; // 기존 프롬프트
    return callGeminiAPI('translate', { text, systemPrompt });
}

/**
 * AI 채팅 응답 요청 (API 호출)
 */
export function getChatResponse(text, history, roleContext = null) {
    return callGeminiAPI('chat', { text, history, roleContext });
}

/**
 * 패턴으로 AI 채팅 시작 (API 호출)
 */
export function startChatWithPattern(pattern) {
    return callGeminiAPI('start_chat_with_pattern', { pattern });
}

/**
 * 롤플레잉 채팅 시작 (API 호출)
 */
export function startRoleplayChat(context) {
    return callGeminiAPI('start_roleplay_chat', { roleContext: context });
}

/**
 * [★ 새 기능] 듣기 대본 생성 (API 호출)
 * @param {string} context - 듣기 상황 (e.g., 'restaurant')
 * @returns {Promise<object>} - Gemini API 응답
 */
export function getListeningScript(context) {
    return callGeminiAPI('generate_listening_script', { roleContext: context });
}

/**
 * AI 답변 추천 요청 (API 호출)
 */
export function getSuggestedReplies(history) {
    // [수정] 'system' role 필터링은 handlers.js에서 처리
    return callGeminiAPI('suggest_reply', { history });
}

/**
 * 새 연습문제 생성 (API 호출)
 */
export function getNewPractice(pattern) {
    return callGeminiAPI('generate_practice', { pattern });
}

/**
 * 중국어 작문 교정 (API 호출)
 */
export function correctWriting(text) {
    return callGeminiAPI('correct_writing', { text });
}

/**
 * 작문 주제 추천 (API 호출)
 */
export function getWritingTopic() {
    return callGeminiAPI('get_writing_topic', {});
}

/**
 * 간체자 정보 요청 (API 호출)
 */
export function getCharacterInfo(char) {
    return callGeminiAPI('get_character_info', { text: char });
}

/**
 * 발음 평가 요청 (API 호출)
 */
export function evaluatePronunciation(original, user) {
    return callGeminiAPI('evaluate_pronunciation', { originalText: original, userText: user });
}