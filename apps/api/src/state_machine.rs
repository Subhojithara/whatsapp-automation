use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SessionStatus {
    Created,
    Starting,
    Connecting,
    QrReady,
    Authenticating,
    Ready,
    Disconnected,
    Reconnecting,
    Stopping,
    Stopped,
    Failed,
    Deleted,
}

impl SessionStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            SessionStatus::Created => "CREATED",
            SessionStatus::Starting => "STARTING",
            SessionStatus::Connecting => "CONNECTING",
            SessionStatus::QrReady => "QR_READY",
            SessionStatus::Authenticating => "AUTHENTICATING",
            SessionStatus::Ready => "READY",
            SessionStatus::Disconnected => "DISCONNECTED",
            SessionStatus::Reconnecting => "RECONNECTING",
            SessionStatus::Stopping => "STOPPING",
            SessionStatus::Stopped => "STOPPED",
            SessionStatus::Failed => "FAILED",
            SessionStatus::Deleted => "DELETED",
        }
    }

    pub fn parse_str(s: &str) -> Option<Self> {
        match s {
            "CREATED" => Some(SessionStatus::Created),
            "STARTING" => Some(SessionStatus::Starting),
            "CONNECTING" => Some(SessionStatus::Connecting),
            "QR_READY" => Some(SessionStatus::QrReady),
            "AUTHENTICATING" => Some(SessionStatus::Authenticating),
            "READY" => Some(SessionStatus::Ready),
            "DISCONNECTED" => Some(SessionStatus::Disconnected),
            "RECONNECTING" => Some(SessionStatus::Reconnecting),
            "STOPPING" => Some(SessionStatus::Stopping),
            "STOPPED" => Some(SessionStatus::Stopped),
            "FAILED" => Some(SessionStatus::Failed),
            "DELETED" => Some(SessionStatus::Deleted),
            _ => None,
        }
    }

    pub fn can_transition_to(&self, next: SessionStatus) -> bool {
        if *self == next {
            return true;
        }

        if next == SessionStatus::Starting && *self != SessionStatus::Deleted {
            return true;
        }

        match (self, next) {
            (SessionStatus::Created, SessionStatus::Starting) => true,
            (SessionStatus::Created, SessionStatus::Deleted) => true,

            (SessionStatus::Starting, SessionStatus::Connecting) => true,
            (SessionStatus::Starting, SessionStatus::Failed) => true,
            (SessionStatus::Starting, SessionStatus::Stopping) => true,

            (SessionStatus::Connecting, SessionStatus::QrReady) => true,
            (SessionStatus::Connecting, SessionStatus::Authenticating) => true,
            (SessionStatus::Connecting, SessionStatus::Ready) => true,
            (SessionStatus::Connecting, SessionStatus::Failed) => true,
            (SessionStatus::Connecting, SessionStatus::Stopping) => true,

            (SessionStatus::QrReady, SessionStatus::Authenticating) => true,
            (SessionStatus::QrReady, SessionStatus::Ready) => true,
            (SessionStatus::QrReady, SessionStatus::Failed) => true,
            (SessionStatus::QrReady, SessionStatus::Stopping) => true,

            (SessionStatus::Authenticating, SessionStatus::Ready) => true,
            (SessionStatus::Authenticating, SessionStatus::Failed) => true,
            (SessionStatus::Authenticating, SessionStatus::Stopping) => true,

            (SessionStatus::Ready, SessionStatus::Disconnected) => true,
            (SessionStatus::Ready, SessionStatus::Stopping) => true,
            (SessionStatus::Ready, SessionStatus::Failed) => true,
            (SessionStatus::Ready, SessionStatus::Deleted) => true,

            (SessionStatus::Disconnected, SessionStatus::Reconnecting) => true,
            (SessionStatus::Disconnected, SessionStatus::Stopping) => true,
            (SessionStatus::Disconnected, SessionStatus::Failed) => true,
            (SessionStatus::Disconnected, SessionStatus::Deleted) => true,

            (SessionStatus::Reconnecting, SessionStatus::Ready) => true,
            (SessionStatus::Reconnecting, SessionStatus::Disconnected) => true,
            (SessionStatus::Reconnecting, SessionStatus::Stopping) => true,
            (SessionStatus::Reconnecting, SessionStatus::Failed) => true,

            (SessionStatus::Stopping, SessionStatus::Stopped) => true,
            (SessionStatus::Stopping, SessionStatus::Failed) => true,

            (SessionStatus::Stopped, SessionStatus::Starting) => true,
            (SessionStatus::Stopped, SessionStatus::Deleted) => true,

            (SessionStatus::Failed, SessionStatus::Starting) => true,
            (SessionStatus::Failed, SessionStatus::Deleted) => true,

            _ => false,
        }
    }
}

impl fmt::Display for SessionStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_transitions() {
        assert!(SessionStatus::Created.can_transition_to(SessionStatus::Starting));
        assert!(SessionStatus::Starting.can_transition_to(SessionStatus::Connecting));
        assert!(SessionStatus::Connecting.can_transition_to(SessionStatus::QrReady));
        assert!(SessionStatus::QrReady.can_transition_to(SessionStatus::Authenticating));
        assert!(SessionStatus::Authenticating.can_transition_to(SessionStatus::Ready));
        assert!(SessionStatus::Ready.can_transition_to(SessionStatus::Disconnected));
        assert!(SessionStatus::Disconnected.can_transition_to(SessionStatus::Reconnecting));
        assert!(SessionStatus::Reconnecting.can_transition_to(SessionStatus::Ready));
        assert!(SessionStatus::Ready.can_transition_to(SessionStatus::Stopping));
        assert!(SessionStatus::Stopping.can_transition_to(SessionStatus::Stopped));
        assert!(SessionStatus::Stopped.can_transition_to(SessionStatus::Starting));
    }

    #[test]
    fn test_invalid_transitions() {
        assert!(!SessionStatus::Created.can_transition_to(SessionStatus::Ready));
        assert!(!SessionStatus::Stopped.can_transition_to(SessionStatus::Ready));
        assert!(!SessionStatus::QrReady.can_transition_to(SessionStatus::Reconnecting));
    }
}
