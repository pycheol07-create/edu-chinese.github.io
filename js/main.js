import { allPatterns as patternsData } from './patterns.js';

function cleanupOldStorage() {
  const now = Date.now();
  const lastClean = localStorage.getItem('storageCleanTime');
  if (!lastClean || now - lastClean > 1000 * 60 * 60 * 24 * 30) {
    localStorage.removeItem('dailyChinesePatterns');
    localStorage.setItem('storageCleanTime', now);
  }
}

cleanupOldStorage();

console.log("앱 초기화 완료");
