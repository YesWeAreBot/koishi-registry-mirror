# 使用官方 Bun 镜像
FROM oven/bun:1 as base

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 lock 文件
COPY package.json bun.lock* ./

# 安装依赖
# 开发和构建都需要 TypeScript 等 dev 依赖
RUN bun install --frozen-lockfile || bun install

# 复制源代码
COPY src/ ./src/
COPY tsconfig.json ./

# 构建应用
RUN bun run build

# 创建非 root 用户
RUN addgroup --system --gid 1001 bunjs
RUN adduser --system --uid 1001 bunjs

# 切换到非 root 用户
USER bunjs

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV NODE_ENV=production

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# 启动应用（服务器模式）
CMD ["bun", "run", "dist/cli.js", "server"]