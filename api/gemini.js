// Gemini API handler with caching and correction
let cachedModel = null;

export default async function handler(request, response) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return response.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });

  const { action, text, systemPrompt, history } = request.body;
  try {
    let apiUrl;
    let apiRequestBody;
    let modelShortName = 'gemini-1.0-pro';

    if (action !== 'tts') {
      if (!cachedModel) {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
        const data = await res.json();
        const models = data.models || [];
        cachedModel =
          models.find(m => /flash/i.test(m.name)) ||
          models.find(m => /gemini-1\.5.*pro/i.test(m.name)) ||
          { name: 'models/gemini-1.0-pro' };
      }
      modelShortName = cachedModel.name.split('/').pop();
      apiUrl = `https://generativelanguage.googleapis.com/v1/models/${modelShortName}:generateContent?key=${apiKey}`;
    }

    if (action === 'translate') {
      const prompt = systemPrompt || `Translate Korean to Chinese: ${text}`;
      apiRequestBody = { contents: [{ parts: [{ text: `${prompt}\n\nKorean: "${text}"` }] }] };
    } else if (action === 'chat') {
      const contents = [...(history || []), { role: "user", parts: [{ text }] }];
      apiRequestBody = { contents };
    } else if (action === 'suggest_reply') {
      const contents = [{ role: "user", parts: [{ text: "Suggest replies with pinyin and Korean meaning." }] }, ...(history || [])];
      apiRequestBody = { contents };
    } else if (action === 'correction') {
      const prompt = `Please correct this Chinese sentence and explain in Korean. Respond as JSON with keys: corrected, pinyin, explanation.`;
      apiRequestBody = { contents: [{ parts: [{ text: `${prompt}\nSentence: ${text}` }] }] };
    } else if (action === 'tts') {
      apiUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
      apiRequestBody = {
        input: { text },
        voice: { languageCode: 'cmn-CN', name: 'cmn-CN-Wavenet-B' },
        audioConfig: { audioEncoding: 'MP3' }
      };
    } else {
      return response.status(400).json({ error: 'Invalid action' });
    }

    const apiRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiRequestBody)
    });
    const data = await apiRes.json();
    if (!apiRes.ok) throw new Error(data.error?.message || 'Google API 오류');
    return response.status(200).json(data);
  } catch (e) {
    console.error('Gemini handler error:', e);
    return response.status(500).json({ error: e.message });
  }
}
