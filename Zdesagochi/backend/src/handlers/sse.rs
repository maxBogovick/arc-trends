use axum::{
    extract::State,
    response::sse::{Event, KeepAlive, Sse},
};
use futures::StreamExt;
use std::convert::Infallible;
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;

use crate::{error::AppError, middleware::auth::AuthUser, state::AppState};

pub async fn pet_stream(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Sse<impl futures::Stream<Item = Result<Event, Infallible>>>, AppError> {
    let channel = format!("pet_updates:{}", auth.user_id);
    let (tx, rx) = mpsc::channel::<String>(64);

    // Dedicated pub/sub connection via raw redis client
    let redis_url = state.config.redis_url.clone();
    tokio::spawn(async move {
        let client = match redis::Client::open(redis_url.as_str()) {
            Ok(c) => c,
            Err(_) => return,
        };

        let mut pubsub = match client.get_async_pubsub().await {
            Ok(p) => p,
            Err(_) => return,
        };

        if pubsub.subscribe(&channel).await.is_err() {
            return;
        }

        let mut msg_stream = pubsub.into_on_message();
        while let Some(msg) = msg_stream.next().await {
            let payload: String = match msg.get_payload() {
                Ok(p) => p,
                Err(_) => continue,
            };
            if tx.send(payload).await.is_err() {
                break; // client disconnected
            }
        }
    });

    let event_stream = ReceiverStream::new(rx)
        .map(|data| Ok::<_, Infallible>(Event::default().event("pet_update").data(data)));

    Ok(Sse::new(event_stream).keep_alive(KeepAlive::default()))
}
