// js/api.js
import * as state from './state.js';
import { showAlert } from './ui.js';
import * as db from './db.js'; // DB 모듈 (TTS 캐싱용)

// [최적화 1] 딜레이 함수 (재시도 대기용)
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * [최적화 2] Gemini API 호출 (재시도 & 타임아웃 로직 적용)
 * @param {string} action - API 엔드포인트 작업
 * @param {object} body - 데이터
 * @param {number} retries - 남은 재시도 횟수 (기본 2회)
 * @returns {Promise<object>}
 */
async function callGeminiAPI(action, body, retries = 2) {
    const TIMEOUT_MS = 25000; // 25초 타임아웃 설정
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ...body }),
            signal: controller.signal // 타임아웃 신호 연결
        });

        clearTimeout(timeoutId); // 성공 시 타임아웃 해제

        if (!response.ok) {
            // 500번대 서버 에러나 429(Too Many Requests)는 재시도 가치 있음
            if ((response.status >= 500 || response.status === 429) && retries > 0) {
                console.warn(`API call failed (${response.status}). Retrying... (${retries} left)`);
                await wait(1500); // 1.5초 대기 후 재시도
                return callGeminiAPI(action, body, retries - 1);
            }
            
            const errorData = await response.json();
            throw new Error(errorData.error || `API ${action} failed`);
        }
        return await response.json();

    } catch (error) {
        clearTimeout(timeoutId);
        
        // 타임아웃 에러 처리
        if (error.name === 'AbortError') {
             if (retries > 0) {
                console.warn(`API call timed out. Retrying... (${retries} left)`);
                return callGeminiAPI(action, body, retries - 1);
             }
             throw new Error("AI 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.");
        }

        // 네트워크 에러 등 재시도
        if (retries > 0) {
             console.warn(`Network error: ${error.message}. Retrying... (${retries} left)`);
             await wait(1500);
             return callGeminiAPI(action, body, retries - 1);
        }
        throw error;
    }
}

/**
 * 텍스트를 음성(TTS)으로 재생 (IndexedDB 캐싱 적용됨)
 * @param {string} text - 재생할 텍스트
 * @param {HTMLElement | null} buttonElement - (선택) 클릭된 TTS 버튼
 * @param {HTMLElement | null} lineElement - (선택) 하이라이트할 대화 라인 요소
 * @param {string | null} speaker - (선택) 'Man' or 'Woman', 목소리 구분을 위함
 */
export function playTTS(text, buttonElement = null, lineElement = null, speaker = null) {
    const playPromise = new Promise(async (resolve, reject) => {
        // 1. 기존 오디오 중지 로직
        if (state.runTimeState.currentAudio) {
            state.stopCurrentAudio();
            // 만약 '중지' 버튼으로 동일한 버튼을 누른 거라면, 여기서 멈춤
            if (state.runTimeState.currentPlayingButton === buttonElement) {
                state.runTimeState.currentPlayingButton = null;
                resolve();
                return;
            }
        }
        
        // 새 오디오 재생 시작 상태 설정
        state.runTimeState.currentPlayingButton = buttonElement;
        if(buttonElement) buttonElement.classList.add('is-playing');
        if(lineElement) lineElement.classList.add('is-playing');

        // UI 정리 헬퍼 함수
        function cleanupUI() {
            if(buttonElement) buttonElement.classList.remove('is-playing');
            if(lineElement) lineElement.classList.remove('is-playing');
            state.runTimeState.currentAudio = null;
            state.runTimeState.currentPlayingButton = null;
        }

        try {
            const cacheKey = `${speaker || 'default'}:${text}`;
            
            // 1단계: 메모리 캐시 확인
            let audioData = state.audioCache[cacheKey];
            
            // 2단계: DB 캐시 확인
            if (!audioData) {
                audioData = await db.getAudioFromDB(cacheKey);
                if (audioData) {
                    state.audioCache[cacheKey] = audioData;
                }
            }
            
            // 3단계: API 호출 (TTS는 반응 속도가 중요하므로 재시도 1회만)
            if (!audioData) {
                const result = await callGeminiAPI('tts', { text, speaker }, 1);
                audioData = result.audioContent;
                // 캐시 저장
                state.audioCache[cacheKey] = audioData;
                db.saveAudioToDB(cacheKey, audioData);
            }
            
            // 오디오 재생
            const audio = new Audio(`data:audio/mp3;base64,${audioData}`);
            state.runTimeState.currentAudio = audio;
            audio.play();
            
            // 이벤트 핸들러
            audio.onended = () => {
                cleanupUI();
                resolve();
            };
            
            audio.onerror = (e) => {
                cleanupUI();
                reject(new Error('Audio playback error'));
            };

            audio.onpause = () => {
                 cleanupUI();
                 // 사용자가 멈춘 게 아니라 시스템적으로(stopCurrentAudio) 멈췄을 때
                 if (state.runTimeState.currentAudio === null) {
                    reject(new Error('Playback stopped'));
                 }
            };

        } catch (error) {
            console.error('TTS error:', error);
            showAlert(`음성 재생 실패: ${error.message}`);
            cleanupUI();
            reject(error);
        }
    });

    // lineElement가 없으면(단순 버튼 클릭) 에러 로그만 남기고 종료
    if (!lineElement) {
        playPromise.catch(error => {
            if (error && error.message !== 'Playback stopped') {
                console.error("TTS playback error (unhandled):", error);
            }
        });
        return;
    }

    // 전체 듣기 기능 등을 위해 Promise 반환
    return playPromise;
}

