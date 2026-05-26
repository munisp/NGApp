package config

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestLoad_DefaultValues(t *testing.T) {
	cfg, err := Load()
	assert.NoError(t, err)
	assert.NotNil(t, cfg)
	assert.Equal(t, 8080, cfg.Server.Port)
	assert.Equal(t, "development", cfg.Server.Environment)
}

func TestLoad_ServerTimeouts(t *testing.T) {
	cfg, err := Load()
	assert.NoError(t, err)
	assert.Equal(t, 15, cfg.Server.ReadTimeout)
	assert.Equal(t, 15, cfg.Server.WriteTimeout)
	assert.Equal(t, 60, cfg.Server.IdleTimeout)
}

func TestLoad_DatabaseDefaults(t *testing.T) {
	cfg, err := Load()
	assert.NoError(t, err)
	assert.Contains(t, cfg.Database.URL, "postgres")
}

func TestLoad_RedisDefaults(t *testing.T) {
	cfg, err := Load()
	assert.NoError(t, err)
	assert.Contains(t, cfg.Redis.URL, "redis")
}

func TestLoad_EnvOverridePort(t *testing.T) {
	os.Setenv("PORT", "9090")
	defer os.Unsetenv("PORT")

	cfg, err := Load()
	assert.NoError(t, err)
	assert.Equal(t, 9090, cfg.Server.Port)
}

func TestLoad_EnvOverrideEnvironment(t *testing.T) {
	os.Setenv("ENVIRONMENT", "production")
	defer os.Unsetenv("ENVIRONMENT")

	cfg, err := Load()
	assert.NoError(t, err)
	assert.Equal(t, "production", cfg.Server.Environment)
}

func TestLoad_EnvOverrideDatabaseURL(t *testing.T) {
	os.Setenv("DATABASE_URL", "postgres://custom:5432/mydb")
	defer os.Unsetenv("DATABASE_URL")

	cfg, err := Load()
	assert.NoError(t, err)
	assert.Equal(t, "postgres://custom:5432/mydb", cfg.Database.URL)
}

func TestLoad_EnvOverrideRedisURL(t *testing.T) {
	os.Setenv("REDIS_URL", "redis://custom:6379/1")
	defer os.Unsetenv("REDIS_URL")

	cfg, err := Load()
	assert.NoError(t, err)
	assert.Equal(t, "redis://custom:6379/1", cfg.Redis.URL)
}

func TestGetEnv_ReturnsFallback(t *testing.T) {
	result := getEnv("NONEXISTENT_KEY_12345", "fallback_value")
	assert.Equal(t, "fallback_value", result)
}

func TestGetEnv_ReturnsEnvValue(t *testing.T) {
	os.Setenv("TEST_KEY_XYZ", "real_value")
	defer os.Unsetenv("TEST_KEY_XYZ")

	result := getEnv("TEST_KEY_XYZ", "fallback")
	assert.Equal(t, "real_value", result)
}
