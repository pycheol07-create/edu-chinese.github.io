// Vercel 서버에서 실행되는 코드입니다.
// 이 파일은 절대 사용자에게 노출되지 않습니다.

export default async function handler(request, response) {
  // 1. Vercel에 저장해둔 비밀 API 키를 안전하게 불러옵니다.
  const apiKey = process.env.GEMINI_API_KEY;

  // 2. 프런트엔드에서 보낸 데이터를 받습니다.
  const { action, text, systemPrompt } = request.body;
  
  let geminiApiUrl;
  let requestBody;

  // 3. 프런트엔드의 요청 종류(번역/TTS)에 따라 Gemini API에 보낼 내용을 설정합니다.
  if (action === 'translate') {
    geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
    requestBody = {
      contents: [{ parts: [{ text: `${systemPrompt}\n\n${text}` }] }],
    };
  } else if (action === 'tts') {
    geminiApiUrl = `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${apiKey}`;
    // ... TTS 요청에 맞는 requestBody 설정 ...
  } else {
    return response.status(400).json({ error: 'Invalid action' });
  }

  // 4. API 키를 담아 실제 Gemini API로 요청을 보냅니다.
  try {
    const geminiResponse = await fetch(geminiApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const data = await geminiResponse.json();
    
    // 5. 받은 결과를 다시 프런트엔드로 보내줍니다.
    response.status(200).json(data);

  } catch (error) {
    response.status(500).json({ error: error.message });
  }
}