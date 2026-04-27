# 使用轻量级 Node.js 基础镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json（如果存在）
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制所有源文件
COPY . .

# 端口映射已禁用，容器仅在内部使用

# 启动应用
CMD ["node", "server.js"]