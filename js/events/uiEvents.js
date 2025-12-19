// js/events/uiEvents.js
import * as dom from '../dom.js';
import * as state from '../state.js';
import * as ui from '../ui.js';
import * as handlers from '../handlers.js';

export function setupUIEvents() {
    // --- 새로운 패턴 보기 ---
    dom.newPatternBtn.addEventListener('click', () => {
         const newPatterns = state.forceNewDailyPatterns(); 
         ui.renderPatterns(newPatterns);
         newPatterns.forEach((p, index) => {
             if (p.practice) {
                 setTimeout(() => handlers.handleNewPracticeRequest(p.pattern, index), 0);
             }
         });
         window.scrollTo(0, 0);
    });

    // --- FAB (플로팅 버튼) ---
    if (dom.fabMainBtn && dom.fabContainer) {
        dom.fabMainBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dom.fabContainer.classList.toggle('is-open');
        });
    }
    document.addEventListener('click', (e) => {
        if (dom.fabContainer && dom.fabContainer.classList.contains('is-open')) {
            if (!dom.fabContainer.contains(e.target)) {
                dom.fabContainer.classList.remove('is-open');
            }
        }
    });

    // --- 전체 패턴 보기 모달 ---
    dom.allPatternsBtn.addEventListener('click', () => {
        dom.allPatternsModal.classList.remove('hidden');
        if (dom.fabContainer) dom.fabContainer.classList.remove('is-open');
    });
    dom.closeAllPatternsBtn.addEventListener('click', () => dom.allPatternsModal.classList.add('hidden'));
    
    dom.allPatternsList.addEventListener('click', (e) => {
        const selectedPatternDiv = e.target.closest('[data-pattern-index]');
        if (selectedPatternDiv) {
            const patternIndex = parseInt(selectedPatternDiv.dataset.patternIndex, 10);
            const selectedPattern = state.allPatterns[patternIndex];
            if (selectedPattern) {
                ui.renderPatterns([selectedPattern]);
                if (selectedPattern.practice) {
                    setTimeout(() => handlers.handleNewPracticeRequest(selectedPattern.pattern, 0), 0);
                }
                dom.allPatternsModal.classList.add('hidden');
                window.scrollTo(0, 0);
            }
        }
    });

    // --- 커스텀 알림창 닫기 ---
    dom.customAlertCloseBtn.addEventListener('click', () => dom.customAlertModal.classList.add('hidden'));

    // [★ 추가] 온라인/오프라인 상태 감지
    const updateOnlineStatus = () => {
        const banner = document.getElementById('offline-banner');
        if (banner) {
            if (!navigator.onLine) {
                banner.classList.remove('hidden');
            } else {
                banner.classList.add('hidden');
            }
        }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus(); // 초기 상태 체크
}