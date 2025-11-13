// js/state.js

// --- 전역 상태 변수 ---

// 원본 데이터
export let allPatterns = [];
export let allWords = [];
export let allCharacters = [];

// 학습 카운트
export let learningCounts = {};

// 채팅/교정 기록
export let conversationHistory = [];
export let correctionHistory = [];

// 오디오/기타 상태 (수정: 재할당이 필요한 변수들을 객체로 감쌉니다)
export const runTimeState = {
    currentAudio: null,
    currentPlayingButton: null,
    wakeLock: null,
    isPlayAllRunning: false // [★ 새로 추가] '전체 듣기'가 실행 중인지 여부
};

// (수정) audioCache는 재할당되지 않으므로 그대로 둡니다.
export let audioCache = {};

// --- 상태 초기화 및 관리 함수 ---

/**
 * allPatterns 데이터를 state.js 모듈에 설정합니다.
 * @param {Array} patterns - data/patterns.js에서 가져온 원본 패턴 배열
 */
export function setAllPatterns(patterns) {
    allPatterns = patterns;
}

/**
 * localStorage에서 학습 카운트를 로드합니다.
 */
export function initializeCounts() {
    const storedCounts = localStorage.getItem('chineseLearningCounts');
    learningCounts = storedCounts ? JSON.parse(storedCounts) : {};
    console.log("Learning counts initialized.");
}

/**
 * 현재 학습 카운트를 localStorage에 저장합니다.
 */
export function saveCounts() {
    localStorage.setItem('chineseLearningCounts', JSON.stringify(learningCounts));
}

/**
 * localStorage에서 교정 기록을 로드합니다.
 */
export function initializeCorrectionHistory() {
    const storedHistory = localStorage.getItem('chineseCorrectionHistory');
    correctionHistory = storedHistory ? JSON.parse(storedHistory) : [];
    console.log("Correction history initialized.");
}

/**
 * 현재 교정 기록을 localStorage에 저장합니다.
 */
export function saveCorrectionHistory() {
    localStorage.setItem('chineseCorrectionHistory', JSON.stringify(correctionHistory));
}

/**
 * 새 교정 항목을 기록에 추가합니다. (최대 50개)
 * @param {string} original - 원본 문장
 * @param {string} corrected - 교정된 문장
 * @param {string} explanation - 설명
 */
export function addCorrectionToHistory(original, corrected, explanation) {
    correctionHistory.unshift({ original, corrected, explanation, date: new Date().toISOString() });
    if (correctionHistory.length > 50) {
        correctionHistory = correctionHistory.slice(0, 50);
    }
    saveCorrectionHistory();
}

/**
 * allPatterns 데이터에서 고유한 단어 목록(allWords)을 생성합니다.
 */
export function initializeWordList() {
    const wordSet = new Map();
    allPatterns.forEach(pattern => {
        // '주요 단어' 추가
        if (pattern.vocab && Array.isArray(pattern.vocab)) {
            pattern.vocab.forEach(v => {
                if (v.word && v.pinyin && v.meaning && !wordSet.has(v.word)) {
                    wordSet.set(v.word, { word: v.word, pinyin: v.pinyin, meaning: v.meaning });
                }
            });
        }
        // '연습 문제 힌트 단어' 추가
        if (pattern.practiceVocab && Array.isArray(pattern.practiceVocab)) {
            pattern.practiceVocab.forEach(v => {
                if (v.word && v.pinyin && v.meaning && !wordSet.has(v.word)) {
                    wordSet.set(v.word, { word: v.word, pinyin: v.pinyin, meaning: v.meaning });
                }
            });
        }
    });
    allWords = Array.from(wordSet.values());
    console.log(`Initialized ${allWords.length} unique words.`);
}

/**
 * allWords 목록에서 고유한 간체자 목록(allCharacters)을 생성합니다.
 */
export function initializeCharacterList() {
    const charSet = new Set();
    const chineseCharRegex = /[\u4e00-\u9fa5]/g; // 중국어 한자 범위
    
    allWords.forEach(wordObj => {
        const chars = wordObj.word.match(chineseCharRegex);
        if (chars) {
            chars.forEach(char => charSet.add(char));
        }
    });
    allCharacters = Array.from(charSet);
    console.log(`Initialized ${allCharacters.length} unique characters.`);
}

/**
 * 오늘 날짜 문자열을 반환합니다. (예: "2025-10-24")
 * @returns {string}
 */
export function getTodayString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 오늘의 추천 패턴 2개를 랜덤으로 선택합니다.
 * @returns {Array}
 */
export function getRandomPatterns() {
    const shuffled = [...allPatterns].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 2);
}

/**
 * localStorage에서 오늘 날짜의 패턴을 로드하거나, 없으면 새로 생성하여 저장합니다.
 * @returns {Array} 오늘의 패턴 2개
 */
export function loadDailyPatterns() {
    const todayStr = getTodayString();
    const storedData = JSON.parse(localStorage.getItem('dailyChinesePatterns'));
    
    if (storedData && storedData.date === todayStr) {
        return storedData.patterns;
    } else {
        const newPatterns = getRandomPatterns();
        localStorage.setItem('dailyChinesePatterns', JSON.stringify({ date: todayStr, patterns: newPatterns }));
        return newPatterns;
    }
}

/**
 * 현재 재생 중인 오디오를 중지하고 상태를 초기화합니다.
 * (수정: runTimeState 객체의 속성을 변경하도록 수정)
 * @param {boolean} [stopButtonOnly=false] - 버튼의 'is-playing' 상태만 해제할지 여부
 */
export function stopCurrentAudio(stopButtonOnly = false) {
    if (runTimeState.currentAudio && !stopButtonOnly) {
        runTimeState.currentAudio.pause();
        runTimeState.currentAudio = null;
    }
    if (runTimeState.currentPlayingButton) {
        runTimeState.currentPlayingButton.classList.remove('is-playing');
        runTimeState.currentPlayingButton = null;
    }
    // [★ 새로 추가] '전체 듣기' 상태도 강제로 중지
    runTimeState.isPlayAllRunning = false; 
}

/**
 * 화면 꺼짐 방지 WakeLock을 설정합니다.
 * (수정: runTimeState 객체의 속성을 변경하도록 수정)
 */
export async function setupScreenWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            runTimeState.wakeLock = await navigator.wakeLock.request('screen');
            runTimeState.wakeLock.addEventListener('release', () => console.log('Screen Wake Lock released'));
            console.log('Screen Wake Lock active');
        } catch (err) {
            console.error(`${err.name}, ${err.message}`);
        }
    } else {
        console.log('Screen Wake Lock API not supported.');
    }
}