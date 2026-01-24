FROM openresty/openresty:alpine-fat

# 安裝必要套件
RUN apk add --no-cache curl

# 安裝必要的 Lua 模組
RUN opm install ledgetech/lua-resty-http

# 建立必要的目錄
RUN mkdir -p /usr/local/openresty/nginx/conf/conf.d \
    && mkdir -p /usr/local/openresty/nginx/conf/ssl \
    && mkdir -p /usr/local/openresty/nginx/logs \
    && mkdir -p /usr/local/openresty/lualib

# 複製 Nginx 設定
COPY nginx/nginx.conf /usr/local/openresty/nginx/conf/nginx.conf

# 複製 Lua 模組
COPY nginx/lua/ /usr/local/openresty/lualib/

# 暴露埠
EXPOSE 80

# 啟動 OpenResty
CMD ["/usr/local/openresty/bin/openresty", "-g", "daemon off;"]