// --- API 핸들러 함수들 (프롬프트 최적화 적용) ---

/**
 * [최적화 3] 한국어 텍스트를 중국어로 번역
 * - 프롬프트 길이를 줄이고 JSON 포맷 규칙을 강화하여 속도와 정확성 향상
 */
export function translateText(text) {
    const systemPrompt = `You are a Chinese translator.
Translate Korean to natural conversational Chinese.

**RULES:**
1. Response MUST be valid JSON. No markdown.
2. Keys: "chinese", "pinyin", "alternatives"(array), "explanation"(Korean), "usedPattern"(Korean or null).
3. Be concise and natural.

**User:** "${text}"`;

    return callGeminiAPI('translate', { text, systemPrompt });
}

/**
 * AI 채팅 응답 요청
 */
export function getChatResponse(text, history, roleContext = null) {
    return callGeminiAPI('chat', { text, history, roleContext });
}

/**
 * 패턴으로 AI 채팅 시작
 */
export function startChatWithPattern(pattern) {
    return callGeminiAPI('start_chat_with_pattern', { pattern });
}

/**
 * 롤플레잉 채팅 시작
 */
export function startRoleplayChat(context) {
    return callGeminiAPI('start_roleplay_chat', { roleContext: context });
}

/**
 * AI 답변 추천 요청
 */
export function getSuggestedReplies(history) {
    return callGeminiAPI('suggest_reply', { history });
}

/**
 * [최적화 3] 새 연습문제 생성
 * - 불필요한 설명을 줄이고 문제 생성에 집중하도록 유도
 */
export function getNewPractice(pattern) {
    return callGeminiAPI('generate_practice', { pattern });
}

/**
 * 중국어 작문 교정
 */
export function correctWriting(text) {
    return callGeminiAPI('correct_writing', { text });
}

/**
 * 작문 주제 추천
 */
export function getWritingTopic() {
    return callGeminiAPI('get_writing_topic', {});
}

/**
 * 간체자 정보 요청
 */
export function getCharacterInfo(char) {
    return callGeminiAPI('get_character_info', { text: char });
}

/**
 * 발음 평가 요청
 */
export function evaluatePronunciation(original, user) {
    return callGeminiAPI('evaluate_pronunciation', { originalText: original, userText: user });
}

/**
 * '오늘의 대화' 스크립트 요청
 */
export function getTodayConversationScript(pattern1, pattern2) {
    return callGeminiAPI('generate_today_conversation', { pattern1, pattern2 });
}

/**
 * '상황별 듣기' 스크립트 요청
 */
export function getSituationalListeningScript(scenario) {
    return callGeminiAPI('generate_situational_listening', { scenario });
}