# 山熊科學 後台現代化改造計畫 - 完整交接手冊

> **給下一個工作視窗的你**：請完整閱讀本文件再開始動工。

---

## 🏠 專案概述

**目標**：把老師目前分散在多個 Google Apps Script (GAS) 專案中的行政工具，改造成：
1. **家長/學生端**：獨立網頁（Firebase Realtime Database 極速讀取，無 Google 廣告橫幅）
2. **教師後台**：統一的行政中心網頁（整合所有 GAS 功能）

**雙軌架構 (Dual-Track Architecture)**:
為確保與舊有系統的完整相容，目前的系統設計為：
- **讀取 (Reads)**：透過 Firebase 取得資料，達到極速載入 (依靠 `FirebaseSync.gs` 進行同步)。
- **寫入 (Writes)**：學生留言、上傳作業除了透過 HTTP POST (Fetch 呼叫 `doPost`) 打回原版 GAS 專案存檔，**也會同時利用 Firebase SDK 直接寫入 RTDB / Storage**。
- **檔案上傳 (Storage)**：**【極度重要】** 所有的檔案上傳（聯絡簿附件、公告附件、學生作業）皆已改為 Firebase 原生的**純二進制 `put(file)` 上傳**。絕對不可使用 `FileReader` 轉 Base64 上傳（這會導致手機 Safari 因記憶體耗盡而損壞 JPEG 圖檔）。
- **同步機制**：GAS 後台有提供「🐻 山熊老師專用 → 手動同步資料到 Firebase」按鈕，按下即可將試算表編輯更新到 Firebase (預防背景 5 分鐘同步不及時)。

**目前狀態**：關卡四接近完成 (上帝模式功能優化中、上傳穩定性已解決)

---

## 📁 重要資料夾位置

```
/Users/huangboyu/Desktop/code/       ← 所有程式碼統一放這裡
├── GAS/                      ← 原版 GAS 專案（只讀參考，不要亂動）
│   ├── 喵/                   ← 電子聯絡簿（最優先移植對象）
│   │   ├── index.html        ← 原版家長端（2462行，完整功能）
│   │   ├── Code.gs           ← 原版後端
│   │   ├── Admin.gs          ← 管理員後端
│   │   └── FirebaseSync.gs   ← 新增的同步精靈（已完成）
│   ├── 2026學生資料/          ← 學費單、訊息中心（第二優先）
│   ├── 高中/                 ← 高中部（第三優先）
│   └── 鑑定考成績單生成器/    ← 成績單生成器（第四優先）
│
├── bear-admin/               ← 新的現代化網頁（我們正在建的）
│   ├── README.md             ← 專案說明
│   └── ebook-app/            ← 第一個應用：電子聯絡簿
│       ├── index.html        ← 家長端主頁（進行中！有 bug）
│       ├── icon.png          ← 山熊 LOGO
│       ├── firebase-config.js ← Firebase 金鑰
│       ├── firebase.rules.json ← Firebase Rules 草稿
│       └── HANDOFF.md        ← 本文件
│
└── 山熊科學劃位系統/          ← 劃位系統（獨立維護）
```

---

## 🔥 Firebase 設定（已完成）

### 專案資訊
- **專案 ID**：`sciencebear-admin`
- **方案**：Blaze（付費，Storage 需要）
- **Database URL**：`https://sciencebear-admin-default-rtdb.asia-southeast1.firebasedatabase.app`（新加坡節點）

