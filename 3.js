const WebSocket = require('ws');
const { promisify } = require('util');
const fs = require('fs');
const readline = require('readline');
const axios = require('axios');

let socket = null;
let pingInterval;
let countdownInterval;
let logInterval; // Tambahkan interval untuk log
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

// Menampilkan header menggunakan curl
const displayHeader = async () => {
  const header = await axios.get('https://raw.githubusercontent.com/Wawanahayy/JawaPride-all.sh/refs/heads/main/display.sh');
  console.log(header.data);
};

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
    startLogUpdates(); // Mulai mencetak log setiap 5 menit
  };

  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    const messageTime = new Date(data.date);
    const formattedMessageTime = formatDate(messageTime);
    
    // Menambahkan DATE ke data yang diterima
    data.DATE = formattedMessageTime;

    // Menampilkan pesan dengan timestamp
    console.log(`Received message from WebSocket:`, {
      ...data,
      currentTime: formatDate(new Date()) // Menambahkan waktu saat ini
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
    stopLogUpdates(); // Hentikan pencetakan log saat WebSocket terputus
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
    stopLogUpdates(); // Hentikan pencetakan log saat terputus
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
  }, 300000); // 300000 ms = 5 menit
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
  stopLogUpdates(); // Hentikan log saat menerima SIGINT
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
  console.log(`---------------------`);


  currentColorIndex = (currentColorIndex + 1) % colors.length; // Mengatur indeks warna untuk warna berikutnya
}


function startCountdownAndPoints() {
  clearInterval(countdownInterval);
  updateCountdownAndPoints();
  countdownInterval = setInterval(() => {
    updateCountdownAndPoints();
    updateBlinkingColorMessage(); // Memperbarui pesan berkedip setiap detik
  }, 1000);
}

async function updateCountdownAndPoints() {
  const { lastUpdated } = await getLocalStorage();
  if (lastUpdated) {
    const nextHeartbeat = new Date(lastUpdated);
    nextHeartbeat.setMinutes(nextHeartbeat.getMinutes() + 15);
    const now = new Date();
    const diff = nextHeartbeat.getTime() - now.getTime();

    if (diff > 0) {
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      countdown = `${minutes}m ${seconds}s`;

      const maxPoints = 25;
      const timeElapsed = now.getTime() - new Date(lastUpdated).getTime();
      const timeElapsedMinutes = timeElapsed / (60 * 1000);
      let newPoints = Math.min(maxPoints, (timeElapsedMinutes / 15) * maxPoints);
      newPoints = parseFloat(newPoints.toFixed(2));

      if (Math.random() < 0.1) {
        const bonus = Math.random() * 2;
        newPoints = Math.min(maxPoints, newPoints + bonus);
        newPoints = parseFloat(newPoints.toFixed(2));
      }

      potentialPoints = newPoints;
    } else {
      countdown = "Calculating...";
      potentialPoints = 25;
    }
  } else {
    countdown = "Calculating...";
    potentialPoints = 0;
  }

  await setLocalStorage({ potentialPoints, countdown });
}

async function getUserId() {
  const loginUrl = "https://ikknngrgxuxgjhplbpey.supabase.co/auth/v1/token?grant_type=password";
  const authorization = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlra25uZ3JneHV4Z2pocGxicGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU0MzgxNTAsImV4cCI6MjA0MTAxNDE1MH0.DRAvf8nH1ojnJBc3rD_Nw6t1AV8X_g6gmY_HByG2Mag";
  const apikey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlra25uZ3JneHV4Z2pocGxicGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU0MzgxNTAsImV4cCI6MjA0MTAxNDE1MH0.DRAvf8nH1ojnJBc3rD_Nw6t1AV8X_g6gmY_HByG2Mag";

  rl.question('Email: ', (email) => {
    rl.question('Password: ', async (password) => {
      try {
        const response = await axios.post(loginUrl, { email, password }, {
          headers: {
            "Authorization": authorization,
            "apikey": apikey
          }
        });
        const userId = response.data.user.id;
        await setLocalStorage({ userId });
        await connectWebSocket(userId);
        rl.close(); // Tutup readline interface setelah mendapatkan userId
      } catch (error) {
        console.error("Error during login:", error.message);
      }
    });
  });
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