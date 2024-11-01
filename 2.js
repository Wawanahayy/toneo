const WebSocket = require('ws');
const HttpsProxyAgent = require('https-proxy-agent'); // Import HttpsProxyAgent
const { promisify } = require('util');
const fs = require('fs');
const readline = require('readline');
const axios = require('axios');

let sockets = []; // Array untuk menyimpan koneksi WebSocket
let pingIntervals = [];
let countdownIntervals = [];
let logIntervals = [];
let potentialPoints = 0;
let startTime; // Untuk menyimpan waktu mulai

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Fungsi untuk mendapatkan dan menyimpan data lokal
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

// Fungsi untuk membaca proxy dari file proxies.json
async function getProxies() {
  try {
    const data = await readFileAsync('proxies.json', 'utf8');
    const json = JSON.parse(data);
    return json.proxies;
  } catch (error) {
    console.error('Error reading proxies:', error);
    return [];
  }
}

async function connectWebSocket(userId, proxy) {
  const version = "v0.2";
  const url = "wss://secure.ws.teneo.pro";
  const wsUrl = `${url}/websocket?userId=${encodeURIComponent(userId)}&version=${encodeURIComponent(version)}`;

  const socket = new WebSocket(wsUrl, { agent: proxy ? new HttpsProxyAgent(proxy) : undefined });

  startTime = new Date(); // Menyimpan waktu mulai saat koneksi WebSocket

  socket.onopen = async () => {
    const connectionTime = new Date();
    const formattedConnectionTime = formatDate(connectionTime);
    await setLocalStorage({ lastUpdated: connectionTime.toISOString() });
    console.log("WebSocket connected at", formattedConnectionTime);
    startPinging(socket);
    startCountdownAndPoints(socket);
    startLogUpdates(socket);
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
    console.log("WebSocket disconnected");
    stopPinging(socket);
    stopLogUpdates(socket);
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  return socket; // Mengembalikan koneksi socket
}

function disconnectWebSocket(socket) {
  if (socket) {
    socket.close();
    stopPinging(socket);
    stopLogUpdates(socket);
  }
}

function startPinging(socket) {
  const pingInterval = setInterval(async () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "PING" }));
      await setLocalStorage({ lastPingDate: new Date().toISOString() });
    }
  }, 10000);
  pingIntervals.push(pingInterval); // Simpan interval ping
}

function stopPinging(socket) {
  const index = pingIntervals.indexOf(socket);
  if (index > -1) {
    clearInterval(pingIntervals[index]);
    pingIntervals.splice(index, 1);
  }
}

function startLogUpdates(socket) {
  const logInterval = setInterval(async () => {
    const localStorageData = await getLocalStorage();
    console.log(`Log Update: \n - Points Today: ${localStorageData.pointsToday || 0} \n - Points Total: ${localStorageData.pointsTotal || 0} \n - Potential Points: ${potentialPoints}`);
  }, 300000);
  logIntervals.push(logInterval); // Simpan interval log
}

function stopLogUpdates(socket) {
  const index = logIntervals.indexOf(socket);
  if (index > -1) {
    clearInterval(logIntervals[index]);
    logIntervals.splice(index, 1);
  }
}

process.on('SIGINT', () => {
  console.log('Received SIGINT. Stopping pinging and log updates...');
  sockets.forEach(socket => disconnectWebSocket(socket));
  process.exit(0);
});

function calculateElapsedTime() {
  const now = new Date();
  const elapsedTime = Math.floor((now - startTime) / 1000); // Dalam detik
  const minutes = String(Math.floor(elapsedTime / 60)).padStart(2, '0');
  const seconds = String(elapsedTime % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function updateBlinkingColorMessage(socket, accountNumber) {
  console.clear();
  const currentTime = formatDate(new Date());
  const websocketStatus = socket && socket.readyState === WebSocket.OPEN ? 'Connected' : 'Disconnected'; 
  const elapsedTime = calculateElapsedTime(); // Menghitung waktu berjalan

  console.log(`------------------------------------`);
  console.log(`AKUN ${accountNumber}`);
  console.log(`Waktu Saat Ini: ${currentTime}`); 
  console.log(`Poin Hari Ini: ${pointsToday}`); 
  console.log(`Total Poin: ${pointsTotal}`); 
  console.log(`Websocket: ${websocketStatus}`); 
  console.log(`TIME RUN: ${elapsedTime}`); // Menampilkan waktu berjalan
  console.log(`FOLLOW TG: @AirdropJP_JawaPride`); 
  console.log(`------------------------------------`);
}

function startCountdownAndPoints(socket, accountNumber) {
  const countdownInterval = setInterval(async () => {
    updateBlinkingColorMessage(socket, accountNumber);
  }, 1000);
  countdownIntervals.push(countdownInterval); // Simpan interval countdown
}

async function getUserId() {
  const loginUrl = "https://ikknngrgxuxgjhplbpey.supabase.co/auth/v1/token?grant_type=password";
  const authorization = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlra25uZ3JneHV4Z2pocGxicGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU0MzgxNTAsImV4cCI6MjA0MTAxNDE1MH0.DRAvf8nH1ojnJBc3rD_Nw6t1AV8X_g6gmY_HByG2Mag";
  const apikey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlra25uZ3JneHV4Z2pocGxicGV5Iiwicm9zZSI6ImFub24iLCJpYXQiOjE3MjU0MzgxNTAsImV4cCI6MjA0MTAxNDE1MH0.DRAvf8nH1ojnJBc3rD_Nw6t1AV8X_g6gmY_HByG2Mag";

  return new Promise((resolve) => {
    rl.question('Email: ', (email) => {
      rl.question('Password: ', async (password) => {
        try {
          const response = await axios.post(loginUrl, {
            email,
            password
          }, {
            headers: {
              authorization,
              apikey,
              "Content-Type": "application/json"
            }
          });

          if (response.data && response.data.user) {
            console.log(`User ID: ${response.data.user.id}`);
            resolve(response.data.user.id);
          } else {
            console.error("User not found.");
            resolve(null);
          }
        } catch (error) {
          console.error("Error during login:", error.response ? error.response.data : error.message);
          resolve(null);
        }
      });
    });
  });
}

function formatDate(date) {
  const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

// Main function
(async () => {
  const userId = await getUserId();
  if (!userId) {
    console.error("Failed to get user ID. Exiting...");
    return;
  }

  const proxies = await getProxies(); // Ambil semua proxy dari file
  const selectedProxy = proxies[Math.floor(Math.random() * proxies.length)]; // Pilih satu proxy secara acak

  const socket = await connectWebSocket(userId, selectedProxy); // Menghubungkan dengan proxy yang dipilih
  sockets.push(socket); // Menyimpan socket ke dalam array
})();
