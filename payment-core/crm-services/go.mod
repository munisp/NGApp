module github.com/enterprise-crm/customer-service

go 1.21

require (
	github.com/gin-gonic/gin v1.9.1
	github.com/gin-contrib/cors v1.4.0
	github.com/dapr/go-sdk v1.9.0
	github.com/go-playground/validator/v10 v10.14.0
	github.com/google/uuid v1.3.0
	github.com/lib/pq v1.10.9
	github.com/redis/go-redis/v9 v9.0.5
	github.com/sirupsen/logrus v1.9.3
	github.com/spf13/viper v1.16.0
	github.com/swaggo/gin-swagger v1.6.0
	github.com/swaggo/swag v1.16.1
	gorm.io/driver/postgres v1.5.2
	gorm.io/gorm v1.25.2
	go.temporal.io/sdk v1.24.0
	github.com/prometheus/client_golang v1.16.0
)

