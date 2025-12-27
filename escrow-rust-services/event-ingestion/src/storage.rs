//! RustFS (S3-compatible) storage client

use aws_config::Region;
use aws_sdk_s3::{
    config::{Credentials, SharedCredentialsProvider},
    primitives::ByteStream,
    Client,
};
use tracing::{debug, info};

use escrow_common::{
    config::RustFSConfig,
    Error, Result,
};

#[derive(Clone)]
pub struct RustFSClient {
    client: Client,
    default_bucket: String,
}

impl RustFSClient {
    pub async fn new(config: &RustFSConfig) -> Result<Self> {
        let credentials = Credentials::new(
            &config.access_key,
            &config.secret_key,
            None,
            None,
            "rustfs",
        );

        let sdk_config = aws_config::defaults(aws_config::BehaviorVersion::latest())
            .region(Region::new(config.region.clone()))
            .credentials_provider(SharedCredentialsProvider::new(credentials))
            .endpoint_url(&config.endpoint)
            .load()
            .await;

        let s3_config = aws_sdk_s3::config::Builder::from(&sdk_config)
            .force_path_style(true)
            .build();

        let client = Client::from_conf(s3_config);

        info!("RustFS client initialized for endpoint: {}", config.endpoint);

        Ok(Self {
            client,
            default_bucket: config.bucket.clone(),
        })
    }

    pub async fn put_object(&self, bucket: &str, key: &str, data: Vec<u8>) -> Result<()> {
        let body = ByteStream::from(data);

        self.client
            .put_object()
            .bucket(bucket)
            .key(key)
            .body(body)
            .send()
            .await
            .map_err(|e| Error::Internal(format!("Failed to put object: {}", e)))?;

        debug!("Uploaded object to s3://{}/{}", bucket, key);
        Ok(())
    }

    pub async fn get_object(&self, bucket: &str, key: &str) -> Result<Vec<u8>> {
        let response = self
            .client
            .get_object()
            .bucket(bucket)
            .key(key)
            .send()
            .await
            .map_err(|e| Error::Internal(format!("Failed to get object: {}", e)))?;

        let data = response
            .body
            .collect()
            .await
            .map_err(|e| Error::Internal(format!("Failed to read object body: {}", e)))?
            .into_bytes()
            .to_vec();

        debug!("Downloaded object from s3://{}/{}", bucket, key);
        Ok(data)
    }

    pub async fn delete_object(&self, bucket: &str, key: &str) -> Result<()> {
        self.client
            .delete_object()
            .bucket(bucket)
            .key(key)
            .send()
            .await
            .map_err(|e| Error::Internal(format!("Failed to delete object: {}", e)))?;

        debug!("Deleted object s3://{}/{}", bucket, key);
        Ok(())
    }

    pub async fn list_objects(&self, bucket: &str, prefix: &str) -> Result<Vec<String>> {
        let response = self
            .client
            .list_objects_v2()
            .bucket(bucket)
            .prefix(prefix)
            .send()
            .await
            .map_err(|e| Error::Internal(format!("Failed to list objects: {}", e)))?;

        let keys: Vec<String> = response
            .contents()
            .iter()
            .filter_map(|obj| obj.key().map(String::from))
            .collect();

        debug!("Listed {} objects in s3://{}/{}", keys.len(), bucket, prefix);
        Ok(keys)
    }

    pub async fn object_exists(&self, bucket: &str, key: &str) -> Result<bool> {
        match self
            .client
            .head_object()
            .bucket(bucket)
            .key(key)
            .send()
            .await
        {
            Ok(_) => Ok(true),
            Err(e) => {
                if e.to_string().contains("NotFound") || e.to_string().contains("404") {
                    Ok(false)
                } else {
                    Err(Error::Internal(format!("Failed to check object: {}", e)))
                }
            }
        }
    }

    pub async fn health_check(&self) -> bool {
        match self.client.list_buckets().send().await {
            Ok(_) => true,
            Err(e) => {
                tracing::error!("RustFS health check failed: {}", e);
                false
            }
        }
    }
}
