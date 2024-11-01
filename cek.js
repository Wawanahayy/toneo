const WebSocket = require('ws');
const { promisify } = require('util');
const fs = require('fs');
const readline = require('readline');
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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Fungsi untuk menampilkan teks berwarna
function display_colored_text() {
  console.log("\x1b[40;96m============================================================");
  console.log("\x1b[42;37m=======================  J.W.P.A  ==========================");
  console.log("\x1b[45;97m================= @AirdropJP_JawaPride =====================");
  console.log("\x1b[43;30m=============== https://x.com/JAWAPRIDE_ID =================");
  console.log("\x1b[41;97m============= https://linktr.ee/Jawa_Pride_ID ==============");
  console.log("\x1b[44;30m============================================================\x1b[0m");
}

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
    updateBlinkingColorMessage();
  };

  socket.onclose = () => {
    stopPinging();
    stopLogUpdates();
    reconnectWebSocket(userId);
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };
}

function reconnectWebSocket(userId) {
  setTimeout(() => connectWebSocket(userId), 5000);
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

let currentColorIndex = 0;
const colors = ['\x1b[31m', '\x1b[32m', '\x1b[33m', '\x1b[34m', '\x1b[35m', '\x1b[36m', '\x1b[37m', '\x1b[0m'];

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
  console.log(`---------------------`);

  currentColorIndex = (currentColorIndex + 1) % colors.length; 
}

let startTime; 
function startCountdownAndPoints() {
  clearInterval(countdownInterval);
  startTime = new Date(); 
  updateCountdownAndPoints();
  countdownInterval = setInterval(() => {
    updateCountdownAndPoints();
    updateBlinkingColorMessage(); 
  }, 1000);
}

function formatDate(date) {
  return date.toISOString().replace('T', ' ').split('.')[0];
}

// Mulai aplikasi
(async () => {
  display_colored_text(); // Tampilkan teks berwarna
  await new Promise(resolve => setTimeout(resolve, 5000)); // Delay 5 detik
  await displayHeader(); // Jika ada header yang ingin ditampilkan, sesuaikan dengan kebutuhan
  const localStorageData = await getLocalStorage();
  if (localStorageData.userId) {
    await connectWebSocket(localStorageData.userId);
  } else {
    await getUserId();
  }
})();
