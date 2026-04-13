import sys
with open('GAS/喵/FirebaseSync.gs', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Fetch existing students before payload generation
old_sync_start = """function BearFirebase_SyncStudentsAndGrades() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();

  var studentsPayload = {};
  var gradesPayload = {};"""

new_sync_start = """function BearFirebase_SyncStudentsAndGrades() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();

  // ★ 預先取得目前的學生資料，避免覆蓋掉 Firebase-only 的棒卡紀錄 (stickers)
  var existingStudentsUrl = BEAR_FB_DATABASE_URL + "/students.json?auth=" + BEAR_FB_DATABASE_SECRET;
  var existingStudentsRes = UrlFetchApp.fetch(existingStudentsUrl, {muteHttpExceptions: true});
  var existingStudents = {};
  if (existingStudentsRes.getResponseCode() == 200) {
      try { existingStudents = JSON.parse(existingStudentsRes.getContentText()) || {}; } catch(e) {}
  }

  var studentsPayload = {};
  var gradesPayload = {};"""

text = text.replace(old_sync_start, new_sync_start)

# 2. Preserve stickers in studentsPayload
old_payload_set = """        // ── 學生基本資料 ──
        var safeKey = BearFirebase_SafeKey(name);
        studentsPayload[sheetName][safeKey] = {
          name: name,
          password: finalPwd,
          className: sheetName,
          rowIndex: i
        };"""

new_payload_set = """        // ── 學生基本資料 ──
        var safeKey = BearFirebase_SafeKey(name);
        var oldStickers = 0;
        if (existingStudents[sheetName] && existingStudents[sheetName][safeKey]) {
            oldStickers = existingStudents[sheetName][safeKey].stickers || 0;
        }
        studentsPayload[sheetName][safeKey] = {
          name: name,
          password: finalPwd,
          className: sheetName,
          rowIndex: i,
          stickers: oldStickers
        };"""

text = text.replace(old_payload_set, new_payload_set)

with open('GAS/喵/FirebaseSync.gs', 'w', encoding='utf-8') as f:
    f.write(text)
print("FirebaseSync patched!")
