// 파일 위치: /api/gemini.js

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
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.0-pro:generateContent?key=${apiKey}`;
      apiRequestBody = {
        contents: [{
          parts: [{ text: `${systemPrompt}\n\n${text}` }]
        }],
      };
    } 
    // 4. '음성 생성(tts)' 요청일 경우 Text-to-Speech 모델을 호출합니다.
    else if (action === 'tts') {
      apiUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
      apiRequestBody = {
        input: {
          text: text
        },
        voice: {
          languageCode: 'cmn-CN', // 중국어
          ssmlGender: 'NEUTRAL'
        },
        audioConfig: {
          audioEncoding: 'LINEAR16',
          sampleRateHertz: 24000
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
      const errorData = await apiResponse.json();
      console.error('Google API Error:', errorData);
      throw new Error(`Google API 오류: ${errorData.error.message}`);
    }

    const data = await apiResponse.json();
    
    // Gemini API의 응답 형식과 TTS API의 응답 형식이 다르므로, TTS 응답을 프런트엔드가 기대하는 형식으로 맞춰줍니다.
    if (action === 'tts') {
        return response.status(200).json({
            candidates: [{
                content: {
                    parts: [{
                        inlineData: {
                            mimeType: 'audio/wav; rate=24000',
                            data: data.audioContent // TTS API는 'audioContent' 필드에 base64 데이터를 담아줍니다.
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
