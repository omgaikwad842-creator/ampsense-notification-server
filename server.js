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

const expo = new Expo();

let alertSent = false;

// -----------------------------
// SAVE EXPO TOKEN IN FIREBASE
// -----------------------------
app.get("/save-token", async (req, res) => {

  const token = req.query.token;

  if (!token) {
    return res.send("No token received");
  }

  await db.collection("tokens").doc("device1").set({
    token: token,
  });

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
    // GET SAVED TOKEN
    // -----------------------------
    const tokenSnap = await db
      .collection("tokens")
      .doc("device1")
      .get();

    if (!tokenSnap.exists) return;

    const savedToken = tokenSnap.data().token;

    // -----------------------------
    // OVERCURRENT CHECK
    // -----------------------------
    if (
      current > threshold &&
      savedToken &&
      !alertSent
    ) {

      console.log("⚠ OVERCURRENT DETECTED");

      const messages = [
        {
          to: savedToken,
          sound: "default",
          title: "⚠ AmpSense Alert",
          body:
            `Current ${current.toFixed(2)}A exceeded threshold ${threshold}A`,
        },
      ];

      await expo.sendPushNotificationsAsync(messages);

      console.log("Notification Sent");

      alertSent = true;
    }

    // -----------------------------
    // RESET ALERT
    // -----------------------------
    if (current <= threshold) {

      alertSent = false;

    }

  } catch (err) {

    console.log(err);

  }

}, 1000);

// -----------------------------
app.listen(3000, () => {
  console.log("Server running on port 3000");
});