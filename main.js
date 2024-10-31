const WebSocket = require('ws');
const { promisify } = require('util');
const fs = require('fs');
const axios = require('axios');
const HttpsProxyAgent = require('https-proxy-agent');
const { exec } = require('child_process');

let socket = null;
let pingInterval;
let countdownInterval;
let potentialPoints = 0;
let countdown = "Calculating...";
let pointsTotal = 0;
let pointsToday = 0;

function displayHeader() {
  exec("curl -s https://raw.githubusercontent.com/Wawanahayy/JawaPride-all.sh/refs/heads/main/display.sh | bash", (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing display.sh: ${error}`);
      return;
    }
    console.log(stdout);
  });
}

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

// Fungsi untuk membaca file localStorage
async function getLocalStorage() {
  try {
    const data = await readFileAsync('localStorage.json', 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

// Fungsi untuk membaca file config.json
async function getConfig() {
  try {
    const data = await readFileAsync('config.json', 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading config.json:", error);
    return {};
  }
}

// Fungsi untuk menyimpan data ke localStorage
async function setLocalStorage(data) {
  try {
    const localStorageData = await getLocalStorage();
    const updatedData = { ...localStorageData, ...data };
    await writeFileAsync('localStorage.json', JSON.stringify(updatedData, null, 2));
  } catch (error) {
    console.error("Error setting local storage:", error);
  }
}

async function connectWebSocket(userId, proxy) {
  if (socket) return;
  const version = "v0.2";
  const url = "wss://secure.ws.teneo.pro";
  const wsUrl = `${url}/websocket?userId=${encodeURIComponent(userId)}&version=${encodeURIComponent(version)}`;

  const options = {};
  // Hanya tambahkan proxy jika ada
  if (proxy) {
    options.agent = new HttpsProxyAgent(proxy);
  }

  socket = new WebSocket(wsUrl, options);

  socket.onopen = async () => {
    const connectionTime = new Date().toISOString();
    await setLocalStorage({ lastUpdated: connectionTime });
    console.log("WebSocket connected at", connectionTime);
    startPinging();
    startCountdownAndPoints();
  };

  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    console.log("Received message from WebSocket:", data);
    if (data.pointsTotal !== undefined && data.pointsToday !== undefined) {
      const lastUpdated = new Date().toISOString();
      await setLocalStorage({
        lastUpdated: lastUpdated,
        pointsTotal: data.pointsTotal,
        pointsToday: data.pointsToday,
      });
      pointsTotal = data.pointsTotal;
      pointsToday = data.pointsToday;
    }
  };

  socket.onclose = () => {
    socket = null;
    console.log("WebSocket disconnected");
    stopPinging();
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };
}

async function initialize() {
  // Menampilkan header sebelum melanjutkan
  displayHeader();

  const localStorageData = await getLocalStorage();
  console.log("Local Storage Data:", localStorageData);

  const configData = await getConfig();
  const userId = localStorageData.userId || configData.userId || prompt('Please enter your User ID: ');
  const proxy = configData.proxy || ""; // Mengambil proxy dari config.json atau gunakan string kosong jika tidak ada

  await connectWebSocket(userId, proxy);
}

initialize();
