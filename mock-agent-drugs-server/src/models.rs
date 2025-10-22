use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// MCP Protocol types
#[derive(Debug, Deserialize)]
pub struct McpRequest {
    pub method: String,
    pub params: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct McpResponse {
    pub result: serde_json::Value,
}

#[derive(Debug, Serialize)]
pub struct McpError {
    pub error: String,
    pub message: String,
}

// Database models
#[derive(Debug, FromRow)]
pub struct Drug {
    pub name: String,
    pub prompt: String,
    #[sqlx(rename = "defaultDurationMinutes")]
    pub default_duration_minutes: i64,
}

#[derive(Debug, FromRow)]
pub struct ActiveDrug {
    pub name: String,
    pub prompt: String,
    #[sqlx(rename = "expiresAt")]
    pub expires_at: i64,
}
