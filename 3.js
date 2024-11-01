const WebSocket = require('ws');
const { promisify } = require('util');
const fs = require('fs');
const readline = require('readline');
const axios = require('axios');
const { exec } = require('child_process');

let socket = null;
let pingInterval;
let countdownInterval;
let logInterval;
let potentialPoints = 0;
let countdown = "Calculating...";
let pointsTotal = 0;
let pointsToday = 0;

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});


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
    const connectionTime = new Date();
    const formattedConnectionTime = formatDate(connectionTime);
    await setLocalStorage({ lastUpdated: connectionTime.toISOString() });
    console.log("WebSocket connected at", formattedConnectionTime);
    startPinging();
    startCountdownAndPoints();
    startLogUpdates();
  };

  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    const messageTime = new Date(data.date);
    const formattedMessageTime = formatDate(messageTime);
    
    data.DATE = formattedMessageTime;

    console.log(`Received message from WebSocket:`, {
      ...data,
      currentTime: formatDate(new Date())
    });

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
    stopLogUpdates();
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };
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
  console.log('Received SIGINT. Stopping pinging and log updates...');
  stopPinging();
  stopLogUpdates();
  disconnectWebSocket();
  process.exit(0);
});

// Tambahkan variabel untuk menyimpan waktu awal
let startTime;

// Modifikasi fungsi connectWebSocket
async function connectWebSocket(userId) {
  if (socket) return;
  const version = "v0.2";
  const url = "wss://secure.ws.teneo.pro";
  const wsUrl = `${url}/websocket?userId=${encodeURIComponent(userId)}&version=${encodeURIComponent(version)}`;
  socket = new WebSocket(wsUrl);

  socket.onopen = async () => {
    const connectionTime = new Date();
    startTime = connectionTime; // Simpan waktu awal
    const formattedConnectionTime = formatDate(connectionTime);
    await setLocalStorage({ lastUpdated: connectionTime.toISOString() });
    console.log("WebSocket connected at", formattedConnectionTime);
    startPinging();
    startCountdownAndPoints();
    startLogUpdates();
  };

  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    const messageTime = new Date(data.date);
    const formattedMessageTime = formatDate(messageTime);
    
    data.DATE = formattedMessageTime;

    console.log(`Received message from WebSocket:`, {
      ...data,
      currentTime: formatDate(new Date())
    });

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
    stopLogUpdates();
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };
}

// Modifikasi fungsi updateBlinkingColorMessage
function updateBlinkingColorMessage() {
  console.clear(); 
  const currentTime = formatDate(new Date());
  const websocketStatus = socket && socket.readyState === WebSocket.OPEN ? 'Connected' : 'Disconnected'; 
  const elapsedTime = calculateElapsedTime(); // Hitung waktu yang telah berlalu

  console.log(`---------------------`);
  console.log(`${colors[currentColorIndex]}Waktu Saat Ini: ${currentTime}\x1b[0m`); 
  console.log(`${colors[currentColorIndex]}Poin Hari Ini: ${pointsToday}\x1b[0m`); 
  console.log(`${colors[currentColorIndex]}Total Poin: ${pointsTotal}\x1b[0m`); 
  console.log(`${colors[currentColorIndex]}Websocket: ${websocketStatus}\x1b[0m`); 
  console.log(`${colors[currentColorIndex]}FOLLOW TG: @AirdropJP_JawaPride\x1b[0m`); 
  console.log(`${colors[currentColorIndex]}TIME RUN: ${elapsedTime}\x1b[0m`); // Tampilkan waktu berjalan
  console.log(`---------------------`);

  currentColorIndex = (currentColorIndex + 1) % colors.length;
}

// Fungsi untuk menghitung waktu yang telah berlalu
function calculateElapsedTime() {
  const now = new Date();
  const elapsedMilliseconds = now - startTime; // Hitung waktu yang telah berlalu dalam milidetik
  const totalSeconds = Math.floor(elapsedMilliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`; // Format mm:ss
}

// Fungsi untuk memformat tanggal dan waktu
function formatDate(date) {
  const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
  return date.toLocaleString('en-US', options);
}

// Memulai aplikasi
(async () => {
  const localStorageData = await getLocalStorage();
  if (localStorageData.lastUpdated) {
    console.log(`Last updated: ${localStorageData.lastUpdated}`);
  }
  getUserId();
})();
