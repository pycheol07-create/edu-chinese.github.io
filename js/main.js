// js/main.js
import { allPatterns as patternsData } from '../data/patterns.js';
import * as state from './state.js';
import * as dom from './dom.js';
import * as ui from './ui.js';
import * as speech from './speech.js';
import * as handlers from './handlers.js';

// 이벤트 모듈 가져오기
import { setupPracticeEvents } from './events/practiceEvents.js';
import { setupChatEvents } from './events/chatEvents.js';
import { setupListeningEvents } from './events/listeningEvents.js';
import { setupToolEvents } from './events/toolEvents.js';
import { setupUIEvents } from './events/uiEvents.js';

/**
 * 앱을 초기화합니다.
 */
function initializeApp() {
    // 0. 원본 데이터 설정
    state.setAllPatterns(patternsData);
    
    // 1. DOM 요소 초기화 (가장 먼저 실행)
    dom.initializeDOM();
    
    // 2. UI 및 상태 초기화
    ui.displayDate();
    state.initializeCounts();
    state.initializeCorrectionHistory();
    state.initializeWordList();
    state.initializeCharacterList();
    
    // 3. 일일 패턴 로드 및 렌더링
    const dailyPatterns = state.loadDailyPatterns();
    ui.renderPatterns(dailyPatterns);
    
    // 4. 렌더링 후 연습문제 즉시 로드
    dailyPatterns.forEach((p, index) => {
        if (p.practice) {
            setTimeout(() => handlers.handleNewPracticeRequest(p.pattern, index), 0);
        }
    });
    
    // 5. 전체 패턴 목록 렌더링 (모달용)
    ui.renderAllPatternsList();
    
    // 6. 기타 기능 초기화
    state.setupScreenWakeLock();
    speech.initializeSpeechRecognition();
    
    // 7. 모든 이벤트 리스너 설정 (모듈화됨)
    setupPracticeEvents();
    setupChatEvents();
    setupListeningEvents();
    setupToolEvents();
    setupUIEvents();
    
    console.log("App initialized with modular events.");
}

// --- 앱 실행 ---
document.addEventListener('DOMContentLoaded', initializeApp);