FROM oven/bun:alpine

WORKDIR /app

# 依存のみ先にコピーしてキャッシュ活用
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# Cloud Run の推奨: 非rootで実行
RUN addgroup -g 1001 -S appgroup && adduser -u 1001 -S appuser -G appgroup
USER appuser

# Cloud Run Jobs は HTTP サーバーを立ち上げない
# ポート公開は不要
CMD ["bun", "run", "src/index.ts"]
