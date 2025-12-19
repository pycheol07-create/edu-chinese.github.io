// js/events/toolEvents.js
import * as dom from '../dom.js';
import * as handlers from '../handlers.js';
import * as state from '../state.js';
import * as api from '../api.js';
import * as ui from '../ui.js';
import * as features from '../features.js';

export function setupToolEvents() {
    // --- 번역기 ---
    dom.openTranslatorBtn.addEventListener('click', () => {
        dom.translatorModal.classList.remove('hidden');
        if (dom.fabContainer) dom.fabContainer.classList.remove('is-open');
    });
    dom.closeTranslatorBtn.addEventListener('click', () => {
        dom.translatorModal.classList.add('hidden');
        state.stopCurrentAudio();
    });
    dom.translateBtn.addEventListener('click', handlers.handleTranslation);
    dom.koreanInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handlers.handleTranslation();
        }
    });
    dom.translationResult.addEventListener('click', (e) => {
        const ttsButton = e.target.closest('.tts-btn');
        if (ttsButton && ttsButton.dataset.text) {
             api.playTTS(ttsButton.dataset.text, ttsButton, null, null);
        }
    });

    // --- 작문 교정 ---
    dom.openCorrectionBtn.addEventListener('click', () => {
        dom.correctionModal.classList.remove('hidden');
        if (dom.fabContainer) dom.fabContainer.classList.remove('is-open');
    });
    dom.closeCorrectionBtn.addEventListener('click', () => {
        dom.correctionModal.classList.add('hidden');
        state.stopCurrentAudio();
    });
    dom.correctWritingBtn.addEventListener('click', handlers.handleCorrectWriting);
    dom.getTopicBtn.addEventListener('click', handlers.handleGetWritingTopic);
    dom.correctionResult.addEventListener('click', (e) => {
        const ttsButton = e.target.closest('.tts-btn');
        if (ttsButton && ttsButton.dataset.text) {
             api.playTTS(ttsButton.dataset.text, ttsButton, null, null);
        }
    });
    
    // --- 교정 노트 (히스토리) ---
    dom.openCorrectionHistoryBtn.addEventListener('click', () => {
        ui.renderCorrectionHistory();
        dom.correctionHistoryModal.classList.remove('hidden');
    });
    dom.closeCorrectionHistoryBtn.addEventListener('click', () => {
        dom.correctionHistoryModal.classList.add('hidden');
    });
    dom.clearCorrectionHistoryBtn.addEventListener('click', () => {
        if (confirm('정말로 모든 교정 기록을 삭제하시겠습니까?')) {
            state.correctionHistory.length = 0;
            state.saveCorrectionHistory();
            ui.renderCorrectionHistory();
        }
    });
    dom.correctionHistoryList.addEventListener('click', (e) => {
        const ttsButton = e.target.closest('.tts-btn');
        if (ttsButton && ttsButton.dataset.text) {
             api.playTTS(ttsButton.dataset.text, ttsButton, null, null);
        }
    });

    // --- 단어 학습 ---
    dom.openWordBtn.addEventListener('click', () => {
        dom.wordModal.classList.remove('hidden');
        if (dom.fabContainer) dom.fabContainer.classList.remove('is-open');
        features.showNextWord();
    });
    dom.closeWordBtn.addEventListener('click', () => {
        dom.wordModal.classList.add('hidden');
        state.stopCurrentAudio();
    });
    dom.wordFlashcard.addEventListener('click', () => {
        dom.wordFlashcard.classList.toggle('is-flipped');
    });
    dom.showWordAnswerBtn.addEventListener('click', () => {
        dom.wordFlashcard.classList.add('is-flipped');
    });
    dom.nextWordBtn.addEventListener('click', features.showNextWord);
    dom.wordTtsBtn.addEventListener('click', (e) => {
        const text = e.currentTarget.dataset.text;
        if (text) api.playTTS(text, e.currentTarget, null, null);
    });

    // --- 간체자 학습 ---
    dom.openCharBtn.addEventListener('click', () => {
        dom.charModal.classList.remove('hidden');
        if (dom.fabContainer) dom.fabContainer.classList.remove('is-open');
        features.showNextCharacter();
    });
    dom.closeCharBtn.addEventListener('click', () => {
        dom.charModal.classList.add('hidden');
        state.stopCurrentAudio();
    });
    dom.nextCharBtn.addEventListener('click', features.showNextCharacter);
    dom.charTtsBtn.addEventListener('click', (e) => {
        const text = e.currentTarget.dataset.text;
        if (text) api.playTTS(text, e.currentTarget, null, null);
    });
    dom.characterInfo.addEventListener('click', (e) => {
        const ttsButton = e.target.closest('.tts-btn');
        if (ttsButton && ttsButton.dataset.text) {
            api.playTTS(ttsButton.dataset.text, ttsButton, null, null);
        }
    });
}