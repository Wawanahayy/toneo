const WebSocket = require('ws');
const { promisify } = require('util');
const fs = require('fs');
const readline = require('readline');
const axios = require('axios');

let sockets = {}; // Objek untuk menyimpan soket per akun
let pingIntervals = {};
let logIntervals = {};
let potentialPoints = 0;
let countdown = "Calculating...";
let pointsTotal = 0;
let pointsToday = 0;
let startTime;

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Fungsi untuk mendapatkan localStorage
async function getLocalStorage() {
  try {
    const data = await readFileAsync('localStorage.json', 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

// Fungsi untuk mengatur localStorage
async function setLocalStorage(data) {
  const currentData = await getLocalStorage();
  const newData = { ...currentData, ...data };
  await writeFileAsync('localStorage.json', JSON.stringify(newData));
}

// Fungsi untuk menghubungkan ke WebSocket
async function connectWebSocket(userId, proxy) {
  if (sockets[userId]) return; // Jika soket sudah ada untuk akun ini

  const version = "v0.2";
  const url = "wss://secure.ws.teneo.pro";
  const wsUrl = `${url}/websocket?userId=${encodeURIComponent(userId)}&version=${encodeURIComponent(version)}`;
  
  // Jika proxy disediakan, gunakan
  const socket = new WebSocket(wsUrl, {
    agent: proxy ? new HttpsProxyAgent(proxy) : undefined // Menggunakan agent jika proxy ada
  });

  startTime = new Date();

  socket.onopen = async () => {
    const connectionTime = new Date();
    await setLocalStorage({ lastUpdated: connectionTime.toISOString() });
    console.log(`WebSocket connected for user ${userId} at`, formatDate(connectionTime));
    startPinging(userId);
    startLogUpdates(userId);
  };

  socket.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      data.DATE = formatDate(new Date(data.date));
      console.log(`Received message for user ${userId}:`, data);

      if (data.pointsTotal !== undefined && data.pointsToday !== undefined) {
        await setLocalStorage({
          lastUpdated: new Date().toISOString(),
          pointsTotal: data.pointsTotal,
          pointsToday: data.pointsToday,
        });
        pointsTotal = data.pointsTotal;
        pointsToday = data.pointsToday;
      }
    } catch (error) {
      console.error(`Error parsing WebSocket message for user ${userId}:`, error);
    }
  };

  socket.onclose = () => {
    console.log(`WebSocket disconnected for user ${userId}`);
    delete sockets[userId];
    stopPinging(userId);
    stopLogUpdates(userId);
  };

  socket.onerror = (error) => {
    console.error(`WebSocket error for user ${userId}:`, error);
  };

  sockets[userId] = socket; // Menyimpan soket untuk pengguna
}

function disconnectWebSocket(userId) {
  if (sockets[userId]) {
    sockets[userId].close();
    delete sockets[userId];
    stopPinging(userId);
    stopLogUpdates(userId);
  }
}

// Fungsi untuk memulai pinging
function startPinging(userId) {
  stopPinging(userId);
  pingIntervals[userId] = setInterval(async () => {
    if (sockets[userId] && sockets[userId].readyState === WebSocket.OPEN) {
      sockets[userId].send(JSON.stringify({ type: "PING" }));
      await setLocalStorage({ lastPingDate: new Date().toISOString() });
    }
  }, 10000);
}

// Fungsi untuk menghentikan pinging
function stopPinging(userId) {
  if (pingIntervals[userId]) {
    clearInterval(pingIntervals[userId]);
    delete pingIntervals[userId];
  }
}

// Fungsi untuk memulai pembaruan log
function startLogUpdates(userId) {
  stopLogUpdates(userId);
  logIntervals[userId] = setInterval(async () => {
    const localStorageData = await getLocalStorage();
    console.log(`Log Update for user ${userId}: 
      - Points Today: ${localStorageData.pointsToday || 0} 
      - Points Total: ${localStorageData.pointsTotal || 0} 
      - Potential Points: ${potentialPoints}`);
  }, 300000);
}

// Fungsi untuk menghentikan pembaruan log
function stopLogUpdates(userId) {
  if (logIntervals[userId]) {
    clearInterval(logIntervals[userId]);
    delete logIntervals[userId];
  }
}

// Fungsi untuk mendapatkan User ID
async function getUserId() {
  const loginUrl = "https://ikknngrgxuxgjhplbpey.supabase.co/auth/v1/token?grant_type=password";
  const authorization = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlra25uZ3JneHV4Z2pocGxicGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU0MzgxNTAsImV4cCI6MjA0MTAxNDE1MH0.DRAvf8nH1ojnJBc3rD_Nw6t1AV8X_g6gmY_HByG2Mag";
  const apikey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlra25uZ3JneHV4Z2pocGxicGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU0MzgxNTAsImV4cCI6MjA0MTAxNDE1MH0.DRAvf8nH1ojnJBc3rD_Nw6t1AV8X_g6gmY_HByG2Mag";

  rl.question("Enter your email: ", async (email) => {
    rl.question("Enter your password: ", async (password) => {
      rl.question("Enter your proxy (or leave empty for no proxy): ", async (proxy) => {
        try {
          const response = await axios.post(loginUrl, {
            email,
            password
          }, {
            headers: {
              'Authorization': authorization,
              'apikey': apikey
            }
          });

          const { user } = response.data;
          if (user && user.id) {
            console.log("Login successful! User ID:", user.id);
            await setLocalStorage({ userId: user.id });
            await connectWebSocket(user.id, proxy);
          } else {
            console.log("Login failed! Please check your credentials.");
          }
        } catch (error) {
          console.error("Error during login:", error);
        }
      });
    });
  });
}

// Fungsi untuk format tanggal
function formatDate(date) {
  const options = { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false };
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

// Fungsi utama untuk menjalankan skrip
(async () => {
  const localStorageData = await getLocalStorage();
  const { userId } = localStorageData;

  if (userId) {
    const proxy = localStorageData.proxy || null; // Mengambil proxy dari localStorage jika ada
    await connectWebSocket(userId, proxy);
  } else {
    await getUserId();
  }
})();
