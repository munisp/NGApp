FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /enterprise-mdm .

FROM alpine:3.19
RUN apk --no-cache add ca-certificates tzdata
COPY --from=builder /enterprise-mdm /enterprise-mdm
EXPOSE 8095
CMD ["/enterprise-mdm"]
