# Astra 第一輪審查

日期：2026-11-14。範圍：phase0認證完成切片與phase1施工中版本。僅讀產品程式、補規劃與驗收文件；本輪未獨立重跑build或整合測試，測試結果引用Sol的`baseline-auth.md`，不宣稱整個workspace功能已通過。

## 已確認的改善

- 真實簽署60秒Socket ticket取代mock user 1；verify有timing-safe signature、expiry與user/sessionVersion檢查。
- 私人socket訂閱驗monitor owner，舊mutation回REST_REQUIRED，第二套server改為單一入口。
- API key使用stored SHA-256 hash並限v1；invalid key不退回有效cookie升權；active user/sessionVersion由DB驗證。
- 監測列表採明確DTO；production secret採runtime fail-closed；真PG+HTTP+Socket測試覆蓋基本越權與revocation。

## 需修正項目

| 優先 | 問題 | 所在檔案 | 驗收要求 |
| --- | --- | --- | --- |
| 高 | 首次setup先查無user後建立platformAdmin，匿名並行請求可建立多個admin | `server/api/auth/setup.post.ts` | transaction advisory lock內重查；兩個不同username並行setup只成功一次 |
| 高 | membership修改在workspace row lock之前驗actor role；等待鎖期間遭降級的owner仍可能使用過期role變更會員 | `server/api/v1/workspaces/[id]/members/index.post.ts`、`members/[userId].delete.ts` | row lock內重驗actor membership/role；交錯降級及刪除測試 |
| 中 | migration runner僅看users table存在就resolve baseline，不足以辨識不相容partial schema | `scripts/migrate.mjs` | 核心table/column/constraint fingerprint；未知schema拒絕且不新增migration history |
| 中 | 初稿migration將跨owner join quarantine後unlink，與總Plan預設保留並阻擋不一致 | `prisma/migrations/20261114010000_workspaces/migration.sql` | Sol已同意改preflight fail-closed；有錯資料fixture保持原內容，輸出repair定位 |
| 中 | heartbeat DTO仍原樣輸出msg，舊checker可能把實際JSON/token/URL放入msg | `server/utils/serialize.ts` | public完全省略raw msg；private/viewer使用安全分類與遮罩；sentinel測試覆蓋全輸出 |

Sol已收到上述問題並同意setup鎖與migration preflight修正；修正後應由下一輪檢查，不以口頭回覆視為結案。

## Phase1必補證據

現有phase0測試是兩個不同使用者，不足以證明workspace isolation。加入同一user兩workspace、同workspace不同user共享、每workspace兩env，以及API key限定env。socket、history、clone/import、public status/badge/RSS別名、bulk relations都納入負例。

原test對disabled socket透過主動emit觸發失效，還要測idle socket在membership撤銷後下一筆heartbeat不被送達。跨node delivery、4,000容量與K8s仍是後續階段；phase0測試不替代那些驗收。

補強文件：`docs/specs/2026-11-14-workspace-isolation.md`；新增可接續實作的`docs/specs/2026-11-14-api-assertions.md`、`docs/specs/2026-11-14-bruno-integration.md`。
