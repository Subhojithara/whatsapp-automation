use crate::engine::pending_messages::{MessageResult, PendingMessages};
use crate::engine::protocol::EngineEvent;
use crate::realtime::RealtimeHub;
use crate::services::chat_service::ChatService;
use crate::services::contact_service::ContactService;
use crate::services::message_service::MessageService;
use crate::services::session_service::SessionService;
use crate::state_machine::SessionStatus;
use sqlx::SqlitePool;
use tokio::sync::mpsc;

pub fn start_event_processor(
    mut event_rx: mpsc::Receiver<EngineEvent>,
    pool: SqlitePool,
    hub: RealtimeHub,
    pending_messages: PendingMessages,
) {
    tokio::spawn(async move {
        tracing::info!("Engine event processor started.");
        while let Some(event) = event_rx.recv().await {
            let session_id = event.session_id().to_string();
            tracing::info!(session_id = %session_id, event = ?event, "Processing engine event");

            // Publish event to WebSocket hub first
            hub.publish(event.clone()).await;

            // Database persistence
            match event {
                EngineEvent::Connecting { .. } => {
                    let _ = SessionService::update_status(
                        &pool,
                        &session_id,
                        SessionStatus::Connecting,
                        None,
                    )
                    .await;
                }
                EngineEvent::Qr { .. } => {
                    let _ = SessionService::update_status(
                        &pool,
                        &session_id,
                        SessionStatus::QrReady,
                        None,
                    )
                    .await;
                }
                EngineEvent::PairingCode { .. } => {
                    let _ = SessionService::update_status(
                        &pool,
                        &session_id,
                        SessionStatus::QrReady,
                        None,
                    )
                    .await;
                }
                EngineEvent::Authenticating { .. } => {
                    let _ = SessionService::update_status(
                        &pool,
                        &session_id,
                        SessionStatus::Authenticating,
                        None,
                    )
                    .await;
                }
                EngineEvent::Reconnecting { .. } => {
                    let _ = SessionService::update_status(
                        &pool,
                        &session_id,
                        SessionStatus::Reconnecting,
                        None,
                    )
                    .await;
                }
                EngineEvent::Ready { data, .. } => {
                    let _ = SessionService::update_metadata(
                        &pool,
                        &session_id,
                        data.phone_number,
                        data.display_name,
                    )
                    .await;

                    let _ = SessionService::update_status(
                        &pool,
                        &session_id,
                        SessionStatus::Ready,
                        None,
                    )
                    .await;
                }
                EngineEvent::Disconnected { data, .. } => {
                    let _ = SessionService::update_status(
                        &pool,
                        &session_id,
                        SessionStatus::Disconnected,
                        data.reason,
                    )
                    .await;
                }
                EngineEvent::Failed { data, .. } => {
                    let _ = SessionService::update_status(
                        &pool,
                        &session_id,
                        SessionStatus::Failed,
                        Some(data.error),
                    )
                    .await;
                }
                EngineEvent::Stopped { .. } => {
                    let _ = SessionService::update_status(
                        &pool,
                        &session_id,
                        SessionStatus::Stopped,
                        None,
                    )
                    .await;
                }
                EngineEvent::MessageSent { data, .. } => {
                    tracing::info!(
                        session_id = %session_id,
                        message_id = %data.message_id,
                        external_id = ?data.external_id,
                        "Processing MessageSent engine event"
                    );

                    let _ = MessageService::update_message_sent(
                        &pool,
                        &data.message_id,
                        data.external_id.clone(),
                    )
                    .await;

                    pending_messages
                        .resolve(
                            &data.message_id,
                            MessageResult::Sent {
                                external_id: data.external_id,
                            },
                        )
                        .await;
                }
                EngineEvent::MessageFailed { data, .. } => {
                    tracing::warn!(
                        session_id = %session_id,
                        message_id = %data.message_id,
                        error = %data.error,
                        "Processing MessageFailed engine event"
                    );

                    let _ =
                        MessageService::update_message_failed(&pool, &data.message_id, &data.error)
                            .await;

                    pending_messages
                        .resolve(
                            &data.message_id,
                            MessageResult::Failed { error: data.error },
                        )
                        .await;
                }
                EngineEvent::ContactProfilePicture { data, .. } => {
                    tracing::info!(
                        session_id = %session_id,
                        jid = %data.jid,
                        "Processing ContactProfilePicture event"
                    );
                    let _ = ContactService::update_avatar_url(&pool, &session_id, &data.jid, data.avatar_url.as_deref()).await;
                }
                EngineEvent::ContactsSynced { data, .. } => {
                    tracing::info!(
                        session_id = %session_id,
                        count = data.contacts.len(),
                        "Processing ContactsSynced event"
                    );
                    let _ = ContactService::upsert_contacts(&pool, &session_id, &data.contacts).await;
                }
                EngineEvent::ChatsSynced { data, .. } => {
                    tracing::info!(
                        session_id = %session_id,
                        count = data.chats.len(),
                        "Processing ChatsSynced event"
                    );
                    let _ = ChatService::upsert_chats(&pool, &session_id, &data.chats).await;
                }
                EngineEvent::ChatMessages { .. } => {
                    tracing::info!(session_id = %session_id, "Processing ChatMessages event");
                }
                EngineEvent::MessageReceived { data, .. } => {
                    tracing::info!(
                        session_id = %session_id,
                        jid = %data.message.jid,
                        "Processing MessageReceived event"
                    );
                    let _ = MessageService::save_incoming_message(&pool, &session_id, &data.message).await;
                    let _ = crate::services::blacklist_service::BlacklistService::handle_incoming_stop(&pool, &data.message.sender_jid, &data.message.body).await;
                    let _ = crate::services::campaign_worker::CampaignWorker::handle_incoming_reply(&pool, &session_id, &data.message).await;
                }

                EngineEvent::MessageDeliveryUpdate { data, .. } => {
                    tracing::info!(
                        session_id = %session_id,
                        external_id = %data.external_id,
                        status = %data.status,
                        "Processing MessageDeliveryUpdate event"
                    );
                    let _ = MessageService::update_message_delivery_by_external_id(
                        &pool,
                        &data.external_id,
                        &data.status,
                    )
                    .await;
                }
                EngineEvent::PhonesValidated { data, .. } => {
                    tracing::info!(
                        session_id = %session_id,
                        count = data.results.len(),
                        "Processing PhonesValidated engine event"
                    );
                }
                EngineEvent::PresenceSimulated { data, .. } => {
                    tracing::info!(
                        session_id = %session_id,
                        jid = %data.jid,
                        success = data.success,
                        "Processing PresenceSimulated engine event"
                    );
                }
            }
        }
    });
}

