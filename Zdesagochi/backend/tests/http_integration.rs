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

fn assert_action_result(body: &Value, action_label: &str) {
    assert!(
        body["pet"]["id"].is_string(),
        "{} action should return pet snapshot: {}",
        action_label,
        body
    );
    assert!(
        body["xpGained"].is_number(),
        "{} action should return xpGained: {}",
        action_label,
        body
    );
    assert!(
        body["coinsGained"].is_number(),
        "{} action should return coinsGained: {}",
        action_label,
        body
    );
    assert!(
        body["events"].is_array(),
        "{} action should return events: {}",
        action_label,
        body
    );
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
    let register_refresh_token = register["refresh_token"]
        .as_str()
        .expect("refresh token")
        .to_string();

    let (status, login) = harness
        .post_json(
            "/api/auth/login",
            None,
            json!({
                "email": email,
                "password": password,
            }),
        )
        .await?;
    assert_eq!(status, StatusCode::OK, "login body: {}", login);
    assert!(login["token"].is_string());
    let login_refresh_token = login["refresh_token"]
        .as_str()
        .expect("login refresh token")
        .to_string();

    let (status, refresh) = harness
        .post_json(
            "/api/auth/refresh",
            None,
            json!({ "refresh_token": login_refresh_token }),
        )
        .await?;
    assert_eq!(status, StatusCode::OK, "refresh body: {}", refresh);
    let rotated_token = refresh["token"]
        .as_str()
        .expect("rotated token")
        .to_string();
    let rotated_refresh_token = refresh["refresh_token"]
        .as_str()
        .expect("rotated refresh token")
        .to_string();

    let (status, stale_refresh) = harness
        .post_json(
            "/api/auth/refresh",
            None,
            json!({ "refresh_token": login["refresh_token"] }),
        )
        .await?;
    assert_eq!(
        status,
        StatusCode::UNAUTHORIZED,
        "stale refresh body: {}",
        stale_refresh
    );

    let (status, logout) = harness
        .post_json(
            "/api/auth/logout",
            Some(&rotated_token),
            json!({ "refresh_token": rotated_refresh_token }),
        )
        .await?;
    assert_eq!(status, StatusCode::NO_CONTENT, "logout body: {}", logout);

    let (status, logged_out_refresh) = harness
        .post_json(
            "/api/auth/refresh",
            None,
            json!({ "refresh_token": refresh["refresh_token"] }),
        )
        .await?;
    assert_eq!(
        status,
        StatusCode::UNAUTHORIZED,
        "logged out refresh body: {}",
        logged_out_refresh
    );

    let (status, register_logout) = harness
        .post_json(
            "/api/auth/logout",
            Some(&token),
            json!({ "refresh_token": register_refresh_token }),
        )
        .await?;
    assert_eq!(
        status,
        StatusCode::NO_CONTENT,
        "register logout body: {}",
        register_logout
    );

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
    assert_eq!(ack["lastAcceptedCommandId"], command_id);

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

    let stale_command_id = format!("cmd-{}", Ulid::new());
    let (status, stale_ack) = harness
        .post_json(
            "/api/pet/sync/commands",
            Some(&token),
            json!({
                "clientId": "integration-client",
                "baseCommandId": null,
                "commands": [{
                    "type": "feed",
                    "commandId": stale_command_id,
                    "foodId": "apple",
                    "at": "2026-05-16T12:01:00Z"
                }]
            }),
        )
        .await?;
    assert_eq!(status, StatusCode::OK, "stale ack body: {}", stale_ack);
    assert_eq!(stale_ack["acceptedCommandIds"].as_array().unwrap().len(), 0);
    assert_eq!(stale_ack["rejectedCommandIds"].as_array().unwrap().len(), 1);
    assert_eq!(stale_ack["rejectedCommands"][0]["reason"], "stale_base");
    assert_eq!(stale_ack["lastAcceptedCommandId"], command_id);

    let duplicate_command_id = format!("cmd-{}", Ulid::new());
    let (status, duplicate_ack) = harness
        .post_json(
            "/api/pet/sync/commands",
            Some(&token),
            json!({
                "clientId": "integration-client",
                "baseCommandId": command_id,
                "commands": [
                    {
                        "type": "bond",
                        "commandId": duplicate_command_id,
                        "at": "2026-05-16T12:02:00Z"
                    },
                    {
                        "type": "bond",
                        "commandId": duplicate_command_id,
                        "at": "2026-05-16T12:03:00Z"
                    }
                ]
            }),
        )
        .await?;
    assert_eq!(
        status,
        StatusCode::OK,
        "duplicate ack body: {}",
        duplicate_ack
    );
    assert_eq!(
        duplicate_ack["acceptedCommandIds"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
    assert_eq!(
        duplicate_ack["rejectedCommandIds"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
    assert_eq!(
        duplicate_ack["rejectedCommands"][0]["reason"],
        "duplicate_in_batch"
    );
    assert_eq!(duplicate_ack["lastAcceptedCommandId"], duplicate_command_id);

    let (status, since_feed_results) = harness
        .get_json(
            &format!("/api/pet/sync/results?since={}", command_id),
            Some(&token),
        )
        .await?;
    assert_eq!(
        status,
        StatusCode::OK,
        "sync results since feed body: {}",
        since_feed_results
    );
    assert!(
        since_feed_results
            .as_array()
            .expect("sync results since feed array")
            .iter()
            .any(|item| item["command"]["commandId"] == duplicate_command_id),
        "cursor after feed should include later accepted duplicate command"
    );

    let (status, since_last_results) = harness
        .get_json(
            &format!("/api/pet/sync/results?since={}", duplicate_command_id),
            Some(&token),
        )
        .await?;
    assert_eq!(
        status,
        StatusCode::OK,
        "sync results since last body: {}",
        since_last_results
    );
    assert_eq!(
        since_last_results
            .as_array()
            .expect("sync results array")
            .len(),
        0,
        "cursor after last accepted command should be empty"
    );

    let unsupported_room_command_id = format!("cmd-{}", Ulid::new());
    let unsupported_npc_command_id = format!("cmd-{}", Ulid::new());
    let (status, unsupported_ack) = harness
        .post_json(
            "/api/pet/sync/commands",
            Some(&token),
            json!({
                "clientId": "integration-client",
                "baseCommandId": duplicate_command_id,
                "commands": [
                    {
                        "type": "equip_room",
                        "commandId": unsupported_room_command_id,
                        "roomId": "forest",
                        "at": "2026-05-16T12:04:00Z"
                    },
                    {
                        "type": "npc_visit",
                        "commandId": unsupported_npc_command_id,
                        "npcPersonalityId": "sage",
                        "at": "2026-05-16T12:05:00Z"
                    }
                ]
            }),
        )
        .await?;
    assert_eq!(
        status,
        StatusCode::OK,
        "unsupported sync ack body: {}",
        unsupported_ack
    );
    assert_eq!(
        unsupported_ack["acceptedCommandIds"]
            .as_array()
            .unwrap()
            .len(),
        0
    );
    assert_eq!(
        unsupported_ack["rejectedCommandIds"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    assert!(
        unsupported_ack["rejectedCommands"]
            .as_array()
            .unwrap()
            .iter()
            .all(|command| command["reason"] == "invalid_command"),
        "unsupported command variants must be explicitly rejected"
    );
    assert_eq!(
        unsupported_ack["lastAcceptedCommandId"],
        duplicate_command_id
    );

    let (status, feed_action) = harness
        .post_json("/api/pet/feed", Some(&token), json!({ "foodId": "apple" }))
        .await?;
    assert_eq!(status, StatusCode::OK, "feed action body: {}", feed_action);
    assert_action_result(&feed_action, "feed");

    let (status, bathe_action) = harness
        .post_json("/api/pet/bathe", Some(&token), json!({}))
        .await?;
    assert_eq!(
        status,
        StatusCode::OK,
        "bathe action body: {}",
        bathe_action
    );
    assert_action_result(&bathe_action, "bathe");

    let (status, heal_action) = harness
        .post_json("/api/pet/heal", Some(&token), json!({}))
        .await?;
    assert_eq!(status, StatusCode::OK, "heal action body: {}", heal_action);
    assert_action_result(&heal_action, "heal");

    let (status, sleep_action) = harness
        .post_json("/api/pet/sleep", Some(&token), json!({}))
        .await?;
    assert_eq!(
        status,
        StatusCode::OK,
        "sleep action body: {}",
        sleep_action
    );
    assert_action_result(&sleep_action, "sleep");
    assert_eq!(sleep_action["pet"]["isAsleep"], true);

    let (status, blocked_bond_action) = harness
        .post_json("/api/pet/bond", Some(&token), json!({}))
        .await?;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "bond while asleep should be blocked: {}",
        blocked_bond_action
    );

    let (status, wake_action) = harness
        .post_json("/api/pet/wake", Some(&token), json!({}))
        .await?;
    assert_eq!(status, StatusCode::OK, "wake action body: {}", wake_action);
    assert_action_result(&wake_action, "wake");
    assert_eq!(wake_action["pet"]["isAsleep"], false);

    let (status, bond_action) = harness
        .post_json("/api/pet/bond", Some(&token), json!({}))
        .await?;
    assert_eq!(status, StatusCode::OK, "bond action body: {}", bond_action);
    assert_action_result(&bond_action, "bond");

    let (status, coins_after_play_and_sync) = harness.get_json("/api/coins", Some(&token)).await?;
    assert_eq!(
        status,
        StatusCode::OK,
        "coins body: {}",
        coins_after_play_and_sync
    );
    let coins_before_buy = coins_after_play_and_sync["coins"]
        .as_i64()
        .expect("coin balance before buy");

    let (status, buy) = harness
        .post_json("/api/shop/buy", Some(&token), json!({ "itemId": "puzzle" }))
        .await?;
    assert_eq!(status, StatusCode::OK, "buy body: {}", buy);
    assert_eq!(buy["coins"], coins_before_buy - 50);
    assert_eq!(buy["inventory"][0]["itemId"], "puzzle");
    assert_eq!(buy["inventory"][0]["quantity"], 1);

    let (status, inventory) = harness.get_json("/api/inventory", Some(&token)).await?;
    assert_eq!(status, StatusCode::OK, "inventory body: {}", inventory);
    assert_eq!(inventory.as_array().unwrap().len(), 1);
    assert_eq!(inventory[0]["itemId"], "puzzle");
    assert_eq!(inventory[0]["quantity"], 1);

    let (status, pet_before_item) = harness.get_json("/api/pet", Some(&token)).await?;
    assert_eq!(
        status,
        StatusCode::OK,
        "pet before item body: {}",
        pet_before_item
    );
    let happiness_before_item = pet_before_item["stats"]["happiness"]
        .as_f64()
        .expect("happiness before item");

    let (status, pet_after_item) = harness
        .post_json(
            "/api/inventory/use",
            Some(&token),
            json!({ "itemId": "puzzle" }),
        )
        .await?;
    assert_eq!(status, StatusCode::OK, "use item body: {}", pet_after_item);
    let happiness_after_item = pet_after_item["stats"]["happiness"]
        .as_f64()
        .expect("happiness after item");
    assert!(
        happiness_after_item >= happiness_before_item,
        "happiness should not decrease after toy use: before={}, after={}",
        happiness_before_item,
        happiness_after_item
    );
    assert!(
        pet_after_item["formationProgress"]
            .as_f64()
            .unwrap_or_default()
            > pet_before_item["formationProgress"]
                .as_f64()
                .unwrap_or_default(),
        "item influence should advance formation"
    );

    let (status, inventory_after_use) = harness.get_json("/api/inventory", Some(&token)).await?;
    assert_eq!(
        status,
        StatusCode::OK,
        "inventory after use body: {}",
        inventory_after_use
    );
    assert_eq!(inventory_after_use.as_array().unwrap().len(), 0);

    let (status, missing_item_use) = harness
        .post_json(
            "/api/inventory/use",
            Some(&token),
            json!({ "itemId": "puzzle" }),
        )
        .await?;
    assert_eq!(
        status,
        StatusCode::NOT_FOUND,
        "missing item use body: {}",
        missing_item_use
    );

    let (status, pet_after_missing_item_use) = harness.get_json("/api/pet", Some(&token)).await?;
    assert_eq!(
        status,
        StatusCode::OK,
        "pet after missing item body: {}",
        pet_after_missing_item_use
    );
    assert_eq!(
        pet_after_missing_item_use["formationProgress"], pet_after_item["formationProgress"],
        "failed inventory use must not persist pet changes"
    );

    let (status, coins_before_failed_buy) = harness.get_json("/api/coins", Some(&token)).await?;
    assert_eq!(
        status,
        StatusCode::OK,
        "coins before failed buy body: {}",
        coins_before_failed_buy
    );

    let (status, expensive_buy) = harness
        .post_json(
            "/api/shop/buy",
            Some(&token),
            json!({ "itemId": "magic_wand" }),
        )
        .await?;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "expensive buy body: {}",
        expensive_buy
    );

    let (status, coins_after_failed_buy) = harness.get_json("/api/coins", Some(&token)).await?;
    assert_eq!(
        status,
        StatusCode::OK,
        "coins after failed buy body: {}",
        coins_after_failed_buy
    );
    assert_eq!(
        coins_after_failed_buy["coins"], coins_before_failed_buy["coins"],
        "failed buy must not change coins"
    );

    let second_suffix = Ulid::new().to_string().to_ascii_lowercase();
    let second_email = format!("integration-{}@example.test", second_suffix);
    let second_username = format!("it{}", &second_suffix[..12]);
    let (status, second_register) = harness
        .post_json(
            "/api/auth/register",
            None,
            json!({
                "username": second_username,
                "email": second_email,
                "password": password,
            }),
        )
        .await?;
    assert_eq!(
        status,
        StatusCode::OK,
        "second register body: {}",
        second_register
    );
    let second_token = second_register["token"]
        .as_str()
        .expect("second token")
        .to_string();

    let (status, second_pet) = harness.get_json("/api/pet", Some(&second_token)).await?;
    assert_eq!(status, StatusCode::OK, "second pet body: {}", second_pet);
    assert_ne!(second_pet["id"], pet["id"]);
    assert_eq!(second_pet["currentSync"], 0);

    let (status, second_coins) = harness.get_json("/api/coins", Some(&second_token)).await?;
    assert_eq!(
        status,
        StatusCode::OK,
        "second coins body: {}",
        second_coins
    );
    assert_eq!(second_coins["coins"], 100);

    let (status, second_results) = harness
        .get_json("/api/pet/sync/results", Some(&second_token))
        .await?;
    assert_eq!(
        status,
        StatusCode::OK,
        "second sync results body: {}",
        second_results
    );
    assert!(
        second_results
            .as_array()
            .expect("second sync results array")
            .iter()
            .all(|item| item["command"]["commandId"] != command_id),
        "second user must not see first user's command results"
    );

    let (status, unauthorized_pet) = harness.get_json("/api/pet", None).await?;
    assert_eq!(
        status,
        StatusCode::UNAUTHORIZED,
        "unauthorized pet body: {}",
        unauthorized_pet
    );

    let (status, unauthorized_buy) = harness
        .post_json("/api/shop/buy", None, json!({ "itemId": "puzzle" }))
        .await?;
    assert_eq!(
        status,
        StatusCode::UNAUTHORIZED,
        "unauthorized buy body: {}",
        unauthorized_buy
    );

    Ok(())
}
