// js/speech.js
import * as dom from './dom.js';
import { showAlert } from './ui.js';

let recognition = null;
let isRecognizing = false;
let currentRecognitionTargetInput = null;
let currentRecognitionMicButton = null;

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

        recognition.onresult = (event) => {
            console.log("Speech Recognition Result:", event.results);
            const speechResult = event.results[0][0].transcript;
            console.log("Recognized Text:", speechResult);

            const targetInput = currentRecognitionTargetInput;

            if (targetInput) {
                targetInput.value = speechResult;

                // 인식된 후 자동으로 제출하는 로직
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
            } else {
                console.warn("Recognition result received but no target input was set.");
                if (dom.chatInput) dom.chatInput.value = speechResult;
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

         recognition.onend = () => {
            console.log("Speech Recognition: Service ended.");
            if (currentRecognitionMicButton) {
                currentRecognitionMicButton.classList.remove('is-recording');
            }
            isRecognizing = false;
            currentRecognitionTargetInput = null;
            currentRecognitionMicButton = null;
        };

        console.log("Speech Recognition initialized for zh-CN.");

    } else {
        console.warn('Web Speech API is not supported in this browser.');
        showAlert('현재 브라우저에서는 음성 인식을 지원하지 않습니다.');
        // main.js에서 DOM 초기화 후 이 버튼들을 비활성화 처리
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
 * 오류를 처리하며 음성 인식을 시작합니다.
 * @param {HTMLElement} button - 클릭된 마이크 버튼
 * @param {HTMLElement} targetInput - 음성 인식 결과를 입력할 input 요소
 */
function startRecognition(button, targetInput) {
     try {
        console.log("Starting recognition...");
        currentRecognitionTargetInput = targetInput;
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
         }
    }
}

/**
 * 마이크 버튼 클릭 이벤트를 처리합니다.
 * @param {HTMLElement} button - 클릭된 마이크 버튼
 * @param {HTMLElement} targetInput - 타겟 input
 */
export function handleMicClick(button, targetInput) {
    if (!recognition) {
         showAlert('음성 인식이 지원되지 않거나 초기화되지 않았습니다.');
         console.log("Recognition not available or not initialized.");
        return;
    }
    
    if (isRecognizing && currentRecognitionMicButton !== button) {
         // 다른 마이크가 활성화된 경우: 기존 것 중지 후 새것 시작
         console.log("Stopping ongoing recognition initiated by another mic...");
         recognition.stop();
         // 짧은 지연 후 새 인식 시작
         setTimeout(() => startRecognition(button, targetInput), 300);
    } else if (isRecognizing) {
        // 현재 활성화된 마이크를 다시 클릭한 경우: 중지
        console.log("Stopping recognition...");
        recognition.stop();
    } else {
        // 비활성화 상태에서 클릭한 경우: 시작
         startRecognition(button, targetInput);
    }
}