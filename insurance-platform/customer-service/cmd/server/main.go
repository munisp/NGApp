package main

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"customer-service/internal/handlers"
	"customer-service/internal/repository"
	"customer-service/internal/service"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8081" }

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" { dbURL = "host=localhost port=5432 user=ngapp password=ngapp dbname=ngapp sslmode=disable" }

	db, err := sql.Open("postgres", dbURL)
	if err != nil { log.Fatalf("Failed to connect to database: %v", err) }
	defer db.Close()

	if err := db.Ping(); err != nil { log.Printf("WARNING: Database not reachable: %v", err) }

	repo := repository.NewCustomerRepository(db)
	svc := service.NewCustomerService(repo)
	handler := handlers.NewCustomerHandler(svc)

	router := gin.Default()
	handler.RegisterRoutes(router)

	srv := &http.Server{Addr: ":" + port, Handler: router}
	go func() {
		log.Printf("Customer Service (layered) starting on port %s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed { log.Fatalf("Server failed: %v", err) }
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
}
