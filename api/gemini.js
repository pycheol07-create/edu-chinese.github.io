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

    // 3. '번역' 요청 (v1 엔드포인트)
    if (action === 'translate') {
      apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.0-pro:generateContent?key=${apiKey}`;
      
      const prompt = systemPrompt || `Translate this Korean text to Chinese: ${text}`;
      
      // v1 방식은 systemInstruction을 지원하지 않으므로, contents에 직접 결합합니다.
      // 'generationConfig' 블록을 완전히 제거했습니다.
      apiRequestBody = {
        contents: [{
            parts: [{ text: `${prompt}\n\nKorean: "${text}"` }]
        }]
      };
    } 
    
    // 4. '대화하기' (v1 엔드포인트)
    else if (action === 'chat') {
        const chatSystemPrompt = `You are a friendly and encouraging native Chinese speaker named "Ling" (灵). Your goal is to have a natural, casual conversation with a user who is learning Chinese.
- Keep your responses concise (1-2 short sentences).
- Ask questions to keep the conversation going.
- If the user makes a small grammar mistake, gently correct it by using the correct form in your response. For example, if they say "我昨天去公园了玩", you can respond with "哦，你昨天去公园玩了啊！公园里人多吗？" without explicitly pointing out the mistake.
- Your entire response MUST be a single, valid JSON object and nothing else. Do not use markdown backticks.
- The JSON object must have these exact keys: "chinese", "pinyin", "korean".
- "chinese": Your response in simplified Chinese characters.
- "pinyin": The pinyin for your Chinese response.
- "korean": A natural Korean translation of your Chinese response.`;

        apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.0-pro:generateContent?key=${apiKey}`;
        
        const contents = [
            {
                "role": "user",
                "parts": [{ "text": "Please follow these instructions for all future responses: " + chatSystemPrompt }]
            },
            {
                "role": "model",
                "parts": [{ "text": "Okay, I understand. I will act as Ling and respond in the required JSON format." }]
            },
            ...history, 
            {
                "role": "user",
                "parts": [{ "text": text }]
            }
        ];

        // 'generationConfig' 블록을 완전히 제거했습니다.
        apiRequestBody = {
          contents
        };
    }

    // 5. 'TTS' (이전과 동일)
    else if (action === 'tts') {
        apiUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
        
        apiRequestBody = {
            input: {
                text: text
            },
            voice: {
                languageCode: 'cmn-CN', // 표준 중국어
                name: 'cmn-CN-Wavenet-B' // 여성 목소리 예시
            },
            audioConfig: {
                audioEncoding: 'MP3' // MP3 포맷
            }
        };
    }
    
    // 6. 그 외 요청
    else {
      return response.status(400).json({ error: '잘못된 요청(action)입니다.' });
    }

    // 7. Google API에 실제 요청 전송
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apiRequestBody),
    });
    
    const data = await apiResponse.json();

    if (!apiResponse.ok) {
      // Google API 오류 처리
      console.error('Google API Error:', data);
      const errorDetails = data.error ? data.error.message : JSON.stringify(data);
      throw new Error(`Google API 오류: ${errorDetails}`);
    }
    
    // TTS 응답 처리
    if (action === 'tts') {
        return response.status(200).json(data); // data는 { audioContent: "..." } 형태
    }

    // 8. 성공적인 응답(번역 또는 채팅 결과) 전송
    return response.status(200).json(data);

  } catch (error) {
    console.error('서버 함수 오류:', error);
    return response.status(500).json({ error: error.message });
  }
}