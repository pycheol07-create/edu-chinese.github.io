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
    // 4. '음성 생성(tts)' 요청일 경우 Text-to-Speech 모델을 호출합니다. (이 부분이 중요!)
    else if (action === 'tts') {
      apiUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
      apiRequestBody = {
        input: {
          text: text
        },
        voice: {
          languageCode: 'cmn-CN', // 중국어 설정
          ssmlGender: 'NEUTRAL'
        },
        audioConfig: {
          audioEncoding: 'LINEAR16', // WAV 형식 호환 인코딩
          sampleRateHertz: 24000      // 샘플링 레이트
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

    // 6. 성공적인 응답을 프런트엔드로 다시 보내줍니다.
    return response.status(200).json(data);

  } catch (error) {
    console.error('서버 함수 오류:', error);
    return response.status(500).json({ error: error.message });
  }
}
