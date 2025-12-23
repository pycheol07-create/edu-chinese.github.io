// js/features.js
import * as dom from './dom.js';
import * as state from './state.js';
import * as api from './api.js';
import { showAlert } from './ui.js';

// [AI 응답 JSON 추출 헬퍼 함수]
function extractJson(text) {
    if (!text) return null;
    const match = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (match && match[1]) return match[1].trim();
    const trimmedText = text.trim();
    if (trimmedText.startsWith('{') && trimmedText.endsWith('}')) return trimmedText;
    console.warn("Could not find or extract JSON block from text:", text);
    return null; 
}

/**
 * 단어 학습 모달에 다음 랜덤 단어를 표시합니다.
 */
export function showNextWord() {
    if (state.allWords.length === 0) {
        showAlert('학습할 단어가 없습니다. 패턴을 먼저 확인해주세요.');
        return;
    }

    if (dom.wordFlashcard) dom.wordFlashcard.classList.remove('is-flipped');
    
    const randomIndex = Math.floor(Math.random() * state.allWords.length);
    const word = state.allWords[randomIndex];

    if (dom.wordFlashcardFront) {
        dom.wordFlashcardFront.innerHTML = `<p class="text-4xl font-bold chinese-text text-cyan-800">${word.word}</p>`;
    }
    
    if (dom.wordPinyin) dom.wordPinyin.textContent = word.pinyin;
    if (dom.wordMeaning) dom.wordMeaning.textContent = word.meaning;

    if (dom.wordTtsBtn) dom.wordTtsBtn.dataset.text = word.word;
}

/**
 * [수정] 간체자 학습 모달에 심화 정보(어원, 주의사항, 파생단어)를 표시합니다.
 */
export async function showNextCharacter() {
    if (state.allCharacters.length === 0) {
        showAlert('학습할 글자가 없습니다. 패턴을 먼저 확인해주세요.');
        return;
    }
    if (!dom.characterInfo) return;

    // 로딩 UI
    dom.characterInfo.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center space-y-4">
            <div class="loader mx-auto"></div>
            <p class="text-gray-500 animate-pulse">AI 선생님이 글자를 분석 중입니다...</p>
        </div>`;
    if (dom.charTtsBtn) dom.charTtsBtn.dataset.text = '';

    const randomIndex = Math.floor(Math.random() * state.allCharacters.length);
    const char = state.allCharacters[randomIndex];

    try {
        const result = await api.getCharacterInfo(char); 
        
        let charData;
        if (result.candidates && result.candidates[0]?.content?.parts?.[0]) {
            const aiResponseText = result.candidates[0].content.parts[0].text;
            const charText = extractJson(aiResponseText);
            if (!charText) throw new Error("AI가 유효한 JSON 형식으로 응답하지 않았습니다.");
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

        if (dom.charTtsBtn) dom.charTtsBtn.dataset.text = charData.char;

        // 1. 어원/해부학 섹션 HTML 생성
        let etymologyHtml = '';
        if (charData.etymology) {
            etymologyHtml = `
                <div class="bg-amber-50 p-3 rounded-lg border border-amber-100">
                    <h4 class="text-sm font-bold text-amber-800 mb-1">🔍 한자 해부학 (어원)</h4>
                    <p class="text-sm text-gray-700 leading-relaxed">${charData.etymology}</p>
                </div>`;
        }

        // 2. 닮은꼴 주의보 섹션 HTML 생성
        let cautionHtml = '';
        if (charData.caution && charData.caution.similar_char) {
            cautionHtml = `
                <div class="bg-red-50 p-3 rounded-lg border border-red-100 flex items-start space-x-3">
                    <div class="flex-shrink-0 text-2xl">⚠️</div>
                    <div>
                        <h4 class="text-sm font-bold text-red-800 mb-1">닮은꼴 주의보!</h4>
                        <p class="text-sm text-gray-700">
                            <span class="font-bold text-red-600 text-lg mx-1">${charData.caution.similar_char}</span>와 헷갈리지 마세요.
                            <br><span class="text-xs text-gray-500">${charData.caution.tip}</span>
                        </p>
                    </div>
                </div>`;
        }

        // 3. 단어 확장 섹션 HTML 생성
        let wordsHtml = '';
        if (Array.isArray(charData.related_words) && charData.related_words.length > 0) {
            const listItems = charData.related_words.map(w => `
                <div class="flex justify-between items-center py-2 border-b last:border-0 border-gray-100">
                    <div>
                        <span class="text-lg font-bold text-gray-800 chinese-text">${w.word}</span>
                        <span class="text-xs text-gray-400 ml-1">${w.pinyin}</span>
                    </div>
                    <div class="flex items-center">
                        <span class="text-sm text-gray-600 mr-2">${w.meaning}</span>
                         <button class="tts-btn p-1 rounded-full hover:bg-gray-100 text-gray-400" data-text="${w.word}">
                            <svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                        </button>
                    </div>
                </div>
            `).join('');
            
            wordsHtml = `
                <div class="bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <h4 class="text-sm font-bold text-blue-800 mb-2">🧩 꼬리에 꼬리를 무는 단어</h4>
                    <div class="bg-white rounded-md px-3 shadow-sm">
                        ${listItems}
                    </div>
                </div>`;
        }

        // 전체 렌더링
        dom.characterInfo.innerHTML = `
            <div class="text-center p-4 bg-white border-b-2 border-gray-100 mb-4 sticky top-0 z-10">
                <p class="text-6xl font-bold chinese-text text-red-600 shadow-sm inline-block">${charData.char}</p>
                <div class="mt-2">
                    <span class="text-xl font-medium text-gray-800 mr-2">${charData.pinyin}</span>
                    <span class="text-lg text-gray-500">${charData.meaning}</span>
                </div>
            </div>
            
            <div class="space-y-4 px-1 pb-4">
                ${etymologyHtml}
                ${cautionHtml}
                ${wordsHtml}
            </div>
        `;
        
    } catch (error) {
        console.error('Get character info error:', error);
        dom.characterInfo.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-center">
                <p class="text-4xl mb-2">😵</p>
                <p class="text-red-500 font-bold">오류 발생</p>
                <p class="text-sm text-gray-500 mt-1">${error.message}</p>
                <button onclick="document.getElementById('next-char-btn').click()" class="mt-4 text-blue-500 underline text-sm">다시 시도하기</button>
            </div>`;
    }
}