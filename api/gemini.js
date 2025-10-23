// Vercel 서버에서 실행되는 코드입니다.
let cachedModel = null;

export default async function handler(request, response) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return response.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });

  const { action, text, systemPrompt, history } = request.body;
  try {
    let apiUrl, apiRequestBody;
    let modelShortName = 'gemini-1.5-flash';

    if (action !== 'tts') {
      if (!cachedModel) {
        const listModelsRes = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
        if (!listModelsRes.ok) throw new Error('모델 목록 조회 실패');
        const modelData = await listModelsRes.json();
        const models = modelData.models || [];
        cachedModel =
          models.find(m => /gemini-1\.5.*flash/i.test(m.name)) ||
          models.find(m => /gemini-1\.5.*pro/i.test(m.name)) ||
          models.find(m => /gemini-1\.0.*pro/i.test(m.name)) ||
          { name: 'models/gemini-1.0-pro' };
      }
      modelShortName = cachedModel.name.split('/').pop();
      apiUrl = `https://generativelanguage.googleapis.com/v1/models/${modelShortName}:generateContent?key=${apiKey}`;
    }

    if (action === 'translate') {
      const prompt = systemPrompt || `Translate this Korean text to Chinese: ${text}`;
      apiRequestBody = { contents: [{ parts: [{ text: `${prompt}\n\nKorean: "${text}"` }] }] };
    } else if (action === 'chat') {
      const chatSystemPrompt = "You are Ling, respond in JSON with chinese, pinyin, korean.";
      const contents = [
        { role: "user", parts: [{ text: chatSystemPrompt }] },
        ...history,
        { role: "user", parts: [{ text }] }
      ];
      apiRequestBody = { contents };
    } else if (action === 'suggest_reply') {
      const suggestPrompt = "Suggest next Chinese replies with pinyin and Korean meaning, JSON only.";
      const contents = [{ role: "user", parts: [{ text: suggestPrompt }] }, ...history];
      apiRequestBody = { contents };
    } else if (action === 'tts') {
      apiUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
      apiRequestBody = {
        input: { text },
        voice: { languageCode: 'cmn-CN', name: 'cmn-CN-Wavenet-B' },
        audioConfig: { audioEncoding: 'MP3' }
      };
    } else {
      return response.status(400).json({ error: '잘못된 action' });
    }

    const apiRes = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(apiRequestBody) });
    const data = await apiRes.json();
    if (!apiRes.ok) throw new Error(data.error?.message || 'Google API 오류');

    return response.status(200).json(data);
  } catch (e) {
    console.error(e);
    return response.status(500).json({ error: e.message });
  }
}
