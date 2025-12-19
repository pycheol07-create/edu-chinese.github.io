// js/db.js

const DB_NAME = 'ChineseLearningDB';
const DB_VERSION = 1;
const STORE_NAME = 'audio_cache';

let dbInstance = null;

/**
 * IndexedDB를 엽니다. (싱글톤 패턴)
 */
export function openDB() {
    return new Promise((resolve, reject) => {
        if (dbInstance) return resolve(dbInstance);

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME); // 키-값 저장소 생성
            }
        };

        request.onsuccess = (event) => {
            dbInstance = event.target.result;
            console.log("IndexedDB initialized.");
            resolve(dbInstance);
        };

        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * DB에서 오디오 데이터를 가져옵니다.
 * @param {string} key - 캐시 키 (화자:텍스트)
 */
export async function getAudioFromDB(key) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result); // 데이터가 없으면 undefined 반환
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.warn("DB Get Error:", error);
        return null;
    }
}

/**
 * DB에 오디오 데이터를 저장합니다.
 * @param {string} key - 캐시 키
 * @param {string} data - Base64 오디오 데이터
 */
export async function saveAudioToDB(key, data) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(data, key);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.warn("DB Save Error:", error);
    }
}