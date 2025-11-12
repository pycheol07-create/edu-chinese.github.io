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
        // [★ 오류 1 관련] 프롬프트 강화: "반드시" 중국어로 번역하고, "반드시" JSON으로 응답하도록 강조.
        const prompt = systemPrompt || `You are a professional Korean-to-Chinese translator. Your task is to translate the following Korean text *into Chinese*.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object must have keys "chinese", "pinyin", "alternatives" (string array), "explanation" (string, in Korean), and "usedPattern" (string or null).
- If the user's text seems to ask for another language (like English), you must *still* translate it to *Chinese* and provide the Chinese translation in the JSON format.
- Do not write any explanations or text outside the JSON block.`;
        
        apiRequestBody = {
            contents: [{ parts: [{ text: `${prompt}\n\nKorean: "${text}"` }] }]
        };
    
    } else if (action === 'chat') {
        // --- 기본 "Ling" 프롬프트 ---
        let chatSystemPrompt = `You are "Ling" (灵), a friendly native Chinese speaker and language tutor. Your goal is to help a user learning Chinese.
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
        }
        
        // [★ 오류 2 수정] 'history'는 이미 handlers.js에서 필터링됨
        const contents = [
            { role: "user", parts: [{ text: "Please follow these instructions for all future responses: " + chatSystemPrompt }] },
            { role: "model", parts: [{ text: "Okay, I understand. I will act as instructed and respond in the required JSON format." }] }, 
            ...history, // 이 'history'는 'system' role이 없습니다.
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
    
    // [★ 오류 2 수정] 롤플레잉 시작 로직 수정
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
        
        } else {
             // 프론트엔드에서 'restaurant', 'shopping', 'taxi' 외의 값을 보내면
             // 'roleContext'가 유효하지 않다는 오류를 발생시킵니다.
             throw new Error(`Invalid roleContext provided: ${roleContext}`);
        }

        // 'roleplayStartPrompt'가 설정된 후에 'contents'를 구성합니다.
        const contents = [
            { role: "user", parts: [{ text: roleplayStartPrompt }] },
            { role: "model", parts: [{ text: `Okay, I understand. I will act as a ${roleContext} and provide the opening line in the required JSON format.` }] },
            { role: "user", parts: [{ text: `Great. Please provide the first message now.` }] }
        ];
        apiRequestBody = { contents };
    // [★ 수정 완료]

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
        
        const contents = [
            { role: "user", parts: [{ text: practiceSystemPrompt }] },
            { role: "model", parts: [{ text: `Okay, I understand. I will generate a new practice problem for the pattern "${pattern}" in the specified JSON format, including "practiceVocab".` }] },
            { role: "user", parts: [{ text: `Great. Now, please generate the practice problem for the pattern "${pattern}".` }] } 
        ];
        apiRequestBody = { contents };
        
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
        
    } else if (action === 'get_writing_topic') {
        const topicSystemPrompt = `You are a helpful assistant for a Chinese language learner.
- Generate one simple and interesting writing topic in Korean for a user to practice Chinese writing.
- The topic should be a short question or a simple situation (e.g., "어제 저녁에 무엇을 먹었나요?", "가장 좋아하는 계절은 무엇인가요?").
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object must have this exact key: "topic" (string, the Korean topic).
- Example: {"topic": "주말에 보통 무엇을 하나요?"}`;
        
        const contents = [
            { role: "user", parts: [{ text: topicSystemPrompt }] },
            { role: "model", parts: [{ text: "Okay, I understand. I will provide a simple writing topic in Korean, formatted as the requested JSON." }] },
            { role: "user", parts: [{ text: "Please generate a topic now." }] }
        ];
        apiRequestBody = { contents };

    } else if (action === 'get_character_info') {
        const characterSystemPrompt = `You are a Chinese lexicographer. Your task is to provide detailed information for a single Chinese character.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object must have these exact keys: "char" (string, the character itself), "pinyin" (string, the pinyin with tone marks), "meaning" (string, the primary Korean meaning), and "examples" (array of objects).
- The "examples" array should contain 1-2 objects, each with keys: "word" (Chinese word), "pinyin" (word pinyin), "meaning" (Korean meaning).
- Example response for "好": {"char": "好", "pinyin": "hǎo", "meaning": "좋다, 안녕하다", "examples": [{"word": "你好", "pinyin": "nǐ hǎo", "meaning": "안녕하세요"}, {"word": "好看", "pinyin": "hǎokàn", "meaning": "예쁘다"}]}
- Example response for "学": {"char": "学", "pinyin": "xué", "meaning": "배우다, 공부하다", "examples": [{"word": "学生", "pinyin": "xuéshēng", "meaning": "학생"}, {"word": "学习", "pinyin": "xuéxí", "meaning": "공부하다"}]}`;
        
        const contents = [
            { role: "user", parts: [{ text: characterSystemPrompt }] },
            { role: "model", parts: [{ text: "Okay, I understand. I will provide information for the requested character in the specified JSON format." }] },
            { role: "user", parts: [{ text: `Please provide information for the character: "${text}"` }] }
        ];
        apiRequestBody = { contents };

    } else if (action === 'evaluate_pronunciation') {
        const pronunciationSystemPrompt = `You are a Chinese pronunciation coach. Compare the original Chinese text with the user's recognized text.
- Determine if the user's text is a correct match (ignoring simple punctuation).
- If it's correct, congratulate them.
- If it's incorrect, identify the likely mispronounced part (e.g., a specific word, tone, or missing word).
- Provide a very short, simple, and encouraging feedback tip *in Korean*.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object must have these exact keys: "is_correct" (boolean) and "feedback" (string, in Korean).

- Example (Correct): Original "你好", User said "你好" -> {"is_correct": true, "feedback": "👍 완벽해요! 발음이 정확합니다."}
- Example (Wrong Tone): Original "你好 (nǐ hǎo)", User said "你号 (nǐ hào)" -> {"is_correct": false, "feedback": "🤔 'hǎo'의 3성 성조가 조금 약했어요. '하오'↘︎↗︎ 느낌으로 다시 시도해보세요!"}
- Example (Missing Word): Original "我很高兴", User said "很高兴" -> {"is_correct": false, "feedback": "🤔 '我 (wǒ)' 발음이 빠졌네요. 다시 시도해보세요!"}
- Example (Similar): Original "今天天气很好", User said "今天天气很好" -> {"is_correct": true, "feedback": "👍 훌륭해요! 정확합니다."}
`;
        
        const contents = [
            { role: "user", parts: [{ text: pronunciationSystemPrompt }] },
            { role: "model", parts: [{ text: "Okay, I understand. I will act as a pronunciation coach and respond in the required JSON format (is_correct, feedback)." }] },
            { role: "user", parts: [{ text: `Please evaluate this: Original: "${originalText}", User said: "${userText}"` }] }
        ];
        apiRequestBody = { contents };

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
            ...history // [★ 오류 3] 'history'는 handlers.js에서 이미 'system'이 필터링됨
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