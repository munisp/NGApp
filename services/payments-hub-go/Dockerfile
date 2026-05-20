FROM golang:1.22-alpine AS build
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o payments-hub .

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=build /app/payments-hub /usr/local/bin/
EXPOSE 8107
CMD ["payments-hub"]
