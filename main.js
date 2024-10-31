const WebSocket = require('ws');
const { promisify } = require('util');
const fs = require('fs');
const axios = require('axios');
const HttpsProxyAgent = require('https-proxy-agent');
const { exec } = require('child_process');

let socket = null;
let pingInterval;
let countdownInterval;
let totalPoints = 0;
let pointsToday = 0;

// Fungsi untuk menampilkan header
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

// Fungsi untuk membuat koneksi WebSocket
async function connectWebSocket(userId, tokenAkses, proxy) {
  const version = "v0.2";
  const url = "wss://secure.ws.teneo.pro";
  const wsUrl = `${url}/websocket?userId=${encodeURIComponent(userId)}&version=${encodeURIComponent(version)}`;

  const options = {};
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
    socket.send(JSON.stringify({ type: "KONEKSI" }));
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
      totalPoints = data.pointsTotal;
      pointsToday = data.pointsToday;
    }
  };

  socket.onclose = () => {
    console.log("WebSocket disconnected");
    stopPinging();
    setTimeout(() => connectWebSocket(userId, tokenAkses, proxy), 10000); // Coba sambung kembali setelah 10 detik
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
  }, 30000); // Kirim ping setiap 30 detik
}

function stopPinging() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null; // Reset interval ping
  }
}

function startCountdownAndPoints() {
  let secondsLeft = 60;
  countdownInterval = setInterval(() => {
    if (secondsLeft > 0) {
      console.log(`Countdown: ${secondsLeft} seconds left`);
      secondsLeft--;
    } else {
      clearInterval(countdownInterval);
      console.log("Countdown finished");
      // Lakukan tindakan yang diinginkan setelah countdown selesai
    }
  }, 1000); // Mengupdate setiap detik
}

async function initialize() {
  displayHeader();

  const localStorageData = await getLocalStorage();
  console.log("Local Storage Data:", localStorageData);

  const configData = await getConfig();
  const userId = localStorageData.userId || configData.userId || prompt('Please enter your User ID: ');
  const proxy = configData.proxy || ""; // Mengambil proxy dari config.json atau gunakan string kosong jika tidak ada

  const { data, error } = await supabase.auth.signInWithPassword({
    email: process.env.SUPABASE_USER_EMAIL,
    password: process.env.SUPABASE_USER_PASSWORD,
  });

  if (error) throw error;

  const session = data.session;
  console.log("Autentikasi berhasil");
  console.log("Token Akses berhasil");

  supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token
  });

  await connectWebSocket(userId, session.access_token, proxy);
}

initialize();
