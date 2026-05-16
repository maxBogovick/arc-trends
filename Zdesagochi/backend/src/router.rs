use std::sync::Arc;
use std::time::Duration;

use axum::{
    Extension, Router,
    http::{HeaderValue, Method},
    middleware,
    routing::{get, patch, post},
};
use metrics_exporter_prometheus::PrometheusHandle;
use tower_http::{
    compression::CompressionLayer,
    cors::{Any, CorsLayer},
    limit::RequestBodyLimitLayer,
    request_id::{MakeRequestUuid, SetRequestIdLayer},
    timeout::TimeoutLayer,
    trace::TraceLayer,
};
use utoipa_swagger_ui::SwaggerUi;

use crate::{
    config::Config,
    handlers::{auth, economy, health, pet, progress, rooms, sse, sync},
    metrics::metrics_handler,
    middleware::rate_limit::rate_limit_middleware,
    openapi::ApiDoc,
    state::AppState,
};

pub fn build_router(state: AppState, prometheus_handle: PrometheusHandle) -> Router {
    let config = state.config.clone();
    let cors = build_cors_layer(&config);

    let auth_routes = Router::new()
        .route("/register", post(auth::register))
        .route("/login", post(auth::login))
        .route("/refresh", post(auth::refresh))
        .route("/logout", post(auth::logout))
        .layer(middleware::from_fn(rate_limit_middleware));

    let pet_routes = Router::new()
        .route("/", get(pet::get_pet))
        .route("/name", patch(pet::update_pet_name))
        .route("/events", get(pet::get_pet_events))
        .route("/import", post(pet::import_pet))
        .route("/new-life", post(pet::begin_new_life))
        .route("/feed", post(pet::feed_pet))
        .route("/play", post(pet::play_with_pet))
        .route("/sleep", post(pet::sleep_pet))
        .route("/wake", post(pet::wake_pet))
        .route("/bathe", post(pet::bathe_pet))
        .route("/heal", post(pet::heal_pet))
        .route("/bond", post(pet::bond_with_pet))
        .route("/sync", post(pet::sync_pet))
        .route("/evolution/accept", post(pet::accept_evolution))
        .route("/evolution/reject", post(pet::reject_evolution))
        .route("/sync/commands", post(sync::submit_commands))
        .route("/sync/results", get(sync::get_sync_results));

    let economy_routes = Router::new()
        .route("/coins", get(economy::get_coins))
        .route("/shop", get(economy::get_shop))
        .route("/shop/buy", post(economy::buy_item))
        .route("/inventory", get(economy::get_inventory))
        .route("/inventory/use", post(economy::use_inventory_item))
        .route("/foods", get(economy::get_foods));

    let progress_routes = Router::new()
        .route("/achievements", get(progress::get_achievements))
        .route("/achievements/claim", post(progress::claim_achievement))
        .route("/quests", get(progress::get_quests))
        .route("/quests/claim", post(progress::claim_quest_reward));

    let room_routes = Router::new()
        .route("/rooms", get(rooms::get_rooms))
        .route("/rooms/buy", post(rooms::buy_room))
        .route("/rooms/equip", post(rooms::equip_room))
        .route("/leaderboard", get(rooms::get_leaderboard));

    let api_router = Router::new()
        .nest("/auth", auth_routes)
        .nest("/pet", pet_routes)
        .merge(economy_routes)
        .merge(progress_routes)
        .merge(room_routes)
        .route("/sse/pet", get(sse::pet_stream));

    use utoipa::OpenApi as _;
    let redis_pool = state.redis.clone();
    let cfg_arc: Arc<Config> = state.config.clone();

    Router::new()
        .route("/health", get(health::health))
        .route("/metrics", get(metrics_handler))
        .nest("/api", api_router)
        .merge(SwaggerUi::new("/docs").url("/api/openapi.json", ApiDoc::openapi()))
        .with_state(state)
        .layer(Extension(prometheus_handle))
        .layer(Extension(redis_pool))
        .layer(Extension(cfg_arc))
        .layer(cors)
        .layer(CompressionLayer::new())
        .layer(RequestBodyLimitLayer::new(1024 * 1024)) // 1 MB
        .layer(TimeoutLayer::new(Duration::from_secs(30)))
        .layer(TraceLayer::new_for_http())
        .layer(SetRequestIdLayer::x_request_id(MakeRequestUuid))
}

fn build_cors_layer(config: &Config) -> CorsLayer {
    let origins: Vec<HeaderValue> = config
        .cors_origins
        .iter()
        .filter_map(|o| o.parse::<HeaderValue>().ok())
        .collect();

    if origins.is_empty() {
        tracing::warn!(
            "CORS_ORIGINS not set or invalid — allowing all origins. \
             This is unsafe for production deployments."
        );
        CorsLayer::new()
            .allow_methods([
                Method::GET,
                Method::POST,
                Method::PATCH,
                Method::DELETE,
                Method::OPTIONS,
            ])
            .allow_headers(Any)
            .allow_origin(Any)
    } else {
        CorsLayer::new()
            .allow_methods([
                Method::GET,
                Method::POST,
                Method::PATCH,
                Method::DELETE,
                Method::OPTIONS,
            ])
            .allow_headers(Any)
            .allow_origin(origins)
    }
}
