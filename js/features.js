// js/features.js
import * as dom from './dom.js';
import * as state from './state.js';
import * as api from './api.js';
import { showAlert } from './ui.js';

/**
 * 단어 학습 모달에 다음 랜덤 단어를 표시합니다.
 */
export function showNextWord() {
    if (state.allWords.length === 0) {
        showAlert('학습할 단어가 없습니다. 패턴을 먼저 확인해주세요.');
        return;
    }

    // 카드 뒷면으로 뒤집기 (초기화)
    if (dom.wordFlashcard) dom.wordFlashcard.classList.remove('is-flipped');
    
    // 랜덤 단어 선택
    const randomIndex = Math.floor(Math.random() * state.allWords.length);
    const word = state.allWords[randomIndex];

    // 카드 앞면에 단어 표시
    if (dom.wordFlashcardFront) {
        dom.wordFlashcardFront.innerHTML = `<p class="text-4xl font-bold chinese-text text-cyan-800">${word.word}</p>`;
    }
    
    // 카드 뒷면에 병음/뜻 표시
    if (dom.wordPinyin) dom.wordPinyin.textContent = word.pinyin;
    if (dom.wordMeaning) dom.wordMeaning.textContent = word.meaning;

    // TTS 버튼에 텍스트 설정
    if (dom.wordTtsBtn) dom.wordTtsBtn.dataset.text = word.word;
}

/**
 * 간체자 학습 모달에 다음 랜덤 글자 정보를 (API 호출 후) 표시합니다.
 */
export async function showNextCharacter() {
    if (state.allCharacters.length === 0) {
        showAlert('학습할 글자가 없습니다. 패턴을 먼저 확인해주세요.');
        return;
    }
    if (!dom.characterInfo) return;

    // 로딩 상태 표시
    dom.characterInfo.innerHTML = '<div class="loader mx-auto"></div>';
    if (dom.charTtsBtn) dom.charTtsBtn.dataset.text = '';

    // 랜덤 글자 선택
    const randomIndex = Math.floor(Math.random() * state.allCharacters.length);
    const char = state.allCharacters[randomIndex];

    try {
        // api.js의 래퍼 함수 사용
        const result = await api.getCharacterInfo(char); 
        
        let charData;
        if (result.candidates && result.candidates[0]?.content?.parts?.[0]) {
            const charText = result.candidates[0].content.parts[0].text.trim().replace(/^```json\s*|\s*```$/g, '');
            if (!charText || !charText.startsWith('{')) {
                throw new Error("AI가 유효한 JSON 형식으로 응답하지 않았습니다.");
            }
            try {
                charData = JSON.parse(charText);
            } catch (e) {
                console.error("AI char response is not valid JSON:", charText, e);
                throw new Error("AI 응답을 처리하는 중 오류가 발생했습니다.");
            }
        } else {
            console.error("Invalid response structure from get_character_info API:", result);
            throw new Error("AI로부터 유효한 응답을 받지 못했습니다.");
        }

        // [★ 수정 시작]
        // 1. 메인 TTS 버튼에 글자 설정 (데이터 파싱 직후)
        if (dom.charTtsBtn) dom.charTtsBtn.dataset.text = charData.char;

        // 2. examples가 유효한 배열인지 확인하고, 아닐 경우 기본 메시지 설정
        let examplesHtml = '<p class="text-sm text-gray-500">예시 단어가 없습니다.</p>'; // 기본값
        
        if (Array.isArray(charData.examples) && charData.examples.length > 0) {
            // 3. 유효한 배열일 때만 .map() 실행
            examplesHtml = charData.examples.map(ex => `
                <div class="p-2 bg-white rounded-md shadow-sm">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-lg chinese-text font-semibold text-gray-800">${ex.word}</p>
                            <p class="text-sm text-gray-500">${ex.pinyin}</p>
                        </div>
                        <button class="tts-btn p-1 rounded-full hover:bg-gray-200 transition-colors" data-text="${ex.word}">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-500 pointer-events-none"><path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg>
                        </button>
                    </div>
                    <p class="text-sm text-gray-600 mt-1 pt-1 border-t">${ex.meaning}</p>
                </div>
            `).join('');
        }
        // [★ 수정 끝]

        // 결과 표시 (이제 examplesHtml은 항상 안전함)
        dom.characterInfo.innerHTML = `
            <div class="text-center">
                <p class="text-6xl font-bold chinese-text text-red-700">${charData.char}</p>
                <p class="text-2xl text-gray-600 mt-2">${charData.pinyin}</p>
                <p class="text-2xl font-semibold text-red-600 mt-2">${charData.meaning}</p>
            </div>
            <div class="mt-6 w-full">
                <h4 class="text-sm font-semibold text-gray-700 border-b pb-1">예시 단어:</h4>
                <div class="space-y-2 mt-2">
                    ${examplesHtml}
                </div>
            </div>`;
        
        // (TTS 버튼 설정 코드는 위로 이동했음)

    } catch (error) { // 여기가 108번째 줄 근처입니다.
        console.error('Get character info error:', error);
        dom.characterInfo.innerHTML = `<p class="text-red-500 text-center">글자 정보를 불러오는 중 오류가 발생했습니다: ${error.message}</p>`;
    }
}