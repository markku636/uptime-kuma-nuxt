# 66 項 typecheck 診斷：使用者影響與接續維修

依 `.data/validation-logs/final-settings-typecheck.log` 與 `final-typecheck-audit.json`，2026-11-14 Astra 唯讀核對目前 source。共66次診斷、58個不同檔案/行/列/code位置；重複8次是badge6、cluster1、real-browser1。全部出錯source line可在原版找到，**不代表原依賴／schema下也有同樣診斷，更不代表沒有runtime影響**。逐項分類見 [JSON](typecheck-user-impact.json)。沒有改產品或重跑整套測試。

| 分類 | 次數 | 判讀 |
| --- | ---: | --- |
| A 可達契約／資料顯示缺口 | 18 | 下面5項，含重複診斷；應優先維修 |
| B 舊元件／尚未證明頁面可達 | 13 | 原始碼有問題，但未搜尋到實際頁面引用；不得說現在點擊必壞 |
| C 明確不支援legacy checker | 4 | 不屬新scheduler支援範圍；不能為清typecheck宣稱協定已支援 |
| D UI color契約 | 13 | 舊red/white/gray等不符合Nuxt UI新semantic colors；可能樣式錯誤，非已證請求失效 |
| E 型別註解／未證runtime失效 | 16 | 需逐項收斂，不用any掩蓋；本輪未證明功能失效 |
| F 公開維護資訊接線待查 | 2 | dates欄位與DTO不一致，且composable未見maintenanceList賦值；不等於worker維護窗口失效 |

## 優先修復：目前可達路徑

| 項目／確切位置 | 使用者影響與證據 | 接續驗收 |
| --- | --- | --- |
| Badge：`server/api/badge/[id]/avg-response/[duration].get.ts:59`、`cert-exp.get.ts:67,77,85,98,105` | 傳三個字串參數，但`server/services/badge/generator.ts:16`只收options物件；解構後label undefined，`getTextWidth`讀length丟錯。monitor detail引用BadgeGeneratorModal，含這兩類選項。**本輪純函式呼叫已重現TypeError**，正確options回SVG；未發HTTP請求，故HTTP500是依handler路徑推論。cert-exp還讀sealed後為null的monitor.url，不能只改signature就宣稱能顯示TLS到期 | published monitor兩類badge真HTTP200且有效SVG；private維持404；TLS資料取既有安全cache，勿為public badge解密／增加任意外連。avg-response目前全raw讀取也須與既有bounded統計契約對齊 |
| 標籤設定：`pages/settings/tags.vue:46` | Edit送PUT `/api/v1/tags/:id`；實際route只有`[id].delete.ts`，無PUT/PATCH。這個頁面確實存在且有Edit按鈕；依route inventory推論保存失敗，未點擊實測 | 補同workspace editor可用的update handler或移除未實作操作；viewer/foreign ID拒絕；edit→reload名稱顏色持久化 |
| Session撤銷：`pages/settings/security.vue:159,170` | DELETE `/api/auth/sessions/:id`和POST `/api/auth/sessions/revoke-all`無handler。GET sessions在無session表時回目前session fallback；通常只有current row、按鈕隱藏，因此不能說現場已出現壞按鈕，但**單一／全部session撤銷能力未實作**。這不否定membership撤權、sessionVersion與logout既有測試，也不是已證授權繞過 | 定義符合現有cookie/sessionVersion的撤銷契約並實作／明示不支援；兩真client驗其他session失效及是否保留目前session。不可顯示成功toast充數 |
| Status page群組拖曳：`pages/status/[slug].vue:398` | StatusPublicGroupList在edit拖曳emit update:groups；handler呼叫未定義的reorderGroups。composable其實有匯出，但頁面destructure漏取。由完整事件接線可推論拖曳時ReferenceError、排序無法保存；未做browser拖曳實測 | 綁正確方法，兩group拖曳→保存→reload排序一致；既有monitors不可丟失／跨workspace |
| Legacy node時間：`server/api/cluster/nodes.get.ts:83` | schema只有lastSeen，讀lastHeartbeat必undefined，response lastCheck落回Date.now()，會把歷史心跳顯示成目前時間。MonitorForm有呼叫此endpoint。這是舊node metadata缺口，不是新`/api/v1/nodes/runtime` worker lease健康失效 | 改真欄位／明確legacy來源；固定舊lastSeen驗response，不讓假現在時間冒充活性 |

