import { allPatterns as patternsData } from '../data/patterns.js';

let recognition = null;
let isRecognizing = false;

function cleanupOldStorage() {
  const now = Date.now();
  const last = +localStorage.getItem('storageCleanTime') || 0;
  if (!last || now - last > 1000*60*60*24*30) {
    localStorage.removeItem('dailyChinesePatterns');
    localStorage.setItem('storageCleanTime', String(now));
    console.log('🧹 old localStorage cleaned');
  }
}
cleanupOldStorage();

function showAlert(msg){alert(msg);}

async function callGeminiAPI(action, body){
  const res = await fetch('/api/gemini',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...body})});
  if(!res.ok){const err=await res.json();throw new Error(err.error||'API 오류');}
  return res.json();
}

// Speech recognition handling
function initSpeechRecognition(){
  const SR = window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){console.warn('SpeechRecognition not supported');return;}
  recognition = new SR();
  recognition.lang='zh-CN'; recognition.interimResults=false; recognition.maxAlternatives=1;
  recognition.onresult=e=>{console.log('Result',e.results[0][0].transcript);};
  recognition.onerror=e=>{console.error('Speech error',e);isRecognizing=false;document.getElementById('mic-btn')?.classList.remove('is-recording');showAlert('음성 인식 오류: '+e.error);};
  recognition.onend=()=>{console.log('Recognition ended');isRecognizing=false;document.getElementById('mic-btn')?.classList.remove('is-recording');};
  console.log('SpeechRecognition ready');
}

document.addEventListener('DOMContentLoaded',()=>{
  initSpeechRecognition();
  document.getElementById('mic-btn')?.addEventListener('click',()=>{
    if(!recognition)return showAlert('음성 인식이 지원되지 않습니다.');
    if(isRecognizing){recognition.stop();return;}
    try{
      recognition.start();
      isRecognizing=true;
      document.getElementById('mic-btn').classList.add('is-recording');
    }catch(e){
      console.error('Speech start error',e);
      isRecognizing=false;
      document.getElementById('mic-btn').classList.remove('is-recording');
      showAlert('음성 인식 시작 실패: '+e.message);
    }
  });

  // Correction feature
  const correctionBtn=document.getElementById('correction-btn');
  const correctionInput=document.getElementById('correction-input');
  const correctionResult=document.getElementById('correction-result');
  correctionBtn?.addEventListener('click',async()=>{
    const text=correctionInput.value.trim();
    if(!text)return showAlert('교정할 문장을 입력하세요.');
    correctionResult.textContent='AI 교정 중...';
    try{
      const res=await callGeminiAPI('correction',{text});
      const part=res.candidates?.[0]?.content?.parts?.[0]?.text||'';
      let data;
      try{data=JSON.parse(part);}catch{data={corrected:part,pinyin:'(JSON 오류)',explanation:'AI 응답을 이해하지 못했습니다. 다시 시도해주세요.'};}
      correctionResult.innerHTML=`<p><b>교정:</b> ${data.corrected}</p><p>${data.pinyin}</p><p>${data.explanation}</p>`;
    }catch(e){showAlert('교정 오류: '+e.message);}
  });
});
