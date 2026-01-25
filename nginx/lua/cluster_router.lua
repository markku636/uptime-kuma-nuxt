-- =============================================================================
-- cluster_router.lua
-- Nuxt.js 叢集動態路由模組
-- =============================================================================
-- 支援:
-- - 動態節點配置 (透過環境變數)
-- - 健康檢查
-- - 輪詢負載均衡
-- - Cookie 親和性
-- - 手動節點選擇
-- =============================================================================

local _M = {}

local http = require "resty.http"
local cjson = require "cjson"

-- 節點配置 (從環境變數載入或使用預設值)
local nodes = {}
local nodes_initialized = false

-- 載入節點配置
local function load_nodes_config()
    if nodes_initialized then
        return
    end
    
    local cluster_nodes_json = os.getenv("CLUSTER_NODES")
    
    if cluster_nodes_json then
        local ok, parsed = pcall(cjson.decode, cluster_nodes_json)
        if ok and type(parsed) == "table" then
            nodes = parsed
            ngx.log(ngx.INFO, "Loaded ", #nodes, " nodes from CLUSTER_NODES env")
        else
            ngx.log(ngx.ERR, "Failed to parse CLUSTER_NODES: ", cluster_nodes_json)
        end
    end
    
    -- 如果沒有配置，使用預設節點
    if #nodes == 0 then
        nodes = {
            { id = "node1", name = "Node 1", host = "app1", port = 3000 },
            { id = "node2", name = "Node 2", host = "app2", port = 3000 },
            { id = "node3", name = "Node 3", host = "app3", port = 3000 }
        }
        ngx.log(ngx.INFO, "Using default node configuration")
    end
    
    -- 為每個節點建立 URL
    for _, node in ipairs(nodes) do
        node.url = "http://" .. node.host .. ":" .. node.port
    end
    
    nodes_initialized = true
end

-- 初始化
function _M.init()
    load_nodes_config()
    
    local node_status = ngx.shared.node_status
    if not node_status then
        ngx.log(ngx.ERR, "Failed to get node_status shared dict")
        return false
    end
    
    for _, node in ipairs(nodes) do
        node_status:set(node.id .. ":healthy", false)
        node_status:set(node.id .. ":last_check", 0)
        node_status:set(node.id .. ":response_time", 0)
        node_status:set(node.id .. ":error", "")
    end
    
    -- 初始化輪詢計數器
    local rr_counter = ngx.shared.round_robin_counter
    if rr_counter then
        rr_counter:set("counter", 0)
    end
    
    ngx.log(ngx.INFO, "Cluster router initialized with ", #nodes, " nodes")
    return true
end

-- 健康檢查
function _M.health_check()
    load_nodes_config()
    
    local node_status = ngx.shared.node_status
    if not node_status then
        ngx.log(ngx.ERR, "Failed to get node_status shared dict")
        return
    end
    
    local timeout = tonumber(os.getenv("HEALTH_CHECK_TIMEOUT")) or 5000
    
    for _, node in ipairs(nodes) do
        local httpc = http.new()
        httpc:set_timeout(timeout)
        
        local ok = false
        local err_msg = ""
        local response_time = 0
        local start_time = ngx.now()
        
        local res, err = httpc:request_uri(node.url .. "/api/health", {
            method = "GET",
            headers = {
                ["Host"] = "localhost",
                ["User-Agent"] = "OpenResty-HealthCheck"
            }
        })
        
        response_time = (ngx.now() - start_time) * 1000  -- 轉換為毫秒
        
        if res then
            ok = res.status == 200
            if not ok then
                err_msg = "status " .. res.status
            end
        else
            err_msg = err or "connection failed"
        end
        
        -- 更新狀態
        node_status:set(node.id .. ":healthy", ok)
        node_status:set(node.id .. ":last_check", ngx.now())
        node_status:set(node.id .. ":response_time", response_time)
        node_status:set(node.id .. ":error", err_msg)
        
        if ok then
            ngx.log(ngx.DEBUG, "Node ", node.id, " healthy (", string.format("%.1f", response_time), "ms)")
        else
            ngx.log(ngx.WARN, "Node ", node.id, " unhealthy: ", err_msg)
        end
    end
end

-- 取得節點狀態列表
function _M.get_nodes()
    load_nodes_config()
    
    local node_status = ngx.shared.node_status
    if not node_status then
        return {}
    end
    
    local result = {}
    
    for _, node in ipairs(nodes) do
        table.insert(result, {
            id = node.id,
            name = node.name,
            host = node.host,
            port = node.port,
            healthy = node_status:get(node.id .. ":healthy") or false,
            lastCheck = node_status:get(node.id .. ":last_check") or 0,
            responseTime = node_status:get(node.id .. ":response_time") or 0,
            error = node_status:get(node.id .. ":error") or ""
        })
    end
    
    return result
end

-- 取得節點 ID 列表
function _M.get_node_ids()
    load_nodes_config()
    
    local ids = {}
    for _, node in ipairs(nodes) do
        table.insert(ids, node.id)
    end
    return ids
end

-- 取得健康節點數量
function _M.get_healthy_count()
    load_nodes_config()
    
    local node_status = ngx.shared.node_status
    if not node_status then
        return 0
    end
    
    local count = 0
    for _, node in ipairs(nodes) do
        if node_status:get(node.id .. ":healthy") then
            count = count + 1
        end
    end
    
    return count
end

-- 取得統計資訊
function _M.get_stats()
    load_nodes_config()
    
    local node_status = ngx.shared.node_status
    local rr_counter = ngx.shared.round_robin_counter
    
    local healthy_count = 0
    local total_response_time = 0
    
    for _, node in ipairs(nodes) do
        if node_status and node_status:get(node.id .. ":healthy") then
            healthy_count = healthy_count + 1
            total_response_time = total_response_time + (node_status:get(node.id .. ":response_time") or 0)
        end
    end
    
    return {
        totalNodes = #nodes,
        healthyNodes = healthy_count,
        unhealthyNodes = #nodes - healthy_count,
        avgResponseTime = healthy_count > 0 and (total_response_time / healthy_count) or 0,
        roundRobinCounter = rr_counter and rr_counter:get("counter") or 0
    }
end

-- 根據 ID 取得節點
function _M.get_node_by_id(node_id)
    load_nodes_config()
    
    for _, node in ipairs(nodes) do
        if node.id == node_id then
            local node_status = ngx.shared.node_status
            return {
                id = node.id,
                name = node.name,
                host = node.host,
                port = node.port,
                healthy = node_status and node_status:get(node.id .. ":healthy") or false
            }
        end
    end
    return nil
end

-- 取得健康的節點列表
local function get_healthy_nodes()
    load_nodes_config()
    
    local node_status = ngx.shared.node_status
    if not node_status then
        return nodes
    end
    
    local healthy = {}
    for _, node in ipairs(nodes) do
        if node_status:get(node.id .. ":healthy") then
            table.insert(healthy, node)
        end
    end
    
    -- 如果沒有健康的節點，返回所有節點讓 upstream 自行處理
    if #healthy == 0 then
        ngx.log(ngx.WARN, "No healthy nodes, returning all nodes")
        return nodes
    end
    
    return healthy
end

-- 輪詢選擇節點
function _M.select_node_round_robin()
    local healthy_nodes = get_healthy_nodes()
    
    if #healthy_nodes == 0 then
        ngx.log(ngx.ERR, "No nodes available")
        return ngx.exit(503)
    end
    
    local rr_counter = ngx.shared.round_robin_counter
    local counter = 0
    
    if rr_counter then
        counter = rr_counter:incr("counter", 1, 0) or 0
    end
    
    local index = (counter % #healthy_nodes) + 1
    local selected = healthy_nodes[index]
    
    ngx.ctx.target_host = selected.host
    ngx.ctx.target_port = selected.port
    ngx.ctx.target_node_id = selected.id
    
    ngx.log(ngx.DEBUG, "Round robin selected: ", selected.id)
end

-- 選擇節點 (支援 Cookie 親和性)
function _M.select_node()
    load_nodes_config()
    
    local selected_node = ngx.var.cookie_selected_node
    local node_status = ngx.shared.node_status
    
    -- 如果有選擇特定節點且節點健康
    if selected_node and selected_node ~= "" and selected_node ~= "auto" then
        local node = nil
        for _, n in ipairs(nodes) do
            if n.id == selected_node then
                node = n
                break
            end
        end
        
        if node then
            local is_healthy = node_status and node_status:get(node.id .. ":healthy")
            if is_healthy then
                ngx.ctx.target_host = node.host
                ngx.ctx.target_port = node.port
                ngx.ctx.target_node_id = node.id
                ngx.log(ngx.DEBUG, "Using selected node: ", node.id)
                return
            else
                ngx.log(ngx.WARN, "Selected node ", selected_node, " is unhealthy, falling back to round robin")
            end
        end
    end
    
    -- 預設使用輪詢
    _M.select_node_round_robin()
end

-- 取得預選的節點 (供 balancer 階段使用)
function _M.get_preselected_node()
    return ngx.ctx.target_host, ngx.ctx.target_port
end

return _M
