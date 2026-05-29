import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Map, Utensils, ShoppingBag, Home, Users, User, Settings,
  Plane, Clock, Wallet, MapPin, Calendar, LogOut,
  ChevronRight, ChevronLeft, Plus, Edit2, Trash2, X, Check, Navigation, Camera, Delete, Calculator, CheckCircle2, UserCircle2, TrendingUp, TrendingDown, History, Download, FileText, AlertTriangle, List
} from 'lucide-react';

// 🌟 引入遠端雲端資料庫設定
import { db } from './firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

const IS_DEV = true; // 🔧 測試時改 true，上線時改 false
const appId = IS_DEV ? 'travel-pro-v42-DEV' : 'travel-pro-v42-final';

// ─── 圖片自動壓縮工具（防止圖片過大撐爆 Firestore 1MB 限制） ───────────────────
const compressImageBase64 = (base64Str, maxWidth = 600, maxHeight = 600) => {
  return new Promise((resolve) => {
    if (!base64Str || !base64Str.startsWith('data:image')) {
      resolve(base64Str);
      return;
    }
    const img = new Image();
    img.src = base64Str;
    img.onerror = () => {
      console.error('圖片載入失敗，回傳原始資料');
      resolve(base64Str); // 失敗時回傳原圖，避免 Promise 永遠 pending
    };
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
        } else {
          if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6)); // 壓縮為 60% 畫質的 JPEG
      } catch (err) {
        console.error('圖片壓縮失敗:', err);
        resolve(base64Str);
      }
    };
  });
};

// ─── 遠端即時同步 Firebase Firestore Hook ───────────────────────────────────
const useCloudState = (key, initial) => {
  const [state, setState] = useState(initial);
  const [loading, setLoading] = useState(true);
  // 用 ref 固定 initial，避免每次 render 傳入新的物件/陣列導致重複訂閱
  const initialRef = useRef(initial);

  useEffect(() => {
    const safeKey = key.replace(/:/g, '_');
    const docRef = doc(db, "travel_cooperation_v42", safeKey);

    // 連線逾時保護：10 秒內若 Firebase 沒有回應，強制結束 loading
    const timeoutId = setTimeout(() => {
      console.warn(`Firebase 連線逾時 (key: ${safeKey})，使用本地預設值`);
      setLoading(false);
    }, 10000);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      clearTimeout(timeoutId);
      if (docSnap.exists()) {
        setState(docSnap.data().value);
      } else {
        setDoc(docRef, { value: initialRef.current }).catch(err => console.error(err));
      }
      setLoading(false);
    }, (error) => {
      clearTimeout(timeoutId);
      console.error("Firebase 監聽失敗:", error);
      setLoading(false);
    });

    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [key]); // initial 改用 ref，不需放進依賴陣列

  const set = useCallback((valOrFn) => {
    const safeKey = key.replace(/:/g, '_');
    const docRef = doc(db, "travel_cooperation_v42", safeKey);
    
    setState(prev => {
      const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
      // JSON stringify/parse 清掉所有 undefined，Firebase 不接受 undefined
      const sanitized = JSON.parse(JSON.stringify(next ?? null));
      setDoc(docRef, { value: sanitized }).catch(err => console.error("雲端儲存失敗:", err));
      return next;
    });
  }, [key]);

  return [state, set, loading];
};

// ─── 地圖嵌入 (單點 iframe) ────────────────────────────────────────────────────
const GOOGLE_MAPS_API_KEY = 'AIzaSyD8V5bJLigATt1WJ8esgapLIIbKEAYOUXc';

const MapEmbed = ({ query }) => {
  if (!query) return (
    <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400 text-xs font-bold">暫無地點資訊</div>
  );
  return (
    <iframe
      width="100%"
      height="100%"
      frameBorder="0"
      src={`https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(query)}&language=zh-TW`}
      allowFullScreen
      title="map"
    />
  );
};

// ─── Photo Viewer Modal (圖片預覽器) ─────────────────────────────────────────
const PhotoViewerModal = ({ photos, initialIndex = 0, isOpen, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  useEffect(() => { setCurrentIndex(initialIndex); }, [initialIndex, isOpen]);
  if (!isOpen || !photos?.length) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/95 backdrop-blur-md p-4">
      <button onClick={onClose} className="absolute top-6 right-6 text-white p-3 bg-white/10 rounded-full hover:bg-white/20 transition-colors z-10 active:scale-90"><X size={24} /></button>
      <img src={photos[currentIndex]} className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl animate-in zoom-in duration-200" alt="preview" />
      {photos.length > 1 && (
        <div className="absolute bottom-10 left-0 right-0 flex items-center justify-center gap-6">
          <button onClick={() => setCurrentIndex(p => p > 0 ? p - 1 : photos.length - 1)} className="p-4 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors backdrop-blur-md active:scale-90"><ChevronLeft size={24} /></button>
          <span className="text-white font-bold bg-white/10 px-5 py-2.5 rounded-2xl backdrop-blur-md text-sm tracking-widest">{currentIndex + 1} / {photos.length}</span>
          <button onClick={() => setCurrentIndex(p => p < photos.length - 1 ? p + 1 : 0)} className="p-4 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors backdrop-blur-md active:scale-90"><ChevronRight size={24} /></button>
        </div>
      )}
    </div>
  );
};

