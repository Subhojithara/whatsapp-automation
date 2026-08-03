use crate::realtime::RealtimeHub;
use actix_web::{web, Error, HttpRequest, HttpResponse};
use actix_ws::Message;
use futures_util::StreamExt;

pub async fn ws_handler(
    req: HttpRequest,
    stream: web::Payload,
    hub: web::Data<RealtimeHub>,
) -> Result<HttpResponse, Error> {
    let (res, mut session, mut msg_stream) = actix_ws::handle(&req, stream)?;
    let mut rx = hub.subscribe();

    let mut send_session = session.clone();
    actix_web::rt::spawn(async move {
        while let Ok(event) = rx.recv().await {
            if let Ok(json) = serde_json::to_string(&event) {
                if send_session.text(json).await.is_err() {
                    break;
                }
            }
        }
    });

    actix_web::rt::spawn(async move {
        while let Some(Ok(msg)) = msg_stream.next().await {
            match msg {
                Message::Ping(bytes) => {
                    let _ = session.pong(&bytes).await;
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
    });

    Ok(res)
}
