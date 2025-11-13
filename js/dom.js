// js/dom.js

// 이 파일은 모든 DOM 요소 변수를 초기화하고 내보냅니다.
// main.js의 initializeDOM() 함수와 전역 변수 부분을 여기로 옮깁니다.

export let patternContainer, currentDateEl, newPatternBtn, openTranslatorBtn, translatorModal,
    closeTranslatorBtn, translateBtn, koreanInput, translationResult, customAlertModal,
    customAlertMessage, customAlertCloseBtn, allPatternsBtn, allPatternsModal,
    closeAllPatternsBtn, allPatternsList, chatBtn, chatModal, closeChatBtn,
    chatHistory, chatInput, sendChatBtn, micBtn, suggestReplyBtn,
    dailyQuizBtn, quizModal, closeQuizBtn, quizContent,
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
    // [★ 새 변수 추가]
    openRoleplayBtn, roleplayModal, closeRoleplayBtn, roleplayScenarioList;


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
    chatBtn = document.getElementById('open-chat-btn');
    chatModal = document.getElementById('chat-modal');
    closeChatBtn = document.getElementById('close-chat-btn');
    chatHistory = document.getElementById('chat-history');
    chatInput = document.getElementById('chat-input');
    sendChatBtn = document.getElementById('send-chat-btn');
    micBtn = document.getElementById('mic-btn');
    suggestReplyBtn = document.getElementById('suggest-reply-btn');

    dailyQuizBtn = document.getElementById('daily-quiz-btn');
    quizModal = document.getElementById('quiz-modal');
    closeQuizBtn = document.getElementById('close-quiz-btn');
    quizContent = document.getElementById('quiz-content');

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
    
    // [★ 새 DOM 요소 매핑]
    openRoleplayBtn = document.getElementById('open-roleplay-btn');
    roleplayModal = document.getElementById('roleplay-modal');
    closeRoleplayBtn = document.getElementById('close-roleplay-btn');
    roleplayScenarioList = document.getElementById('roleplay-scenario-list');

    console.log("DOM elements initialized.");
}