// src/firebase.js
import { initializeApp } from "firebase/app";
// 🌟 1. 加上這一行，引入 Firestore 資料庫功能
import { getFirestore } from "firebase/firestore"; 

const firebaseConfig = {
  apiKey: "AIzaSyAyWPYURhMqYRvZrS7BkY3vOaQNczoSp6U",
  authDomain: "busan-tokyo-travel.firebaseapp.com",
  projectId: "busan-tokyo-travel",
  storageBucket: "busan-tokyo-travel.firebasestorage.app",
  messagingSenderId: "345671132127",
  appId: "1:345671132127:web:bf31babecddc28b043da6a",
  measurementId: "G-YFS5Q2Z66C"
};

// 初始化 Firebase App
const app = initializeApp(firebaseConfig);

// 🌟 2. 核心關鍵：將資料庫服務初始化，並用 export 匯出給 App.js 使用！
export const db = getFirestore(app); 
