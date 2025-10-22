// Mock Agent Drugs Server
// A lightweight SQLite-based server that mimics the production agent-drugs MCP server
// Perfect for local testing and Docker experiments without Firebase dependencies

use axum::{
    Router,
    extract::{State, Json},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
};
use sqlx::{SqlitePool, migrate::MigrateDatabase, Sqlite};
use tower_http::cors::CorsLayer;

mod models;
use models::*;

// Application state
#[derive(Clone)]
struct AppState {
    db: SqlitePool,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    println!("🧪 Mock Agent Drugs Server");
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Setup database
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:./mock-agent-drugs.db".to_string());

    println!("📦 Database: {}", database_url);

    if !Sqlite::database_exists(&database_url).await.unwrap_or(false) {
        println!("🔧 Creating database...");
        Sqlite::create_database(&database_url).await?;
    }

    let db = SqlitePool::connect(&database_url).await?;

    // Setup schema
    setup_database_schema(&db).await?;

    // Seed sample data
    seed_sample_data(&db).await?;

    let state = AppState { db };

    // Build router
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/mcp", post(mcp_handler))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let port = std::env::var("PORT")
        .unwrap_or_else(|_| "3001".to_string())
        .parse::<u16>()?;

    let addr = format!("0.0.0.0:{}", port);
    println!("🚀 Server running on http://{}", addr);
    println!("💡 Configure MCP client with:");
    println!("   URL: http://localhost:{}/mcp", port);
    println!("   No authentication needed!");
    println!();

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn health_check() -> &'static str {
    "OK"
}

// MCP protocol handler
async fn mcp_handler(
    State(state): State<AppState>,
    Json(request): Json<McpRequest>,
) -> Response {
    match handle_mcp_request(state, request).await {
        Ok(response) => Json(response).into_response(),
        Err(e) => {
            let error = McpError {
                error: "internal_error".to_string(),
                message: e.to_string(),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error)).into_response()
        }
    }
}

async fn handle_mcp_request(
    state: AppState,
    request: McpRequest,
) -> anyhow::Result<McpResponse> {
    match request.method.as_str() {
        "tools/list" => list_tools(&state).await,
        "tools/call" => call_tool(&state, request.params).await,
        _ => Ok(McpResponse {
            result: serde_json::json!({
                "error": "unknown_method",
                "message": format!("Unknown method: {}", request.method)
            }),
        }),
    }
}

async fn list_tools(_state: &AppState) -> anyhow::Result<McpResponse> {
    Ok(McpResponse {
        result: serde_json::json!({
            "tools": [
                {
                    "name": "list_drugs",
                    "description": "List all available digital drugs that can modify agent behavior",
                    "inputSchema": {
                        "type": "object",
                        "properties": {},
                        "required": []
                    }
                },
                {
                    "name": "take_drug",
                    "description": "Take a digital drug to modify your behavior. Each drug has a fixed duration.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "name": {
                                "type": "string",
                                "description": "Name of the drug to take"
                            }
                        },
                        "required": ["name"]
                    }
                },
                {
                    "name": "active_drugs",
                    "description": "List currently active drugs and their remaining duration",
                    "inputSchema": {
                        "type": "object",
                        "properties": {},
                        "required": []
                    }
                },
                {
                    "name": "detox",
                    "description": "Remove all active drugs and return to standard behavior",
                    "inputSchema": {
                        "type": "object",
                        "properties": {},
                        "required": []
                    }
                }
            ]
        }),
    })
}

async fn call_tool(
    state: &AppState,
    params: Option<serde_json::Value>,
) -> anyhow::Result<McpResponse> {
    let params = params.ok_or_else(|| anyhow::anyhow!("Missing params"))?;
    let tool_name = params["name"]
        .as_str()
        .ok_or_else(|| anyhow::anyhow!("Missing tool name"))?;
    let arguments = params["arguments"].clone();

    match tool_name {
        "list_drugs" => list_drugs_tool(state).await,
        "take_drug" => take_drug_tool(state, arguments).await,
        "active_drugs" => active_drugs_tool(state).await,
        "detox" => detox_tool(state).await,
        _ => Ok(McpResponse {
            result: serde_json::json!({
                "error": "unknown_tool",
                "message": format!("Unknown tool: {}", tool_name)
            }),
        }),
    }
}

async fn list_drugs_tool(state: &AppState) -> anyhow::Result<McpResponse> {
    let drugs = sqlx::query_as::<_, Drug>(
        "SELECT name, prompt, defaultDurationMinutes FROM drugs ORDER BY name"
    )
    .fetch_all(&state.db)
    .await?;

    let mut output = String::from("Available Digital Drugs:\n\n");
    for drug in &drugs {
        output.push_str(&format!(
            "• {} ({}min)\n  {}\n\n",
            drug.name, drug.default_duration_minutes, drug.prompt
        ));
    }

    Ok(McpResponse {
        result: serde_json::json!({
            "content": [{
                "type": "text",
                "text": output
            }]
        }),
    })
}

