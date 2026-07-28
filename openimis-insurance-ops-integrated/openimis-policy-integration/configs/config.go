package configs

type Config struct {
	OpenIMIS OpenIMISConfig `mapstructure:"openimis"`
	Temporal TemporalConfig `mapstructure:"temporal"`
	Server   ServerConfig   `mapstructure:"server"`
}

type OpenIMISConfig struct {
	BaseURL string `mapstructure:"base_url"`
	Timeout int    `mapstructure:"timeout"` // in seconds
}

type TemporalConfig struct {
	HostPort string `mapstructure:"host_port"`
	TaskQueue string `mapstructure:"task_queue"`
}

type ServerConfig struct {
	Port int `mapstructure:"port"`
}
