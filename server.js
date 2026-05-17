const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const { Expo } = require("expo-server-sdk");

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const app = express();
app.use(cors());

let savedToken = "";
const expo = new Expo();

// -----------------------------
// SAVE FCM/EXPO TOKEN
// -----------------------------
app.get("/save-token", (req, res) => {

  const token = req.query.token;

  if (!token) {
    return res.send("No token received");
  }

  savedToken = token;

  console.log("Token Saved");

  res.send("Token Saved");
});

// -----------------------------
// CHECK CURRENT EVERY 1 SECOND
// -----------------------------
setInterval(async () => {

  try {

    const snap = await db
      .collection("readings")
      .orderBy("timestamp", "desc")
      .limit(1)
      .get();

    if (snap.empty) return;

    const data = snap.docs[0].data();

    const current = data.current || 0;
    const threshold = data.threshold || 0;

    console.log("Current:", current);

    // -----------------------------
    // OVERCURRENT CHECK
    // -----------------------------
    if (current > threshold && savedToken) {

      console.log("⚠ OVERCURRENT DETECTED");

      const messages = [
        {
          to: savedToken,
          sound: "default",
          title: "⚠ AmpSense Alert",
          body: `Current ${current.toFixed(2)}A exceeded threshold ${threshold}A`,
        },
      ];

      await expo.sendPushNotificationsAsync(messages);

      console.log("Notification Sent");
    }

  } catch (err) {

    console.log(err);

  }

}, 1000);

// -----------------------------
app.listen(3000, () => {
  console.log("Server running on port 3000");
});