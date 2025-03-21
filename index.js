const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
require("dotenv").config();
const app = express();
const moment = require("moment-timezone");

app.use(cors());
app.use(express.json());

const connection = mysql.createConnection(process.env.DATABASE_URL);

app.get("/", (req, res) => {
  res.send("Air Quality API");
});

app.get("/airquality", (req, res) => {
  connection.query(
    "SELECT * FROM AirQualityData ORDER BY timestamp DESC",
    function (err, results, fields) {
      if (err) {
        console.error(err);
        res.status(500).send("Error fetching data");
      } else {
        // แปลงเวลาในแต่ละ row เป็นเวลาท้องถิ่น (UTC+7)
        results.forEach((item) => {
          item.timestamp = moment(item.timestamp)
            .tz("Asia/Bangkok")
            .format("YYYY-MM-DD HH:mm:ss");
        });
        res.send(results);
      }
    }
  );
});

// Route: GET ข้อมูลเฉพาะ Device ID
app.get("/airquality/:device_id", (req, res) => {
  const deviceId = req.params.device_id;
  connection.query(
    "SELECT * FROM AirQualityData WHERE device_id = ? ORDER BY timestamp DESC",
    [deviceId],
    function (err, results, fields) {
      if (err) {
        console.error(err);
        res.status(500).send("Error fetching device data");
      } else {
        // แปลงเวลาในแต่ละ row เป็นเวลาท้องถิ่น (UTC+7)
        results.forEach((item) => {
          item.timestamp = moment(item.timestamp)
            .tz("Asia/Bangkok")
            .format("YYYY-MM-DD HH:mm:ss");
        });
        res.send(results);
      }
    }
  );
});

// Route: POST ข้อมูลจาก IoT
app.post("/airquality", (req, res) => {
  const { device_id, timestamp, temperature, humidity, pm2_5 } = req.body;

  if (!device_id || !timestamp || !temperature || !humidity || !pm2_5) {
    return res.status(400).send("Missing required fields");
  }

  // แปลงเวลาเป็นเวลาท้องถิ่น (UTC+7 สำหรับไทย)
  const localTime = moment(timestamp)
    .tz("Asia/Bangkok")
    .format("YYYY-MM-DD HH:mm:ss");

  connection.query(
    "INSERT INTO AirQualityData (device_id, timestamp, temperature, humidity, pm2_5) VALUES (?, ?, ?, ?, ?)",
    [device_id, localTime, temperature, humidity, pm2_5],
    function (err, results, fields) {
      if (err) {
        console.error("Error inserting data:", err);
        res.status(500).send("Error adding data");
      } else {
        res
          .status(200)
          .send({
            message: "Data inserted successfully",
            id: results.insertId,
          });
      }
    }
  );
});

app.listen(process.env.PORT || 3000, () => {
  console.log("CORS-enabled web server listening on port 3000");
});

// export the app for vercel serverless functions
module.exports = app;
