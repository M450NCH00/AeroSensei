const { Pool } = require("pg");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
  database: process.env.PGDATABASE || "sensor_metadata",
  user: process.env.PGUSER || "admin",
  password: process.env.PGPASSWORD || "ChangeThisPassword123!",
});

module.exports = { pool };
