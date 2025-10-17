// Vercel 서버에서 실행되는 코드입니다.
// 이 파일은 절대 사용자에게 노출되지 않습니다.

export default async function handler(request, response) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });
  }

  const { action, text, systemPrompt } = request.body;

  try {
    // 먼저 사용 가능한 모델 목록 불러오기
    const listRes = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`,
      { method: 'GET' }
    );
    if (!listRes.ok) {
      const err = await listRes.json();
      throw new Error(`ListModels 오류: ${JSON.stringify(err)}`);
    }
    const modelListData = await listRes.json();
    // 예: modelListData.models 배열이 있을 거야
    // 유효한 모델 하나 골라 쓰자 (예: 제일 최신 flash 계열 모델)
    const models = modelListData.models || [];
    if (models.length === 0) {
      throw new Error('사용 가능한 모델이 없습니다.');
    }
    // 예: 이름이 "gemini-2.5-flash" 포함된 모델 찾기
    const chosen = models.find(m => m.name.includes('flash')) || models[0];
    const modelName = chosen.name; // 예: "models/gemini-2.5-flash"

    let apiUrl, apiRequestBody;

    if (action === 'translate') {
      apiUrl = `https://generativelanguage.googleapis.com/v1/${modelName}:generateContent?key=${apiKey}`;
      apiRequestBody = {
        contents: [
          {
            parts: [
              { text: `${systemPrompt}\n\n${text}` }
            ]
          }
        ],
      };
    } else if (action === 'tts') {
      apiUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
      apiRequestBody = {
        input: { text },
        voice: {
          languageCode: 'cmn-CN',
          name: 'cmn-CN-Wavenet-B',
          ssmlGender: 'MALE'
        },
        audioConfig: {
          audioEncoding: 'LINEAR16',
          sampleRateHertz: 24000
        }
      };
    } else {
      return response.status(400).json({ error: '잘못된 요청(action)입니다.' });
    }

    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiRequestBody),
    });
    if (!apiResponse.ok) {
      const err = await apiResponse.json();
      console.error('Google API Error:', err);
      throw new Error(`Google API 오류: ${JSON.stringify(err)}`);
    }
    const data = await apiResponse.json();

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

    return response.status(200).json(data);

  } catch (error) {
    console.error('서버 함수 오류:', error);
    return response.status(500).json({ error: error.message });
  }
}
