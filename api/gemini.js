let cachedModel = null;

export default async function handler(request, response) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return response.status(500).json({ error: 'API 키가 없습니다.' });

  const { action, text } = request.body;
  try {
    if (action === 'tts') {
      const apiUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
      const body = {
        input: { text },
        voice: { languageCode: 'cmn-CN', name: 'cmn-CN-Wavenet-B' },
        audioConfig: { audioEncoding: 'MP3' }
      };
      const r = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error?.message || 'TTS 실패');
      return response.status(200).json(d);
    }
    return response.status(200).json({ ok: true });
  } catch (e) {
    return response.status(500).json({ error: e.message });
  }
}
