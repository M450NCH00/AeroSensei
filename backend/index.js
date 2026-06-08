const express = require("express");
const path = require("path");
const { pool } = require("./db");

require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const app = express();
const port = process.env.PORT || 4000;

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "aerosensei-backend" });
});

app.post("/register-sensor", async (req, res) => {
  const {
    sensor_id,
    location_name,
    latitude,
    longitude,
    status = "active",
    installation_date,
  } = req.body;

  if (
    !sensor_id ||
    !location_name ||
    latitude === undefined ||
    longitude === undefined
  ) {
    return res.status(400).json({
      error: "sensor_id, location_name, latitude, and longitude are required",
    });
  }

  try {
    const query = `
      INSERT INTO sensor_registry (
        sensor_id,
        location_name,
        latitude,
        longitude,
        status,
        installation_date
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      sensor_id,
      location_name,
      latitude,
      longitude,
      status,
      installation_date || null,
    ];

    const result = await pool.query(query, values);
    return res.status(201).json({ sensor: result.rows[0] });
  } catch (error) {
    console.error("Failed to register sensor:", error);

    if (error.code === "23505") {
      return res
        .status(409)
        .json({ error: "Sensor with this sensor_id already exists" });
    }

    return res.status(500).json({ error: "Unable to register sensor" });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(port, () => {
  console.log(`AeroSensei backend listening on http://localhost:${port}`);
});
