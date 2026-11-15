# Spec：Profile schema 修復

狀態：🔵 待實作。2026-11-14，Astra 規劃、Sol 唯一實作者。root 真 HTTP 發現 GET /api/auth/profile 500；source select/update 使用 User schema 不存在的 email/displayName/avatar。這是現有 UI 故障修復，不新增個人檔案 schema／上傳能力。

## 範圍與行為

GET/PUT 僅 cookie session 使用，匿名401、API-key-only拒絕（沿 session-only auth 契約），inactive／已失效session不得成功；以session user id查自己，不接受body指定id。GET安全DTO只含id、username、timezone、createdAt（可包含ok wrapper）；永不回password/hash、2FAsecret、sessionVersion或其他credentials。查詢明確select，不能整個User展開。

PUT只接受JSON `{timezone: string}`，strict schema拒未知欄位400（含username、email、displayName、avatar、id、platformAdmin），timezone以Intl.DateTimeFormat驗IANA支援值並設長度上限；非法值／缺值400、零partial update。不支援multipart/avatar，回明確400或415，不默默忽略。有效timezone更新自己的現有User.timezone，返回同安全DTO；不改username、角色、密碼、2FA或其他帳戶。無DB migration。

UI profile顯示唯讀username、真createdAt（不是今天）；timezone可修改並保存重載。移除不存在的email/displayName/avatar上傳表單；不要把所有人硬寫Administrator，可省略該欄或使用既有可信角色資料。GET失敗顯示明確可重試錯誤，不以fallback假裝成功載入可保存表單。SSR輸出timezone輸入與保存按鈕在onMounted前disabled，避免hydration前快速輸入被覆蓋；保存中disabled、成功toast、失敗error；手機不橫溢，保留security／appearance／notifications／APIkeys既有快捷入口，不擴改密碼/2FA流程。

## 驗收

真HTTP整合：session GET200符合schema；timezone有效PUT200後GET一致；unknownfields/非法timezone拒絕且DB不改；匿名與API-key-only無法讀寫；response不含credentials。測試至少兩user確認session只改自己；不可僅assert200而漏檢內容。既有suite可新增profile case，不需大型fixture。

瀏覽器：settings/profile無500、顯示真username/建立時間；改timezone、保存重載仍相同；表單可在390px操作。root MCP可作獨立最終確認；CLI browser不能記為MCP。需新production build包含修復後才能算站點已修，當前正在StageB載入的舊SHA不會自動變新。

## 受影響檔案

- `server/api/auth/profile.get.ts`、`server/api/auth/profile.put.ts`。
- `pages/settings/profile.vue`。
- `tests/profile.integration.test.ts`（或既有 `tests/auth.integration.test.ts` 內精確case）；若browser自動化納既有測試，可修改 `tests/scale-browser.integration.test.ts` 只新增此流程，不恢復取消的scale測試。
- `docs/validation/rest-maintenance-ui.md`／最終證據索引列本修復結果與實際artifact SHA。

如需共用schema/type，只限本profile用途且先追加實際path。不得新增 email/displayName/avatar DB欄、假profile值或把typecheck關閉作修復。
