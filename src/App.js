import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Map, Utensils, ShoppingBag, Home, Users, User, Settings,
  Plane, Clock, Wallet, MapPin, Calendar, LogOut,
  ChevronRight, ChevronLeft, Plus, Edit2, Trash2, X, Check, Navigation, Camera, Delete, Calculator, CheckCircle2, UserCircle2, TrendingUp, TrendingDown, History, Download, FileText, AlertTriangle
} from 'lucide-react';

const appId = 'travel-pro-v42-final';

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
  const [allMembers, setAllMembers] = useStorageState(`${appId}:allMembers`, []);

  const [tripDates, setTripDates] = useStorageState(`${appId}:tripDates`, ['待安排', '06/06', '06/07', '06/08', '06/09', '06/10', '06/11', '06/12', '06/13', '06/14']);
  const [walletDates, setWalletDates] = useStorageState(`${appId}:walletDates`, []);

  const [trips, setTrips] = useStorageState(`${appId}:trips`, [{ id: 1, title: '釜山東京雙城遊', date: '2026-06-06' }]);
  const [flights, setFlights] = useStorageState(`${appId}:flights`, [
    { id: 1, no: 'CI 0190', date: '06/06', from: '桃園', to: '釜山', dep: '06:15', arr: '09:30' },
    { id: 2, no: 'BX 112', date: '06/10', from: '釜山', to: '東京成田', dep: '07:50', arr: '10:00' },
    { id: 3, no: 'CI 0101', date: '06/14', from: '東京成田', to: '台北桃園', dep: '14:30', arr: '17:15' }
  ]);
  const [stays, setStays] = useStorageState(`${appId}:stays`, [
    { id: 1, name: 'UH Continental CenterPoint', checkIn: '06/06', checkOut: '06/10', mapUrl: 'https://maps.app.goo.gl/tniUPpQDWuPtW4oQ6' },
    { id: 2, name: '三井花園飯店五反田', checkIn: '06/10', checkOut: '06/14', mapUrl: 'https://maps.app.goo.gl/Zw8Apv464GyRTnKG9' }
  ]);

  const [globalItinerary, setGlobalItinerary] = useStorageState(`${appId}:globalItinerary`, [
    { id: 101, date: '06/06', time: '10:30', name: '抵達飯店 & 寄放行李', category: '住宿', mapUrl: '', note: '從機場叫兩台計程車直達 UH Continental。飯店位置極佳，寄完行李可以先在沙灘前拍第一組 6 人合照。', lastEdited: '管理員', photos: [], createdAt: 1 },
    { id: 102, date: '06/06', time: '12:00', name: '午餐：海雲台傳統市場', category: '美食', mapUrl: '', note: '市場就在飯店旁邊\n必吃推薦：尚國家飯捲 (Sang-guk-ine) 的辣炒年糕與炸物、釜山道地的豬肉湯飯。', lastEdited: '管理員', photos: [], createdAt: 2 },
    { id: 103, date: '06/06', time: '14:00', name: 'Centum City 購物 & Spa Land 汗蒸幕', category: '景點', mapUrl: '', note: 'Spa Land：號稱「汗蒸幕界的愛馬仕」，有 22 個不同溫度的房型。紅眼班機後在這裡睡午覺是最好的恢復方式。\n\n新世界百貨：逛完 Spa Land 直接逛百貨。B2 樓層有最多韓系潮牌 (Matin Kim, Marithé 等)，8 樓則是新世界免稅店。', lastEdited: '管理員', photos: [], createdAt: 3 },
    { id: 104, date: '06/06', time: '19:00', name: '廣安里海水浴場', category: '景點', mapUrl: '', note: '搭計程車 15 分鐘\n必做清單：廣安大橋夜景、在沙灘上玩仙女棒。', lastEdited: '管理員', photos: [], createdAt: 4 },
    { id: 105, date: '06/06', time: '20:00', name: '廣安里 M 無人機秀 (週六限定)', category: '景點', mapUrl: '', note: '必看提醒：這是釜山週六最大的重頭戲，數百台無人機會在空中變換圖案。', lastEdited: '管理員', photos: [], createdAt: 5 },
    { id: 106, date: '06/06', time: '21:00', name: '晚餐：廣安里炸雞配啤酒', category: '美食', mapUrl: '', note: '推薦：BHC 炸雞或橋村炸雞。', lastEdited: '管理員', photos: [], createdAt: 6 },
    { id: 201, date: '06/07', time: '10:00', name: '慢活早晨：海理團路', category: '景點', mapUrl: '', note: '飯店對面區域\n穿過海雲台車站後方，有許多老宅改建的歐式早午餐店、肉桂捲名店。', lastEdited: '管理員', photos: [], createdAt: 7 },
  ]);

  const [shoppingList, setShoppingList] = useStorageState(`${appId}:shoppingList`, []);
  const [sharedTodos, setSharedTodos] = useStorageState(`${appId}:sharedTodos`, []);
  const [sharedWallet, setSharedWallet] = useStorageState(`${appId}:sharedWallet`, []);
  const [sharedNotes, setSharedNotes] = useStorageState(`${appId}:sharedNotes`, []);

  // Per-member personal data
  const [allPersonalWallets, setAllPersonalWallets] = useStorageState(`${appId}:allPersonalWallets`, {});
  const [allPersonalNotes, setAllPersonalNotes] = useStorageState(`${appId}:allPersonalNotes`, {});

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
    globalItinerary, setGlobalItinerary,
    tripDates, setTripDates, walletDates, setWalletDates,
    trips, setTrips, flights, setFlights, stays, setStays,
    shoppingList, setShoppingList,
    sharedTodos, setSharedTodos,
    sharedWallet, setSharedWallet, sharedNotes, setSharedNotes,
    personalWallet, setPersonalWallet, allPersonalWallets, personalNotes, setPersonalNotes,
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
    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 block">{label}</label>
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
  return member.photo ? (
    <img src={member.photo} alt={member.name} className={`${className} object-cover rounded-2xl border-2 border-white shadow-sm`} />
  ) : (
    <div className={`${className} rounded-2xl flex items-center justify-center text-white font-black shadow-sm border-2 border-white`} style={{ backgroundColor: member.avatarColor }}>
      {member.name.charAt(0).toUpperCase()}
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
};// ─── HomePage ─────────────────────────────────────────────────────────────────
const HomePage = ({ onNavigate }) => {
  const { trips, setTrips, flights, setFlights, stays, setStays, globalItinerary, sharedWallet, personalWallet, currentMember } = useMember();
  const [modal, setModal] = useState({ type: null, data: null });
  const [confirmDel, setConfirmDel] = useState(null);
  const isAdmin = currentMember?.role === '管理員';

  const walletBalances = useMemo(() => {
    const totals = { JPY: 0, KRW: 0, TWD: 0 };
    [...sharedWallet, ...personalWallet].forEach(item => {
      const amt = Number(item.amount) || 0;
      if (item.type === '存入') totals[item.currency] += amt; else totals[item.currency] -= amt;
    });
    return totals;
  }, [sharedWallet, personalWallet]);

  const nextTripItem = useMemo(() => {
    const now = new Date().setHours(0, 0, 0, 0);
    return [...globalItinerary]
      .filter(i => i.date !== '待安排')
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))
      .find(i => new Date(`2026/${i.date}`).getTime() >= now);
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
            <p className={`text-sm font-black ${tc}`}>{walletBalances[cur] >= 0 ? '+' : ''}{walletBalances[cur].toLocaleString()}</p>
          </div>
        ))}
      </section>

      <section>
        <div className="flex justify-between items-center mb-3 px-1">
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Clock size={14} /> 旅遊倒數計時</span>
          {isAdmin && <button onClick={() => setModal({ type: 'trip', data: {} })} className="text-blue-500 hover:text-blue-600 active:scale-90 transition-colors"><Plus size={20} /></button>}
        </div>
        {trips.map(t => (
          <div key={t.id} className="relative bg-gradient-to-br from-blue-500 to-sky-400 p-6 rounded-[2rem] text-white shadow-md mb-3 group overflow-hidden">
            {isAdmin && (
              <div className="absolute top-4 right-4 flex gap-2 z-10 opacity-80 hover:opacity-100 transition-opacity">
                <button onClick={() => setModal({ type: 'trip', data: t })} className="p-2 bg-white/20 hover:bg-white/40 rounded-full backdrop-blur-sm transition-colors"><Edit2 size={14} /></button>
                <button onClick={() => setConfirmDel({ fn: () => setTrips(p => p.filter(x => x.id !== t.id)) })} className="p-2 bg-white/20 hover:bg-red-500/80 rounded-full backdrop-blur-sm transition-colors"><Trash2 size={14} /></button>
              </div>
            )}
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
          {isAdmin && <button onClick={() => setModal({ type: 'flight', data: {} })} className="text-blue-500 hover:text-blue-600 active:scale-90 transition-colors"><Plus size={20} /></button>}
        </div>
        {flights.map(f => (
          <div key={f.id} className="relative bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
            {isAdmin && (
              <div className="absolute top-4 right-4 flex gap-2 z-10 opacity-70 hover:opacity-100 transition-opacity">
                <button onClick={() => setModal({ type: 'flight', data: f })} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-500 transition-colors border border-slate-100"><Edit2 size={14} /></button>
                <button onClick={() => setConfirmDel({ fn: () => setFlights(p => p.filter(x => x.id !== f.id)) })} className="p-2 bg-red-50 hover:bg-red-100 rounded-full text-red-400 transition-colors border border-red-100"><Trash2 size={14} /></button>
              </div>
            )}
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-blue-500 text-white px-3 py-1 rounded-full font-black text-xs tracking-widest shadow-sm">{f.no}</span>
                <span className="text-slate-400 text-xs font-bold tracking-widest">{f.date}</span>
              </div>
              <div className="flex justify-between items-center px-2 pr-16">
                <p className="text-xl font-black text-slate-700 tracking-tighter truncate max-w-[80px] text-center">{f.from}</p>
                <div className="flex-1 border-b-2 border-dotted border-slate-200 mx-5 relative mb-2">
                  <Plane size={18} className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-slate-300 rotate-90 bg-white px-1" />
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
          {isAdmin && <button onClick={() => setModal({ type: 'stay', data: {} })} className="text-blue-500 hover:text-blue-600 active:scale-90 transition-colors"><Plus size={20} /></button>}
        </div>
        {stays.map(s => (
          <div key={s.id} className="relative bg-white border border-slate-100 p-5 rounded-[2rem] shadow-sm hover:shadow-md transition-shadow flex items-center justify-between group">
            {isAdmin && (
              <div className="absolute top-2 right-2 flex gap-1.5 z-10 opacity-70 hover:opacity-100 transition-opacity">
                <button onClick={() => setModal({ type: 'stay', data: s })} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-500 transition-colors border border-slate-100"><Edit2 size={12} /></button>
                <button onClick={() => setConfirmDel({ fn: () => setStays(p => p.filter(x => x.id !== s.id)) })} className="p-2 bg-red-50 hover:bg-red-100 rounded-full text-red-400 transition-colors border border-red-100"><Trash2 size={12} /></button>
              </div>
            )}
            <div className="flex-1 pr-14">
              <h4 className="text-base font-bold text-slate-800 mb-1.5 leading-tight">{s.name}</h4>
              <p className="text-xs font-bold text-blue-500 tracking-widest uppercase flex items-center gap-1"><Calendar size={12} /> {s.checkIn} — {s.checkOut}</p>
            </div>
            {s.mapUrl && (
              <a href={s.mapUrl} target="_blank" rel="noreferrer" className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex flex-col items-center justify-center hover:bg-blue-100 active:scale-90 border border-blue-100 shrink-0 transition-colors"><Navigation size={20} /></a>
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
              <FormField label="退房日期" value={modal.data?.checkOut} onChange={v => setModal({ ...modal, data: { ...modal.data, checkOut: v } })} />
            </div>
            <FormField label="Map 連結" value={modal.data?.mapUrl} onChange={v => setModal({ ...modal, data: { ...modal.data, mapUrl: v } })} />
          </>
        )}
        <button onClick={() => handleSave(modal.data)} className="w-full bg-blue-500 text-white font-black py-4 rounded-2xl shadow-md active:scale-95 mt-3 text-base hover:bg-blue-600 transition-colors">確認儲存</button>
      </Modal>

      <ConfirmDialog isOpen={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={() => confirmDel?.fn()} />
    </div>
  );
};

// ─── TripPage ─────────────────────────────────────────────────────────────────
const TripPage = ({ onDownload }) => {
  const { globalItinerary, setGlobalItinerary, tripDates, setTripDates, currentMember } = useMember();
  const [selectedDate, setSelectedDate] = useState(() => getSmartDate(tripDates));
  const [modal, setModal] = useState({ type: null, data: null });
  const [tempPhotos, setTempPhotos] = useState([]);
  const [confirmDel, setConfirmDel] = useState(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [dateConfirmDel, setDateConfirmDel] = useState(null);
  
  // 預覽圖片狀態
  const [viewerPhotos, setViewerPhotos] = useState(null);
  const [viewerIndex, setViewerIndex] = useState(0);

  // 空頁籤自動隱藏邏輯：是「待安排」、是「當前選取」，或「裡面有行程」才顯示
  const visibleTripDates = useMemo(() => {
    return tripDates.filter(d => d === '待安排' || d === selectedDate || globalItinerary.some(item => item.date === d));
  }, [tripDates, selectedDate, globalItinerary]);

  const filteredItems = useMemo(() => {
    const items = globalItinerary.filter(i => i.date === selectedDate);
    if (selectedDate === '待安排') return items.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    return items.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  }, [globalItinerary, selectedDate]);

  useEffect(() => {
    onDownload(() => () => {
      let text = `行程清單 - ${selectedDate}\n\n`;
      filteredItems.forEach(i => {
        text += `[${i.time || '待定'}] ${i.name} (${i.category})\n`;
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

  return (
    <div className="relative animate-in fade-in pb-28">
      <div className="sticky top-0 z-30 px-4 pt-3 pb-3 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="flex justify-between items-center mb-3 px-1">
          <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest">行程時間軸</h3>
          <button onClick={() => setDatePickerOpen(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100 active:scale-95 transition-all hover:bg-blue-100">
            <Plus size={14} /> 新增日期
          </button>
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

      <div className="mt-5 px-4 relative">
        {selectedDate !== '待安排' && filteredItems.length > 0 && (
          <div className="absolute left-[2.35rem] top-0 bottom-0 w-0.5 bg-blue-100" style={{ top: 28, bottom: 28 }} />
        )}
        <div className="space-y-4">
          {filteredItems.map((item, idx) => (
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
                    <h4 className="text-base font-bold text-slate-800 leading-tight mb-2">{item.name}</h4>
                    {item.note && <div className="bg-slate-50 border-l-4 border-blue-300 p-3 mb-3 text-sm text-slate-600 italic rounded-r-2xl whitespace-pre-wrap">{item.note}</div>}
                    {item.photos?.length > 0 && (
                      <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar">
                        {item.photos.map((p, i) => (
                          <img key={i} src={p} onClick={() => { setViewerPhotos(item.photos); setViewerIndex(i); }} className="w-16 h-16 object-cover rounded-xl border border-slate-100 shadow-sm shrink-0 cursor-pointer hover:opacity-80 transition-opacity" alt="pic" />
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest"><UserCircle2 size={12} /> {item.lastEdited}</div>
                  </div>
                  {item.mapUrl && <a href={item.mapUrl} target="_blank" rel="noreferrer" className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center hover:bg-blue-100 active:scale-90 border border-blue-100 shrink-0 transition-colors"><Navigation size={20} /></a>}
                </div>
              </div>
            </div>
          ))}
          {filteredItems.length === 0 && <div className="py-20 text-center text-slate-400 text-xs font-bold uppercase tracking-widest italic opacity-80">尚未安排行程</div>}
        </div>
      </div>

      <button onClick={() => { setModal({ type: 'item', data: { category: '景點', date: selectedDate } }); setTempPhotos([]); }} className="fixed bottom-[110px] right-6 w-16 h-16 bg-blue-500 text-white rounded-[2rem] shadow-lg flex items-center justify-center active:scale-90 z-[60] border-4 border-white hover:bg-blue-600 transition-colors"><Plus size={30} strokeWidth={3} /></button>

      <Modal isOpen={!!modal.type} onClose={() => setModal({ type: null, data: null })} title="編輯行程">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="日期" type="select" options={tripDates} value={modal.data?.date} onChange={v => setModal({ ...modal, data: { ...modal.data, date: v } })} />
          <FormField label="時間（選填）" type="time" value={modal.data?.time} onChange={v => setModal({ ...modal, data: { ...modal.data, time: v } })} />
        </div>
        <FormField label="類別" type="select" options={['景點', '美食', '購物', '交通', '住宿', '換匯', '其他']} value={modal.data?.category} onChange={v => setModal({ ...modal, data: { ...modal.data, category: v } })} />
        <FormField label="項目名稱" value={modal.data?.name} onChange={v => setModal({ ...modal, data: { ...modal.data, name: v } })} />
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
            Array.from(e.target.files).forEach(file => { const r = new FileReader(); r.onloadend = () => setTempPhotos(p => p.length < 5 ? [...p, r.result] : p); r.readAsDataURL(file); });
          }} />
        </div>
        <button onClick={() => {
          if (!modal.data.name) return;
          const finalData = { ...modal.data, photos: tempPhotos, lastEdited: currentMember.name, createdAt: modal.data.createdAt || Date.now() };
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
  const { globalItinerary, setGlobalItinerary, tripDates, currentMember } = useMember();
  const [arrangedStatus, setArrangedStatus] = useState('待安排');
  const [subTab, setSubTab] = useState('釜山');
  const [modal, setModal] = useState({ type: null, data: null });
  const [tempPhotos, setTempPhotos] = useState([]);
  const [confirmDel, setConfirmDel] = useState(null);

  // 預覽圖片狀態
  const [viewerPhotos, setViewerPhotos] = useState(null);
  const [viewerIndex, setViewerIndex] = useState(0);

  useEffect(() => {
    if (arrangedStatus === '已安排') setSubTab(getSmartDate(tripDates.filter(d => d !== '待安排')));
    else setSubTab('釜山');
  }, [arrangedStatus, tripDates]);

  // 空頁籤自動隱藏邏輯：有安排美食或是目前所在的 subTab 才會顯示
  const visibleFoodDates = useMemo(() => {
    const dates = tripDates.filter(d => d !== '待安排');
    return dates.filter(d => d === subTab || globalItinerary.some(item => item.category === '美食' && item.date === d));
  }, [tripDates, subTab, globalItinerary]);

  const foodList = useMemo(() => {
    const items = globalItinerary.filter(i => {
      const isFood = i.category === '美食';
      if (arrangedStatus === '待安排') return isFood && i.date === '待安排' && i.city === subTab;
      return isFood && i.date === subTab && i.date !== '待安排';
    });
    if (arrangedStatus === '待安排') return items.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    return items.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  }, [globalItinerary, arrangedStatus, subTab]);

  useEffect(() => {
    onDownload(() => () => {
      let text = `美食清單 - ${arrangedStatus} (${subTab})\n\n`;
      foodList.forEach(i => { text += `[${i.time || '無時間'}] ${i.name}\n`; if (i.note) text += `備註: ${i.note}\n`; text += '--\n'; });
      downloadTextFile(text, `Food_${subTab.replace('/', '-')}`);
    });
  }, [foodList, arrangedStatus, subTab, onDownload]);

  return (
    <div className="relative animate-in fade-in pb-28">
      <div className="sticky top-0 z-30 px-4 pt-3 pb-2 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm flex flex-col gap-3">
        <div className="flex bg-orange-50/50 p-1.5 rounded-3xl border border-orange-100">
          {['待安排', '已安排'].map(t => (
            <button key={t} onClick={() => setArrangedStatus(t)} className={`flex-1 px-4 py-2 text-sm font-bold rounded-2xl transition-all ${arrangedStatus === t ? 'bg-orange-500 text-white shadow-sm' : 'text-orange-400 hover:text-orange-500'}`}>{t}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 px-1">
          {(arrangedStatus === '待安排' ? ['釜山', '東京'] : visibleFoodDates).map(tab => (
            <button key={tab} onClick={() => setSubTab(tab)} className={`flex-shrink-0 px-5 py-2 rounded-2xl text-xs font-bold transition-all border ${subTab === tab ? 'bg-orange-50 text-orange-600 border-orange-200 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}>{tab}</button>
          ))}
        </div>
      </div>

      <div className="relative mt-5 px-4">
        {arrangedStatus === '已安排' && foodList.length > 0 && (
          <div className="absolute left-[2.35rem] top-0 bottom-0 w-0.5 bg-orange-100" style={{ top: 28, bottom: 28 }} />
        )}
        <div className="space-y-4">
          {foodList.map((item, idx) => (
            <div key={item.id} className={`relative flex gap-3 animate-in slide-in-from-bottom-2`}>
              {arrangedStatus === '已安排' && (
                <div className="flex flex-col items-center shrink-0" style={{ width: 32 }}>
                  <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-black shadow-md border-2 border-white z-10">{idx + 1}</div>
                </div>
              )}
              <div className="flex-1 bg-white border border-slate-100 p-5 rounded-[2rem] shadow-sm hover:shadow-md transition-shadow group">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {item.time && arrangedStatus === '已安排' && <span className="bg-orange-50 text-orange-600 px-2.5 py-1 rounded-lg font-black text-xs border border-orange-100">{item.time}</span>}
                  <span className="bg-orange-50 text-orange-600 px-2.5 py-1 rounded-lg font-bold text-xs border border-orange-100">美食</span>
                  <div className="ml-auto flex gap-2 opacity-80 hover:opacity-100 transition-opacity">
                    <button onClick={() => { setModal({ type: 'food', data: item }); setTempPhotos(item.photos || []); }} className="p-2 text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors border border-slate-100"><Edit2 size={14} /></button>
                    <button onClick={() => setConfirmDel({ fn: () => setGlobalItinerary(p => p.filter(it => it.id !== item.id)) })} className="p-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-xl transition-colors border border-red-100"><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <h4 className="text-base font-bold text-slate-800 mb-2">{item.name}</h4>
                    {item.note && <p className="bg-slate-50 p-3 rounded-2xl text-sm text-slate-600 border-l-4 border-orange-300 italic leading-relaxed mb-3 whitespace-pre-wrap">{item.note}</p>}
                    {item.photos?.length > 0 && (
                      <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar">
                        {item.photos.map((p, i) => (
                          <img key={i} src={p} onClick={() => { setViewerPhotos(item.photos); setViewerIndex(i); }} className="w-16 h-16 object-cover rounded-xl border border-slate-100 shadow-sm shrink-0 cursor-pointer hover:opacity-80 transition-opacity" alt="pic" />
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest"><UserCircle2 size={12} className="inline mr-1" />{item.lastEdited}</p>
                  </div>
                  {item.mapUrl && <a href={item.mapUrl} target="_blank" rel="noreferrer" className="w-12 h-12 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center hover:bg-orange-100 active:scale-90 border border-orange-100 shrink-0 transition-colors"><Navigation size={20} /></a>}
                </div>
              </div>
            </div>
          ))}
          {foodList.length === 0 && <div className="py-24 text-center text-slate-400 text-xs font-bold uppercase tracking-widest italic opacity-80">尚無美食清單</div>}
        </div>
      </div>

      <button onClick={() => { setModal({ type: 'food', data: { category: '美食', date: arrangedStatus === '已安排' ? subTab : '待安排', city: arrangedStatus === '待安排' ? subTab : '釜山' } }); setTempPhotos([]); }} className="fixed bottom-[110px] right-6 w-16 h-16 bg-orange-500 text-white rounded-[2rem] shadow-lg flex items-center justify-center active:scale-90 z-[60] border-4 border-white hover:bg-orange-600 transition-colors"><Plus size={30} strokeWidth={3} /></button>

      <Modal isOpen={!!modal.type} onClose={() => setModal({ type: null, data: null })} title="編輯美食">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="日期" type="select" options={tripDates} value={modal.data?.date} onChange={v => setModal({ ...modal, data: { ...modal.data, date: v } })} />
          {modal.data?.date !== '待安排' ? (
            <FormField label="時間（選填）" type="time" value={modal.data?.time} onChange={v => setModal({ ...modal, data: { ...modal.data, time: v } })} />
          ) : (
            <FormField label="城市" type="select" options={['釜山', '東京']} value={modal.data?.city} onChange={v => setModal({ ...modal, data: { ...modal.data, city: v } })} />
          )}
        </div>
        <FormField label="美食名稱" value={modal.data?.name} onChange={v => setModal({ ...modal, data: { ...modal.data, name: v } })} />
        <FormField label="Map 連結（選填）" value={modal.data?.mapUrl} onChange={v => setModal({ ...modal, data: { ...modal.data, mapUrl: v } })} />
        <FormField label="備註（選填）" type="textarea" value={modal.data?.note} onChange={v => setModal({ ...modal, data: { ...modal.data, note: v } })} />
        <div className="mb-4">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">相片（最多 5 張）</label>
          <div className="flex flex-wrap gap-2">
            {tempPhotos.map((url, idx) => (
              <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-100 shadow-sm">
                <img src={url} className="w-full h-full object-cover" alt="tmp" />
                <button onClick={() => setTempPhotos(p => p.filter((_, i) => i !== idx))} className="absolute top-1 right-1 p-1 bg-red-500/90 text-white rounded-lg backdrop-blur-sm"><X size={12} /></button>
              </div>
            ))}
            {tempPhotos.length < 5 && <button onClick={() => document.getElementById('food-photo-up').click()} className="w-16 h-16 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-50 transition-colors shadow-sm"><Camera size={24} /></button>}
          </div>
          <input type="file" id="food-photo-up" className="hidden" multiple accept="image/*" onChange={e => {
            Array.from(e.target.files).forEach(file => { const r = new FileReader(); r.onloadend = () => setTempPhotos(p => p.length < 5 ? [...p, r.result] : p); r.readAsDataURL(file); });
          }} />
        </div>
        <button onClick={() => {
          if (!modal.data.name) return;
          const finalData = { ...modal.data, photos: tempPhotos, lastEdited: currentMember.name, category: '美食', createdAt: modal.data.createdAt || Date.now() };
          if (modal.data.id) setGlobalItinerary(p => p.map(it => it.id === modal.data.id ? finalData : it));
          else setGlobalItinerary(p => [...p, { ...finalData, id: Date.now() }]);
          setModal({ type: null });
        }} className="w-full bg-orange-500 text-white font-black py-4 rounded-2xl shadow-md mt-1 active:scale-95 text-base hover:bg-orange-600 transition-colors">確認儲存</button>
      </Modal>
      <ConfirmDialog isOpen={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={() => confirmDel?.fn()} />
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
  const { allMembers, currentMember, shoppingList, setShoppingList, sharedWallet, setSharedWallet, personalWallet, setPersonalWallet, walletDates, setWalletDates } = useMember();
  const [viewMemberId, setViewMemberId] = useState(currentMember?.id);
  const [cityTab, setCityTab] = useState('釜山');
  const [modal, setModal] = useState({ type: null, data: null });
  const [tempPhotos, setTempPhotos] = useState([]);
  const [boughtModal, setBoughtModal] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  // 預覽圖片狀態
  const [viewerPhotos, setViewerPhotos] = useState(null);
  const [viewerIndex, setViewerIndex] = useState(0);

  const sortedList = useMemo(() => {
    const list = shoppingList.filter(s => s.memberId === viewMemberId && s.city === cityTab);
    const unbought = list.filter(i => !i.isBought).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const bought = list.filter(i => i.isBought).sort((a, b) => (b.boughtAtMs || 0) - (a.boughtAtMs || 0));
    return [...unbought, ...bought];
  }, [shoppingList, viewMemberId, cityTab]);

  const isOwner = viewMemberId === currentMember?.id;

  useEffect(() => {
    onDownload(() => () => {
      let text = `購物清單 - ${cityTab}\n\n`;
      sortedList.forEach(i => { text += `[${i.isBought ? '已買' : '未買'}] ${i.name}\n`; if (i.price && i.price !== '0') text += `價格: ${i.price} ${i.currency}\n`; if (i.note) text += `備註: ${i.note}\n`; text += '--\n'; });
      downloadTextFile(text, `Shopping_${cityTab}`);
    });
  }, [sortedList, cityTab, onDownload]);

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

    if (!walletDates.includes(dateStr)) {
      setWalletDates(prev => [...prev, dateStr].sort());
    }

    if (target !== '略過不記帳' && price && price !== '0') {
      walletRecordId = Date.now();
      const record = { 
        id: walletRecordId, name: `購買: ${boughtModal.name}`, type: '支出', amount: price, currency, 
        date: dateStr, note: boughtModal.note || '自購物清單連動', lastEdited: currentMember.name, 
        shoppingItemId: boughtModal.id, createdAt: Date.now() 
      };
      if (target === '共用錢包') setSharedWallet(p => [...p, record]);
      else if (target === '個人記帳') setPersonalWallet(p => [...p, record]);
    }
    
    setShoppingList(p => p.map(s => s.id === boughtModal.id ? {
      ...s, isBought: true, boughtAt: `${dateStr} ${timeStr}`, boughtAtMs: now.getTime(),
      completedBy: currentMember.name, price: target === '略過不記帳' ? null : price,
      currency: target === '略過不記帳' ? null : currency, recordedIn: target === '略過不記帳' ? null : target, walletRecordId
    } : s));
    setBoughtModal(null);
  };

  const handleUncheckBought = (item) => {
    setConfirmDel({
      fn: () => {
        if (item.walletRecordId) {
          if (item.recordedIn === '共用錢包') setSharedWallet(p => p.filter(w => w.id !== item.walletRecordId));
          else if (item.recordedIn === '個人記帳') setPersonalWallet(p => p.filter(w => w.id !== item.walletRecordId));
        }
        setShoppingList(p => p.map(s => s.id === item.id ? { ...s, isBought: false, completedBy: null, boughtAt: null, boughtAtMs: null, price: null, currency: null, recordedIn: null, walletRecordId: null } : s));
      },
      title: '取消購買紀錄',
      message: '此操作將同時刪除對應的帳務記錄，確定繼續嗎？'
    });
  };

  return (
    <div className="relative animate-in fade-in pb-28">
      <div className="sticky top-0 z-30 px-4 pt-3 pb-2 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm flex flex-col gap-3">
        {/* 頭像區域調整 pt-3 pb-3 讓外框發光圈不會被裁切 */}
        <div className="flex items-center gap-4 overflow-x-auto no-scrollbar px-2 pt-3 pb-3">
          {[...allMembers].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).map(m => (
            <button key={m.id} onClick={() => setViewMemberId(m.id)} className={`flex-shrink-0 flex flex-col items-center gap-1.5 transition-all ${viewMemberId === m.id ? 'scale-105' : 'opacity-50 grayscale hover:grayscale-0 hover:opacity-80'}`}>
              <Avatar member={m} className={`w-12 h-12 shadow-sm ${viewMemberId === m.id ? 'ring-2 ring-offset-2 ring-pink-400' : ''}`} />
              <span className={`text-[10px] font-bold uppercase tracking-wider ${viewMemberId === m.id ? 'text-pink-600' : 'text-slate-500'}`}>{m.name}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 px-1">
          {['釜山', '東京'].map(tab => (
            <button key={tab} onClick={() => setCityTab(tab)} className={`px-5 py-2 rounded-2xl text-sm font-bold transition-all border ${cityTab === tab ? 'bg-pink-50 text-pink-600 border-pink-200 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}>{tab}</button>
          ))}
        </div>
      </div>

      <div className="space-y-4 mt-5 px-4">
        {sortedList.map(item => (
          <div key={item.id} className={`relative bg-white border border-slate-100 p-5 rounded-[2rem] shadow-sm hover:shadow-md transition-all group animate-in slide-in-from-bottom-2 ${item.isBought ? 'opacity-70 bg-slate-50/50' : ''}`}>
            <div className="absolute top-4 right-4 flex gap-2 z-10 opacity-80 hover:opacity-100 transition-opacity">
              {isOwner && <button onClick={() => { setModal({ type: 'edit', data: item }); setTempPhotos(item.photos || []); }} className="p-2 text-slate-500 bg-white hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"><Edit2 size={14} /></button>}
              {isOwner && <button onClick={() => handleDeleteShoppingItem(item)} className="p-2 text-red-500 bg-white hover:bg-red-50 rounded-xl transition-colors border border-red-200"><Trash2 size={14} /></button>}
            </div>
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1 pr-16">
                <div className="flex items-center gap-3 mb-3">
                  {isOwner ? (
                    <button onClick={() => item.isBought ? handleUncheckBought(item) : setBoughtModal(item)} className={`w-8 h-8 rounded-xl flex items-center justify-center border-2 transition-colors shrink-0 ${item.isBought ? 'bg-pink-500 border-pink-500 text-white' : 'bg-white border-pink-200 text-pink-200 hover:bg-pink-50'}`}>
                      {item.isBought ? <Check size={18} strokeWidth={4} /> : <Check size={18} strokeWidth={4} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
                    </button>
                  ) : (
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center border-2 shrink-0 ${item.isBought ? 'bg-pink-500 border-pink-500 text-white' : 'bg-white border-slate-200'}`}>
                      {item.isBought && <Check size={18} strokeWidth={4} />}
                    </div>
                  )}
                  <h4 className={`text-base font-bold text-slate-800 ${item.isBought ? 'line-through text-slate-400' : ''}`}>{item.name}</h4>
                </div>

                <div className="text-[10px] font-bold text-slate-400 mb-2 flex items-center gap-1"><UserCircle2 size={12} /> {item.createdBy || '成員'}</div>

                {item.isBought && (
                  <div className="mb-2 space-y-2 mt-3">
                    <div className="text-xs font-bold text-pink-600 flex items-center gap-1.5 bg-pink-50 px-3 py-1.5 rounded-lg w-fit border border-pink-100">
                      <CheckCircle2 size={14} /> 於 {item.boughtAt} 購買
                    </div>
                    {item.recordedIn && item.price && item.price !== '0' && (
                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">計入 {item.recordedIn}：</span>
                        <CurrencyBadge amount={item.price} currency={item.currency} type="支出" />
                      </div>
                    )}
                  </div>
                )}

                {item.note && <p className="bg-slate-50 p-3 rounded-2xl text-sm font-medium text-slate-600 border-l-4 border-pink-300 mt-3 italic leading-relaxed whitespace-pre-wrap">{item.note}</p>}
                {item.photos?.length > 0 && (
                  <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
                    {item.photos.map((p, i) => (
                      <img key={i} src={p} onClick={() => { setViewerPhotos(item.photos); setViewerIndex(i); }} className="w-16 h-16 object-cover rounded-xl border border-slate-100 shadow-sm flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity" alt="photo" />
                    ))}
                  </div>
                )}
              </div>
              {item.mapUrl && (
                <a href={item.mapUrl} target="_blank" rel="noreferrer" className="w-12 h-12 bg-white text-pink-500 rounded-2xl flex flex-col items-center justify-center hover:bg-pink-50 active:scale-90 flex-shrink-0 border border-pink-200 shadow-sm transition-colors">
                  <Navigation size={20} />
                  <span className="text-[10px] font-bold mt-0.5">MAP</span>
                </a>
              )}
            </div>
          </div>
        ))}
        {sortedList.length === 0 && <div className="py-24 text-center text-slate-400 text-xs font-bold uppercase tracking-widest italic opacity-80">Empty List</div>}
      </div>

      {isOwner && (
        <button onClick={() => { setModal({ type: 'add', data: {} }); setTempPhotos([]); }} className="fixed bottom-[110px] right-6 w-16 h-16 bg-pink-500 text-white rounded-[2rem] shadow-lg flex items-center justify-center active:scale-90 z-[60] border-4 border-white hover:bg-pink-600 transition-colors">
          <Plus size={30} strokeWidth={3} />
        </button>
      )}

      <Modal isOpen={!!modal.type} onClose={() => setModal({ type: null, data: null })} title={modal.data?.id ? '修改購物內容' : '新增購物清單'}>
        <FormField label="商品名稱" value={modal.data?.name} onChange={v => setModal({ ...modal, data: { ...modal.data, name: v } })} placeholder="輸入名稱" />
        <FormField label="Map 連結（選填）" value={modal.data?.mapUrl} onChange={v => setModal({ ...modal, data: { ...modal.data, mapUrl: v } })} placeholder="貼上 Google Map 網址" />
        <FormField label="備註小細節" type="textarea" value={modal.data?.note} onChange={v => setModal({ ...modal, data: { ...modal.data, note: v } })} placeholder="如：幫誰帶的、大約價格" />
        <div className="mb-4">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">相片（最多 5 張）</label>
          <div className="flex flex-wrap gap-2">
            {tempPhotos.map((url, idx) => (
              <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-100 shadow-sm" key={idx}>
                <img src={url} className="w-full h-full object-cover" alt="temp" />
                <button onClick={() => setTempPhotos(tempPhotos.filter((_, i) => i !== idx))} className="absolute top-1 right-1 p-1 bg-red-500/90 text-white rounded-lg backdrop-blur-sm"><X size={12} /></button>
              </div>
            ))}
            {tempPhotos.length < 5 && <button onClick={() => document.getElementById('shop-photo-up').click()} className="w-16 h-16 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-50 transition-colors shadow-sm"><Camera size={24} /></button>}
          </div>
          <input type="file" id="shop-photo-up" className="hidden" multiple accept="image/*" onChange={e => {
            Array.from(e.target.files).forEach(file => { const r = new FileReader(); r.onloadend = () => setTempPhotos(p => [...p, r.result]); r.readAsDataURL(file); });
          }} />
        </div>
        <button onClick={() => {
          if (!modal.data.name) return;
          const finalData = { ...modal.data, photos: tempPhotos, isBought: modal.data.isBought || false, memberId: currentMember.id, city: cityTab, createdBy: modal.data.createdBy || currentMember.name, createdAt: modal.data.createdAt || Date.now() };
          
          if (modal.data.id) {
            setShoppingList(p => p.map(s => {
              if (s.id === modal.data.id) {
                if (s.walletRecordId) {
                  const updateRecord = (wList) => wList.map(w => w.id === s.walletRecordId ? {
                    ...w, name: `購買: ${finalData.name}`, amount: finalData.price || '0', currency: finalData.currency, note: finalData.note || '自購物清單連動'
                  } : w);
                  if (s.recordedIn === '共用錢包') setSharedWallet(updateRecord);
                  else if (s.recordedIn === '個人記帳') setPersonalWallet(updateRecord);
                }
                return finalData;
              }
              return s;
            }));
          } else {
            setShoppingList(p => [...p, { ...finalData, id: Date.now() }]);
          }
          setModal({ type: null }); setTempPhotos([]);
        }} className="w-full bg-pink-500 text-white font-bold py-4 rounded-2xl shadow-md active:scale-95 mt-1 text-base hover:bg-pink-600 transition-colors">確認儲存清單</button>
      </Modal>

      <BoughtModal isOpen={!!boughtModal} onClose={() => setBoughtModal(null)} onConfirm={handleConfirmBought} />
      <ConfirmDialog isOpen={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={() => confirmDel?.fn()} title={confirmDel?.title} message={confirmDel?.message} />
      <PhotoViewerModal isOpen={!!viewerPhotos} onClose={() => setViewerPhotos(null)} photos={viewerPhotos} initialIndex={viewerIndex} />
    </div>
  );
};

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

// ─── WalletTab ────────────────────────────────────────────────────────────────
const WalletTab = ({ onDownload }) => {
  const { allMembers, currentMember, sharedWallet, setSharedWallet, personalWallet, setPersonalWallet, allPersonalWallets, shoppingList, setShoppingList } = useMember();
  const [viewMemberId, setViewMemberId] = useState(currentMember.id);
  const [subTab, setSubTab] = useState('共用錢包');
  const [modal, setModal] = useState({ type: null, data: null });
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [dateConfirmDel, setDateConfirmDel] = useState(null);

  useEffect(() => {
    setViewMemberId(currentMember.id);
  }, [currentMember.id]);

  const viewPersonalWallet = useMemo(() => allPersonalWallets[viewMemberId] || [], [allPersonalWallets, viewMemberId]);
  const isOwner = viewMemberId === currentMember.id;
  const activeWallet = subTab === '共用錢包' ? sharedWallet : viewPersonalWallet;
  const setActiveWallet = subTab === '共用錢包' ? setSharedWallet : (isOwner ? setPersonalWallet : () => {});

  // 🌟 嚴格邏輯：動態抓取「有帳目」的日期，沒有帳目就絕對不會有頁籤
  const visibleWalletDates = useMemo(() => {
    return [...new Set(activeWallet.map(item => item.date))].sort();
  }, [activeWallet]);

  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return `${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getDate().toString().padStart(2, '0')}`;
  });

  // 當可視頁籤更新時，如果現在選的日期已經沒帳目了（被隱藏），自動切到最新的有帳目日期
  useEffect(() => {
    if (visibleWalletDates.length > 0 && !visibleWalletDates.includes(selectedDate)) {
      setSelectedDate(visibleWalletDates[visibleWalletDates.length - 1]);
    }
  }, [visibleWalletDates, selectedDate]);

  const walletTotals = useMemo(() => {
    const totals = { JPY: 0, KRW: 0, TWD: 0 };
    activeWallet.forEach(item => {
      const amt = Number(item.amount) || 0;
      if (item.type === '存入') totals[item.currency] += amt; else totals[item.currency] -= amt;
    });
    return totals;
  }, [activeWallet]);

  const filteredWalletItems = useMemo(() => {
    const list = activeWallet.filter(i => i.date === selectedDate);
    const order = { JPY: 1, KRW: 2, TWD: 3 };
    return [...list].sort((a, b) => order[a.currency] - order[b.currency] || (a.createdAt || 0) - (b.createdAt || 0));
  }, [activeWallet, selectedDate]);

  const dailySum = useMemo(() => {
    const sum = { JPY: 0, KRW: 0, TWD: 0 };
    filteredWalletItems.forEach(item => {
      const amt = Number(item.amount) || 0;
      if (item.type === '存入') sum[item.currency] += amt; else sum[item.currency] -= amt;
    });
    return sum;
  }, [filteredWalletItems]);

  useEffect(() => {
    onDownload(() => () => {
      let text = `${subTab} - ${selectedDate}\n\n`;
      filteredWalletItems.forEach(i => { text += `[${i.type}] ${i.name} : ${i.currency} ${i.amount}\n`; if (i.note) text += `備註: ${i.note}\n`; text += '--\n'; });
      downloadTextFile(text, `Wallet_${subTab}_${selectedDate.replace('/', '-')}`);
    });
  }, [filteredWalletItems, subTab, selectedDate, onDownload]);

  const handleDeleteWalletItem = (item) => {
    setConfirmDel({
      fn: () => {
        if (item.shoppingItemId) {
          setShoppingList(p => p.map(s => s.id === item.shoppingItemId ? { 
            ...s, price: null, currency: null, recordedIn: null, walletRecordId: null 
          } : s));
        }
        setActiveWallet(p => p.filter(w => w.id !== item.id));
      }
    });
  };

  // 🌟 一鍵刪除該日期底下所有帳目
  const handleDeleteDate = (d) => {
    setDateConfirmDel({
      fn: () => {
        const itemsToDelete = activeWallet.filter(w => w.date === d);
        itemsToDelete.forEach(item => {
          if (item.shoppingItemId) {
            setShoppingList(p => p.map(s => s.id === item.shoppingItemId ? { 
              ...s, price: null, currency: null, recordedIn: null, walletRecordId: null 
            } : s));
          }
        });
        setActiveWallet(p => p.filter(w => w.date !== d));
      }
    });
  };

  const handleAddClick = () => {
    const defaultDate = visibleWalletDates.includes(selectedDate) ? selectedDate : (visibleWalletDates[visibleWalletDates.length - 1] || `${(new Date().getMonth() + 1).toString().padStart(2, '0')}/${new Date().getDate().toString().padStart(2, '0')}`);
    setModal({ type: 'add', data: { type: '支出', currency: 'JPY', date: defaultDate } });
  };

  const currencyConfig = {
    JPY: { bg: 'bg-rose-50/70', border: 'border-rose-100', badge: 'bg-rose-500', sym: '¥', text: 'text-rose-600', textLight: 'text-rose-400' },
    KRW: { bg: 'bg-indigo-50/70', border: 'border-indigo-100', badge: 'bg-indigo-500', sym: '₩', text: 'text-indigo-600', textLight: 'text-indigo-400' },
    TWD: { bg: 'bg-emerald-50/70', border: 'border-emerald-100', badge: 'bg-emerald-500', sym: '$', text: 'text-emerald-600', textLight: 'text-emerald-400' },
  };

  return (
    <div className="relative animate-in fade-in pb-28">
      <div className="px-4 pt-5 mb-4">
        <div className="flex bg-violet-50/50 p-1.5 rounded-[2rem] border border-violet-100 mb-5">
          {['共用錢包', '個人記帳'].map(t => (
            <button key={t} onClick={() => setSubTab(t)} className={`flex-1 py-2.5 text-sm font-bold rounded-2xl transition-all ${subTab === t ? 'bg-violet-500 text-white shadow-md' : 'text-violet-400 hover:text-violet-600'}`}>{t}</button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {['JPY', 'KRW', 'TWD'].map(cur => {
            const c = currencyConfig[cur];
            const val = walletTotals[cur];
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
              <button key={d} onClick={() => setSelectedDate(d)} className={`flex-shrink-0 px-4 py-2 rounded-2xl text-xs font-bold transition-all border flex items-center gap-1.5 ${selectedDate === d ? 'bg-violet-50 text-violet-600 border-violet-200 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}>
                {d}
                <span onClick={e => { e.stopPropagation(); handleDeleteDate(d); }} className={`ml-1 transition-opacity ${selectedDate === d ? 'text-violet-400 hover:text-violet-600' : 'text-slate-300 hover:text-red-400'}`}>
                  <X size={14} />
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-3 text-[10px] font-black uppercase tracking-widest bg-white py-2 px-4 rounded-full border border-slate-200 shadow-sm w-fit ml-auto">
          {Object.entries(dailySum).map(([cur, val]) => (
            <span key={cur} className={val >= 0 ? 'text-red-500' : 'text-blue-500'}>{cur} {val > 0 ? '+' : ''}{val.toLocaleString()}</span>
          ))}
        </div>
      </div>

      <div className="space-y-3 px-4">
        {filteredWalletItems.map(item => {
          const c = currencyConfig[item.currency] || currencyConfig.TWD;
          const isIncome = item.type === '存入';
          return (
            <div key={item.id} className={`relative ${c.bg} border ${c.border} p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow group`}>
              <div className="absolute top-3 right-3 flex gap-1.5 z-10 opacity-80 hover:opacity-100 transition-opacity">
                {(subTab === '共用錢包' || isOwner) && (
                  <>
                    <button onClick={() => setModal({ type: 'edit', data: item })} className="p-1.5 text-slate-500 bg-white hover:bg-slate-50 rounded-lg transition-colors border border-slate-200 shadow-sm"><Edit2 size={13} /></button>
                    <button onClick={() => handleDeleteWalletItem(item)} className="p-1.5 text-red-500 bg-white hover:bg-red-50 rounded-lg transition-colors border border-red-200 shadow-sm"><Trash2 size={13} /></button>
                  </>
                )}
              </div>
              
              <div className="pt-1 pr-14">
                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                  <span className={`${c.badge} text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm`}>{item.currency}</span>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border bg-white ${isIncome ? 'text-red-500 border-red-200' : 'text-blue-500 border-blue-200'}`}>{item.type}</span>
                </div>
                {/* 🌟 項目名稱已放大回 text-base */}
                <h4 className="text-base font-bold text-slate-800 mb-1 leading-tight">{item.name}</h4>
                {item.note && <p className="text-xs text-slate-600 italic bg-white/70 border-l-4 border-violet-200 p-2 rounded-r-xl mb-1.5">{item.note}</p>}
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1"><History size={10} /> {item.lastEdited}</p>
              </div>

              <div className="flex justify-end items-center gap-1.5 mt-2">
                <p className={`text-xl font-black tracking-tight ${isIncome ? 'text-red-500' : 'text-blue-500'}`}>
                  {isIncome ? '+' : '-'}{item.currency === 'JPY' ? '¥' : item.currency === 'KRW' ? '₩' : '$'}{Number(item.amount).toLocaleString()}
                </p>
                {isIncome ? <TrendingUp size={22} className="text-red-400 opacity-80" /> : <TrendingDown size={22} className="text-blue-300 opacity-80" />}
              </div>
            </div>
          );
        })}
        {filteredWalletItems.length === 0 && <div className="py-20 text-center text-slate-400 text-xs font-bold uppercase tracking-widest italic opacity-80">此日尚無帳目</div>}
      </div>

      {(isOwner || subTab === '共用錢包') && (
        <button onClick={handleAddClick} className="fixed bottom-[110px] right-6 w-16 h-16 bg-violet-500 text-white rounded-[2rem] shadow-lg flex items-center justify-center active:scale-90 z-[60] border-4 border-white hover:bg-violet-600 transition-colors"><Plus size={30} strokeWidth={3} /></button>
      )}

      <Modal isOpen={!!modal.type} onClose={() => { setModal({ type: null, data: null }); setIsCalcOpen(false); }} title={modal.data?.id ? '編輯帳目' : '新增帳目'}>
        {!isOwner && subTab === '個人記帳' && (
          <div className="mb-4 rounded-3xl bg-slate-50 p-4 text-sm text-slate-500 border border-slate-100">
            目前檢視 {allMembers.find(m => m.id === viewMemberId)?.name || '成員'} 的個人記帳，僅能由本人編輯。
          </div>
        )}
        <FormField label="項目名稱" value={modal.data?.name} onChange={v => setModal({ ...modal, data: { ...modal.data, name: v } })} placeholder="如：晚餐公費" />
        <div className="flex bg-slate-50 p-1.5 rounded-2xl mb-4 shrink-0 border border-slate-100">
          {['存入', '支出'].map(t => (
            <button key={t} onClick={() => setModal({ ...modal, data: { ...modal.data, type: t } })} className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${modal.data?.type === t ? (t === '存入' ? 'bg-red-500 text-white shadow-md' : 'bg-blue-500 text-white shadow-md') : 'text-slate-400 hover:text-slate-600'}`}>{t}</button>
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
          <button onClick={() => setIsCalcOpen(!isCalcOpen)} className={`p-2.5 rounded-xl transition-colors shadow-sm border ${isCalcOpen ? 'bg-violet-500 text-white border-violet-500' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}><Calculator size={24} /></button>
        </div>
        {isCalcOpen && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0].map(n => (
              <button key={n} onClick={() => setModal({ ...modal, data: { ...modal.data, amount: (modal.data?.amount || '') + n.toString() } })} className="h-12 bg-white border border-slate-200 rounded-2xl font-bold text-slate-600 shadow-sm hover:bg-slate-50 active:bg-slate-100 text-base transition-colors">{n}</button>
            ))}
            <button onClick={() => setModal({ ...modal, data: { ...modal.data, amount: (modal.data?.amount || '').slice(0, -1) } })} className="h-12 bg-slate-100 border border-slate-200 rounded-2xl font-bold text-slate-600 flex items-center justify-center active:scale-90 hover:bg-slate-200 transition-colors"><Delete size={22} /></button>
          </div>
        )}
        <FormField label="備註（選填）" type="textarea" value={modal.data?.note} onChange={v => setModal({ ...modal, data: { ...modal.data, note: v } })} placeholder="輸入心得或詳情" />
        <button onClick={() => {
          if (!modal.data.amount || !modal.data.date) return;
          const formattedDate = modal.data.date.includes('-') ? modal.data.date.split('-').slice(1).join('/') : modal.data.date;
          
          const final = { ...modal.data, date: formattedDate, lastEdited: currentMember.name, createdAt: modal.data.createdAt || Date.now() };
          
          if (modal.data.id) {
            setActiveWallet(p => p.map(w => {
              if (w.id === modal.data.id) {
                if (w.shoppingItemId) {
                  setShoppingList(sList => sList.map(s => s.id === w.shoppingItemId ? {
                    ...s, price: final.amount, currency: final.currency, name: final.name.startsWith('購買: ') ? final.name.replace('購買: ', '') : final.name
                  } : s));
                }
                return final;
              }
              return w;
            }));
          } else {
            setActiveWallet(p => [...p, { ...final, id: Date.now() }]);
          }
          
          setSelectedDate(formattedDate);
          setModal({ type: null }); setIsCalcOpen(false);
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
    const targetList = sharedTodos.filter(t => subTab === '共用清單' ? t.type === '共用' : (t.type === '個人' && t.ownerId === viewMemberId));
    return [...targetList.filter(t => !t.status).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)), ...targetList.filter(t => t.status).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))];
  }, [sharedTodos, subTab, viewMemberId]);

  const isOwner = subTab === '共用清單' || viewMemberId === currentMember.id;

  useEffect(() => {
    onDownload(() => () => {
      let text = `${subTab}\n\n`;
      sortedTodos.forEach(i => { text += `[${i.status ? 'V' : ' '}] ${i.content}\n`; if (i.note) text += `備註: ${i.note}\n`; text += '--\n'; });
      downloadTextFile(text, `List_${subTab}`);
    });
  }, [sortedTodos, subTab, onDownload]);

  const handleToggle = (todo) => {
    if (!isOwner) return;
    const now = new Date();
    const ts = `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
    setSharedTodos(p => p.map(it => it.id === todo.id ? { ...it, status: !it.status, completedBy: !it.status ? currentMember.name : null, completedAt: !it.status ? ts : null } : it));
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
          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar px-1 pb-1">
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
        {sortedTodos.map(todo => (
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
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100 flex items-center gap-1"><History size={12} /> {todo.lastEdited}</span>
                  {todo.status && <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100 flex items-center gap-1"><CheckCircle2 size={12} /> {todo.completedBy} {todo.completedAt}</span>}
                </div>
              </div>
            </div>
          </div>
        ))}
        {sortedTodos.length === 0 && <div className="py-24 text-center text-slate-400 text-xs font-bold uppercase tracking-widest italic opacity-80">尚無項目</div>}
      </div>

      {isOwner && <button onClick={() => setModal({ type: 'todo', data: {} })} className="fixed bottom-[110px] right-6 w-16 h-16 bg-emerald-500 text-white rounded-[2rem] shadow-lg flex items-center justify-center active:scale-90 z-[60] border-4 border-white hover:bg-emerald-600 transition-colors"><Plus size={30} strokeWidth={3} /></button>}

      <Modal isOpen={!!modal.type} onClose={() => setModal({ type: null, data: null })} title={modal.data?.id ? '編輯清單' : '新增項目'}>
        <FormField label="內容" value={modal.data?.content} onChange={v => setModal({ ...modal, data: { ...modal.data, content: v } })} />
        <FormField label="備註（選填）" type="textarea" value={modal.data?.note} onChange={v => setModal({ ...modal, data: { ...modal.data, note: v } })} />
        <button onClick={() => {
          if (!modal.data.content) return;
          const final = { ...modal.data, type: subTab === '共用清單' ? '共用' : '個人', ownerId: currentMember.id, lastEdited: currentMember.name, status: modal.data.status || false, createdAt: modal.data.createdAt || Date.now() };
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
  const { currentMember, sharedNotes, setSharedNotes, personalNotes, setPersonalNotes } = useMember();
  const [subTab, setSubTab] = useState('共用記事');
  const [modal, setModal] = useState({ type: null, data: null });
  const [tempPhoto, setTempPhoto] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  
  // 預覽圖片狀態
  const [viewerPhotos, setViewerPhotos] = useState(null);

  const activeNotes = subTab === '共用記事' ? sharedNotes : personalNotes;
  const setActiveNotes = subTab === '共用記事' ? setSharedNotes : setPersonalNotes;

  const sortedNotes = useMemo(() => [...activeNotes].sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0)), [activeNotes]);

  useEffect(() => {
    onDownload(() => () => {
      let text = `${subTab}\n\n`;
      sortedNotes.forEach(i => { text += `[${i.date}] ${i.content}\n--\n`; });
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
        {sortedNotes.map(note => (
          <div key={note.id} className="relative bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm hover:shadow-md transition-shadow group animate-in slide-in-from-bottom-2">
            <div className="absolute top-4 right-4 flex gap-2 z-10 opacity-80 hover:opacity-100 transition-opacity">
              <button onClick={() => { setModal({ type: 'text', data: note }); setTempPhoto(note.photo || null); }} className="p-2 text-indigo-500 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors border border-indigo-100"><Edit2 size={14} /></button>
              <button onClick={() => setConfirmDel({ fn: () => setActiveNotes(p => p.filter(n => n.id !== note.id)) })} className="p-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-xl transition-colors border border-red-100"><Trash2 size={14} /></button>
            </div>
            {note.photo && <img src={note.photo} onClick={() => setViewerPhotos([note.photo])} alt="note" className="w-full h-48 object-cover rounded-[1.5rem] mb-4 shadow-sm border border-slate-100 cursor-pointer hover:opacity-90 transition-opacity" />}
            {note.content && <p className="text-slate-700 whitespace-pre-wrap leading-relaxed text-sm pr-16">{note.content}</p>}
            <div className="mt-4 pt-3 border-t border-slate-50 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <span>{note.date}</span>
              <span>由 {note.lastEdited} 編輯</span>
            </div>
          </div>
        ))}
        {sortedNotes.length === 0 && <div className="py-24 text-center text-slate-400 text-xs font-bold uppercase tracking-widest italic opacity-80">尚無記事</div>}
      </div>

      <div className="fixed bottom-[110px] right-6 flex flex-col gap-3 z-[60]">
        <button onClick={() => { setModal({ type: 'text', data: {} }); setTempPhoto(null); }} className="w-16 h-16 bg-indigo-500 text-white rounded-[2rem] shadow-lg flex items-center justify-center active:scale-90 border-4 border-white hover:bg-indigo-600 transition-colors"><FileText size={28} /></button>
        <button onClick={() => document.getElementById('note-photo-up').click()} className="w-16 h-16 bg-indigo-400 text-white rounded-[2rem] shadow-lg flex items-center justify-center active:scale-90 border-4 border-white hover:bg-indigo-500 transition-colors"><Camera size={28} /></button>
      </div>

      <input type="file" id="note-photo-up" className="hidden" accept="image/*" onChange={e => {
        const file = e.target.files[0];
        if (file) { const r = new FileReader(); r.onloadend = () => { setTempPhoto(r.result); setModal({ type: 'text', data: {} }); }; r.readAsDataURL(file); }
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
          const final = { ...modal.data, content: modal.data.content || '', photo: tempPhoto, date: modal.data.date || ts, lastEdited: currentMember.name, createdAtMs: modal.data.createdAtMs || now.getTime() };
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
        {[...allMembers].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).map(m => (
          <button key={m.id} onClick={() => login(m)} className="w-full bg-white border border-slate-100 p-4 rounded-[2rem] shadow-sm hover:shadow-md flex items-center gap-5 active:scale-95 transition-all text-left group">
            <Avatar member={m} className="w-14 h-14 shadow-sm" />
            <div className="flex-1">
              <h3 className="text-lg font-black text-slate-800">{m.name}</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{m.role}</p>
            </div>
            <ChevronRight size={24} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── MainLayout ───────────────────────────────────────────────────────────────
const MainLayout = () => {
  const { currentMember, logout, allMembers, setAllMembers, updateMember, trips } = useMember();
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

         {/* 置中大標題與緊鄰的下載按鈕 */}
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

      {/* Main Content Area - 移除原先的 pb-[100px]，將間距推至每個頁面內容底部 */}
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
            if (file) { const r = new FileReader(); r.onloadend = () => setEditPhoto(r.result); r.readAsDataURL(file); }
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
          {[...allMembers].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).map(m => (
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
          ))}
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
  return (
    <MemberProvider>
      <MemberContext.Consumer>
        {({ allMembers, currentMember }) => {
          if (allMembers.length === 0) return <InitScreen />;
          if (!currentMember) return <AuthScreen />;
          return <MainLayout />;
        }}
      </MemberContext.Consumer>
    </MemberProvider>
  );
}