### firebase-config.js 內容
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyAMgXLb_pi11aY5p5O6MiQFGpvEFu5LsMA",
  authDomain: "sciencebear-admin.firebaseapp.com",
  databaseURL: "https://sciencebear-admin-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "sciencebear-admin",
  storageBucket: "sciencebear-admin.firebasestorage.app",
  messagingSenderId: "412913668862",
  appId: "1:412913668862:web:bf3df3f12b2f4979c48baf"
};
```

### Database Secret（GAS 同步用）
```
WEgppN5tL4LNQcVRk8g6ffkqZxPIYCzCwe11ZfeP
```

### Firebase 已有的資料節點
```
/students/     ← 各班學生名單（含密碼）
/grades/       ← 各班成績資料（含顏色、補考門檻）
/dailyPosts/   ← 聯絡簿記錄
/bulletins/    ← 公告
```

---

## ✅ 已完成的事項

1. **Firebase 專案建立** - sciencebear-admin
2. **Firebase Rules 設定** - 手動在控制台設定（開發模式）
3. **GAS 同步精靈** - `GAS/喵/FirebaseSync.gs` 已手動�貼入 GAS 編輯器並成功執行
4. **Firebase 有真實資料** - 學生、成績、聯絡簿都同步進去了
5. **ebook-app/index.html 穩定版** - 已解決手機照片上傳損毀問題，並優化上傳速度。
6. **手動同步功能** - 已在 GAS 介面新增按鈕，解決同步延遲問題。
7. **二進位上傳 (Binary Stream)** - 已棄用 Base64，全面改用 Firebase SDK 原生上傳。

---

## 🔴 目前的問題（index.html）

### 問題一：管理員沒有「上帝視角」中控台
原版 GAS/喵/index.html 的管理員（admin/miao）登入後應該看到一個**獨立的中控台畫面**，包含：
- 👀 **上帝視角** - 選班級 → 選學生 → 模擬進入該學生畫面
- 📝 **聯絡簿管理** - 新增/修改聯絡簿記錄
- 📢 **公告管理** - 發布/刪除公告
- 退出上帝視角時有「← 退出預覽」紅色浮動按鈕（`.admin-exit-btn`）

目前版本的管理員登入後跳到一般學生的 main-screen，沒有這些功能。

### 問題二：上帝視角需要的 JavaScript 函數缺失
需要實作：
- `showAdminScreen()` - 管理員登入後顯示中控台
- `loadClassList()` - 讀取 Firebase `/students` 填入班級下拉選單
- `loadStudentList()` - 選班級後填入學生下拉選單
- `startGodMode()` - 以選中的學生身份進入 main-screen（上帝視角）
- `exitGodMode()` - 退出上帝視角，回到管理員中控台
- `onAdminClassChange(type)` - 選擇班級後顯示「發布」按鈕
- `openPostModal(post)` - 開啟聯絡簿編輯 Modal（新增/修改）
- `submitPost()` - 儲存聯絡簿到 Firebase
- `openBulletinModal(bulletin)` - 開啟公告編輯 Modal
- `submitBulletin()` - 儲存公告到 Firebase

### 問題三：密碼修改功能
需要實作 `doChangePwd()` - 修改密碼後更新 Firebase `/students/[class]/[key]/password`

---

## 📋 下一步必做清單（按優先順序）

### 🔥 第一優先：管理員中控台 JS 函數

在 `index.html` 的 `<script>` 區塊中，找到 `function showMain()` 附近，修改邏輯：

```javascript
// 修改 showMain() → 管理員走不同路徑
function showMain() {
  if (currentUser.isAdmin) {
    showAdminScreen(); // 管理員走中控台
    return;
  }
  // 以下是一般學生的邏輯...
}

function showAdminScreen() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('main-screen').style.display = 'none';
  document.getElementById('admin-screen').style.display = 'block';
  loadClassList(); // 填入班級選單
}

async function loadClassList() {
  const snap = await db.ref('/students').once('value');
  const allStudents = snap.val() || {};
  const classes = Object.keys(allStudents);
  
  ['adminClassSelect', 'postTargetClass', 'bulletinTargetClass'].forEach(id => {
    const sel = document.getElementById(id);
    const defaultOpt = sel.options[0];
    sel.innerHTML = '';
    sel.appendChild(defaultOpt);
    classes.forEach(cls => {
      const opt = document.createElement('option');
      opt.value = cls;
      opt.textContent = cls;
      sel.appendChild(opt);
    });
  });
}

async function loadStudentList() {
  const cls = document.getElementById('adminClassSelect').value;
  if (!cls) return;
  const snap = await db.ref(`/students/${safeKey(cls)}`).once('value');
  const students = snap.val() || {};
  const sel = document.getElementById('adminStudentSelect');
  sel.innerHTML = '<option value="" disabled selected>請選擇學生</option>';
  Object.values(students).forEach(s => {
    if (!s.name) return;
    const opt = document.createElement('option');
    opt.value = s.name;
    opt.textContent = s.name;
    sel.appendChild(opt);
  });
  sel.disabled = false;
}

function startGodMode() {
  const cls = document.getElementById('adminClassSelect').value;
  const stu = document.getElementById('adminStudentSelect').value;
  if (!cls || !stu) { alert('請選擇班級和學生'); return; }
  
  // 暫時切換成學生身份（不改 localStorage）
  currentUser = { name: stu, className: cls, isAdmin: true, _wasAdmin: true };
  document.getElementById('admin-screen').style.display = 'none';
  document.getElementById('godModeExitBtn').style.display = 'block';
  document.getElementById('main-screen').style.display = 'block';
  document.getElementById('adminBanner').style.display = 'block';
  document.getElementById('adminViewingName').textContent = stu + '（' + cls + '）';
  document.getElementById('headerName').textContent = stu;
  document.getElementById('headerClass').textContent = cls;
  document.body.classList.add('admin-mode-border');
  loadUserData();
}

