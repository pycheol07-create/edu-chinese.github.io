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
        dom.listeningScriptDisplay.innerHTML = '<p class="text-gray-400 text-center">듣고 싶은 주제를 선택하세요.</p>';
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
}