// Vercel 서버에서 실행되는 코드입니다.
// 이 파일은 절대 사용자에게 노출되지 않습니다.

export default async function handler(request, response) {
  // 1. Vercel에 저장된 환경 변수에서 API 키를 안전하게 가져옵니다.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });
  }

  // 2. 프런트엔드에서 보낸 요청 데이터를 받습니다.
  const { action, text, systemPrompt, history, pattern, originalText, userText, roleContext } = request.body;

  try {
    let apiUrl;
    let apiRequestBody;
    let modelShortName = 'gemini-1.0-pro'; // 기본 모델 설정

    // TTS가 아닌 경우 (번역, 채팅, 답변 추천, 패턴 채팅 시작, 문제 생성 등) 모델 동적 선택 필요
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
             console.log("Using model:", modelShortName);
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
        // --- 기본 "Ling" 프롬프트 ---
        let chatSystemPrompt = `You are "Ling" (灵), a friendly native Chinese speaker and language tutor. Your goal is to help a user learning Chinese.
- Have a natural, concise conversation (1-2 short sentences).
- ... (이하 기본 Ling 프롬프트 예시와 동일) ...
`;

        // --- 롤플레잉 상황별 프롬프트 ---
        if (roleContext === 'restaurant') {
            chatSystemPrompt = `You are "Ling" (灵), acting as a helpful RESTAURANT WAITER (餐厅服务员).
- ... (이하 식당 프롬프트) ...
`;
        } else if (roleContext === 'shopping') {
            chatSystemPrompt = `You are "Ling" (灵), acting as a friendly SHOPKEEPER (售货员).
- ... (이하 쇼핑 프롬프트) ...
`;
        } else if (roleContext === 'taxi') {
            chatSystemPrompt = `You are "Ling" (灵), acting as a TAXI DRIVER (出租车司机).
- ... (이하 택시 프롬프트) ...
`;
        }
        
        const contents = [
            { role: "user", parts: [{ text: "Please follow these instructions for all future responses: " + chatSystemPrompt }] },
            { role: "model", parts: [{ text: "Okay, I understand. I will act as instructed and respond in the required JSON format." }] }, 
            ...history,
            { role: "user", parts: [{ text: text }] }
        ];
        apiRequestBody = { contents };
    
    } else if (action === 'start_chat_with_pattern') {
        const startChatSystemPrompt = `... (생략) ...`;
        const contents = [
            { role: "user", parts: [{ text: startChatSystemPrompt }] },
            { role: "model", parts: [{ text: `Okay, I understand. I will act as Ling and respond in the required JSON format.` }] },
            { role: "user", parts: [{ text: `Great. Now, please start the conversation by asking me a question using the pattern "${pattern}".` }] }
        ];
        apiRequestBody = { contents };
    
    } else if (action === 'start_roleplay_chat') {
        let roleplayStartPrompt = '';
        
        if (roleContext === 'restaurant') {
            roleplayStartPrompt = `You are "Ling" (灵), acting as a helpful RESTAURANT WAITER (餐厅服务员).
- ... (생략: 식당 첫인사) ...
`;
        
        } else if (roleContext === 'shopping') {
             roleplayStartPrompt = `You are "Ling" (灵), acting as a friendly SHOPKEEPER (售货员).
- ... (생략: 쇼핑 첫인사) ...
`;
       
        } else if (roleContext === 'taxi') {
             roleplayStartPrompt = `You are "Ling" (灵), acting as a TAXI DRIVER (出租车司机).
- ... (생략: 택시 첫인사) ...
`;
        
        } else {
             roleplayStartPrompt = `{"chinese": "您好！", "pinyin": "Nínhǎo!", "korean": "안녕하세요!", "correction": null}`;
             apiRequestBody = { contents: [{ parts: [{ text: roleplayStartPrompt }] }] };
        }

        if (action === 'start_roleplay_chat' && roleContext) {
             const contents = [
                { role: "user", parts: [{ text: roleplayStartPrompt }] },
                { role: "model", parts: [{ text: `Okay, I understand. I will act as a ${roleContext} and provide the opening line in the required JSON format.` }] },
                { role: "user", parts: [{ text: `Great. Please provide the first message now.` }] }
            ];
            apiRequestBody = { contents };
        }

    // [★ 새 기능 추가] 듣기 대본 생성
    } else if (action === 'generate_listening_script') {
        let scriptTitle = "듣기 대본";
        let scriptContextPrompt = "";

        if (roleContext === 'restaurant') {
            scriptTitle = "🍽️ 식당에서 주문하기";
            scriptContextPrompt = "a simple 4-6 turn dialogue between a customer (A) and a waiter (B) at a Chinese restaurant.";
        } else if (roleContext === 'airport') {
            scriptTitle = "✈️ 공항에서 체크인하기";
            scriptContextPrompt = "a simple 4-6 turn dialogue between a passenger (A) and an airline staff (B) at an airport check-in counter.";
        } else if (roleContext === 'campus') {
            scriptTitle = "🧑‍🎓 캠퍼스에서 대화하기";
            scriptContextPrompt = "a simple 4-6 turn dialogue between two students (A and B) on a university campus talking about classes or homework.";
        } else {
            scriptContextPrompt = "a simple 4-6 turn dialogue between two native Chinese speakers (A and B).";
        }

        const scriptSystemPrompt = `You are a scriptwriter for Chinese language learners.
- Your task is to generate ${scriptContextPrompt}
- The dialogue should be natural, practical, and easy to understand for a learner.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object must have these exact keys: "title" (string) and "dialogue" (array of objects).
- The "title" key should be: "${scriptTitle}"
- Each object in the "dialogue" array must have these exact keys: "speaker" (string, "A" or "B"), "chinese" (string), "pinyin" (string), and "korean" (string).

- Example Response (for 'restaurant'):
{
  "title": "🍽️ 식당에서 주문하기",
  "dialogue": [
    { "speaker": "A", "chinese": "你好，我想点菜。", "pinyin": "Nǐ hǎo, wǒ xiǎng diǎn cài.", "korean": "안녕하세요, 주문하고 싶어요." },
    { "speaker": "B", "chinese": "好的，这是菜单。您想吃点什么？", "pinyin": "Hǎo de, zhè shì càidān. Nín xiǎng chī diǎn shénme?", "korean": "네, 메뉴입니다. 무엇을 드시겠어요?" },
    { "speaker": "A", "chinese": "我要一个宫保鸡丁。", "pinyin": "Wǒ yào yīgè gōng bǎo jī dīng.", "korean": "저는 쿵파오 치킨 하나 주세요." },
    { "speaker": "B", "chinese": "好的。您想喝点什么吗？", "pinyin": "Hǎo de. Nín xiǎng hē diǎn shénme ma?", "korean": "알겠습니다. 마실 것도 필요하신가요?" }
  ]
}
`;
        const contents = [
            { role: "user", parts: [{ text: scriptSystemPrompt }] },
            { role: "model", parts: [{ text: "Okay, I understand. I will generate the listening script in the requested JSON format." }] },
            { role: "user", parts: [{ text: "Please generate the script now." }] }
        ];
        apiRequestBody = { contents };
    // [★ 추가 완료]

    } else if (action === 'generate_practice') {
        const practiceSystemPrompt = `... (생략) ...`;
        const contents = [
            { role: "user", parts: [{ text: practiceSystemPrompt }] },
            { role: "model", parts: [{ text: `Okay, I understand. I will generate a new practice problem for the pattern "${pattern}" in the specified JSON format, including "practiceVocab".` }] },
            { role: "user", parts: [{ text: `Great. Now, please generate the practice problem for the pattern "${pattern}".` }] } 
        ];
        apiRequestBody = { contents };
        
    } else if (action === 'correct_writing') {
        const correctionSystemPrompt = `... (생략) ...`;
        const contents = [
            { role: "user", parts: [{ text: correctionSystemPrompt }] },
            { role: "model", parts: [{ text: "Okay, I understand. I will correct the user's text and respond in the required JSON format (corrected_sentence, explanation)." }] },
            { role: "user", parts: [{ text: `Please correct the following text: "${text}"` }] }
        ];
        apiRequestBody = { contents };
        
    } else if (action === 'get_writing_topic') {
        const topicSystemPrompt = `... (생략) ...`;
        const contents = [
            { role: "user", parts: [{ text: topicSystemPrompt }] },
            { role: "model", parts: [{ text: "Okay, I understand. I will provide a simple writing topic in Korean, formatted as the requested JSON." }] },
            { role: "user", parts: [{ text: "Please generate a topic now." }] }
        ];
        apiRequestBody = { contents };

    } else if (action === 'get_character_info') {
        const characterSystemPrompt = `... (생략) ...`;
        const contents = [
            { role: "user", parts: [{ text: characterSystemPrompt }] },
            { role: "model", parts: [{ text: "Okay, I understand. I will provide information for the requested character in the specified JSON format." }] },
            { role: "user", parts: [{ text: `Please provide information for the character: "${text}"` }] }
        ];
        apiRequestBody = { contents };

    } else if (action === 'evaluate_pronunciation') {
        const pronunciationSystemPrompt = `... (생략: 발음 평가 프롬프트) ...`;
        const contents = [
            { role: "user", parts: [{ text: pronunciationSystemPrompt }] },
            { role: "model", parts: [{ text: "Okay, I understand. I will act as a pronunciation coach and respond in the required JSON format (is_correct, feedback)." }] },
            { role: "user", parts: [{ text: `Please evaluate this: Original: "${originalText}", User said: "${userText}"` }] }
        ];
        apiRequestBody = { contents };

    } else if (action === 'suggest_reply') {
        const suggestSystemPrompt = `... (생략) ...`;
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

    // ... (기존 응답 처리 코드)
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

                if (parsedPart.suggestions && Array.isArray(parsedPart.suggestions)) {
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
            console.error("Could not find valid 'suggestions' JSON object array in any response parts:", JSON.stringify(data.candidates[0].content.parts, null, 2));
            throw new Error("AI로부터 유효한 답변 추천(병음, 뜻 포함) JSON 형식을 찾지 못했습니다."); 
        }
    }

    // 번역, 채팅, 패턴 채팅 시작, 롤플레잉, 듣기 대본, 문제 생성, 작문 교정, 발음 평가 등은 data 전체를 반환
    return response.status(200).json(data);

  } catch (error) {
    console.error('서버 함수 오류:', error);
    return response.status(500).json({ error: error.message });
  }
}

// v.2025.10.20_1101-13 (듣기 대본 생성 추가)