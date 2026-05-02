const admin = require("firebase-admin");
const { google } = require("googleapis");

const serviceAccount = require("../serviceAccountKey.json");

const CONFIG = {
  PROJECT_ID: "pounes-global-dater-205bd",
  FCM_ENDPOINT: "https://fcm.googleapis.com/v1/projects/pounes-global-dater-205bd/messages:send",
  SCOPES: ["https://www.googleapis.com/auth/firebase.messaging"],
};

// دریافت access token
async function getAccessToken() {
  try {
    const jwtClient = new google.auth.JWT(
      serviceAccount.client_email,
      null,
      serviceAccount.private_key,
      CONFIG.SCOPES,
      null
    );

    const token = await jwtClient.authorize();
    return token.access_token;
  } catch (error) {
    console.error("Error getting access token:", error);
    throw error;
  }
}

// مقداردهی اولیه Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = {
  getAccessToken: getAccessToken,
  admin: admin,
  CONFIG
};