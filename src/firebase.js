// 1. 這裡原本就有
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// 💡 新增這一行：引入 Firestore 資料庫功能
import { getFirestore } from "firebase/firestore"; 

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAyWPYURhMqYRvZrS7BkY3vOaQNczoSp6U",
  authDomain: "busan-tokyo-travel.firebaseapp.com",
  projectId: "busan-tokyo-travel",
  storageBucket: "busan-tokyo-travel.firebasestorage.app",
  messagingSenderId: "345671132127",
  appId: "1:345671132127:web:bf31babecddc28b043da6a",
  measurementId: "G-YFS5Q2Z66C"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// 💡 新增這兩行：初始化 Firestore 並將 db 導出
const db = getFirestore(app);
export { db };