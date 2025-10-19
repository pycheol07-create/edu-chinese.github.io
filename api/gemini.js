// Vercel 서버에서 실행되는 코드입니다.
// 이 파일은 절대 사용자에게 노출되지 않습니다.

export default async function handler(request, response) {
  // 1. Vercel에 저장된 환경 변수에서 API 키를 안전하게 가져옵니다.
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return response.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });
  }

  // 2. 프런트엔드에서 보낸 요청 데이터를 받습니다.
  const { action, text, systemPrompt } = request.body;

  try {
    let apiUrl;
    let apiRequestBody;

    // 3. '번역' 요청일 경우 Gemini Pro 모델을 호출합니다.
    if (action === 'translate') {
      // ★★★ 모델 이름을 'gemini-pro'로 수정했습니다. ★★★
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
      apiRequestBody = {
        // ... existing TTS request body
      };
    } 
    // ✨ AI와 대화하는 'chat' 액션이 새로 추가되었습니다. ✨
    else if (action === 'chat') {
        const { history } = request.body; // 프런트에서 보낸 대화 기록을 받습니다.

        const systemPrompt = `You are a friendly and encouraging native Chinese speaker named "Ling" (灵). Your goal is to have a natural, casual conversation with a user who is learning Chinese.
- Keep your responses concise (1-2 short sentences).
- Ask questions to keep the conversation going.
- If the user makes a small grammar mistake, gently correct it by using the correct form in your response. For example, if they say "我昨天去公园了玩", you can respond with "哦，你昨天去公园玩了啊！公园里人多吗？" without explicitly pointing out the mistake.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object must have these exact keys: "chinese", "pinyin", "korean".
- "chinese": Your response in simplified Chinese characters.
- "pinyin": The pinyin for your Chinese response.
- "korean": A natural Korean translation of your Chinese response.`;

        apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
        
        // 이전 대화 기록을 함께 보내 AI가 맥락을 이해하도록 합니다.
        const contents = [
            ...history, 
            {
                "role": "user",
                "parts": [{ "text": text }]
            }
        ];

        apiRequestBody = {
          contents,
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                "chinese": { "type": "STRING" },
                "pinyin": { "type": "STRING" },
                "korean": { "type": "STRING" }
              },
              required: ["chinese", "pinyin", "korean"]
            }
          }
        };
    }
    // 그 외의 요청은 오류 처리
    else {
      return response.status(400).json({ error: '잘못된 요청(action)입니다.' });
    }

    // 5. 설정된 주소와 요청 본문으로 Google API에 실제 요청을 보냅니다.
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apiRequestBody),
    });

    if (!apiResponse.ok) {
      // Google API에서 오류가 발생한 경우, 그 내용을 프런트엔드로 전달합니다.
      const errorData = await apiResponse.json();
      console.error('Google API Error:', errorData);
      throw new Error(`Google API 오류: ${errorData.error.message}`);
    }

    const data = await apiResponse.json();
    
    // TTS API의 응답(data.audioContent)을 프런트엔드가 기대하는 형식으로 맞춰줍니다.
    if (action === 'tts') {
        return response.status(200).json({
            candidates: [{
                content: {
                    parts: [{
                        inlineData: {
                            mimeType: 'audio/wav; rate=24000',
                            data: data.audioContent
                        }
                    }]
                }
            }]
        });
    }

    // 6. 성공적인 응답(번역 결과)을 프런트엔드로 다시 보내줍니다.
    return response.status(200).json(data);

  } catch (error) {
    console.error('서버 함수 오류:', error);
    return response.status(500).json({ error: error.message });
  }
}


