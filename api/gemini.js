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

    // TTS가 아닌 경우 모델 동적 선택 필요
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
        const prompt = systemPrompt || `You are a professional Korean-to-Chinese translator... Format your response as a single, valid JSON object with keys "chinese", "pinyin", "alternatives", "explanation", and "usedPattern". Do not include markdown backticks...`;
        apiRequestBody = { contents: [{ parts: [{ text: `${prompt}\n\nKorean: "${text}"` }] }] };
    } else if (action === 'chat') {
        const chatSystemPrompt = `You are "Ling"... Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks... keys: "chinese", "pinyin", "korean", "correction".`;
        const contents = [
            { role: "user", parts: [{ text: "Please follow these instructions..." + chatSystemPrompt }] },
            { role: "model", parts: [{ text: "Okay, I understand..." }] },
            ...history, { role: "user", parts: [{ text: text }] }
        ];
        apiRequestBody = { contents };
    } else if (action === 'start_chat_with_pattern') {
        const startChatSystemPrompt = `You are "Ling"... Your entire response MUST be a single, valid JSON object (no markdown) with keys: "chinese", "pinyin", "korean", "correction". Set "correction" to \`null\`... pattern: "${pattern}".`;
        const contents = [
            { role: "user", parts: [{ text: startChatSystemPrompt }] },
            { role: "model", parts: [{ text: `Okay, I understand...` }] },
            { role: "user", parts: [{ text: `Great. Now, please start... using the pattern "${pattern}".` }] }
        ];
        apiRequestBody = { contents };
    } else if (action === 'generate_practice') {
        const practiceSystemPrompt = `You are a Chinese language teacher... Response MUST be a single valid JSON object (no markdown) with keys: "korean", "chinese", "pinyin", and "practiceVocab"... Pattern to use: "${pattern}"`;
        const contents = [
            { role: "user", parts: [{ text: practiceSystemPrompt }] },
            { role: "model", parts: [{ text: `Okay, I will generate... for the pattern "${pattern}"...` }] },
            { role: "user", parts: [{ text: `Great. Now, please generate... for the pattern "${pattern}".` }] }
        ];
        apiRequestBody = { contents };
    } else if (action === 'correct_writing') {
        const writingSystemPrompt = `You are a Chinese language teacher... Analyze the provided Chinese sentence ("${text}")... Your entire response MUST be a single, valid JSON object (no markdown) with keys: "corrected_sentence" and "explanation"...`;
        const contents = [ { role: "user", parts: [{ text: writingSystemPrompt }] } ];
        apiRequestBody = { contents };
    } else if (action === 'suggest_reply') {
        const suggestSystemPrompt = `Based on the previous conversation history... Response MUST be a single valid JSON object (no markdown) with a key "suggestions"...`;
        const contents = [
            { role: "user", parts: [{ text: suggestSystemPrompt }] },
            { role: "model", parts: [{ text: "Okay, I will provide..." }] },
            ...history
        ];
        apiRequestBody = { contents };
    } else if (action === 'tts') {
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

    // API 응답 오류 처리
    if (!apiResponse.ok) {
        console.error('Google API Error:', data);
        const errorDetails = data.error ? data.error.message : JSON.stringify(data);
        throw new Error(`Google API 오류: ${errorDetails}`);
    }
    // TTS는 바로 반환
    if (action === 'tts') {
        return response.status(200).json(data);
    }

    // AI 응답 구조 유효성 검사
    if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content || !data.candidates[0].content.parts || data.candidates[0].content.parts.length === 0 || !data.candidates[0].content.parts[0].text) {
        console.error("Invalid response structure from Google API:", data);
         if (data.promptFeedback && data.promptFeedback.blockReason) {
             throw new Error(`AI 응답 생성 실패 (안전 필터): ${data.promptFeedback.blockReason}`);
        } else if (data.candidates && data.candidates.length > 0 && data.candidates[0].finishReason && data.candidates[0].finishReason !== 'STOP') {
             throw new Error(`AI 응답 생성 중단됨: ${data.candidates[0].finishReason}`);
        } else {
            throw new Error("AI로부터 유효한 응답(텍스트 포함)을 받지 못했습니다.");
        }
    }

    // Markdown 코드 블록 제거
    try {
        const firstPart = data.candidates[0].content.parts[0];
        const cleanedJsonText = firstPart.text.trim().replace(/^```json\s*|\s*```$/g, '');
        firstPart.text = cleanedJsonText; // 수정된 텍스트 다시 할당
        console.log("Cleaned AI Response Text:", cleanedJsonText);
    } catch (e) {
        console.error("Error during markdown cleaning:", e);
        // 클리닝 실패 시에도 원본 데이터로 진행
    }

    // suggest_reply 특별 처리 (여러 part 가능성 및 자체 파싱)
     if (action === 'suggest_reply') {
        let suggestionData = null;
        let foundSuggestions = false;
        for (const part of data.candidates[0].content.parts) {
            try {
                // 각 part에 대해 클리닝 적용
                const cleanedPartText = part.text.trim().replace(/^```json\s*|\s*```$/g, '');
                if (!cleanedPartText || !cleanedPartText.startsWith('{')) continue; // JSON 형태 아니면 건너뛰기

                const parsedPart = JSON.parse(cleanedPartText);
                if (parsedPart.suggestions && Array.isArray(parsedPart.suggestions) &&
                    (parsedPart.suggestions.length === 0 ||
                     (parsedPart.suggestions.length > 0 &&
                      parsedPart.suggestions.every(item =>
                        typeof item === 'object' && item !== null && // null 체크 추가
                        item.hasOwnProperty('chinese') &&
                        item.hasOwnProperty('pinyin') &&
                        item.hasOwnProperty('korean')
                    )))
                ) {
                    suggestionData = parsedPart;
                    foundSuggestions = true;
                    break;
                }
            } catch (e) {
                 console.warn("Ignoring non-JSON or invalid JSON part in suggest_reply:", part.text, e);
            }
        }
        if (foundSuggestions && suggestionData) {
            return response.status(200).json(suggestionData);
        } else {
            console.error("Could not find valid 'suggestions' JSON object array in suggest_reply parts:", JSON.stringify(data.candidates[0].content.parts, null, 2));
            // suggest_reply 실패 시에도 500 오류 대신, 빈 배열을 포함한 정상 응답 형태로 반환 고려 가능
            // 예: return response.status(200).json({ suggestions: [] });
            throw new Error("AI로부터 유효한 답변 추천 JSON 형식을 찾지 못했습니다.");
        }
    }

    // 나머지 액션은 수정된 data 객체 전체 반환
    return response.status(200).json(data);

  } catch (error) {
    console.error('서버 함수 오류:', error);
    // 실제 서비스에서는 에러 메시지를 좀 더 일반화하여 사용자에게 노출하는 것이 좋음
    return response.status(500).json({ error: `서버 처리 중 오류 발생: ${error.message}` });
  }
}

// v.2025.10.23_1530