// Vercel 서버에서 실행되는 코드입니다.
// 이 파일은 절대 사용자에게 노출되지 않습니다.

export default async function handler(request, response) {
  // 1. Vercel에 저장된 환경 변수에서 API 키를 안전하게 가져옵니다.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });
  }

  // 2. 프런트엔드에서 보낸 요청 데이터를 받습니다.
  const { action, text, systemPrompt, history, pattern, originalText, userText, roleContext, pattern1, pattern2, scenario, speaker, previousQuestions } = request.body;

  // [JSON 추출 헬퍼 함수]
  function extractJson(text) {
    if (!text) return null;
    
    // 1. ```json ... ``` 블록 찾기
    const match = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
        return match[1].trim();
    }
    
    // 2. 만약 백틱이 없다면, 텍스트가 { 로 시작하고 } 로 끝나는지 확인
    const trimmedText = text.trim();
    if (trimmedText.startsWith('{') && trimmedText.endsWith('}')) {
        return trimmedText;
    }

    console.warn("[api/gemini.js] Could not find or extract JSON block from text:", text);
    return null; // JSON을 찾지 못함
  }

  try {
    let apiUrl;
    let apiRequestBody;
    let modelShortName = 'gemini-1.0-pro'; // 기본 모델 설정

    // TTS가 아닌 경우 모델 동적 선택
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
        const prompt = systemPrompt || `You are a professional Chinese translator and tutor.
Your goal is to translate the user's Korean text into natural, conversational Chinese.

**CRITICAL INSTRUCTIONS:**
1. Output MUST be a single, valid JSON object. 
2. Do NOT include markdown backticks (like \`\`\`json). Just the raw JSON string.
3. Do NOT explain in English. Use Korean for explanations.

**JSON Structure:**
{
  "chinese": "Translated Chinese text (Simplified)",
  "pinyin": "Pinyin with tone marks",
  "alternatives": ["Alternative expression 1", "Alternative expression 2"],
  "explanation": "A brief grammar or nuance explanation in Korean",
  "usedPattern": "Name of the grammar pattern used (MUST be in Korean, e.g., '谁를 활용한 반어문', or null if none)"
}

**User Input (Korean):** "${text}"`;

        apiRequestBody = {
            contents: [{ parts: [{ text: prompt }] }]
        };
    
    } else if (action === 'chat') {
        let chatSystemPrompt = `You are "Ling" (灵), a friendly native Chinese speaker and language tutor. Your goal is to help a user learning Chinese.
- Have a natural, concise conversation (1-2 short sentences).
- Ask questions to keep the conversation going.
- **VERY IMPORTANT:** Analyze the user's *last* message for grammatical errors or unnatural expressions.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object must have these exact keys: "chinese", "pinyin", "korean", "correction".
- Set "correction" to \`null\` if the user's last message was correct.
- If there is an error, "correction" object should contain: "original", "corrected", "explanation" (in Korean).
- Example if user said "你好":
  {"chinese": "你好！你吃饭了吗？", "pinyin": "Nǐ hǎo! Nǐ chīfàn le ma?", "korean": "안녕하세요! 밥 먹었어요?", "correction": null}
`;

        if (roleContext === 'restaurant') {
            chatSystemPrompt = `You are "Ling" (灵), acting as a helpful RESTAURANT WAITER (餐厅服务员).
- Your goal is to take the user's (customer's) order.
- Be polite, natural, and concise (1-2 short sentences).
- Ask questions to keep the conversation going (e.g., "您想喝点什么？", "还需要别的吗？").
- **VERY IMPORTANT:** Analyze the user's *last* message for grammatical errors.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object MUST have the keys: "chinese", "pinyin", "korean", "correction".
- Set "correction" to \`null\` if the user's last message was correct.
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
        } else if (roleContext) {
             // 커스텀 시나리오
             chatSystemPrompt = `You are "Ling" (灵).
- The user wants to roleplay a specific situation: "${roleContext}".
- Play the appropriate role based on this situation.
- Be natural and concise (1-2 short sentences).
- Ask questions to keep the conversation going.
- **VERY IMPORTANT:** Analyze the user's *last* message for grammatical errors.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object MUST have the keys: "chinese", "pinyin", "korean", "correction".
- Set "correction" to \`null\` if the user's last message was correct.
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
    
    } else if (action === 'start_roleplay_chat') {
        let roleplayStartPrompt = '';
        if (roleContext === 'restaurant') {
            roleplayStartPrompt = `You are "Ling" (灵), acting as a helpful RESTAURANT WAITER (餐厅服务员).
- Your goal is to start a conversation with a customer who just sat down.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object must have these exact keys: "chinese", "pinyin", "korean", "correction".
- Set "correction" to \`null\` (this is the first message).
- Ask a simple, natural opening question.
- Example: {"chinese": "您好！您想现在点菜吗？", "pinyin": "Nínhǎo! Nín xiǎng xiànzài diǎncài ma?", "korean": "안녕하세요! 지금 주문하시겠어요?", "correction": null}`;
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
- Example: {"chinese": "嘿！最近怎么样？", "pinyin": "Hēi! Zuìjìn zěnmeyàng?", "korean": "안녕! 요즘 어떻게 지내?", "correction": null}`;
        } else if (roleContext === 'daily_lover') {
             roleplayStartPrompt = `You are "Ling" (灵), acting as a caring BOYFRIEND/GIRLFRIEND (男朋友/女朋友).
- Your goal is to start an affectionate chat.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object must have these exact keys: "chinese", "pinyin", "korean", "correction".
- Set "correction" to \`null\`.
- Ask a simple, warm opening question.
- Example: {"chinese": "宝贝，在做什么呢？", "pinyin": "Bǎobèi, zài zuò shénme ne?", "korean": "자기야, 뭐하고 있어?", "correction": null}`;
        } else if (roleContext === 'daily_family') {
             roleplayStartPrompt = `You are "Ling" (灵), acting as a close FAMILY MEMBER (家人).
- Your goal is to start a comfortable chat.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object must have these exact keys: "chinese", "pinyin", "korean", "correction".
- Set "correction" to \`null\`.
- Ask a simple, caring opening question.
- Example: {"chinese": "今天过得怎么样？吃饭了吗？", "pinyin": "Jīntiān guòde zěnmeyàng? Chīfàn le ma?", "korean": "오늘 어떻게 보냈어? 밥은 먹었고?", "correction": null}`;
        } else if (roleContext === 'daily_colleague') {
             roleplayStartPrompt = `You are "Ling" (灵), acting as a friendly COLLEAGUE (同事).
- Your goal is to start a polite, work-related chat.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object must have these exact keys: "chinese", "pinyin", "korean", "correction".
- Set "correction" to \`null\`.
- Ask a simple, polite opening question.
- Example: {"chinese": "中午一起吃饭吗？", "pinyin": "Zhōngwǔ yìqǐ chīfàn ma?", "korean": "점심 같이 먹을래요?", "correction": null}`;
        } else {
             // 커스텀 시나리오
             roleplayStartPrompt = `You are "Ling" (灵).
- The user wants to roleplay a specific situation: "${roleContext}".
- Play the appropriate role based on this situation.
- Your goal is to start the conversation naturally based on this scenario.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object must have these exact keys: "chinese", "pinyin", "korean", "correction".
- Set "correction" to \`null\` for this first message.
- Ask a natural opening question suitable for the situation.
- Example for custom scenario "Buying a train ticket": {"chinese": "您好，请问您要去哪里？", "pinyin": "Nínhǎo, qǐngwèn nín yào qù nǎlǐ?", "korean": "안녕하세요, 어디로 가시나요?", "correction": null}`;
        }

        const instructionRole = roleContext ? `act according to the scenario: "${roleContext}"` : `act as a conversational partner`;
        
        const contents = [
            { role: "user", parts: [{ text: roleplayStartPrompt }] },
            { role: "model", parts: [{ text: `Okay, I understand. I will ${instructionRole} and provide the opening line in the required JSON format.` }] },
            { role: "user", parts: [{ text: `Great. Please provide the first message now.` }] }
        ];
        apiRequestBody = { contents };

    } else if (action === 'generate_today_conversation') {
        const conversationSystemPrompt = `You are a creative scriptwriter. Your task is to generate a short, natural dialogue based on two specific Chinese patterns provided by the user.
- The dialogue must be between two speakers: "Man" (👨‍💼) and "Woman" (👩‍💼).
- The dialogue must be 5 to 7 turns long (5-7 lines for Man, 5-7 lines for Woman, total 10-14 lines).
- You MUST naturally incorporate both patterns: "${pattern1}" and "${pattern2}".
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object must have these exact keys: "title" (string) and "script" (array).
- The "title" should be a concise Korean title for the dialogue.
- Each object in the "script" array must have these exact keys: "speaker" (string: "Man" or "Woman"), "chinese" (string), "pinyin" (string), and "korean" (string).

- Example Response (for "越来越..." and "A是A, 但是B"):
{
  "title": "날씨가 점점 덥네요",
  "script": [
    { "speaker": "Man", "chinese": "天气越来越热了。", "pinyin": "Tiānqì yuèláiyuè rè le.", "korean": "날씨가 점점 더워지네요." },
    { "speaker": "Woman", "chinese": "是啊。不过, 这个冰淇淋好吃是好吃, 但是太甜了。", "pinyin": "Shì a. Búguò, zhège bīngqílín hǎochī shì hǎochī, dànshì tài tián le.", "korean": "맞아요. 근데 이 아이스크림, 맛있긴 맛있는데 너무 달아요." },
    { "speaker": "Man", "chinese": "那我这杯咖啡给你喝吧？", "pinyin": "Nà wǒ zhè bēi kāfēi gěi nǐ hē ba?", "korean": "그럼 제 커피 좀 마실래요?" },
    { "speaker": "Woman", "chinese": "谢谢！你真是个好人。", "pinyin": "Xièxie! Nǐ zhēn shì ge hǎo rén.", "korean": "고마워요! 정말 좋은 분이시네요." },
    { "speaker": "Man", "chinese": "哈哈, 没什么。", "pinyin": "Haha, méi shénme.", "korean": "하하, 별거 아니에요." }
  ]
}`;
        const contents = [
            { role: "user", parts: [{ text: conversationSystemPrompt }] },
            { role: "model", parts: [{ text: "Okay, I understand. I will generate a dialogue script based on the two patterns in the required JSON format." }] },
            { role: "user", parts: [{ text: `Please generate the script using "${pattern1}" and "${pattern2}".` }] } 
        ];
        apiRequestBody = { contents };

    } else if (action === 'generate_situational_listening') {
        let scenarioKorean = scenario;
        if (scenario === 'restaurant') scenarioKorean = '식당';
        else if (scenario === 'shopping') scenarioKorean = '쇼핑';
        else if (scenario === 'taxi') scenarioKorean = '택시';
        else if (scenario === 'airport') scenarioKorean = '공항';
        else if (scenario === 'today_conversation') scenarioKorean = '오늘의 패턴 대화';
        else if (scenario === 'hotel') scenarioKorean = '호텔';
        else if (scenario === 'directions') scenarioKorean = '길 묻기';
        else if (scenario === 'hospital') scenarioKorean = '병원 또는 약국';
        
        const listeningSystemPrompt = `You are a creative scriptwriter. Your task is to generate a short, natural dialogue for a specific situation.
- The situation is: "${scenarioKorean}" (in ${scenario}).
- The dialogue must be between two speakers: "Man" (👨‍💼) and "Woman" (👩‍💼).
- The dialogue must be 5 to 7 turns long (5-7 lines for Man, 5-7 lines for Woman, total 10-14 lines).
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object must have these exact keys: "title" (string) and "script" (array).
- The "title" should be a concise Korean title for the dialogue (e.g., "식당에서 주문하기").
- Each object in the "script" array must have these exact keys: "speaker" (string: "Man" or "Woman"), "chinese" (string), "pinyin" (string), and "korean" (string).

- Example Response (for "restaurant"):
{
  "title": "식당에서 주문하기",
  "script": [
    { "speaker": "Woman", "chinese": "你好, 我们想点菜。", "pinyin": "Nǐ hǎo, wǒmen xiǎng diǎncài.", "korean": "안녕하세요, 주문하고 싶어요." },
    { "speaker": "Man", "chinese": "好的, 请看菜单。今天有什么想吃的吗？", "pinyin": "Hǎo de, qǐng kàn càidān. Jīntiān yǒu shénme xiǎng chī de ma?", "korean": "네, 메뉴판 보세요. 오늘 뭐 드시고 싶으신 거 있으세요?" },
    { "speaker": "Woman", "chinese": "这个麻婆豆腐看起来不错。辣吗？", "pinyin": "Zhège mápó dòufu kànqǐlái búcuò. Là ma?", "korean": "이 마파두부 괜찮아 보이네요. 매운가요?" },
    { "speaker": "Man", "chinese": "有点儿辣, 但是很香。", "pinyin": "Yǒudiǎnr là, dànshì hěn xiāng.", "korean": "조금 맵긴 한데, 아주 향기로워요." },
    { "speaker": "Woman", "chinese": "那就要一个这个吧。", "pinyin": "Nà jiù yào yí ge zhège ba.", "korean": "그럼 이걸로 하나 주세요." }
  ]
}`;
        const contents = [
            { role: "user", parts: [{ text: listeningSystemPrompt }] },
            { role: "model", parts: [{ text: "Okay, I understand. I will generate a dialogue script for the specified situation in the required JSON format." }] },
            { role: "user", parts: [{ text: `Please generate the script for the "${scenario}" situation.` }] } 
        ];
        apiRequestBody = { contents };

    } else if (action === 'generate_practice') {
        let avoidInstruction = "";
        if (previousQuestions && previousQuestions.length > 0) {
            avoidInstruction = `\n\n**IMPORTANT:** Do NOT use the following sentences (or very similar ones), as the user has already practiced them:\n${previousQuestions.map(q => `- ${q}`).join('\n')}\nGenerate a COMPLETELY NEW sentence.`;
        }

        const practiceSystemPrompt = `You are an AI language tutor. Your goal is to create a single practice problem for a user learning Chinese based on a specific pattern.
- The user needs to translate a Korean sentence into Chinese.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object must have these exact keys: "korean" (string), "chinese" (string), "pinyin" (string), "practiceVocab" (array).
- "korean": A simple Korean sentence that *requires* the pattern "${pattern}" to be translated naturally.
- "chinese": The correct Chinese translation of the "korean" sentence, using the pattern "${pattern}".
- "pinyin": The pinyin for the "chinese" sentence.
- "practiceVocab": An array of 1-3 key vocabulary objects found in the "chinese" sentence. Each object must have keys: "word", "pinyin", "meaning".${avoidInstruction}

- Example for pattern "A是A, 但是B":
{
  "korean": "이 옷, 예쁘긴 예쁜데 너무 비싸요.",
  "chinese": "这件衣服好看是好看, 但是太贵了。",
  "pinyin": "zhè jiàn yīfu hǎokàn shì hǎokàn, dànshì tài guì le.",
  "practiceVocab": [
    {"word": "衣服", "pinyin": "yīfu", "meaning": "옷"},
    {"word": "好看", "pinyin": "hǎokàn", "meaning": "예쁘다"},
    {"word": "贵", "pinyin": "guì", "meaning": "비싸다"}
  ]
}`;
        const contents = [
            { role: "user", parts: [{ text: practiceSystemPrompt }] },
            { role: "model", parts: [{ text: `Okay, I understand. I will generate a new practice problem for the pattern "${pattern}" in the specified JSON format, including "practiceVocab".` }] },
            { role: "user", parts: [{ text: `Great. Now, please generate the practice problem for the pattern "${pattern}".` }] } 
        ];
        apiRequestBody = { contents };
        
    } else if (action === 'correct_writing') {
        const correctionSystemPrompt = `You are a helpful Chinese language tutor.
Your goal is to correct the user's Chinese sentence for grammar, vocabulary, and naturalness.

**Instructions:**
1. Analyze the user's text.
2. Provide a corrected version (Simplified Chinese).
3. Provide a helpful explanation in Korean about *why* it was corrected or how to improve it.
4. Output MUST be a single, valid JSON object.

**JSON Structure:**
{
  "corrected_sentence": "Corrected Chinese text",
  "explanation": "Explanation in Korean"
}

**User Input:** "${text}"`;
        const contents = [
            { role: "user", parts: [{ text: correctionSystemPrompt }] },
            { role: "model", parts: [{ text: "Okay, I understand. I will correct the user's text and respond in the required JSON format (corrected_sentence, explanation)." }] },
            { role: "user", parts: [{ text: `Please correct the following text: "${text}"` }] }
        ];
        apiRequestBody = { contents };
        
    } else if (action === 'get_writing_topic') {
        const topicSystemPrompt = `You are a Chinese language tutor.
Your goal is to provide a simple, interesting topic for a beginner/intermediate learner to write a short journal entry about.

**Instructions:**
1. The topic should be in Korean.
2. Output MUST be a single, valid JSON object.

**JSON Structure:**
{
  "topic": "Suggested topic in Korean (e.g., '가장 좋아하는 계절과 그 이유')"
}`;
        const contents = [
            { role: "user", parts: [{ text: topicSystemPrompt }] },
            { role: "model", parts: [{ text: "Okay, I understand. I will provide a simple writing topic in Korean, formatted as the requested JSON." }] },
            { role: "user", parts: [{ text: "Please generate a topic now." }] }
        ];
        apiRequestBody = { contents };

    } else if (action === 'get_character_info') {
        // [수정] 간체자 학습 프롬프트: 품사(part_of_speech) 정보 추가 요청
        const characterSystemPrompt = `You are an expert Chinese etymologist and teacher.
Provide a comprehensive analysis of the Chinese character "${text}" in a strict JSON format.

**JSON Structure:**
{
  "char": "${text}",
  "pinyin": "Main Pinyin (e.g., 'le')",
  "meaning": "Main Meaning (e.g., '완료')",
  "all_readings": [
     { "pinyin": "pinyin 1", "meaning": "meaning 1", "part_of_speech": "part of speech (e.g., 동사)" },
     { "pinyin": "pinyin 2", "meaning": "meaning 2", "part_of_speech": "part of speech (e.g., 조사)" }
  ],
  "korean_pronunciation": "Korean sound/meaning (e.g., '사람 인' for '人', '클 대' for '大')", 
  "etymology": "Very brief and summarized explanation of origin in Korean (1-2 sentences max)",
  "caution": {
    "similar_char": "A character that looks similar (e.g., '土' vs '士')",
    "similar_char_pinyin": "Pinyin of similar char",
    "similar_char_meaning": "Meaning of similar char in Korean",
    "tip": "How to distinguish them in Korean"
  },
  "related_words": [
    { "word": "Compound Word 1", "pinyin": "pinyin", "meaning": "Korean meaning" },
    { "word": "Compound Word 2", "pinyin": "pinyin", "meaning": "Korean meaning" },
    { "word": "Compound Word 3", "pinyin": "pinyin", "meaning": "Korean meaning" }
  ]
}

**Important Instructions:**
- All explanations MUST be in Korean.
- For each reading in "all_readings", include the "part_of_speech" (e.g., 명사, 동사, 형용사) in Korean.
- If the character has multiple pronunciations (polyphone/多音字) or multiple meanings, list ALL of them in "all_readings".
- If it has only one pronunciation/meaning, put that one in "all_readings" as well.
- If there is no confusing similar character, set "caution" to null.
- "related_words" should show how this character expands into common words (HSK 1-5 level prefered).`;

        const contents = [
            { role: "user", parts: [{ text: characterSystemPrompt }] },
            { role: "model", parts: [{ text: "Okay, I will analyze the character and provide all readings with parts of speech, etymology, caution, and related words in the required JSON format." }] },
            { role: "user", parts: [{ text: `Please analyze the character "${text}" now.` }] }
        ];
        apiRequestBody = { contents };

    } else if (action === 'evaluate_pronunciation') {
        const pronunciationSystemPrompt = `You are a strict Chinese pronunciation coach.
Compare the "Original" text with what the "User said" (transcribed text).

**Instructions:**
1. Analyze if the user's spoken text matches the original text closely enough to be understood.
2. Be lenient with minor homophones but strict with completely different words.
3. Output MUST be a single, valid JSON object.

**JSON Structure:**
{
  "is_correct": true or false,
  "feedback": "Feedback in Korean (e.g., '성조가 조금 다르지만 훌륭해요!' or 'XX 발음을 더 주의해보세요.')"
}`;
        const contents = [
            { role: "user", parts: [{ text: pronunciationSystemPrompt }] },
            { role: "model", parts: [{ text: "Okay, I understand. I will act as a pronunciation coach and respond in the required JSON format (is_correct, feedback)." }] },
            { role: "user", parts: [{ text: `Please evaluate this: Original: "${originalText}", User said: "${userText}"` }] }
        ];
        apiRequestBody = { contents };

    } else if (action === 'suggest_reply') {
        const suggestSystemPrompt = `You are "Ling" (灵), a friendly native Chinese speaker. A user is in a conversation and wants suggestions for what to say next.
- The user provides the conversation history.
- Your goal is to provide 3 distinct reply suggestions.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object must have a single key: "suggestions".
- "suggestions": An array of 3 suggestion objects.
- Each suggestion object must have these exact keys: "chinese", "pinyin", "korean".

- Example Request History:
  [ { "role": "model", "parts": [{"text": "{\"chinese\": \"你好！你吃饭了吗？\", ...}"}] },
    { "role": "user", "parts": [{"text": "我吃了。"}] },
    { "role": "model", "parts": [{"text": "{\"chinese\": \"你吃什么了？\", ...}"}] } ]
- Example Response:
{
  "suggestions": [
    { "chinese": "我吃了炒饭。", "pinyin": "Wǒ chīle chǎofàn.", "korean": "볶음밥 먹었어요." },
    { "chinese": "还没吃呢，你呢？", "pinyin": "Hái méi chī ne, nǐ ne?", "korean": "아직 안 먹었어요, 당신은요?" },
    { "chinese": "我吃得很简单。", "pinyin": "Wǒ chī de hěn jiǎndān.", "korean": "저는 간단하게 먹었어요." }
  ]
}`;
         const contents = [
            { role: "user", parts: [{ text: suggestSystemPrompt }] },
            { role: "model", parts: [{ text: "Okay, I will provide reply suggestions including pinyin and Korean meaning in the specified JSON format." }] }, 
            ...history,
            { role: "user", parts: [{ text: "Please provide 3 suggestions for a reply to the last message, based on our conversation." }] }
        ];
        apiRequestBody = { contents };
    }
    else if (action === 'tts') {
        apiUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
        
        let voiceName = 'cmn-CN-Wavenet-B'; // 기본값 (남성)
        if (speaker === 'Woman') {
            voiceName = 'cmn-CN-Wavenet-A'; // 여성
        }
        
        apiRequestBody = {
            input: { text: text },
            voice: { languageCode: 'cmn-CN', name: voiceName }, 
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

    if (action === 'suggest_reply') {
        try {
            const aiResponseText = data.candidates[0]?.content?.parts?.[0]?.text;
            if (!aiResponseText) {
                 throw new Error("AI response part is missing or empty.");
            }
            const cleanedText = extractJson(aiResponseText); 
            if (!cleanedText) {
                throw new Error("AI response did not contain a valid JSON block.");
            }
            const suggestionData = JSON.parse(cleanedText);
            if (suggestionData && suggestionData.suggestions && Array.isArray(suggestionData.suggestions)) {
                return response.status(200).json(suggestionData);
            } else {
                throw new Error("Parsed JSON does not contain 'suggestions' array.");
            }
        } catch (e) {
            console.error(`[api/gemini.js] suggest_reply parsing error: ${e.message}`, data.candidates?.[0]?.content?.parts?.[0]?.text);
            throw new Error("AI가 유효한 답변 추천 JSON을 반환하지 않았습니다. (파싱 실패)"); 
        }
    }

    if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content || !data.candidates[0].content.parts || data.candidates[0].content.parts.length === 0) {
        console.error("Invalid response structure from Google API (non-suggest_reply):", data);
         if (data.promptFeedback && data.promptFeedback.blockReason) {
             throw new Error(`AI 응답 생성 실패 (안전 필터): ${data.promptFeedback.blockReason}`);
        } else if (data.candidates && data.candidates.length > 0 && data.candidates[0].finishReason && data.candidates[0].finishReason !== 'STOP') {
             throw new Error(`AI 응답 생성 중단됨: ${data.candidates[0].finishReason}`);
        } else if (data.candidates && data.candidates.length === 0) {
             throw new Error(`AI 응답 생성 실패: Candidates 배열이 비어있습니다.`);
        }
        throw new Error("AI로부터 유효한 응답 구조를 받지 못했습니다. (candidates 확인 실패)");
    }

    return response.status(200).json(data);

  } catch (error) {
    console.error('서버 함수 오류:', error);
    return response.status(500).json({ error: error.message });
  }
}