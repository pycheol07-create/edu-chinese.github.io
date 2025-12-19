// js/events/chatEvents.js
import * as dom from '../dom.js';
import * as handlers from '../handlers.js';
import * as speech from '../speech.js';
import * as state from '../state.js';
import * as api from '../api.js';

export function setupChatEvents() {
    // --- AI 채팅 모달 ---
    dom.closeChatBtn.addEventListener('click', () => {
        dom.chatModal.classList.add('hidden');
        speech.stopRecognition();
        state.stopCurrentAudio();
    });
    
    dom.sendChatBtn.addEventListener('click', handlers.handleSendMessage);
    
    dom.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handlers.handleSendMessage();
        }
    });
    
    // 채팅 기록 내 클릭 이벤트 (TTS, 따라하기, 추천 답변)
    dom.chatHistory.addEventListener('click', (e) => {
        const ttsButton = e.target.closest('.tts-btn');
        if (ttsButton) {
            const textToSpeak = ttsButton.dataset.text;
            if (textToSpeak) api.playTTS(textToSpeak, ttsButton, null, null);
            return;
        }
        const followSpeakButton = e.target.closest('.follow-speak-btn');
        if (followSpeakButton) {
            const originalText = followSpeakButton.dataset.text;
            if (originalText) {
                speech.toggleRecognition(followSpeakButton, { originalText: originalText });
            }
            return;
        }
        const suggestionChip = e.target.closest('.suggestion-chip');
        if (suggestionChip) {
            dom.chatInput.value = suggestionChip.dataset.text;
            dom.chatInput.focus();
            suggestionChip.closest('div.flex.justify-center').remove();
            return;
        }
    });
    
    dom.micBtn.addEventListener('click', () => {
        speech.toggleRecognition(dom.micBtn, { targetInput: dom.chatInput });
    });
    
    dom.suggestReplyBtn.addEventListener('click', handlers.handleSuggestReply);

    // --- 롤플레잉 모달 ---
    dom.openRoleplayBtn.addEventListener('click', () => {
        dom.roleplayModal.classList.remove('hidden');
        if (dom.fabContainer) dom.fabContainer.classList.remove('is-open');
    });
    
    dom.closeRoleplayBtn.addEventListener('click', () => {
        dom.roleplayModal.classList.add('hidden');
    });
    
    dom.roleplayScenarioList.addEventListener('click', (e) => {
        const scenarioButton = e.target.closest('[data-scenario]');
        if (scenarioButton) {
            const context = scenarioButton.dataset.scenario;
            dom.roleplayModal.classList.add('hidden');
            handlers.handleStartRoleplay(context);
        }
    });
}