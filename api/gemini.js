// Vercel 서버에서 실행되는 코드입니다.
// 이 파일은 절대 사용자에게 노출되지 않습니다.

export default async function handler(request, response) {
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
        const listModelsRes = await fetch(
            `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`
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
        const chatSystemPrompt = `You are a friendly and encouraging native Chinese speaker named "Ling" (灵). Your goal is to have a natural, casual conversation with a user who is learning Chinese.
- Keep your responses concise (1-2 short sentences).
- Ask questions to keep the conversation going.
- If the user makes a small grammar mistake, gently correct it by using the correct form in your response. For example, if they say "我昨天去公园了玩", you can respond with "哦，你昨天去公园玩了啊！公园里人多吗？" without explicitly pointing out the mistake.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object must have these exact keys: "chinese", "pinyin", "korean".
- "chinese": Your response in simplified Chinese characters.
- "pinyin": The pinyin for your Chinese response.
- "korean": A natural Korean translation of your Chinese response.`;

        const contents = [
            { role: "user", parts: [{ text: "Please follow these instructions for all future responses: " + chatSystemPrompt }] },
            { role: "model", parts: [{ text: "Okay, I understand. I will act as Ling and respond in the required JSON format." }] },
            ...history,
            { role: "user", parts: [{ text: text }] }
        ];
        apiRequestBody = { contents };
    }
    // --- [FEATURE UPDATE START: Suggest Reply with Pinyin] ---
    else if (action === 'suggest_reply') {
        // [수정] 시스템 프롬프트: suggestions 배열 안에 chinese와 pinyin을 포함한 객체를 넣도록 요청
        const suggestSystemPrompt = `Based on the previous conversation history, suggest 1 or 2 simple and natural next replies in Chinese for the user who is learning Chinese. The user just received the last message from the AI model.
- Provide only the suggested replies with their pinyin.
- Your entire response MUST be a single, valid JSON object containing a key "suggestions" which is an array of objects.
- Each object in the "suggestions" array must have two keys: "chinese" (string) and "pinyin" (string).
- Example: {"suggestions": [{"chinese": "你好!", "pinyin": "Nǐ hǎo!"}, {"chinese": "谢谢你。", "pinyin": "Xièxie nǐ."}]}
- Do not include any other text or markdown backticks.`;

         const contents = [
            { role: "user", parts: [{ text: suggestSystemPrompt }] },
            { role: "model", parts: [{ text: "Okay, I will provide reply suggestions including pinyin in the specified JSON format." }] }, // AI의 이해 확인 응답 수정
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
        if (data.promptFeedback && data.promptFeedback.blockReason) {
             throw new Error(`AI 응답 생성 실패 (안전 필터): ${data.promptFeedback.blockReason}`);
        } else if (data.candidates && data.candidates.length > 0 && data.candidates[0].finishReason && data.candidates[0].finishReason !== 'STOP') {
             throw new Error(`AI 응답 생성 중단됨: ${data.candidates[0].finishReason}`);
        } else if (data.candidates && data.candidates.length === 0) {
             throw new Error(`AI 응답 생성 실패: Candidates 배열이 비어있습니다.`);
        }
        throw new Error("AI로부터 유효한 응답 구조를 받지 못했습니다. (candidates 확인 실패)");
    }

    // --- [FEATURE UPDATE START: Suggest Reply with Pinyin Parsing] ---
     if (action === 'suggest_reply') {
        let suggestionData = null;
        let foundSuggestions = false;
        // 여러 'parts' 중에서 'suggestions' 키를 포함하는 JSON 문자열 찾기
        for (const part of data.candidates[0].content.parts) {
            try {
                const parsedPart = JSON.parse(part.text);
                // suggestions 키가 있고, 배열이며, 배열의 첫 요소가 chinese와 pinyin을 포함하는 객체인지 확인
                if (parsedPart.suggestions && Array.isArray(parsedPart.suggestions) &&
                    parsedPart.suggestions.length > 0 && // 배열이 비어있지 않고
                    typeof parsedPart.suggestions[0] === 'object' && // 첫 요소가 객체이며
                    parsedPart.suggestions[0].hasOwnProperty('chinese') && // 'chinese' 키가 있고
                    parsedPart.suggestions[0].hasOwnProperty('pinyin')      // 'pinyin' 키가 있는지
                   )
                {
                    suggestionData = parsedPart;
                    foundSuggestions = true;
                    break; // 찾았으면 반복 중단
                } else if (parsedPart.suggestions && Array.isArray(parsedPart.suggestions) && parsedPart.suggestions.length === 0) {
                    // suggestions 배열은 있지만 비어있는 경우도 정상 처리
                    suggestionData = parsedPart;
                    foundSuggestions = true;
                    break;
                }
            } catch (e) {
                console.warn("Ignoring non-JSON or invalid JSON part in suggest_reply:", part.text);
            }
        }

        if (foundSuggestions) {
            // 빈 배열일 수도 있으므로 suggestions 키 존재 여부만 확인 후 반환
            return response.status(200).json(suggestionData);
        } else {
            console.error("Could not find valid 'suggestions' JSON object array in any response parts:", JSON.stringify(data.candidates[0].content.parts, null, 2));
            throw new Error("AI로부터 유효한 답변 추천(병음 포함) JSON 형식을 찾지 못했습니다.");
        }
    }
    // --- [FEATURE UPDATE END] ---

    // 번역 및 채팅은 data 전체를 반환 (프론트엔드에서 파싱)
    return response.status(200).json(data);

  } catch (error) {
    console.error('서버 함수 오류:', error);
    return response.status(500).json({ error: error.message });
  }
}

// v.2025.10.20_1056-9