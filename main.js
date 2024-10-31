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

// Fungsi untuk menyimpan data ke localStorage
async function setLocalStorage(data) {
  try {
    const currentData = await getLocalStorage(); // Mendapatkan data saat ini dari localStorage
    const newData = { ...currentData, ...data }; // Menggabungkan data saat ini dengan data baru
    await writeFileAsync('localStorage.json', JSON.stringify(newData, null, 2)); // Menyimpan data baru ke file
  } catch (error) {
    console.error("Error setting localStorage:", error);
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
    startPinging(); // Memanggil fungsi startPinging
    startCountdownAndPoints(); // Memanggil fungsi startCountdownAndPoints
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
    stopPinging(); // Memanggil fungsi stopPinging
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };
}

function startPinging() {
  if (pingInterval) return; // Jangan mulai lagi jika sudah berjalan
  pingInterval = setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "ping" })); // Kirim ping ke server
      console.log("Ping sent to server");
    }
  }, 30000); // Kirim ping setiap 30 detik (30000 ms)
}

function stopPinging() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null; // Reset interval ping
  }
}

function startCountdownAndPoints() {
  // Misalnya, mulai dengan 60 detik
  let secondsLeft = 60;
  countdownInterval = setInterval(() => {
    if (secondsLeft > 0) {
      console.log(`Countdown: ${secondsLeft} seconds left`);
      secondsLeft--;
    } else {
      clearInterval(countdownInterval);
      console.log("Countdown finished");
      // Lakukan tindakan yang diinginkan setelah countdown selesai, seperti mengupdate poin atau lainnya
    }
  }, 1000); // Mengupdate setiap detik
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
