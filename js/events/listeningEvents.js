// js/events/listeningEvents.js
import * as dom from '../dom.js';
import * as handlers from '../handlers.js';
import * as state from '../state.js';
import * as api from '../api.js';

export function setupListeningEvents() {
    dom.openListeningBtn.addEventListener('click', () => {
        dom.listeningModal.classList.remove('hidden');
        if (dom.fabContainer) dom.fabContainer.classList.remove('is-open');
    });

    dom.closeListeningBtn.addEventListener('click', () => {
        dom.listeningModal.classList.add('hidden');
        state.stopCurrentAudio();
        
        // 모달 닫을 때 UI 초기화
        dom.listeningModal.classList.remove('is-fullscreen');
        dom.listeningControls.classList.remove('hidden');
        
        // [수정] 닫을 때 텍스트를 초기화하지만, '듣고 싶은 주제를 선택하세요' 문구는 넣지 않음 (빈 상태 유지)
        dom.listeningScriptDisplay.innerHTML = '';
        dom.listeningPlaybackControls.classList.add('hidden');
    });

    // 시나리오 선택
    dom.listeningScenarioList.addEventListener('click', (e) => {
        const button = e.target.closest('button[data-scenario]');
        if (button) {
            const scenario = button.dataset.scenario;
            if (scenario === 'today_conversation') {
                handlers.handleTodayConversationRequest(); 
            } else {
                handlers.handleSituationalListeningRequest(scenario); 
            }
        }
    });

    // 전체 듣기 버튼
    dom.playAllScriptBtn.addEventListener('click', handlers.handlePlayAllListeningScript); 

    // 개별 문장 듣기 (이벤트 위임)
    dom.listeningScriptDisplay.addEventListener('click', (e) => {
        const ttsButton = e.target.closest('.tts-btn');
        if (ttsButton) {
            const lineElement = ttsButton.closest('.listening-line');
            const textToSpeak = lineElement?.dataset.text;
            const speaker = lineElement?.dataset.speaker || null;
            
            if (textToSpeak) {
                api.playTTS(textToSpeak, ttsButton, lineElement, speaker);
            }
        }
    });

    // [새로 추가] 커스텀 듣기 생성 이벤트
    const startCustomListeningBtn = document.getElementById('start-custom-listening-btn');
    const customListeningInput = document.getElementById('custom-listening-input');
    
    if (startCustomListeningBtn && customListeningInput) {
        customListeningInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') startCustomListeningBtn.click();
        });

        startCustomListeningBtn.addEventListener('click', () => {
            const scenario = customListeningInput.value.trim();
            if (!scenario) {
                alert('원하는 상황을 입력해주세요!');
                return;
            }
            // 기존 시나리오 요청 함수 재사용 (문자열 그대로 전달)
            handlers.handleSituationalListeningRequest(scenario);
            customListeningInput.value = '';
        });
    }
}