function exitGodMode() {
  currentUser = JSON.parse(localStorage.getItem('bear_user'));
  document.getElementById('main-screen').style.display = 'none';
  document.getElementById('godModeExitBtn').style.display = 'none';
  document.getElementById('adminBanner').style.display = 'none';
  document.body.classList.remove('admin-mode-border');
  showAdminScreen();
}
```

### 🔵 第二優先：聯絡簿管理（新增/修改）

直接寫入 Firebase `/dailyPosts/[safeClass]/[postId]/` 節點。

參照 `GAS/喵/index.html` 第 1638~1715 行的 Modal HTML（已分析，需要移植到新版）。

---

## 🧑‍💻 管理員測試帳密
- 帳號：`admin`
- 密碼：`miao`

## 🚀 本地測試方式

```bash
# 方法一：用 VS Code Live Server（Port 5500）
# 開啟 http://127.0.0.1:5500/bear-admin/ebook-app/index.html ✅

# 方法二：手動啟動 Python server
cd /Users/huangboyu/Desktop/code/bear-admin/ebook-app
python3 -m http.server 8787
# 然後開 http://localhost:8787
```

---

## 🗺️ 整體路線圖（長期）

| 關卡 | 名稱 | 狀態 |
|:--|:--|:--|
| 1 | Firebase 新專案建立 | ✅ 完成 |
| 2 | 本地端資料夾建立 | ✅ 完成 |
| 3 | GAS 同步精靈（FirebaseSync.gs） | ✅ 完成 |
| **4** | **ebook-app 電子聯絡簿前端**（家長端） | 🔧 **進行中** |
| 5 | 測試整合、部署 Firebase Hosting | ⬜ 待開始 |
| 6 | 學費單生成器移植（2026學生資料） | ⬜ 待開始 |
| 7 | 成績單生成器移植（鑑定考） | ⬜ 待開始 |
| 8 | 統一後台行政中心 | ⬜ 待開始 |

---

## 📌 重要注意事項

1. **`firebase-config.js` 含金鑰** - 不要上傳 GitHub（記得加 .gitignore）
2. **原版 GAS 完全不能動** - 老師日常工作仍在那裡跑，不能破壞，特別是在修改 `Code.gs` 與 `FirebaseSync.gs` 時只能**新增** (例如新增 `doPost`)，不可覆蓋原有的 `doGet` 或舊版 `index.html`。
3. **clasp 路徑** - Node.js 在 Homebrew，需要 `eval "$(/opt/homebrew/bin/brew shellenv)"` 或用完整路徑 `/opt/homebrew/bin/clasp`
4. **safeKey 函數必須和 GAS 端完全一致** - 否則 Firebase 讀不到資料

---

## 🔑 safeKey 函數（必須一致！）

```javascript
function safeKey(str) {
  return str.toString()
    .replace(/\./g, '_dot_').replace(/#/g, '_hash_').replace(/\$/g, '_dollar_')
    .replace(/\//g, '_slash_').replace(/\[/g, '_lb_').replace(/\]/g, '_rb_')
    .replace(/\s+/g, '_');
}
```

### 📌 附件儲存系統 (Firebase Storage)
*   **現狀**：已全面停止使用 Google Drive 作為對外附件的儲存與發布中樞。
*   **機制**：所有「老師上傳聯絡簿教材」與「學生上傳作業」皆已改為 Firebase 原生的**二進位 `put(file)` 直傳**。
*   **優勢**：不再透過 Base64 轉換（避免手機記憶體爆失），確保檔案 100% 完整，且獲得直連網址 (Download URL)，在手機端或 LINE 內部瀏覽器一鍵點開。

### 🗑 儲存空間維護建議（省錢祕訣）
*   **問題**：學生作業（特別是照片）長久累積會佔用 Firebase Storage 容量。
*   **對策一：Firebase 生命週期規則**：可前往 Google Cloud Console 設定規則，例如「超過 180 天的檔案自動刪除」。這是最推薦的「自動清理」法。
*   **對策二：每學期手動清理**：學期結束後，直接在 Firebase 控制台的 Storage 分頁，將 `uploads/` 內對應班級的資料夾刪除即可。
*   **對策三：成績歸檔**：學生畢業後（班級加 `_`），可考慮手動清理該班級的 Firebase 節點以節省空間。
