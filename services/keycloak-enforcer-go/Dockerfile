FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY . .
RUN CGO_ENABLED=0 go build -o keycloak-enforcer-go .
FROM alpine:3.19
COPY --from=builder /app/keycloak-enforcer-go /usr/local/bin/
EXPOSE 8278
CMD ["keycloak-enforcer-go"]