// ─── Persistent Storage (uses window.storage API) ───────────────────────────
const useStorageState = (key, initial) => {
  const [state, setState] = useState(initial);
  const loaded = useRef(false);
  const storage = useMemo(() => {
    if (typeof window !== 'undefined' && window.storage) return window.storage;
    return {
      get: async (k) => {
        const value = window.localStorage.getItem(k);
        return value === null ? undefined : { value };
      },
      set: async (k, value) => {
        window.localStorage.setItem(k, value);
      }
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await storage.get(key);
        if (res && res.value !== undefined) {
          setState(JSON.parse(res.value));
        }
      } catch (_) { /* key not found, use initial */ }
      loaded.current = true;
    })();
  }, [key, storage]);

  const set = useCallback((valOrFn) => {
    setState(prev => {
      const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
      storage.set(key, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [key, storage]);

  return [state, set];
};

// ─── MemberContext ────────────────────────────────────────────────────────────
const MemberContext = createContext();

export function MemberProvider({ children }) {
  const [initName, setInitName] = useState('');
  const [currentMember, setCurrentMember] = useStorageState(`${appId}:member`, null);
  
  const [allMembers, setAllMembers, isMembersLoading] = useCloudState(`${appId}:allMembers`, []);
  const [tripDates, setTripDates] = useCloudState(`${appId}:tripDates`, ['待安排', '06/06', '06/07', '06/08', '06/09', '06/10', '06/11', '06/12', '06/13', '06/14']);
  const [walletDates, setWalletDates] = useCloudState(`${appId}:walletDates`, []);
  const [trips, setTrips] = useCloudState(`${appId}:trips`, [{ id: 1, title: '釜山東京雙城遊', date: '2026-06-06' }]);
  
  const [flights, setFlights] = useCloudState(`${appId}:flights`, [
    { id: 1, no: 'CI 0190', date: '06/06', from: '桃園', to: '釜山', dep: '06:15', arr: '09:30' },
    { id: 2, no: 'BX 112', date: '06/10', from: '釜山', to: '東京成田', dep: '07:50', arr: '10:00' },
    { id: 3, no: 'CI 0101', date: '06/14', from: '東京成田', to: '台北桃園', dep: '14:30', arr: '17:15' }
  ]);
  
  const [stays, setStays] = useCloudState(`${appId}:stays`, [
    { id: 1, name: 'UH Continental CenterPoint', checkIn: '06/06', checkOut: '06/10', mapUrl: 'https://maps.app.goo.gl/tniUPpQDWuPtW4oQ6' },
    { id: 2, name: '三井花園飯店五反田', checkIn: '06/10', checkOut: '06/14', mapUrl: 'https://maps.app.goo.gl/Zw8Apv464GyRTnKG9' }
  ]);

  const [globalItinerary, setGlobalItinerary] = useCloudState(`${appId}:globalItinerary`, [
    // Day 1
    { id: 101, date: '06/06', time: '10:30', name: '抵達飯店 & 寄放行李', category: '住宿', mapUrl: '', note: '從機場叫兩台計程車直達 UH Continental。飯店位置極佳，寄完行李可以先在沙灘前拍第一組 6 人合照。', lastEdited: '管理員', photos: [], createdAt: 1 },
    { id: 102, date: '06/06', time: '12:00', name: '午餐：海雲台傳統市場', category: '美食', mapUrl: '', note: '市場就在飯店旁邊\n必吃推薦：尚國家饭捲 (Sang-guk-ine) 的辣炒年糕與炸物、釜山道地的豬肉湯飯。', lastEdited: '管理員', photos: [], createdAt: 2 },
    { id: 103, date: '06/06', time: '14:00', name: 'Centum City 購物 & Spa Land 汗蒸幕', category: '景點', mapUrl: '', note: 'Spa Land (VBP景點)：號稱「汗蒸幕界的愛馬仕」，有 22 個不同溫度的房型。紅眼班機後在這裡睡午覺是最好的恢復方式。\n\n新世界百貨：逛完 Spa Land 直接逛百貨。B2 樓層有最多韓系潮牌 (Matin Kim, Marithé 等)，8 樓則是新世界免稅店。', lastEdited: '管理員', photos: [], createdAt: 3 },
    { id: 104, date: '06/06', time: '19:00', name: '廣安里海水浴場', category: '景點', mapUrl: '', note: '搭計程車 15 分鐘\n必做清單：廣安大橋夜景、在沙灘上玩仙女棒。', lastEdited: '管理員', photos: [], createdAt: 4 },
    { id: 105, date: '06/06', time: '20:00', name: '廣安里 M 無人機秀 (週六限定)', category: '景點', mapUrl: '', note: '必看提醒：這是釜山週六最大的重頭戲，數百台無人機會在空中變換圖案。', lastEdited: '管理員', photos: [], createdAt: 5 },
    { id: 106, date: '06/06', time: '21:00', name: '晚餐：廣安里炸雞配啤酒', category: '美食', mapUrl: '', note: '推薦：BHC 炸雞或橋村炸雞。', lastEdited: '管理員', photos: [], createdAt: 6 },
    // Day 2
    { id: 201, date: '06/07', time: '10:00', name: '慢活早晨：海理團路', category: '景點', mapUrl: '', note: '飯店對面區域\n穿過海雲台車站後方，有許多老宅改建的歐式早午餐店、肉桂捲名店。', lastEdited: '管理員', photos: [], createdAt: 7 },
    { id: 202, date: '06/07', time: '13:00', name: '海邊散步：海雲台沙灘 ➡️ 尾浦站', category: '景點', mapUrl: '', note: '從飯店沿著沙灘往左邊散步約 15 分鐘即可到達藍線公園 (Blue Line Park) 的起點。', lastEdited: '管理員', photos: [], createdAt: 8 },
    { id: 203, date: '06/07', time: '15:15', name: '尾浦站報到 (已預約)', category: '交通', mapUrl: '', note: '搭乘前 15 分鐘完成報到', lastEdited: '管理員', photos: [], createdAt: 9 },
    { id: 204, date: '06/07', time: '15:30', name: '天空膠囊列車 (尾浦 ➡️ 青沙浦)', category: '景點', mapUrl: '', note: '拍照攻略：膠囊火車行駛很慢，6 個人可以分兩台車，彼此互拍窗外的海景。', lastEdited: '管理員', photos: [], createdAt: 10 },
    { id: 205, date: '06/07', time: '16:10', name: '青沙浦漫步', category: '景點', mapUrl: '', note: '必拍景點：紅白燈塔、灌籃高手場景平交道（火車穿過街道直奔大海）。', lastEdited: '管理員', photos: [], createdAt: 11 },
    { id: 206, date: '06/07', time: '18:30', name: '晚餐：青沙浦烤貝類一條街', category: '美食', mapUrl: '', note: '必吃推薦：海仙境或秀敏家。在海邊帳篷下大口吃現烤貝類與海鮮塔，氣氛絕佳。', lastEdited: '管理員', photos: [], createdAt: 12 },
    // Day 3
    { id: 301, date: '06/08', time: '09:30', name: '甘川洞文化村', category: '景點', mapUrl: '', note: '必拍清單：找小王子與狐狸的背影拍 6 人合照、逛繽紛的彩繪階梯。', lastEdited: '管理員', photos: [], createdAt: 13 },
    { id: 302, date: '06/08', time: '12:30', name: '午餐：南浦洞或札嘎其市場', category: '美食', mapUrl: '', note: '必吃推薦：南浦洞豬蹄街（生菜包豬蹄）、札嘎其市場的新鮮生魚片。', lastEdited: '管理員', photos: [], createdAt: 14 },
    { id: 303, date: '06/08', time: '14:30', name: '松島海上纜車 & 龍宮雲橋', category: '景點', mapUrl: '', note: '體驗亮點 (VBP景點)：搭乘水晶車廂 (地板全透明) 橫跨海洋。龍宮雲橋則是建在無人島上的懸空步道。', lastEdited: '管理員', photos: [], createdAt: 15 },
    { id: 304, date: '06/08', time: '17:00', name: '西面樂天免稅店 (8F)', category: '購物', mapUrl: '', note: '重要提醒：免稅店 18:30 就會關門，請務必先衝這區，再去逛地下街。', lastEdited: '管理員', photos: [], createdAt: 16 },
    { id: 305, date: '06/08', time: '19:00', name: '晚餐：西面「味贊王鹽烤肉」', category: '美食', mapUrl: '', note: '必點推薦：3.5cm 厚切豬五花，專人代烤，是釜山最具人氣的烤肉店。', lastEdited: '管理員', photos: [], createdAt: 17 },
    // Day 4
    { id: 401, date: '06/09', time: '09:30', name: '海東龍宮寺', category: '景點', mapUrl: '', note: '景點特色：全韓國唯一建在海邊斷崖上的寺廟，非常莊嚴壯觀。', lastEdited: '管理員', photos: [], createdAt: 18 },
    { id: 402, date: '06/09', time: '11:30', name: 'Skyline Luge 斜坡滑車', category: '景點', mapUrl: '', note: '必玩重點 (VBP景點)：就在寺廟對面。操作手把順著山坡滑下，6 人分組競賽超級有趣。', lastEdited: '管理員', photos: [], createdAt: 19 },
    { id: 403, date: '06/09', time: '14:30', name: 'Busan X the Sky', category: '景點', mapUrl: '', note: '景點位置 (VBP景點)：就在妳們飯店隔壁的 LCT 大樓。這裡有全透明玻璃步道「Shocking Bridge」與世界最高星巴克。', lastEdited: '管理員', photos: [], createdAt: 20 },
    { id: 404, date: '06/09', time: '17:00', name: 'The Bay 101 夜景', category: '景點', mapUrl: '', note: '拍照攻略：在碼頭空地拍摩天大樓在積水上的倒影（專業攝影師必拍角度）。', lastEdited: '管理員', photos: [], createdAt: 21 },
    { id: 405, date: '06/09', time: '19:30', name: '樂天超市最後補貨', category: '購物', mapUrl: '', note: '必買推薦：HBAF 堅果、樂天巧克力派、各式韓國拉麵、海苔。超市內有紙箱區可打包。', lastEdited: '管理員', photos: [], createdAt: 22 },
    // Day 5
    { id: 501, date: '06/10', time: '04:30', name: '飯店退房', category: '住宿', mapUrl: '', note: '因為 07:50 飛機很早，這天要辛苦大家 04:30 集合。', lastEdited: '管理員', photos: [], createdAt: 23 },
    { id: 502, date: '06/10', time: '05:30', name: '金海機場報到與免稅品領取', category: '交通', mapUrl: '', note: '重要提醒：進候機室後，先去領取前幾天在百貨買的國際精品。', lastEdited: '管理員', photos: [], createdAt: 24 },
    { id: 503, date: '06/10', time: '07:50', name: '飛往東京成田 (BX 112)', category: '交通', mapUrl: '', note: '', lastEdited: '管理員', photos: [], createdAt: 25 },
  ]);

  const [shoppingList, setShoppingList] = useCloudState(`${appId}:shoppingList`, []);
  const [sharedTodos, setSharedTodos] = useCloudState(`${appId}:sharedTodos`, []);
  const [sharedWallet, setSharedWallet] = useCloudState(`${appId}:sharedWallet`, []);
  const [sharedNotes, setSharedNotes] = useCloudState(`${appId}:sharedNotes`, []);

  // ── 美食選項（城市、地區、食物類型）存在 Firebase，全員可增刪改 ──
  const [foodOptions, setFoodOptions] = useCloudState(`${appId}:foodOptions`, {
    cities: ['釜山', '東京'],
    districts: {
      '釜山': ['海雲台', '西面', '南浦洞', '廣安里', '青沙浦', '甘川洞', '松島', '機張'],
      '東京': ['涉谷', '新宿', '銀座', '淺草', '原宿', '表參道', '六本木', '秋葉原', '池袋', '上野', '築地', '豐洲'],
    },
    foodTypes: ['燒肉', '豬肉湯飯', '甜點咖啡', '拉麵', '壽司', '居酒屋', '海鮮', '炸雞', '韓式料理', '和食'],
  });

  // ── 購物選項（城市、商場、地區）存在 Firebase，全員可增刪改 ──
  const [shopOptions, setShopOptions] = useCloudState(`${appId}:shopOptions`, {
    cities: ['釜山', '東京'],
    malls: {
      '釜山': ['新世界百貨', '樂天免稅店', '樂天百貨', 'Olive Young', 'Centum City'],
      '東京': ['Don Quijote', '大創 DAISO', '松本清', '伊勢丹', '高島屋', 'BIC Camera', 'Yodobashi'],
    },
    locations: {
      '釜山': ['海雲台店', '西面店', '南浦洞店', 'Centum City', 'BIFF廣場旁'],
      '東京': ['涉谷店', '新宿店', '銀座店', '秋葉原店', '池袋店', '原宿店'],
    },
  });

  const [allPersonalWallets, setAllPersonalWallets] = useCloudState(`${appId}:allPersonalWallets`, {});
  const [allPersonalNotes, setAllPersonalNotes] = useCloudState(`${appId}:allPersonalNotes`, {});
  const [splitRecords, setSplitRecords] = useCloudState(`${appId}:splitRecords`, []);

  const personalWallet = currentMember ? (allPersonalWallets[currentMember.id] || []) : [];
  const setPersonalWallet = useCallback((valOrFn) => {
    if (!currentMember) return;
    setAllPersonalWallets(prev => {
      const cur = prev[currentMember.id] || [];
      const next = typeof valOrFn === 'function' ? valOrFn(cur) : valOrFn;
      return { ...prev, [currentMember.id]: next };
    });
  }, [currentMember, setAllPersonalWallets]);

  const personalNotes = currentMember ? (allPersonalNotes[currentMember.id] || []) : [];
  const setPersonalNotes = useCallback((valOrFn) => {
    if (!currentMember) return;
    setAllPersonalNotes(prev => {
      const cur = prev[currentMember.id] || [];
      const next = typeof valOrFn === 'function' ? valOrFn(cur) : valOrFn;
      return { ...prev, [currentMember.id]: next };
    });
  }, [currentMember, setAllPersonalNotes]);

  const login = (m) => setCurrentMember(m);
  const logout = () => setCurrentMember(null);
  const updateMember = (data) => {
    const updated = { ...currentMember, ...data };
    setCurrentMember(updated);
    setAllMembers(prev => prev.map(m => m.id === currentMember.id ? updated : m));
  };
  const createInitialAdmin = () => {
    if (!initName.trim()) return;
    const admin = { id: 'admin-' + Date.now(), name: initName.trim(), role: '管理員', avatarColor: '#3b82f6', photo: null, createdAt: Date.now() };
    setAllMembers([admin]);
    setInitName('');
  };

  const value = {
    currentMember, allMembers, setAllMembers, login, logout, updateMember,
    createInitialAdmin, initName, setInitName,
    isMembersLoading,
    globalItinerary, setGlobalItinerary,
    tripDates, setTripDates, walletDates, setWalletDates,
    trips, setTrips, flights, setFlights, stays, setStays,
    shoppingList, setShoppingList,
    sharedTodos, setSharedTodos,
    sharedWallet, setSharedWallet, sharedNotes, setSharedNotes,
    personalWallet, setPersonalWallet, allPersonalWallets, setAllPersonalWallets, personalNotes, setPersonalNotes,
    foodOptions, setFoodOptions,
    shopOptions, setShopOptions,
    splitRecords, setSplitRecords,
  };
  return <MemberContext.Provider value={value}>{children}</MemberContext.Provider>;
}

export const useMember = () => useContext(MemberContext);

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message, confirmText = '確認刪除' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative bg-white rounded-3xl w-full max-w-xs p-7 shadow-xl animate-in zoom-in duration-200 flex flex-col items-center gap-4">
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center">
          <AlertTriangle size={28} className="text-red-400" />
        </div>
        <div className="text-center">
          <h3 className="text-base font-black text-slate-800 mb-1">{title || '確認刪除'}</h3>
          <p className="text-sm text-slate-500">{message || '此操作無法復原，確定要繼續嗎？'}</p>
        </div>
        <div className="flex gap-3 w-full mt-2">
          <button onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-2xl active:scale-95 text-sm hover:bg-slate-200 transition-colors">取消</button>
          <button onClick={() => { onClose(); setTimeout(() => onConfirm(), 50); }} className="flex-1 py-3 bg-red-500 text-white font-bold rounded-2xl active:scale-95 shadow-md shadow-red-100 text-sm hover:bg-red-600 transition-colors">{confirmText}</button>
        </div>
      </div>
    </div>
  );
};

// ─── Date Picker Modal ────────────────────────────────────────────────────────
const DatePickerModal = ({ isOpen, onClose, onSelect, existingDates = [] }) => {
  const [picked, setPicked] = useState('');
  if (!isOpen) return null;
  const handleAdd = () => {
    if (!picked) return;
    const d = new Date(picked);
    const mmdd = `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
    onSelect(mmdd);
    setPicked('');
    onClose();
  };
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative bg-white rounded-3xl w-full max-w-xs p-7 shadow-xl animate-in zoom-in duration-200 flex flex-col gap-4">
        <h3 className="text-base font-black text-slate-800">新增日期</h3>
        <input type="date" value={picked} onChange={e => setPicked(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl h-12 px-4 font-bold text-blue-600 outline-none text-base focus:border-blue-300" />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-2xl active:scale-95 text-sm hover:bg-slate-200">取消</button>
          <button onClick={handleAdd} disabled={!picked} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-2xl active:scale-95 disabled:opacity-40 text-sm shadow-md shadow-blue-100">新增</button>
        </div>
      </div>
    </div>
  );
};

// ─── Modal ────────────────────────────────────────────────────────────────────
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative bg-white rounded-[2.5rem] w-[95vw] max-w-md p-6 sm:p-8 max-h-[90vh] overflow-y-auto no-scrollbar flex flex-col shadow-xl animate-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-5 shrink-0 border-b border-slate-100 pb-4">
          <h3 className="text-lg font-black text-slate-800 tracking-tight">{title}</h3>
          <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 active:scale-90 transition-all"><X size={20} /></button>
        </div>
        <div className="flex-1 w-full flex flex-col gap-1">{children}</div>
      </div>
    </div>
  );
};

// ─── FormField ────────────────────────────────────────────────────────────────
const FormField = ({ label, type = 'text', value, onChange, placeholder, options }) => (
  <div className="mb-3 w-full shrink-0">
    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 block"> {label}</label>
    {type === 'textarea' ? (
      <textarea value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-white border border-slate-200 rounded-2xl p-4 font-semibold text-slate-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none resize-none min-h-[70px] text-sm transition-all shadow-sm" />
    ) : type === 'select' ? (
      <select value={value || ''} onChange={e => onChange(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl p-4 font-bold text-slate-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none appearance-none text-sm transition-all shadow-sm">
        <option value="" disabled>請選擇</option>
        {options?.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    ) : type === 'date' ? (
      <input type="date" value={value || ''} onChange={e => onChange(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl h-12 px-4 font-bold text-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all shadow-sm" />
    ) : type === 'time' ? (
      <input type="time" value={value || ''} onChange={e => onChange(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl h-12 px-4 font-bold text-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all shadow-sm" />
    ) : (
      <input type="text" value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-white border border-slate-200 rounded-2xl p-4 font-semibold text-slate-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none text-sm transition-all shadow-sm" />
    )}
  </div>
);

// ─── Avatar ───────────────────────────────────────────────────────────────────
const Avatar = ({ member, className = 'w-10 h-10' }) => {
  if (!member) return null;
  if (member.photo) {
    return (
      <img src={member.photo} alt={member.name || 'User'} className={`${className} object-cover rounded-2xl border-2 border-white shadow-sm`} />
    );
  }
  const safeName = (member.name || 'U').trim();
  const firstChar = safeName.charAt(0).toUpperCase();
  return (
    <div className={`${className} rounded-2xl flex items-center justify-center text-white font-black shadow-sm border-2 border-white`} style={{ backgroundColor: member.avatarColor || '#3b82f6' }}>
      {firstChar}
    </div>
  );
};

const downloadTextFile = (content, filename) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
  a.download = `${filename}.txt`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
};

const getSmartDate = (datesArray) => {
  if (!datesArray || datesArray.length === 0) return '待安排';
  const now = new Date();
  const todayStr = `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}`;
  const sorted = [...datesArray].filter(d => d !== '待安排').sort();
  if (sorted.includes(todayStr)) return todayStr;
  const future = sorted.filter(d => d > todayStr);
  if (future.length > 0) return future[0];
  if (sorted.length > 0) return sorted[sorted.length - 1];
  return '待安排';
};

const getCategoryColor = (cat) => {
  const map = {
    '景點': 'bg-teal-50 text-teal-600 border-teal-100',
    '美食': 'bg-orange-50 text-orange-600 border-orange-100',
    '購物': 'bg-pink-50 text-pink-600 border-pink-100',
    '交通': 'bg-purple-50 text-purple-600 border-purple-100',
    '住宿': 'bg-blue-50 text-blue-600 border-blue-100',
    '換匯': 'bg-rose-50 text-rose-600 border-rose-100',
    '其他': 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return map[cat] || map['其他'];
};

// ─── HomePage ─────────────────────────────────────────────────────────────────
const HomePage = ({ onNavigate }) => {
  const { trips, setTrips, flights, setFlights, stays, setStays, globalItinerary, sharedWallet, currentMember } = useMember();
  const [modal, setModal] = useState({ type: null, data: null });
  const [confirmDel, setConfirmDel] = useState(null);

  const walletBalances = useMemo(() => {
    const totals = { JPY: 0, KRW: 0, TWD: 0 };
    if (Array.isArray(sharedWallet)) {
      sharedWallet.forEach(item => {
        const amt = Number(item?.amount) || 0;
        if (item?.type === '存入') totals[item.currency] += amt; else totals[item.currency] -= amt;
      });
    }
    return totals;
  }, [sharedWallet]);

// 🌟 加入 100% 防呆的安全版本
  const nextTripItem = useMemo(() => {
    const now = new Date().setHours(0, 0, 0, 0);
    return [...(globalItinerary || [])]
      // 1. 先把沒有 date 的瑕疵資料過濾掉
      .filter(i => i && i.date && i.date !== '待安排')
      // 2. 排序時加上 || '' 確保絕對不會遇到 undefined 崩潰
      .sort((a, b) => {
        const dateA = a?.date || '';
        const dateB = b?.date || '';
        const timeA = a?.time || '';
        const timeB = b?.time || '';
        return dateA.localeCompare(dateB) || timeA.localeCompare(timeB);
      })
      .find(i => {
        try {
          return new Date(`2026/${i.date}`).getTime() >= now;
        } catch(e) {
          return false;
        }
      });
  }, [globalItinerary]);

  const getDDay = (targetDate) => Math.ceil((new Date(targetDate) - new Date().setHours(0, 0, 0, 0)) / 86400000);

  const handleSave = (data) => {
    if (modal.type === 'trip') {
      if (data.id) setTrips(trips.map(t => t.id === data.id ? data : t));
      else setTrips([...trips, { ...data, id: Date.now() }]);
    } else if (modal.type === 'flight') {
      if (data.id) setFlights(flights.map(f => f.id === data.id ? data : f));
      else setFlights([...flights, { ...data, id: Date.now() }]);
    } else if (modal.type === 'stay') {
      if (data.id) setStays(stays.map(s => s.id === data.id ? data : s));
      else setStays([...stays, { ...data, id: Date.now() }]);
    }
    setModal({ type: null, data: null });
  };

  return (
    <div className="px-4 pt-5 space-y-6 animate-in fade-in duration-500 pb-28">
      <section className="grid grid-cols-3 gap-3">
        {[['JPY', 'bg-rose-50', 'text-rose-600', 'border-rose-100'], ['KRW', 'bg-indigo-50', 'text-indigo-600', 'border-indigo-100'], ['TWD', 'bg-emerald-50', 'text-emerald-600', 'border-emerald-100']].map(([cur, bg, tc, bc]) => (
          <div key={cur} className={`${bg} border ${bc} p-4 rounded-3xl text-center shadow-sm`}>
            <p className={`text-xs font-black ${tc} mb-1 uppercase tracking-widest opacity-70`}>{cur}</p>
            <p className={`text-sm font-black ${tc}`}>{walletBalances[cur] >= 0 ? '+' : ''}{(walletBalances[cur] || 0).toLocaleString()}</p>
          </div>
        ))}
      </section>

      <section>
        <div className="flex justify-between items-center mb-3 px-1">
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Clock size={14} /> 旅遊倒數計時</span>
          <button onClick={() => setModal({ type: 'trip', data: {} })} className="text-blue-500 hover:text-blue-600 active:scale-90 transition-colors"><Plus size={20} /></button>
        </div>
        {trips.map(t => (
          <div key={t.id} className="relative bg-gradient-to-br from-blue-500 to-sky-400 p-6 rounded-[2rem] text-white shadow-md mb-3 group overflow-hidden">
            <div className="absolute top-4 right-4 flex gap-2 z-10 opacity-80 hover:opacity-100 transition-opacity">
              <button onClick={() => setModal({ type: 'trip', data: t })} className="p-2 bg-white/20 hover:bg-white/40 rounded-full backdrop-blur-sm transition-colors"><Edit2 size={14} /></button>
              <button onClick={() => setConfirmDel({ title: '確認刪除旅行計畫', message: `確定要刪除「${t.title}」嗎？`, fn: () => setTrips(p => p.filter(x => x.id !== t.id)) })} className="p-2 bg-white/20 hover:bg-red-500/80 rounded-full backdrop-blur-sm transition-colors"><Trash2 size={14} /></button>
            </div>
            <h2 className="text-sm font-bold mb-2 pr-20 opacity-90">{t.title}</h2>
            <div className="flex items-end gap-2">
              <span className="text-5xl font-black tracking-tighter">D-{getDDay(t.date)}</span>
              <span className="text-blue-100 text-xs font-bold mb-1.5 uppercase tracking-widest">Days Left</span>
            </div>
          </div>
        ))}
      </section>

      <section>
        <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 px-1">即將到來的行程</div>
        <div onClick={() => onNavigate('trip')} className="bg-white border border-slate-100 p-5 rounded-[2rem] flex items-center gap-5 active:scale-[0.98] transition-all cursor-pointer shadow-sm hover:shadow-md">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 border border-blue-100">
            {nextTripItem ? (nextTripItem.time || '待定') : '--:--'}
          </div>
          <div className="flex-1">
            <p className="text-xs font-black text-blue-400 uppercase mb-1 tracking-widest">Next Stop</p>
            <h4 className="text-base font-bold text-slate-800 leading-tight line-clamp-2">
              {nextTripItem ? nextTripItem.name : '目前暫無即將到來的行程'}
            </h4>
          </div>
          <ChevronRight size={24} className="text-blue-300 shrink-0" />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <span className="font-black text-slate-400 text-xs uppercase tracking-widest">航班資訊</span>
          <button onClick={() => setModal({ type: 'flight', data: {} })} className="text-blue-500 hover:text-blue-600 active:scale-90 transition-colors"><Plus size={20} /></button>
        </div>
        {flights.map(f => (
          <div key={f.id} className="relative bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
            <div className="absolute top-4 right-4 flex gap-2 z-10 opacity-70 hover:opacity-100 transition-opacity">
              <button onClick={() => setModal({ type: 'flight', data: f })} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-500 transition-colors border border-slate-100"><Edit2 size={14} /></button>
              <button onClick={() => setConfirmDel({ title: '確認刪除航班資訊', message: `確定要刪除航班「${f.no}」嗎？`, fn: () => setFlights(p => p.filter(x => x.id !== f.id)) })} className="p-2 bg-red-50 hover:bg-red-100 rounded-full text-red-400 transition-colors border border-red-100"><Trash2 size={14} /></button>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-blue-500 text-white px-3 py-1 rounded-full font-black text-xs tracking-widest shadow-sm">{f.no}</span>
                <span className="text-slate-400 text-xs font-bold tracking-widest">{f.date}</span>
              </div>
              <div className="flex justify-between items-center px-2 pr-16">
                <p className="text-xl font-black text-slate-700 tracking-tighter truncate max-w-[80px] text-center">{f.from}</p>
                <div className="flex-1 border-b-2 border-dotted border-slate-200 mx-5 relative mb-2">
               <Plane size={18} className="absolute -top-3 left-1/2 -translate-x-1/2 text-slate-300 bg-white px-1 -scale-x-100" />
                </div>
                <p className="text-xl font-black text-slate-700 tracking-tighter truncate max-w-[80px] text-center">{f.to}</p>
              </div>
            </div>
            <div className="p-3 bg-slate-50/80 flex justify-between text-xs font-black px-8 border-t border-slate-100">
              <div><span className="text-slate-400 mr-2 uppercase text-xs">Dep</span><span className="text-blue-600 text-sm">{f.dep}</span></div>
              <div><span className="text-slate-400 mr-2 uppercase text-xs">Arr</span><span className="text-blue-600 text-sm">{f.arr}</span></div>
            </div>
          </div>
        ))}

        <div className="flex justify-between items-center px-1 pt-2">
          <span className="font-black text-slate-400 text-xs uppercase tracking-widest">下榻飯店</span>
          <button onClick={() => setModal({ type: 'stay', data: {} })} className="text-blue-500 hover:text-blue-600 active:scale-90 transition-colors"><Plus size={20} /></button>
        </div>
        {stays.map(s => (
          <div key={s.id} className="relative bg-white border border-slate-100 p-5 rounded-[2rem] shadow-sm hover:shadow-md transition-shadow flex items-center justify-between group">
            <div className="absolute top-2 right-2 flex gap-1.5 z-10 opacity-70 hover:opacity-100 transition-opacity">
              <button onClick={() => setModal({ type: 'stay', data: s })} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-500 transition-colors border border-slate-100"><Edit2 size={12} /></button>
              <button onClick={() => setConfirmDel({ title: '確認刪除飯店資訊', message: `確定要刪除「${s.name}」嗎？`, fn: () => setStays(p => p.filter(x => x.id !== s.id)) })} className="p-2 bg-red-50 hover:bg-red-100 rounded-full text-red-400 transition-colors border border-red-100"><Trash2 size={12} /></button>
            </div>
            <div className="flex-1 pr-14">
              <h4 className="text-base font-bold text-slate-800 mb-1.5 leading-tight">{s.name}</h4>
              <p className="text-xs font-bold text-blue-500 tracking-widest uppercase flex items-center gap-1"><Calendar size={12} /> {s.checkIn} — {s.checkOut}</p>
            </div>
            {s.mapUrl && (
              <a href={s.mapUrl} target="_blank" rel="noreferrer" className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex flex-col items-center justify-center hover:bg-blue-100 active:scale-90 border border-blue-100 shrink-0 transition-colors">
                <Navigation size={20} />
                <span className="text-[10px] font-bold mt-0.5">MAP</span>
              </a>
            )}
          </div>
        ))}
      </section>

      <Modal isOpen={!!modal.type} onClose={() => setModal({ type: null, data: null })} title="首頁內容編輯">
        {modal.type === 'trip' && (
          <>
            <FormField label="旅行計畫名稱" value={modal.data?.title} onChange={v => setModal({ ...modal, data: { ...modal.data, title: v } })} placeholder="如：釜山之旅" />
            <FormField label="出發日期" type="date" value={modal.data?.date} onChange={v => setModal({ ...modal, data: { ...modal.data, date: v } })} />
          </>
        )}
        {modal.type === 'flight' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="航班號" value={modal.data?.no} onChange={v => setModal({ ...modal, data: { ...modal.data, no: v } })} />
              <FormField label="日期" value={modal.data?.date} onChange={v => setModal({ ...modal, data: { ...modal.data, date: v } })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="出發地" value={modal.data?.from} onChange={v => setModal({ ...modal, data: { ...modal.data, from: v } })} />
              <FormField label="抵達地" value={modal.data?.to} onChange={v => setModal({ ...modal, data: { ...modal.data, to: v } })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="起飛時間" type="time" value={modal.data?.dep} onChange={v => setModal({ ...modal, data: { ...modal.data, dep: v } })} />
              <FormField label="抵達時間" type="time" value={modal.data?.arr} onChange={v => setModal({ ...modal, data: { ...modal.data, arr: v } })} />
            </div>
          </>
        )}
        {modal.type === 'stay' && (
          <>
            <FormField label="飯店名稱" value={modal.data?.name} onChange={v => setModal({ ...modal, data: { ...modal.data, name: v } })} />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="入住日期" value={modal.data?.checkIn} onChange={v => setModal({ ...modal, data: { ...modal.data, checkIn: v } })} />
              <div className="grid grid-cols-2 gap-3">
                <FormField label="退房日期" value={modal.data?.checkOut} onChange={v => setModal({ ...modal, data: { ...modal.data, checkOut: v } })} />
              </div>
            </div>
            <FormField label="Map 連結" value={modal.data?.mapUrl} onChange={v => setModal({ ...modal, data: { ...modal.data, mapUrl: v } })} />
          </>
        )}
        <button onClick={() => handleSave(modal.data)} className="w-full bg-blue-500 text-white font-black py-4 rounded-2xl shadow-md active:scale-95 mt-3 text-base hover:bg-blue-600 transition-colors">確認儲存</button>
      </Modal>

      <ConfirmDialog isOpen={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={() => confirmDel?.fn()} title={confirmDel?.title} message={confirmDel?.message} />
    </div>
  );
};

// ─── TripPage ─────────────────────────────────────────────────────────────────
const TripPage = ({ onDownload, onNavigateToFood }) => {
  const { globalItinerary, setGlobalItinerary, tripDates, setTripDates, currentMember, allMembers } = useMember();
  const [selectedDate, setSelectedDate] = useState(() => getSmartDate(tripDates));
  const [viewMode, setViewMode] = useState('list');
  const [activeMapItem, setActiveMapItem] = useState(null);
  
  const [modal, setModal] = useState({ type: null, data: null });
  const [tempPhotos, setTempPhotos] = useState([]);
  const [confirmDel, setConfirmDel] = useState(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [dateConfirmDel, setDateConfirmDel] = useState(null);
  
  const [viewerPhotos, setViewerPhotos] = useState(null);
  const [viewerIndex, setViewerIndex] = useState(0);

  const visibleTripDates = tripDates;

  const filteredItems = useMemo(() => {
    const items = globalItinerary.filter(i => i.date === selectedDate);
    if (selectedDate === '待安排') return items.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    return items.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  }, [globalItinerary, selectedDate]);

  useEffect(() => {
    if (viewMode === 'map' && filteredItems.length > 0) {
      if (!activeMapItem || !filteredItems.find(i => i.id === activeMapItem.id)) {
        setActiveMapItem(filteredItems[0]);
      }
    }
  }, [viewMode, filteredItems]);

  useEffect(() => {
    onDownload(() => () => {
      let text = `行程清單 - ${selectedDate}\n\n`;
      filteredItems.forEach(i => {
        text += `[${i.time || '待定'}] ${i.name}${i.location ? ` @ ${i.location}` : ''} (${i.category})\n`;
        if (i.note) text += `備註: ${i.note}\n`;
        if (i.mapUrl) text += `地圖: ${i.mapUrl}\n`;
        text += '---------------------------\n';
      });
      downloadTextFile(text, `Trip_${selectedDate.replace('/', '-')}`);
    });
  }, [filteredItems, selectedDate, onDownload]);

  const handleAddDate = (mmdd) => {
    if (!tripDates.includes(mmdd)) {
      const sorted = ['待安排', ...[...tripDates.filter(d => d !== '待安排'), mmdd].sort()];
      setTripDates(sorted);
    }
    setSelectedDate(mmdd);
  };

  const handleDeleteDate = (d) => {
    setDateConfirmDel({
      fn: () => {
        setTripDates(p => p.filter(it => it !== d));
        if (selectedDate === d) setSelectedDate('待安排');
      }
    });
  };

  // 地圖搜尋字串：優先用 location，其次用 name
  const getMapQuery = (item) => item.location || item.name;

  // 一鍵開啟這天所有地點
  const openAllOnGoogleMaps = () => {
    const withMap = filteredItems.filter(i => i.mapUrl);
    if (withMap.length === 1) { window.open(withMap[0].mapUrl, '_blank'); return; }
    const query = filteredItems.map(getMapQuery).join(' | ');
    window.open(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, '_blank');
  };

  return (
    <div className="relative animate-in fade-in pb-28">
      <div className="sticky top-0 z-30 px-4 pt-3 pb-3 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="flex justify-between items-center mb-3 px-1">
          <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest">行程時間軸</h3>
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100/80 rounded-full p-1 border border-slate-200">
              <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-full transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-500' : 'text-slate-400 hover:text-slate-600'}`}><List size={14} /></button>
              <button onClick={() => setViewMode('map')} className={`p-1.5 rounded-full transition-colors ${viewMode === 'map' ? 'bg-white shadow-sm text-blue-500' : 'text-slate-400 hover:text-slate-600'}`}><Map size={14} /></button>
            </div>
            <button onClick={() => setDatePickerOpen(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100 active:scale-95 transition-all hover:bg-blue-100">
              <Plus size={14} /> 新增日期
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 px-1">
          {visibleTripDates.map(d => (
            <button key={d} onClick={() => setSelectedDate(d)} className={`flex-shrink-0 px-4 py-2 rounded-2xl text-xs font-bold transition-all border flex items-center gap-1.5 ${selectedDate === d ? 'bg-blue-500 text-white border-blue-500 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
              {d}
              {d !== '待安排' && (
                <span onClick={e => { e.stopPropagation(); handleDeleteDate(d); }} className={`ml-1 transition-opacity ${selectedDate === d ? 'text-blue-200 hover:text-white' : 'text-slate-300 hover:text-red-400'}`}>
                  <X size={14} />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {viewMode === 'map' ? (
        <div className="mt-4 px-4 h-[calc(100vh-250px)] flex flex-col animate-in fade-in">
          {/* 一鍵開啟這天所有地點 */}
          {filteredItems.length > 0 && (
            <button onClick={openAllOnGoogleMaps} className="mb-3 w-full py-2.5 bg-blue-500 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 hover:bg-blue-600 active:scale-95 transition-all shadow-sm">
              <MapPin size={14} strokeWidth={2.5} />
              一鍵開啟 {selectedDate} 全部 {filteredItems.length} 個地點
            </button>
          )}
          <div className="flex-1 rounded-[2rem] overflow-hidden border border-slate-200 shadow-sm bg-slate-100 relative">
            {activeMapItem ? (
              <MapEmbed query={getMapQuery(activeMapItem)} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm font-bold">無行程可顯示</div>
            )}
          </div>
          {filteredItems.length > 0 && (
            <div className="h-32 mt-4 overflow-x-auto no-scrollbar flex items-center gap-3 shrink-0 pb-2">
              {filteredItems.map((item, idx) => {
                const isActive = activeMapItem?.id === item.id;
                return (
                  <div key={item.id} onClick={() => setActiveMapItem(item)} className={`w-56 p-3.5 rounded-3xl shrink-0 border shadow-sm transition-all cursor-pointer ${isActive ? 'bg-blue-500 text-white border-blue-500 scale-105' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${isActive ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'}`}>{idx + 1}</span>
                      {item.time && <span className={`text-[10px] font-black ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>{item.time}</span>}
                      <span className={`text-[10px] font-bold truncate flex-1 ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>{item.category}</span>
                      <button onClick={e => { e.stopPropagation(); setModal({ type: 'item', data: item }); setTempPhotos(item.photos || []); }}
                        className={`p-1 rounded-lg shrink-0 transition-colors ${isActive ? 'bg-white/20 text-white' : 'bg-slate-50 text-slate-400 hover:text-blue-500'}`}>
                        <Edit2 size={11} />
                      </button>
                    </div>
                    <h4 className="font-bold text-sm truncate">{item.name}</h4>
                    {item.location && (
                      <p className={`text-[10px] mt-0.5 flex items-center gap-1 ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                        <MapPin size={9} />{item.location}
                      </p>
                    )}
                    {item.mapUrl && (
                      <a href={item.mapUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                        className={`mt-1 text-[10px] font-black flex items-center gap-1 ${isActive ? 'text-blue-100' : 'text-blue-400'}`}>
                        <Navigation size={9} />直接導航
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-5 px-4 relative animate-in fade-in">
          {selectedDate !== '待安排' && filteredItems.length > 0 && (
            <div className="absolute left-[2.35rem] top-0 bottom-0 w-0.5 bg-blue-100" style={{ top: 28, bottom: 28 }} />
          )}
          <div className="space-y-4">
            {filteredItems.map((item, idx) => {
              const editor = allMembers.find(m => m.id === item.editedById) || { name: item.lastEdited || '同行隊友' };
              
              return (
                <div key={item.id} className="relative flex gap-3 animate-in slide-in-from-bottom-2">
                  {selectedDate !== '待安排' && (
                    <div className="flex flex-col items-center shrink-0" style={{ width: 32 }}>
                      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-black shadow-md border-2 border-white z-10">{idx + 1}</div>
                    </div>
                  )}
                  <div className={`flex-1 bg-white border border-slate-100 p-5 rounded-[2rem] shadow-sm hover:shadow-md transition-shadow group ${selectedDate === '待安排' ? 'ml-0' : ''}`}>
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      {item.time && <span className="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg font-black text-xs border border-blue-100">{item.time}</span>}
                      <span className={`px-2.5 py-1 rounded-lg border font-bold text-xs uppercase tracking-wide ${getCategoryColor(item.category)}`}>{item.category}</span>
                      <div className="ml-auto flex gap-2 opacity-80 hover:opacity-100 transition-opacity">
                        <button onClick={() => { setModal({ type: 'item', data: item }); setTempPhotos(item.photos || []); }} className="p-2 text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors border border-slate-100"><Edit2 size={14} /></button>
                        <button onClick={() => setConfirmDel({ fn: () => setGlobalItinerary(p => p.filter(it => it.id !== item.id)) })} className="p-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-xl transition-colors border border-red-100"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <h4 className="text-base font-bold text-slate-800 leading-tight mb-1">{item.name}</h4>
                        {/* 地點顯示 */}
                        {item.location && (
                          <p className="flex items-center gap-1 text-xs font-bold text-slate-400 mb-2">
                            <MapPin size={11} className="text-blue-400 shrink-0" />{item.location}
                          </p>
                        )}
                        {item.note && <div className="bg-slate-50 border-l-4 border-blue-300 p-3 mb-3 text-sm text-slate-600 italic rounded-r-2xl whitespace-pre-wrap">{item.note}</div>}
                        {item.photos?.length > 0 && (
                          <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar">
                            {item.photos.map((p, i) => (
                              <img key={i} src={p} onClick={() => { setViewerPhotos(item.photos); setViewerIndex(i); }} className="w-16 h-16 object-cover rounded-xl border border-slate-100 shadow-sm shrink-0 cursor-pointer hover:opacity-80 transition-opacity" alt="pic" />
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <Avatar member={editor} className="w-4 h-4 rounded-md" />
                          <span>{editor.name} 編輯</span>
                        </div>
                      </div>
                      {item.category === '美食' ? (
                        <button onClick={() => onNavigateToFood && onNavigateToFood(item.id)}
                          className="w-12 h-12 bg-orange-50 text-orange-500 rounded-2xl flex flex-col items-center justify-center hover:bg-orange-100 active:scale-90 border border-orange-100 shrink-0 transition-colors">
                          <span className="text-xl leading-none">🍽️</span>
                          <span className="text-[9px] font-bold mt-0.5">詳情</span>
                        </button>
                      ) : item.mapUrl ? (
                        <a href={item.mapUrl} target="_blank" rel="noreferrer" className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex flex-col items-center justify-center hover:bg-blue-100 active:scale-90 border border-blue-100 shrink-0 transition-colors">
                          <Navigation size={20} />
                          <span className="text-[10px] font-bold mt-0.5">MAP</span>
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredItems.length === 0 && <div className="py-20 text-center text-slate-400 text-xs font-bold uppercase tracking-widest italic opacity-80">尚未安排行程</div>}
          </div>
        </div>
      )}

      <button onClick={() => { setModal({ type: 'item', data: { category: '景點', date: selectedDate } }); setTempPhotos([]); }} className="fixed bottom-[110px] right-6 w-16 h-16 bg-blue-500 text-white rounded-[2rem] shadow-lg flex items-center justify-center active:scale-90 z-[60] border-4 border-white hover:bg-blue-600 transition-colors"><Plus size={30} strokeWidth={3} /></button>

      <Modal isOpen={!!modal.type} onClose={() => setModal({ type: null, data: null })} title={modal.data?.id ? '編輯行程' : '新增行程'}>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="日期" type="select" options={tripDates} value={modal.data?.date} onChange={v => setModal({ ...modal, data: { ...modal.data, date: v } })} />
          <FormField label="時間（選填）" type="time" value={modal.data?.time} onChange={v => setModal({ ...modal, data: { ...modal.data, time: v } })} />
        </div>
        <FormField label="類別" type="select" options={['景點', '美食', '購物', '交通', '住宿', '換匯', '其他']} value={modal.data?.category} onChange={v => setModal({ ...modal, data: { ...modal.data, category: v } })} />
        <FormField label="項目名稱" placeholder="例如：看電影、逛街、飯店 Check-in" value={modal.data?.name} onChange={v => setModal({ ...modal, data: { ...modal.data, name: v } })} />
        {/* 地點欄位 */}
        <FormField label="📍 地點 / 位置（選填）" placeholder="例如：樂天世界、新宿 Toho 影城、海雲台海水浴場" value={modal.data?.location} onChange={v => setModal({ ...modal, data: { ...modal.data, location: v } })} />
        <FormField label="Map 連結（選填）" value={modal.data?.mapUrl} onChange={v => setModal({ ...modal, data: { ...modal.data, mapUrl: v } })} />
        <FormField label="備註（選填）" type="textarea" value={modal.data?.note} onChange={v => setModal({ ...modal, data: { ...modal.data, note: v } })} />
        <div className="mb-4">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">相片紀錄（最多 5 張）</label>
          <div className="flex flex-wrap gap-2">
            {tempPhotos.map((url, idx) => (
              <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-100 shadow-sm">
                <img src={url} className="w-full h-full object-cover" alt="tmp" />
                <button onClick={() => setTempPhotos(p => p.filter((_, i) => i !== idx))} className="absolute top-1 right-1 p-1 bg-red-500/90 text-white rounded-lg backdrop-blur-sm"><X size={12} /></button>
              </div>
            ))}
            {tempPhotos.length < 5 && <button onClick={() => document.getElementById('trip-photo-up').click()} className="w-16 h-16 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-50 transition-colors shadow-sm"><Camera size={24} /></button>}
          </div>
          <input type="file" id="trip-photo-up" className="hidden" multiple accept="image/*" onChange={e => {
            Array.from(e.target.files).forEach(file => { const r = new FileReader(); r.onloadend = async () => { const compressed = await compressImageBase64(r.result); setTempPhotos(p => p.length < 5 ? [...p, compressed] : p); }; r.readAsDataURL(file); });
          }} />
        </div>
        <button onClick={() => {
          if (!modal.data?.name) return;
          const finalData = { ...modal.data, date: modal.data.date || selectedDate, photos: tempPhotos, editedById: currentMember.id, createdAt: modal.data.createdAt || Date.now() };
          if (modal.data.id) setGlobalItinerary(p => p.map(it => it.id === modal.data.id ? finalData : it));
          else setGlobalItinerary(p => [...p, { ...finalData, id: Date.now() }]);
          setModal({ type: null });
        }} className="w-full bg-blue-500 text-white font-black py-4 rounded-2xl shadow-md active:scale-95 mt-1 text-base hover:bg-blue-600 transition-colors">確認儲存</button>
      </Modal>

      <DatePickerModal isOpen={datePickerOpen} onClose={() => setDatePickerOpen(false)} onSelect={handleAddDate} existingDates={tripDates} />
      <ConfirmDialog isOpen={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={() => confirmDel?.fn()} />
      <ConfirmDialog isOpen={!!dateConfirmDel} onClose={() => setDateConfirmDel(null)} onConfirm={() => dateConfirmDel?.fn()} title="確認刪除日期頁籤" message="此日期頁籤下的行程不會被刪除，確定要移除此頁籤嗎？" />
      <PhotoViewerModal isOpen={!!viewerPhotos} onClose={() => setViewerPhotos(null)} photos={viewerPhotos} initialIndex={viewerIndex} />
    </div>
  );
};

// ─── FoodPage ─────────────────────────────────────────────────────────────────
const FoodPage = ({ onDownload, highlightId, onClearHighlight }) => {
  const { globalItinerary, setGlobalItinerary, tripDates, currentMember, allMembers, foodOptions, setFoodOptions } = useMember();

  // ── foodOptions 安全取值（全部從 Firebase 讀，所有項目都能增刪改）──
  const citiesPool = foodOptions?.cities || [];
  const districtsMap = foodOptions?.districts || {};
  const foodTypesPool = foodOptions?.foodTypes || [];
  const getDistrictsForCity = useCallback((city) => districtsMap[city] || [], [districtsMap]);

  // ── 頂部篩選狀態 ──
  const [selectedCity, setSelectedCity] = useState('全部城市');
  const [selectedDistricts, setSelectedDistricts] = useState([]);
  const [selectedFoodType, setSelectedFoodType] = useState('全部食物');
  const [viewMode, setViewMode] = useState('list');
  const [activeMapItem, setActiveMapItem] = useState(null);

  // ── 彈出視窗狀態 ──
  const [modal, setModal] = useState({ type: null, data: null });
  const [tempPhotos, setTempPhotos] = useState([]);
  const [confirmDel, setConfirmDel] = useState(null);
  const [viewerPhotos, setViewerPhotos] = useState(null);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [expandedId, setExpandedId] = useState(null);

  // highlight 跳轉：自動展開對應卡片
  useEffect(() => {
    if (highlightId) {
      setExpandedId(highlightId);
      onClearHighlight && onClearHighlight();
      setTimeout(() => {
        const el = document.getElementById(`food-item-${highlightId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [highlightId]);

  // ── 自訂欄位狀態 ──
  const [customCity, setCustomCity] = useState('');
  const [customDistrict, setCustomDistrict] = useState('');
  const [customFoodType, setCustomFoodType] = useState('');
  const [showCustomCity, setShowCustomCity] = useState(false);
  const [showCustomDistrict, setShowCustomDistrict] = useState(false);
  const [showCustomFoodType, setShowCustomFoodType] = useState(false);
  const [showManageOptions, setShowManageOptions] = useState(false);
  const [editingOption, setEditingOption] = useState(null);

  // ── 所有美食資料 ──
  const allFoodItems = useMemo(() => globalItinerary.filter(i => i.category === '美食'), [globalItinerary]);

  // ── 頂部篩選：地區選項（依城市動態切換）──
  const topDistricts = useMemo(() => {
    if (selectedCity === '全部城市') return [];
    return getDistrictsForCity(selectedCity);
  }, [selectedCity, getDistrictsForCity]);

  // ── 篩選後的美食清單 ──
  const filteredFoodList = useMemo(() => {
    return allFoodItems.filter(i => {
      if (selectedCity !== '全部城市' && i.city !== selectedCity) return false;
      if (selectedDistricts.length > 0) {
        const itemDistricts = i.districts || (i.district ? [i.district] : []);
        if (!selectedDistricts.some(d => itemDistricts.includes(d))) return false;
      }
      if (selectedFoodType !== '全部食物' && i.foodType !== selectedFoodType) return false;
      return true;
    }).sort((a, b) => {
      if (a.date === '待安排' && b.date !== '待安排') return 1;
      if (a.date !== '待安排' && b.date === '待安排') return -1;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
  }, [allFoodItems, selectedCity, selectedDistricts, selectedFoodType]);

  // ── 地圖模式：activeMapItem 跟著篩選走 ──
  useEffect(() => {
    if (viewMode === 'map') {
      if (filteredFoodList.length > 0 && (!activeMapItem || !filteredFoodList.find(i => i.id === activeMapItem.id))) {
        setActiveMapItem(filteredFoodList[0]);
      }
    }
  }, [viewMode, filteredFoodList]);

  // ── 下載 ──
  useEffect(() => {
    if (typeof onDownload === 'function') {
      onDownload(() => () => {
        let text = `🍽️ 美食清單 (${selectedCity}${selectedDistricts.length ? ' / ' + selectedDistricts.join('、') : ''} / ${selectedFoodType})\n${'='.repeat(50)}\n\n`;
        filteredFoodList.forEach((i, idx) => {
          const districts = (i.districts || []).join('、') || i.district || '未填';
          text += `${idx + 1}. 【${i.name}】\n   城市: ${i.city || '未填'} | 地區: ${districts}\n   類別: ${i.foodType || '未填'} | 日期: ${i.date || '待安排'} ${i.time || ''}\n`;
          if (i.mapUrl) text += `   地圖: ${i.mapUrl}\n`;
          if (i.note) text += `   備註: ${i.note}\n`;
          text += '-'.repeat(40) + '\n';
        });
        downloadTextFile(text, `美食清單_${Date.now()}`);
      });
    }
  }, [filteredFoodList, selectedCity, selectedDistricts, selectedFoodType, onDownload]);

  // ── foodOptions 操作 helpers（城市、地區、食物類型全都能增刪改）──
  const addCity = (city) => {
    if (!city.trim() || citiesPool.includes(city)) return;
    setFoodOptions(prev => ({ ...prev, cities: [...(prev?.cities || []), city.trim()] }));
  };
  const renameCity = (oldVal, newVal) => {
    if (!newVal.trim() || newVal === oldVal) return;
    setFoodOptions(prev => ({
      ...prev,
      cities: (prev?.cities || []).map(c => c === oldVal ? newVal.trim() : c),
      districts: Object.fromEntries(Object.entries(prev?.districts || {}).map(([k, v]) => [k === oldVal ? newVal.trim() : k, v])),
    }));
    setGlobalItinerary(p => p.map(i => i.category === '美食' && i.city === oldVal ? { ...i, city: newVal.trim() } : i));
    setEditingOption(null);
  };
  const deleteCity = (city) => {
    setFoodOptions(prev => {
      const { [city]: _, ...rest } = (prev?.districts || {});
      return { ...prev, cities: (prev?.cities || []).filter(c => c !== city), districts: rest };
    });
    setGlobalItinerary(p => p.map(i => i.category === '美食' && i.city === city ? { ...i, city: '' } : i));
  };
  const addDistrict = (city, district) => {
    if (!district.trim()) return;
    setFoodOptions(prev => {
      const cur = prev?.districts?.[city] || [];
      if (cur.includes(district)) return prev;
      return { ...prev, districts: { ...(prev?.districts || {}), [city]: [...cur, district.trim()] } };
    });
  };
  const renameDistrict = (city, oldVal, newVal) => {
    if (!newVal.trim() || newVal === oldVal) return;
    setFoodOptions(prev => ({
      ...prev,
      districts: { ...(prev?.districts || {}), [city]: (prev?.districts?.[city] || []).map(d => d === oldVal ? newVal.trim() : d) },
    }));
    setGlobalItinerary(p => p.map(i => {
      if (i.category !== '美食') return i;
      return { ...i, districts: (i.districts || []).map(d => d === oldVal ? newVal.trim() : d), district: i.district === oldVal ? newVal.trim() : i.district };
    }));
    setEditingOption(null);
  };
  const deleteDistrict = (city, district) => {
    setFoodOptions(prev => ({
      ...prev,
      districts: { ...(prev?.districts || {}), [city]: (prev?.districts?.[city] || []).filter(d => d !== district) },
    }));
    setGlobalItinerary(p => p.map(i => {
      if (i.category !== '美食') return i;
      return { ...i, districts: (i.districts || []).filter(d => d !== district), district: i.district === district ? '' : i.district };
    }));
  };
  const addFoodType = (ft) => {
    if (!ft.trim() || foodTypesPool.includes(ft)) return;
    setFoodOptions(prev => ({ ...prev, foodTypes: [...(prev?.foodTypes || []), ft.trim()] }));
  };
  const renameFoodType = (oldVal, newVal) => {
    if (!newVal.trim() || newVal === oldVal) return;
    setFoodOptions(prev => ({ ...prev, foodTypes: (prev?.foodTypes || []).map(f => f === oldVal ? newVal.trim() : f) }));
    setGlobalItinerary(p => p.map(i => i.category === '美食' && i.foodType === oldVal ? { ...i, foodType: newVal.trim() } : i));
    setEditingOption(null);
  };
  const deleteFoodType = (ft) => {
    setFoodOptions(prev => ({ ...prev, foodTypes: (prev?.foodTypes || []).filter(f => f !== ft) }));
    setGlobalItinerary(p => p.map(i => i.category === '美食' && i.foodType === ft ? { ...i, foodType: '' } : i));
  };

  // ── Google Maps 多點 ──
  const openAllOnGoogleMaps = () => {
    const withMap = filteredFoodList.filter(i => i.mapUrl);
    if (withMap.length === 1) { window.open(withMap[0].mapUrl, '_blank'); return; }
    const query = filteredFoodList.map(i => i.name + (i.city ? ` ${i.city}` : '')).join(' | ');
    window.open(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, '_blank');
  };

  const modalDistricts = modal.data?.districts || [];
  const modalCity = modal.data?.city || citiesPool[0] || '';

  const toggleModalDistrict = (d) => {
    setModal(prev => {
      const cur = prev.data?.districts || [];
      const isRemoving = cur.includes(d);
      const nextDistricts = isRemoving ? cur.filter(x => x !== d) : [...cur, d];
      let nextBranches = prev.data?.branches || [];
      if (!isRemoving) {
        const alreadyHas = nextBranches.some(b => b.name === d);
        if (!alreadyHas) nextBranches = [...nextBranches, { name: d, mapUrl: '' }];
      } else {
        // 取消地區時，移除對應分店（只移除名稱一樣且連結是空的，保留已填連結的）
        nextBranches = nextBranches.filter(b => !(b.name === d && !b.mapUrl));
      }
      return { ...prev, data: { ...prev.data, districts: nextDistricts, branches: nextBranches } };
    });
  };

  const openAddModal = () => {
    const initDistricts = selectedDistricts.length > 0 ? [...selectedDistricts] : [];
    const initBranches = initDistricts.map(d => ({ name: d, mapUrl: '' }));
    setModal({
      type: 'food',
      data: {
        category: '美食',
        city: selectedCity !== '全部城市' ? selectedCity : '釜山',
        districts: initDistricts,
        branches: initBranches,
        foodType: selectedFoodType !== '全部食物' ? selectedFoodType : '',
        date: '待安排', time: '', name: '', mapUrl: '', note: ''
      }
    });
    setTempPhotos([]);
    setShowCustomCity(false); setShowCustomDistrict(false); setShowCustomFoodType(false);
    setCustomCity(''); setCustomDistrict(''); setCustomFoodType('');
  };

  const openEditModal = (item) => {
    setModal({
      type: 'food',
      data: {
        ...item,
        districts: item.districts || (item.district ? [item.district] : []),
      }
    });
    setTempPhotos(item.photos || []);
    setShowCustomCity(false); setShowCustomDistrict(false); setShowCustomFoodType(false);
    setCustomCity(''); setCustomDistrict(''); setCustomFoodType('');
  };

  const handleSave = () => {
    if (!modal.data?.name?.trim()) return;
    const finalData = {
      ...modal.data,
      photos: tempPhotos,
      editedById: currentMember.id,
      category: '美食',
      createdAt: modal.data.createdAt || Date.now(),
      districts: modal.data.districts || [],
      district: (modal.data.districts || [])[0] || '', // 相容舊欄位
    };
    if (modal.data.id) {
      setGlobalItinerary(p => p.map(it => it.id === modal.data.id ? finalData : it));
    } else {
      setGlobalItinerary(p => [...p, { ...finalData, id: Date.now() }]);
    }
    setModal({ type: null, data: null });
  };

  return (
    <div className="relative animate-in fade-in pb-28">

      {/* ── 頂部篩選 Bar ── */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm">
        {/* 城市 + 食物類型 + 地圖切換 */}
        <div className="px-4 pt-3 pb-2 flex items-center gap-2">
          {/* 城市 */}
          <select
            value={selectedCity}
            onChange={e => { setSelectedCity(e.target.value); setSelectedDistricts([]); setSelectedFoodType('全部食物'); }}
            className={`flex-1 text-xs font-black rounded-xl px-3 py-2.5 appearance-none border outline-none text-center transition-all ${selectedCity !== '全部城市' ? 'bg-orange-500 text-white border-orange-500' : 'bg-slate-50 text-slate-600 border-slate-100'}`}
          >
            <option value="全部城市">全部城市</option>
            {citiesPool.map(c => <option key={c} value={c} className="bg-white text-slate-800">{c}</option>)}
          </select>
          {/* 食物類型 */}
          <select
            value={selectedFoodType}
            onChange={e => setSelectedFoodType(e.target.value)}
            className={`flex-1 text-xs font-black rounded-xl px-3 py-2.5 appearance-none border outline-none text-center transition-all ${selectedFoodType !== '全部食物' ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-slate-50 text-slate-600 border-slate-100'}`}
          >
            <option value="全部食物">全部食物</option>
            {foodTypesPool.map(f => <option key={f} value={f} className="bg-white text-slate-800">{f}</option>)}
          </select>
          {/* 地圖/清單切換 */}
          <div className="flex bg-white rounded-xl p-1 border border-slate-100 shadow-sm shrink-0">
            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-orange-100 text-orange-500' : 'text-slate-400'}`}><List size={14} /></button>
            <button onClick={() => setViewMode('map')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'map' ? 'bg-orange-100 text-orange-500' : 'text-slate-400'}`}><Map size={14} /></button>
          </div>
        </div>

        {/* 地區多選（選了城市才顯示對應地區，全部城市時不顯示）*/}
        {selectedCity !== '全部城市' && topDistricts.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-4 pb-2.5">
            {topDistricts.map(d => {
              const active = selectedDistricts.includes(d);
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDistricts(prev => active ? prev.filter(x => x !== d) : [...prev, d])}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${active ? 'bg-orange-500 text-white border-orange-500 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:bg-orange-50'}`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        )}

        {/* 已選地區顯示（無城市篩選時不顯示地區列）*/}
        {selectedDistricts.length > 0 && selectedCity === '全部城市' && (
          <div className="px-4 pb-2 flex items-center gap-1 flex-wrap">
            {selectedDistricts.map(d => (
              <span key={d} className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs font-bold">
                {d}
                <button onClick={() => setSelectedDistricts(p => p.filter(x => x !== d))}><X size={10} /></button>
              </span>
            ))}
          </div>
        )}

        {/* 結果計數 + 管理自訂選項 */}
        <div className="px-4 pb-2 flex items-center justify-between">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            共 {filteredFoodList.length} 間餐廳
          </span>
          <div className="flex items-center gap-3">
            {(selectedCity !== '全部城市' || selectedDistricts.length > 0 || selectedFoodType !== '全部食物') && (
              <button onClick={() => { setSelectedCity('全部城市'); setSelectedDistricts([]); setSelectedFoodType('全部食物'); }} className="text-[10px] font-black text-orange-400 hover:text-orange-600 transition-colors">
                清除篩選
              </button>
            )}
            <button onClick={() => setShowManageOptions(true)} className="flex items-center gap-1 text-[10px] font-black text-slate-400 hover:text-slate-600 transition-colors">
              <Settings size={11} />管理自訂
            </button>
          </div>
        </div>
      </div>

      {/* ── 地圖模式 ── */}
      {viewMode === 'map' ? (
        <div className="mt-4 px-4 h-[calc(100vh-300px)] flex flex-col animate-in fade-in">
          {/* 一鍵開啟所有店 */}
          {filteredFoodList.length > 0 && (
            <button onClick={openAllOnGoogleMaps} className="mb-3 w-full py-2.5 bg-orange-500 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 hover:bg-orange-600 active:scale-95 transition-all shadow-sm">
              <MapPin size={14} strokeWidth={2.5} />
              一鍵開啟全部 {filteredFoodList.length} 間店的地圖
            </button>
          )}
          <div className="flex-1 rounded-[2rem] overflow-hidden border border-slate-200 shadow-sm bg-slate-100">
            {activeMapItem ? (
              <MapEmbed query={activeMapItem.name + (activeMapItem.city ? ` ${activeMapItem.city}` : '')} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm font-bold">無美食可顯示</div>
            )}
          </div>
          {filteredFoodList.length > 0 && (
            <div className="h-32 mt-3 overflow-x-auto no-scrollbar flex items-center gap-3 shrink-0 pb-2">
              {filteredFoodList.map(item => {
                const isActive = activeMapItem?.id === item.id;
                const districts = (item.districts || []).join('·') || item.district || '';
                const branches = item.branches || [];
                const activeBranch = item.activeBranch || 0;
                return (
                  <div key={item.id} onClick={() => setActiveMapItem(item)}
                    className={`w-56 p-3.5 rounded-3xl shrink-0 border shadow-sm transition-all cursor-pointer ${isActive ? 'bg-orange-500 text-white border-orange-500 scale-105' : 'bg-white text-slate-700 border-slate-200 hover:bg-orange-50'}`}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md flex-1 truncate ${isActive ? 'bg-white/20 text-white' : 'bg-orange-50 text-orange-600'}`}>{item.city}{districts ? ` · ${districts}` : ''}</span>
                      <button onClick={e => { e.stopPropagation(); openEditModal(item); }}
                        className={`p-1 rounded-lg shrink-0 transition-colors ${isActive ? 'bg-white/20 text-white' : 'bg-slate-50 text-slate-400 hover:text-orange-500'}`}>
                        <Edit2 size={11} />
                      </button>
                    </div>
                    <h4 className="font-bold text-sm truncate">{item.name}</h4>
                    {item.foodType && <p className={`text-[10px] mt-0.5 ${isActive ? 'text-orange-100' : 'text-slate-400'}`}>#{item.foodType}</p>}
                    {/* 分店列表 */}
                    {branches.length > 0 ? (
                      <div className="mt-1.5 space-y-1">
                        {branches.map((b, bi) => b.mapUrl ? (
                          <a key={bi} href={b.mapUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                            className={`text-[10px] font-black flex items-center gap-1 ${isActive ? 'text-orange-100' : 'text-orange-400'}`}>
                            <Navigation size={9} />{b.name || `分店${bi + 1}`}
                          </a>
                        ) : null)}
                      </div>
                    ) : item.mapUrl && (
                      <a href={item.mapUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                        className={`mt-1.5 text-[10px] font-black flex items-center gap-1 ${isActive ? 'text-orange-100' : 'text-orange-400'}`}>
                        <Navigation size={10} />直接導航
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ── 清單模式 ── */
        <div className="mt-4 px-4 space-y-4 animate-in fade-in">
          {filteredFoodList.map((item) => {
            const editor = allMembers.find(m => m.id === item.editedById) || { name: item.lastEdited || '同行隊友', avatarColor: '#94a3b8' };
            const districts = (item.districts || (item.district ? [item.district] : []));
            return (
              <div key={item.id} id={`food-item-${item.id}`}
                className={`bg-white border rounded-[2rem] p-5 shadow-sm hover:shadow-md transition-all ${expandedId === item.id ? 'border-orange-300 shadow-orange-100' : 'border-slate-100'}`}>
                {/* 右上按鈕 */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex flex-wrap gap-1.5 flex-1">
                    <span className="px-2 py-0.5 rounded-lg bg-orange-50 border border-orange-100 text-orange-600 text-[10px] font-black">📍 {item.city}</span>
                    {districts.map(d => (
                      <span key={d} className="px-2 py-0.5 rounded-lg bg-orange-50 text-orange-500 text-[10px] font-bold">{d}</span>
                    ))}
                    {item.foodType && <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 text-[10px] font-bold">#{item.foodType}</span>}
                    <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-600 text-[10px] font-bold">📅 {item.date === '待安排' ? '時間待定' : `${item.date} ${item.time || ''}`}</span>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => openEditModal(item)} className="p-2 bg-slate-50 hover:bg-orange-50 text-slate-400 hover:text-orange-500 rounded-xl transition-colors shadow-sm"><Edit2 size={13} /></button>
                    <button onClick={() => setConfirmDel({ title: '刪除美食', message: `確定刪除「${item.name}」？`, fn: () => setGlobalItinerary(p => p.filter(x => x.id !== item.id)) })} className="p-2 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-colors shadow-sm"><Trash2 size={13} /></button>
                  </div>
                </div>

                <h3 className="text-base font-black text-slate-800 leading-snug mb-2">{item.name}</h3>
                {item.note && <p className="text-xs text-slate-500 whitespace-pre-wrap leading-relaxed bg-slate-50 p-3 rounded-2xl mb-3">{item.note}</p>}

                {item.photos?.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3">
                    {item.photos.map((p, i) => (
                      <img key={i} src={p} onClick={() => { setViewerPhotos(item.photos); setViewerIndex(i); }} className="w-20 h-20 object-cover rounded-2xl border border-slate-100 shadow-sm shrink-0 cursor-pointer hover:opacity-90 transition-opacity" alt="food" />
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <Avatar member={editor} className="w-4 h-4 rounded-md" />
                    <span>{editor.name} 編輯</span>
                  </div>
                  <div className="flex gap-1.5 flex-wrap justify-end">
                    {(item.branches || []).filter(b => b.mapUrl).map((b, bi) => (
                      <a key={bi} href={b.mapUrl} target="_blank" rel="noreferrer" className="px-2.5 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-500 border border-orange-100 rounded-xl flex items-center gap-1 text-xs font-black transition-colors">
                        <Navigation size={11} strokeWidth={2.5} />{b.name || `分店${bi + 1}`}
                      </a>
                    ))}
                    {!(item.branches || []).length && item.mapUrl && (
                      <a href={item.mapUrl} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-500 border border-orange-100 rounded-xl flex items-center gap-1.5 text-xs font-black transition-colors">
                        <Navigation size={13} strokeWidth={2.5} />開啟導航
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {filteredFoodList.length === 0 && (
            <div className="py-24 text-center text-slate-400 text-xs font-bold uppercase tracking-widest italic opacity-80">這個篩選條件下沒有美食收藏</div>
          )}
        </div>
      )}

      {/* ── 新增按鈕 ── */}
      <button onClick={openAddModal} className="fixed bottom-[110px] right-6 w-16 h-16 bg-orange-500 text-white rounded-[2rem] shadow-lg flex items-center justify-center active:scale-90 z-[60] border-4 border-white hover:bg-orange-600 transition-colors">
        <Plus size={30} strokeWidth={3} />
      </button>

      {/* ── 新增/編輯彈出視窗 ── */}
      <Modal isOpen={modal.type === 'food'} onClose={() => setModal({ type: null, data: null })} title={modal.data?.id ? '編輯美食' : '新增美食'}>

        {/* 城市 */}
        <div className="mb-3">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 block">🏙️ 城市</label>
          {!showCustomCity ? (
            <select value={modalCity} onChange={e => {
              if (e.target.value === '__NEW__') { setShowCustomCity(true); return; }
              setModal(prev => ({ ...prev, data: { ...prev.data, city: e.target.value, districts: [] } }));
            }} className="w-full bg-white border border-slate-200 rounded-2xl p-4 font-bold text-slate-700 outline-none text-sm shadow-sm">
              {citiesPool.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="__NEW__">➕ 新增自訂城市...</option>
            </select>
          ) : (
            <div className="flex gap-2">
              <input type="text" placeholder="輸入城市名稱" value={customCity} onChange={e => setCustomCity(e.target.value)}
                className="flex-1 bg-white border border-slate-200 rounded-2xl p-4 font-semibold text-sm text-slate-700 outline-none" />
              <button type="button" onClick={() => {
                if (!customCity.trim()) return;
                const newCity = customCity.trim();
                // 寫入 foodOptions
                if (!citiesPool.includes(newCity)) {
                  setFoodOptions(prev => ({ ...prev, cities: [...(prev?.cities || []), newCity], districts: { ...(prev?.districts || {}), [newCity]: [] } }));
                }
                setModal(prev => ({ ...prev, data: { ...prev.data, city: newCity, districts: [] } }));
                setShowCustomCity(false); setCustomCity('');
              }} className="px-4 bg-orange-500 text-white font-bold rounded-2xl text-xs">套用</button>
              <button type="button" onClick={() => setShowCustomCity(false)} className="px-3 bg-slate-100 text-slate-500 font-bold rounded-2xl text-xs">取消</button>
            </div>
          )}
        </div>

        {/* 地區（多選）*/}
        <div className="mb-3">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 block">🗺️ 地區（可多選）</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {getDistrictsForCity(modalCity).map(d => {
              const active = modalDistricts.includes(d);
              return (
                <button key={d} type="button" onClick={() => toggleModalDistrict(d)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${active ? 'bg-orange-500 text-white border-orange-500 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:bg-orange-50'}`}>
                  {d}
                </button>
              );
            })}
          </div>
          {/* 自訂地區 */}
          {!showCustomDistrict ? (
            <button type="button" onClick={() => setShowCustomDistrict(true)} className="text-xs font-bold text-orange-400 hover:text-orange-600 transition-colors">
              ➕ 新增自訂地區
            </button>
          ) : (
            <div className="flex gap-2 mt-1">
              <input type="text" placeholder="例如：梨泰院" value={customDistrict} onChange={e => setCustomDistrict(e.target.value)}
                className="flex-1 bg-white border border-slate-200 rounded-2xl p-3 font-semibold text-sm text-slate-700 outline-none" />
              <button type="button" onClick={() => {
                if (!customDistrict.trim()) return;
                const d = customDistrict.trim();
                const city = modal.data?.city || citiesPool[0];
                // 寫入 foodOptions
                setFoodOptions(prev => {
                  const curDistricts = prev?.districts?.[city] || [];
                  if (curDistricts.includes(d)) return prev;
                  return { ...prev, districts: { ...(prev?.districts || {}), [city]: [...curDistricts, d] } };
                });
                setModal(prev => {
                  const cur = prev.data?.districts || [];
                  const nextDistricts = cur.includes(d) ? cur : [...cur, d];
                  const nextBranches = [...(prev.data?.branches || [])];
                  if (!nextBranches.some(b => b.name === d)) nextBranches.push({ name: d, mapUrl: '' });
                  return { ...prev, data: { ...prev.data, districts: nextDistricts, branches: nextBranches } };
                });
                setShowCustomDistrict(false); setCustomDistrict('');
              }} className="px-4 bg-orange-500 text-white font-bold rounded-2xl text-xs">套用</button>
              <button type="button" onClick={() => setShowCustomDistrict(false)} className="px-3 bg-slate-100 text-slate-500 font-bold rounded-2xl text-xs">取消</button>
            </div>
          )}
        </div>

        {/* 食物類型 */}
        <div className="mb-3">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 block">🍖 食物類型</label>
          {!showCustomFoodType ? (
            <select value={modal.data?.foodType || ''} onChange={e => {
              if (e.target.value === '__NEW__') { setShowCustomFoodType(true); return; }
              setModal(prev => ({ ...prev, data: { ...prev.data, foodType: e.target.value } }));
            }} className="w-full bg-white border border-slate-200 rounded-2xl p-4 font-bold text-slate-700 outline-none text-sm shadow-sm">
              <option value="">無特定分類</option>
              {foodTypesPool.map(f => <option key={f} value={f}>{f}</option>)}
              <option value="__NEW__">➕ 新增自訂類別...</option>
            </select>
          ) : (
            <div className="flex gap-2">
              <input type="text" placeholder="例如：台式料理" value={customFoodType} onChange={e => setCustomFoodType(e.target.value)}
                className="flex-1 bg-white border border-slate-200 rounded-2xl p-4 font-semibold text-sm text-slate-700 outline-none" />
              <button type="button" onClick={() => {
                if (!customFoodType.trim()) return;
                const newType = customFoodType.trim();
                if (!foodTypesPool.includes(newType)) {
                  setFoodOptions(prev => ({ ...prev, foodTypes: [...(prev?.foodTypes || []), newType] }));
                }
                setModal(prev => ({ ...prev, data: { ...prev.data, foodType: newType } }));
                setShowCustomFoodType(false); setCustomFoodType('');
              }} className="px-4 bg-orange-500 text-white font-bold rounded-2xl text-xs">套用</button>
              <button type="button" onClick={() => setShowCustomFoodType(false)} className="px-3 bg-slate-100 text-slate-500 font-bold rounded-2xl text-xs">取消</button>
            </div>
          )}
        </div>

        <FormField label="🏪 店家名稱" value={modal.data?.name} placeholder="例如：一蘭拉麵 涉谷店" onChange={v => setModal(prev => ({ ...prev, data: { ...prev.data, name: v } }))} />
        <div className="grid grid-cols-2 gap-2">
          <FormField label="📅 日期" type="select" options={tripDates} value={modal.data?.date} onChange={v => setModal(prev => ({ ...prev, data: { ...prev.data, date: v } }))} />
          <FormField label="⏰ 時間（選填）" type="time" value={modal.data?.time} onChange={v => setModal(prev => ({ ...prev, data: { ...prev.data, time: v } }))} />
        </div>
        {/* 有選地區就顯示分店列表，沒選就顯示單一 Map 連結 */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">🗺 分店 / 地圖連結</label>
          </div>
          {(modal.data?.districts || []).length > 0 ? (
            <>
              {(modal.data?.branches || []).map((b, bi) => (
                <div key={bi} className="flex gap-2 mb-2">
                  <input type="text" placeholder="分店名稱（如：西面店）" value={b.name || ''}
                    onChange={e => setModal(prev => ({ ...prev, data: { ...prev.data, branches: prev.data.branches.map((x, i) => i === bi ? { ...x, name: e.target.value } : x) } }))}
                    className="w-28 bg-white border border-slate-200 rounded-xl p-3 font-semibold text-sm text-slate-700 outline-none shadow-sm shrink-0" />
                  <input type="text" placeholder="Map 連結（選填）" value={b.mapUrl || ''}
                    onChange={e => setModal(prev => ({ ...prev, data: { ...prev.data, branches: prev.data.branches.map((x, i) => i === bi ? { ...x, mapUrl: e.target.value } : x) } }))}
                    className="flex-1 bg-white border border-slate-200 rounded-xl p-3 font-semibold text-sm text-slate-700 outline-none shadow-sm" />
                  <button type="button" onClick={() => setModal(prev => ({ ...prev, data: { ...prev.data, branches: prev.data.branches.filter((_, i) => i !== bi) } }))}
                    className="p-2 bg-red-50 text-red-400 rounded-xl hover:bg-red-100 transition-colors shrink-0"><X size={14} /></button>
                </div>
              ))}
              <button type="button" onClick={() => setModal(prev => ({ ...prev, data: { ...prev.data, branches: [...(prev.data.branches || []), { name: '', mapUrl: '' }] } }))}
                className="text-xs font-black text-orange-400 hover:text-orange-600 flex items-center gap-1 mt-1">
                <Plus size={12} />新增分店
              </button>
            </>
          ) : (
            <FormField label="" value={modal.data?.mapUrl} placeholder="貼上地圖分享連結（選填）" onChange={v => setModal(prev => ({ ...prev, data: { ...prev.data, mapUrl: v } }))} />
          )}
        </div>
        <FormField label="💡 必點推薦與備註" type="textarea" value={modal.data?.note} placeholder="例如：必吃厚切五花肉、需提早排隊..." onChange={v => setModal(prev => ({ ...prev, data: { ...prev.data, note: v } }))} />

        {/* 相片 */}
        <div className="mb-4">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">📷 相片（最多 5 張）</label>
          <div className="flex flex-wrap gap-2">
            {tempPhotos.map((url, idx) => (
              <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-100 shadow-sm">
                <img src={url} className="w-full h-full object-cover" alt="tmp" />
                <button type="button" onClick={() => setTempPhotos(p => p.filter((_, i) => i !== idx))} className="absolute top-1 right-1 p-1 bg-red-500/90 text-white rounded-lg"><X size={12} /></button>
              </div>
            ))}
            {tempPhotos.length < 5 && (
              <button type="button" onClick={() => document.getElementById('food-photo-up').click()} className="w-16 h-16 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-50 shadow-sm"><Camera size={24} /></button>
            )}
          </div>
          <input type="file" id="food-photo-up" className="hidden" multiple accept="image/*" onChange={e => {
            Array.from(e.target.files).forEach(file => {
              const r = new FileReader();
              r.onloadend = async () => {
                const compressed = await compressImageBase64(r.result);
                setTempPhotos(p => p.length < 5 ? [...p, compressed] : p);
              };
              r.readAsDataURL(file);
            });
          }} />
        </div>

        <button onClick={handleSave} className="w-full bg-orange-500 text-white font-black py-4 rounded-2xl shadow-md mt-1 active:scale-95 text-base hover:bg-orange-600 transition-colors">
          確認儲存美食
        </button>
      </Modal>

      {/* ── 管理選項 Modal（全部選項都能增刪改）── */}
      <Modal isOpen={showManageOptions} onClose={() => { setShowManageOptions(false); setEditingOption(null); }} title="管理選項">
        {/* 城市 */}
        <div className="mb-5">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">🏙️ 城市</p>
          {citiesPool.map(val => (
            <div key={val} className="flex items-center gap-2 mb-2">
              {editingOption?.type === 'city' && editingOption?.oldVal === val ? (
                <>
                  <input autoFocus type="text" value={editingOption.newVal} onChange={e => setEditingOption(p => ({ ...p, newVal: e.target.value }))} className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-orange-300" />
                  <button onClick={() => renameCity(val, editingOption.newVal)} className="px-3 py-2 bg-orange-500 text-white rounded-xl text-xs font-bold">儲存</button>
                  <button onClick={() => setEditingOption(null)} className="px-3 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold">取消</button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-bold text-slate-700 px-1">{val}</span>
                  <button onClick={() => setEditingOption({ type: 'city', oldVal: val, newVal: val })} className="p-2 bg-slate-50 hover:bg-orange-50 text-slate-400 hover:text-orange-500 rounded-xl transition-colors"><Edit2 size={13} /></button>
                  <button onClick={() => setConfirmDel({ title: `刪除城市「${val}」`, message: `刪除後「${val}」下的店家城市欄位會被清空，店家本身不刪除。`, fn: () => deleteCity(val) })} className="p-2 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-colors"><Trash2 size={13} /></button>
                </>
              )}
            </div>
          ))}
          {showCustomCity ? (
            <div className="flex gap-2 mt-1">
              <input autoFocus type="text" placeholder="新城市名稱" value={customCity} onChange={e => setCustomCity(e.target.value)} onKeyDown={e => e.key === 'Enter' && (addCity(customCity), setCustomCity(''), setShowCustomCity(false))} className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-orange-300" />
              <button onClick={() => { addCity(customCity); setCustomCity(''); setShowCustomCity(false); }} className="px-3 py-2 bg-orange-500 text-white rounded-xl text-xs font-bold">新增</button>
              <button onClick={() => setShowCustomCity(false)} className="px-3 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold">取消</button>
            </div>
          ) : (
            <button onClick={() => setShowCustomCity(true)} className="text-xs font-black text-orange-400 hover:text-orange-600 flex items-center gap-1 mt-1"><Plus size={12} />新增城市</button>
          )}
        </div>

        {/* 各城市地區 */}
        {citiesPool.map(city => (
          <div key={city} className="mb-5">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">🗺️ {city} 地區</p>
            {(districtsMap[city] || []).map(val => (
              <div key={val} className="flex items-center gap-2 mb-2">
                {editingOption?.type === 'district' && editingOption?.city === city && editingOption?.oldVal === val ? (
                  <>
                    <input autoFocus type="text" value={editingOption.newVal} onChange={e => setEditingOption(p => ({ ...p, newVal: e.target.value }))} className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-orange-300" />
                    <button onClick={() => renameDistrict(city, val, editingOption.newVal)} className="px-3 py-2 bg-orange-500 text-white rounded-xl text-xs font-bold">儲存</button>
                    <button onClick={() => setEditingOption(null)} className="px-3 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold">取消</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-bold text-slate-700 px-1">{val}</span>
                    <button onClick={() => setEditingOption({ type: 'district', city, oldVal: val, newVal: val })} className="p-2 bg-slate-50 hover:bg-orange-50 text-slate-400 hover:text-orange-500 rounded-xl transition-colors"><Edit2 size={13} /></button>
                    <button onClick={() => setConfirmDel({ title: `刪除地區「${val}」`, message: '該地區標籤會從所有店家中移除，店家本身不刪除。', fn: () => deleteDistrict(city, val) })} className="p-2 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-colors"><Trash2 size={13} /></button>
                  </>
                )}
              </div>
            ))}
            {editingOption?.type === 'newDistrict' && editingOption?.city === city ? (
              <div className="flex gap-2 mt-1">
                <input autoFocus type="text" placeholder="新地區名稱" value={editingOption.newVal} onChange={e => setEditingOption(p => ({ ...p, newVal: e.target.value }))} onKeyDown={e => e.key === 'Enter' && (addDistrict(city, editingOption.newVal), setEditingOption(null))} className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-orange-300" />
                <button onClick={() => { addDistrict(city, editingOption.newVal); setEditingOption(null); }} className="px-3 py-2 bg-orange-500 text-white rounded-xl text-xs font-bold">新增</button>
                <button onClick={() => setEditingOption(null)} className="px-3 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold">取消</button>
              </div>
            ) : (
              <button onClick={() => setEditingOption({ type: 'newDistrict', city, newVal: '' })} className="text-xs font-black text-orange-400 hover:text-orange-600 flex items-center gap-1 mt-1"><Plus size={12} />新增地區</button>
            )}
          </div>
        ))}

        {/* 食物類型 */}
        <div className="mb-5">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">🍖 食物類型</p>
          {foodTypesPool.map(val => (
            <div key={val} className="flex items-center gap-2 mb-2">
              {editingOption?.type === 'foodType' && editingOption?.oldVal === val ? (
                <>
                  <input autoFocus type="text" value={editingOption.newVal} onChange={e => setEditingOption(p => ({ ...p, newVal: e.target.value }))} className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-orange-300" />
                  <button onClick={() => renameFoodType(val, editingOption.newVal)} className="px-3 py-2 bg-orange-500 text-white rounded-xl text-xs font-bold">儲存</button>
                  <button onClick={() => setEditingOption(null)} className="px-3 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold">取消</button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-bold text-slate-700 px-1">{val}</span>
                  <button onClick={() => setEditingOption({ type: 'foodType', oldVal: val, newVal: val })} className="p-2 bg-slate-50 hover:bg-orange-50 text-slate-400 hover:text-orange-500 rounded-xl transition-colors"><Edit2 size={13} /></button>
                  <button onClick={() => setConfirmDel({ title: `刪除「${val}」`, message: '該標籤會從所有店家中移除，店家本身不刪除。', fn: () => deleteFoodType(val) })} className="p-2 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-colors"><Trash2 size={13} /></button>
                </>
              )}
            </div>
          ))}
          {showCustomFoodType ? (
            <div className="flex gap-2 mt-1">
              <input autoFocus type="text" placeholder="新食物類型" value={customFoodType} onChange={e => setCustomFoodType(e.target.value)} onKeyDown={e => e.key === 'Enter' && (addFoodType(customFoodType), setCustomFoodType(''), setShowCustomFoodType(false))} className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-orange-300" />
              <button onClick={() => { addFoodType(customFoodType); setCustomFoodType(''); setShowCustomFoodType(false); }} className="px-3 py-2 bg-orange-500 text-white rounded-xl text-xs font-bold">新增</button>
              <button onClick={() => setShowCustomFoodType(false)} className="px-3 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold">取消</button>
            </div>
          ) : (
            <button onClick={() => setShowCustomFoodType(true)} className="text-xs font-black text-orange-400 hover:text-orange-600 flex items-center gap-1 mt-1"><Plus size={12} />新增食物類型</button>
          )}
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={() => confirmDel?.fn()} title={confirmDel?.title} message={confirmDel?.message} />
      <PhotoViewerModal isOpen={!!viewerPhotos} onClose={() => setViewerPhotos(null)} photos={viewerPhotos} initialIndex={viewerIndex} />
    </div>
  );
};

// ─── CurrencyBadge ─────────────────────────────────────────────────────────────
const CurrencyBadge = ({ amount, currency, type }) => {
  const config = {
    JPY: { sym: '¥', bg: 'bg-rose-100', text: 'text-rose-600', border: 'border-rose-200' },
    KRW: { sym: '₩', bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-200' },
    TWD: { sym: '$', bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-200' },
  };
  const c = config[currency] || config.TWD;
  const sign = type === '存入' ? '+' : '-';
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full ${c.bg} ${c.text} border ${c.border} text-sm font-black shadow-sm`}>
      {sign}{c.sym}{Number(amount).toLocaleString()} {currency}
    </span>
  );
};

// ─── ShoppingPage ─────────────────────────────────────────────────────────────
const ShoppingPage = ({ onDownload }) => {
  const { allMembers, currentMember, shoppingList, setShoppingList, sharedWallet, setSharedWallet, personalWallet, setPersonalWallet, allPersonalWallets, setAllPersonalWallets, splitRecords, setSplitRecords, walletDates, setWalletDates, shopOptions, setShopOptions } = useMember();

  // ── shopOptions 安全取值 ──
  const citiesPool = shopOptions?.cities || [];
  const mallsMap = shopOptions?.malls || {};
  const locationsMap = shopOptions?.locations || {};
  const getMallsForCity = useCallback((city) => mallsMap[city] || [], [mallsMap]);
  const getLocationsForCity = useCallback((city) => locationsMap[city] || [], [locationsMap]);

  // ── 篩選狀態 ──
  const [selectedMemberId, setSelectedMemberId] = useState('all');
  const [selectedCity, setSelectedCity] = useState('全部城市');
  const [selectedMall, setSelectedMall] = useState('全部商場');
  const [selectedLocation, setSelectedLocation] = useState('全部地區');
  const [viewMode, setViewMode] = useState('list');
  const [activeMapItem, setActiveMapItem] = useState(null);

  const [modal, setModal] = useState({ type: null, data: null });
  const [tempPhotos, setTempPhotos] = useState([]);
  const [boughtModal, setBoughtModal] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [viewerPhotos, setViewerPhotos] = useState(null);
  const [viewerIndex, setViewerIndex] = useState(0);

  // ── 自訂欄位 ──
  const [customCity, setCustomCity] = useState('');
  const [customMall, setCustomMall] = useState('');
  const [customLocation, setCustomLocation] = useState('');
  const [showCustomCity, setShowCustomCity] = useState(false);
  const [showCustomMall, setShowCustomMall] = useState(false);
  const [showCustomLocation, setShowCustomLocation] = useState(false);

  // ── 選項池（動態從清單擴充）──
  const topMalls = useMemo(() => {
    if (selectedCity === '全部城市') return [];
    return getMallsForCity(selectedCity);
  }, [selectedCity, getMallsForCity]);

  const topLocations = useMemo(() => {
    if (selectedCity === '全部城市') return [];
    return getLocationsForCity(selectedCity);
  }, [selectedCity, getLocationsForCity]);

  // ── 篩選清單 ──
  const filteredList = useMemo(() => {
    const list = shoppingList.filter(s => {
      if (selectedCity !== '全部城市' && s.city !== selectedCity) return false;
      if (selectedMall !== '全部商場' && s.mall !== selectedMall) return false;
      if (selectedLocation !== '全部地區' && s.location !== selectedLocation && !(s.locations || []).includes(selectedLocation)) return false;
      if (selectedMemberId !== 'all' && s.memberId !== selectedMemberId) return false;
      return true;
    });
    const unbought = list.filter(i => !i.isBought).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const bought = list.filter(i => i.isBought).sort((a, b) => (b.boughtAtMs || 0) - (a.boughtAtMs || 0));
    return [...unbought, ...bought];
  }, [shoppingList, selectedMemberId, selectedCity, selectedMall, selectedLocation]);

  const isOwner = selectedMemberId === 'all' || selectedMemberId === currentMember?.id;

  useEffect(() => {
    if (viewMode === 'map' && filteredList.length > 0) {
      if (!activeMapItem || !filteredList.find(i => i.id === activeMapItem.id)) {
        setActiveMapItem(filteredList[0]);
      }
    }
  }, [viewMode, filteredList]);

  const openAllOnGoogleMaps = () => {
    const withMap = filteredList.filter(i => i.mapUrl);
    if (withMap.length === 1) { window.open(withMap[0].mapUrl, '_blank'); return; }
    const query = filteredList.map(i => [(i.mall || i.shopName || i.name), i.city].filter(Boolean).join(' ')).join(' | ');
    window.open(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, '_blank');
  };

  useEffect(() => {
    onDownload(() => () => {
      const memberName = selectedMemberId === 'all' ? '全員' : (allMembers.find(m => m.id === selectedMemberId)?.name || '');
      let text = `購物清單 - ${selectedCity} (${memberName})\n\n`;
      filteredList.forEach(i => {
        text += `[${i.isBought ? '已買' : '未買'}] ${i.name}\n`;
        if (i.mall) text += `商場: ${i.mall}\n`;
        if (i.location) text += `地點: ${i.location}\n`;
        if (i.price && i.price !== '0') text += `價格: ${i.price} ${i.currency}\n`;
        if (i.note) text += `備註: ${i.note}\n`;
        text += '--\n';
      });
      downloadTextFile(text, `Shopping_${selectedCity}`);
    });
  }, [filteredList, selectedCity, selectedMemberId, allMembers, onDownload]);

  const handleDeleteShoppingItem = (item) => {
    setConfirmDel({
      fn: () => {
        if (item.walletRecordId) {
          if (item.recordedIn === '共用錢包') {
            setSharedWallet(p => (Array.isArray(p) ? p : []).filter(w => w.id !== item.walletRecordId));
          } else if (item.recordedIn === '個人記帳') {
            // 刪付款者的帳務記錄
            setAllPersonalWallets(prev => {
              const next = { ...prev };
              Object.keys(next).forEach(memberId => {
                if (Array.isArray(next[memberId])) {
                  next[memberId] = next[memberId].filter(w => w.id !== item.walletRecordId && w.walletItemId !== item.walletRecordId);
                }
              });
              return next;
            });
            // 刪 splitRecords
            setSplitRecords(p => (Array.isArray(p) ? p : []).filter(r => r.walletItemId !== item.walletRecordId));
          }
        }
        setShoppingList(p => p.filter(s => s.id !== item.id));
      }
    });
  };

  const handleConfirmBought = (price, currency, target, rawDate, payerId) => {
    const now = new Date();
    const dateStr = rawDate
      ? rawDate.split('-').slice(1).join('/')
      : `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}`;
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    let walletRecordId = null;
    const actualPayerId = payerId || currentMember?.id || '';
    const itemOwnerId = boughtModal?.memberId || '';

    if (!(Array.isArray(walletDates) ? walletDates : []).includes(dateStr)) setWalletDates(prev => [...(Array.isArray(prev) ? prev : []), dateStr].sort());

    const isMarkOnly = target === '已計入共用錢包' || target === '已計入個人記帳';
    if (!isMarkOnly && target !== '略過不記帳' && price && price !== '0') {
      walletRecordId = now.getTime();
      const record = { id: walletRecordId, name: `購買: ${boughtModal.name}`, type: '支出', amount: price, currency, date: dateStr, note: boughtModal.note || '自購物清單連動', editedById: actualPayerId, shoppingItemId: boughtModal.id, shoppingListItemId: boughtModal.id, createdAt: walletRecordId };

      if (target === '共用錢包') {
        // 自動把 forMemberIds 設為項目擁有者
        const recordWithOwner = itemOwnerId
          ? { ...record, forMemberIds: [itemOwnerId] }
          : record;
        setSharedWallet(p => [...(Array.isArray(p) ? p : []), recordWithOwner]);
      }
      else if (target === '個人記帳') {
        // 寫進付款者的帳
        setAllPersonalWallets(prev => {
          const cur = prev[actualPayerId] || [];
          return { ...prev, [actualPayerId]: [...cur, record] };
        });

        // 如果付款者不是項目擁有者 → 建立代墊記錄
        if (actualPayerId !== itemOwnerId && itemOwnerId) {
          const splitId = walletRecordId + 1;
          const splitRecord = {
            id: splitId,
            walletItemId: walletRecordId,
            payerId: actualPayerId,
            receiverId: itemOwnerId,
            amount: Number(price),
            currency,
            note: `購買: ${boughtModal.name}`,
            createdAt: walletRecordId,
            isSettled: false,
            settledAt: null,
          };
          setSplitRecords(p => [...(Array.isArray(p) ? p : []), splitRecord]);
          // 寫 proxy 進項目擁有者的帳
          setAllPersonalWallets(prev => {
            const cur = prev[itemOwnerId] || [];
            return {
              ...prev,
              [itemOwnerId]: [...cur, {
                id: walletRecordId + 2,
                walletItemId: walletRecordId,
                name: `購買: ${boughtModal.name}`,
                type: '支出',
                amount: Number(price),
                currency,
                date: dateStr,
                note: boughtModal.note || '',
                editedById: actualPayerId,
                isProxyRecord: true,
                createdAt: walletRecordId,
              }],
            };
          });
        }
      }
    }
    setShoppingList(p => p.map(s => s.id === boughtModal.id ? {
      ...s, isBought: true, boughtAt: `${dateStr} ${timeStr}`, boughtAtMs: now.getTime(),
      completedById: currentMember?.id || '', payerId: actualPayerId,
      price: target === '略過不記帳' ? null : price,
      currency: target === '略過不記帳' ? null : currency,
      recordedIn: target === '略過不記帳' ? null : target, walletRecordId
    } : s));
    setBoughtModal(null);
  };

  const handleUncheckBought = (item) => {
    setConfirmDel({
      fn: () => {
        if (item.walletRecordId) {
          if (item.recordedIn === '共用錢包') {
            setSharedWallet(p => (Array.isArray(p) ? p : []).filter(w => w.id !== item.walletRecordId));
          } else if (item.recordedIn === '個人記帳') {
            // 刪付款者的帳務記錄
            setAllPersonalWallets(prev => {
              const next = { ...prev };
              Object.keys(next).forEach(memberId => {
                if (Array.isArray(next[memberId])) {
                  next[memberId] = next[memberId].filter(w => w.id !== item.walletRecordId && w.walletItemId !== item.walletRecordId);
                }
              });
              return next;
            });
            // 刪 splitRecords
            setSplitRecords(p => (Array.isArray(p) ? p : []).filter(r => r.walletItemId !== item.walletRecordId));
          }
        }
        setShoppingList(p => p.map(s => s.id === item.id ? { ...s, isBought: false, completedById: null, boughtAt: null, boughtAtMs: null, price: null, currency: null, recordedIn: null, walletRecordId: null, payerId: null } : s));
      },
      title: '取消購買紀錄',
      message: '此操作將同時刪除對應的帳務記錄，確定繼續嗎？'
    });
  };

  const [showManageShopOptions, setShowManageShopOptions] = useState(false);
  const [editingShopOption, setEditingShopOption] = useState(null);
  const [newShopCityInput, setNewShopCityInput] = useState('');
  const [showNewShopCity, setShowNewShopCity] = useState(false);

  // ── shopOptions helpers ──
  const addShopCity = (city) => {
    if (!city.trim() || citiesPool.includes(city)) return;
    setShopOptions(prev => ({ ...prev, cities: [...(prev?.cities || []), city.trim()] }));
  };
  const renameShopCity = (oldVal, newVal) => {
    if (!newVal.trim() || newVal === oldVal) return;
    setShopOptions(prev => ({
      ...prev,
      cities: (prev?.cities || []).map(c => c === oldVal ? newVal.trim() : c),
      malls: Object.fromEntries(Object.entries(prev?.malls || {}).map(([k, v]) => [k === oldVal ? newVal.trim() : k, v])),
      locations: Object.fromEntries(Object.entries(prev?.locations || {}).map(([k, v]) => [k === oldVal ? newVal.trim() : k, v])),
    }));
    setShoppingList(p => p.map(s => s.city === oldVal ? { ...s, city: newVal.trim() } : s));
    setEditingShopOption(null);
  };
  const deleteShopCity = (city) => {
    setShopOptions(prev => {
      const { [city]: _m, ...restMalls } = (prev?.malls || {});
      const { [city]: _l, ...restLocs } = (prev?.locations || {});
      return { ...prev, cities: (prev?.cities || []).filter(c => c !== city), malls: restMalls, locations: restLocs };
    });
    setShoppingList(p => p.map(s => s.city === city ? { ...s, city: '' } : s));
  };
  const addShopMall = (city, mall) => {
    if (!mall.trim()) return;
    setShopOptions(prev => {
      const cur = prev?.malls?.[city] || [];
      if (cur.includes(mall)) return prev;
      return { ...prev, malls: { ...(prev?.malls || {}), [city]: [...cur, mall.trim()] } };
    });
  };
  const renameShopMall = (city, oldVal, newVal) => {
    if (!newVal.trim() || newVal === oldVal) return;
    setShopOptions(prev => ({ ...prev, malls: { ...(prev?.malls || {}), [city]: (prev?.malls?.[city] || []).map(m => m === oldVal ? newVal.trim() : m) } }));
    setShoppingList(p => p.map(s => s.mall === oldVal && s.city === city ? { ...s, mall: newVal.trim() } : s));
    setEditingShopOption(null);
  };
  const deleteShopMall = (city, mall) => {
    setShopOptions(prev => ({ ...prev, malls: { ...(prev?.malls || {}), [city]: (prev?.malls?.[city] || []).filter(m => m !== mall) } }));
    setShoppingList(p => p.map(s => s.mall === mall && s.city === city ? { ...s, mall: '' } : s));
  };
  const addShopLocation = (city, loc) => {
    if (!loc.trim()) return;
    setShopOptions(prev => {
      const cur = prev?.locations?.[city] || [];
      if (cur.includes(loc)) return prev;
      return { ...prev, locations: { ...(prev?.locations || {}), [city]: [...cur, loc.trim()] } };
    });
  };
  const renameShopLocation = (city, oldVal, newVal) => {
    if (!newVal.trim() || newVal === oldVal) return;
    setShopOptions(prev => ({ ...prev, locations: { ...(prev?.locations || {}), [city]: (prev?.locations?.[city] || []).map(l => l === oldVal ? newVal.trim() : l) } }));
    setShoppingList(p => p.map(s => s.location === oldVal && s.city === city ? { ...s, location: newVal.trim() } : s));
    setEditingShopOption(null);
  };
  const deleteShopLocation = (city, loc) => {
    setShopOptions(prev => ({ ...prev, locations: { ...(prev?.locations || {}), [city]: (prev?.locations?.[city] || []).filter(l => l !== loc) } }));
    setShoppingList(p => p.map(s => s.location === loc && s.city === city ? { ...s, location: '' } : s));
  };

  const openAddModal = () => {
    setModal({
      type: 'add',
      data: {
        city: selectedCity !== '全部城市' ? selectedCity : (citiesPool[0] || '釜山'),
        mall: selectedMall !== '全部商場' ? selectedMall : '',
        location: selectedLocation !== '全部地區' ? selectedLocation : '',
        branches: [],
      }
    });
    setTempPhotos([]);
    setShowCustomCity(false); setShowCustomMall(false); setShowCustomLocation(false);
    setCustomCity(''); setCustomMall(''); setCustomLocation('');
  };

  const modalCity = modal.data?.city || citiesPool[0] || '釜山';
  const modalMallPool = getMallsForCity(modalCity);
  const modalLocationPool = getLocationsForCity(modalCity);

  return (
    <div className="relative animate-in fade-in pb-28">

      {/* ── 頂部篩選 Bar ── */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm">

        {/* 第一排：許願者下拉（小）+ 地圖切換 */}
        <div className="px-4 pt-3 pb-2 flex items-center gap-2">
          <select value={selectedMemberId} onChange={e => setSelectedMemberId(e.target.value)}
            className={`text-[11px] font-black rounded-xl px-2 py-2 appearance-none border outline-none transition-all ${selectedMemberId !== 'all' ? 'bg-pink-500 text-white border-pink-500' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>
            <option value="all" className="bg-white text-slate-800">全員</option>
            {[...allMembers].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).map(m => (
              <option key={m.id} value={m.id} className="bg-white text-slate-800">
                {m.id === currentMember?.id ? `${m.name}（我）` : m.name}
              </option>
            ))}
          </select>
          <div className="flex bg-white rounded-xl p-1 border border-slate-100 shadow-sm shrink-0 ml-auto">
            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-pink-100 text-pink-500' : 'text-slate-400'}`}><List size={14} /></button>
            <button onClick={() => setViewMode('map')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'map' ? 'bg-pink-100 text-pink-500' : 'text-slate-400'}`}><Map size={14} /></button>
          </div>
        </div>

        {/* 第二排：城市 + 商場 + 地區（同一行）*/}
        <div className="px-4 pb-2 grid grid-cols-3 gap-2">
          <select value={selectedCity} onChange={e => { setSelectedCity(e.target.value); setSelectedMall('全部商場'); setSelectedLocation('全部地區'); }}
            className={`text-[11px] font-black rounded-xl px-1 py-2.5 appearance-none border outline-none text-center transition-all ${selectedCity !== '全部城市' ? 'bg-pink-500 text-white border-pink-500' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>
            <option value="全部城市" className="bg-white text-slate-800">全部城市</option>
            {citiesPool.map(c => <option key={c} value={c} className="bg-white text-slate-800">{c}</option>)}
          </select>
          <select value={selectedMall} onChange={e => { setSelectedMall(e.target.value); setSelectedLocation('全部地區'); }}
            className={`text-[11px] font-black rounded-xl px-1 py-2.5 appearance-none border outline-none text-center transition-all ${selectedMall !== '全部商場' ? 'bg-pink-100 text-pink-700 border-pink-200' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>
            <option value="全部商場" className="bg-white text-slate-800">全部商場</option>
            {topMalls.map(m => <option key={m} value={m} className="bg-white text-slate-800">{m}</option>)}
          </select>
          <select value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)}
            className={`text-[11px] font-black rounded-xl px-1 py-2.5 appearance-none border outline-none text-center transition-all ${selectedLocation !== '全部地區' ? 'bg-purple-100 text-purple-800 border-purple-200' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>
            <option value="全部地區" className="bg-white text-slate-800">全部地區</option>
            {topLocations.map(l => <option key={l} value={l} className="bg-white text-slate-800">{l}</option>)}
          </select>
        </div>

        {/* 計數 + 清除 + 管理 */}
        <div className="px-4 pb-2 flex items-center justify-between">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">共 {filteredList.length} 件・{filteredList.filter(i => i.isBought).length} 件已買</span>
          <div className="flex items-center gap-3">
            {(selectedCity !== '全部城市' || selectedMall !== '全部商場' || selectedLocation !== '全部地區' || selectedMemberId !== 'all') && (
              <button onClick={() => { setSelectedCity('全部城市'); setSelectedMall('全部商場'); setSelectedLocation('全部地區'); setSelectedMemberId('all'); }} className="text-[10px] font-black text-pink-400 hover:text-pink-600 transition-colors">清除篩選</button>
            )}
            <button onClick={() => setShowManageShopOptions(true)} className="flex items-center gap-1 text-[10px] font-black text-slate-400 hover:text-slate-600 transition-colors">
              <Settings size={11} />管理選項
            </button>
          </div>
        </div>
      </div>

      {/* ── 地圖模式 ── */}
      {viewMode === 'map' ? (
        <div className="mt-4 px-4 h-[calc(100vh-310px)] flex flex-col animate-in fade-in">
          {filteredList.length > 0 && (
            <button onClick={openAllOnGoogleMaps} className="mb-3 w-full py-2.5 bg-pink-500 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 hover:bg-pink-600 active:scale-95 transition-all shadow-sm shrink-0">
              <MapPin size={14} strokeWidth={2.5} />
              一鍵開啟全部 {filteredList.length} 個購物地點
            </button>
          )}
          <div className="flex-1 rounded-[2rem] overflow-hidden border border-slate-200 shadow-sm bg-slate-100">
            {activeMapItem ? (
              <MapEmbed query={[(activeMapItem.mall || activeMapItem.shopName || activeMapItem.name), activeMapItem.city].filter(Boolean).join(' ')} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm font-bold">無購物項目可顯示</div>
            )}
          </div>
          {filteredList.length > 0 && (
            <div className="h-32 mt-3 overflow-x-auto no-scrollbar flex items-center gap-3 shrink-0 pb-2">
              {filteredList.map(item => {
                const isActive = activeMapItem?.id === item.id;
                const owner = allMembers.find(m => m.id === item.memberId) || { name: '成員', avatarColor: '#94a3b8' };
                const branches = item.branches || [];
                return (
                  <div key={item.id} onClick={() => setActiveMapItem(item)} className={`w-52 p-3.5 rounded-3xl shrink-0 border shadow-sm transition-all cursor-pointer ${item.isBought ? 'opacity-60' : ''} ${isActive ? 'bg-pink-500 text-white border-pink-500 scale-105 opacity-100' : 'bg-white text-slate-700 border-slate-200 hover:bg-pink-50'}`}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Avatar member={owner} className="w-4 h-4 rounded-md shrink-0" />
                      <span className={`text-[10px] font-bold truncate flex-1 ${isActive ? 'text-pink-100' : 'text-slate-400'}`}>{owner.name}</span>
                      {item.isBought && <span className={`text-[10px] font-black shrink-0 ${isActive ? 'text-pink-100' : 'text-pink-400'}`}>✓</span>}
                      <button onClick={e => { e.stopPropagation(); setModal({ type: 'edit', data: item }); setTempPhotos(item.photos || []); }}
                        className={`p-1 rounded-lg shrink-0 transition-colors ${isActive ? 'bg-white/20 text-white' : 'bg-slate-50 text-slate-400 hover:text-pink-500'}`}>
                        <Edit2 size={11} />
                      </button>
                    </div>
                    <h4 className={`font-bold text-sm truncate ${item.isBought && !isActive ? 'line-through text-slate-400' : ''}`}>{item.name}</h4>
                    {(item.mall || item.shopName) && <p className={`text-[10px] mt-0.5 truncate ${isActive ? 'text-pink-100' : 'text-slate-400'}`}>🏪 {item.mall || item.shopName}</p>}
                    {branches.length > 0 ? (
                      <div className="mt-1 space-y-0.5">
                        {branches.filter(b => b.mapUrl).map((b, bi) => (
                          <a key={bi} href={b.mapUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                            className={`text-[10px] font-black flex items-center gap-1 ${isActive ? 'text-pink-100' : 'text-pink-400'}`}>
                            <Navigation size={9} />{b.name || `分店${bi + 1}`}
                          </a>
                        ))}
                      </div>
                    ) : item.mapUrl && (
                      <a href={item.mapUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className={`mt-1 text-[10px] font-black flex items-center gap-1 ${isActive ? 'text-pink-100' : 'text-pink-400'}`}><Navigation size={9} />導航</a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ── 清單模式 ── */
        <div className="space-y-4 mt-4 px-4 animate-in fade-in">
          {filteredList.map(item => {
            const owner = allMembers.find(m => m.id === item.memberId) || { name: item.createdBy || '成員', avatarColor: '#94a3b8' };
            const completer = allMembers.find(m => m.id === item.completedById) || { name: item.completedBy || '成員', avatarColor: '#94a3b8' };
            const isMine = item.memberId === currentMember?.id;

            return (
              <div key={item.id} className={`bg-white border border-slate-100 rounded-[2rem] p-5 shadow-sm transition-all ${item.isBought ? 'opacity-60 bg-slate-50/50' : 'hover:shadow-md'}`}>

                {/* 頂部標籤列 */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex flex-wrap gap-1.5 flex-1">
                    {item.city && <span className="px-2 py-0.5 rounded-lg bg-pink-50 border border-pink-100 text-pink-600 text-[10px] font-black">📍 {item.city}</span>}
                    {(item.mall || item.shopName) && <span className="px-2 py-0.5 rounded-lg bg-pink-50 text-pink-500 text-[10px] font-bold">🏪 {item.mall || item.shopName}</span>}
                    {item.location && <span className="px-2 py-0.5 rounded-lg bg-purple-50 text-purple-600 text-[10px] font-bold">🗺 {item.location}</span>}
                  </div>
                  {/* 只有自己的可以編輯刪除 */}
                  {isMine && (
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => { setModal({ type: 'edit', data: item }); setTempPhotos(item.photos || []); setShowCustomCity(false); setShowCustomMall(false); setShowCustomLocation(false); }} className="p-2 bg-slate-50 hover:bg-pink-50 text-slate-400 hover:text-pink-500 rounded-xl transition-colors shadow-sm"><Edit2 size={13} /></button>
                      <button onClick={() => handleDeleteShoppingItem(item)} className="p-2 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-colors shadow-sm"><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>

                {/* 商品名 + 打勾 */}
                <div className="flex items-center gap-3 mb-3">
                  {/* 任何人都可以打勾，但只有自己能取消 */}
                  <button
                    onClick={() => {
                      if (item.isBought) {
                        // 誰打的勾誰能取消（completedById 是打勾者）
                        const canUncheck = item.completedById === currentMember?.id || item.memberId === currentMember?.id;
                        if (canUncheck) { handleUncheckBought(item); return; }
                        return;
                      }
                      // 未打勾：打開 BoughtModal
                      setBoughtModal(item); return;
                    }}
                    className={`w-9 h-9 rounded-2xl flex items-center justify-center border-2 transition-all shrink-0 ${item.isBought ? 'bg-pink-500 border-pink-500 text-white shadow-md' : 'bg-white border-pink-200 hover:border-pink-400 hover:bg-pink-50'}`}
                  >
                    <Check size={18} strokeWidth={3} className={item.isBought ? 'opacity-100' : 'opacity-30'} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-base font-black text-slate-800 leading-snug ${item.isBought ? 'line-through text-slate-400' : ''}`}>{item.name}</h3>
                  </div>
                </div>

                {/* 備註 */}
                {item.note && <p className="text-xs text-slate-500 whitespace-pre-wrap leading-relaxed bg-slate-50 p-3 rounded-2xl border-l-4 border-pink-200 mb-3">{item.note}</p>}

                {/* 相片 */}
                {item.photos?.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3">
                    {item.photos.map((p, i) => (
                      <img key={i} src={p} onClick={() => { setViewerPhotos(item.photos); setViewerIndex(i); }} className="w-20 h-20 object-cover rounded-2xl border border-slate-100 shadow-sm shrink-0 cursor-pointer hover:opacity-90 transition-opacity" alt="photo" />
                    ))}
                  </div>
                )}

                {/* 已購買資訊 */}
                {item.isBought && (() => {
                  const payer = (allMembers || []).find(m => m.id === (item.payerId || item.completedById));
                  const owner = (allMembers || []).find(m => m.id === item.memberId);
                  // 只有計入個人記帳才算代墊，公費不算
                  const isProxy = item.payerId && item.memberId && item.payerId !== item.memberId && item.recordedIn === '個人記帳';
                  return (
                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-pink-600 bg-pink-50 px-3 py-1.5 rounded-xl w-fit border border-pink-100 flex-wrap">
                        <span>{item.boughtAt} 購入</span>
                        {isProxy && (() => {
                          const safeRecords = Array.isArray(splitRecords) ? splitRecords : [];
                          const isSettled = safeRecords.some(r =>
                            r.walletItemId === item.walletRecordId &&
                            r.payerId === item.payerId &&
                            r.receiverId === item.memberId &&
                            r.isSettled
                          );
                          return (
                            <span className={isSettled ? 'line-through text-slate-400' : 'text-violet-500'}>
                              （{(allMembers || []).find(m => m.id === item.payerId)?.name || ''} 代墊）
                            </span>
                          );
                        })()}
                      </div>
                      {item.recordedIn && (() => {
                        // 從帳務即時讀金額
                        const isMarkOnly = item.recordedIn === '已計入共用錢包' || item.recordedIn === '已計入個人記帳';
                        let displayAmt = item.price;
                        let displayCur = item.currency;
                        if (!isMarkOnly && item.walletRecordId) {
                          const allWallets = Object.values(allPersonalWallets || {}).flat().filter(Boolean);
                          const walletRecord = item.recordedIn === '共用錢包'
                            ? (Array.isArray(sharedWallet) ? sharedWallet : []).find(w => w.id === item.walletRecordId)
                            : allWallets.find(w => w.id === item.walletRecordId);
                          if (walletRecord) {
                            displayAmt = walletRecord.amount;
                            displayCur = walletRecord.currency;
                          }
                        }
                        return (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                              {isMarkOnly ? '✓ ' : ''}計入 {item.recordedIn.replace('已計入', '')}
                            </span>
                            {!isMarkOnly && displayAmt && displayAmt !== '0' && (
                              <CurrencyBadge amount={displayAmt} currency={displayCur} type="支出" />
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}

                {/* 底部：許願者 + 導航 */}
                <div className="flex items-center justify-between border-t border-slate-50 pt-3 mt-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <Avatar member={owner} className="w-4 h-4 rounded-md" />
                    <span>{owner.name} 許願</span>
                  </div>
                  <div className="flex gap-1.5 flex-wrap justify-end">
                    {(item.branches || []).filter(b => b.mapUrl).map((b, bi) => (
                      <a key={bi} href={b.mapUrl} target="_blank" rel="noreferrer" className="px-2.5 py-1.5 bg-pink-50 hover:bg-pink-100 text-pink-500 border border-pink-100 rounded-xl flex items-center gap-1 text-xs font-black transition-colors">
                        <Navigation size={11} strokeWidth={2.5} />{b.name || `分店${bi + 1}`}
                      </a>
                    ))}
                    {!(item.branches || []).length && item.mapUrl && (
                      <a href={item.mapUrl} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-pink-50 hover:bg-pink-100 text-pink-500 border border-pink-100 rounded-xl flex items-center gap-1.5 text-xs font-black transition-colors">
                        <Navigation size={13} strokeWidth={2.5} />導航
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {filteredList.length === 0 && <div className="py-24 text-center text-slate-400 text-xs font-bold uppercase tracking-widest italic opacity-80">目前沒有購物清單</div>}
        </div>
      )}

      {/* 新增按鈕（任何人都可以新增自己的） */}
      <button onClick={() => {
        setModal({
          type: 'add',
          data: {
            city: selectedCity !== '全部城市' ? selectedCity : (citiesPool[0] || '釜山'),
            mall: selectedMall !== '全部商場' ? selectedMall : '',
            location: '',
            locations: [],
            branches: [],
            mapUrl: '',
          }
        });
        setTempPhotos([]);
        setShowCustomCity(false); setShowCustomMall(false); setShowCustomLocation(false);
        setCustomCity(''); setCustomMall(''); setCustomLocation('');
      }} className="fixed bottom-[110px] right-6 w-16 h-16 bg-pink-500 text-white rounded-[2rem] shadow-lg flex items-center justify-center active:scale-90 z-[60] border-4 border-white hover:bg-pink-600 transition-colors">
        <Plus size={30} strokeWidth={3} />
      </button>

      {/* ── 新增/編輯 Modal ── */}
      <Modal isOpen={!!modal.type} onClose={() => setModal({ type: null, data: null })} title={modal.data?.id ? '修改購物內容' : '新增購物願望'}>

        {/* 城市 */}
        <div className="mb-3">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 block">🏙️ 城市</label>
          {!showCustomCity ? (
            <select value={modal.data?.city || ''} onChange={e => { if (e.target.value === '__NEW__') { setShowCustomCity(true); return; } setModal(p => ({ ...p, data: { ...p.data, city: e.target.value, mall: '', location: '' } })); }} className="w-full bg-white border border-slate-200 rounded-2xl p-4 font-bold text-slate-700 outline-none text-sm shadow-sm">
              {citiesPool.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="__NEW__">➕ 新增城市...</option>
            </select>
          ) : (
            <div className="flex gap-2">
              <input autoFocus type="text" placeholder="輸入城市名稱" value={customCity} onChange={e => setCustomCity(e.target.value)} className="flex-1 bg-white border border-slate-200 rounded-2xl p-4 font-semibold text-sm text-slate-700 outline-none" />
              <button type="button" onClick={() => { if (!customCity.trim()) return; setModal(p => ({ ...p, data: { ...p.data, city: customCity.trim(), mall: '', location: '' } })); setShowCustomCity(false); setCustomCity(''); }} className="px-4 bg-pink-500 text-white font-bold rounded-2xl text-xs">套用</button>
              <button type="button" onClick={() => setShowCustomCity(false)} className="px-3 bg-slate-100 text-slate-500 font-bold rounded-2xl text-xs">取消</button>
            </div>
          )}
        </div>

        {/* 商場/店名 */}
        <div className="mb-3">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 block">🏪 商場 / 店名</label>
          {!showCustomMall ? (
            <select value={modal.data?.mall || ''} onChange={e => { if (e.target.value === '__NEW__') { setShowCustomMall(true); return; } setModal(p => ({ ...p, data: { ...p.data, mall: e.target.value } })); }} className="w-full bg-white border border-slate-200 rounded-2xl p-4 font-bold text-slate-700 outline-none text-sm shadow-sm">
              <option value="">無特定商場</option>
              {getMallsForCity(modalCity).map(m => <option key={m} value={m}>{m}</option>)}
              <option value="__NEW__">➕ 新增商場/店名...</option>
            </select>
          ) : (
            <div className="flex gap-2">
              <input autoFocus type="text" placeholder="例如：Olive Young、唐吉訶德" value={customMall} onChange={e => setCustomMall(e.target.value)} className="flex-1 bg-white border border-slate-200 rounded-2xl p-4 font-semibold text-sm text-slate-700 outline-none" />
              <button type="button" onClick={() => {
                if (!customMall.trim()) return;
                const newMall = customMall.trim();
                const city = modal.data?.city || citiesPool[0];
                if (!getMallsForCity(city).includes(newMall)) {
                  setShopOptions(prev => ({ ...prev, malls: { ...(prev?.malls || {}), [city]: [...(prev?.malls?.[city] || []), newMall] } }));
                }
                setModal(p => ({ ...p, data: { ...p.data, mall: newMall } }));
                setShowCustomMall(false); setCustomMall('');
              }} className="px-4 bg-pink-500 text-white font-bold rounded-2xl text-xs">套用</button>
              <button type="button" onClick={() => setShowCustomMall(false)} className="px-3 bg-slate-100 text-slate-500 font-bold rounded-2xl text-xs">取消</button>
            </div>
          )}
        </div>

        {/* 地區/樓層（多選，跟美食一樣）*/}
        <div className="mb-3">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 block">🗺 地區 / 分店 / 樓層（可多選）</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {getLocationsForCity(modalCity).map(l => {
              const selected = (modal.data?.locations || []).includes(l);              return (
                <button key={l} type="button" onClick={() => {
                  setModal(p => {
                    const cur = p.data?.locations || [];
                    const isRemoving = cur.includes(l);
                    const nextLocations = isRemoving ? cur.filter(x => x !== l) : [...cur, l];
                    let nextBranches = p.data?.branches || [];
                    if (!isRemoving) {
                      const alreadyHas = nextBranches.some(b => b.name === l);
                      if (!alreadyHas) nextBranches = [...nextBranches, { name: l, mapUrl: '' }];
                    } else {
                      // 取消地區時，移除對應分店（只移除名稱完全一樣且連結是空的，保留已填連結的）
                      nextBranches = nextBranches.filter(b => !(b.name === l && !b.mapUrl));
                    }
                    return { ...p, data: { ...p.data, locations: nextLocations, location: nextLocations[0] || '', branches: nextBranches } };
                  });
                }} className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${selected ? 'bg-pink-500 text-white border-pink-500 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:bg-pink-50'}`}>
                  {l}
                </button>
              );
            })}
          </div>
          {!showCustomLocation ? (
            <button type="button" onClick={() => setShowCustomLocation(true)} className="text-xs font-bold text-pink-400 hover:text-pink-600 transition-colors">➕ 新增自訂地區</button>
          ) : (
            <div className="flex gap-2 mt-1">
              <input autoFocus type="text" placeholder="例如：B2F、西面店" value={customLocation} onChange={e => setCustomLocation(e.target.value)} className="flex-1 bg-white border border-slate-200 rounded-2xl p-3 font-semibold text-sm text-slate-700 outline-none" />
              <button type="button" onClick={() => {
                if (!customLocation.trim()) return;
                const l = customLocation.trim();
                const city = modal.data?.city || citiesPool[0];
                // 寫入 shopOptions
                setShopOptions(prev => {
                  const curLocs = prev?.locations?.[city] || [];
                  if (curLocs.includes(l)) return prev;
                  return { ...prev, locations: { ...(prev?.locations || {}), [city]: [...curLocs, l] } };
                });
                setModal(p => {
                  const cur = p.data?.locations || [];
                  const nextLocations = cur.includes(l) ? cur : [...cur, l];
                  const nextBranches = [...(p.data?.branches || []), { name: l, mapUrl: '' }];
                  return { ...p, data: { ...p.data, locations: nextLocations, location: l, branches: nextBranches } };
                });
                setShowCustomLocation(false); setCustomLocation('');
              }} className="px-4 bg-pink-500 text-white font-bold rounded-2xl text-xs">套用</button>
              <button type="button" onClick={() => setShowCustomLocation(false)} className="px-3 bg-slate-100 text-slate-500 font-bold rounded-2xl text-xs">取消</button>
            </div>
          )}
        </div>

        <FormField label="🛍️ 商品名稱" value={modal.data?.name} placeholder="例如：Matin Kim 短袖、蜂蜜奶油杏仁" onChange={v => setModal(p => ({ ...p, data: { ...p.data, name: v } }))} />

        {/* 有選地區就顯示分店列表，沒選就顯示單一 Map 連結 */}
        {(modal.data?.locations || []).length > 0 ? (
          <div className="mb-3">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 block">🗺 分店 / 地圖連結</label>
            {(modal.data?.branches || []).map((b, bi) => (
              <div key={bi} className="flex gap-2 mb-2">
                <input type="text" placeholder="分店名稱" value={b.name || ''} onChange={e => setModal(p => ({ ...p, data: { ...p.data, branches: p.data.branches.map((x, i) => i === bi ? { ...x, name: e.target.value } : x) } }))}
                  className="w-28 bg-white border border-slate-200 rounded-xl p-3 font-semibold text-sm text-slate-700 outline-none shadow-sm shrink-0" />
                <input type="text" placeholder="Map 連結（選填）" value={b.mapUrl || ''} onChange={e => setModal(p => ({ ...p, data: { ...p.data, branches: p.data.branches.map((x, i) => i === bi ? { ...x, mapUrl: e.target.value } : x) } }))}
                  className="flex-1 bg-white border border-slate-200 rounded-xl p-3 font-semibold text-sm text-slate-700 outline-none shadow-sm" />
                <button type="button" onClick={() => setModal(p => ({ ...p, data: { ...p.data, branches: p.data.branches.filter((_, i) => i !== bi) } }))}
                  className="p-2 bg-red-50 text-red-400 rounded-xl hover:bg-red-100 transition-colors shrink-0"><X size={14} /></button>
              </div>
            ))}
            <button type="button" onClick={() => setModal(p => ({ ...p, data: { ...p.data, branches: [...(p.data.branches || []), { name: '', mapUrl: '' }] } }))}
              className="text-xs font-black text-pink-400 hover:text-pink-600 flex items-center gap-1 mt-1">
              <Plus size={12} />新增分店
            </button>
          </div>
        ) : (
          <FormField label="🌐 Map 連結（選填）" value={modal.data?.mapUrl} placeholder="貼上 Google Map 或 NAVER Map 連結" onChange={v => setModal(p => ({ ...p, data: { ...p.data, mapUrl: v } }))} />
        )}
        <FormField label="💡 備註（尺寸、顏色、幫誰帶等）" type="textarea" value={modal.data?.note} placeholder="例如：深藍色 M 號、幫媽媽帶、約 3000 韓元" onChange={v => setModal(p => ({ ...p, data: { ...p.data, note: v } }))} />

        {/* 相片 */}
        <div className="mb-4">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">📷 商品照片（最多 5 張）</label>
          <div className="flex flex-wrap gap-2">
            {tempPhotos.map((url, idx) => (
              <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-100 shadow-sm">
                <img src={url} className="w-full h-full object-cover" alt="tmp" />
                <button onClick={() => setTempPhotos(p => p.filter((_, i) => i !== idx))} className="absolute top-1 right-1 p-1 bg-red-500/90 text-white rounded-lg"><X size={12} /></button>
              </div>
            ))}
            {tempPhotos.length < 5 && <button onClick={() => document.getElementById('shopping-photo-up').click()} className="w-16 h-16 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-50 shadow-sm"><Camera size={24} /></button>}
          </div>
          <input type="file" id="shopping-photo-up" className="hidden" multiple accept="image/*" onChange={e => {
            Array.from(e.target.files).forEach(file => { const r = new FileReader(); r.onloadend = async () => { const compressed = await compressImageBase64(r.result); setTempPhotos(p => p.length < 5 ? [...p, compressed] : p); }; r.readAsDataURL(file); });
          }} />
        </div>

        <button onClick={() => {
          if (!modal.data?.name) return;
          const finalData = { ...modal.data, photos: tempPhotos, isBought: modal.data.isBought || false, memberId: currentMember?.id || '', createdById: modal.data.createdById || currentMember?.id || '', createdAt: modal.data.createdAt || Date.now() };
          if (modal.data.id) {
            setShoppingList(p => p.map(s => {
              if (s.id !== modal.data.id) return s;
              if (s.walletRecordId) {
                // 陣列防護加強
                const updateRecord = wList => (Array.isArray(wList) ? wList : []).map(w => w.id === s.walletRecordId ? { ...w, name: `購買: ${finalData.name}`, note: finalData.note || '自購物清單連動' } : w);
                if (s.recordedIn === '共用錢包') setSharedWallet(updateRecord);
                else if (s.recordedIn === '個人記帳') setPersonalWallet(updateRecord);
              }
              return finalData;
            }));
          } else {
            setShoppingList(p => [...p, { ...finalData, id: Date.now() }]);
          }
          setModal({ type: null }); setTempPhotos([]);
        }} className="w-full bg-pink-500 text-white font-black py-4 rounded-2xl shadow-md active:scale-95 mt-1 text-base hover:bg-pink-600 transition-colors">確認儲存</button>
      </Modal>

      {/* ── 管理選項 Modal ── */}
      <Modal isOpen={showManageShopOptions} onClose={() => { setShowManageShopOptions(false); setEditingShopOption(null); }} title="管理購物選項">
        {/* 城市 */}
        <div className="mb-5">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">🏙️ 城市</p>
          {citiesPool.map(val => (
            <div key={val} className="flex items-center gap-2 mb-2">
              {editingShopOption?.type === 'city' && editingShopOption?.oldVal === val ? (
                <>
                  <input autoFocus type="text" value={editingShopOption.newVal} onChange={e => setEditingShopOption(p => ({ ...p, newVal: e.target.value }))} className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-pink-300" />
                  <button onClick={() => renameShopCity(val, editingShopOption.newVal)} className="px-3 py-2 bg-pink-500 text-white rounded-xl text-xs font-bold">儲存</button>
                  <button onClick={() => setEditingShopOption(null)} className="px-3 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold">取消</button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-bold text-slate-700 px-1">{val}</span>
                  <button onClick={() => setEditingShopOption({ type: 'city', oldVal: val, newVal: val })} className="p-2 bg-slate-50 hover:bg-pink-50 text-slate-400 hover:text-pink-500 rounded-xl transition-colors"><Edit2 size={13} /></button>
                  <button onClick={() => setConfirmDel({ title: `刪除城市「${val}」`, message: `刪除後「${val}」下的商場和地區選項也會移除，店家城市欄位會清空。`, fn: () => deleteShopCity(val) })} className="p-2 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-colors"><Trash2 size={13} /></button>
                </>
              )}
            </div>
          ))}
          {showNewShopCity ? (
            <div className="flex gap-2 mt-1">
              <input autoFocus type="text" placeholder="新城市名稱" value={newShopCityInput} onChange={e => setNewShopCityInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (addShopCity(newShopCityInput), setNewShopCityInput(''), setShowNewShopCity(false))} className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-pink-300" />
              <button onClick={() => { addShopCity(newShopCityInput); setNewShopCityInput(''); setShowNewShopCity(false); }} className="px-3 py-2 bg-pink-500 text-white rounded-xl text-xs font-bold">新增</button>
              <button onClick={() => setShowNewShopCity(false)} className="px-3 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold">取消</button>
            </div>
          ) : (
            <button onClick={() => setShowNewShopCity(true)} className="text-xs font-black text-pink-400 hover:text-pink-600 flex items-center gap-1 mt-1"><Plus size={12} />新增城市</button>
          )}
        </div>

        {/* 各城市商場 */}
        {citiesPool.map(city => (
          <div key={city} className="mb-5">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">🏪 {city} 商場/店名</p>
            {(mallsMap[city] || []).map(val => (
              <div key={val} className="flex items-center gap-2 mb-2">
                {editingShopOption?.type === 'mall' && editingShopOption?.city === city && editingShopOption?.oldVal === val ? (
                  <>
                    <input autoFocus type="text" value={editingShopOption.newVal} onChange={e => setEditingShopOption(p => ({ ...p, newVal: e.target.value }))} className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-pink-300" />
                    <button onClick={() => renameShopMall(city, val, editingShopOption.newVal)} className="px-3 py-2 bg-pink-500 text-white rounded-xl text-xs font-bold">儲存</button>
                    <button onClick={() => setEditingShopOption(null)} className="px-3 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold">取消</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-bold text-slate-700 px-1">{val}</span>
                    <button onClick={() => setEditingShopOption({ type: 'mall', city, oldVal: val, newVal: val })} className="p-2 bg-slate-50 hover:bg-pink-50 text-slate-400 hover:text-pink-500 rounded-xl transition-colors"><Edit2 size={13} /></button>
                    <button onClick={() => setConfirmDel({ title: `刪除「${val}」`, message: '該商場標籤會從所有項目中移除，項目本身不刪除。', fn: () => deleteShopMall(city, val) })} className="p-2 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-colors"><Trash2 size={13} /></button>
                  </>
                )}
              </div>
            ))}
            {editingShopOption?.type === 'newMall' && editingShopOption?.city === city ? (
              <div className="flex gap-2 mt-1">
                <input autoFocus type="text" placeholder="新商場名稱" value={editingShopOption.newVal} onChange={e => setEditingShopOption(p => ({ ...p, newVal: e.target.value }))} onKeyDown={e => e.key === 'Enter' && (addShopMall(city, editingShopOption.newVal), setEditingShopOption(null))} className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-pink-300" />
                <button onClick={() => { addShopMall(city, editingShopOption.newVal); setEditingShopOption(null); }} className="px-3 py-2 bg-pink-500 text-white rounded-xl text-xs font-bold">新增</button>
                <button onClick={() => setEditingShopOption(null)} className="px-3 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold">取消</button>
              </div>
            ) : (
              <button onClick={() => setEditingShopOption({ type: 'newMall', city, newVal: '' })} className="text-xs font-black text-pink-400 hover:text-pink-600 flex items-center gap-1 mt-1"><Plus size={12} />新增商場</button>
            )}
          </div>
        ))}

        {/* 各城市地區/樓層 */}
        {citiesPool.map(city => (
          <div key={city} className="mb-5">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">🗺 {city} 地區/分店/樓層</p>
            {(locationsMap[city] || []).map(val => (
              <div key={val} className="flex items-center gap-2 mb-2">
                {editingShopOption?.type === 'location' && editingShopOption?.city === city && editingShopOption?.oldVal === val ? (
                  <>
                    <input autoFocus type="text" value={editingShopOption.newVal} onChange={e => setEditingShopOption(p => ({ ...p, newVal: e.target.value }))} className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-pink-300" />
                    <button onClick={() => renameShopLocation(city, val, editingShopOption.newVal)} className="px-3 py-2 bg-pink-500 text-white rounded-xl text-xs font-bold">儲存</button>
                    <button onClick={() => setEditingShopOption(null)} className="px-3 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold">取消</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-bold text-slate-700 px-1">{val}</span>
                    <button onClick={() => setEditingShopOption({ type: 'location', city, oldVal: val, newVal: val })} className="p-2 bg-slate-50 hover:bg-pink-50 text-slate-400 hover:text-pink-500 rounded-xl transition-colors"><Edit2 size={13} /></button>
                    <button onClick={() => setConfirmDel({ title: `刪除「${val}」`, message: '該地區標籤會從所有項目中移除，項目本身不刪除。', fn: () => deleteShopLocation(city, val) })} className="p-2 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-colors"><Trash2 size={13} /></button>
                  </>
                )}
              </div>
            ))}
            {editingShopOption?.type === 'newLocation' && editingShopOption?.city === city ? (
              <div className="flex gap-2 mt-1">
                <input autoFocus type="text" placeholder="例如：B2F、西面店" value={editingShopOption.newVal} onChange={e => setEditingShopOption(p => ({ ...p, newVal: e.target.value }))} onKeyDown={e => e.key === 'Enter' && (addShopLocation(city, editingShopOption.newVal), setEditingShopOption(null))} className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-pink-300" />
                <button onClick={() => { addShopLocation(city, editingShopOption.newVal); setEditingShopOption(null); }} className="px-3 py-2 bg-pink-500 text-white rounded-xl text-xs font-bold">新增</button>
                <button onClick={() => setEditingShopOption(null)} className="px-3 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold">取消</button>
              </div>
            ) : (
              <button onClick={() => setEditingShopOption({ type: 'newLocation', city, newVal: '' })} className="text-xs font-black text-pink-400 hover:text-pink-600 flex items-center gap-1 mt-1"><Plus size={12} />新增地區/樓層</button>
            )}
          </div>
        ))}
      </Modal>

      <BoughtModal isOpen={!!boughtModal} onClose={() => setBoughtModal(null)} onConfirm={handleConfirmBought} allMembers={allMembers} currentMember={currentMember} itemOwner={boughtModal?.memberId} />
      <ConfirmDialog isOpen={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={() => confirmDel?.fn()} title={confirmDel?.title} message={confirmDel?.message} />
      <PhotoViewerModal isOpen={!!viewerPhotos} onClose={() => setViewerPhotos(null)} photos={viewerPhotos} initialIndex={viewerIndex} />
    </div>
  );
};

// ─── BoughtModal ──────────────────────────────────────────────────────────────
const BoughtModal = ({ isOpen, onClose, onConfirm, allMembers, currentMember, itemOwner }) => {
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('JPY');
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
  const [date, setDate] = useState(todayStr);
  const [payerId, setPayerId] = useState(currentMember?.id || '');
  const [selectedTarget, setSelectedTarget] = useState(null); // 追蹤選了哪個按鈕

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative bg-white rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-xl animate-in zoom-in duration-300 flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
          <h3 className="text-lg font-black text-pink-600">紀錄購買價格</h3>
          <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 active:scale-90 transition-all"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar bg-slate-50/50">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">購買日期</p>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-2xl h-12 px-3 font-bold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-pink-100 transition-all shadow-sm" />
          </div>
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex justify-between items-end">
            <div className="flex-1">
              <p className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">金額</p>
              <input type="text" value={price} onChange={e => setPrice(e.target.value)} className="bg-transparent text-3xl font-black text-slate-800 outline-none w-full" placeholder="0" />
            </div>
            <div className="flex flex-col gap-2 items-end">
              <button onClick={() => setIsCalcOpen(!isCalcOpen)} className={`p-2.5 rounded-xl transition-colors shadow-sm border ${isCalcOpen ? 'bg-pink-500 text-white border-pink-500' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}><Calculator size={22} /></button>
              <select value={currency} onChange={e => setCurrency(e.target.value)} className="bg-white text-pink-600 border border-pink-200 text-sm font-bold px-3 py-1.5 rounded-xl outline-none shadow-sm cursor-pointer hover:bg-pink-50 transition-colors">
                {['JPY', 'KRW', 'TWD'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          {isCalcOpen && (
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0].map(n => (
                <button key={n} onClick={() => setPrice(p => p + n.toString())} className="h-12 bg-white border border-slate-200 rounded-2xl font-bold text-slate-700 shadow-sm active:scale-90 active:bg-slate-100 transition-transform text-base hover:shadow-md">{n}</button>
              ))}
              <button onClick={() => setPrice(p => p.slice(0, -1))} className="h-12 bg-slate-100 border border-slate-200 rounded-2xl font-bold text-slate-600 flex items-center justify-center active:scale-90 transition-transform hover:bg-slate-200"><Delete size={22} /></button>
            </div>
          )}
          {/* 有連動 */}
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">記帳並連動</p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => onConfirm(price || '0', currency, '共用錢包', date, currentMember?.id)} className="py-3.5 bg-pink-500 text-white rounded-2xl font-bold text-sm shadow-md active:scale-95 hover:bg-pink-600 transition-colors">計入共用錢包</button>
            <button onClick={() => setSelectedTarget(selectedTarget === '個人記帳' ? null : '個人記帳')}
              className={`py-3.5 rounded-2xl font-bold text-sm shadow-md active:scale-95 transition-colors ${selectedTarget === '個人記帳' ? 'bg-violet-700 text-white' : 'bg-violet-500 text-white hover:bg-violet-600'}`}>
              計入個人記帳 {selectedTarget === '個人記帳' ? '▲' : '▼'}
            </button>
          </div>
          {selectedTarget === '個人記帳' && (
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">誰付的錢</p>
                <div className="flex flex-wrap gap-2">
                  {(allMembers || []).map(m => (
                    <button key={m.id} type="button"
                      onClick={() => setPayerId(m.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${payerId === m.id ? 'bg-violet-500 text-white border-violet-500' : 'bg-white text-slate-500 border-slate-200 hover:bg-violet-50'}`}>
                      {m.id === currentMember?.id ? `${m.name}（我）` : m.name}
                    </button>
                  ))}
                </div>
                {payerId && payerId !== itemOwner && (
                  <p className="text-[10px] text-violet-500 font-bold mt-1.5">
                    ⚠️ {(allMembers || []).find(m => m.id === payerId)?.name || '我'} 幫 {(allMembers || []).find(m => m.id === itemOwner)?.name || '許願者'} 代墊
                  </p>
                )}
              </div>
              <button onClick={() => onConfirm(price || '0', currency, '個人記帳', date, payerId)}
                className="w-full py-3.5 bg-violet-600 text-white rounded-2xl font-bold text-sm shadow-md active:scale-95 hover:bg-violet-700 transition-colors">
                確認計入個人記帳
              </button>
            </div>
          )}
          {/* 純標記 */}
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">已記帳（純標記）</p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => onConfirm('0', currency, '已計入共用錢包', date, currentMember?.id)} className="py-3.5 bg-white text-pink-500 rounded-2xl font-bold text-sm border border-pink-200 active:scale-95 hover:bg-pink-50 transition-colors">✓ 已計入共用錢包</button>
            <button onClick={() => onConfirm('0', currency, '已計入個人記帳', date, currentMember?.id)} className="py-3.5 bg-white text-violet-500 rounded-2xl font-bold text-sm border border-violet-200 active:scale-95 hover:bg-violet-50 transition-colors">✓ 已計入個人記帳</button>
          </div>
          <button onClick={() => onConfirm('0', currency, '略過不記帳', date, currentMember?.id)} className="w-full py-3.5 bg-white text-slate-400 rounded-2xl font-bold text-sm border border-slate-200 active:scale-95 hover:bg-slate-50 transition-colors">略過不記帳</button>
        </div>
      </div>
    </div>
  );
};

// 🌟 在元件外部定義一個永遠不變的空陣列參考，徹底斷絕無窮渲染迴圈
const EMPTY_ARRAY = [];

// ─── 匯率 Hook ────────────────────────────────────────────────────────────────
const useExchangeRates = () => {
  const [rates, setRates] = useState({ KRW: 0.022, JPY: 0.22, TWD: 1 });
  const [updatedAt, setUpdatedAt] = useState('使用預設匯率');
  useEffect(() => {
    fetch('https://api.exchangerate-api.com/v4/latest/TWD')
      .then(r => r.json())
      .then(data => {
        if (data.rates) {
          setRates({
            KRW: parseFloat((1 / data.rates.KRW).toFixed(4)),
            JPY: parseFloat((1 / data.rates.JPY).toFixed(4)),
            TWD: 1,
          });
          setUpdatedAt('匯率剛剛更新');
        }
      })
      .catch(() => setUpdatedAt('使用預設匯率'));
  }, []);
  return { rates, updatedAt };
};

// ─── 債務簡化算法（按幣別分開）─────────────────────────────────────────────────
const simplifyDebtsByCurrency = (records, members) => {
  const currencies = ['JPY', 'KRW', 'TWD'];
  const allTransfers = []; // { from, to, amount, currency }

  currencies.forEach(cur => {
    const balance = {};
    members.forEach(m => { balance[m.id] = 0; });
    (records || []).filter(r => r.currency === cur && !r.isSettled).forEach(r => {
      balance[r.payerId] = (balance[r.payerId] || 0) + (Number(r.amount) || 0);
      balance[r.receiverId] = (balance[r.receiverId] || 0) - (Number(r.amount) || 0);
    });
    const creditors = [], debtors = [];
    Object.entries(balance).forEach(([id, amt]) => {
      if (amt > 0.5) creditors.push({ id, amt });
      else if (amt < -0.5) debtors.push({ id, amt: -amt });
    });
    creditors.sort((a, b) => b.amt - a.amt);
    debtors.sort((a, b) => b.amt - a.amt);
    const c = creditors.map(x => ({ ...x }));
    const d = debtors.map(x => ({ ...x }));
    let i = 0, j = 0;
    while (i < c.length && j < d.length) {
      const amount = Math.min(c[i].amt, d[j].amt);
      if (amount > 0.5) allTransfers.push({ from: d[j].id, to: c[i].id, amount: Math.round(amount), currency: cur });
      c[i].amt -= amount; d[j].amt -= amount;
      if (c[i].amt < 0.5) i++;
      if (d[j].amt < 0.5) j++;
    }
  });

  return allTransfers;
};

// 舊的保留給公費結算用（換算 TWD）
const simplifyDebts = (records, members, rates) => {
  const toTWD = (amount, currency) => Math.round(amount * (rates?.[currency] || 1));
  const balance = {};
  members.forEach(m => { balance[m.id] = 0; });
  (records || []).forEach(r => {
    const twd = toTWD(r.amount, r.currency);
    balance[r.payerId] = (balance[r.payerId] || 0) + twd;
    balance[r.receiverId] = (balance[r.receiverId] || 0) - twd;
  });
  const creditors = [], debtors = [];
  Object.entries(balance).forEach(([id, amt]) => {
    if (amt > 1) creditors.push({ id, amt });
    else if (amt < -1) debtors.push({ id, amt: -amt });
  });
  creditors.sort((a, b) => b.amt - a.amt);
  debtors.sort((a, b) => b.amt - a.amt);
  const transfers = [];
  const c = creditors.map(x => ({ ...x }));
  const d = debtors.map(x => ({ ...x }));
  let i = 0, j = 0;
  while (i < c.length && j < d.length) {
    const amount = Math.min(c[i].amt, d[j].amt);
    if (amount > 0) transfers.push({ from: d[j].id, to: c[i].id, amountTWD: amount });
    c[i].amt -= amount; d[j].amt -= amount;
    if (c[i].amt < 1) i++;
    if (d[j].amt < 1) j++;
  }
  return transfers;
};

// ─── 公費結算視窗元件 ─────────────────────────────────────────────────────────
const PoolSettlementView = ({ allMembers, memberBalance, totalIn, totalOut, balance, getMemberDetail, rates, toTWD, SYM, currencyConfig, onClose, onSettle, updatedAt }) => {
  const [expandedId, setExpandedId] = useState(null);
  // settledCurs: { [memberId]: Set of settled currencies }
  const [settledCurs, setSettledCurs] = useState({});

  const isCurSettled = (memberId, cur) => {
    try { return !!(settledCurs[memberId]?.has(cur)); } catch(e) { return false; }
  };

  const handleSettle = (m, cur, amt) => {
    // 寫回共用錢包
    onSettle(m, cur, amt);
    // 標記該幣別已結清
    setSettledCurs(prev => {
      const next = { ...prev };
      if (!next[m.id]) next[m.id] = new Set();
      else next[m.id] = new Set(next[m.id]);
      next[m.id].add(cur);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-[2.5rem] w-full max-w-md max-h-[88vh] overflow-y-auto no-scrollbar pb-10 shadow-2xl">
        <div className="sticky top-0 bg-white pt-5 px-6 pb-4 border-b border-slate-100 z-10">
          <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-800">公費結算</h3>
              <p className="text-[10px] text-slate-400 font-bold mt-0.5">1 KRW ≈ NT${rates.KRW}・1 JPY ≈ NT${rates.JPY}・<span className={updatedAt === '使用預設匯率' ? 'text-amber-400' : 'text-emerald-400'}>{updatedAt}</span></p>
            </div>
            <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-500"><X size={18} /></button>
          </div>
        </div>

        <div className="px-5 pt-4 space-y-5 pb-6">
          {/* 公費總覽 */}
          <section>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">💰 公費總覽</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {['JPY', 'KRW', 'TWD'].map(cur => {
                const c = currencyConfig[cur] || currencyConfig.TWD;
                const bal = balance[cur] || 0;
                return (
                  <div key={cur} className={`bg-white border-2 ${c.border} p-3 rounded-2xl text-center`}>
                    <p className={`text-[9px] font-black ${c.textLight} mb-1`}>{cur} 餘額</p>
                    <p className={`text-sm font-black ${bal >= 0 ? c.text : 'text-red-500'}`}>{bal >= 0 ? '+' : ''}{bal.toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
            <div className="bg-slate-50 rounded-2xl p-3 grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-black text-emerald-500 mb-1.5">總存入</p>
                {['KRW', 'JPY', 'TWD'].filter(cur => totalIn[cur] > 0).map(cur => (
                  <p key={cur} className="text-xs font-bold text-slate-700">{SYM[cur]}{totalIn[cur].toLocaleString()} {cur}</p>
                ))}
                {Object.values(totalIn).every(v => v === 0) && <p className="text-xs text-slate-400">尚無存入</p>}
              </div>
              <div>
                <p className="text-[10px] font-black text-red-500 mb-1.5">總支出</p>
                {['KRW', 'JPY', 'TWD'].filter(cur => totalOut[cur] > 0).map(cur => (
                  <p key={cur} className="text-xs font-bold text-slate-700">{SYM[cur]}{totalOut[cur].toLocaleString()} {cur}</p>
                ))}
                {Object.values(totalOut).every(v => v === 0) && <p className="text-xs text-slate-400">尚無支出</p>}
              </div>
            </div>
          </section>

          {/* 每人結算 */}
          <section>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">👤 每人結算</p>
            <div className="space-y-2">
              {(allMembers || []).map(m => {
                const bal = memberBalance[m.id] || {};
                const detail = getMemberDetail(m.id);
                const currencies = ['JPY', 'KRW', 'TWD'].filter(cur => bal[cur] !== 0);
                const allSettled = currencies.length > 0 && currencies.every(cur => isCurSettled(m.id, cur));

                // 明細按幣別分組
                const detailByCur = { JPY: [], KRW: [], TWD: [] };
                detail.forEach(d => { if (detailByCur[d.currency]) detailByCur[d.currency].push(d); });

                return (
                  <div key={m.id} className={`bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm transition-opacity ${allSettled ? 'opacity-50' : ''}`}>
                    {/* 頭部：名字 */}
                    <div className="px-4 pt-3.5 pb-2 flex items-center gap-3">
                      <Avatar member={m} className="w-8 h-8 rounded-xl text-sm shrink-0" />
                      <p className="text-sm font-black text-slate-800">{m.name}</p>
                      {allSettled && <span className="ml-auto text-[10px] font-black text-emerald-500">✓ 全部結清</span>}
                    </div>

                    {/* 每個幣別一個區塊 */}
                    {currencies.length === 0 && (
                      <div className="px-4 pb-3 text-[10px] text-slate-400">無異動</div>
                    )}
                    {currencies.map((cur, idx) => {
                      const amt = bal[cur];
                      const settled = isCurSettled(m.id, cur);
                      const isOwed = amt < 0;
                      const c = (currencyConfig || {})[cur] || (currencyConfig || {}).TWD || { bg: 'bg-slate-50', border: 'border-slate-200', badge: 'bg-slate-400', text: 'text-slate-600', textLight: 'text-slate-400' };
                      const curDetail = detailByCur[cur] || [];
                      const expandKey = `${m.id}-${cur}`;
                      const isCurExpanded = expandedId === expandKey;

                      return (
                        <div key={cur} className={`mx-3 mb-2 rounded-2xl border ${settled ? 'border-emerald-100 bg-emerald-50/50' : `${c.border} ${c.bg}`} overflow-hidden transition-all`}>
                          {/* 幣別列：金額 + 展開 + 結清 */}
                          <div className="flex items-center gap-2 px-3 py-2.5">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full text-white ${c.badge}`}>{cur}</span>
                            <span className={`text-sm font-black flex-1 ${settled ? 'text-emerald-400 line-through' : amt >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {amt >= 0 ? '+' : ''}{(SYM || {})[cur] || ''}{Math.abs(amt || 0).toLocaleString()}
                              <span className="text-[10px] text-slate-400 font-bold ml-1 no-underline" style={{textDecoration:'none'}}>≈ NT${toTWD ? toTWD(Math.abs(amt || 0), cur).toLocaleString() : ''}</span>
                            </span>
                            {curDetail.length > 0 && (
                              <button onClick={() => setExpandedId(isCurExpanded ? null : expandKey)}
                                className="text-[10px] font-black text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg hover:bg-white/60 transition-colors">
                                明細 {isCurExpanded ? '▲' : '▼'}
                              </button>
                            )}
                            <button
                              disabled={settled}
                              onClick={() => handleSettle(m, cur, Math.abs(amt))}
                              className={`text-[10px] font-black px-2.5 py-1 rounded-xl border transition-all active:scale-95
                                ${settled
                                  ? 'bg-emerald-100 text-emerald-400 border-emerald-100 cursor-default'
                                  : isOwed
                                    ? 'bg-red-500 text-white border-red-500 hover:bg-red-600'
                                    : 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600'
                                }`}>
                              {settled ? '✓ 結清' : isOwed ? '⬆︎ 補繳' : '⬇︎ 退回'}
                            </button>
                          </div>

                          {/* 該幣別明細 */}
                          {isCurExpanded && curDetail.length > 0 && (
                            <div className="border-t border-white/60 px-3 py-2 space-y-1.5 bg-white/40">
                              {curDetail.map((d, i) => (
                                <div key={i} className="flex items-center gap-2">
                                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${d.type === 'in' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                  <div className="flex-1 min-w-0">
                                    <span className="text-[11px] font-bold text-slate-600 truncate block">{d.name}</span>
                                    <span className="text-[10px] text-slate-400">{d.date}</span>
                                  </div>
                                  <span className={`text-[11px] font-black shrink-0 ${d.type === 'in' ? 'text-emerald-600' : 'text-red-500'}`}>
                                    {d.type === 'in' ? '+' : '-'}{SYM[cur]}{d.amount.toLocaleString()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div className="h-1" />
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

// ─── WalletTab ────────────────────────────────────────────────────────────────
const WalletTab = ({ onDownload }) => {
  const { allMembers, currentMember, sharedWallet, setSharedWallet, personalWallet, setPersonalWallet, allPersonalWallets, setAllPersonalWallets, splitRecords, setSplitRecords, walletDates, setWalletDates, shoppingList, setShoppingList } = useMember();
  const [viewMemberId, setViewMemberId] = useState(currentMember?.id || '');
  const [subTab, setSubTab] = useState('共用錢包');
  const [modal, setModal] = useState({ type: null, data: null });
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [dateConfirmDel, setDateConfirmDel] = useState(null);
  const [showSettlement, setShowSettlement] = useState(false);
  const [showPoolSettlement, setShowPoolSettlement] = useState(false);
  const [transferStates, setTransferStates] = useState({});
  const [walletError, setWalletError] = useState(null);
  const { rates, updatedAt } = useExchangeRates();
  const toTWD = useCallback((amount, currency) => Math.round(amount * (rates[currency] || 1)), [rates]);
  const SYM = { KRW: '₩', JPY: '¥', TWD: '$' };

  useEffect(() => {
    if (currentMember?.id) {
      setViewMemberId(currentMember.id);
    }
  }, [currentMember?.id]);

  // 個人記帳只顯示自己的帳（含別人寫進來的代墊記錄 isProxyRecord）
  const myPersonalWallet = useMemo(() => {
    return Array.isArray(personalWallet) ? personalWallet : [];
  }, [personalWallet]);

  const activeWallet = useMemo(() => {
    const w = subTab === '共用錢包' ? sharedWallet : myPersonalWallet;
    return Array.isArray(w) ? w : EMPTY_ARRAY;
  }, [subTab, sharedWallet, myPersonalWallet]);

  const setActiveWallet = subTab === '共用錢包' ? setSharedWallet : setPersonalWallet;

  const visibleWalletDates = useMemo(() => {
    if (!Array.isArray(activeWallet)) return EMPTY_ARRAY;
    return [...new Set(activeWallet.map(item => item?.date).filter(Boolean))].sort();
  }, [activeWallet]);

  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return `${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getDate().toString().padStart(2, '0')}`;
  });

  useEffect(() => {
    if (visibleWalletDates.length > 0 && !visibleWalletDates.includes(selectedDate)) {
      setSelectedDate(visibleWalletDates[visibleWalletDates.length - 1]);
    }
  }, [visibleWalletDates, selectedDate]);

  const walletTotals = useMemo(() => {
    const totals = { JPY: 0, KRW: 0, TWD: 0 };
    if (Array.isArray(activeWallet)) {
      activeWallet.forEach(item => {
        if (!item) return;
        // 個人記帳：排除代墊記錄（別人幫我代墊，不算我的現金流）
        if (subTab === '個人記帳' && item.isProxyRecord) return;
        const amt = Number(item.amount) || 0;
        if (totals[item.currency] !== undefined) {
          if (item.type === '存入') totals[item.currency] += amt; else totals[item.currency] -= amt;
        }
      });
    }
    return totals;
  }, [activeWallet, subTab]);

  const filteredWalletItems = useMemo(() => {
    if (!Array.isArray(activeWallet)) return EMPTY_ARRAY;
    const list = activeWallet.filter(i => i && i.date === selectedDate);
    const order = { JPY: 1, KRW: 2, TWD: 3 };
    return [...list].sort((a, b) => (order[a?.currency] || 9) - (order[b?.currency] || 9) || (a?.createdAt || 0) - (b?.createdAt || 0));
  }, [activeWallet, selectedDate]);

  const dailySum = useMemo(() => {
    const sum = { JPY: 0, KRW: 0, TWD: 0 };
    if (Array.isArray(filteredWalletItems)) {
      filteredWalletItems.forEach(item => {
        if (!item) return;
        // 個人記帳：排除代墊記錄
        if (subTab === '個人記帳' && item.isProxyRecord) return;
        const amt = Number(item.amount) || 0;
        if (sum[item.currency] !== undefined) {
          if (item.type === '存入') sum[item.currency] += amt; else sum[item.currency] -= amt;
        }
      });
    }
    return sum;
  }, [filteredWalletItems, subTab, currentMember?.id]);

  const handleDeleteWalletItem = (item) => {
    if (!item) return;
    setConfirmDel({ fn: () => {
      if (item.isProxyRecord) {
        // C 刪除自己的 proxy 記錄
        // 1. 刪掉自己的 proxy 卡片
        setActiveWallet(p => (Array.isArray(p) ? p : []).filter(w => w.id !== item.id));
        // 2. 找到這筆的 splitRecord，取得 C 應付的金額
        const myRecord = (Array.isArray(splitRecords) ? splitRecords : [])
          .find(r => r.walletItemId === item.walletItemId && r.receiverId === currentMember?.id);
        const myAmount = myRecord ? (Number(myRecord.amount) || 0) : 0;
        // 3. 標記 splitRecord 為 deletedByReceiver
        setSplitRecords(p => (Array.isArray(p) ? p : []).map(r =>
          r.walletItemId === item.walletItemId && r.receiverId === currentMember?.id
            ? { ...r, deletedByReceiver: true, isSettled: true, settledAt: Date.now() }
            : r
        ));
        // 4. 修改 A（付款者）的帳務記錄金額，扣掉 C 那份；若歸零則刪掉
        if (myAmount > 0 && item.walletItemId) {
          const payerId = item.editedById;
          setAllPersonalWallets(prev => {
            const next = { ...prev };
            if (next[payerId]) {
              next[payerId] = next[payerId].reduce((acc, w) => {
                if (w.id !== item.walletItemId) { acc.push(w); return acc; }
                const newAmt = Math.max(0, (Number(w.amount) || 0) - myAmount);
                if (newAmt > 0) acc.push({ ...w, amount: newAmt });
                // 金額歸零就不加入（相當於刪除）
                return acc;
              }, []);
            }
            return next;
          });
        }
        // 5. 如果原始帳務是來自購物清單，還原購物打勾
        const originalRecord = (Array.isArray(splitRecords) ? splitRecords : [])
          .find(r => r.walletItemId === item.walletItemId);
        if (originalRecord) {
          setShoppingList(p => (Array.isArray(p) ? p : []).map(s =>
            s.walletRecordId === item.walletItemId
              ? { ...s, isBought: false, completedById: null, boughtAt: null, boughtAtMs: null, price: null, currency: null, recordedIn: null, walletRecordId: null, payerId: null }
              : s
          ));
        }
      } else {
        // 正常刪除：連同 splitRecords 和 proxy 記錄一起刪
        setActiveWallet(p => (Array.isArray(p) ? p : []).filter(w => w.id !== item.id));
        setSplitRecords(p => (Array.isArray(p) ? p : []).filter(r => r.walletItemId !== item.id));
        setAllPersonalWallets(prev => {
          const next = { ...prev };
          Object.keys(next).forEach(memberId => {
            if (Array.isArray(next[memberId])) {
              next[memberId] = next[memberId].filter(w => w.walletItemId !== item.id);
            }
          });
          return next;
        });
        // 如果是結清卡片（isSettlement），把對方的配對卡片也刪掉，並還原 splitRecords
        if (item.isSettlement) {
          const pairedId = item.id % 2 === 0 ? item.id + 1 : item.id - 1;
          // 刪對方的配對卡片
          setAllPersonalWallets(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(memberId => {
              if (Array.isArray(next[memberId])) {
                next[memberId] = next[memberId].filter(w => w.id !== pairedId);
              }
            });
            return next;
          });
          // 還原相關的 splitRecords（用 settlementCardId 精確配對）
          const cardId = item.id;
          const pairedCardId2 = item.id % 2 === 0 ? item.id + 1 : item.id - 1;
          setSplitRecords(p => (Array.isArray(p) ? p : []).map(r => {
            if (r.isSettled && (r.settlementCardId === cardId || r.settlementCardId === pairedCardId2)) {
              return { ...r, isSettled: false, settledAt: null, settlementCardId: null };
            }
            return r;
          }));
        }
        // 刪帳務後，如果那天已無帳務，自動移除日期 Tab
        const itemDate = item.date;
        if (itemDate) {
          setTimeout(() => {
            setWalletDates(prev => {
              const remaining = (Array.isArray(activeWallet) ? activeWallet : []).filter(w => w.id !== item.id && w.date === itemDate);
              if (remaining.length === 0) {
                return (Array.isArray(prev) ? prev : []).filter(d => d !== itemDate);
              }
              return prev;
            });
          }, 200);
        }

        // 不管共用或個人，只要有連動購物清單就還原
        const itemId = String(item.id);
        const shoppingItemId = item.shoppingItemId || item.shoppingListItemId;
        setShoppingList(p => (Array.isArray(p) ? p : []).map(s => {
          const match1 = shoppingItemId && String(s.id) === String(shoppingItemId);
          const match2 = s.walletRecordId && String(s.walletRecordId) === itemId;
          if (match1 || match2) {
            return { ...s, isBought: false, completedById: null, boughtAt: null, boughtAtMs: null, price: null, currency: null, recordedIn: null, walletRecordId: null, payerId: null };
          }
          return s;
        }));
        // 共用錢包也要刪
        setSharedWallet(p => (Array.isArray(p) ? p : []).filter(w => w.id !== item.id));
        // 同時清掉相關的 splitRecords 和 proxy
        setSplitRecords(p => (Array.isArray(p) ? p : []).filter(r => r.walletItemId !== item.id));
        setAllPersonalWallets(prev => {
          const next = { ...prev };
          Object.keys(next).forEach(memberId => {
            if (Array.isArray(next[memberId])) {
              next[memberId] = next[memberId].filter(w => w.walletItemId !== item.id);
            }
          });
          return next;
        });
      }
    }});
  };

  const handleDeleteDate = (d) => {
    if (!d) return;
    // 陣列防護加強
    setDateConfirmDel({ fn: () => setActiveWallet(p => (Array.isArray(p) ? p : []).filter(w => w.date !== d)) });
  };

  const handleAddClick = () => {
    const mmdd = visibleWalletDates.includes(selectedDate) ? selectedDate : (visibleWalletDates[visibleWalletDates.length - 1] || `${(new Date().getMonth() + 1).toString().padStart(2, '0')}/${new Date().getDate().toString().padStart(2, '0')}`);
    const dateForInput = `2026-${mmdd.replace('/', '-')}`;
    const allMemberIds = (allMembers || []).map(m => m.id);
    setModal({
      type: 'add',
      data: {
        type: '支出',
        currency: 'JPY',
        date: dateForInput,
        splitMembers: [],
        splitIncludeSelf: true,
        selfAmount: '',
        sharedCustomAmts: {},
        contributorIds: subTab === '共用錢包' ? allMemberIds : [currentMember?.id],
        forMemberIds: subTab === '共用錢包' ? allMemberIds : [],
      }
    });
  };

  const downloadDataRef = React.useRef();
  downloadDataRef.current = { subTab, selectedDate, filteredWalletItems };

  useEffect(() => {
    if (typeof onDownload === 'function') {
      onDownload(() => () => {
        const currentData = downloadDataRef.current;
        if (!currentData || !currentData.filteredWalletItems) return;
        let text = `${currentData.subTab} - ${currentData.selectedDate}\n\n`;
        currentData.filteredWalletItems.forEach(i => { if (i) text += `[${i.type}] ${i.name} : ${i.currency} ${i.amount}\n`; if (i?.note) text += `備註: ${i.note}\n`; text += '--\n'; });
        downloadTextFile(text, `Wallet_${currentData.subTab}_${currentData.selectedDate.replace('/', '-')}`);
      });
    }
  }, [onDownload]);

  const currencyConfig = {
    JPY: { bg: 'bg-rose-50/70', border: 'border-rose-100', badge: 'bg-rose-500', sym: '¥', text: 'text-rose-600', textLight: 'text-rose-400' },
    KRW: { bg: 'bg-indigo-50/70', border: 'border-indigo-100', badge: 'bg-indigo-500', sym: '₩', text: 'text-indigo-600', textLight: 'text-indigo-400' },
    TWD: { bg: 'bg-emerald-50/70', border: 'border-emerald-100', badge: 'bg-emerald-500', sym: '$', text: 'text-emerald-600', textLight: 'text-emerald-400' },
  };

  return (
    <div className="relative pb-28">
      <div className="px-4 pt-5 mb-4">
        <div className="flex bg-violet-50/50 p-1.5 rounded-[2rem] border border-violet-100 mb-5">
          {['共用錢包', '個人記帳'].map(t => (
            <button key={t} type="button" onClick={() => setSubTab(t)} className={`flex-1 py-2.5 text-sm font-bold rounded-2xl transition-all ${subTab === t ? 'bg-violet-500 text-white shadow-md' : 'text-violet-400 hover:text-violet-600'}`}>{t}</button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {['JPY', 'KRW', 'TWD'].map(cur => {
            const c = currencyConfig[cur] || currencyConfig.TWD;
            const val = walletTotals[cur] || 0;
            return (
              <div key={cur} className={`bg-white border-2 ${c.border} p-4 rounded-3xl text-center shadow-sm hover:shadow-md transition-shadow`}>
                <p className={`text-[10px] font-black ${c.textLight} mb-1 uppercase tracking-widest`}>{cur}</p>
                <p className={`text-sm font-black ${c.text}`}>{val >= 0 ? '+' : ''}{val.toLocaleString()}</p>
              </div>
            );
          })}
        </div>

        {/* 應收應付（只在個人記帳顯示）*/}
        {subTab === '個人記帳' && (() => {
          const safeRecords = Array.isArray(splitRecords) ? splitRecords : [];
          const unsettled = safeRecords.filter(r => !r.isSettled);
          // 按幣別算應收應付
          const receivableByCur = {};
          const payableByCur = {};
          unsettled.forEach(r => {
            if (r.payerId === currentMember?.id) {
              receivableByCur[r.currency] = (receivableByCur[r.currency] || 0) + (Number(r.amount) || 0);
            } else if (r.receiverId === currentMember?.id) {
              payableByCur[r.currency] = (payableByCur[r.currency] || 0) + (Number(r.amount) || 0);
            }
          });
          const hasAny = Object.keys(receivableByCur).length > 0 || Object.keys(payableByCur).length > 0;
          if (!hasAny) return null;
          return (
            <div className="mb-4">
              <div className="bg-white border border-slate-100 rounded-2xl px-4 py-3 flex gap-4 shadow-sm items-start">
                {Object.keys(receivableByCur).length > 0 && (
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-emerald-500 mb-1.5">💰 應收</p>
                    {Object.entries(receivableByCur).map(([cur, amt]) => (
                      <div key={cur} className="text-xs font-bold text-emerald-700">
                        {SYM[cur]}{amt.toLocaleString()}
                        <span className="text-[10px] text-slate-400 ml-1">≈ NT${toTWD(amt, cur).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
                {Object.keys(payableByCur).length > 0 && (
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-red-500 mb-1.5">💸 應付</p>
                    {Object.entries(payableByCur).map(([cur, amt]) => (
                      <div key={cur} className="text-xs font-bold text-red-700">
                        {SYM[cur]}{amt.toLocaleString()}
                        <span className="text-[10px] text-slate-400 ml-1">≈ NT${toTWD(amt, cur).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => setShowSettlement(true)}
                  className="flex-shrink-0 w-9 h-9 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center hover:bg-amber-100 active:scale-90 transition-all shadow-sm"
                  title="查看結算明細">
                  <AlertTriangle size={18} className="text-amber-500" />
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      <div className="sticky top-0 z-30 px-4 pt-3 pb-3 bg-white/95 backdrop-blur-md border-y border-slate-100 mb-5 flex flex-col gap-3">
        {visibleWalletDates.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {visibleWalletDates.map(d => (
                <button key={d} type="button" onClick={() => setSelectedDate(d)} className={`flex-shrink-0 px-4 py-2 rounded-2xl text-xs font-bold transition-all border flex items-center gap-1.5 ${selectedDate === d ? 'bg-violet-5 text-violet-600 border-violet-200 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}>
                  {d}
                  <span onClick={e => { e.stopPropagation(); handleDeleteDate(d); }} className={`ml-1 transition-opacity ${selectedDate === d ? 'text-violet-400 hover:text-violet-600' : 'text-slate-300 hover:text-red-400'}`}><X size={14} /></span>
                </button>
              ))}
            </div>
            {subTab === '共用錢包' && (
              <button onClick={() => setShowPoolSettlement(true)}
                className="flex-shrink-0 w-9 h-9 bg-violet-50 hover:bg-violet-100 active:scale-90 border border-violet-200 rounded-2xl flex items-center justify-center transition-all shadow-sm"
                title="公費結算">
                <span className="text-lg leading-none">💰</span>
              </button>
            )}
          </div>
        )}
        <div className="flex gap-3 text-[10px] font-black uppercase tracking-widest bg-white py-2 px-4 rounded-full border border-slate-200 shadow-sm w-fit ml-auto">
          {Object.entries(dailySum || {}).map(([cur, val]) => (
            <span key={cur} className={val >= 0 ? 'text-red-500' : 'text-blue-500'}>{cur} {val > 0 ? '+' : ''}{(val || 0).toLocaleString()}</span>
          ))}
        </div>
      </div>

      <div className="space-y-3 px-4">
        {filteredWalletItems.map(item => {
          if (!item) return null;
          const c = currencyConfig[item.currency] || currencyConfig.TWD;
          const isIncome = item.type === '存入';
          const isSettlementCard = !!item.isSettlement;
          const isProxyCard = !!item.isProxyRecord;
          const editor = (allMembers || []).find(m => m && m.id === item.editedById) || { name: item.lastEdited || '成員' };
          const allMemberIds = (allMembers || []).map(m => m.id);

          const memberLabel = (() => {
            if (subTab !== '共用錢包') return null;
            if (isIncome) {
              const ids = item.contributorIds;
              if (!ids || ids.length === 0 || ids.length === allMemberIds.length) return null;
              const names = ids.map(id => (allMembers || []).find(m => m.id === id)?.name).filter(Boolean);
              return names.join('・') + ' 存入';
            } else {
              const ids = item.forMemberIds;
              if (!ids || ids.length === 0 || ids.length === allMemberIds.length) return null;
              const names = ids.map(id => (allMembers || []).find(m => m.id === id)?.name).filter(Boolean);
              return '幫 ' + names.join('・') + ' 代墊';
            }
          })();

          // 個人記帳：代墊標籤
          const splitLabel = (() => {
            if (subTab !== '個人記帳') return null;
            // 代墊記錄（別人幫我代墊）
            if (item.isProxyRecord) {
              const payerName = (allMembers || []).find(m => m.id === item.editedById)?.name || '某人';
              return `${payerName} 幫我代墊`;
            }
            // 我幫別人代墊
            const safeRecords = Array.isArray(splitRecords) ? splitRecords : [];
            const related = safeRecords.filter(r => String(r.walletItemId) === String(item.id) && r.payerId === currentMember?.id);
            if (related.length === 0) return null;
            // 分開顯示：有刪除的用刪除線，正常的正常顯示，並帶金額
            const SYM = { JPY: '¥', KRW: '₩', TWD: '$' };
            const activeEntries = related.filter(r => !r.deletedByReceiver).map(r => ({
              name: (allMembers || []).find(m => m.id === r.receiverId)?.name || '',
              amount: r.amount,
              currency: r.currency,
            })).filter(e => e.name);
            const deletedEntries = related.filter(r => r.deletedByReceiver).map(r => ({
              name: (allMembers || []).find(m => m.id === r.receiverId)?.name || '',
              amount: r.amount,
              currency: r.currency,
            })).filter(e => e.name);
            if (activeEntries.length === 0 && deletedEntries.length === 0) return null;
            return { activeEntries, deletedEntries };
          })();



          return (
            <div key={item.id} className={`relative p-4 rounded-2xl shadow-sm transition-shadow group ${isProxyCard ? 'bg-slate-100 border-slate-200' : `${c.bg} border ${c.border}`}`}>
              <div className="absolute top-3 right-3 flex gap-1.5 z-10 opacity-80 hover:opacity-100 transition-opacity">
                <>
                    <button type="button" onClick={() => {
                      const safeRecords = Array.isArray(splitRecords) ? splitRecords : [];
                      const related = safeRecords.filter(r => String(r.walletItemId) === String(item.id) && r.payerId === currentMember?.id);
                      const splitMembers = related.map(r => ({ id: r.receiverId, amount: '' }));
                      const splitIncludeSelf = related.length === 0 || (() => {
                        const totalAmt = Number(item.amount) || 0;
                        const othersSum = related.reduce((s, r) => s + (Number(r.amount) || 0), 0);
                        return othersSum < totalAmt;
                      })();
                      // 共用錢包預填 sharedCustomAmts
                      setModal({ type: 'edit', data: { ...item, splitMembers, splitIncludeSelf, sharedCustomAmts: {} } });
                    }} className="p-1.5 text-slate-500 bg-white hover:bg-slate-50 rounded-lg transition-colors border border-slate-200 shadow-sm"><Edit2 size={13} /></button>
                    <button type="button" onClick={() => handleDeleteWalletItem(item)} className="p-1.5 text-red-500 bg-white hover:bg-red-100 rounded-lg transition-colors border border-red-200 shadow-sm"><Trash2 size={13} /></button>
                  </>
              </div>
              
              <div className="pt-1 pr-14">
                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                  <span className={`${c.badge} text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm`}>{item.currency}</span>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border bg-white ${isIncome ? 'text-red-500 border-red-200' : 'text-blue-500 border-blue-200'}`}>{item.type}</span>
                  {memberLabel && <span className="text-[10px] font-bold text-slate-500">{memberLabel}</span>}
                  {isProxyCard && (
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">不計入總額</span>
                  )}
                  {splitLabel && (
                    typeof splitLabel === 'string'
                      ? <span className="text-[10px] font-bold text-violet-500 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded">{splitLabel}</span>
                      : <div className="mt-1 space-y-0.5">
                          {splitLabel.activeEntries.map((e, i) => (
                            <div key={i} className="flex items-center gap-1">
                              <span className="text-[10px] font-bold text-violet-500">幫 {e.name} 代墊</span>
                              <span className="text-[10px] text-violet-400">{e.currency === 'JPY' ? '¥' : e.currency === 'KRW' ? '₩' : '$'}{Number(e.amount).toLocaleString()}</span>
                            </div>
                          ))}
                          {splitLabel.deletedEntries.map((e, i) => (
                            <div key={i} className="flex items-center gap-1">
                              <span className="text-[10px] font-bold text-slate-400 line-through">幫 {e.name} 代墊</span>
                              <span className="text-[10px] text-slate-300 line-through">{e.currency === 'JPY' ? '¥' : e.currency === 'KRW' ? '₩' : '$'}{Number(e.amount).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                  )}
                </div>

                <h4 className="text-base font-bold text-slate-800 mb-1 leading-tight">{item.name}</h4>
                {item.note && <p className="text-xs text-slate-600 italic bg-white/70 border-l-4 border-violet-200 p-2 rounded-r-xl mb-1.5">{item.note}</p>}
                <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5 mt-2">
                  <Avatar member={editor} className="w-3.5 h-3.5 rounded-md" />
                  <span>{editor?.name || '未知'} 記帳</span>
                </div>
              </div>

              <div className="flex justify-end items-center gap-1.5 mt-2">
                <p className={`text-xl font-black tracking-tight ${isIncome ? 'text-red-500' : 'text-blue-500'}`}>{isIncome ? '+' : '-'}{item.currency === 'JPY' ? '¥' : item.currency === 'KRW' ? '₩' : '$'}{Number(item.amount || 0).toLocaleString()}</p>
                {isIncome ? <TrendingUp size={22} className="text-red-400 opacity-80" /> : <TrendingDown size={22} className="text-blue-300 opacity-80" />}
              </div>
            </div>
          );
        })}
        {filteredWalletItems.length === 0 && <div className="py-20 text-center text-slate-400 text-xs font-bold uppercase tracking-widest italic opacity-80">此日尚無帳目</div>}
      </div>

      <button type="button" onClick={handleAddClick} className="fixed bottom-[110px] right-6 w-16 h-16 bg-violet-500 text-white rounded-[2rem] shadow-lg flex items-center justify-center active:scale-90 z-[60] border-4 border-white hover:bg-violet-600 transition-colors"><Plus size={30} strokeWidth={3} /></button>

      <Modal isOpen={!!modal.type} onClose={() => { setModal({ type: null, data: null }); setIsCalcOpen(false); }} title={modal.data?.id ? '編輯帳目' : '新增帳目'}>
        <FormField label="項目名稱" value={modal.data?.name} onChange={v => setModal({ ...modal, data: { ...modal.data, name: v } })} placeholder="如：機票公費、晚餐代墊" />

        {/* 存入/支出 */}
        <div className="flex bg-slate-50 p-1.5 rounded-2xl mb-4 shrink-0 border border-slate-100">
          {['存入', '支出'].map(t => (
            <button key={t} type="button" onClick={() => setModal({ ...modal, data: { ...modal.data, type: t } })}
              className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${modal.data?.type === t ? (t === '存入' ? 'bg-red-500 text-white shadow-md' : 'bg-blue-500 text-white shadow-md') : 'text-slate-400 hover:text-slate-600'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* 日期 + 幣別 */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 block">日期</label>
            <input type="date" value={(() => {
              const d = modal.data?.date || '';
              if (!d) return '';
              if (d.includes('-') && d.startsWith('2')) return d; // yyyy-mm-dd
              if (d.includes('/')) {
                const parts = d.split('/');
                if (parts.length === 2) return `2026-${parts[0]}-${parts[1]}`; // mm/dd
                if (parts.length === 3) return `${parts[0]}-${parts[1]}-${parts[2]}`; // yyyy/mm/dd
              }
              return d;
            })()} onChange={e => setModal({ ...modal, data: { ...modal.data, date: e.target.value } })} className="w-full bg-white border border-slate-200 rounded-2xl h-12 px-3 font-bold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-violet-100 transition-all shadow-sm" />
          </div>
          <FormField label="幣別" type="select" options={['JPY', 'KRW', 'TWD']} value={modal.data?.currency} onChange={v => setModal({ ...modal, data: { ...modal.data, currency: v } })} />
        </div>

        {/* 金額 — 個人記帳（移到分攤前）*/}
        {subTab === '個人記帳' && (
          <>
            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex justify-between items-end mb-3">
              <div className="flex-1">
                <p className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">金額</p>
                <input type="text" value={modal.data?.amount || ''} onChange={e => setModal({ ...modal, data: { ...modal.data, amount: e.target.value } })} className="bg-transparent text-3xl font-black text-slate-700 outline-none w-full" placeholder="0" />
              </div>
              <button type="button" onClick={() => setIsCalcOpen(!isCalcOpen)} className="p-2.5 rounded-xl transition-colors shadow-sm border bg-white text-slate-500 border-slate-200 hover:bg-slate-50 active:scale-95"><Calculator size={24} /></button>
            </div>
            {isCalcOpen && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0].map(n => (
                  <button key={n} type="button" onClick={() => setModal({ ...modal, data: { ...modal.data, amount: (modal.data?.amount || '') + n.toString() } })} className="h-12 bg-white border border-slate-200 rounded-2xl font-bold text-slate-600 shadow-sm hover:bg-slate-50 active:bg-slate-100 text-base transition-colors">{n}</button>
                ))}
                <button type="button" onClick={() => setModal({ ...modal, data: { ...modal.data, amount: String(modal.data?.amount || '').slice(0, -1) } })} className="h-12 bg-slate-100 border border-slate-200 font-bold text-slate-600 flex items-center justify-center active:scale-90 hover:bg-slate-200 transition-colors"><Delete size={22} /></button>
              </div>
            )}
          </>
        )}

        {/* 分攤設定 — 個人記帳 */}
        {subTab === '個人記帳' && (
          <div className="mb-3 bg-violet-50 rounded-2xl p-3 border border-violet-100">
            <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest mb-2">👥 分攤成員（不選則為自己的帳）</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {(allMembers || []).map(m => {
                const splitMembers = modal.data?.splitMembers || [];
                const isSelf = m.id === currentMember?.id;
                const entry = splitMembers.find(s => s.id === m.id);
                const selfIncluded = modal.data?.splitIncludeSelf !== false;
                const selected = isSelf ? selfIncluded : !!entry;
                return (
                  <button key={m.id} type="button" onClick={() => {
                    if (isSelf) {
                      setModal({ ...modal, data: { ...modal.data, splitIncludeSelf: !selfIncluded } });
                    } else {
                      const cur = modal.data?.splitMembers || [];
                      const next = selected
                        ? cur.filter(s => s.id !== m.id)
                        : [...cur, { id: m.id, amount: '' }];
                      setModal({ ...modal, data: { ...modal.data, splitMembers: next } });
                    }
                  }} className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${selected ? 'bg-violet-500 text-white border-violet-500' : 'bg-white text-slate-500 border-slate-200 hover:bg-violet-50'}`}>
                    {m.name}{isSelf ? '（我）' : ''}
                  </button>
                );
              })}
            </div>
            {(modal.data?.splitMembers || []).length > 0 && Number(modal.data?.amount) > 0 && (() => {
              const splitMembers = modal.data?.splitMembers || [];
              const selfIncluded = modal.data?.splitIncludeSelf !== false;
              const totalAmt = Number(modal.data?.amount) || 0;
              const filledMembers = splitMembers.filter(m => m.amount !== '' && !isNaN(Number(m.amount)));
              const filledSum = filledMembers.reduce((s, m) => s + Number(m.amount), 0);
              const selfCustomAmt = Number(modal.data?.selfAmount) || 0;
              const selfHasCustom = modal.data?.selfAmount !== '' && modal.data?.selfAmount !== undefined && !isNaN(Number(modal.data?.selfAmount)) && modal.data?.selfAmount !== null;
              const unfilledOthers = splitMembers.filter(m => m.amount === '' || isNaN(Number(m.amount))).length;
              const filledSumWithSelf = filledSum + (selfHasCustom ? selfCustomAmt : 0);
              const unfilledCount = unfilledOthers + (selfIncluded && !selfHasCustom ? 1 : 0);
              const remaining = Math.max(0, totalAmt - filledSumWithSelf);
              const perUnfilled = unfilledCount > 0 ? Math.round((remaining / unfilledCount) * 10) / 10 : 0;
              const myAmt = selfIncluded ? (selfHasCustom ? selfCustomAmt : perUnfilled) : 0;
              const actualTotal = filledSumWithSelf + myAmt + unfilledOthers * perUnfilled;
              const isOver = actualTotal > totalAmt + 1;
              const isUnder = totalAmt > 0 && actualTotal < totalAmt - 1;
              return (
                <div className="space-y-2 mt-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">自訂金額（不填則平分剩餘）</p>
                  {selfIncluded && (
                    <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-violet-100">
                      <span className="text-xs font-black text-violet-600 flex-1">{(allMembers || []).find(m => m.id === currentMember?.id)?.name}（我）</span>
                      <input
                        type="number"
                        value={modal.data?.selfAmount || ''}
                        onChange={e => setModal({ ...modal, data: { ...modal.data, selfAmount: e.target.value } })}
                        placeholder="選填"
                        className="w-24 text-right text-xs font-bold text-violet-600 bg-transparent outline-none border-b border-violet-200 pb-0.5"
                      />
                      <span className="text-[10px] text-slate-400">{modal.data?.currency}</span>
                    </div>
                  )}
                  {splitMembers.map(entry => {
                    const member = (allMembers || []).find(m => m.id === entry.id);
                    if (!member) return null;
                    return (
                      <div key={entry.id} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-violet-100">
                        <span className="text-xs font-black text-slate-700 flex-1">{member.name}</span>
                        <input type="number" value={entry.amount}
                          onChange={e => {
                            const next = splitMembers.map(s => s.id === entry.id ? { ...s, amount: e.target.value } : s);
                            setModal({ ...modal, data: { ...modal.data, splitMembers: next } });
                          }}
                          placeholder="選填"
                          className="w-24 text-right text-xs font-bold text-violet-600 bg-transparent outline-none border-b border-violet-200 pb-0.5" />
                        <span className="text-[10px] text-slate-400">{modal.data?.currency}</span>
                      </div>
                    );
                  })}
                  <div className={`flex items-center justify-between px-3 py-2 rounded-xl border ${isOver || isUnder ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-100'}`}>
                    <span className="text-[10px] font-black text-slate-400">合計</span>
                    <span className={`text-xs font-black ${isOver || isUnder ? 'text-red-500' : 'text-emerald-600'}`}>
                      {modal.data?.currency} {actualTotal.toLocaleString()}{totalAmt > 0 && ` / ${totalAmt.toLocaleString()}`}
                      {isOver && ' ⚠️ 超過'}{isUnder && ' ⚠️ 未達'}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* 共用錢包金額 */}
        {subTab === '共用錢包' && (
          <>
            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex justify-between items-end mb-3">
              <div className="flex-1">
                <p className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">金額</p>
                <input type="text" value={modal.data?.amount || ''} onChange={e => setModal({ ...modal, data: { ...modal.data, amount: e.target.value } })} className="bg-transparent text-3xl font-black text-slate-700 outline-none w-full" placeholder="0" />
              </div>
              <button type="button" onClick={() => setIsCalcOpen(!isCalcOpen)} className="p-2.5 rounded-xl transition-colors shadow-sm border bg-white text-slate-500 border-slate-200 hover:bg-slate-50 active:scale-95"><Calculator size={24} /></button>
            </div>
            {isCalcOpen && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0].map(n => (
                  <button key={n} type="button" onClick={() => setModal({ ...modal, data: { ...modal.data, amount: (modal.data?.amount || '') + n.toString() } })} className="h-12 bg-white border border-slate-200 rounded-2xl font-bold text-slate-600 shadow-sm hover:bg-slate-50 active:bg-slate-100 text-base transition-colors">{n}</button>
                ))}
                <button type="button" onClick={() => setModal({ ...modal, data: { ...modal.data, amount: String(modal.data?.amount || '').slice(0, -1) } })} className="h-12 bg-slate-100 border border-slate-200 font-bold text-slate-600 flex items-center justify-center active:scale-90 hover:bg-slate-200 transition-colors"><Delete size={22} /></button>
              </div>
            )}
          </>
        )}

        {/* 共用錢包：選角色 + 自訂金額 */}
        {subTab === '共用錢包' && (() => {
          const isIn = modal.data?.type === '存入';
          const color = isIn ? 'red' : 'blue';
          const ids = isIn
            ? (modal.data?.contributorIds || (allMembers || []).map(x => x.id))
            : (modal.data?.forMemberIds || (allMembers || []).map(x => x.id));
          const customAmts = modal.data?.sharedCustomAmts || {};
          const totalAmt = Number(modal.data?.amount) || 0;
          const filledSum = ids.reduce((s, id) => s + (Number(customAmts[id]) || 0), 0);
          const unfilledIds = ids.filter(id => !customAmts[id]);
          const perUnfilled = unfilledIds.length > 0 ? Math.floor((totalAmt - filledSum) / unfilledIds.length) : 0;
          const actualTotal = ids.reduce((s, id) => s + (Number(customAmts[id]) || perUnfilled), 0);
          const isOver = actualTotal > totalAmt + 1;
          const isUnder = totalAmt > 0 && actualTotal < totalAmt - 1;
          return (
            <div className={`mb-3 bg-${color}-50 rounded-2xl p-3 border border-${color}-100`}>
              <p className={`text-[10px] font-black text-${color}-400 uppercase tracking-widest mb-2`}>👥 {isIn ? '存入角色' : '支出角色'}（預設全員）</p>
              <div className="flex flex-wrap gap-2 mb-2">
                {(allMembers || []).map(m => {
                  const selected = ids.includes(m.id);
                  return (
                    <button key={m.id} type="button" onClick={() => {
                      const cur = ids;
                      const next = selected ? cur.filter(id => id !== m.id) : [...cur, m.id];
                      if (next.length === 0) return;
                      const key = isIn ? 'contributorIds' : 'forMemberIds';
                      setModal({ ...modal, data: { ...modal.data, [key]: next } });
                    }} className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${selected ? `bg-${color}-500 text-white border-${color}-500` : 'bg-white text-slate-500 border-slate-200'}`}>
                      {m.id === currentMember?.id ? `${m.name}（我）` : m.name}
                    </button>
                  );
                })}
              </div>
              {ids.length > 0 && (
                <div className="space-y-2 mt-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">自訂金額（不填則平分）</p>
                  {ids.map(id => {
                    const member = (allMembers || []).find(m => m.id === id);
                    if (!member) return null;
                    return (
                      <div key={id} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-slate-100">
                        <span className="text-xs font-black text-slate-700 flex-1">{member.id === currentMember?.id ? `${member.name}（我）` : member.name}</span>
                        <input type="number" value={customAmts[id] || ''}
                          onChange={e => {
                            const next = { ...customAmts, [id]: e.target.value };
                            setModal({ ...modal, data: { ...modal.data, sharedCustomAmts: next } });
                          }}
                          placeholder="選填"
                          className={`w-24 text-right text-xs font-bold text-${color}-600 bg-transparent outline-none border-b border-${color}-200 pb-0.5`} />
                        <span className="text-[10px] text-slate-400">{modal.data?.currency}</span>
                      </div>
                    );
                  })}
                  <div className={`flex items-center justify-between px-3 py-2 rounded-xl border ${isOver || isUnder ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-100'}`}>
                    <span className="text-[10px] font-black text-slate-400">合計</span>
                    <span className={`text-xs font-black ${isOver || isUnder ? 'text-red-500' : 'text-emerald-600'}`}>
                      {modal.data?.currency} {actualTotal.toLocaleString()}{totalAmt > 0 && ` / ${totalAmt.toLocaleString()}`}
                      {isOver && ' ⚠️ 超過'}{isUnder && ' ⚠️ 未達'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
        <FormField label="備註（選填）" type="textarea" value={modal.data?.note} onChange={v => { setModal({ ...modal, data: { ...modal.data, note: v } }); setWalletError(null); }} placeholder="輸入心得或詳情" />

        {walletError && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-1">
            <span className="text-lg shrink-0">⚠️</span>
            <div className="flex-1">
              <p className="text-xs font-black text-red-600">水桶 {walletError.cur} 餘額不足</p>
              <p className="text-[11px] text-red-400 mt-0.5">目前餘額 {walletError.cur === 'JPY' ? '¥' : walletError.cur === 'KRW' ? '₩' : '$'}{walletError.available.toLocaleString()}，支出 {walletError.cur === 'JPY' ? '¥' : walletError.cur === 'KRW' ? '₩' : '$'}{walletError.requested.toLocaleString()}</p>
            </div>
            <button onClick={() => setWalletError(null)} className="text-red-300 hover:text-red-500 shrink-0"><X size={14} /></button>
          </div>
        )}
        <button type="button" onClick={() => {
          if (!modal.data?.amount || !modal.data?.date) {
            alert('請填寫金額和日期');
            return;
          }

          // ── 共用錢包支出：檢查餘額是否足夠（結算退款跳過）──
          if (subTab === '共用錢包' && modal.data?.type === '支出' && !modal.data?.isSettlement) {
            const cur = modal.data.currency;
            const amt = Number(modal.data.amount) || 0;
            const wallet = Array.isArray(sharedWallet) ? sharedWallet : [];
            const currentBalance = wallet.reduce((acc, w) => {
              if (w.currency !== cur) return acc;
              const a = Number(w.amount) || 0;
              return w.type === '存入' ? acc + a : acc - a;
            }, 0);
            // 編輯時要把原本那筆的金額加回來再比較
            const originalAmt = modal.data.id
              ? (() => {
                  const orig = wallet.find(w => w.id === modal.data.id);
                  return orig?.type === '支出' && orig?.currency === cur ? Number(orig.amount) || 0 : 0;
                })()
              : 0;
            const availableBalance = currentBalance + originalAmt;
            if (amt > availableBalance) {
              setWalletError({ cur, available: availableBalance, requested: amt }); return;
              return;
            }
          }

          const rawDate = modal.data?.date || '';
          const formattedDate = rawDate.includes('-') ? rawDate.split('-').slice(1).join('/') : rawDate;
          if (!formattedDate) { alert('請填寫日期'); return; }

          const allMemberIds = (allMembers || []).map(m => m.id);
          const rawData = {
            ...modal.data,
            date: formattedDate,
            editedById: currentMember?.id || '',
            createdAt: modal.data.createdAt || Date.now(),
            contributorIds: modal.data.type === '存入' ? (modal.data.contributorIds || allMemberIds) : undefined,
            forMemberIds: modal.data.type === '支出' ? (modal.data.forMemberIds || allMemberIds) : undefined,
          };
          const cleanData = Object.fromEntries(
            Object.entries(rawData)
              .filter(([k, v]) => v !== undefined && k !== 'splitMembers' && k !== 'splitIncludeSelf' && k !== 'selfAmount')
              .map(([k, v]) => [k, Array.isArray(v) ? v.filter(x => x !== undefined) : v])
          );
          // 保留 sharedCustomAmts
          if (modal.data.sharedCustomAmts && Object.keys(modal.data.sharedCustomAmts).length > 0) {
            cleanData.sharedCustomAmts = modal.data.sharedCustomAmts;
          }
          
          // 統一用同一個 id，確保 walletItemId 對得上
          const now = Date.now();
          const walletItemId = modal.data.id ? modal.data.id : now;
          // 共用錢包加上 sharedCustomAmts
          const finalData = subTab === '共用錢包' && modal.data.sharedCustomAmts
            ? { ...cleanData, sharedCustomAmts: modal.data.sharedCustomAmts }
            : cleanData;
          if (modal.data.id) setActiveWallet(p => (Array.isArray(p) ? p : []).map(w => w.id === modal.data.id ? finalData : w));
          else setActiveWallet(p => [...(Array.isArray(p) ? p : []), { ...finalData, id: walletItemId }]);

          // 新分攤邏輯：splitMembers 有人才產生記錄
          // 編輯時，如果所有相關 splitRecords 都已結清，跳過重建
          const existingRecords = (Array.isArray(splitRecords) ? splitRecords : [])
            .filter(r => String(r.walletItemId) === String(walletItemId));
          const allExistingSettled = existingRecords.length > 0 && existingRecords.every(r => r.isSettled);

          if ((modal.data.splitMembers || []).length > 0 && modal.data.amount && !allExistingSettled) {
            const splitMembers = modal.data.splitMembers;
            const selfIncluded = modal.data.splitIncludeSelf !== false;
            const totalAmt = Number(modal.data.amount) || 0;
            const selfAmtRaw = modal.data.selfAmount;
            const selfHasCustom = selfAmtRaw !== '' && selfAmtRaw !== undefined && selfAmtRaw !== null && !isNaN(Number(selfAmtRaw)) && Number(selfAmtRaw) > 0;
            const selfCustomAmt = selfHasCustom ? Number(selfAmtRaw) : 0;
            const filledSum = splitMembers.reduce((s, m) => s + (Number(m.amount) || 0), 0);
            const filledSumWithSelf = filledSum + (selfHasCustom ? selfCustomAmt : 0);
            const unfilledOthers = splitMembers.filter(m => !m.amount).length;
            const unfilledCount = unfilledOthers + (selfIncluded && !selfHasCustom ? 1 : 0);
            const remaining = Math.max(0, totalAmt - filledSumWithSelf);
            const perUnfilled = unfilledCount > 0 ? Math.round((remaining / unfilledCount) * 10) / 10 : 0;
            const myAmt = selfIncluded ? (selfHasCustom ? selfCustomAmt : perUnfilled) : 0;
            const savedItem = { ...cleanData, id: walletItemId };

            // 如果是編輯，先清除舊的未結清 splitRecords（已結清的保留）
            if (modal.data.id) {
              setSplitRecords(p => (Array.isArray(p) ? p : []).filter(r =>
                r.walletItemId !== modal.data.id || r.isSettled
              ));
              // 清除被分攤者 wallet 裡的舊代墊記錄
              setAllPersonalWallets(prev => {
                const next = { ...prev };
                splitMembers.forEach(entry => {
                  const memberId = entry.id;
                  if (next[memberId]) {
                    next[memberId] = next[memberId].filter(w => w.walletItemId !== modal.data.id);
                  }
                });
                return next;
              });
            }

            const newRecords = splitMembers.map((entry, idx) => {
              const memberAmt = Number(entry.amount) || perUnfilled;
              const memberAmtSafe = isNaN(memberAmt) ? 0 : memberAmt;
              return {
                id: now + idx + 100,
                walletItemId,
                payerId: currentMember?.id,
                receiverId: entry.id,
                amount: memberAmtSafe,
                currency: modal.data.currency || 'TWD',
                note: modal.data.name || '',
                createdAt: now,
                isSettled: false,
                settledAt: null,
              };
            });
            setSplitRecords(p => [...(Array.isArray(p) ? p : []), ...newRecords]);

            // 同時寫一筆代墊記錄進被分攤者的 wallet
            // 跳過已 deletedByReceiver 的人（他刪了不要再加回來）
            const deletedReceiverIds = new Set(
              (Array.isArray(splitRecords) ? splitRecords : [])
                .filter(r => String(r.walletItemId) === String(walletItemId) && r.deletedByReceiver)
                .map(r => r.receiverId)
            );
            setAllPersonalWallets(prev => {
              const next = { ...prev };
              splitMembers.forEach((entry, idx) => {
                const memberId = entry.id;
                if (deletedReceiverIds.has(memberId)) return;
                const memberAmt = Number(entry.amount) || perUnfilled || Math.round(totalAmt / count);
                const memberAmtSafe = isNaN(memberAmt) ? 0 : memberAmt;
                const proxyRecord = {
                  id: now + idx + 200,
                  walletItemId,
                  name: cleanData.name,
                  type: '支出',
                  amount: memberAmtSafe || memberAmt,
                  currency: cleanData.currency,
                  date: formattedDate,
                  note: cleanData.note || '',
                  editedById: currentMember?.id,
                  isProxyRecord: true,
                  createdAt: now,
                };
                const cur = next[memberId] || [];
                next[memberId] = [...cur, proxyRecord];
              });
              return next;
            });
          } else if (modal.data.id) {
            // 編輯時若清空分攤成員，也清除舊記錄
            setSplitRecords(p => (Array.isArray(p) ? p : []).filter(r => r.walletItemId !== modal.data.id));
          }

          // 自動加日期到 walletDates
          if (!(Array.isArray(walletDates) ? walletDates : []).includes(formattedDate)) {
            setWalletDates(prev => [...(Array.isArray(prev) ? prev : []), formattedDate].sort());
          }
          if (formattedDate) setSelectedDate(formattedDate);
          setModal({ type: null }); setIsCalcOpen(false);
        }} className="w-full bg-violet-500 text-white font-black py-4 rounded-2xl shadow-md mt-1 active:scale-95 text-base hover:bg-violet-600 transition-colors">確認儲存</button>
      </Modal>

      {/* ── 公費結算彈跳視窗 ── */}
      {showPoolSettlement ? (() => {
        try {
        const wallet = Array.isArray(sharedWallet) ? sharedWallet : [];
        const allMemberIds = (allMembers || []).map(m => m.id);
        const memberCount = allMemberIds.length || 1;

        // 每人餘額計算（依幣別）
        const memberBalance = {};
        (allMembers || []).forEach(m => { memberBalance[m.id] = { KRW: 0, JPY: 0, TWD: 0 }; });

        // 存入：依 contributorIds 分配，若有 sharedCustomAmts 用自訂金額
        wallet.filter(w => w.type === '存入').forEach(w => {
          const ids = (w.contributorIds || allMemberIds).filter(Boolean);
          const customAmts = w.sharedCustomAmts || {};
          const totalAmt = Number(w.amount) || 0;
          const filledSum = ids.reduce((s, id) => s + (Number(customAmts[id]) || 0), 0);
          const unfilledIds = ids.filter(id => !customAmts[id]);
          const perUnfilled = unfilledIds.length > 0 ? Math.floor((totalAmt - filledSum) / unfilledIds.length) : 0;
          const unfilledIdxList = ids.map((id, i) => !customAmts[id] ? i : -1).filter(i => i >= 0);
          const rotateIdx = unfilledIdxList.length > 0
            ? unfilledIdxList[Math.abs((Number(w.id) || 0) % unfilledIdxList.length)]
            : -1;
          let distributed = filledSum;
          let unfilledDistributed = 0;
          ids.forEach((id, idx) => {
            if (!memberBalance[id]) return;
            let amt = Number(customAmts[id]) || perUnfilled;
            if (!customAmts[id]) {
              if (idx === rotateIdx) {
                amt = totalAmt - distributed - (unfilledIdxList.length - 1) * perUnfilled + unfilledDistributed;
              }
              unfilledDistributed += perUnfilled;
            }
            distributed += Number(customAmts[id]) ? amt : 0;
            memberBalance[id][w.currency] += amt;
          });
        });

        // 支出：依 forMemberIds 分配，若有 sharedCustomAmts 用自訂金額
        wallet.filter(w => w.type === '支出').forEach(w => {
          const ids = (w.forMemberIds || allMemberIds).filter(Boolean);
          const customAmts = w.sharedCustomAmts || {};
          const totalAmt = Number(w.amount) || 0;
          const filledSum = ids.reduce((s, id) => s + (Number(customAmts[id]) || 0), 0);
          const unfilledIds = ids.filter(id => !customAmts[id]);
          const perUnfilled = unfilledIds.length > 0 ? Math.floor((totalAmt - filledSum) / unfilledIds.length) : 0;
          const unfilledIdxList2 = ids.map((id, i) => !customAmts[id] ? i : -1).filter(i => i >= 0);
          const rotateIdx2 = unfilledIdxList2.length > 0
            ? unfilledIdxList2[Math.abs((Number(w.id) || 0) % unfilledIdxList2.length)]
            : -1;
          let distributed2 = filledSum;
          let unfilledDistributed2 = 0;
          ids.forEach((id, idx) => {
            if (!memberBalance[id]) return;
            let amt = Number(customAmts[id]) || perUnfilled;
            if (!customAmts[id]) {
              if (idx === rotateIdx2) {
                amt = totalAmt - distributed2 - (unfilledIdxList2.length - 1) * perUnfilled + unfilledDistributed2;
              }
              unfilledDistributed2 += perUnfilled;
            }
            distributed2 += Number(customAmts[id]) ? amt : 0;
            memberBalance[id][w.currency] -= amt;
          });
        });

        // 總覽
        const totalIn = { KRW: 0, JPY: 0, TWD: 0 };
        const totalOut = { KRW: 0, JPY: 0, TWD: 0 };
        wallet.forEach(w => {
          const amt = Number(w.amount) || 0;
          if (w.type === '存入') totalIn[w.currency] += amt;
          else totalOut[w.currency] += amt;
        });
        const balance = { KRW: totalIn.KRW - totalOut.KRW, JPY: totalIn.JPY - totalOut.JPY, TWD: totalIn.TWD - totalOut.TWD };

        // 每人明細
        const getMemberDetail = (memberId) => {
          const lines = [];
          wallet.forEach(w => {
            if (w.type === '存入') {
              const ids = (w.contributorIds || allMemberIds).filter(Boolean);
              if (!ids.includes(memberId)) return;
              const perAmount = Math.round((Number(w.amount) || 0) / ids.length);
              lines.push({ type: 'in', name: w.name, date: w.date, currency: w.currency, amount: perAmount, createdAt: w.createdAt || 0 });
            } else {
              const ids = (w.forMemberIds || allMemberIds).filter(Boolean);
              if (!ids.includes(memberId)) return;
              const perAmount = Math.round((Number(w.amount) || 0) / ids.length);
              lines.push({ type: 'out', name: w.name, date: w.date, currency: w.currency, amount: perAmount, createdAt: w.createdAt || 0 });
            }
          });
          // 按日期 + createdAt 排序（舊到新）
          return lines.sort((a, b) => {
            if (a.date < b.date) return -1;
            if (a.date > b.date) return 1;
            return a.createdAt - b.createdAt;
          });
        };

        const handlePoolSettle = (m, cur, amt) => {
          const now = new Date();
          const dateStr = `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}`;
          const bal = memberBalance[m.id]?.[cur] || 0;
          const isOwed = bal < 0; // 該成員欠水桶 → 補繳（存入水桶）
          const record = {
            id: Date.now(),
            name: isOwed ? `公費結算補繳（${m.name}）` : `公費結算退款（${m.name}）`,
            type: isOwed ? '存入' : '支出',
            amount: amt,
            currency: cur,
            date: dateStr,
            contributorIds: isOwed ? [m.id] : (allMembers || []).map(x => x.id),
            forMemberIds: isOwed ? (allMembers || []).map(x => x.id) : [m.id],
            note: '公費結算自動記錄',
            editedById: currentMember?.id || '',
            createdAt: Date.now(),
            isSettlement: true,
          };
          setSharedWallet(p => [...(Array.isArray(p) ? p : []), record]);
        };

        return (
          <PoolSettlementView
            allMembers={allMembers}
            memberBalance={memberBalance}
            totalIn={totalIn}
            totalOut={totalOut}
            balance={balance}
            getMemberDetail={getMemberDetail}
            rates={rates}
            toTWD={toTWD}
            SYM={SYM}
            currencyConfig={currencyConfig}
            onClose={() => setShowPoolSettlement(false)}
            onSettle={handlePoolSettle}
            updatedAt={updatedAt}
          />
        );
        } catch(e) {
          console.error('PoolSettlement error:', e);
          return (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-8 bg-slate-900/50">
              <div className="bg-white rounded-3xl p-6 text-center">
                <p className="text-red-500 font-bold mb-2">載入失敗</p>
                <p className="text-xs text-slate-400 mb-4">{e.message}</p>
                <button onClick={() => setShowPoolSettlement(false)} className="px-4 py-2 bg-slate-100 rounded-xl text-sm font-bold">關閉</button>
              </div>
            </div>
          );
        }
      })() : null}

      {/* ── 全員代墊結算彈跳視窗 ── */}
      {showSettlement ? (() => {
        const safeRecords = Array.isArray(splitRecords) ? splitRecords : [];
        const memberMap = {};
        (allMembers || []).forEach(m => { memberMap[m.id] = m; });
        const today = new Date();
        const todayStr = `${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getDate().toString().padStart(2, '0')}`;

        // 所有未結清記錄
        const unsettledRecords = safeRecords.filter(r => !r.isSettled);

        // 簡化結算：全員
        const allTransfers = simplifyDebtsByCurrency(safeRecords, allMembers || []);

        // 單筆結清
        const settleRecord = (r) => {
          const now = Date.now();
          const iAmPayer = r.payerId === currentMember?.id;
          const otherMemberId = iAmPayer ? r.receiverId : r.payerId;
          const otherMemberName = memberMap[otherMemberId]?.name || '';
          // 寫進自己的帳
          setPersonalWallet(p => [...(Array.isArray(p) ? p : []), {
            id: now,
            name: iAmPayer ? `收回款項（${otherMemberName}）` : `還款（${otherMemberName}）`,
            type: iAmPayer ? '存入' : '支出',
            currency: r.currency,
            amount: r.amount,
            date: todayStr,
            createdAt: now,
            editedById: currentMember?.id,
            isSettlement: true,
          }]);
          // 寫進對方的帳
          setAllPersonalWallets(prev => {
            const cur = prev[otherMemberId] || [];
            return {
              ...prev,
              [otherMemberId]: [...cur, {
                id: now + 1,
                name: iAmPayer ? `還款（${memberMap[currentMember?.id]?.name}）` : `收回款項（${memberMap[currentMember?.id]?.name}）`,
                type: iAmPayer ? '支出' : '存入',
                currency: r.currency,
                amount: r.amount,
                date: todayStr,
                createdAt: now,
                editedById: currentMember?.id,
                isSettlement: true,
              }],
            };
          });
          setSplitRecords(p => (Array.isArray(p) ? p : []).map(x =>
            x.id === r.id ? { ...x, isSettled: true, settledAt: now, settlementCardId: now } : x
          ));
        };

        // 簡化結算結清：雙方都寫卡片
        const settleFinal = (t) => {
          const now = Date.now();
          const iAmCreditor = t.to === currentMember?.id;
          const otherMemberId = iAmCreditor ? t.from : t.to;
          const otherName = memberMap[otherMemberId]?.name || '';
          const myName = memberMap[currentMember?.id]?.name || '';
          // 寫進自己的帳
          setPersonalWallet(p => [...(Array.isArray(p) ? p : []), {
            id: now,
            name: iAmCreditor ? `收回款項（${otherName}）` : `還款（${otherName}）`,
            type: iAmCreditor ? '存入' : '支出',
            currency: t.currency,
            amount: t.amount,
            date: todayStr,
            createdAt: now,
            editedById: currentMember?.id,
            isSettlement: true,
          }]);
          // 寫進對方的帳
          setAllPersonalWallets(prev => {
            const cur = prev[otherMemberId] || [];
            return {
              ...prev,
              [otherMemberId]: [...cur, {
                id: now + 1,
                name: iAmCreditor ? `還款（${myName}）` : `收回款項（${myName}）`,
                type: iAmCreditor ? '支出' : '存入',
                currency: t.currency,
                amount: t.amount,
                date: todayStr,
                createdAt: now,
                editedById: currentMember?.id,
                isSettlement: true,
              }],
            };
          });
          // 把這筆幣別下跟雙方有關的未結清記錄全部標記結清
          setSplitRecords(p => (Array.isArray(p) ? p : []).map(x => {
            const related = !x.isSettled && x.currency === t.currency &&
              ((x.payerId === t.from && x.receiverId === t.to) ||
               (x.payerId === t.to && x.receiverId === t.from));
            return related ? { ...x, isSettled: true, settledAt: now, settlementCardId: now } : x;
          }));
        };

        return (
          <div className="fixed inset-0 z-[300] flex items-end justify-center">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowSettlement(false)} />
            <div className="relative bg-white rounded-t-[2.5rem] w-full max-w-md max-h-[88vh] overflow-y-auto no-scrollbar pb-10 shadow-2xl">
              <div className="sticky top-0 bg-white pt-5 px-6 pb-4 border-b border-slate-100 z-10">
                <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black text-slate-800">分攤結算</h3>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">1 KRW ≈ NT${rates.KRW}・1 JPY ≈ NT${rates.JPY}・<span className={updatedAt === '使用預設匯率' ? 'text-amber-400' : 'text-emerald-400'}>{updatedAt}</span></p>
                  </div>
                  <button onClick={() => setShowSettlement(false)} className="p-2 bg-slate-100 rounded-full text-slate-500"><X size={18} /></button>
                </div>
              </div>

              <div className="px-5 pt-4 space-y-5 pb-6">

                {/* 上：最終結算（全員）*/}
                <section>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">⚖️ 最終結算</p>
                  {allTransfers.length === 0 ? (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-6 text-center">
                      <div className="text-2xl mb-2">🎉</div>
                      <p className="text-sm font-black text-emerald-600">全部結清了！</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {allTransfers.map((t, idx) => {
                        const fromMember = memberMap[t.from];
                        const toMember = memberMap[t.to];
                        if (!fromMember || !toMember) return null;
                        const iAmFrom = t.from === currentMember?.id;
                        const iAmTo = t.to === currentMember?.id;
                        const iAmInvolved = iAmFrom || iAmTo;
                        return (
                          <div key={idx} className={`flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-sm ${iAmTo ? 'bg-emerald-50 border-emerald-100' : iAmFrom ? 'bg-red-50 border-red-100' : 'bg-white border-slate-100'}`}>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Avatar member={fromMember} className="w-7 h-7 rounded-xl text-xs" />
                              <span className="text-[10px] text-slate-300">→</span>
                              <Avatar member={toMember} className="w-7 h-7 rounded-xl text-xs" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-black text-slate-700">
                                {iAmFrom ? '我' : fromMember.name} 還 {iAmTo ? '我' : toMember.name}
                              </p>
                              <p className={`text-sm font-black ${iAmTo ? 'text-emerald-600' : iAmFrom ? 'text-red-500' : 'text-slate-600'}`}>
                                {SYM[t.currency]}{t.amount.toLocaleString()} {t.currency}
                              </p>
                              <p className="text-[10px] text-slate-400">≈ NT${toTWD(t.amount, t.currency).toLocaleString()}</p>
                            </div>
                            {iAmInvolved && (
                              <button onClick={() => settleFinal(t)}
                                className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-black border active:scale-95 transition-all
                                  ${iAmTo ? 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600' : 'bg-red-500 text-white border-red-500 hover:bg-red-600'}`}>
                                {iAmTo ? '收款' : '還款'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                <div className="border-t border-slate-100" />

                {/* 下：明細（全員）*/}
                <section>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">📋 明細</p>
                  {unsettledRecords.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">沒有未結清的分攤記錄</p>
                  ) : (
                    <div className="space-y-2">
                      {unsettledRecords.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).map(r => {
                        const payer = memberMap[r.payerId];
                        const receiver = memberMap[r.receiverId];
                        if (!payer || !receiver) return null;
                        const iAmPayer = r.payerId === currentMember?.id;
                        const iAmReceiver = r.receiverId === currentMember?.id;
                        const iAmInvolved = iAmPayer || iAmReceiver;
                        return (
                          <div key={r.id} className={`bg-white border rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm ${iAmPayer ? 'border-emerald-100' : iAmReceiver ? 'border-red-100' : 'border-slate-100'}`}>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Avatar member={payer} className="w-6 h-6 rounded-lg text-xs" />
                              <span className="text-[10px] text-slate-300">→</span>
                              <Avatar member={receiver} className="w-6 h-6 rounded-lg text-xs" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-black text-slate-700 truncate">{r.note || '分攤'}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {iAmPayer ? `${receiver.name} 欠我` : iAmReceiver ? `我欠 ${payer.name}` : `${receiver.name} 欠 ${payer.name}`}
                                ・{SYM[r.currency]}{r.amount.toLocaleString()}
                              </p>
                            </div>
                            {iAmInvolved && (
                              <button onClick={() => settleRecord(r)}
                                className={`flex-shrink-0 px-2.5 py-1.5 rounded-xl text-[10px] font-black border active:scale-95 transition-all
                                  ${iAmPayer ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'}`}>
                                {iAmPayer ? '收款' : '還款'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            </div>
          </div>
        );
      })() : null}

      <ConfirmDialog isOpen={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={() => { confirmDel?.fn(); setConfirmDel(null); }} />
      <ConfirmDialog isOpen={!!dateConfirmDel} onClose={() => setDateConfirmDel(null)} onConfirm={() => { dateConfirmDel?.fn(); setDateConfirmDel(null); }} title="確認刪除日期與帳目" message="此操作將會刪除該日期頁籤，並且清空底下所有的帳務紀錄，確定要刪除嗎？" />
    </div>
  );
};

// ─── ListTab ──────────────────────────────────────────────────────────────────
const ListTab = ({ onDownload }) => {
  const { allMembers, currentMember, sharedTodos, setSharedTodos } = useMember();
  const [subTab, setSubTab] = useState('共用清單');
  const [viewMemberId, setViewMemberId] = useState(currentMember.id);
  const [modal, setModal] = useState({ type: null, data: null });
  const [confirmDel, setConfirmDel] = useState(null);

  useEffect(() => { if (subTab === '個人清單') setViewMemberId(currentMember.id); }, [subTab, currentMember.id]);

  const sortedTodos = useMemo(() => {
    const targetList = sharedTodos.filter(t => t && (subTab === '共用清單' ? t.type === '共用' : (t.type === '個人' && t.ownerId === viewMemberId)));
    return [...targetList.filter(t => !t.status).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)), ...targetList.filter(t => t.status).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))];
  }, [sharedTodos, subTab, viewMemberId]);

  const isOwner = subTab === '共用清單' || viewMemberId === currentMember.id;

  useEffect(() => {
    onDownload(() => () => {
      let text = `${subTab}\n\n`;
      sortedTodos.forEach(i => { if (i) text += `[${i.status ? 'V' : ' '}] ${i.content}\n`; if (i?.note) text += `備註: ${i.note}\n`; text += '--\n'; });
      downloadTextFile(text, `List_${subTab}`);
    });
  }, [sortedTodos, subTab, onDownload]);

  const handleToggle = (todo) => {
    if (!isOwner || !todo) return;
    const now = new Date();
    const ts = `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
    setSharedTodos(p => p.map(it => it.id === todo.id ? { ...it, status: !it.status, completedById: !it.status ? currentMember.id : null, completedAt: !it.status ? ts : null } : it));
  };

  return (
    <div className="relative animate-in fade-in pb-28">
      <div className="sticky top-0 z-30 px-4 pt-3 pb-3 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm flex flex-col gap-3">
        <div className="flex bg-emerald-50/50 p-1.5 rounded-[2rem] border border-emerald-100 mx-1">
          {['共用清單', '個人清單'].map(t => (
            <button key={t} onClick={() => setSubTab(t)} className={`flex-1 py-2.5 text-sm font-bold rounded-2xl transition-all ${subTab === t ? 'bg-emerald-500 text-white shadow-md' : 'text-emerald-500 hover:text-emerald-600'}`}>{t}</button>
          ))}
        </div>
        {subTab === '個人清單' && (
          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar px-2 pt-3 pb-3">
            {[...allMembers].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).map(m => (
              <button key={m.id} onClick={() => setViewMemberId(m.id)} className={`flex-shrink-0 flex flex-col items-center gap-1.5 transition-all ${viewMemberId === m.id ? 'scale-105' : 'opacity-50 grayscale hover:grayscale-0 hover:opacity-80'}`}>
                <Avatar member={m} className={`w-12 h-12 shadow-sm ${viewMemberId === m.id ? 'ring-2 ring-offset-2 ring-emerald-400' : ''}`} />
                <span className={`text-[10px] font-bold uppercase tracking-widest ${viewMemberId === m.id ? 'text-emerald-600' : 'text-slate-500'}`}>{m.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4 mt-5 px-4">
        {sortedTodos.map(todo => {
          if (!todo) return null;
          const editor = allMembers.find(m => m.id === todo.editedById) || { name: todo.lastEdited || '成員' };
          const completer = allMembers.find(m => m.id === todo.completedById) || { name: todo.completedBy || '成員' };

          return (
            <div key={todo.id} className={`relative bg-white border border-slate-100 p-5 rounded-[2rem] shadow-sm hover:shadow-md transition-shadow group animate-in slide-in-from-bottom-2 ${todo.status ? 'opacity-60 bg-slate-50/80' : ''}`}>
              {isOwner && (
                <div className="absolute top-4 right-4 flex gap-2 z-10 opacity-80 hover:opacity-100 transition-opacity">
                  <button onClick={() => setModal({ type: 'todo', data: todo })} className="p-2 text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors border border-slate-100"><Edit2 size={14} /></button>
                  <button onClick={() => setConfirmDel({ fn: () => setSharedTodos(p => p.filter(t => t.id !== todo.id)) })} className="p-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-xl transition-colors border border-red-100"><Trash2 size={14} /></button>
                </div>
              )}
              <div className="flex items-start gap-4">
                <button onClick={() => handleToggle(todo)} className={`w-8 h-8 rounded-xl flex items-center justify-center border-2 transition-colors shrink-0 ${todo.status ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                  {todo.status && <Check size={18} strokeWidth={4} />}
                </button>
                <div className="flex-1 pr-16">
                  <h4 className={`text-base font-bold text-slate-800 leading-tight pt-0.5 ${todo.status ? 'line-through text-slate-400' : ''}`}>{todo.content}</h4>
                  {todo.note && <p className="text-sm text-slate-600 italic bg-slate-50 border-l-4 border-emerald-200 p-3 rounded-r-2xl mt-3 whitespace-pre-wrap">{todo.note}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100 flex items-center gap-1.5">
                      <Avatar member={editor} className="w-3.5 h-3.5 rounded-md" />
                      <span>{editor.name} 編輯</span>
                    </span>
                    {todo.status && (
                      <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100 flex items-center gap-1.5">
                        <Avatar member={completer} className="w-3.5 h-3.5 rounded-md" />
                        <span>{completer.name} 搞定于 {todo.completedAt}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {sortedTodos.length === 0 && <div className="py-24 text-center text-slate-400 text-xs font-bold uppercase tracking-widest italic opacity-80">尚無項目</div>}
      </div>

      {isOwner && <button onClick={() => setModal({ type: 'todo', data: {} })} className="fixed bottom-[110px] right-6 w-16 h-16 bg-emerald-500 text-white rounded-[2rem] shadow-lg flex items-center justify-center active:scale-90 z-[60] border-4 border-white hover:bg-emerald-600 transition-colors"><Plus size={30} strokeWidth={3} /></button>}

      <Modal isOpen={!!modal.type} onClose={() => setModal({ type: null, data: null })} title={modal.data?.id ? '編輯清單' : '新增項目'}>
        <FormField label="內容" value={modal.data?.content} onChange={v => setModal({ ...modal, data: { ...modal.data, content: v } })} />
        <FormField label="備註（選填）" type="textarea" value={modal.data?.note} onChange={v => setModal({ ...modal, data: { ...modal.data, note: v } })} />
        <button onClick={() => {
          if (!modal.data.content) return;
          const final = { ...modal.data, type: subTab === '共用清單' ? '共用' : '個人', ownerId: currentMember.id, editedById: currentMember.id, status: modal.data.status || false, createdAt: modal.data.createdAt || Date.now() };
          if (modal.data.id) setSharedTodos(p => p.map(it => it.id === modal.data.id ? final : it));
          else setSharedTodos(p => [...p, { ...final, id: Date.now() }]);
          setModal({ type: null });
        }} className="w-full bg-emerald-500 text-white font-black py-4 rounded-2xl shadow-md mt-2 active:scale-95 text-base hover:bg-emerald-600 transition-colors">確認儲存</button>
      </Modal>
      <ConfirmDialog isOpen={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={() => confirmDel?.fn()} />
    </div>
  );
};

// ─── NotesTab ─────────────────────────────────────────────────────────────────
const NotesTab = ({ onDownload }) => {
  const { currentMember, sharedNotes, setSharedNotes, personalNotes, setPersonalNotes, allMembers } = useMember();
  const [subTab, setSubTab] = useState('共用記事');
  const [modal, setModal] = useState({ type: null, data: null });
  const [tempPhoto, setTempPhoto] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  
  const [viewerPhotos, setViewerPhotos] = useState(null);

  const activeNotes = subTab === '共用記事' ? sharedNotes : personalNotes;
  const setActiveNotes = subTab === '共用記事' ? setSharedNotes : setPersonalNotes;

  const sortedNotes = useMemo(() => {
    if (!Array.isArray(activeNotes)) return EMPTY_ARRAY;
    return [...activeNotes].filter(Boolean).sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  }, [activeNotes]);

  useEffect(() => {
    onDownload(() => () => {
      let text = `${subTab}\n\n`;
      sortedNotes.forEach(i => { if (i) text += `[${i.date}] ${i.content}\n--\n`; });
      downloadTextFile(text, `Notes_${subTab}`);
    });
  }, [sortedNotes, subTab, onDownload]);

  return (
    <div className="relative animate-in fade-in pb-28 px-4 pt-5">
      <div className="sticky top-0 z-30 pt-1 pb-4 bg-slate-50/95 backdrop-blur-md">
        <div className="flex bg-indigo-50/50 p-1.5 rounded-[2rem] border border-indigo-100 mx-1">
          {['共用記事', '個人記事'].map(t => (
            <button key={t} onClick={() => setSubTab(t)} className={`flex-1 py-2.5 text-sm font-bold rounded-2xl transition-all ${subTab === t ? 'bg-indigo-500 text-white shadow-md' : 'text-indigo-400 hover:text-indigo-600'}`}>{t}</button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {sortedNotes.map(note => {
          if (!note) return null;
          const editor = allMembers.find(m => m.id === note.editedById) || { name: note.lastEdited || '成員' };

          return (
            <div key={note.id} className="relative bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm hover:shadow-md transition-shadow group animate-in slide-in-from-bottom-2">
              <div className="absolute top-4 right-4 flex gap-2 z-10 opacity-80 hover:opacity-100 transition-opacity">
                <button onClick={() => { setModal({ type: 'text', data: note }); setTempPhoto(note.photo || null); }} className="p-2 text-indigo-500 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors border border-indigo-100"><Edit2 size={14} /></button>
                <button onClick={() => setConfirmDel({ fn: () => setActiveNotes(p => p.filter(n => n.id !== note.id)) })} className="p-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-xl transition-colors border border-red-100"><Trash2 size={14} /></button>
              </div>
              {note.photo && <img src={note.photo} onClick={() => setViewerPhotos([note.photo])} alt="note" className="w-full h-48 object-cover rounded-[1.5rem] mb-4 shadow-sm border border-slate-100 cursor-pointer hover:opacity-90 transition-opacity" />}
              {note.content && <p className="text-slate-700 whitespace-pre-wrap leading-relaxed text-sm pr-16">{note.content}</p>}
              <div className="mt-4 pt-3 border-t border-slate-50 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span>{note.date}</span>
                <div className="flex items-center gap-1.5">
                  <Avatar member={editor} className="w-3.5 h-3.5 rounded-md" />
                  <span>由 {editor.name} 編輯</span>
                </div>
              </div>
            </div>
          );
        })}
        {sortedNotes.length === 0 && <div className="py-24 text-center text-slate-400 text-xs font-bold uppercase tracking-widest italic opacity-80">尚無記事</div>}
      </div>

      <div className="fixed bottom-[110px] right-6 flex flex-col gap-3 z-[60]">
        <button onClick={() => { setModal({ type: 'text', data: {} }); setTempPhoto(null); }} className="w-16 h-16 bg-indigo-500 text-white rounded-[2rem] shadow-lg flex items-center justify-center active:scale-90 border-4 border-white hover:bg-indigo-600 transition-colors"><FileText size={28} /></button>
        <button onClick={() => document.getElementById('note-photo-up').click()} className="w-16 h-16 bg-indigo-400 text-white rounded-[2rem] shadow-lg flex items-center justify-center active:scale-90 border-4 border-white hover:bg-indigo-500 transition-colors"><Camera size={28} /></button>
      </div>

      <input type="file" id="note-photo-up" className="hidden" accept="image/*" onChange={e => {
        const file = e.target.files[0];
        if (file) { const r = new FileReader(); r.onloadend = async () => { const compressed = await compressImageBase64(r.result); setTempPhoto(compressed); setModal({ type: 'text', data: {} }); }; r.readAsDataURL(file); }
      }} />

      <Modal isOpen={!!modal.type} onClose={() => setModal({ type: null, data: null })} title="編輯記事">
        {tempPhoto && (
          <div className="relative w-full h-40 rounded-2xl overflow-hidden mb-4 shrink-0 border border-slate-100 shadow-sm">
            <img src={tempPhoto} className="w-full h-full object-cover" alt="tmp" />
            <button onClick={() => setTempPhoto(null)} className="absolute top-2 right-2 p-2 bg-red-500/90 text-white rounded-xl backdrop-blur-sm"><X size={16} /></button>
          </div>
        )}
        <textarea value={modal.data?.content || ''} onChange={e => setModal({ ...modal, data: { ...modal.data, content: e.target.value } })} placeholder="輸入你想記錄的心情或備忘錄..." className="w-full bg-white border border-slate-200 rounded-2xl p-5 font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none resize-none min-h-[150px] shrink-0 text-base shadow-sm transition-all" />
        <button onClick={() => {
          if (!modal.data.content && !tempPhoto) return;
          const now = new Date();
          const ts = `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
          const final = { ...modal.data, content: modal.data.content || '', photo: tempPhoto, date: modal.data.date || ts, editedById: currentMember.id, createdAtMs: modal.data.createdAtMs || now.getTime() };
          if (modal.data.id) setActiveNotes(p => p.map(n => n.id === modal.data.id ? final : n));
          else setActiveNotes(p => [{ ...final, id: Date.now() }, ...p]);
          setModal({ type: null });
        }} className="w-full bg-indigo-500 text-white font-black py-4 rounded-2xl shadow-md mt-4 active:scale-95 shrink-0 text-base hover:bg-indigo-600 transition-colors">確認儲存</button>
      </Modal>
      <ConfirmDialog isOpen={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={() => confirmDel?.fn()} />
      <PhotoViewerModal isOpen={!!viewerPhotos} onClose={() => setViewerPhotos(null)} photos={viewerPhotos} />
    </div>
  );
};

// ─── InitScreen / AuthScreen ──────────────────────────────────────────────────
const InitScreen = () => {
  const { createInitialAdmin, initName, setInitName } = useMember();
  return (
    <div className="h-screen max-w-md mx-auto flex flex-col justify-center px-8 bg-slate-50">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-black text-slate-800 tracking-tighter mb-2">旅遊小助理</h1>
        <p className="text-sm font-bold text-slate-400 tracking-widest uppercase">系統初始化設定</p>
      </div>
      <div className="bg-white p-8 rounded-[2.5rem] shadow-lg border border-slate-100">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block text-center">請輸入第一位管理者名稱</label>
        <input type="text" value={initName} onChange={e => setInitName(e.target.value)} placeholder="您的名稱" className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 mb-6 text-base transition-all" />
        <button onClick={createInitialAdmin} disabled={!initName.trim()} className="w-full bg-blue-500 text-white font-black py-4 rounded-2xl shadow-md active:scale-95 disabled:bg-slate-200 text-base hover:bg-blue-600 transition-colors">建立管理者</button>
      </div>
    </div>
  );
};

const AuthScreen = () => {
  const { login, allMembers } = useMember();
  return (
    <div className="h-screen max-w-md mx-auto flex flex-col justify-center px-8 bg-slate-50">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-black text-slate-800 tracking-tighter mb-2">旅遊小助理</h1>
        <p className="text-sm font-bold text-slate-400 tracking-widest uppercase">選擇您的身分進入</p>
      </div>
      <div className="space-y-3">
        {Array.isArray(allMembers) && [...allMembers].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).map(m => {
          if (!m) return null;
          return (
            <button key={m.id} onClick={() => login(m)} className="w-full bg-white border border-slate-100 p-4 rounded-[2rem] shadow-sm hover:shadow-md flex items-center gap-5 active:scale-95 transition-all text-left group">
              <Avatar member={m} className="w-14 h-14 shadow-sm" />
              <div className="flex-1">
                <h3 className="text-lg font-black text-slate-800">{m.name}</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{m.role}</p>
              </div>
              <ChevronRight size={24} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ─── MainLayout ───────────────────────────────────────────────────────────────
const MainLayout = () => {
  const { currentMember, logout, allMembers, setAllMembers, updateMember } = useMember();
  const [activeTab, setActiveTab] = useState('home');
  const [foodHighlightId, setFoodHighlightId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const downloadTriggerRef = useRef(null);
  const setDownloadTrigger = useCallback((fn) => {
    if (typeof fn === 'function') {
      const inner = fn();
      downloadTriggerRef.current = typeof inner === 'function' ? inner : fn;
    } else { downloadTriggerRef.current = fn; }
  }, []);
  const [editName, setEditName] = useState(currentMember?.name || '');
  const [editPhoto, setEditPhoto] = useState(currentMember?.photo || null);
  const [newMemberName, setNewMemberName] = useState('');
  const [confirmDelMember, setConfirmDelMember] = useState(null);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const tabs = [
    { id: 'trip', label: '行程', icon: Map, color: 'text-blue-500', activeBg: 'bg-blue-500' },
    { id: 'food', label: '美食', icon: Utensils, color: 'text-orange-500', activeBg: 'bg-orange-500' },
    { id: 'shopping', label: '購物', icon: ShoppingBag, color: 'text-pink-500', activeBg: 'bg-pink-500' },
    { id: 'home', label: '首頁', icon: Home, color: 'text-slate-800', activeBg: 'bg-blue-500' },
    { id: 'list', label: '清單', icon: CheckCircle2, color: 'text-emerald-500', activeBg: 'bg-emerald-500' },
    { id: 'wallet', label: '記帳', icon: Wallet, color: 'text-violet-500', activeBg: 'bg-violet-500' },
    { id: 'notes', label: '記事', icon: FileText, color: 'text-indigo-500', activeBg: 'bg-indigo-500' },
  ];

  const handleAddMember = () => {
    if (!newMemberName.trim()) return;
    const color = ['#3b82f6', '#0ea5e9', '#6366f1', '#db2777', '#10b981', '#f59e0b'][Math.floor(Math.random() * 6)];
    setAllMembers(p => [...p, { id: Date.now().toString(), name: newMemberName.trim(), role: '成員', avatarColor: color, photo: null, createdAt: Date.now() }]);
    setNewMemberName('');
  };

  const handleProfileSave = () => {
    updateMember({ name: editName, photo: editPhoto });
    setShowProfileEdit(false);
  };

  return (
    <div className="h-screen max-w-md mx-auto relative flex flex-col font-sans shadow-2xl border-x border-slate-200 overflow-hidden bg-slate-50">
      <header className="px-5 pt-5 pb-4 flex items-center justify-between bg-white/95 backdrop-blur-md shrink-0 z-40 border-b border-slate-100 shadow-sm relative">
        <button onClick={() => { setEditName(currentMember?.name || ''); setEditPhoto(currentMember?.photo || null); setShowProfileEdit(true); }} className="flex items-center gap-2.5 active:scale-90 transition-transform bg-slate-50 py-1.5 pl-1.5 pr-4 rounded-full border border-slate-100 hover:bg-slate-100">
          <Avatar member={currentMember} className="w-9 h-9 shadow-sm" />
          <span className="text-sm font-black text-slate-700 max-w-[80px] truncate tracking-wide">{currentMember?.name}</span>
        </button>

        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
          <h1 className="text-lg font-black text-slate-800 tracking-wider whitespace-nowrap">旅遊小助理</h1>
          {activeTab !== 'home' && (
            <button onClick={() => downloadTriggerRef.current && downloadTriggerRef.current()} className="p-1 text-slate-400 hover:text-blue-500 active:scale-90 transition-colors">
              <Download size={20} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSettings(true)} className="p-1.5 text-slate-400 hover:text-slate-700 active:scale-90 transition-colors"><Settings size={24} /></button>
          <button onClick={() => setConfirmLogout(true)} className="p-1.5 text-slate-400 hover:text-red-500 active:scale-90 transition-colors"><LogOut size={24} /></button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto relative no-scrollbar bg-slate-50">
        {activeTab === 'home' && <HomePage onNavigate={setActiveTab} />}
        {activeTab === 'trip' && <TripPage onDownload={setDownloadTrigger} onNavigateToFood={(id) => { setFoodHighlightId(id); setActiveTab('food'); }} />}
        {activeTab === 'food' && <FoodPage onDownload={setDownloadTrigger} highlightId={foodHighlightId} onClearHighlight={() => setFoodHighlightId(null)} />}
        {activeTab === 'shopping' && <ShoppingPage onDownload={setDownloadTrigger} />}
        {activeTab === 'list' && <ListTab onDownload={setDownloadTrigger} />}
        {activeTab === 'wallet' && <WalletTab onDownload={setDownloadTrigger} />}
        {activeTab === 'notes' && <NotesTab onDownload={setDownloadTrigger} />}
      </div>

      <nav className="bg-white border-t border-slate-100 px-2 pb-6 pt-3 flex justify-between items-end shrink-0 z-50 rounded-t-[2rem] shadow-[0_-4px_25px_rgba(0,0,0,0.03)] relative">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          if (tab.id === 'home') {
            return (
              <button key={tab.id} onClick={() => setActiveTab('home')} className="relative -top-5 transform transition-transform active:scale-95 px-1">
                <div className={`w-[70px] h-[70px] rounded-[2rem] flex items-center justify-center transition-all duration-300 shadow-lg ${isActive ? 'bg-blue-500 text-white scale-105 shadow-blue-200' : 'bg-white border border-slate-100 text-slate-400 hover:text-blue-400 shadow-slate-100'}`}>
                  <Icon size={30} strokeWidth={isActive ? 2.5 : 2} />
                </div>
              </button>
            );
          }
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center justify-center flex-1 transition-all duration-300 ${isActive ? tab.color : 'text-slate-300 hover:text-slate-400'}`}>
              <div className={`p-2.5 rounded-2xl transition-all ${isActive ? 'bg-slate-50' : ''}`}>
                <Icon size={26} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`text-[10px] font-bold mt-0.5 ${isActive ? 'opacity-100' : 'opacity-0'}`}>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Profile Edit */}
      <Modal isOpen={showProfileEdit} onClose={() => setShowProfileEdit(false)} title="編輯個人檔案">
        <div className="flex flex-col items-center mb-6">
          <div className="relative group cursor-pointer mb-4" onClick={() => document.getElementById('profile-photo-up').click()}>
            <Avatar member={{ ...currentMember, photo: editPhoto, name: editName || currentMember?.name }} className="w-24 h-24 text-4xl shadow-md" />
            <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity backdrop-blur-sm">
              <Camera size={30} className="text-white" />
            </div>
          </div>
          <input type="file" id="profile-photo-up" className="hidden" accept="image/*" onChange={e => {
            const file = e.target.files[0];
            if (file) { const r = new FileReader(); r.onloadend = async () => { const compressed = await compressImageBase64(r.result, 200, 200); setEditPhoto(compressed); }; r.readAsDataURL(file); }
          }} />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">點擊更換頭像</p>
        </div>
        <FormField label="顯示名稱" value={editName} onChange={setEditName} />
        <button onClick={handleProfileSave} className="w-full bg-blue-500 text-white font-black py-4 rounded-2xl shadow-md mt-2 active:scale-95 text-base hover:bg-blue-600 transition-colors">儲存變更</button>
      </Modal>

      {/* Settings */}
      <Modal isOpen={showSettings} onClose={() => setShowSettings(false)} title="使用者管理">
        <div className="space-y-2 mb-5">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">成員清單（依建立時間）</label>
          {Array.isArray(allMembers) && [...allMembers].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).map(m => {
            if (!m) return null;
            return (
              <div key={m.id} className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <Avatar member={m} className="w-10 h-10 text-sm shadow-sm" />
                  <span className="text-sm font-bold text-slate-700">{m.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black px-2.5 py-1.5 rounded-md uppercase tracking-wider ${m.role === '管理員' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}>{m.role}</span>
                  {currentMember?.role === '管理員' && m.id !== currentMember.id && (
                    <button onClick={() => setConfirmDelMember({ fn: () => setAllMembers(p => p.filter(x => x.id !== m.id)), name: m.name })} className="p-2 text-red-500 bg-red-50 rounded-xl active:scale-90 hover:bg-red-100 transition-colors"><Trash2 size={14} /></button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {currentMember?.role === '管理員' && (
          <div className="bg-blue-50/50 p-4 rounded-3xl border border-blue-100 shadow-sm">
            <label className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-2 block">新增同行成員</label>
            <div className="flex gap-2">
              <input type="text" value={newMemberName} onChange={e => setNewMemberName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddMember()} placeholder="輸入新成員名稱" className="flex-1 bg-white border border-slate-200 rounded-xl px-4 font-bold text-slate-700 outline-none shadow-sm text-sm h-12 focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all" />
              <button onClick={handleAddMember} disabled={!newMemberName.trim()} className="w-12 h-12 bg-blue-500 text-white rounded-xl flex items-center justify-center disabled:bg-blue-200 active:scale-95 shadow-md hover:bg-blue-600 transition-colors"><Plus size={22} strokeWidth={3} /></button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog isOpen={!!confirmDelMember} onClose={() => setConfirmDelMember(null)} onConfirm={() => confirmDelMember?.fn()} title={`刪除成員 ${confirmDelMember?.name}`} message="確定要將此成員從團隊中移除嗎？" />
      <ConfirmDialog isOpen={confirmLogout} onClose={() => setConfirmLogout(false)} onConfirm={logout} title="確認登出" message="確定要登出目前的帳號嗎？" confirmText="確認登出" />
    </div>
  );
};

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLoadingTimeout(true), 12000);
    return () => clearTimeout(t);
  }, []);

  return (
    <MemberProvider>
      <MemberContext.Consumer>
        {({ allMembers, currentMember, isMembersLoading }) => {
          if (isMembersLoading) {
            return (
              <div className="h-screen max-w-md mx-auto flex flex-col justify-center items-center bg-slate-50 p-8">
                <div className="w-64 relative flex items-center justify-center mb-8 py-4">
                  <div className="absolute left-0 right-0 h-0 border-t-2 border-dashed border-blue-200 animate-pulse" />
                  <div className="bg-slate-50 px-4 z-10 animate-bounce" style={{ animationDuration: '2.5s' }}>
                    <Plane size={38} className="text-blue-500 -rotate-12 transform" />
                  </div>
                </div>
                {loadingTimeout ? (
                  <div className="text-center">
                    <p className="text-xs font-black text-red-400 tracking-widest uppercase mb-2">
                      連線逾時，請檢查網路
                    </p>
                    <button
                      onClick={() => window.location.reload()}
                      className="text-xs font-bold text-blue-500 underline underline-offset-2"
                    >
                      點此重新整理
                    </button>
                  </div>
                ) : (
                  <p className="text-xs font-black text-slate-400 tracking-widest uppercase animate-pulse">
                    航班準備中，正在導航至雲端...
                  </p>
                )}
              </div>
            );
          }
          if (!allMembers || allMembers.length === 0) return <InitScreen />;
          if (!currentMember) return <AuthScreen />;
          return <MainLayout />;
        }}
      </MemberContext.Consumer>
    </MemberProvider>
  );
}