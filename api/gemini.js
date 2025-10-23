// Vercel 서버에서 실행되는 코드입니다.
// 이 파일은 절대 사용자에게 노출되지 않습니다.

export default async function handler(request, response) {
  // 1. Vercel에 저장된 환경 변수에서 API 키를 안전하게 가져옵니다.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });
  }

  // 2. 프런트엔드에서 보낸 요청 데이터를 받습니다.
  const { action, text, systemPrompt, history, pattern } = request.body; // 'text' will be used for writing correction

  try {
    let apiUrl;
    let apiRequestBody;
    let modelShortName = 'gemini-1.0-pro'; // 기본 모델 설정

    // TTS가 아닌 경우 (번역, 채팅, 답변 추천, 패턴 채팅 시작, 문제 생성, 작문 교정) 모델 동적 선택 필요
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
        const chatSystemPrompt = `You are "Ling" (灵), a friendly native Chinese speaker and language tutor. Your goal is to help a user learning Chinese.
- Have a natural, concise conversation (1-2 short sentences).
- Ask questions to keep the conversation going.
- **VERY IMPORTANT:** Analyze the user's *last* message for grammatical errors or unnatural expressions.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object must have these exact keys: "chinese", "pinyin", "korean", "correction".
- "chinese": Your *new* conversational response in simplified Chinese.
- "pinyin": The pinyin for your "chinese" response.
- "korean": A natural Korean translation of your "chinese" response.
- "correction": An object containing feedback on the *user's previous message*, OR \`null\`. If correct, set to \`null\`. If error, include "original", "corrected", and "explanation" (in Korean).`;
        const contents = [
            { role: "user", parts: [{ text: "Please follow these instructions for all future responses: " + chatSystemPrompt }] },
            { role: "model", parts: [{ text: "Okay, I understand. I will act as Ling and respond in the required JSON format, including grammar corrections." }] },
            ...history,
            { role: "user", parts: [{ text: text }] }
        ];
        apiRequestBody = { contents };

    } else if (action === 'start_chat_with_pattern') {
        const startChatSystemPrompt = `You are "Ling" (灵), a friendly native Chinese speaker and language tutor.
- Your entire response MUST be a single, valid JSON object (no markdown) with keys: "chinese", "pinyin", "korean", "correction".
- Set "correction" to \`null\`.
- Your *first message* must be a natural, conversational question using or relating to the pattern: "${pattern}". Encourage the user to reply.`;
        const contents = [
            { role: "user", parts: [{ text: startChatSystemPrompt }] },
            { role: "model", parts: [{ text: `Okay, I understand. I will act as Ling and respond in the required JSON format.` }] },
            { role: "user", parts: [{ text: `Great. Now, please start the conversation by asking me a question using the pattern "${pattern}".` }] }
        ];
        apiRequestBody = { contents };

    } else if (action === 'generate_practice') {
        const practiceSystemPrompt = `You are a Chinese language teacher. Generate one new, simple practice problem for the pattern: "${pattern}".
- Must be different from typical examples.
- Response MUST be a single valid JSON object (no markdown) with keys: "korean" (string), "chinese" (string), "pinyin" (string), and "practiceVocab" (array of {word, pinyin, meaning} for 2-3 key words).`;
        const contents = [
            { role: "user", parts: [{ text: practiceSystemPrompt }] },
            { role: "model", parts: [{ text: `Okay, I will generate a new practice problem for the pattern "${pattern}" in the specified JSON format, including "practiceVocab".` }] },
            { role: "user", parts: [{ text: `Great. Now, please generate the practice problem for the pattern "${pattern}".` }] }
        ];
        apiRequestBody = { contents };

    // --- [FEATURE 1 START: 'correct_writing' 액션 추가] ---
    } else if (action === 'correct_writing') {
        const writingSystemPrompt = `You are a Chinese language teacher evaluating a student's writing.
- Analyze the provided Chinese sentence ("${text}") for grammatical errors, unnatural phrasing, or typos.
- If the sentence is perfect and natural, congratulate the student.
- If there are errors, provide the corrected sentence and a simple explanation of the mistakes *in Korean*.
- Your entire response MUST be a single, valid JSON object (no markdown) with keys: "corrected_sentence" (string) and "explanation" (string, in Korean).
- If the original sentence was perfect, "corrected_sentence" should be the original sentence, and the explanation should praise the student.

Example (Error):
User input: "我昨天去公园了玩"
Response: {"corrected_sentence": "我昨天去公园玩了。", "explanation": "'了'는 보통 동사 뒤에 와서 동작의 완료를 나타내요. '去公园玩(공원에 가서 놀다)' 뒤에 '了'를 붙이는 것이 자연스러워요."}

Example (Correct):
User input: "我的爱好是看电影。"
Response: {"corrected_sentence": "我的爱好是看电影。", "explanation": "훌륭해요! 문법적으로 완벽하고 아주 자연스러운 문장입니다. 👍"}
`;
        const contents = [
             // No need for a model 'okay' response here, just the instruction.
            { role: "user", parts: [{ text: writingSystemPrompt }] }
            // The model will generate the correction based on the prompt implicitly containing the user's text.
        ];
        apiRequestBody = { contents };
    // --- [FEATURE 1 END] ---

    } else if (action === 'suggest_reply') {
        const suggestSystemPrompt = `Based on the previous conversation history, suggest 1-2 simple, natural Chinese replies for the user (a learner).
- Response MUST be a single valid JSON object (no markdown) with a key "suggestions" (array of {chinese, pinyin, korean}).`;
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

    // 번역, 채팅, 추천, 패턴 시작, 문제 생성, 작문 교정 응답 처리
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
        // ... (suggest_reply 파싱 로직 - 변경 없음) ...
        let suggestionData = null;
        let foundSuggestions = false;
        for (const part of data.candidates[0].content.parts) {
            try {
                const cleanedText = part.text.trim();
                const jsonText = cleanedText.replace(/^```json\s*|\s*```$/g, '');
                const parsedPart = JSON.parse(jsonText);

                if (parsedPart.suggestions && Array.isArray(parsedPart.suggestions) &&
                    // Allow empty suggestions array
                    (parsedPart.suggestions.length === 0 ||
                     (parsedPart.suggestions.length > 0 &&
                      parsedPart.suggestions.every(item =>
                        typeof item === 'object' &&
                        item.hasOwnProperty('chinese') &&
                        item.hasOwnProperty('pinyin') &&
                        item.hasOwnProperty('korean')
                    )))
                )
                {
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

    // 번역, 채팅, 패턴 시작, 문제 생성, 작문 교정은 data 전체를 반환 (프론트엔드에서 파싱)
    return response.status(200).json(data);

  } catch (error) {
    console.error('서버 함수 오류:', error);
    return response.status(500).json({ error: error.message });
  }
}

// v.2025.10.23_1500