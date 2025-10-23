// Vercel 서버에서 실행되는 코드입니다.
// 이 파일은 절대 사용자에게 노출되지 않습니다.

export default async function handler(request, response) {
  // 1. Vercel에 저장된 환경 변수에서 API 키를 안전하게 가져옵니다.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });
  }

  // 2. 프런트엔드에서 보낸 요청 데이터를 받습니다.
  const { action, text, systemPrompt, history, pattern } = request.body;

  try {
    let apiUrl;
    let apiRequestBody;
    let modelShortName = 'gemini-1.0-pro'; // 기본 모델 설정

    // TTS가 아닌 경우 (번역, 채팅, 답변 추천, 패턴 채팅 시작, 문제 생성) 모델 동적 선택 필요
    if (action !== 'tts') {
        const listModelsRes = await fetch(
            `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}` // 오타 수정: language
        );
        if (!listModelsRes.ok) {
            const errData = await listModelsRes.json();
            throw new Error(`Google API (ListModels) 오류: ${JSON.stringify(errData)}`);
        }
        const modelData = await listModelsRes.json();
        const availableModels = modelData.models || [];

        const chosenModel =
            availableModels.find(m => m.name.includes('flash') && m.supportedGenerationMethods.includes('generateContent')) ||
            availableModels.find(m => m.name.includes('gemini-1.0-pro') && m.supportedGenerationMethods.includes('generateContent')) ||
            availableModels.find(m => m.name.includes('gemini-pro') && m.supportedGenerationMethods.includes('generateContent'));

        if (!chosenModel) {
            console.warn('API 키로 접근 가능한 (flash 또는 pro) 모델을 찾지 못해 기본 모델(gemini-1.0-pro)을 사용합니다.');
        } else {
             modelShortName = chosenModel.name.split('/').pop();
             console.log("Using model:", modelShortName); // 어떤 모델 쓰는지 로그 출력
        }

        apiUrl = `https://generativelanguage.googleapis.com/v1/models/${modelShortName}:generateContent?key=${apiKey}`;
    }

    // 3. 액션별 요청 본문 설정
    if (action === 'translate') {
        const prompt = systemPrompt || `Translate this Korean text to Chinese: ${text}`;
        apiRequestBody = {
            contents: [{ parts: [{ text: `${prompt}\n\nKorean: "${text}"` }] }]
        };
    } else if (action === 'chat') {
        const chatSystemPrompt = `You are "Ling" (灵), a friendly native Chinese speaker and language tutor. Your goal is to help a user learning Chinese.
- Have a natural, concise conversation (1-2 short sentences).
- Ask questions to keep the conversation going.
- **VERY IMPORTANT:** Analyze the user's *last* message for grammatical errors or unnatural expressions.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object must have these exact keys: "chinese", "pinyin", "korean", "correction".

- "chinese": Your *new* conversational response in simplified Chinese (e.g., "你今天过得怎么样？").
- "pinyin": The pinyin for your "chinese" response.
- "korean": A natural Korean translation of your "chinese" response.
- "correction": An object containing feedback on the *user's previous message*, OR \`null\`.
    - If the user's message was grammatically correct and natural, set "correction" to: \`null\`.
    - If the user's message had an error:
        - Set "correction" to an object with keys: "original" (the user's text), "corrected" (the corrected Chinese text), and "explanation" (a simple explanation *in Korean* of what was wrong and why).

- Example if user said "我昨天去公园了玩":
  {"chinese": "哦，你昨天去公园玩了啊！公园里人多吗？", "pinyin": "Ò, nǐ zuótiān qù gōngyuán wán le a! Gōngyuán lǐ rén duō ma?", "korean": "오, 어제 공원에 놀러 갔군요! 공원에 사람 많았어요?", "correction": {"original": "我昨天去公园了玩", "corrected": "我昨天去公园玩了", "explanation": "'了'는 동사 '玩' 뒤에 와야 해요. '...了玩'은 올바르지 않아요."}}
- Example if user said "你好":
  {"chinese": "你好！你吃饭了吗？", "pinyin": "Nǐ hǎo! Nǐ chīfàn le ma?", "korean": "안녕하세요! 밥 먹었어요?", "correction": null}
`;
        const contents = [
            { role: "user", parts: [{ text: "Please follow these instructions for all future responses: " + chatSystemPrompt }] },
            { role: "model", parts: [{ text: "Okay, I understand. I will act as Ling and respond in the required JSON format, including grammar corrections." }] },
            ...history,
            { role: "user", parts: [{ text: text }] }
        ];
        apiRequestBody = { contents };
    
    } else if (action === 'start_chat_with_pattern') {
        const startChatSystemPrompt = `You are "Ling" (灵), a friendly native Chinese speaker and language tutor. Your goal is to help a user learning Chinese.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object must have these exact keys: "chinese", "pinyin", "korean", "correction".
- Set "correction" to \`null\` for this first message.
- Your *very first message* must be a natural, conversational question that cleverly uses or relates to the Chinese pattern: "${pattern}".
- Ask a question to encourage the user to reply, perhaps using the same pattern.
- Example for pattern "A是A, 但是B": {"chinese": "今天天气好是好, 但是有点儿热。你觉得呢？", "pinyin": "Jīntiān tiānqì hǎo shì hǎo, dànshì yǒudiǎnr rè. Nǐ juéde ne?", "korean": "오늘 날씨가 좋긴 좋은데, 조금 덥네요. 당신은 어때요?", "correction": null}`;

        const contents = [
            { role: "user", parts: [{ text: startChatSystemPrompt }] },
            { role: "model", parts: [{ text: `Okay, I understand. I will act as Ling and respond in the required JSON format.` }] },
            { role: "user", parts: [{ text: `Great. Now, please start the conversation by asking me a question using the pattern "${pattern}".` }] }
        ];
        apiRequestBody = { contents };
    
    // --- [확인 및 수정]: `generate_practice` 액션 ---
    } else if (action === 'generate_practice') {
        const practiceSystemPrompt = `You are a Chinese language teacher. Your task is to generate one new, simple practice problem for the given Chinese pattern.
- The problem must be different from the examples provided in the pattern data.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object must have these exact keys: "korean" (string), "chinese" (string), "pinyin" (string), and "practiceVocab" (array).
- "korean": A simple Korean sentence for the user to translate.
- "chinese": The correct Chinese translation (the answer).
- "pinyin": The pinyin for the Chinese answer.
- "practiceVocab": An array of 2-3 key vocabulary objects used in the "chinese" answer. Each object must have keys: "word", "pinyin", "meaning".

- Pattern to use: "${pattern}"
- Example Response (for pattern "越来越..."):
  {"korean": "그는 점점 더 잘생겨져.", "chinese": "他越来越帅了。", "pinyin": "tā yuèláiyuè shuài le.", "practiceVocab": [{"word": "越来越", "pinyin": "yuèláiyuè", "meaning": "점점 더"}, {"word": "帅", "pinyin": "shuài", "meaning": "잘생기다"}]}`;
        
        // [수정 확인] contents 배열 마지막이 'user' 역할로 끝나야 함
        const contents = [
            { role: "user", parts: [{ text: practiceSystemPrompt }] },
            { role: "model", parts: [{ text: `Okay, I understand. I will generate a new practice problem for the pattern "${pattern}" in the specified JSON format, including "practiceVocab".` }] },
            // 마지막 메시지가 AI에게 생성을 '명령'하는 user 역할이어야 합니다.
            { role: "user", parts: [{ text: `Great. Now, please generate the practice problem for the pattern "${pattern}".` }] } // 이 부분이 이전 코드에서 정확했는지 다시 확인 (이번 코드는 확실히 맞습니다)
        ];
        apiRequestBody = { contents };
    // --- [수정 완료] ---
        
    // --- [새 기능 추가]: `correct_writing` 액션 ---
    } else if (action === 'correct_writing') {
        const correctionSystemPrompt = `You are a Chinese language teacher. Your task is to correct a single Chinese sentence or short paragraph written by a learner.
- Analyze the user's text for grammatical errors, unnatural expressions, or typos.
- If the text is perfect, congratulate the user.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object must have these exact keys: "corrected_sentence" (string) and "explanation" (string, in Korean).
- "corrected_sentence": The corrected, natural Chinese text. If the original was perfect, this field should be the same as the original text.
- "explanation": A simple explanation *in Korean* of what was wrong and why. If the original was perfect, set this to "완벽해요! 훌륭한 작문입니다. 👍".

- Example if user wrote "我昨天去公园了玩":
  {"corrected_sentence": "我昨天去公园玩了", "explanation": "'了'는 동사 '玩' 뒤에 와야 해요. '...了玩'은 올바르지 않아요."}
- Example if user wrote "他很高":
  {"corrected_sentence": "他很高", "explanation": "완벽해요! 훌륭한 작문입니다. 👍"}
`;
        const contents = [
            { role: "user", parts: [{ text: correctionSystemPrompt }] },
            { role: "model", parts: [{ text: "Okay, I understand. I will correct the user's text and respond in the required JSON format (corrected_sentence, explanation)." }] },
            { role: "user", parts: [{ text: `Please correct the following text: "${text}"` }] }
        ];
        apiRequestBody = { contents };
    // --- [추가 완료] ---
        
    } else if (action === 'suggest_reply') {
        const suggestSystemPrompt = `Based on the previous conversation history, suggest 1 or 2 simple and natural next replies in Chinese for the user who is learning Chinese. The user just received the last message from the AI model.
- Provide only the suggested replies with their pinyin and Korean meaning.
- Your entire response MUST be a single, valid JSON object containing a key "suggestions" which is an array of objects.
- Each object in the "suggestions" array must have three keys: "chinese" (string), "pinyin" (string), "korean" (string, the Korean meaning).
- Example: {"suggestions": [{"chinese": "你好!", "pinyin": "Nǐ hǎo!", "korean": "안녕하세요!"}, {"chinese": "谢谢你。", "pinyin": "Xièxie nǐ.", "korean": "고마워요."}]}
- Do not include any other text or markdown backticks.`;

         const contents = [
            { role: "user", parts: [{ text: suggestSystemPrompt }] },
            { role: "model", parts: [{ text: "Okay, I will provide reply suggestions including pinyin and Korean meaning in the specified JSON format." }] }, 
            ...history
        ];
        apiRequestBody = { contents };
    }
    else if (action === 'tts') {
        apiUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
        apiRequestBody = {
            input: { text: text },
            voice: { languageCode: 'cmn-CN', name: 'cmn-CN-Wavenet-B' },
            audioConfig: { audioEncoding: 'MP3' }
        };
    } else {
        return response.status(400).json({ error: '잘못된 요청(action)입니다.' });
    }

    // 4. Google API에 실제 요청 전송
    const apiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiRequestBody),
    });

    const data = await apiResponse.json();

    if (!apiResponse.ok) {
        console.error('Google API Error:', data);
        const errorDetails = data.error ? data.error.message : JSON.stringify(data);
        throw new Error(`Google API 오류: ${errorDetails}`);
    }

    // TTS 응답 처리
    if (action === 'tts') {
        return response.status(200).json(data);
    }

    // 번역, 채팅, 답변 추천, 패턴 채팅 시작, 문제 생성 응답 처리 (v1 응답 구조 확인)
    if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content || !data.candidates[0].content.parts || data.candidates[0].content.parts.length === 0) {
        console.error("Invalid response structure from Google API:", data);
         if (data.promptFeedback && data.promptFeedback.blockReason) {
             throw new Error(`AI 응답 생성 실패 (안전 필터): ${data.promptFeedback.blockReason}`);
        } else if (data.candidates && data.candidates.length > 0 && data.candidates[0].finishReason && data.candidates[0].finishReason !== 'STOP') {
             throw new Error(`AI 응답 생성 중단됨: ${data.candidates[0].finishReason}`);
        } else if (data.candidates && data.candidates.length === 0) {
             throw new Error(`AI 응답 생성 실패: Candidates 배열이 비어있습니다.`);
        }
        throw new Error("AI로부터 유효한 응답 구조를 받지 못했습니다. (candidates 확인 실패)");
    }

     if (action === 'suggest_reply') {
        let suggestionData = null;
        let foundSuggestions = false;
        for (const part of data.candidates[0].content.parts) {
            try {
                const cleanedText = part.text.trim();
                const jsonText = cleanedText.replace(/^```json\s*|\s*```$/g, '');
                const parsedPart = JSON.parse(jsonText);

                if (parsedPart.suggestions && Array.isArray(parsedPart.suggestions) &&
                    parsedPart.suggestions.length > 0 &&
                    parsedPart.suggestions.every(item => 
                        typeof item === 'object' &&
                        item.hasOwnProperty('chinese') &&
                        item.hasOwnProperty('pinyin') &&
                        item.hasOwnProperty('korean') 
                    ))
                {
                    suggestionData = parsedPart;
                    foundSuggestions = true;
                    break; 
                } else if (parsedPart.suggestions && Array.isArray(parsedPart.suggestions) && parsedPart.suggestions.length === 0) {
                    suggestionData = parsedPart;
                    foundSuggestions = true;
                    break;
                }
            } catch (e) {
                console.warn("Ignoring non-JSON or invalid JSON part in suggest_reply:", part.text);
            }
        }

        if (foundSuggestions && suggestionData) {
            return response.status(200).json(suggestionData);
        } else {
            console.error("Could not find valid 'suggestions' JSON object array with required keys (chinese, pinyin, korean) in any response parts:", JSON.stringify(data.candidates[0].content.parts, null, 2));
            throw new Error("AI로부터 유효한 답변 추천(병음, 뜻 포함) JSON 형식을 찾지 못했습니다."); 
        }
    }

    // 번역, 채팅, 패턴 채팅 시작, 문제 생성, 작문 교정은 data 전체를 반환 (프론트엔드에서 파싱)
    return response.status(200).json(data);

  } catch (error) {
    console.error('서버 함수 오류:', error);
    return response.status(500).json({ error: error.message });
  }
}

// v.2025.10.20_1101-10