FROM node:24-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

FROM golang:1.26-alpine AS backend-builder

WORKDIR /app/backend

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./
RUN go build -o /app/api ./cmd/api

FROM golang:1.26-alpine

WORKDIR /app

RUN apk add --no-cache nodejs npm postgresql16 postgresql16-client su-exec

COPY --from=backend-builder /app/api /app/api
COPY --from=backend-builder /app/backend/migrations /app/migrations
COPY --from=frontend-builder /app/frontend/dist /app/public
COPY docker/start-single.sh /app/start-single.sh

RUN chmod +x /app/start-single.sh && \
    mkdir -p /var/lib/postgresql/data /run/postgresql && \
    chown -R postgres:postgres /var/lib/postgresql /run/postgresql

EXPOSE 8080 5432

CMD ["/app/start-single.sh"]
