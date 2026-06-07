# AeroSensei Backend

This backend service provides a Node.js API for registering sensors in the PostgreSQL `sensor_registry` table.

## Setup

1. Copy `.env.example` to `.env`.
2. Install dependencies:

```bash
cd backend
npm install
```

3. Start the service:

```bash
npm start
```

## Endpoint

POST `/register-sensor`

Request body:

```json
{
  "sensor_id": "sensor-001",
  "location_name": "Warehouse A",
  "latitude": 37.4219983,
  "longitude": -122.084,
  "status": "active",
  "installation_date": "2026-06-07"
}
```

Response:

- `201 Created` with the registered sensor row
- `400 Bad Request` when required fields are missing
- `409 Conflict` when `sensor_id` already exists
