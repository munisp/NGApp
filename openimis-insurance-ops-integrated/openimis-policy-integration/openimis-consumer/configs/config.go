package configs

import (
	"github.com/spf13/viper"
	"log"
)

// Config holds the application configuration
type Config struct {
	KafkaBroker string `mapstructure:"KAFKA_BROKER"`
	KafkaTopic  string `mapstructure:"KAFKA_TOPIC"`
	KafkaGroup  string `mapstructure:"KAFKA_GROUP"`
	MetricsPort string `mapstructure:"METRICS_PORT"`
	DBConnStr   string `mapstructure:"DB_CONN_STR"`
}

// LoadConfig reads configuration from file or environment variables
func LoadConfig() (config Config, err error) {
	viper.AddConfigPath("./configs")
	viper.SetConfigName("consumer")
	viper.SetConfigType("env")

	viper.AutomaticEnv()

	err = viper.ReadInConfig()
	if err != nil {
		log.Printf("Warning: Could not read config file, using environment variables: %v", err)
	}

	err = viper.Unmarshal(&config)
	return
}
