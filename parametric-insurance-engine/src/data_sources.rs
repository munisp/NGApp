/// Configuration for external data source integrations
pub struct DataSourceConfig {
    pub id: String,
    pub api_url: String,
    pub api_key: String,
    pub poll_interval_seconds: u64,
}

impl DataSourceConfig {
    pub fn chirps() -> Self {
        Self {
            id: "chirps".into(),
            api_url: "https://data.chc.ucsb.edu/products/CHIRPS-2.0/".into(),
            api_key: String::new(),
            poll_interval_seconds: 86400, // Daily
        }
    }

    pub fn nasa_power() -> Self {
        Self {
            id: "nasa_power".into(),
            api_url: "https://power.larc.nasa.gov/api/temporal/daily/point".into(),
            api_key: String::new(),
            poll_interval_seconds: 86400,
        }
    }

    pub fn openweathermap(api_key: &str) -> Self {
        Self {
            id: "openweathermap".into(),
            api_url: "https://api.openweathermap.org/data/2.5/".into(),
            api_key: api_key.to_string(),
            poll_interval_seconds: 3600, // Hourly
        }
    }

    pub fn flightaware(api_key: &str) -> Self {
        Self {
            id: "flightaware".into(),
            api_url: "https://aeroapi.flightaware.com/aeroapi/".into(),
            api_key: api_key.to_string(),
            poll_interval_seconds: 300, // Every 5 minutes
        }
    }
}
