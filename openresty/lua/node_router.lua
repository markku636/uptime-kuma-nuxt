-- =============================================================================
-- node_router.lua
-- Nuxt.js 基本節點路由模組 (用於 docker-compose.yml)
-- =============================================================================

local _M = {}

local http = require "resty.http"
local cjson = require "cjson"

-- 節點配置 (固定三節點)
local nodes = {
    {
        id = "node1",
        name = "Node 1",
        host = "app1",
        port = 3000,
        url = "http://app1:3000"
    },
    {
        id = "node2",
        name = "Node 2",
        host = "app2",
        port = 3000,
        url = "http://app2:3000"
    },
    {
        id = "node3",
        name = "Node 3",
        host = "app3",
        port = 3000,
        url = "http://app3:3000"
    }
}

-- 初始化
function _M.init()
    local node_status = ngx.shared.node_status
    if not node_status then
        ngx.log(ngx.ERR, "Failed to get node_status shared dict")
        return false
    end
    
    for _, node in ipairs(nodes) do
        node_status:set(node.id .. ":healthy", false)
        node_status:set(node.id .. ":last_check", 0)
    end
    
    ngx.log(ngx.INFO, "Node router initialized with ", #nodes, " nodes")
    return true
end

-- 健康檢查
function _M.health_check()
    local node_status = ngx.shared.node_status
    if not node_status then
        ngx.log(ngx.ERR, "Failed to get node_status shared dict")
        return
    end
    
    local httpc = http.new()
    httpc:set_timeout(5000)  -- 5 秒超時
    
    for _, node in ipairs(nodes) do
        local ok = false
        local err_msg = ""
        
        local res, err = httpc:request_uri(node.url .. "/api/health", {
            method = "GET",
            headers = {
                ["Host"] = "localhost"
            }
        })
        
        if res then
            ok = res.status == 200
            if not ok then
                err_msg = "status " .. res.status
            end
        else
            err_msg = err or "unknown error"
        end
        
        node_status:set(node.id .. ":healthy", ok)
        node_status:set(node.id .. ":last_check", ngx.now())
        node_status:set(node.id .. ":error", err_msg)
        
        if ok then
            ngx.log(ngx.DEBUG, "Node ", node.id, " is healthy")
        else
            ngx.log(ngx.WARN, "Node ", node.id, " is unhealthy: ", err_msg)
        end
    end
end

-- 取得節點狀態列表
function _M.get_nodes()
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
            error = node_status:get(node.id .. ":error") or ""
        })
    end
    
    return result
end

-- 取得健康的節點
function _M.get_healthy_node()
    local node_status = ngx.shared.node_status
    if not node_status then
        return nodes[1]
    end
    
    for _, node in ipairs(nodes) do
        if node_status:get(node.id .. ":healthy") then
            return node
        end
    end
    
    -- 如果沒有健康的節點，返回第一個
    return nodes[1]
end

-- 根據 ID 取得節點
function _M.get_node_by_id(node_id)
    for _, node in ipairs(nodes) do
        if node.id == node_id then
            return node
        end
    end
    return nil
end

return _M
