// js/speech.js
import * as dom from './dom.js';
import { showAlert } from './ui.js';
import * as api from './api.js'; // [★] 평가를 위해 api 모듈 import

let recognition = null;
let isRecognizing = false;
let currentRecognitionTargetInput = null;
let currentRecognitionMicButton = null;
let currentEvaluationText = null; // [★] 평가할 원본 텍스트 저장용

/**
 * [★] API로부터 받은 발음 평가 결과를 처리합니다.
 * @param {string} original - 원본 텍스트
 * @param {string} user - 사용자 발음 텍스트
 */
async function handlePronunciationResult(original, user) {
    console.log(`Sending to API for evaluation: Original: "${original}", User said: "${user}"`);
    try {
        // 1. API 호출
        const result = await api.evaluatePronunciation(original, user);
        
        // 2. 결과 파싱
        let evalData;
        if (result.candidates && result.candidates[0]?.content?.parts?.[0]) {
            const evalText = result.candidates[0].content.parts[0].text.trim().replace(/^```json\s*|\s*```$/g, '');
            evalData = JSON.parse(evalText);
        } else {
            throw new Error("Invalid API response structure.");
        }

        // 3. 피드백 표시
        if (evalData && evalData.feedback) {
            // is_correct 값에 따라 아이콘 추가
            const icon = evalData.is_correct ? "🎉" : "🤔";
            showAlert(`${icon} ${evalData.feedback}`);
        } else {
            throw new Error("API response missing 'feedback' key.");
        }
        
    } catch (error) {
        console.error("Pronunciation evaluation error:", error);
        showAlert(`평가 중 오류가 발생했습니다: ${error.message}`);
    }
}

/**
 * Web Speech API를 초기화합니다.
 */
export function initializeSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.lang = 'zh-CN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        // [★ 수정] onresult 로직 변경
        recognition.onresult = (event) => {
            console.log("Speech Recognition Result:", event.results);
            const speechResult = event.results[0][0].transcript;
            console.log("Recognized Text:", speechResult);

            const targetInput = currentRecognitionTargetInput;
            const evalText = currentEvaluationText;

            if (targetInput) {
                // --- 모드 1: INPUT (기존 로직) ---
                console.log("Mode: Input");
                targetInput.value = speechResult;
                setTimeout(() => {
                    if (targetInput === dom.chatInput) {
                        console.log("Auto-submitting chat message...");
                        if (dom.sendChatBtn) dom.sendChatBtn.click();
                    } else if (targetInput.id.startsWith('practice-input-')) {
                        console.log("Auto-submitting practice answer...");
                        const index = targetInput.id.split('-').pop();
                        const checkButton = document.getElementById(`check-practice-btn-${index}`);
                        if (checkButton && checkButton.style.display !== 'none') {
                           checkButton.click();
                        } else {
                            console.warn("Auto-submit skipped: Check button not found or not visible for", targetInput.id);
                        }
                    }
                }, 150);
            } else if (evalText) {
                // --- 모드 2: EVALUATION (새 로직) ---
                console.log("Mode: Evaluation");
                handlePronunciationResult(evalText, speechResult);
            } else {
                 console.warn("Recognition result received but no target (Input or Evaluation) was set.");
            }
        };

        recognition.onspeechend = () => {
            console.log("Speech Recognition: Speech has stopped being detected.");
        };

        recognition.onnomatch = () => {
            console.log("Speech Recognition: No match found.");
            showAlert('음성을 인식하지 못했습니다. 다시 시도해주세요.');
        };

        recognition.onerror = (event) => {
            console.error("Speech Recognition Error:", event.error, event.message);
            if (event.error !== 'no-speech' && event.error !== 'aborted' && event.error !== 'not-allowed') {
                 showAlert(`음성 인식 오류: ${event.error}. 마이크 권한을 확인하세요.`);
            } else if (event.error === 'not-allowed') {
                 showAlert('마이크 사용 권한이 거부되었습니다. 브라우저 설정을 확인해주세요.');
            }
        };

         // [★ 수정] onend 로직 변경
         recognition.onend = () => {
            console.log("Speech Recognition: Service ended.");
            if (currentRecognitionMicButton) {
                currentRecognitionMicButton.classList.remove('is-recording');
            }
            isRecognizing = false;
            currentRecognitionTargetInput = null;
            currentRecognitionMicButton = null;
            currentEvaluationText = null; // [★] 평가 텍스트 초기화
        };

        console.log("Speech Recognition initialized for zh-CN.");

    } else {
        console.warn('Web Speech API is not supported in this browser.');
        showAlert('현재 브라우저에서는 음성 인식을 지원하지 않습니다.');
    }
}

/**
 * 음성 인식을 중지합니다.
 */
export function stopRecognition() {
    if (recognition && isRecognizing) {
        console.log("Stopping recognition...");
        recognition.stop();
    }
}

/**
 * [★] 오류를 처리하며 음성 인식을 시작합니다.
 * @param {HTMLElement} button - 클릭된 마이크 버튼
 * @param {HTMLElement} targetInput - (Input 모드) 결과를 입력할 input 요소
 * @param {string} originalText - (Eval 모드) 평가할 원본 텍스트
 */
function startRecognition(button, targetInput, originalText) {
     try {
        console.log("Starting recognition...");
        currentRecognitionTargetInput = targetInput;
        currentEvaluationText = originalText;
        currentRecognitionMicButton = button;
        recognition.start();
        button.classList.add('is-recording');
        isRecognizing = true;
    } catch(e) {
         console.error("Speech recognition start error:", e);
         if (e.name === 'NotAllowedError' || e.name === 'SecurityError') {
             showAlert("마이크 권한이 필요합니다. 브라우저 설정에서 허용해주세요.");
         }
         else if (e.name === 'InvalidStateError') {
             console.warn("Attempted to start recognition while already active. Ignoring.");
         }
         else {
             showAlert("음성 인식을 시작할 수 없습니다. 잠시 후 다시 시도해주세요.");
         }
         
         if(button) button.classList.remove('is-recording');
         
         if (e.name !== 'InvalidStateError') {
             isRecognizing = false;
             currentRecognitionTargetInput = null;
             currentRecognitionMicButton = null;
             currentEvaluationText = null; // [★] 초기화
         }
    }
}

/**
 * [★] 마이크 버튼 클릭 이벤트를 토글 방식으로 처리합니다.
 * @param {HTMLElement} button - 클릭된 마이크 버튼
 * @param {object} options - { targetInput: HTMLElement | null, originalText: string | null }
 */
export function toggleRecognition(button, { targetInput = null, originalText = null }) {
    if (!recognition) {
         showAlert('음성 인식이 지원되지 않거나 초기화되지 않았습니다.');
         console.log("Recognition not available or not initialized.");
        return;
    }
    
    if (isRecognizing) {
        // 인식이 진행 중일 때
        recognition.stop();
        
        // 만약 다른 버튼을 누른 거라면, 잠시 후 새 인식을 시작
        if (currentRecognitionMicButton !== button) {
             setTimeout(() => startRecognition(button, targetInput, originalText), 300);
        }
    } else {
        // 인식이 꺼져있을 때 -> 새 인식 시작
         startRecognition(button, targetInput, originalText);
    }
}