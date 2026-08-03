# REST & WebSocket API Specification

All REST responses follow the unified envelope structure:

Success:
```json
{
  "success": true,
  "data": { ... }
}
```

Error:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message"
  }
}
```

## Endpoints

### 1. Health Check
`GET /api/v1/health`
- **Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "services": {
      "api": "up",
      "database": "up"
    }
  }
}
```

### 2. List Sessions
`GET /api/v1/sessions`
- **Response**: `200 OK` — list of Session objects.

### 3. Create Session
`POST /api/v1/sessions`
- **Body**:
```json
{
  "name": "Support Account",
  "engine": "baileys"
}
```
- **Response**: `201 Created` — created Session object (`id` starts with `ses_`).

### 4. Get Session
`GET /api/v1/sessions/:id`
- **Response**: `200 OK` — Session object.

### 5. Delete Session
`DELETE /api/v1/sessions/:id`
- **Response**: `200 OK` — `{ "id": "ses_..." }` (stops engine & wipes auth state).

### 6. Start Session
`POST /api/v1/sessions/:id/start`
- **Response**: `200 OK` — Session object with status `STARTING`.

### 7. Stop Session
`POST /api/v1/sessions/:id/stop`
- **Response**: `200 OK` — Session object with status `STOPPING`.

### 8. Restart Session
`POST /api/v1/sessions/:id/restart`
- **Response**: `200 OK` — Session object.

### 9. Get QR Code
`GET /api/v1/sessions/:id/qr`
- **Response**: `200 OK` — `{ "qr": "2@..." }` if `QR_READY`.

### 10. Request Pairing Code
`POST /api/v1/sessions/:id/pairing-code`
- **Body**: `{ "phoneNumber": "919876543210" }`
- **Response**: `200 OK` — `{ "code": "ABCD-1234" }`.

### 11. Send Text Message
`POST /api/v1/sessions/:id/messages/send-text`
- **Headers**:
  ```text
  X-API-Key: <api-key> (required if API_KEY env is set)
  Content-Type: application/json
  ```
- **Body**:
  ```json
  {
    "to": "919876543210",
    "text": "Hello from Velurix ReachOut Automation"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "id": "msg_12345678-1234-1234-1234-123456789abc",
      "externalId": "BAE5F12345",
      "sessionId": "ses_12345678-1234-1234-1234-123456789abc",
      "to": "919876543210",
      "typeName": "text",
      "text": "Hello from Velurix ReachOut Automation",
      "status": "sent",
      "createdAt": "2026-07-26T00:00:00.000Z",
      "sentAt": "2026-07-26T00:00:01.000Z",
      "error": null
    }
  }
  ```

### 12. Realtime WebSocket
`WS /ws`
- Server pushes realtime events:
```json
{
  "event": "session.qr",
  "sessionId": "ses_...",
  "timestamp": "...",
  "data": { "qr": "2@..." }
}
```

