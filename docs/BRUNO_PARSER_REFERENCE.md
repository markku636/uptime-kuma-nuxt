# Bruno parser 實作參考

日期：2026-11-14。Astra唯讀研究與隔離實測；未改產品程式。使用官方npm registry目前版本`@usebruno/lang@0.41.0`，研究安裝在`/tmp/astra-bruno-parser-review`且使用`--ignore-scripts`。產品應pin此實測版本及lock integrity，不直接跟隨GitHub main。

## 官方來源

- [npm package metadata](https://registry.npmjs.org/@usebruno%2Flang/latest)；本次版本0.41.0、tarball [lang-0.41.0.tgz](https://registry.npmjs.org/@usebruno/lang/-/lang-0.41.0.tgz)。
- [官方exports](https://github.com/usebruno/bruno/blob/main/packages/bruno-lang/src/index.js)、[request parser](https://github.com/usebruno/bruno/blob/main/packages/bruno-lang/v2/src/bruToJson.js)、[collection parser](https://github.com/usebruno/bruno/blob/main/packages/bruno-lang/v2/src/collectionBruToJson.js)、[environment parser](https://github.com/usebruno/bruno/blob/main/packages/bruno-lang/v2/src/envToJson.js)。
- [request fixture](https://github.com/usebruno/bruno/blob/main/packages/bruno-lang/v2/tests/fixtures/request.bru)與[對應AST](https://github.com/usebruno/bruno/blob/main/packages/bruno-lang/v2/tests/fixtures/request.json)；[collection fixture](https://github.com/usebruno/bruno/blob/main/packages/bruno-lang/v2/tests/fixtures/collection.bru)與[對應AST](https://github.com/usebruno/bruno/blob/main/packages/bruno-lang/v2/tests/fixtures/collection.json)。
- [environment官方測試](https://github.com/usebruno/bruno/blob/main/packages/bruno-lang/v2/tests/envToJson.spec.js)、[assertion官方測試](https://github.com/usebruno/bruno/blob/main/packages/bruno-lang/v2/tests/assert.spec.js)、[script官方測試](https://github.com/usebruno/bruno/blob/main/packages/bruno-lang/v2/tests/script.spec.js)。

以上fixtures也實際包含在0.41.0 npm tarball的`v2/tests/`。GitHub main的package.json版本與npm release不一致，npm gitHead在本次raw讀取亦未能取得，故以已發布tarball為本輪重現依據。

## 可直接使用的API

套件為CommonJS。Node ESM可用default import解構，或`createRequire(import.meta.url)`取得。所有parse函式同步回傳plain AST，語法錯誤throw；不執行script，但不代表所有AST安全或受本平台支援。

```ts
import brunoLang from '@usebruno/lang'
const { bruToJsonV2, collectionBruToJson, bruToEnvJsonV2,
  jsonToBruV2, jsonToCollectionBru, envJsonToBruV2 } = brunoLang

const request = bruToJsonV2(requestSource)
const collectionOrFolder = collectionBruToJson(collectionSource)
const environment = bruToEnvJsonV2(environmentSource)
```

函式簽章（以本次實測表示，不是假稱套件附TypeScript declaration）：`bruToJsonV2(source: string): RequestAst`、`collectionBruToJson(source: string): CollectionAst`、`bruToEnvJsonV2(source: string): { variables: Variable[] }`；對應stringify函式接受AST並回傳.bru字串。

## AST欄位與本平台映射

| Bruno AST | 實測形狀 | 映射要求 |
| --- | --- | --- |
| meta | name/type/seq；seq常是string | 只採name與安全metadata；檔案角色由path判定，不信meta |
| http | method為小寫；url、body、auth為string | method轉大寫再enum驗；body決定使用哪個body block；auth可能inherit |
| headers | `[{name,value,enabled}]` | disabled忽略；HTTP header name另驗，parser允許空白等HTTP非法name |
| params | `[{name,value,enabled,type:'query'|'path'}]` | query使用URLSearchParams避免拼接；path若未支援就阻擋，不能忽略 |
| query | collection/folder的query pair list | 繼承時仍處理enabled與優先序 |
| auth | basic:{username,password}、bearer:{token}；collection另有mode | mode由request http.auth或collection auth.mode決定；明確inherit/none；不要看到auth.basic就不論mode套用 |
| body | json/text為raw string，不是已parse JSON | 保留原body，檢查大小；未知body key或模式阻擋 |
| vars.req | `[{name,value,enabled,local}]` | 靜態pre-request值；local標誌不可當script runtime；限定安全字串subset |
| vars.res | 同上，value可能為回應expression | 首版全部拒絕，不能當靜態值 |
| assertions | `[{name:'res.status',value:'eq 200',enabled:true}]` | name與value都只是原始字串；自己tokenize operator/typed expected並轉共用AST |
| script | req/res或其他事件的字串 | 任何script entry都拒絕，不以truthy判斷來忽略空腳本 |
| tests | JavaScript字串 | 拒絕；官方assert fixture也包含任意function expression，不能eval |
| environment.variables | `[{name,value,enabled,secret}]` | `secret:true,value:''`代表缺值placeholder，不能當空secret自動成功 |
| annotations/dataType | typed variable可回number/boolean/object，另帶annotations與dataType | 首版拒typed annotation；description-only可忽略但明確列支持 |

request示例（Astra自行構造並經0.41.0實測）：

```bru
meta {
  name: Health
  type: http
  seq: 1
}
get {
  url: {{base}}/health
  body: none
  auth: bearer
}
auth:bearer {
  token: {{token}}
}
headers {
  Accept: application/json
  ~X-Disabled: ignored
}
assert {
  res.status: eq 200
  res.body.healthy: eq true
}
```

這會得到`http.method='get'`、`auth.bearer.token='{{token}}'`與兩個assertion pair；parser不會把`eq 200`拆成operator/value。Collection/folder用`collectionBruToJson`；folder的meta.type可能被正規化為collection，因此scope必須由檔案所在目錄得知。

## 明確拒絕清單

- `script:*`、`tests`、`vars:post-response`、任意runtime/request chaining；`process.env`、prompt/dynamic variables、module/file references。
- `grpc`、`ws`、CONNECT/TRACE/custom methods；auth:awsv4/digest/ntlm/oauth1/oauth2/wsse/apikey/akamai-edgegrid及OAuth額外參數，除非後續明確實作且驗收。
- body:xml/sparql/graphql/graphql:vars/form-urlencoded/multipart-form/file/grpc/ws及generic body的未定義語意；首版只json/text/none。
- `settings`與`app`整塊首版拒絕。settings會影響redirect/URL編碼/timeout，app可能有code，不能當無害metadata。
- unknown semantic field、unknown block、unsupported assertion expression/operator、typed variable、跨檔案inherit cycle或缺parent config。
- examples/docs可作非執行metadata忽略；若決定拒examples則在相容矩陣明示。bruno.json只讀安全collection name/version/ignore metadata，任何npm/script/proxy/config語意不生效；未知有行為含義的設定拒絕。

## 官方parser的陷阱與必補測試

1. parser接受任意assertion expression，例如function calls，AST本身不是安全檢查。絕不交給eval、Bruno runner或JavaScript engine。
2. 同檔兩個HTTP blocks會merge且最後method/url勝出，本次`get(url A)+post(url B)`只得到post B。要在parse前以受控top-level block掃描拒絕重複request block，不能只看最後AST。
3. `settings { unsupported: on }`的未知field被parser丟棄；首版拒settings整塊，可避免靜默失真。get block的未知field會保留，需nested strict whitelist。
4. HTTP非法header（例如空白name）也能parse，仍需共用request validation。重複header/query不可用Object.fromEntries靜默丟資料：明確支援多值或拒絕不支援重複。
5. `vars:secret`產生空值placeholder；preview要顯示secret缺漏，不能將其值曝露或自動當空字串。
6. typed @number/@boolean已被parser轉型，若本平台暫不支援typed vars要檢查dataType/annotations而非String(value)偷偷coerce。
7. 官方完整request fixture包含大量不支援body/auth/scripts，適合negative fixture；正向fixture應依實際子集自行構造，不能把整個官方fixture匯入後默默丟欄位。
8. parse error常附原始行，可能包含token/password；對UI/log只回file path、line/column及安全分類，不能直接return error.message。parser console輸出也需留意，例子解析錯誤不得洩漏來源內容。

安全解析預算：20MiB manifest不等於可在主API event loop同步parse 4000檔。先設明確單次檔數與parse budget，長批次採隔離worker可終止或chunk/yield；測大檔、未閉合block、nested annotations與duplicate blocks，避免import DoS。
