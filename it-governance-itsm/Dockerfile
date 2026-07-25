FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /it-governance-itsm .

FROM alpine:3.19
RUN apk --no-cache add ca-certificates tzdata
COPY --from=builder /it-governance-itsm /it-governance-itsm
EXPOSE 8099
CMD ["/it-governance-itsm"]
