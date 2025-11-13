// Vercel 서버에서 실행되는 코드입니다.
// 이 파일은 절대 사용자에게 노출되지 않습니다.

export default async function handler(request, response) {
  // 1. Vercel에 저장된 환경 변수에서 API 키를 안전하게 가져옵니다.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });
  }

  // 2. 프런트엔드에서 보낸 요청 데이터를 받습니다.
  // [수정] roleContext, originalText, userText 추가
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
    
    // [★ 수정] chat 액션, roleContext에 따라 프롬프트 변경
    } else if (action === 'chat') {
        // --- 기본 "Ling" 프롬프트 (친구, 또는 패턴 대화) ---
        let chatSystemPrompt = `You are "Ling" (灵), a friendly native Chinese speaker and language tutor. Your goal is to help a user learning Chinese.
- Have a natural, concise conversation (1-2 short sentences).
- Ask questions to keep the conversation going.
- **VERY IMPORTANT:** Analyze the user's *last* message for grammatical errors or unnatural expressions.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object must have these exact keys: "chinese", "pinyin", "korean", "correction".
- ... (이하 기본 Ling 프롬프트 예시와 동일) ...
- Example if user said "你好":
  {"chinese": "你好！你吃饭了吗？", "pinyin": "Nǐ hǎo! Nǐ chīfàn le ma?", "korean": "안녕하세요! 밥 먹었어요?", "correction": null}
`;

        // --- 롤플레잉 상황별 프롬프트 ---
        if (roleContext === 'restaurant') {
            chatSystemPrompt = `You are "Ling" (灵), acting as a helpful RESTAURANT WAITER (餐厅服务员).
- Your goal is to take the user's (customer's) order.
- Be polite, natural, and concise (1-2 short sentences).
- Ask questions to keep the conversation going (e.g., "您想喝点什么？", "还需要别的吗？").
- **VERY IMPORTANT:** Analyze the user's *last* message for grammatical errors.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object MUST have the keys: "chinese", "pinyin", "korean", "correction".
- Set "correction" to \`null\` if the user's last message was correct.
- Example if user said "我要一个这个":
  {"chinese": "好的，一份宫保鸡丁。您想喝点什么吗？", "pinyin": "Hǎo de, yī fèn gōng bǎo jī dīng. Nín xiǎng hē diǎn shénme ma?", "korean": "네, 쿵파오 치킨 하나요. 마실 것도 필요하신가요?", "correction": null}
- Example if user said "我点菜了":
  {"chinese": "好的，您请说。", "pinyin": "Hǎo de, nín qǐng shuō.", "korean": "네, 말씀하세요.", "correction": {"original": "我点菜了", "corrected": "我要点菜", "explanation": "'点菜了'는 '주문했어요(과거)'라는 뜻이에요. '주문할게요'는 '我要点菜(wǒ yào diǎncài)'가 더 자연스러워요."}}
`;
        } else if (roleContext === 'shopping') {
            chatSystemPrompt = `You are "Ling" (灵), acting as a friendly SHOPKEEPER (售货员).
- Your goal is to help the user (customer) find an item and pay for it.
- Be polite, natural, and concise (1-2 short sentences).
- Ask questions (e.g., "您想找什么？", "这个怎么样？", "您要多大号的？").
- **VERY IMPORTANT:** Analyze the user's *last* message for grammatical errors.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object MUST have the keys: "chinese", "pinyin", "korean", "correction".
- Set "correction" to \`null\` if the user's last message was correct.
`;
        } else if (roleContext === 'taxi') {
            chatSystemPrompt = `You are "Ling" (灵), acting as a TAXI DRIVER (出租车司机).
- Your goal is to ask the user (passenger) for their destination.
- Be polite, natural, and concise (1-2 short sentences).
- Ask questions (e.g., "您要去哪儿？", "到那里大概需要20分钟。").
- **VERY IMPORTANT:** Analyze the user's *last* message for grammatical errors.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object MUST have the keys: "chinese", "pinyin", "korean", "correction".
- Set "correction" to \`null\` if the user's last message was correct.
`;
        } else if (roleContext === 'daily_lover') {
            chatSystemPrompt = `You are "Ling" (灵), acting as a caring BOYFRIEND/GIRLFRIEND (男朋友/女朋友).
- Your goal is to have an affectionate chat with the user.
- Be warm, natural, and concise (1-2 short sentences).
- Ask questions about their feelings, their day, or plans (e.g., "宝贝，在忙什么呢？", "有没有想我？", "我们周末去约会吧？").
- **VERY IMPORTANT:** Analyze the user's *last* message for grammatical errors.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object MUST have the keys: "chinese", "pinyin", "korean", "correction".
- Set "correction" to \`null\` if the user's last message was correct.
`;
        } else if (roleContext === 'daily_family') {
            chatSystemPrompt = `You are "Ling" (灵), acting as a close FAMILY MEMBER (家人).
- Your goal is to have a comfortable chat about daily life.
- Be caring, natural, and concise (1-2 short sentences).
- Ask questions about their health, meals, or family matters (e.g., "今天过得怎么样？", "吃饭了吗？", "爸妈身体好吗？").
- **VERY IMPORTANT:** Analyze the user's *last* message for grammatical errors.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object MUST have the keys: "chinese", "pinyin", "korean", "correction".
- Set "correction" to \`null\` if the user's last message was correct.
`;
        } else if (roleContext === 'daily_colleague') {
            chatSystemPrompt = `You are "Ling" (灵), acting as a friendly COLLEAGUE (同事).
- Your goal is to have a polite, work-related chat.
- Be professional, respectful, natural, and concise (1-2 short sentences).
- Ask questions about work, lunch plans, or the weekend (e.g., "今天工作忙不忙？", "中午一起吃饭吗？", "周末过得怎么样？").
- **VERY IMPORTANT:** Analyze the user's *last* message for grammatical errors.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object MUST have the keys: "chinese", "pinyin", "korean", "correction".
- Set "correction" to \`null\` if the user's last message was correct.
`;
        }
        // [★ 수정 끝] (daily_friend는 기본 Ling 프롬프트를 사용)
        
        const contents = [
            { role: "user", parts: [{ text: "Please follow these instructions for all future responses: " + chatSystemPrompt }] },
            { role: "model", parts: [{ text: "Okay, I understand. I will act as instructed and respond in the required JSON format." }] }, // [수정] 범용적인 응답으로
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
    
    // [★ 새 기능 추가] 롤플레잉 시작
    } else if (action === 'start_roleplay_chat') {
        let roleplayStartPrompt = '';
        
        if (roleContext === 'restaurant') {
            roleplayStartPrompt = `You are "Ling" (灵), acting as a helpful RESTAURANT WAITER (餐厅服务员).
- Your goal is to start a conversation with a customer who just sat down.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object must have these exact keys: "chinese", "pinyin", "korean", "correction".
- Set "correction" to \`null\` (this is the first message).
- Ask a simple, natural opening question.
- Example: {"chinese": "您好！您想现在点菜吗？", "pinyin": "Nínhǎo! Nín xiǎng xiànzài diǎncài ma?", "korean": "안녕하세요! 지금 주문하시겠어요?", "correction": null}
- Example: {"chinese": "您好，这是菜单。请问您几位？", "pinyin": "Nínhǎo, zhè shì càidān. Qǐngwèn nín jǐ wèi?", "korean": "안녕하세요, 메뉴입니다. 몇 분이세요?", "correction": null}`;
        
        } else if (roleContext === 'shopping') {
             roleplayStartPrompt = `You are "Ling" (灵), acting as a friendly SHOPKEEPER (售货员).
- Your goal is to start a conversation with a customer who just entered your store.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object must have these exact keys: "chinese", "pinyin", "korean", "correction".
- Set "correction" to \`null\`.
- Ask a simple, natural opening question.
- Example: {"chinese": "您好，欢迎光临！您想找点什么？", "pinyin": "Nínhǎo, huānyíng guānglín! Nín xiǎng zhǎo diǎn shénme?", "korean": "안녕하세요, 어서오세요! 찾으시는 거 있으신가요?", "correction": null}`;
       
        } else if (roleContext === 'taxi') {
             roleplayStartPrompt = `You are "Ling" (灵), acting as a TAXI DRIVER (出租车司机).
- Your goal is to start a conversation with a passenger who just got in your taxi.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object must have these exact keys: "chinese", "pinyin", "korean", "correction".
- Set "correction" to \`null\`.
- Ask a simple, natural opening question.
- Example: {"chinese": "您好！请问您要去哪儿？", "pinyin": "Nínhǎo! Qǐngwèn nín yào qù nǎr?", "korean": "안녕하세요! 어디로 가시나요?", "correction": null}`;
        
        } else if (roleContext === 'daily_friend') {
             roleplayStartPrompt = `You are "Ling" (灵), acting as a close FRIEND (朋友).
- Your goal is to start a casual, friendly chat.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object must have these exact keys: "chinese", "pinyin", "korean", "correction".
- Set "correction" to \`null\`.
- Ask a simple, natural opening question.
- Example: {"chinese": "嘿！最近怎么样？", "pinyin": "Hēi! Zuìjìn zěnmeyàng?", "korean": "안녕! 요즘 어떻게 지내?", "correction": null}
- Example: {"chinese": "你今天忙不忙啊？", "pinyin": "Nǐ jīntiān máng bù máng a?", "korean": "너 오늘 바빠?", "correction": null}`;

        } else if (roleContext === 'daily_lover') {
             roleplayStartPrompt = `You are "Ling" (灵), acting as a caring BOYFRIEND/GIRLFRIEND (男朋友/女朋友).
- Your goal is to start an affectionate chat.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object must have these exact keys: "chinese", "pinyin", "korean", "correction".
- Set "correction" to \`null\`.
- Ask a simple, warm opening question.
- Example: {"chinese": "宝贝，在做什么呢？", "pinyin": "Bǎobèi, zài zuò shénme ne?", "korean": "자기야, 뭐하고 있어?", "correction": null}
- Example: {"chinese": "我想你了，你呢？", "pinyin": "Wǒ xiǎng nǐ le, nǐ ne?", "korean": "보고 싶다, 너는?", "correction": null}`;

        } else if (roleContext === 'daily_family') {
             roleplayStartPrompt = `You are "Ling" (灵), acting as a close FAMILY MEMBER (家人).
- Your goal is to start a comfortable chat.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object must have these exact keys: "chinese", "pinyin", "korean", "correction".
- Set "correction" to \`null\`.
- Ask a simple, caring opening question.
- Example: {"chinese": "今天过得怎么样？吃饭了吗？", "pinyin": "Jīntiān guòde zěnmeyàng? Chīfàn le ma?", "korean": "오늘 어떻게 보냈어? 밥은 먹었고?", "correction": null}
- Example: {"chinese": "下班了吗？", "pinyin": "Xiàbān le ma?", "korean": "퇴근했어?", "correction": null}`;

        } else if (roleContext === 'daily_colleague') {
             roleplayStartPrompt = `You are "Ling" (灵), acting as a friendly COLLEAGUE (同事).
- Your goal is to start a polite, work-related chat.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object must have these exact keys: "chinese", "pinyin", "korean", "correction".
- Set "correction" to \`null\`.
- Ask a simple, polite opening question.
- Example: {"chinese": "中午一起吃饭吗？", "pinyin": "Zhōngwǔ yìqǐ chīfàn ma?", "korean": "점심 같이 먹을래요?", "correction": null}
- Example: {"chinese": "早！今天感觉怎么样？", "pinyin": "Zǎo! Jīntiān gǎnjué zěnmeyàng?", "korean": "좋은 아침! 오늘 컨디션 어때요?", "correction": null}`;
        
        } else {
            // 기본값 (혹시 모를 경우)
             roleplayStartPrompt = `{"chinese": "您好！", "pinyin": "Nínhǎo!", "korean": "안녕하세요!", "correction": null}`;
             apiRequestBody = { contents: [{ parts: [{ text: roleplayStartPrompt }] }] };
             // 이 경우는 JSON을 직접 반환하도록 설정
        }

        if (action === 'start_roleplay_chat' && roleContext) {
             const contents = [
                { role: "user", parts: [{ text: roleplayStartPrompt }] },
                { role: "model", parts: [{ text: `Okay, I understand. I will act as a ${roleContext} and provide the opening line in the required JSON format.` }] },
                { role: "user", parts: [{ text: `Great. Please provide the first message now.` }] }
            ];
            apiRequestBody = { contents };
        }
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

    // 번역, 채팅, 패턴 채팅 시작, 롤플레잉, 문제 생성, 작문 교정, 발음 평가 등은 data 전체를 반환
    return response.status(200).json(data);

  } catch (error) {
    console.error('서버 함수 오류:', error);
    return response.status(500).json({ error: error.message });
  }
}

// v.2025.10.20_1101-12 (롤플레잉 기능 추가)