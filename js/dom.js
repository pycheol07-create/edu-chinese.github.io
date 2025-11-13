// js/dom.js

// 이 파일은 모든 DOM 요소 변수를 초기화하고 내보냅니다.
// main.js의 initializeDOM() 함수와 전역 변수 부분을 여기로 옮깁니다.

export let patternContainer, currentDateEl, newPatternBtn, openTranslatorBtn, translatorModal,
    closeTranslatorBtn, translateBtn, koreanInput, translationResult, customAlertModal,
    customAlertMessage, customAlertCloseBtn, allPatternsBtn, allPatternsModal,
    closeAllPatternsBtn, allPatternsList, 
    chatModal, closeChatBtn,
    chatHistory, chatInput, sendChatBtn, micBtn, suggestReplyBtn,
    // [★ 삭제] 퀴즈 관련 변수 삭제
    openCorrectionBtn, correctionModal, closeCorrectionBtn, correctionInput,
    correctWritingBtn, correctionResult, getTopicBtn, writingTopicDisplay,
    correctionHistoryModal, openCorrectionHistoryBtn, closeCorrectionHistoryBtn,
    correctionHistoryList, clearCorrectionHistoryBtn,
    fabContainer, fabMainBtn,
    openWordBtn, wordModal, closeWordBtn, wordFlashcard,
    wordFlashcardFront, wordFlashcardBack, wordPinyin, wordMeaning,
    wordTtsBtn, showWordAnswerBtn, nextWordBtn,
    openCharBtn, charModal, closeCharBtn, characterInfo,
    charTtsBtn, nextCharBtn,
    openRoleplayBtn, roleplayModal, closeRoleplayBtn, roleplayScenarioList,
    // [★ 수정] 듣기 학습 관련 변수
    openListeningBtn, listeningModal, closeListeningBtn,
    listeningScriptDisplay, listeningPlaybackControls,
    playAllScriptBtn, listeningControls, listeningScenarioList; // (getTodayConversationBtn, situationalListeningControls 삭제. listeningScenarioList 추가)


/**
 * DOMContentLoaded 시점에 모든 DOM 요소를 찾아 변수에 할당합니다.
 */
export function initializeDOM() {
    patternContainer = document.getElementById('pattern-container');
    currentDateEl = document.getElementById('current-date');
    newPatternBtn = document.getElementById('new-pattern-btn');
    openTranslatorBtn = document.getElementById('open-translator-btn');
    translatorModal = document.getElementById('translator-modal');
    closeTranslatorBtn = document.getElementById('close-translator-btn');
    translateBtn = document.getElementById('translate-btn');
    koreanInput = document.getElementById('korean-input');
    translationResult = document.getElementById('translation-result');
    customAlertModal = document.getElementById('custom-alert-modal');
    customAlertMessage = document.getElementById('custom-alert-message');
    customAlertCloseBtn = document.getElementById('custom-alert-close-btn');
    allPatternsBtn = document.getElementById('all-patterns-btn');
    allPatternsModal = document.getElementById('all-patterns-modal');
    closeAllPatternsBtn = document.getElementById('close-all-patterns-btn');
    allPatternsList = document.getElementById('all-patterns-list');
    
    chatModal = document.getElementById('chat-modal');
    closeChatBtn = document.getElementById('close-chat-btn');
    chatHistory = document.getElementById('chat-history');
    chatInput = document.getElementById('chat-input');
    sendChatBtn = document.getElementById('send-chat-btn');
    micBtn = document.getElementById('mic-btn');
    suggestReplyBtn = document.getElementById('suggest-reply-btn');

    // [★ 삭제] 퀴즈 관련 DOM 할당 코드 삭제

    openCorrectionBtn = document.getElementById('open-correction-btn');
    correctionModal = document.getElementById('correction-modal');
    closeCorrectionBtn = document.getElementById('close-correction-btn');
    correctionInput = document.getElementById('correction-input');
    correctWritingBtn = document.getElementById('correct-writing-btn');
    correctionResult = document.getElementById('correction-result');

    getTopicBtn = document.getElementById('get-topic-btn');
    writingTopicDisplay = document.getElementById('writing-topic-display');

    correctionHistoryModal = document.getElementById('correction-history-modal');
    openCorrectionHistoryBtn = document.getElementById('open-correction-history-btn');
    closeCorrectionHistoryBtn = document.getElementById('close-correction-history-btn');
    correctionHistoryList = document.getElementById('correction-history-list');
    clearCorrectionHistoryBtn = document.getElementById('clear-correction-history-btn');

    fabContainer = document.getElementById('fab-container');
    fabMainBtn = document.getElementById('fab-main-btn');

    openWordBtn = document.getElementById('open-word-btn');
    wordModal = document.getElementById('word-modal');
    closeWordBtn = document.getElementById('close-word-btn');
    wordFlashcard = document.getElementById('word-flashcard');
    wordFlashcardFront = document.getElementById('word-flashcard-front');
    wordFlashcardBack = document.getElementById('word-flashcard-back');
    wordPinyin = document.getElementById('word-pinyin');
    wordMeaning = document.getElementById('word-meaning');
    wordTtsBtn = document.getElementById('word-tts-btn');
    showWordAnswerBtn = document.getElementById('show-word-answer-btn');
    nextWordBtn = document.getElementById('next-word-btn');

    openCharBtn = document.getElementById('open-char-btn');
    charModal = document.getElementById('char-modal');
    closeCharBtn = document.getElementById('close-char-btn');
    characterInfo = document.getElementById('character-info');
    charTtsBtn = document.getElementById('char-tts-btn');
    nextCharBtn = document.getElementById('next-char-btn');
    
    openRoleplayBtn = document.getElementById('open-roleplay-btn');
    roleplayModal = document.getElementById('roleplay-modal');
    closeRoleplayBtn = document.getElementById('close-roleplay-btn');
    roleplayScenarioList = document.getElementById('roleplay-scenario-list');

    // [★ 수정] 듣기 학습 관련 DOM 할당
    openListeningBtn = document.getElementById('open-listening-btn');
    listeningModal = document.getElementById('listening-modal');
    closeListeningBtn = document.getElementById('close-listening-btn');
    // [★ 삭제] getTodayConversationBtn
    // [★ 삭제] situationalListeningControls
    listeningScriptDisplay = document.getElementById('listening-script-display');
    listeningPlaybackControls = document.getElementById('listening-playback-controls');
    playAllScriptBtn = document.getElementById('play-all-script-btn');
    listeningControls = document.getElementById('listening-controls'); 
    listeningScenarioList = document.getElementById('listening-scenario-list'); // [★ 추가]


    console.log("DOM elements initialized.");
}