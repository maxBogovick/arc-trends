use axum::{
    Router,
    body::{Body, to_bytes},
    extract::connect_info::ConnectInfo,
    http::{Request, StatusCode},
};
use serde_json::{Value, json};
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use tower::ServiceExt;
use ulid::Ulid;
use zdesagochi_backend::{config::Config, metrics, router::build_router, state::AppState};

struct TestHarness {
    app: Router,
}

impl TestHarness {
    async fn from_env() -> anyhow::Result<Option<Self>> {
        let database_url = match std::env::var("TEST_DATABASE_URL") {
            Ok(value) => value,
            Err(_) => {
                eprintln!("skipping HTTP integration test: TEST_DATABASE_URL is not set");
                return Ok(None);
            }
        };
        let redis_url = match std::env::var("TEST_REDIS_URL") {
            Ok(value) => value,
            Err(_) => {
                eprintln!("skipping HTTP integration test: TEST_REDIS_URL is not set");
                return Ok(None);
            }
        };

        let config = Config {
            database_url,
            redis_url,
            jwt_secret: "integration-test-jwt-secret-32-bytes-minimum".to_string(),
            jwt_expiry_seconds: 3600,
            refresh_token_expiry_seconds: 3600,
            host: "127.0.0.1".to_string(),
            port: 0,
            environment: "test".to_string(),
            cors_origins: vec!["http://localhost:5173".to_string()],
            log_level: "error".to_string(),
            rate_limit_requests_per_minute: 10_000,
        };

        let state = AppState::new(config).await?;
        sqlx::migrate!("./migrations").run(&state.db).await?;
        let prometheus = metrics::install_prometheus()?;
        let app = build_router(state, prometheus);
        Ok(Some(Self { app }))
    }

    async fn post_json(
        &self,
        path: &str,
        bearer: Option<&str>,
        body: Value,
    ) -> anyhow::Result<(StatusCode, Value)> {
        let mut builder = Request::builder()
            .method("POST")
            .uri(path)
            .header("content-type", "application/json");
        if let Some(token) = bearer {
            builder = builder.header("authorization", format!("Bearer {}", token));
        }
        let request = builder.body(Body::from(body.to_string()))?;
        self.send(request).await
    }

    async fn get_json(
        &self,
        path: &str,
        bearer: Option<&str>,
    ) -> anyhow::Result<(StatusCode, Value)> {
        let mut builder = Request::builder().method("GET").uri(path);
        if let Some(token) = bearer {
            builder = builder.header("authorization", format!("Bearer {}", token));
        }
        let request = builder.body(Body::empty())?;
        self.send(request).await
    }

    async fn send(&self, mut request: Request<Body>) -> anyhow::Result<(StatusCode, Value)> {
        request.extensions_mut().insert(ConnectInfo(SocketAddr::new(
            IpAddr::V4(Ipv4Addr::LOCALHOST),
            3000,
        )));
        let response = self.app.clone().oneshot(request).await?;
        let status = response.status();
        let bytes = to_bytes(response.into_body(), usize::MAX).await?;
        let body = if bytes.is_empty() {
            Value::Null
        } else {
            serde_json::from_slice(&bytes)?
        };
        Ok((status, body))
    }
}

#[tokio::test]
async fn auth_pet_action_and_offline_sync_http_flow() -> anyhow::Result<()> {
    let Some(harness) = TestHarness::from_env().await? else {
        return Ok(());
    };

    let suffix = Ulid::new().to_string().to_ascii_lowercase();
    let email = format!("integration-{}@example.test", suffix);
    let username = format!("it{}", &suffix[..12]);
    let password = "integration-password";

    let (status, register) = harness
        .post_json(
            "/api/auth/register",
            None,
            json!({
                "username": username,
                "email": email,
                "password": password,
            }),
        )
        .await?;
    assert_eq!(status, StatusCode::OK, "register body: {}", register);
    let token = register["token"].as_str().expect("token").to_string();

    let (status, pet) = harness.get_json("/api/pet", Some(&token)).await?;
    assert_eq!(status, StatusCode::OK, "pet body: {}", pet);
    assert_eq!(pet["currentSync"], 0);

    let (status, play) = harness
        .post_json("/api/pet/play", Some(&token), json!({ "score": 100 }))
        .await?;
    assert_eq!(status, StatusCode::OK, "play body: {}", play);
    assert!(
        play["pet"]["formationProgress"]
            .as_f64()
            .unwrap_or_default()
            > 0.0
    );
    assert_eq!(play["coinsGained"], 17);

    let command_id = format!("cmd-{}", Ulid::new());
    let (status, ack) = harness
        .post_json(
            "/api/pet/sync/commands",
            Some(&token),
            json!({
                "clientId": "integration-client",
                "baseCommandId": null,
                "commands": [{
                    "type": "feed",
                    "commandId": command_id,
                    "foodId": "apple",
                    "at": "2026-05-16T12:00:00Z"
                }]
            }),
        )
        .await?;
    assert_eq!(status, StatusCode::OK, "sync ack body: {}", ack);
    assert_eq!(ack["acceptedCommandIds"].as_array().unwrap().len(), 1);
    assert_eq!(ack["rejectedCommandIds"].as_array().unwrap().len(), 0);

    let (status, results) = harness
        .get_json("/api/pet/sync/results", Some(&token))
        .await?;
    assert_eq!(status, StatusCode::OK, "sync results body: {}", results);
    let result = results
        .as_array()
        .and_then(|items| {
            items
                .iter()
                .find(|item| item["command"]["commandId"] == command_id)
        })
        .expect("persisted command result");

    assert_eq!(result["command"]["type"], "feed");
    assert_eq!(result["pet"]["id"], pet["id"]);
    assert_eq!(result["schemaVersion"], 1);
    assert!(result["engineVersion"].is_string());
    assert!(result["registryVersion"].is_string());
    assert_eq!(result["influenceCooldowns"]["action:feed"], 0);
    assert_eq!(result["events"][0]["type"], "influence_applied");
    assert_eq!(result["events"][1]["type"], "gameplay_outcome_applied");

    Ok(())
}
