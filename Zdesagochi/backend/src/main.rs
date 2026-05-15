use std::net::SocketAddr;

use tokio::net::TcpListener;
use tokio::signal;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

mod config;
mod db;
mod domain;
mod engine;
mod error;
mod handlers;
mod jobs;
mod metrics;
mod middleware;
mod openapi;
mod router;
mod state;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _ = dotenvy::dotenv();

    let log_level = std::env::var("LOG_LEVEL").unwrap_or_else(|_| "info".to_string());

    // ── OpenTelemetry / OTLP (only when endpoint env var is set) ─────────────
    let otel_layer = if let Ok(endpoint) = std::env::var("OTEL_EXPORTER_OTLP_ENDPOINT") {
        use opentelemetry_otlp::WithExportConfig;
        use opentelemetry::trace::TracerProvider as _;
        let provider = opentelemetry_otlp::new_pipeline()
            .tracing()
            .with_exporter(
                opentelemetry_otlp::new_exporter()
                    .tonic()
                    .with_endpoint(endpoint),
            )
            .with_trace_config(
                opentelemetry_sdk::trace::Config::default().with_resource(
                    opentelemetry_sdk::Resource::new(vec![opentelemetry::KeyValue::new(
                        "service.name",
                        "zdesagochi-backend",
                    )]),
                ),
            )
            .install_batch(opentelemetry_sdk::runtime::Tokio)
            .map_err(|e| anyhow::anyhow!("OTLP init error: {}", e))?;

        let tracer = provider.tracer("zdesagochi");
        Some(tracing_opentelemetry::layer().with_tracer(tracer))
    } else {
        None
    };

    // ── Tracing registry ─────────────────────────────────────────────────────
    let registry = tracing_subscriber::registry()
        .with(EnvFilter::new(log_level))
        .with(tracing_subscriber::fmt::layer().json());

    if let Some(layer) = otel_layer {
        registry.with(layer).init();
    } else {
        registry.init();
    }

    tracing::info!("Zdesagochi backend starting...");

    // ── Prometheus metrics ───────────────────────────────────────────────────
    let prometheus_handle = metrics::install_prometheus()?;
    tracing::info!("Prometheus metrics recorder installed");

    let config = config::Config::from_env()?;
    tracing::info!(
        host = %config.host,
        port = %config.port,
        environment = %config.environment,
        "Config loaded"
    );

    let state = state::AppState::new(config.clone()).await?;
    tracing::info!("AppState created (DB + Redis connected)");

    sqlx::migrate!("./migrations").run(&state.db).await?;
    tracing::info!("Database migrations applied");

    // Spawn background jobs under panic-restart supervision
    spawn_supervised("auto_decay", state.clone(), |s| Box::pin(jobs::auto_decay::run(s)));
    spawn_supervised("quest_reset", state.clone(), |s| Box::pin(jobs::quest_reset::run(s)));
    tracing::info!("Background jobs started");

    let app = router::build_router(state, prometheus_handle);

    let addr: SocketAddr = format!("{}:{}", config.host, config.port)
        .parse()
        .map_err(|e| anyhow::anyhow!("Invalid bind address: {}", e))?;
    let listener = TcpListener::bind(addr).await?;
    tracing::info!(addr = %addr, "Listening on http://{}", addr);

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await?;

    tracing::info!("Server shut down gracefully");
    Ok(())
}

/// Spawn a background job that automatically restarts after panics.
fn spawn_supervised<F>(name: &'static str, state: state::AppState, factory: F)
where
    F: Fn(state::AppState) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send>>
        + Send
        + 'static,
{
    tokio::spawn(async move {
        use futures::FutureExt;
        loop {
            let fut = factory(state.clone());
            let result = std::panic::AssertUnwindSafe(fut).catch_unwind().await;
            match result {
                Ok(()) => {
                    tracing::warn!(job = name, "background job exited normally; restarting in 10s");
                }
                Err(_) => {
                    tracing::error!(job = name, "background job panicked; restarting in 10s");
                }
            }
            tokio::time::sleep(std::time::Duration::from_secs(10)).await;
        }
    });
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => tracing::info!("Received Ctrl+C, shutting down"),
        _ = terminate => tracing::info!("Received SIGTERM, shutting down"),
    }
}
