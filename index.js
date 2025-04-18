const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
require("dotenv").config();
const app = express();
const moment = require("moment-timezone");
// const bcrypt = require("bcryptjs");

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
          item.timestamp = moment(item.timestamp).format("HH:mm DD-MM-YYYY");
        });
        res.send(results);
      }
    }
  );
});

// Route: GET ข้อมูลเฉพาะ Device ID
app.get("/airquality/history/:device_id", (req, res) => {
  const deviceId = req.params.device_id;
  connection.query(
    "SELECT * FROM AirQualityData WHERE device_id = ? ORDER BY timestamp DESC",
    [deviceId],
    function (err, results, fields) {
      if (err) {
        console.error(err);
        res.status(500).send("Error fetching device data");
      } else {
        results.forEach((item) => {
          item.timestamp = moment(item.timestamp).format("HH:mm DD-MM-YYYY");
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
        res.status(200).send({
          message: "Data inserted successfully",
          id: results.insertId,
        });
      }
    }
  );
});

app.get("/airquality/history", (req, res) => {
  connection.query(
    "SELECT * FROM AirQualityData ORDER BY timestamp DESC",
    function (err, results, fields) {
      if (err) {
        console.error(err);
        res.status(500).send("Error fetching data");
      } else {
        // แปลงเวลาในแต่ละ row เป็นเวลาท้องถิ่น (UTC+7)
        results.forEach((item) => {
          item.timestamp = moment(item.timestamp).format("YYYY-MM-DD HH:mm:ss");
        });
        res.send(results);
      }
    }
  );
});

//User
//sign up
app.post("/users", (req, res) => {
  const { fname, lname, email, password, avatar } = req.body;

  if (!fname || !lname || !email || !password || !avatar) {
    return res.status(400).send("Missing required fields");
  }

  connection.query(
    "INSERT INTO Users (fname, lname, email, password, avatar) VALUES (?, ?, ?, ?, ?)",
    [fname, lname, email, password, avatar || ""],
    function (err, results) {
      if (err) {
        console.error(err);
        return res.status(500).send("Error adding user");
      }
      res
        .status(201)
        .send({ message: "User created successfully", id: results.insertId });
    }
  );
});

// ล็อกอิน
app.post("/users/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).send("Missing required fields");
  }

  connection.query(
    "SELECT * FROM Users WHERE email = ?",
    [email],
    function (err, results) {
      if (err) {
        console.error(err);
        return res.status(500).send("Error fetching user");
      }

      if (results.length === 0) {
        return res.status(404).send("User not found");
      }

      const user = results[0];

      if (password !== user.password) {
        return res.status(401).send("Incorrect password");
      }

      res.send({ message: "Login successful", user });
    }
  );
});
//update
app.put("/users/update", (req, res) => {
  const { id, fname, lname, email, password } = req.body;

  if (!id || !fname || !lname || !email || !password) {
    return res.status(400).send("Missing required fields");
  }

  connection.query(
    "UPDATE Users SET fname = ?, lname = ?, email = ?, password = ? WHERE id = ?",
    [fname, lname, email, password, id],
    function (err, results) {
      if (err) {
        console.error(err);
        return res.status(500).send("Error updating user");
      }
      if (results.affectedRows === 0) {
        return res.status(404).send("User not found");
      }
      res.status(200).send({ message: "User updated successfully" });
    }
  );
});
// เปลี่ยนรหัสผ่าน (ต้องใช้รหัสเก่า)
app.put("/users/change-password/:id", (req, res) => {
  const userId = req.params.id;
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).send("Missing required fields");
  }

  connection.query(
    "SELECT password FROM Users WHERE id = ?",
    [userId],
    function (err, results) {
      if (err) {
        console.error(err);
        return res.status(500).send("Error fetching user");
      }

      if (results.length === 0) {
        return res.status(404).send("User not found");
      }

      if (oldPassword !== results[0].password) {
        return res.status(401).send("Incorrect old password");
      }

      connection.query(
        "UPDATE Users SET password = ? WHERE id = ?",
        [newPassword, userId],
        function (err) {
          if (err) {
            console.error(err);
            return res.status(500).send("Error updating password");
          }
          res.send({ message: "Password changed successfully" });
        }
      );
    }
  );
});

// รีเซ็ตรหัสผ่าน (ตั้งรหัสใหม่ผ่านอีเมล)
app.put("/users/reset-password", (req, res) => {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).send("Missing required fields");
  }

  connection.query(
    "UPDATE Users SET password = ? WHERE email = ?",
    [newPassword, email],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).send("Error resetting password");
      }
      res.send({ message: "Password reset successfully" });
    }
  );
});

// ดึงข้อมูลผู้ใช้ทั้งหมด
app.get("/users", (req, res) => {
  connection.query(
    "SELECT id, fname, lname, email, avatar FROM Users",
    function (err, results) {
      if (err) {
        console.error(err);
        return res.status(500).send("Error fetching users");
      }
      res.send(results);
    }
  );
});

// ดึงข้อมูลผู้ใช้เฉพาะ ID
app.get("/users/:id", (req, res) => {
  const userId = req.params.id;

  connection.query(
    "SELECT id, fname, lname, email, avatar FROM Users WHERE id = ?",
    [userId],
    function (err, results) {
      if (err) {
        console.error(err);
        return res.status(500).send("Error fetching user");
      }

      if (results.length === 0) {
        return res.status(404).send("User not found");
      }

      res.send(results[0]);
    }
  );
});

// ลบผู้ใช้
app.delete("/users/:id", (req, res) => {
  const userId = req.params.id;

  connection.query(
    "DELETE FROM Users WHERE id = ?",
    [userId],
    function (err, results) {
      if (err) {
        console.error(err);
        return res.status(500).send("Error deleting user");
      }

      if (results.affectedRows === 0) {
        return res.status(404).send("User not found");
      }

      res.send({ message: "User deleted successfully" });
    }
  );
});

app.listen(process.env.PORT || 3000, () => {
  console.log("CORS-enabled web server listening on port 3000");
});

// export the app for vercel serverless functions
module.exports = app;
