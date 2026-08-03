# Internal Engine Protocol

Communication between Rust backend and Node.js Baileys engine processes uses single-line JSON framing over `stdin`/`stdout`. Each message is terminated by a newline (`\n`).

## Commands (Rust ──► Engine via stdin)

### `engine.start`
```json
{
  "cmd": "engine.start",
  "sessionId": "ses_12345678-1234-1234-1234-123456789abc",
  "authDir": "data/sessions/ses_12345678-1234-1234-1234-123456789abc/auth",
  "v": 1
}
```

### `engine.stop`
```json
{
  "cmd": "engine.stop",
  "sessionId": "ses_12345678-1234-1234-1234-123456789abc",
  "v": 1
}
```

### `engine.request_pairing_code`
```json
{
  "cmd": "engine.request_pairing_code",
  "sessionId": "ses_12345678-1234-1234-1234-123456789abc",
  "phoneNumber": "919876543210",
  "v": 1
}
```

### `engine.send_text`
```json
{
  "cmd": "engine.send_text",
  "sessionId": "ses_12345678-1234-1234-1234-123456789abc",
  "chatId": "919876543210@s.whatsapp.net",
  "text": "Hello from Velurix ReachOut Automation",
  "messageId": "msg_12345678-1234-1234-1234-123456789abc",
  "v": 1
}
```

---

## Events (Engine ──► Rust via stdout)

### `session.connecting`
```json
{
  "event": "session.connecting",
  "sessionId": "ses_12345678-1234-1234-1234-123456789abc",
  "timestamp": "2026-07-26T01:00:00.000Z",
  "v": 1
}
```

### `session.qr`
```json
{
  "event": "session.qr",
  "sessionId": "ses_12345678-1234-1234-1234-123456789abc",
  "timestamp": "2026-07-26T01:00:05.000Z",
  "data": { "qr": "2@..." },
  "v": 1
}
```

### `session.pairing_code`
```json
{
  "event": "session.pairing_code",
  "sessionId": "ses_12345678-1234-1234-1234-123456789abc",
  "timestamp": "2026-07-26T01:00:05.000Z",
  "data": { "code": "ABCD-1234" },
  "v": 1
}
```

### `session.authenticating`
```json
{
  "event": "session.authenticating",
  "sessionId": "ses_12345678-1234-1234-1234-123456789abc",
  "timestamp": "2026-07-26T01:00:10.000Z",
  "v": 1
}
```

### `session.ready`
```json
{
  "event": "session.ready",
  "sessionId": "ses_12345678-1234-1234-1234-123456789abc",
  "timestamp": "2026-07-26T01:00:12.000Z",
  "data": {
    "phoneNumber": "919876543210",
    "displayName": "Support"
  },
  "v": 1
}
```

### `session.disconnected`
```json
{
  "event": "session.disconnected",
  "sessionId": "ses_12345678-1234-1234-1234-123456789abc",
  "timestamp": "2026-07-26T01:05:00.000Z",
  "data": { "statusCode": 428, "reason": "connectionClosed" },
  "v": 1
}
```

### `session.failed`
```json
{
  "event": "session.failed",
  "sessionId": "ses_12345678-1234-1234-1234-123456789abc",
  "timestamp": "2026-07-26T01:05:00.000Z",
  "data": { "error": "loggedOut", "statusCode": 401 },
  "v": 1
}
```

### `session.stopped`
```json
{
  "event": "session.stopped",
  "sessionId": "ses_12345678-1234-1234-1234-123456789abc",
  "timestamp": "2026-07-26T01:05:01.000Z",
  "v": 1
}
```

### `message.sent`
```json
{
  "event": "message.sent",
  "sessionId": "ses_12345678-1234-1234-1234-123456789abc",
  "timestamp": "2026-07-26T01:05:02.000Z",
  "data": {
    "messageId": "msg_12345678-1234-1234-1234-123456789abc",
    "externalId": "BAE5F12345"
  },
  "v": 1
}
```

### `message.failed`
```json
{
  "event": "message.failed",
  "sessionId": "ses_12345678-1234-1234-1234-123456789abc",
  "timestamp": "2026-07-26T01:05:02.000Z",
  "data": {
    "messageId": "msg_12345678-1234-1234-1234-123456789abc",
    "error": "Recipient number is not registered on WhatsApp"
  },
  "v": 1
}
```

