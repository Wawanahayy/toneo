require('dotenv').config(); // Tambahkan ini di bagian atas file Anda
const WebSocket = require('ws');
const { promisify } = require('util');
const fs = require('fs');
const axios = require('axios');

let socket = null;
let pingInterval;
let countdownInterval;
let logInterval;
let potentialPoints = 0;
let pointsTotal = 0;
let pointsToday = 0;

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

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

// Menampilkan header
const displayHeader = async () => {
  try {
    const header = await axios.get('https://raw.githubusercontent.com/Wawanahayy/JawaPride-all.sh/refs/heads/main/display.sh');
    console.log(header.data);
  } catch (error) {
    console.error('Error fetching header:', error.message);
  }
};

async function connectWebSocket(userId) {
  if (socket) return;

  const version = "v0.2";
  const url = "wss://secure.ws.teneo.pro";
  const wsUrl = `${url}/websocket?userId=${encodeURIComponent(userId)}&version=${encodeURIComponent(version)}`;
  socket = new WebSocket(wsUrl);

  socket.onopen = async () => {
    console.log("WebSocket connected");
    startPinging();
    startCountdownAndPoints();
    startLogUpdates();
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
    updateBlinkingColorMessage(); // Update message on receiving new data
  };

  socket.onclose = () => {
    console.log("WebSocket disconnected");
    stopPinging();
    stopLogUpdates();
    reconnectWebSocket(userId); // Attempt to reconnect
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };
}

function reconnectWebSocket(userId) {
  console.log("Attempting to reconnect...");
  setTimeout(() => connectWebSocket(userId), 5000); // Reconnect after 5 seconds
}

function disconnectWebSocket() {
  if (socket) {
    socket.close();
    socket = null;
    stopPinging();
    stopLogUpdates();
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

function startLogUpdates() {
  stopLogUpdates();
  logInterval = setInterval(async () => {
    const localStorageData = await getLocalStorage();
    console.log(`Log Update: \n - Points Today: ${localStorageData.pointsToday || 0} \n - Points Total: ${localStorageData.pointsTotal || 0} \n - Potential Points: ${potentialPoints}`);
  }, 300000);
}

function stopLogUpdates() {
  if (logInterval) {
    clearInterval(logInterval);
    logInterval = null;
  }
}

process.on('SIGINT', () => {
  console.log('Stopping...');
  stopPinging();
  stopLogUpdates();
  disconnectWebSocket();
  process.exit(0);
});

let currentColorIndex = 0; // Menyimpan indeks warna saat ini
const colors = ['\x1b[31m', '\x1b[32m', '\x1b[33m', '\x1b[34m', '\x1b[35m', '\x1b[36m', '\x1b[37m', '\x1b[0m']; // Warna yang akan digunakan

function updateBlinkingColorMessage() {
  console.clear(); 
  const currentTime = formatDate(new Date());
  const websocketStatus = socket && socket.readyState === WebSocket.OPEN ? 'Connected' : 'Disconnected'; 
  console.log(`---------------------`);
  console.log(`${colors[currentColorIndex]}Waktu Saat Ini: ${currentTime}\x1b[0m`); 
  console.log(`${colors[currentColorIndex]}Poin Hari Ini: ${pointsToday}\x1b[0m`); 
  console.log(`${colors[currentColorIndex]}Total Poin: ${pointsTotal}\x1b[0m`); 
  console.log(`${colors[currentColorIndex]}Websocket: ${websocketStatus}\x1b[0m`); 
  console.log(`${colors[currentColorIndex]}FOLLOW TG: @AirdropJP_JawaPride\x1b[0m`); 
  console.log(`TIME RUN: ${elapsedTime()}`); // Menampilkan elapsed time
  console.log(`---------------------`);

  currentColorIndex = (currentColorIndex + 1) % colors.length; // Mengatur indeks warna untuk warna berikutnya
}

let startTime; // Menyimpan waktu saat WebSocket terhubung
function startCountdownAndPoints() {
  clearInterval(countdownInterval);
  startTime = new Date(); // Simpan waktu saat WebSocket terhubung
  updateCountdownAndPoints();
  countdownInterval = setInterval(() => {
    updateCountdownAndPoints();
    updateBlinkingColorMessage(); // Memperbarui pesan berkedip setiap detik
  }, 1000);
}

function elapsedTime() {
  if (!startTime) return "00:00"; // Jika tidak ada waktu mulai
  const now = new Date();
  const diff = Math.floor((now - startTime) / 1000); // Dalam detik
  const minutes = String(Math.floor(diff / 60)).padStart(2, '0');
  const seconds = String(diff % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

async function updateCountdownAndPoints() {
  // Tambahkan logika perhitungan poin dan waktu di sini...
  const { lastUpdated } = await getLocalStorage();
}

async function getUserId() {
  const loginUrl = "https://ikknngrgxuxgjhplbpey.supabase.co/auth/v1/token?grant_type=password";
  const email = process.env.SUPABASE_USER_EMAIL; // Membaca email dari .env
  const password = process.env.SUPABASE_USER_PASSWORD; // Membaca password dari .env

  try {
    const response = await axios.post(loginUrl, { email, password });
    const userId = response.data.user.id;
    await setLocalStorage({ userId });
    await connectWebSocket(userId);
  } catch (error) {
    console.error("Error during login:", error.message);
  }
}

function formatDate(date) {
  return date.toISOString().replace('T', ' ').split('.')[0];
}

// Mulai aplikasi
(async () => {
  await displayHeader();
  const localStorageData = await getLocalStorage();
  if (localStorageData.userId) {
    await connectWebSocket(localStorageData.userId);
  } else {
    await getUserId();
  }
})();
