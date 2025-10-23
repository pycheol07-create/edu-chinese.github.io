// Vercel 서버에서 실행되는 코드입니다.
// 이 파일은 절대 사용자에게 노출되지 않습니다.

export default async function handler(request, response) {

// 🔹 모델 캐싱을 위한 전역 변수 (API 호출 성능 개선)
  // 한 번 모델을 가져오면 이후 요청에서는 재사용합니다.
  // (함수 실행 중 유지되며, Vercel 함수 재시작 시 초기화됩니다.)
  let cachedModel = null;

  // 1. Vercel에 저장된 환경 변수에서 API 키를 안전하게 가져옵니다.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });
  }

  // 2. 프런트엔드에서 보낸 요청 데이터를 받습니다.
  const { action, text, systemPrompt, history } = request.body;

  try {
    let apiUrl;
    let apiRequestBody;
    let modelShortName = 'gemini-1.0-pro'; // 기본 모델 설정

    // TTS가 아닌 경우 (번역, 채팅, 답변 추천) 모델 동적 선택 필요
    if (action !== 'tts') {
    if (!cachedModel) {
        const listModelsRes = await fetch(
            `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`
        );
        if (!listModelsRes.ok) {
            const errData = await listModelsRes.json();
            throw new Error(`Google API (ListModels) 오류: ${JSON.stringify(errData)}`);
        }
        const modelData = await listModelsRes.json();
        const availableModels = modelData.models || [];
        cachedModel =
            availableModels.find(m => m.name.includes('flash') && m.supportedGenerationMethods.includes('generateContent')) ||
            availableModels.find(m => m.name.includes('gemini-1.0-pro') && m.supportedGenerationMethods.includes('generateContent')) ||
            availableModels.find(m => m.name.includes('gemini-pro') && m.supportedGenerationMethods.includes('generateContent')) ||
            { name: 'models/gemini-1.0-pro' };
    }

    modelShortName = cachedModel.name.split('/').pop();
    apiUrl = `https://generativelanguage.googleapis.com/v1/models/${modelShortName}:generateContent?key=${apiKey}`;
}


    // 3. 액션별 요청 본문 설정
    if (action === 'translate') {
        const prompt = systemPrompt || `Translate this Korean text to Chinese: ${text}`;
        apiRequestBody = {
            contents: [{ parts: [{ text: `${prompt}\n\nKorean: "${text}"` }] }]
        };
    } else if (action === 'chat') {
        const chatSystemPrompt = `You are a friendly and encouraging native Chinese speaker named "Ling" (灵). Your goal is to have a natural, casual conversation with a user who is learning Chinese.
- Keep your responses concise (1-2 short sentences).
- Ask questions to keep the conversation going.
- If the user makes a small grammar mistake, gently correct it by using the correct form in your response. For example, if they say "我昨天去公园了玩", you can respond with "哦，你昨天去公园玩了啊！公园里人多吗？" without explicitly pointing out the mistake.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object must have these exact keys: "chinese", "pinyin", "korean".
- "chinese": Your response in simplified Chinese characters.
- "pinyin": The pinyin for your Chinese response.
- "korean": A natural Korean translation of your Chinese response.`;

        // [오류 수정] 'correction' 블록을 'chat' 블록 밖으로 이동시켰습니다.
        const contents = [
            { role: "user", parts: [{ text: "Please follow these instructions for all future responses: " + chatSystemPrompt }] },
            { role: "model", parts: [{ text: "Okay, I understand. I will act as Ling and respond in the required JSON format." }] },
            ...history,
            { role: "user", parts: [{ text: text }] }
        ];
        apiRequestBody = { contents };
    }
    // [오류 수정] 'correction' 블록이 'chat' 블록 밖의 올바른 위치로 이동했습니다.
    else if (action === 'correction') {
        const prompt = `Please correct the following Chinese sentence and explain why it is incorrect. 
    Respond ONLY in JSON with keys: "corrected", "pinyin", "explanation" (Korean).
    Example: {"corrected":"我昨天去了公园玩。","pinyin":"Wǒ zuótiān qùle gōngyuán wán.","explanation":"‘了’의 위치가 잘못되었음"}`;
        apiRequestBody = {
            contents: [{ parts: [{ text: `${prompt}\n\nSentence: "${text}"` }] }]
        };
    }
    // --- [FEATURE UPDATE START: Suggest Reply with Pinyin & Korean] ---
    else if (action === 'suggest_reply') {
        // [수정] 시스템 프롬프트: korean 필드 추가 요청
        const suggestSystemPrompt = `Based on the previous conversation history, suggest 1 or 2 simple and natural next replies in Chinese for the user who is learning Chinese. The user just received the last message from the AI model.
- Provide only the suggested replies with their pinyin and Korean meaning.
- Your entire response MUST be a single, valid JSON object containing a key "suggestions" which is an array of objects.
- Each object in the "suggestions" array must have three keys: "chinese" (string), "pinyin" (string), and "korean" (string, the Korean meaning).
- Example: {"suggestions": [{"chinese": "你好!", "pinyin": "Nǐ hǎo!", "korean": "안녕하세요!"}, {"chinese": "谢谢你。", "pinyin": "Xièxie nǐ.", "korean": "고마워요."}]}
- Do not include any other text or markdown backticks.`;

         const contents = [
            { role: "user", parts: [{ text: suggestSystemPrompt }] },
            { role: "model", parts: [{ text: "Okay, I will provide reply suggestions including pinyin and Korean meaning in the specified JSON format." }] }, // AI 응답 수정
            ...history
        ];
        apiRequestBody = { contents };
    }
    // --- [FEATURE UPDATE END] ---
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

    // 번역, 채팅, 답변 추천 응답 처리 (v1 응답 구조 확인)
    if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content || !data.candidates[0].content.parts || data.candidates[0].content.parts.length === 0) {
        console.error("Invalid response structure from Google API:", data);
        // ... (이전 오류 처리 로직 동일) ...
         if (data.promptFeedback && data.promptFeedback.blockReason) {
             throw new Error(`AI 응답 생성 실패 (안전 필터): ${data.promptFeedback.blockReason}`);
        } else if (data.candidates && data.candidates.length > 0 && data.candidates[0].finishReason && data.candidates[0].finishReason !== 'STOP') {
             throw new Error(`AI 응답 생성 중단됨: ${data.candidates[0].finishReason}`);
        } else if (data.candidates && data.candidates.length === 0) {
             throw new Error(`AI 응답 생성 실패: Candidates 배열이 비어있습니다.`);
        }
        throw new Error("AI로부터 유효한 응답 구조를 받지 못했습니다. (candidates 확인 실패)");
    }

    // --- [BUG FIX & FEATURE UPDATE START: Suggest Reply Parsing] ---
     if (action === 'suggest_reply') {
        let suggestionData = null;
        let foundSuggestions = false;
        // 여러 'parts' 중에서 'suggestions' 키를 포함하는 유효한 JSON 문자열 찾기
        for (const part of data.candidates[0].content.parts) {
            try {
                // 앞뒤 공백 및 줄바꿈 제거 후 파싱 시도
                const cleanedText = part.text.trim();
                // 가끔 마크다운 ```json ... ``` 이 포함될 수 있으므로 제거
                const jsonText = cleanedText.replace(/^```json\s*|\s*```$/g, '');
                const parsedPart = JSON.parse(jsonText);

                // suggestions 키가 있고, 배열이며, 비어있지 않고, 모든 요소가 필요한 키를 포함하는지 확인
                if (parsedPart.suggestions && Array.isArray(parsedPart.suggestions) &&
                    parsedPart.suggestions.length > 0 &&
                    parsedPart.suggestions.every(item => // [수정] every()로 모든 요소 검사
                        typeof item === 'object' &&
                        item.hasOwnProperty('chinese') &&
                        item.hasOwnProperty('pinyin') &&
                        item.hasOwnProperty('korean') // [추가] korean 키 확인
                    ))
                {
                    suggestionData = parsedPart;
                    foundSuggestions = true;
                    break; // 유효한 데이터 찾으면 반복 중단
                } else if (parsedPart.suggestions && Array.isArray(parsedPart.suggestions) && parsedPart.suggestions.length === 0) {
                    // 빈 배열도 정상으로 간주
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
            throw new Error("AI로부터 유효한 답변 추천(병음, 뜻 포함) JSON 형식을 찾지 못했습니다."); // 오류 메시지 수정
        }
    }
    // --- [BUG FIX & FEATURE UPDATE END] ---

    // 번역 및 채팅은 data 전체를 반환 (프론트엔드에서 파싱)
    return response.status(200).json(data);

  } catch (error) {
    console.error('서버 함수 오류:', error);
    return response.status(500).json({ error: error.message });
  }
}


// v.2025.10.20_1101-10