以上除badge純函式重現外，均是source／route／事件接線推論，不冒稱已在live UI／HTTP實測。產品最終77pass＋1skip沒有涵蓋所有這些互動，不能用總數否定缺口。

## 未證明當前頁面可達，但重新接入前必修

- `CreateGroupDialog.vue:96–98`把`{ok,data}`當直接monitor，created事件id/name為undefined（3項）。group為legacy類型，不能順便宣稱scheduled group支援。
- `TagEditDialog.vue:73`解構不存在的addTag並在create呼叫（1項）；useTags僅回createTag。且createTag目前把`{ok,data}`直接存為Tag，需一併修DTO。現MonitorForm只用fetchTags，不證明受此create路徑影響。
- `GroupEditor.vue:87`設value-key=id後拿到數字，handler卻讀monitor.id，會插undefined（1項）。目前未搜到GroupEditor頁面引用；現有StatusPublicGroupList是另一元件。
- `IncidentDialog.vue:168`編輯PUT incidents/:id沒有handler（1項）。現有status page使用別的postIncident流程，不由這個未引用dialog推論全部incident功能失效。
- `ScreenshotDialog.vue`讀錯response envelope且POST screenshot route不存在（4項）；real-browser scheduler本期明確不支援。
- `PingChart.vue`缺vue-chartjs/chart.js（2項）；未搜尋到目前頁面引用，build成功不表示這個元件可以重新啟用。
- `stores/ui.ts`persist:true無對應Pinia persistence plugin（1項）；未搜尋到useUIStore consumer。不能承諾這個store跨reload保存，也不推論其他已用localStorage的appearance設定全壞。

## 其餘分類的處理邊界

13項color診斷涵蓋ConfirmDialog、CopyableInput、HttpHeaders、MonitorConditions、LineNotify、GroupEditor、IncidentBanner、PublicGroupList；改成semantic color後應看實際warning/error視覺，不只消除TS。LineNotify舊provider元件並非本期支援通知transport，不能把color修復當provider恢復。

16項型別／未證runtime失效：locale/theme/style字串過寬（LanguageSelector、useAppearanceSettings、appearance、IncidentEditor）；Tag只做type import但types未export；MonitorCard的parseFloat(0)在JS可運作；MonitorListFilter數字tag ID與空字串union；EditSidebar漏perPage型別而API/schema實有欄位；status draftConfig optional相對prop required；PWA Uint8Array泛型過寬但helper實際new Uint8Array(length)；RSS套件有實作但缺declaration。這些仍阻擋typecheck，且目前不保證所有交互無bug。

公開status maintenance dates兩項：`pages/status/[slug].vue:691`讀startTime/endTime，但本地Maintenance型別只有id/title/description，composable未見maintenanceList.value寫入；應先確認公開維護清單實際來源／DTO／時區呈現，再決定修型別或接線。**本輪沒實測公開維護橫幅**，不要和已通過的worker抑制HTTP／窗口結束恢復混淆。

legacy checker的4次診斷為game/gamedig declaration、network/snmp-native declaration、real-browser CheckResult缺export（重複2次）；目前scheduler只支援HTTP/keyword/json-query與push，這些路徑維持明確不支援，未列為本次多node主流程失敗。

建議接續次序：badge／tags update／group drag → session撤銷能力與真UI說明 → legacy metadata與公開維護展示 → 不使用元件明確移除或修復 → semantic colors與型別收斂。每項用其實際HTTP／browser驗收，不再將「source line原版存在」當作免修理由。