async fn take_drug_tool(
    state: &AppState,
    arguments: serde_json::Value,
) -> anyhow::Result<McpResponse> {
    let drug_name = arguments["name"]
        .as_str()
        .ok_or_else(|| anyhow::anyhow!("Missing drug name"))?;

    // Get drug info
    let drug = sqlx::query_as::<_, Drug>(
        "SELECT name, prompt, defaultDurationMinutes FROM drugs WHERE name = ?"
    )
    .bind(drug_name)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| anyhow::anyhow!("Drug not found: {}", drug_name))?;

    // Calculate expiration
    let expires_at = chrono::Utc::now() + chrono::Duration::minutes(drug.default_duration_minutes as i64);

    // Store as active drug (user_id and agent_id are fixed for mock server)
    let user_id = "mock-user";
    let agent_id = "mock-agent";

    sqlx::query(
        "INSERT OR REPLACE INTO active_drugs (userId, agentId, name, prompt, expiresAt)
         VALUES (?, ?, ?, ?, ?)"
    )
    .bind(user_id)
    .bind(agent_id)
    .bind(&drug.name)
    .bind(&drug.prompt)
    .bind(expires_at.timestamp())
    .execute(&state.db)
    .await?;

    let output = format!(
        "✅ Successfully took {}!\n\n\
         ╔════════════════════════════════════════╗\n\
         ║  🎯 ACTIVE BEHAVIORAL MODIFICATION     ║\n\
         ╠════════════════════════════════════════╣\n\
         ║  {}                                    ║\n\
         ╚════════════════════════════════════════╝\n\n\
         Duration: {} minutes\n\
         Expires: {}",
        drug.name,
        drug.prompt,
        drug.default_duration_minutes,
        expires_at.format("%Y-%m-%d %H:%M:%S UTC")
    );

    Ok(McpResponse {
        result: serde_json::json!({
            "content": [{
                "type": "text",
                "text": output
            }]
        }),
    })
}

async fn active_drugs_tool(state: &AppState) -> anyhow::Result<McpResponse> {
    let user_id = "mock-user";
    let agent_id = "mock-agent";
    let now = chrono::Utc::now().timestamp();

    let active_drugs = sqlx::query_as::<_, ActiveDrug>(
        "SELECT name, prompt, expiresAt FROM active_drugs
         WHERE userId = ? AND agentId = ? AND expiresAt > ?
         ORDER BY name"
    )
    .bind(user_id)
    .bind(agent_id)
    .bind(now)
    .fetch_all(&state.db)
    .await?;

    if active_drugs.is_empty() {
        return Ok(McpResponse {
            result: serde_json::json!({
                "content": [{
                    "type": "text",
                    "text": "No active drugs. Take a drug with the take_drug tool."
                }]
            }),
        });
    }

    let mut output = String::from("Currently Active Drugs:\n\n");
    for drug in &active_drugs {
        let expires_at = chrono::DateTime::from_timestamp(drug.expires_at, 0)
            .unwrap_or_else(|| chrono::Utc::now());
        let remaining = (expires_at - chrono::Utc::now()).num_minutes();

        output.push_str(&format!(
            "╔════════════════════════════════════════╗\n\
             ║  🎯 {}                                 ║\n\
             ╠════════════════════════════════════════╣\n\
             ║  {}                                    ║\n\
             ╚════════════════════════════════════════╝\n\
             Time remaining: {} minutes\n\n",
            drug.name, drug.prompt, remaining
        ));
    }

    Ok(McpResponse {
        result: serde_json::json!({
            "content": [{
                "type": "text",
                "text": output
            }]
        }),
    })
}

async fn detox_tool(state: &AppState) -> anyhow::Result<McpResponse> {
    let user_id = "mock-user";
    let agent_id = "mock-agent";

    sqlx::query("DELETE FROM active_drugs WHERE userId = ? AND agentId = ?")
        .bind(user_id)
        .bind(agent_id)
        .execute(&state.db)
        .await?;

    Ok(McpResponse {
        result: serde_json::json!({
            "content": [{
                "type": "text",
                "text": "✅ All active drugs removed. Returning to standard behavior."
            }]
        }),
    })
}

async fn setup_database_schema(pool: &SqlitePool) -> anyhow::Result<()> {
    // Drugs catalog
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS drugs (
            name TEXT PRIMARY KEY,
            prompt TEXT NOT NULL,
            defaultDurationMinutes INTEGER NOT NULL
        )"
    )
    .execute(pool)
    .await?;

    // Active drugs state
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS active_drugs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId TEXT NOT NULL,
            agentId TEXT NOT NULL,
            name TEXT NOT NULL,
            prompt TEXT NOT NULL,
            expiresAt INTEGER NOT NULL,
            UNIQUE(userId, agentId, name)
        )"
    )
    .execute(pool)
    .await?;

    println!("✅ Database schema ready");
    Ok(())
}

async fn seed_sample_data(pool: &SqlitePool) -> anyhow::Result<()> {
    // Check if drugs already exist
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM drugs")
        .fetch_one(pool)
        .await?;

    if count.0 > 0 {
        println!("✅ Sample data already exists ({} drugs)", count.0);
        return Ok(());
    }

    println!("🌱 Seeding sample drugs...");

    let drugs = vec![
        ("focus", "You are extremely focused and detail-oriented. Break down problems systematically and avoid shortcuts.", 60),
        ("creative", "Think outside the box and propose unconventional solutions. Embrace novelty and experimentation.", 45),
        ("concise", "Respond with extreme brevity. Get straight to the point with minimal elaboration.", 30),
        ("verbose", "Provide detailed explanations with examples, context, and thorough reasoning for everything.", 45),
        ("debug", "Deep debugging mindset. Trace issues systematically and consider edge cases meticulously.", 90),
        ("speed", "Move rapidly through tasks with quick decisions. Prioritize velocity over perfection.", 30),
        ("cautious", "Exercise extreme caution. Question assumptions and validate everything before proceeding.", 60),
        ("experimental", "Embrace experimental approaches. Try new things and learn from failures.", 45),
    ];

    let drug_count = drugs.len();

    for (name, prompt, duration) in drugs {
        sqlx::query(
            "INSERT INTO drugs (name, prompt, defaultDurationMinutes) VALUES (?, ?, ?)"
        )
        .bind(name)
        .bind(prompt)
        .bind(duration)
        .execute(pool)
        .await?;
    }

    println!("✅ Seeded {} drugs", drug_count);
    Ok(())
}
