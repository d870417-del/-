import React, { useState, useEffect } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase";

// ─── 顏色主題（米色底 + 藍綠紫）───────────────────────────────
const C = {
  bg: "#F5F0E8",         // 米色底
  surface: "#FDFAF4",    // 卡片白米
  border: "#E2D9C8",     // 邊框
  blue: "#4A7FD4",       // 主藍
  blueSoft: "#EBF1FB",   // 淡藍背景
  green: "#3DAD8A",      // 主綠
  greenSoft: "#E8F7F2",  // 淡綠背景
  purple: "#8B5CF6",     // 主紫
  purpleSoft: "#F3EFFE", // 淡紫背景
  text: "#2D2A24",       // 深棕文字
  textMuted: "#9E9484",  // 淡棕文字
  danger: "#D95B5B",     // 錯誤紅
  dangerSoft: "#FDEAEA",
  success: "#3DAD8A",
  successSoft: "#E8F7F2",
};

const TRIP_COLORS = [C.blue, C.green, C.purple, "#E0875A", "#5AB4E0", "#AD5BBA", "#5ABF6B", "#D4A044"];
const TRIP_EMOJIS = ["✈️", "🏖️", "🗻", "🏙️", "🌏", "🚂", "🛳️", "🏕️", "🎡", "🗼", "🌸", "🍜"];

const gs = {
  app: {
    minHeight: "100vh",
    backgroundColor: C.bg,
    color: C.text,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    display: "flex",
    flexDirection: "column",
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: 18,
    border: `1px solid ${C.border}`,
    padding: "20px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
  },
  input: {
    width: "100%",
    backgroundColor: C.bg,
    border: `1.5px solid ${C.border}`,
    borderRadius: 12,
    padding: "13px 15px",
    color: C.text,
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
  },
  label: {
    display: "block",
    fontSize: 12,
    color: C.textMuted,
    marginBottom: 6,
    fontWeight: 600,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
};

// ─── Loading ──────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div style={{ ...gs.app, alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>🧳</div>
      <div style={{ color: C.textMuted, fontSize: 14 }}>載入中...</div>
    </div>
  );
}

