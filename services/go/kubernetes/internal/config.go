package internal

import "os"

type Config struct {
	KubeConfig string
	InCluster  bool
	Namespace  string
}

func LoadConfig() *Config {
	return &Config{
		KubeConfig: getEnv("KUBECONFIG", ""),
		InCluster:  getEnv("K8S_IN_CLUSTER", "false") == "true",
		Namespace:  getEnv("K8S_NAMESPACE", "fintech"),
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
