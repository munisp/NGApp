package internal

import "os"

type Config struct {
	Endpoint   string
	TLSPolicy string
	Profile    string
}

func LoadConfig() *Config {
	return &Config{
		Endpoint:  getEnv("FLUVIO_ENDPOINT", "localhost:9003"),
		TLSPolicy: getEnv("FLUVIO_TLS_POLICY", "disabled"),
		Profile:   getEnv("FLUVIO_PROFILE", "default"),
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
