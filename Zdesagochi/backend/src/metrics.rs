#![allow(dead_code)]

use axum::{http::StatusCode, response::IntoResponse};
use metrics_exporter_prometheus::{PrometheusBuilder, PrometheusHandle};

/// Install the Prometheus recorder and return the handle used to scrape metrics.
pub fn install_prometheus() -> anyhow::Result<PrometheusHandle> {
    let handle = PrometheusBuilder::new()
        .install_recorder()
        .map_err(|e| anyhow::anyhow!("Failed to install Prometheus recorder: {}", e))?;
    Ok(handle)
}

/// `GET /metrics` — return Prometheus text format.
pub async fn metrics_handler(
    axum::Extension(handle): axum::Extension<PrometheusHandle>,
) -> impl IntoResponse {
    let body = handle.render();
    (
        StatusCode::OK,
        [("content-type", "text/plain; version=0.0.4")],
        body,
    )
}

// ─── Counter helpers (called from handlers) ───────────────────────────────────

/// Increment `pet_actions_total{action=<action>}`.
pub fn record_pet_action(action: &str) {
    metrics::counter!("pet_actions_total", "action" => action.to_string()).increment(1);
}

/// Increment `http_requests_total{method,path,status}`.
pub fn record_http_request(method: &str, path: &str, status: u16) {
    metrics::counter!(
        "http_requests_total",
        "method" => method.to_string(),
        "path"   => path.to_string(),
        "status" => status.to_string(),
    )
    .increment(1);
}

/// Record a timing sample for `engine_apply_duration_ms`.
pub fn record_engine_duration_ms(ms: f64) {
    metrics::gauge!("engine_apply_duration_ms").set(ms);
}