// ─── 登入畫面 ─────────────────────────────────────────────────
function AuthScreen() {
  const [mode, setMode] = useState("login"); // login | register | forgot
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const errMap = {
    "auth/email-already-in-use": "這個 email 已經被註冊過了，請直接登入",
    "auth/invalid-email": "Email 格式不正確",
    "auth/weak-password": "密碼至少需要 6 個字元",
    "auth/user-not-found": "找不到這個帳號，請先註冊",
    "auth/wrong-password": "密碼錯誤",
    "auth/invalid-credential": "Email 或密碼錯誤",
    "auth/too-many-requests": "嘗試次數過多，請稍後再試",
  };

  async function handleSubmit() {
    setError(""); setMsg(""); setLoading(true);
    try {
      if (mode === "register") {
        if (!name.trim()) { setError("請輸入你的名稱"); setLoading(false); return; }
        if (!email.trim()) { setError("請輸入 Email"); setLoading(false); return; }
        if (password.length < 6) { setError("密碼至少需要 6 個字元"); setLoading(false); return; }
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name.trim() });
        await setDoc(doc(db, "users", cred.user.uid), {
          uid: cred.user.uid,
          displayName: name.trim(),
          email: email.toLowerCase(),
          createdAt: serverTimestamp(),
        });
        // 註冊完立刻登出，讓使用者重新登入
        await signOut(auth);
        setMsg("註冊成功！請用你的 email 和密碼登入 ✓");
        setMode("login");
        setName(""); setPassword("");
      } else if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await sendPasswordResetEmail(auth, email);
        setMsg("重設密碼信已寄出，請檢查你的信箱 📬");
        setLoading(false); return;
      }
    } catch (e) {
      setError(errMap[e.code] || "發生錯誤，請再試一次");
    }
    setLoading(false);
  }

  // 登入頁
  if (mode === "login") return (
    <div style={{ ...gs.app, alignItems: "center", justifyContent: "center", padding: "24px 20px" }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 72, height: 72, borderRadius: 22, margin: "0 auto 14px", background: `linear-gradient(135deg,${C.blue},${C.purple})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, boxShadow: "0 4px 20px rgba(74,127,212,0.3)" }}>🧳</div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>旅遊小助理</div>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>和朋友一起探索世界每個角落</div>
        </div>
        <div style={gs.card}>
          <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 20 }}>登入</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={gs.label}>Email</label>
              <input style={gs.input} type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label style={gs.label}>密碼</label>
              <input style={gs.input} type="password" placeholder="輸入密碼" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
            </div>
          </div>
          {error && <div style={{ marginTop: 12, padding: "10px 13px", backgroundColor: C.dangerSoft, borderRadius: 10, color: C.danger, fontSize: 13 }}>{error}</div>}
          {msg && <div style={{ marginTop: 12, padding: "10px 13px", backgroundColor: C.successSoft, borderRadius: 10, color: C.success, fontSize: 13 }}>{msg}</div>}
          <button onClick={handleSubmit} disabled={loading}
            style={{ width: "100%", border: "none", borderRadius: 13, padding: "14px", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 18, background: `linear-gradient(135deg,${C.blue},${C.purple})`, color: "#fff", opacity: loading ? 0.7 : 1 }}>
            {loading ? "登入中..." : "登入"}
          </button>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
            <button onClick={() => { setMode("forgot"); setError(""); setMsg(""); }}
              style={{ background: "none", border: "none", color: C.textMuted, fontSize: 12, cursor: "pointer", padding: 0 }}>
              忘記密碼？
            </button>
            <button onClick={() => { setMode("register"); setError(""); setMsg(""); }}
              style={{ background: "none", border: "none", color: C.blue, fontSize: 12, cursor: "pointer", padding: 0, fontWeight: 600 }}>
              還沒有帳號？點此註冊
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // 註冊頁
  if (mode === "register") return (
    <div style={{ ...gs.app, alignItems: "center", justifyContent: "center", padding: "24px 20px" }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 72, height: 72, borderRadius: 22, margin: "0 auto 14px", background: `linear-gradient(135deg,${C.green},${C.blue})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, boxShadow: "0 4px 20px rgba(61,173,138,0.3)" }}>🧳</div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>建立帳戶</div>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>加入旅遊小助理，開始規劃旅程</div>
        </div>
        <div style={gs.card}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={gs.label}>你的名稱</label>
              <input style={gs.input} placeholder="輸入暱稱" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label style={gs.label}>Email</label>
              <input style={gs.input} type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label style={gs.label}>密碼</label>
              <input style={gs.input} type="password" placeholder="至少 6 個字元" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
            </div>
          </div>
          {error && <div style={{ marginTop: 12, padding: "10px 13px", backgroundColor: C.dangerSoft, borderRadius: 10, color: C.danger, fontSize: 13 }}>{error}</div>}
          <button onClick={handleSubmit} disabled={loading}
            style={{ width: "100%", border: "none", borderRadius: 13, padding: "14px", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 18, background: `linear-gradient(135deg,${C.green},${C.blue})`, color: "#fff", opacity: loading ? 0.7 : 1 }}>
            {loading ? "建立中..." : "建立帳戶"}
          </button>
          <button onClick={() => { setMode("login"); setError(""); setMsg(""); }}
            style={{ background: "none", border: "none", color: C.textMuted, fontSize: 12, cursor: "pointer", width: "100%", marginTop: 12, padding: "4px 0" }}>
            ← 返回登入
          </button>
        </div>
      </div>
    </div>
  );

  // 忘記密碼頁
  return (
    <div style={{ ...gs.app, alignItems: "center", justifyContent: "center", padding: "24px 20px" }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={gs.card}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>重設密碼</div>
          <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>輸入你的 email，我們會寄送重設連結</div>
          <label style={gs.label}>Email</label>
          <input style={gs.input} type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} />
          {error && <div style={{ marginTop: 12, padding: "10px 13px", backgroundColor: C.dangerSoft, borderRadius: 10, color: C.danger, fontSize: 13 }}>{error}</div>}
          {msg && <div style={{ marginTop: 12, padding: "10px 13px", backgroundColor: C.successSoft, borderRadius: 10, color: C.success, fontSize: 13 }}>{msg}</div>}
          <button onClick={handleSubmit} disabled={loading}
            style={{ width: "100%", border: "none", borderRadius: 13, padding: "14px", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 16, background: `linear-gradient(135deg,${C.purple},${C.blue})`, color: "#fff", opacity: loading ? 0.7 : 1 }}>
            {loading ? "寄送中..." : "寄送重設信"}
          </button>
          <button onClick={() => { setMode("login"); setError(""); setMsg(""); }}
            style={{ background: "none", border: "none", color: C.textMuted, fontSize: 12, cursor: "pointer", width: "100%", marginTop: 12, padding: "4px 0" }}>
            ← 返回登入
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 旅程列表 ─────────────────────────────────────────────────
function TripListScreen({ user, onEnterTrip }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  useEffect(() => { loadTrips(); }, [user.uid]);

  async function loadTrips() {
    setLoading(true);
    try {
      const q = query(collection(db, "tripMembers"), where("uid", "==", user.uid));
      const snap = await getDocs(q);
      const tripIds = snap.docs.map(d => d.data().tripId);
      if (!tripIds.length) { setTrips([]); setLoading(false); return; }
      const tripDocs = await Promise.all(tripIds.map(id => getDoc(doc(db, "trips", id))));
      const loaded = tripDocs.filter(d => d.exists())
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setTrips(loaded);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "早安";
    if (h < 18) return "午安";
    return "晚安";
  };

  return (
    <div style={gs.app}>
      {/* Header 縮小版 */}
      <div style={{ padding: "52px 20px 14px", backgroundColor: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, color: C.textMuted }}>{greeting()}，</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{user.displayName || "旅行者"} 👋</div>
          </div>
          <button onClick={() => signOut(auth)}
            style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "6px 12px", color: C.textMuted, fontSize: 12, cursor: "pointer", fontWeight: 500 }}>
            登出
          </button>
        </div>
      </div>

      {/* 旅程列表 */}
      <div style={{ flex: 1, padding: "16px 20px", overflowY: "auto" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 12 }}>
          我的旅程
        </div>

        {loading ? (
          <div style={{ textAlign: "center", color: C.textMuted, paddingTop: 40 }}>載入中...</div>
        ) : trips.length === 0 ? (
          <div style={{ textAlign: "center", paddingTop: 50 }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>🗺️</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>還沒有旅程</div>
            <div style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6 }}>建立第一趟旅行<br />或輸入邀請碼加入朋友的旅程</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {trips.map((trip, i) => {
              const color = trip.color || TRIP_COLORS[i % TRIP_COLORS.length];
              const fmtDate = (d) => { if (!d) return null; const dt = new Date(d); return `${dt.getMonth()+1}/${dt.getDate()}`; };
              return (
                <button key={trip.id} onClick={() => onEnterTrip(trip)}
                  style={{ ...gs.card, cursor: "pointer", display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", width: "100%", textAlign: "left", background: C.surface }}>
                  <div style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, backgroundColor: color+"22", border: `1.5px solid ${color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                    {trip.emoji || "✈️"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{trip.name}</div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                      {trip.destination && `📍 ${trip.destination}`}
                      {trip.startDate && ` · ${fmtDate(trip.startDate)}${trip.endDate ? ` – ${fmtDate(trip.endDate)}` : ""}`}
                    </div>
                  </div>
                  <div style={{ color: color, fontSize: 18, fontWeight: 700 }}>›</div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 底部按鈕 */}
      <div style={{ padding: "12px 20px 36px", display: "flex", flexDirection: "column", gap: 10 }}>
        <button onClick={() => setShowCreate(true)}
          style={{
            width: "100%", border: "none", borderRadius: 14, padding: "15px",
            fontSize: 15, fontWeight: 700, cursor: "pointer",
            background: `linear-gradient(135deg, ${C.blue}, ${C.purple})`,
            color: "#fff", boxShadow: `0 4px 16px ${C.blue}40`,
          }}>
          ＋ 建立新旅程
        </button>
        <button onClick={() => setShowJoin(true)}
          style={{
            width: "100%", backgroundColor: C.surface, border: `1.5px solid ${C.border}`,
            borderRadius: 14, padding: "13px", fontSize: 14, fontWeight: 600,
            cursor: "pointer", color: C.textMuted,
          }}>
          輸入邀請碼加入旅程
        </button>
      </div>

      {showCreate && <CreateTripModal user={user} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); loadTrips(); }} />}
      {showJoin && <JoinTripModal user={user} onClose={() => setShowJoin(false)} onJoined={trip => { setShowJoin(false); onEnterTrip(trip); }} />}
    </div>
  );
}

// ─── 建立旅程 Modal ───────────────────────────────────────────
function CreateTripModal({ user, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [emoji, setEmoji] = useState("✈️");
  const [colorIdx, setColorIdx] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 根據開始/結束日期產生 mm/dd 陣列
  function generateDateList(start, end) {
    if (!start) return ["待安排"];
    const dates = ["待安排"];
    const s = new Date(start);
    const e = end ? new Date(end) : s;
    let cur = new Date(s);
    while (cur <= e) {
      const mm = String(cur.getMonth() + 1).padStart(2, "0");
      const dd = String(cur.getDate()).padStart(2, "0");
      dates.push(`${mm}/${dd}`);
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  }

  async function handleCreate() {
    if (!name.trim()) { setError("請輸入旅程名稱"); return; }
    if (startDate && endDate && endDate < startDate) { setError("結束日期不能早於開始日期"); return; }
    setLoading(true);
    try {
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const tripRef = await addDoc(collection(db, "trips"), {
        name: name.trim(),
        destination: destination.trim(),
        emoji,
        color: TRIP_COLORS[colorIdx],
        inviteCode,
        startDate: startDate || null,
        endDate: endDate || null,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, "tripMembers", `${tripRef.id}_${user.uid}`), {
        tripId: tripRef.id,
        uid: user.uid,
        displayName: user.displayName || user.email,
        role: "admin",
        joinedAt: serverTimestamp(),
      });
      // 自動建立行程日期頁籤
      const dates = generateDateList(startDate, endDate);
      await setDoc(doc(db, "tripData", `${tripRef.id}_itinerary`), {
        items: [],
        dates,
        updatedAt: serverTimestamp(),
      });
      onCreated();
    } catch (e) { setError("建立失敗，請再試一次"); }
    setLoading(false);
  }

  const tripColor = TRIP_COLORS[colorIdx];

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(45,42,36,0.5)", display: "flex", alignItems: "flex-end", zIndex: 100 }}>
      <div style={{ ...gs.card, width: "100%", borderBottomLeftRadius: 0, borderBottomRightRadius: 0, maxHeight: "88vh", overflowY: "auto", boxSizing: "border-box", borderBottom: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>建立新旅程</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 24, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        {/* Emoji */}
        <label style={gs.label}>旅程圖示</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {TRIP_EMOJIS.map(e => (
            <button key={e} onClick={() => setEmoji(e)}
              style={{ width: 44, height: 44, borderRadius: 11, fontSize: 22, cursor: "pointer", border: `2px solid ${emoji === e ? tripColor : C.border}`, backgroundColor: emoji === e ? tripColor + "18" : C.bg }}>
              {e}
            </button>
          ))}
        </div>

        {/* 顏色 */}
        <label style={gs.label}>顏色</label>
        <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
          {TRIP_COLORS.map((c, i) => (
            <button key={c} onClick={() => setColorIdx(i)}
              style={{ width: 30, height: 30, borderRadius: "50%", cursor: "pointer", backgroundColor: c, border: `3px solid ${colorIdx === i ? C.text : "transparent"}` }} />
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={gs.label}>旅程名稱 *</label>
            <input style={gs.input} placeholder="例：東京五天四夜" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label style={gs.label}>目的地</label>
            <input style={gs.input} placeholder="例：日本東京" value={destination} onChange={e => setDestination(e.target.value)} />
          </div>

          {/* 日期範圍 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={gs.label}>出發日期</label>
              <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); if (endDate && e.target.value > endDate) setEndDate(""); }}
                style={gs.input} />
            </div>
            <div>
              <label style={gs.label}>回程日期</label>
              <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)}
                style={gs.input} />
            </div>
          </div>

          {/* 預覽天數 */}
          {startDate && (
            <div style={{ padding: "10px 14px", backgroundColor: tripColor + "12", borderRadius: 10, border: `1px solid ${tripColor}33` }}>
              <div style={{ fontSize: 12, color: tripColor, fontWeight: 700 }}>
                {endDate
                  ? `共 ${Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1} 天・行程日期將自動預設`
                  : "未填回程日期，將只建立出發日的行程頁籤"}
              </div>
            </div>
          )}
        </div>

        {error && <div style={{ marginTop: 10, color: C.danger, fontSize: 13 }}>{error}</div>}

        <button onClick={handleCreate} disabled={loading}
          style={{ width: "100%", border: "none", borderRadius: 13, padding: "14px", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 20, background: `linear-gradient(135deg,${tripColor},${C.purple})`, color: "#fff", opacity: loading ? 0.7 : 1 }}>
          {loading ? "建立中..." : "建立旅程 ✈️"}
        </button>
      </div>
    </div>
  );
}

// ─── 加入旅程 Modal ───────────────────────────────────────────
function JoinTripModal({ user, onClose, onJoined }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleJoin() {
    if (!code.trim()) { setError("請輸入邀請碼"); return; }
    setLoading(true);
    try {
      const q = query(collection(db, "trips"), where("inviteCode", "==", code.trim().toUpperCase()));
      const snap = await getDocs(q);
      if (snap.empty) { setError("找不到這個邀請碼，請確認後再試"); setLoading(false); return; }
      const tripDoc = snap.docs[0];
      const tripId = tripDoc.id;
      const memberDoc = await getDoc(doc(db, "tripMembers", `${tripId}_${user.uid}`));
      if (!memberDoc.exists()) {
        await setDoc(doc(db, "tripMembers", `${tripId}_${user.uid}`), {
          tripId,
          uid: user.uid,
          displayName: user.displayName || user.email,
          role: "member",
          joinedAt: serverTimestamp(),
        });
      }
      onJoined({ id: tripId, ...tripDoc.data() });
    } catch (e) { setError("加入失敗，請再試一次"); }
    setLoading(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(45,42,36,0.5)", display: "flex", alignItems: "flex-end", zIndex: 100 }}>
      <div style={{ ...gs.card, width: "100%", borderBottomLeftRadius: 0, borderBottomRightRadius: 0, boxSizing: "border-box", borderBottom: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>加入旅程</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 24, cursor: "pointer" }}>×</button>
        </div>
        <label style={gs.label}>邀請碼</label>
        <input
          style={{ ...gs.input, fontSize: 24, letterSpacing: 6, textTransform: "uppercase", textAlign: "center", fontWeight: 700, color: C.purple }}
          placeholder="XXXXXX" value={code}
          onChange={e => setCode(e.target.value.toUpperCase())} maxLength={6} />
        {error && <div style={{ marginTop: 10, color: C.danger, fontSize: 13 }}>{error}</div>}
        <button onClick={handleJoin} disabled={loading}
          style={{
            width: "100%", border: "none", borderRadius: 13, padding: "14px",
            fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 16,
            background: `linear-gradient(135deg, ${C.green}, ${C.blue})`,
            color: "#fff", opacity: loading ? 0.7 : 1,
          }}>
          {loading ? "加入中..." : "加入旅程"}
        </button>
      </div>
    </div>
  );
}

// ─── 旅程內頁 ─────────────────────────────────────────────────
// ─── 確認刪除 Dialog ──────────────────────────────────────────
function ConfirmDialog({ isOpen, onClose, onConfirm, title, message }) {
  if (!isOpen) return null;
  return (
    <div style={{ position:'fixed', inset:0, zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div onClick={onClose} style={{ position:'absolute', inset:0, backgroundColor:'rgba(45,42,36,0.5)' }} />
      <div style={{ ...gs.card, position:'relative', width:'100%', maxWidth:320, textAlign:'center' }}>
        <div style={{ fontSize:32, marginBottom:10 }}>⚠️</div>
        <div style={{ fontSize:15, fontWeight:700, marginBottom:6 }}>{title || '確認刪除'}</div>
        <div style={{ fontSize:13, color:C.textMuted, marginBottom:20 }}>{message || '此操作無法復原'}</div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ flex:1, padding:'11px', border:`1px solid ${C.border}`, borderRadius:10, backgroundColor:C.bg, color:C.textMuted, fontSize:13, fontWeight:600, cursor:'pointer' }}>取消</button>
          <button onClick={() => { onClose(); setTimeout(() => onConfirm(), 50); }} style={{ flex:1, padding:'11px', border:'none', borderRadius:10, backgroundColor:C.danger, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>確認刪除</button>
        </div>
      </div>
    </div>
  );
}

// ─── 行程類別顏色 ─────────────────────────────────────────────
const getCategoryStyle = (cat) => {
  const map = {
    '景點': { bg: '#E8F7F2', color: C.green, border: '#B8E8D8' },
    '美食': { bg: '#FEF3E8', color: '#D97706', border: '#FDDCB0' },
    '購物': { bg: '#FDE8F3', color: '#BE185D', border: '#F9B8DA' },
    '交通': { bg: C.purpleSoft, color: C.purple, border: '#D4C4FF' },
    '住宿': { bg: C.blueSoft, color: C.blue, border: '#B8D0F8' },
    '其他': { bg: '#F0EDE8', color: C.textMuted, border: C.border },
  };
  return map[cat] || map['其他'];
};

// ─── 行程規劃 Tab ─────────────────────────────────────────────
function TripDetailScreen({ user, trip, onBack }) {
  const [members, setMembers] = React.useState([]);
  const [inviteVisible, setInviteVisible] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  // 行程資料狀態
  const [itinerary, setItinerary] = React.useState([]);
  const [tripDates, setTripDates] = React.useState(['待安排']);
  const [selectedDate, setSelectedDate] = React.useState('待安排');
  const [viewMode, setViewMode] = React.useState('list'); // list | map
  const [activeMapItem, setActiveMapItem] = React.useState(null);

  // Modal 狀態
  const [modal, setModal] = React.useState({ open: false, data: null });
  const [tempPhotos, setTempPhotos] = React.useState([]);
  const [confirmDel, setConfirmDel] = React.useState(null);
  const [datePickerOpen, setDatePickerOpen] = React.useState(false);
  const [viewerPhotos, setViewerPhotos] = React.useState(null);
  const [viewerIndex, setViewerIndex] = React.useState(0);
  const [activeTab, setActiveTab] = React.useState('itinerary'); // itinerary | members | invite

  // 載入資料
  React.useEffect(() => {
    loadMembers();
    loadItinerary();
  }, [trip.id]);

  async function loadMembers() {
    const q = query(collection(db, "tripMembers"), where("tripId", "==", trip.id));
    const snap = await getDocs(q);
    setMembers(snap.docs.map(d => d.data()));
  }

  async function loadItinerary() {
    try {
      const docRef = doc(db, "tripData", `${trip.id}_itinerary`);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        setItinerary(data.items || []);
        setTripDates(data.dates || ['待安排']);
      }
    } catch (e) { console.error(e); }
  }

  async function saveItinerary(newItems, newDates) {
    try {
      await setDoc(doc(db, "tripData", `${trip.id}_itinerary`), {
        items: JSON.parse(JSON.stringify(newItems)),
        dates: newDates || tripDates,
        updatedAt: serverTimestamp(),
      });
    } catch (e) { console.error(e); }
  }

  const filteredItems = React.useMemo(() => {
    const items = itinerary.filter(i => i.date === selectedDate);
    if (selectedDate === '待安排') return items.sort((a, b) => (a.createdAt||0) - (b.createdAt||0));
    return items.sort((a, b) => (a.time||'').localeCompare(b.time||''));
  }, [itinerary, selectedDate]);

  React.useEffect(() => {
    if (viewMode === 'map' && filteredItems.length > 0) {
      if (!activeMapItem || !filteredItems.find(i => i.id === activeMapItem.id)) {
        setActiveMapItem(filteredItems[0]);
      }
    }
  }, [viewMode, filteredItems]);

  function handleAddDate() {
    setDatePickerOpen(true);
  }

  function handleSelectDate(mmdd) {
    if (!tripDates.includes(mmdd)) {
      const newDates = ['待安排', ...[...tripDates.filter(d => d !== '待安排'), mmdd].sort()];
      setTripDates(newDates);
      saveItinerary(itinerary, newDates);
    }
    setSelectedDate(mmdd);
    setDatePickerOpen(false);
  }

  function handleDeleteDate(d) {
    if (d === '待安排') return;
    const newDates = tripDates.filter(x => x !== d);
    setTripDates(newDates);
    if (selectedDate === d) setSelectedDate('待安排');
    saveItinerary(itinerary, newDates);
  }

  function handleSaveItem() {
    if (!modal.data?.name?.trim()) return;
    const finalData = {
      ...modal.data,
      date: modal.data.date || selectedDate,
      photos: tempPhotos,
      editedByName: user.displayName || user.email,
      editedById: user.uid,
      createdAt: modal.data.createdAt || Date.now(),
    };
    let newItems;
    if (modal.data.id) {
      newItems = itinerary.map(it => it.id === modal.data.id ? finalData : it);
    } else {
      newItems = [...itinerary, { ...finalData, id: Date.now() }];
    }
    setItinerary(newItems);
    saveItinerary(newItems, tripDates);
    setModal({ open: false, data: null });
  }

  function handleDeleteItem(id) {
    const newItems = itinerary.filter(it => it.id !== id);
    setItinerary(newItems);
    saveItinerary(newItems, tripDates);
    setConfirmDel(null);
  }

  function copyCode() {
    navigator.clipboard.writeText(trip.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const color = trip.color || C.blue;

  // ── 日期選擇器 ──
  const DatePickerModal = () => {
    const [picked, setPicked] = React.useState('');
    if (!datePickerOpen) return null;
    return (
      <div style={{ position:'fixed', inset:0, zIndex:400, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
        <div onClick={() => setDatePickerOpen(false)} style={{ position:'absolute', inset:0, backgroundColor:'rgba(45,42,36,0.5)' }} />
        <div style={{ ...gs.card, position:'relative', width:'100%', maxWidth:320 }}>
          <div style={{ fontSize:16, fontWeight:700, marginBottom:16 }}>新增日期</div>
          <input type="date" value={picked} onChange={e => setPicked(e.target.value)}
            style={{ ...gs.input, marginBottom:16 }} />
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={() => setDatePickerOpen(false)} style={{ flex:1, padding:11, border:`1px solid ${C.border}`, borderRadius:10, backgroundColor:C.bg, color:C.textMuted, fontSize:13, fontWeight:600, cursor:'pointer' }}>取消</button>
            <button onClick={() => {
              if (!picked) return;
              const d = new Date(picked);
              const mmdd = `${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')}`;
              handleSelectDate(mmdd);
            }} disabled={!picked} style={{ flex:1, padding:11, border:'none', borderRadius:10, background:`linear-gradient(135deg,${color},${C.purple})`, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', opacity: picked ? 1 : 0.5 }}>新增</button>
          </div>
        </div>
      </div>
    );
  };

  // ── Tab 標籤 ──
  const tabs = [
    { id: 'itinerary', label: '行程' },
    { id: 'members', label: '成員' },
    { id: 'invite', label: '邀請' },
  ];

  return (
    <div style={gs.app}>
      {/* Header */}
      <div style={{ padding:'52px 20px 0', background:`linear-gradient(160deg,${color}18,${C.purpleSoft})`, borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
          <button onClick={onBack}
            style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, width:36, height:36, fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:C.text, flexShrink:0 }}>
            ←
          </button>
          <div style={{ width:44, height:44, borderRadius:13, flexShrink:0, backgroundColor:color+'22', border:`1.5px solid ${color}55`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>
            {trip.emoji || '✈️'}
          </div>
          <div>
            <div style={{ fontSize:18, fontWeight:800 }}>{trip.name}</div>
            {trip.destination && <div style={{ fontSize:12, color:C.textMuted }}>📍 {trip.destination}</div>}
          </div>
        </div>

        {/* Sub tabs */}
        <div style={{ display:'flex', gap:4 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{ padding:'8px 16px', border:'none', borderBottom: activeTab === t.id ? `2px solid ${color}` : '2px solid transparent', backgroundColor:'transparent', color: activeTab === t.id ? color : C.textMuted, fontSize:13, fontWeight:700, cursor:'pointer' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto' }}>

        {/* ── 行程 Tab ── */}
        {activeTab === 'itinerary' && (
          <div>
            {/* 日期選擇列 */}
            <div style={{ position:'sticky', top:0, zIndex:30, backgroundColor:C.surface, borderBottom:`1px solid ${C.border}`, padding:'10px 16px', boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <span style={{ fontSize:11, fontWeight:700, color:C.textMuted, letterSpacing:0.5, textTransform:'uppercase' }}>行程時間軸</span>
                <div style={{ display:'flex', gap:8 }}>
                  {/* 清單/地圖切換 */}
                  <div style={{ display:'flex', backgroundColor:C.bg, borderRadius:8, padding:3, border:`1px solid ${C.border}` }}>
                    {[['list','≡'],['map','⊙']].map(([m,icon]) => (
                      <button key={m} onClick={() => setViewMode(m)}
                        style={{ padding:'5px 10px', borderRadius:6, border:'none', backgroundColor: viewMode===m ? C.surface : 'transparent', color: viewMode===m ? color : C.textMuted, fontSize:14, cursor:'pointer', fontWeight:700, boxShadow: viewMode===m ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
                        {icon}
                      </button>
                    ))}
                  </div>
                  <button onClick={handleAddDate}
                    style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 10px', borderRadius:8, border:`1px solid ${color}44`, backgroundColor:color+'18', color, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                    ＋ 日期
                  </button>
                </div>
              </div>
              <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:2 }}>
                {tripDates.map(d => (
                  <div key={d} style={{ display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
                    <button onClick={() => setSelectedDate(d)}
                      style={{ padding:'6px 12px', borderRadius:10, border:`1.5px solid ${selectedDate===d ? color : C.border}`, backgroundColor: selectedDate===d ? color : C.surface, color: selectedDate===d ? '#fff' : C.textMuted, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                      {d}
                    </button>
                    {d !== '待安排' && (
                      <button onClick={() => handleDeleteDate(d)}
                        style={{ background:'none', border:'none', color:C.textMuted, fontSize:14, cursor:'pointer', padding:'0 2px', opacity:0.6 }}>×</button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 地圖模式 */}
            {viewMode === 'map' ? (
              <div style={{ padding:16 }}>
                <div style={{ height:280, borderRadius:16, overflow:'hidden', border:`1px solid ${C.border}`, marginBottom:12 }}>
                  {activeMapItem ? <MapEmbed query={activeMapItem.location || activeMapItem.name} /> : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:C.textMuted, fontSize:13 }}>請選擇行程項目</div>}
                </div>
                <div style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:4 }}>
                  {filteredItems.map((item, idx) => {
                    const isActive = activeMapItem?.id === item.id;
                    const catStyle = getCategoryStyle(item.category);
                    return (
                      <div key={item.id} onClick={() => setActiveMapItem(item)}
                        style={{ minWidth:180, padding:'12px 14px', borderRadius:14, flexShrink:0, border:`1.5px solid ${isActive ? color : C.border}`, backgroundColor: isActive ? color+'18' : C.surface, cursor:'pointer' }}>
                        <div style={{ fontSize:11, color: isActive ? color : C.textMuted, fontWeight:700, marginBottom:4 }}>
                          {item.time || '待定'} · {item.category}
                        </div>
                        <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{item.name}</div>
                        {item.location && <div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>📍 {item.location}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* 清單模式 */
              <div style={{ padding:'16px', position:'relative' }}>
                {filteredItems.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'60px 20px', color:C.textMuted, fontSize:13 }}>尚無行程，點右下角 ＋ 新增</div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:12, position:'relative' }}>
                    {selectedDate !== '待安排' && (
                      <div style={{ position:'absolute', left:19, top:28, bottom:28, width:2, backgroundColor:color+'33', zIndex:0 }} />
                    )}
                    {filteredItems.map((item, idx) => {
                      const catStyle = getCategoryStyle(item.category);
                      return (
                        <div key={item.id} style={{ display:'flex', gap:12, position:'relative', zIndex:1 }}>
                          {selectedDate !== '待安排' && (
                            <div style={{ width:40, flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', paddingTop:14 }}>
                              <div style={{ width:30, height:30, borderRadius:'50%', backgroundColor:color, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, boxShadow:`0 2px 8px ${color}55`, border:'2px solid #fff' }}>
                                {idx+1}
                              </div>
                            </div>
                          )}
                          <div style={{ flex:1, ...gs.card, padding:'14px 16px' }}>
                            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, marginBottom:10 }}>
                              <div style={{ display:'flex', gap:6, flexWrap:'wrap', flex:1 }}>
                                {item.time && (
                                  <span style={{ padding:'3px 8px', borderRadius:6, backgroundColor:color+'18', color, fontSize:11, fontWeight:700 }}>{item.time}</span>
                                )}
                                <span style={{ padding:'3px 8px', borderRadius:6, backgroundColor:catStyle.bg, color:catStyle.color, border:`1px solid ${catStyle.border}`, fontSize:11, fontWeight:700 }}>{item.category}</span>
                              </div>
                              <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                                <button onClick={() => { setModal({ open:true, data:item }); setTempPhotos(item.photos||[]); }}
                                  style={{ padding:'5px 8px', border:`1px solid ${C.border}`, borderRadius:8, backgroundColor:C.bg, color:C.textMuted, fontSize:12, cursor:'pointer' }}>✏️</button>
                                <button onClick={() => setConfirmDel(item.id)}
                                  style={{ padding:'5px 8px', border:`1px solid ${C.danger}33`, borderRadius:8, backgroundColor:'#FDE8E8', color:C.danger, fontSize:12, cursor:'pointer' }}>🗑</button>
                              </div>
                            </div>
                            <div style={{ fontSize:15, fontWeight:700, color:C.text, marginBottom:4 }}>{item.name}</div>
                            {item.location && (
                              <div style={{ fontSize:12, color:C.textMuted, marginBottom:6 }}>📍 {item.location}</div>
                            )}
                            {item.note && (
                              <div style={{ fontSize:12, color:'#5A5247', backgroundColor:'#F8F4EE', borderLeft:`3px solid ${color}`, padding:'8px 10px', borderRadius:'0 8px 8px 0', marginBottom:8, whiteSpace:'pre-wrap' }}>{item.note}</div>
                            )}
                            {item.photos?.length > 0 && (
                              <div style={{ display:'flex', gap:6, overflowX:'auto', marginBottom:8 }}>
                                {item.photos.map((p, i) => (
                                  <img key={i} src={p} onClick={() => { setViewerPhotos(item.photos); setViewerIndex(i); }}
                                    style={{ width:56, height:56, objectFit:'cover', borderRadius:8, flexShrink:0, cursor:'pointer', border:`1px solid ${C.border}` }} alt="pic" />
                                ))}
                              </div>
                            )}
                            <div style={{ fontSize:10, color:C.textMuted, marginTop:4 }}>
                              {item.editedByName || '成員'} 編輯
                            </div>
                            {item.mapUrl && (
                              <button onClick={() => window.open(item.mapUrl, '_blank')}
                                style={{ marginTop:8, padding:'6px 12px', borderRadius:8, border:`1px solid ${color}44`, backgroundColor:color+'18', color, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                                🗺 開啟地圖
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 新增按鈕 */}
            <button onClick={() => { setModal({ open:true, data:{ category:'景點', date:selectedDate } }); setTempPhotos([]); }}
              style={{ position:'fixed', bottom:24, right:24, width:58, height:58, borderRadius:18, border:'none', background:`linear-gradient(135deg,${color},${C.purple})`, color:'#fff', fontSize:28, cursor:'pointer', boxShadow:`0 4px 16px ${color}66`, display:'flex', alignItems:'center', justifyContent:'center', zIndex:60 }}>
              ＋
            </button>
          </div>
        )}

        {/* ── 成員 Tab ── */}
        {activeTab === 'members' && (
          <div style={{ padding:20 }}>
            <div style={gs.card}>
              <div style={{ fontSize:13, fontWeight:700, color:C.textMuted, letterSpacing:0.3, textTransform:'uppercase', marginBottom:12 }}>成員（{members.length} 人）</div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {members.map(m => {
                  const memberColors = [C.blue, C.green, C.purple, '#E0875A'];
                  const ci = (m.displayName||'').charCodeAt(0) % memberColors.length;
                  const mc = memberColors[ci];
                  return (
                    <div key={m.uid} style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:38, height:38, borderRadius:'50%', flexShrink:0, backgroundColor:mc+'22', border:`1.5px solid ${mc}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:700, color:mc }}>
                        {(m.displayName||'?')[0].toUpperCase()}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:600 }}>
                          {m.displayName}
                          {m.uid === user.uid && <span style={{ fontSize:11, color:C.textMuted, marginLeft:6 }}>（我）</span>}
                        </div>
                        {m.role === 'admin' && <div style={{ fontSize:11, color:C.blue, fontWeight:600 }}>管理員</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── 邀請 Tab ── */}
        {activeTab === 'invite' && (
          <div style={{ padding:20 }}>
            <div style={gs.card}>
              <div style={{ fontSize:13, fontWeight:700, color:C.textMuted, letterSpacing:0.3, textTransform:'uppercase', marginBottom:12 }}>邀請朋友加入</div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ flex:1, backgroundColor:C.bg, borderRadius:10, padding:'11px 14px', fontSize:22, fontWeight:800, letterSpacing:5, textAlign:'center', color: inviteVisible ? color : C.textMuted, border:`1.5px solid ${C.border}` }}>
                  {inviteVisible ? trip.inviteCode : '• • • • • •'}
                </div>
                <button onClick={() => setInviteVisible(v => !v)}
                  style={{ backgroundColor:C.bg, border:`1.5px solid ${C.border}`, borderRadius:10, padding:'11px 14px', fontSize:13, cursor:'pointer', color:C.textMuted, fontWeight:600, whiteSpace:'nowrap' }}>
                  {inviteVisible ? '隱藏' : '顯示'}
                </button>
              </div>
              {inviteVisible && (
                <button onClick={copyCode}
                  style={{ width:'100%', border:'none', borderRadius:10, padding:11, fontSize:13, fontWeight:700, cursor:'pointer', marginTop:8, backgroundColor: copied ? C.greenSoft : C.blueSoft, color: copied ? C.green : C.blue }}>
                  {copied ? '✓ 已複製！' : '複製邀請碼'}
                </button>
              )}
              <div style={{ marginTop:16, padding:'12px 14px', backgroundColor:C.bg, borderRadius:10, border:`1px solid ${C.border}` }}>
                <div style={{ fontSize:12, color:C.textMuted, marginBottom:4 }}>朋友輸入邀請碼加入步驟：</div>
                <div style={{ fontSize:12, color:C.text, lineHeight:1.7 }}>1. 開啟旅遊小助理並登入帳戶<br />2. 在旅程列表點「輸入邀請碼加入旅程」<br />3. 輸入 6 位邀請碼即可加入</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 新增/編輯 Modal ── */}
      {modal.open && (
        <div style={{ position:'fixed', inset:0, backgroundColor:'rgba(45,42,36,0.5)', display:'flex', alignItems:'flex-end', zIndex:200 }}>
          <div style={{ ...gs.card, width:'100%', borderBottomLeftRadius:0, borderBottomRightRadius:0, maxHeight:'88vh', overflowY:'auto', boxSizing:'border-box', borderBottom:'none' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
              <div style={{ fontSize:16, fontWeight:800 }}>{modal.data?.id ? '編輯行程' : '新增行程'}</div>
              <button onClick={() => setModal({ open:false, data:null })} style={{ background:'none', border:'none', color:C.textMuted, fontSize:24, cursor:'pointer' }}>×</button>
            </div>

            {/* 日期 + 時間 */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
              <div>
                <label style={gs.label}>日期</label>
                <select value={modal.data?.date || selectedDate} onChange={e => setModal(p => ({ ...p, data: { ...p.data, date:e.target.value } }))}
                  style={{ ...gs.input, cursor:'pointer' }}>
                  {tripDates.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={gs.label}>時間（選填）</label>
                <input type="time" value={modal.data?.time||''} onChange={e => setModal(p => ({ ...p, data: { ...p.data, time:e.target.value } }))} style={gs.input} />
              </div>
            </div>

            {/* 類別 */}
            <div style={{ marginBottom:12 }}>
              <label style={gs.label}>類別</label>
              <select value={modal.data?.category||'景點'} onChange={e => setModal(p => ({ ...p, data: { ...p.data, category:e.target.value } }))} style={{ ...gs.input, cursor:'pointer' }}>
                {['景點','美食','購物','交通','住宿','其他'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* 名稱 */}
            <div style={{ marginBottom:12 }}>
              <label style={gs.label}>項目名稱 *</label>
              <input style={gs.input} placeholder="例：逛淺草寺、晚餐一蘭拉麵" value={modal.data?.name||''} onChange={e => setModal(p => ({ ...p, data: { ...p.data, name:e.target.value } }))} />
            </div>

            {/* 地點 */}
            <div style={{ marginBottom:12 }}>
              <label style={gs.label}>📍 地點（選填）</label>
              <input style={gs.input} placeholder="例：淺草寺、東京都台東區" value={modal.data?.location||''} onChange={e => setModal(p => ({ ...p, data: { ...p.data, location:e.target.value } }))} />
            </div>

            {/* 地圖連結 */}
            <div style={{ marginBottom:12 }}>
              <label style={gs.label}>地圖連結（選填）</label>
              <input style={gs.input} placeholder="貼上 Google Maps 連結" value={modal.data?.mapUrl||''} onChange={e => setModal(p => ({ ...p, data: { ...p.data, mapUrl:e.target.value } }))} />
            </div>

            {/* 備註 */}
            <div style={{ marginBottom:12 }}>
              <label style={gs.label}>備註（選填）</label>
              <textarea value={modal.data?.note||''} onChange={e => setModal(p => ({ ...p, data: { ...p.data, note:e.target.value } }))} placeholder="心得、注意事項..." rows={3}
                style={{ ...gs.input, resize:'none', fontFamily:'inherit' }} />
            </div>

            {/* 相片 */}
            <div style={{ marginBottom:16 }}>
              <label style={gs.label}>相片（最多 5 張）</label>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {tempPhotos.map((url, i) => (
                  <div key={i} style={{ position:'relative', width:60, height:60, borderRadius:10, overflow:'hidden', border:`1px solid ${C.border}` }}>
                    <img src={url} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="tmp" />
                    <button onClick={() => setTempPhotos(p => p.filter((_,j) => j !== i))}
                      style={{ position:'absolute', top:2, right:2, width:18, height:18, borderRadius:4, backgroundColor:'rgba(220,50,50,0.9)', border:'none', color:'#fff', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
                  </div>
                ))}
                {tempPhotos.length < 5 && (
                  <button onClick={() => document.getElementById('trip-photo-input').click()}
                    style={{ width:60, height:60, borderRadius:10, border:`1.5px dashed ${C.border}`, backgroundColor:C.bg, color:C.textMuted, fontSize:22, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>📷</button>
                )}
              </div>
              <input type="file" id="trip-photo-input" style={{ display:'none' }} multiple accept="image/*" onChange={e => {
                Array.from(e.target.files).forEach(file => {
                  const r = new FileReader();
                  r.onloadend = async () => { const c = await compressImageBase64(r.result); setTempPhotos(p => p.length < 5 ? [...p, c] : p); };
                  r.readAsDataURL(file);
                });
              }} />
            </div>

            <button onClick={handleSaveItem}
              style={{ width:'100%', border:'none', borderRadius:13, padding:14, fontSize:15, fontWeight:700, cursor:'pointer', background:`linear-gradient(135deg,${color},${C.purple})`, color:'#fff' }}>
              確認儲存
            </button>
          </div>
        </div>
      )}

      <DatePickerModal />
      <ConfirmDialog isOpen={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={() => handleDeleteItem(confirmDel)} title="確認刪除" message="確定要刪除這個行程項目嗎？" />
      <PhotoViewerModal isOpen={!!viewerPhotos} onClose={() => setViewerPhotos(null)} photos={viewerPhotos} initialIndex={viewerIndex} />
    </div>
  );
}

// ─── 主 App ───────────────────────────────────────────────────
export default function App() {
  const [authUser, setAuthUser] = useState(undefined);
  const [currentTrip, setCurrentTrip] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      setAuthUser(user);
      if (!user) setCurrentTrip(null);
    });
    return unsub;
  }, []);

  if (authUser === undefined) return <LoadingScreen />;
  if (!authUser) return <AuthScreen />;
  if (currentTrip) return <TripDetailScreen user={authUser} trip={currentTrip} onBack={() => setCurrentTrip(null)} />;
  return <TripListScreen user={authUser} onEnterTrip={setCurrentTrip} />;
}
