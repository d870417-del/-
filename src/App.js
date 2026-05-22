import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Map, Utensils, ShoppingBag, Home, Users, User, Settings,
  Plane, Clock, Wallet, MapPin, Calendar, LogOut,
  ChevronRight, ChevronLeft, Plus, Edit2, Trash2, X, Check, Navigation, Camera, Delete, Calculator, CheckCircle2, UserCircle2, TrendingUp, TrendingDown, History, Download, FileText, AlertTriangle, List
} from 'lucide-react';

// 🌟 引入遠端雲端資料庫設定
import { db } from './firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

const IS_DEV = false; // 🔧 測試時改 true，上線時改 false
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
      setDoc(docRef, { value: next }).catch(err => console.error("雲端儲存失敗:", err));
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
    personalWallet, setPersonalWallet, allPersonalWallets, personalNotes, setPersonalNotes,
    foodOptions, setFoodOptions,
    shopOptions, setShopOptions,
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
          <button onClick={() => { onConfirm(); onClose(); }} className="flex-1 py-3 bg-red-500 text-white font-bold rounded-2xl active:scale-95 shadow-md shadow-red-100 text-sm hover:bg-red-600 transition-colors">{confirmText}</button>
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
const TripPage = ({ onDownload }) => {
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
                      {item.mapUrl && <a href={item.mapUrl} target="_blank" rel="noreferrer" className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex flex-col items-center justify-center hover:bg-blue-100 active:scale-90 border border-blue-100 shrink-0 transition-colors">
                        <Navigation size={20} />
                        <span className="text-[10px] font-bold mt-0.5">MAP</span>
                      </a>}
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
const FoodPage = ({ onDownload }) => {
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
        let text = `🍜 美食清單 (${selectedCity}${selectedDistricts.length ? ' / ' + selectedDistricts.join('、') : ''} / ${selectedFoodType})\n${'='.repeat(50)}\n\n`;
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
              <div key={item.id} className="bg-white border border-slate-100 rounded-[2rem] p-5 shadow-sm hover:shadow-md transition-all">
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
                setModal(prev => ({ ...prev, data: { ...prev.data, city: customCity.trim(), districts: [] } }));
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
                setModal(prev => {
                  const cur = prev.data?.districts || [];
                  return { ...prev, data: { ...prev.data, districts: cur.includes(d) ? cur : [...cur, d] } };
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
                setModal(prev => ({ ...prev, data: { ...prev.data, foodType: customFoodType.trim() } }));
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
  const { allMembers, currentMember, shoppingList, setShoppingList, sharedWallet, setSharedWallet, personalWallet, setPersonalWallet, walletDates, setWalletDates, shopOptions, setShopOptions } = useMember();

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
          if (item.recordedIn === '共用錢包') setSharedWallet(p => p.filter(w => w.id !== item.walletRecordId));
          else if (item.recordedIn === '個人記帳') setPersonalWallet(p => p.filter(w => w.id !== item.walletRecordId));
        }
        setShoppingList(p => p.filter(s => s.id !== item.id));
      }
    });
  };

  const handleConfirmBought = (price, currency, target) => {
    const now = new Date();
    const dateStr = `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}`;
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    let walletRecordId = null;
    if (!walletDates.includes(dateStr)) setWalletDates(prev => [...prev, dateStr].sort());
    if (target !== '略過不記帳' && price && price !== '0') {
      walletRecordId = Date.now();
      const record = { id: walletRecordId, name: `購買: ${boughtModal.name}`, type: '支出', amount: price, currency, date: dateStr, note: boughtModal.note || '自購物清單連動', editedById: currentMember?.id || '', shoppingItemId: boughtModal.id, createdAt: Date.now() };
      if (target === '共用錢包') setSharedWallet(p => [...p, record]);
      else if (target === '個人記帳') setPersonalWallet(p => [...p, record]);
    }
    setShoppingList(p => p.map(s => s.id === boughtModal.id ? { ...s, isBought: true, boughtAt: `${dateStr} ${timeStr}`, boughtAtMs: now.getTime(), completedById: currentMember?.id || '', price: target === '略過不記帳' ? null : price, currency: target === '略過不記帳' ? null : currency, recordedIn: target === '略過不記帳' ? null : target, walletRecordId } : s));
    setBoughtModal(null);
  };

  const handleUncheckBought = (item) => {
    setConfirmDel({
      fn: () => {
        if (item.walletRecordId) {
          if (item.recordedIn === '共用錢包') setSharedWallet(p => p.filter(w => w.id !== item.walletRecordId));
          else if (item.recordedIn === '個人記帳') setPersonalWallet(p => p.filter(w => w.id !== item.walletRecordId));
        }
        setShoppingList(p => p.map(s => s.id === item.id ? { ...s, isBought: false, completedById: null, boughtAt: null, boughtAtMs: null, price: null, currency: null, recordedIn: null, walletRecordId: null } : s));
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

        {/* 第一排：許願者下拉 + 地圖切換 */}
        <div className="px-4 pt-3 pb-2 flex items-center gap-3">
          <select value={selectedMemberId} onChange={e => setSelectedMemberId(e.target.value)}
            className={`flex-1 text-xs font-black rounded-xl px-3 py-2.5 appearance-none border outline-none transition-all ${selectedMemberId !== 'all' ? 'bg-pink-500 text-white border-pink-500' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>
            <option value="all" className="bg-white text-slate-800">全員</option>
            {[...allMembers].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).map(m => (
              <option key={m.id} value={m.id} className="bg-white text-slate-800">
                {m.id === currentMember?.id ? `${m.name}（我）` : m.name}
              </option>
            ))}
          </select>
          <div className="flex bg-white rounded-xl p-1 border border-slate-100 shadow-sm shrink-0">
            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-pink-100 text-pink-500' : 'text-slate-400'}`}><List size={14} /></button>
            <button onClick={() => setViewMode('map')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'map' ? 'bg-pink-100 text-pink-500' : 'text-slate-400'}`}><Map size={14} /></button>
          </div>
        </div>

        {/* 第二排：城市 + 商場 + 地區 */}
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
                      if (item.isBought && isMine) { handleUncheckBought(item); return; }
                      if (!item.isBought) { setBoughtModal(item); return; }
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
                {item.isBought && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-pink-600 bg-pink-50 px-3 py-1.5 rounded-xl w-fit border border-pink-100">
                      <Avatar member={completer} className="w-4 h-4 rounded-md" />
                      <span>{completer.name} 於 {item.boughtAt} 購入</span>
                    </div>
                    {item.recordedIn && item.price && item.price !== '0' && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">計入 {item.recordedIn}：</span>
                        <CurrencyBadge amount={item.price} currency={item.currency} type="支出" />
                      </div>
                    )}
                  </div>
                )}

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
              <button type="button" onClick={() => { if (!customMall.trim()) return; setModal(p => ({ ...p, data: { ...p.data, mall: customMall.trim() } })); setShowCustomMall(false); setCustomMall(''); }} className="px-4 bg-pink-500 text-white font-bold rounded-2xl text-xs">套用</button>
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
                const updateRecord = wList => wList.map(w => w.id === s.walletRecordId ? { ...w, name: `購買: ${finalData.name}`, note: finalData.note || '自購物清單連動' } : w);
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

      <BoughtModal isOpen={!!boughtModal} onClose={() => setBoughtModal(null)} onConfirm={handleConfirmBought} />
      <ConfirmDialog isOpen={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={() => confirmDel?.fn()} title={confirmDel?.title} message={confirmDel?.message} />
      <PhotoViewerModal isOpen={!!viewerPhotos} onClose={() => setViewerPhotos(null)} photos={viewerPhotos} initialIndex={viewerIndex} />
    </div>
  );
};

// ─── BoughtModal ──────────────────────────────────────────────────────────────
const BoughtModal = ({ isOpen, onClose, onConfirm }) => {
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('JPY');
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  
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
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button onClick={() => onConfirm(price || '0', currency, '共用錢包')} className="py-4 bg-pink-500 text-white rounded-2xl font-bold text-sm shadow-md active:scale-95 hover:bg-pink-600 transition-colors">計入共用錢包</button>
            <button onClick={() => onConfirm(price || '0', currency, '個人記帳')} className="py-4 bg-violet-500 text-white rounded-2xl font-bold text-sm shadow-md active:scale-95 hover:bg-violet-600 transition-colors">計入個人記帳</button>
          </div>
          <button onClick={() => onConfirm(price || '0', currency, '略過不記帳')} className="w-full py-4 bg-white text-slate-500 rounded-2xl font-bold text-sm uppercase tracking-widest active:scale-95 border border-slate-200 mt-2 shadow-sm hover:bg-slate-50 transition-colors">略過不記帳（僅標記已買）</button>
        </div>
      </div>
    </div>
  );
};

// 🌟 在元件外部定義一個永遠不變的空陣列參考，徹底斷絕無窮渲染迴圈
const EMPTY_ARRAY = [];

// ─── WalletTab ────────────────────────────────────────────────────────────────
const WalletTab = ({ onDownload }) => {
  const { allMembers, currentMember, sharedWallet, setSharedWallet, personalWallet, setPersonalWallet, allPersonalWallets } = useMember();
  const [viewMemberId, setViewMemberId] = useState(currentMember?.id || '');
  const [subTab, setSubTab] = useState('共用錢包');
  const [modal, setModal] = useState({ type: null, data: null });
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [dateConfirmDel, setDateConfirmDel] = useState(null);

  useEffect(() => {
    if (currentMember?.id) {
      setViewMemberId(currentMember.id);
    }
  }, [currentMember?.id]);

  const viewPersonalWallet = useMemo(() => {
    if (!allPersonalWallets || !viewMemberId) return EMPTY_ARRAY;
    return allPersonalWallets[viewMemberId] || EMPTY_ARRAY;
  }, [allPersonalWallets, viewMemberId]);

  const isOwner = viewMemberId === currentMember?.id;
  
  const activeWallet = useMemo(() => {
    const w = subTab === '共用錢包' ? sharedWallet : viewPersonalWallet;
    return Array.isArray(w) ? w : EMPTY_ARRAY;
  }, [subTab, sharedWallet, viewPersonalWallet]);

  const setActiveWallet = subTab === '共用錢包' ? setSharedWallet : (isOwner ? setPersonalWallet : () => {});

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
        const amt = Number(item.amount) || 0;
        if (totals[item.currency] !== undefined) {
          if (item.type === '存入') totals[item.currency] += amt; else totals[item.currency] -= amt;
        }
      });
    }
    return totals;
  }, [activeWallet]);

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
        const amt = Number(item.amount) || 0;
        if (sum[item.currency] !== undefined) {
          if (item.type === '存入') sum[item.currency] += amt; else sum[item.currency] -= amt;
        }
      });
    }
    return sum;
  }, [filteredWalletItems]);

  const handleDeleteWalletItem = (item) => {
    if (!item) return;
    setConfirmDel({ fn: () => setActiveWallet(p => p.filter(w => w.id !== item.id)) });
  };

  const handleDeleteDate = (d) => {
    if (!d) return;
    setDateConfirmDel({ fn: () => setActiveWallet(p => p.filter(w => w.date !== d)) });
  };

  const handleAddClick = () => {
    const defaultDate = visibleWalletDates.includes(selectedDate) ? selectedDate : (visibleWalletDates[visibleWalletDates.length - 1] || `${(new Date().getMonth() + 1).toString().padStart(2, '0')}/${new Date().getDate().toString().padStart(2, '0')}`);
    setModal({ type: 'add', data: { type: '支出', currency: 'JPY', date: defaultDate } });
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
      </div>

      <div className="sticky top-0 z-30 px-4 pt-3 pb-3 bg-white/95 backdrop-blur-md border-y border-slate-100 mb-5 flex flex-col gap-3">
        {visibleWalletDates.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {visibleWalletDates.map(d => (
              <button key={d} type="button" onClick={() => setSelectedDate(d)} className={`flex-shrink-0 px-4 py-2 rounded-2xl text-xs font-bold transition-all border flex items-center gap-1.5 ${selectedDate === d ? 'bg-violet-5 text-violet-600 border-violet-200 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}>
                {d}
                <span onClick={e => { e.stopPropagation(); handleDeleteDate(d); }} className={`ml-1 transition-opacity ${selectedDate === d ? 'text-violet-400 hover:text-violet-600' : 'text-slate-300 hover:text-red-400'}`}><X size={14} /></span>
              </button>
            ))}
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
          const editor = (allMembers || []).find(m => m && m.id === item.editedById) || { name: item.lastEdited || '成員' };

          return (
            <div key={item.id} className={`relative p-4 rounded-2xl shadow-sm transition-shadow group ${c.bg} border ${c.border}`}>
              <div className="absolute top-3 right-3 flex gap-1.5 z-10 opacity-80 hover:opacity-100 transition-opacity">
                {(subTab === '共用錢包' || isOwner) && (
                  <>
                    <button type="button" onClick={() => setModal({ type: 'edit', data: item })} className="p-1.5 text-slate-500 bg-white hover:bg-slate-50 rounded-lg transition-colors border border-slate-200 shadow-sm"><Edit2 size={13} /></button>
                    <button type="button" onClick={() => handleDeleteWalletItem(item)} className="p-1.5 text-red-500 bg-white hover:bg-red-100 rounded-lg transition-colors border border-red-200 shadow-sm"><Trash2 size={13} /></button>
                  </>
                )}
              </div>
              
              <div className="pt-1 pr-14">
                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                  <span className={`${c.badge} text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm`}>{item.currency}</span>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border bg-white ${isIncome ? 'text-red-500 border-red-200' : 'text-blue-500 border-blue-200'}`}>{item.type}</span>
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

      {(isOwner || subTab === '共用錢包') && (
        <button type="button" onClick={handleAddClick} className="fixed bottom-[110px] right-6 w-16 h-16 bg-violet-500 text-white rounded-[2rem] shadow-lg flex items-center justify-center active:scale-90 z-[60] border-4 border-white hover:bg-violet-600 transition-colors"><Plus size={30} strokeWidth={3} /></button>
      )}

      <Modal isOpen={!!modal.type} onClose={() => { setModal({ type: null, data: null }); setIsCalcOpen(false); }} title={modal.data?.id ? '編輯帳目' : '新增帳目'}>
        <FormField label="項目名稱" value={modal.data?.name} onChange={v => setModal({ ...modal, data: { ...modal.data, name: v } })} placeholder="如：機票公費、晚餐代墊" />
        <div className="flex bg-slate-50 p-1.5 rounded-2xl mb-4 shrink-0 border border-slate-100">
          {['存入', '支出'].map(t => (
            <button key={t} type="button" onClick={() => setModal({ ...modal, data: { ...modal.data, type: t } })} className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${modal.data?.type === t ? 'bg-red-500 text-white shadow-md' : 'bg-blue-500 text-white shadow-md'}`}>{t}</button>
          ))}
        </div>
        
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 block">日期</label>
            <input type="date" value={modal.data?.date?.includes('/') ? `2026-${modal.data.date.replace('/', '-')}` : modal.data?.date || ''} onChange={e => setModal({ ...modal, data: { ...modal.data, date: e.target.value } })} className="w-full bg-white border border-slate-200 rounded-2xl h-12 px-3 font-bold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-violet-100 transition-all shadow-sm" />
          </div>
          <FormField label="幣別" type="select" options={['JPY', 'KRW', 'TWD']} value={modal.data?.currency} onChange={v => setModal({ ...modal, data: { ...modal.data, currency: v } })} />
        </div>
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
            <button type="button" onClick={() => setModal({ ...modal, data: { ...modal.data, amount: (modal.data?.amount || '').slice(0, -1) } })} className="h-12 bg-slate-100 border border-slate-200 font-bold text-slate-600 flex items-center justify-center active:scale-90 hover:bg-slate-200 transition-colors"><Delete size={22} /></button>
          </div>
        )}
        <FormField label="備註（選填）" type="textarea" value={modal.data?.note} onChange={v => setModal({ ...modal, data: { ...modal.data, note: v } })} placeholder="輸入心得或詳情" />
        <button type="button" onClick={() => {
          if (!modal.data?.amount || !modal.data?.date) return;
          const formattedDate = modal.data.date.includes('-') ? modal.data.date.split('-').slice(1).join('/') : modal.data.date;
          const final = { ...modal.data, date: formattedDate, editedById: currentMember?.id || '', createdAt: modal.data.createdAt || Date.now() };
          if (modal.data.id) setActiveWallet(p => p.map(w => w.id === modal.data.id ? final : w));
          else setActiveWallet(p => [...p, { ...final, id: Date.now() }]);
          setSelectedDate(formattedDate); setModal({ type: null }); setIsCalcOpen(false);
        }} className="w-full bg-violet-500 text-white font-black py-4 rounded-2xl shadow-md mt-1 active:scale-95 text-base hover:bg-violet-600 transition-colors">確認儲存更新</button>
      </Modal>

      <ConfirmDialog isOpen={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={() => confirmDel?.fn()} />
      <ConfirmDialog isOpen={!!dateConfirmDel} onClose={() => setDateConfirmDel(null)} onConfirm={() => dateConfirmDel?.fn()} title="確認刪除日期與帳目" message="此操作將會刪除該日期頁籤，並且清空底下所有的帳務紀錄，確定要刪除嗎？" />
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
        {activeTab === 'trip' && <TripPage onDownload={setDownloadTrigger} />}
        {activeTab === 'food' && <FoodPage onDownload={setDownloadTrigger} />}
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
