const WebSocket = require('ws');
const { promisify } = require('util');
const fs = require('fs');
const readline = require('readline');
const axios = require('axios');

let socket = null;
let pingInterval;
let countdownInterval;
let potentialPoints = 0;
let pointsTotal = 0;
let pointsToday = 0;

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Mengambil dan menyimpan data lokal
async function getLocalStorage() {
  try {
    const data = await readFileAsync('localStorage.json', 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

async function setLocalStorage(data) {
  const currentData = await getLocalStorage();
  const newData = { ...currentData, ...data };
  await writeFileAsync('localStorage.json', JSON.stringify(newData));
}

async function connectWebSocket(userId) {
  if (socket) return;

  const version = "v0.2";
  const url = "wss://secure.ws.teneo.pro";
  const wsUrl = `${url}/websocket?userId=${encodeURIComponent(userId)}&version=${encodeURIComponent(version)}`;
  socket = new WebSocket(wsUrl);

  socket.onopen = async () => {
    startPinging();
    startCountdownAndPoints();
  };

  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    if (data.pointsTotal !== undefined && data.pointsToday !== undefined) {
      await setLocalStorage({
        pointsTotal: data.pointsTotal,
        pointsToday: data.pointsToday,
      });
      pointsTotal = data.pointsTotal;
      pointsToday = data.pointsToday;
    }
  };

  socket.onclose = () => {
    stopPinging();
    reconnectWebSocket(userId); // Attempt to reconnect
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };
}

function reconnectWebSocket(userId) {
  setTimeout(() => connectWebSocket(userId), 5000); // Reconnect after 5 seconds
}

function disconnectWebSocket() {
  if (socket) {
    socket.close();
    socket = null;
    stopPinging();
  }
}

function startPinging() {
  stopPinging();
  pingInterval = setInterval(async () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "PING" }));
      await setLocalStorage({ lastPingDate: new Date().toISOString() });
    }
  }, 10000);
}

function stopPinging() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
}

process.on('SIGINT', () => {
  console.log('Stopping...');
  stopPinging();
  disconnectWebSocket();
  process.exit(0);
});

let startTime; // Menyimpan waktu saat WebSocket terhubung
function startCountdownAndPoints() {
  clearInterval(countdownInterval);
  startTime = new Date(); // Simpan waktu saat WebSocket terhubung
  countdownInterval = setInterval(() => {
    updateCountdownAndPoints();
  }, 1000);
}

async function updateCountdownAndPoints() {
  const { lastUpdated } = await getLocalStorage();
  // Logika perhitungan poin dan waktu...
}

async function getUserId() {
  const loginUrl = "https://ikknngrgxuxgjhplbpey.supabase.co/auth/v1/token?grant_type=password";
  rl.question('Email: ', (email) => {
    rl.question('Password: ', async (password) => {
      try {
        const response = await axios.post(loginUrl, { email, password });
        const userId = response.data.user.id;
        await setLocalStorage({ userId });
        await connectWebSocket(userId);
        rl.close();
      } catch (error) {
        console.error("Error during login:", error.message);
      }
    });
  });
}

// Mulai aplikasi
(async () => {
  const localStorageData = await getLocalStorage();
  if (localStorageData.userId) {
    await connectWebSocket(localStorageData.userId);
  } else {
    await getUserId();
  }
})();
