// js/quiz.js
import * as dom from './dom.js';
import * as state from './state.js';

let quizQuestions = [];
let currentQuizQuestionIndex = 0;
let quizScore = 0;

/**
 * 오늘의 퀴즈를 시작합니다.
 */
export function startQuiz() {
    const todayStr = state.getTodayString();
    const lastQuizDate = localStorage.getItem('lastQuizDate');

    if (lastQuizDate === todayStr) {
        dom.quizContent.innerHTML = `
            <div class="text-center">
                <p class="text-lg mb-4">오늘의 퀴즈를 이미 완료했습니다. 훌륭해요! 👍</p>
                <p class="text-gray-600">내일 새로운 퀴즈로 다시 만나요.</p>
                <button id="close-quiz-modal-btn" class="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg">확인</button>
            </div>`;
        dom.quizModal.classList.remove('hidden');
        return;
    }

    const shuffledPatterns = [...state.allPatterns].sort(() => 0.5 - Math.random());
    quizQuestions = shuffledPatterns.slice(0, 5);
    currentQuizQuestionIndex = 0;
    quizScore = 0;

    renderQuizQuestion();
    dom.quizModal.classList.remove('hidden');
}

/**
 * 퀴즈 질문을 화면에 렌더링합니다.
 */
function renderQuizQuestion() {
    if (currentQuizQuestionIndex >= quizQuestions.length) {
        showQuizResult();
        return;
    }

    const correctPattern = quizQuestions[currentQuizQuestionIndex];
    // [수정] state.allPatterns에서 가져오도록 수정
    const wrongPatterns = [...state.allPatterns].filter(p => p.pattern !== correctPattern.pattern).sort(() => 0.5 - Math.random()).slice(0, 3);
    const options = [...wrongPatterns, correctPattern].sort(() => 0.5 - Math.random());

    const optionsHtml = options.map(opt => `
        <button class="quiz-option-btn text-left w-full p-3 border rounded-lg hover:bg-gray-100 transition-colors" data-pattern="${opt.pattern}">
            <span class="font-medium chinese-text text-lg">${opt.pattern}</span><br>
            <span class="text-sm text-gray-500">${opt.pinyin}</span>
        </button>
    `).join('');

    dom.quizContent.innerHTML = `
        <div>
            <p class="text-lg font-bold mb-3">"${correctPattern.meaning}"</p>
            <p class="text-sm text-gray-600 mb-4">위의 뜻을 가진 중국어 패턴을 고르세요.</p>
            <div class="space-y-3">${optionsHtml}</div>
            <p class="text-center text-sm text-gray-500 mt-6">문제 ${currentQuizQuestionIndex + 1} / ${quizQuestions.length}</p>
        </div>`;
}

/**
 * 퀴즈 답변을 처리합니다.
 * @param {HTMLElement} targetButton - 사용자가 클릭한 옵션 버튼
 */
export function handleQuizAnswer(targetButton) {
    const selectedPattern = targetButton.dataset.pattern;
    const correctPattern = quizQuestions[currentQuizQuestionIndex].pattern;
    const allButtons = dom.quizContent.querySelectorAll('.quiz-option-btn');

    allButtons.forEach(btn => {
        btn.disabled = true;
        if (btn.dataset.pattern === correctPattern) {
            btn.classList.add('bg-green-100', 'border-green-500', 'ring-2', 'ring-green-300');
        }
    });

    if (selectedPattern === correctPattern) {
        quizScore++;
    } else {
        targetButton.classList.add('bg-red-100', 'border-red-500', 'ring-2', 'ring-red-300');
    }

    setTimeout(() => {
        currentQuizQuestionIndex++;
        renderQuizQuestion();
    }, 2000);
}

/**
 * 퀴즈 결과를 화면에 표시합니다.
 */
function showQuizResult() {
    dom.quizContent.innerHTML = `
        <div>
            <h2 class="text-2xl font-bold text-center mb-4">퀴즈 완료! 🎉</h2>
            <p class="text-center text-lg mb-6">
                총 ${quizQuestions.length}문제 중
                <span class="font-bold text-blue-600 text-xl">${quizScore}</span>개를 맞혔습니다!
            </p>
            <button id="close-quiz-modal-btn" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg">확인</button>
        </div>`;
    localStorage.setItem('lastQuizDate', state.getTodayString());
}