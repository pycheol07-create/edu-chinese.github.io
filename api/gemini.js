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
            // v1은 JSON 응답 스키마 강제 불가, 프롬프트로 유도
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
    // --- [NEW] 답변 추천 액션 추가 ---
    else if (action === 'suggest_reply') {
        const suggestSystemPrompt = `Based on the previous conversation history, suggest 1 or 2 simple and natural next replies in Chinese for the user who is learning Chinese. The user just received the last message from the AI model.
- Provide only the suggested replies.
- Your entire response MUST be a single, valid JSON object containing a key "suggestions" which is an array of strings (the suggested Chinese replies). Example: {"suggestions": ["你好!", "谢谢你。"]}
- Do not include any other text or markdown backticks.`;

         const contents = [
            // 시스템 프롬프트 주입 (역할 설명)
            { role: "user", parts: [{ text: suggestSystemPrompt }] },
            { role: "model", parts: [{ text: "Okay, I will provide reply suggestions in the specified JSON format." }] },
            // 실제 대화 기록 전달
            ...history
        ];
        apiRequestBody = { contents };
    }
    // --- 답변 추천 액션 끝 ---
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

    // 번역, 채팅, 답변 추천 응답 처리
    // v1 응답은 candidates[0].content.parts[0].text 에 결과가 있음
    // 답변 추천의 경우, 응답 자체가 { suggestions: [...] } 형태의 JSON 문자열일 것으로 예상
     if (action === 'suggest_reply') {
         try {
            // AI가 JSON 형식의 문자열을 반환했다고 가정
            const suggestionData = JSON.parse(data.candidates[0].content.parts[0].text);
            return response.status(200).json(suggestionData); // { suggestions: [...] } 객체 반환
         } catch (e) {
             console.error("Failed to parse suggestion response:", data.candidates[0].content.parts[0].text);
             throw new Error("AI로부터 유효한 답변 추천 형식을 받지 못했습니다.");
         }
    }

    // 번역 및 채팅은 기존 로직 유지 (data 자체를 반환)
    return response.status(200).json(data);

  } catch (error) {
    console.error('서버 함수 오류:', error);
    return response.status(500).json({ error: error.message });
  }
}

// v.2025.10.20_1032-5