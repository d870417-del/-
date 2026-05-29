import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAyWPYURhMqYRvZrS7BkY3vOaQNczoSp6U",
  authDomain: "busan-tokyo-travel.firebaseapp.com",
  projectId: "busan-tokyo-travel",
  storageBucket: "busan-tokyo-travel.firebasestorage.app",
  messagingSenderId: "345671132127",
  appId: "1:345671132127:web:bf31babecddc28b043da6a",
  measurementId: "G-YFS5Q2Z66C"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

// 開啟離線快取，沒網路時從本地讀資料
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    // 多個分頁同時開啟時只有一個能啟用
    console.warn('Firebase 離線快取：多個分頁開啟，僅部分支援');
  } else if (err.code === 'unimplemented') {
    // 瀏覽器不支援
    console.warn('Firebase 離線快取：此瀏覽器不支援');
  }
});

export { db };
