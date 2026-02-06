package internal

import "os"

type Config struct {
	Mode              string
	LogLevel          string
	ThreatPrevention  bool
	MLModelPath       string
	MaxRequestBodyKB  int
}

func LoadConfig() *Config {
	return &Config{
		Mode:             getEnv("OPENAPPSEC_MODE", "prevent"),
		LogLevel:         getEnv("OPENAPPSEC_LOG_LEVEL", "info"),
		ThreatPrevention: getEnv("OPENAPPSEC_THREAT_PREVENTION", "true") == "true",
		MLModelPath:      getEnv("OPENAPPSEC_ML_MODEL_PATH", "/models"),
		MaxRequestBodyKB: 1024,
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
