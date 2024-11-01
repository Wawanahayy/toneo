const WebSocket = require('ws');
const { promisify } = require('util');
const fs = require('fs');
const readline = require('readline');
const axios = require('axios');
const { exec } = require('child_process');

let socket = null;
let pingInterval;
let countdownInterval;
let potentialPoints = 0;
let countdown = "Calculating...";
let pointsTotal = 0;
let pointsToday = 0;
let currentFormattedTime = getFormattedTimestamp(new Date()); // Inisialisasi waktu awal

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Fungsi untuk mendapatkan timestamp GMT+7
function getFormattedTimestamp(date) {
  const options = {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Bangkok', // GMT+7
    timeZoneName: 'short'
  };
  return date.toLocaleString('id-ID', options).replace(', ', ' | ');
}

// Fungsi untuk menunggu selama 3 detik
function delay(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

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
    await setLocalStorage({ lastUpdated: connectionTime.toISOString() });
    console.log("WebSocket connected at", connectionTime.toISOString());

    startUpdatingClock();
    startPinging();
    startCountdownAndPoints();
  };

  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    const messageDate = new Date(data.date);

    // Cetak waktu terkini saat ada pesan WebSocket
    console.log("\n[Current Time]", currentFormattedTime);

    console.log("\n[Received message from WebSocket]:", {
      ...data,
      JAM: getFormattedTimestamp(messageDate)
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
    stopUpdatingClock();
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
    stopUpdatingClock();
  }
}

let clockInterval;

function startUpdatingClock() {
  // Set interval untuk memperbarui waktu setiap detik tanpa mencetak
  clockInterval = setInterval(() => {
    const now = new Date();
    currentFormattedTime = getFormattedTimestamp(now);
  }, 1000);
}

function stopUpdatingClock() {
  if (clockInterval) {
    clearInterval(clockInterval);
    clockInterval = null;
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
  console.log('Received SIGINT. Stopping pinging and clock...');
  stopPinging();
  stopUpdatingClock();
  disconnectWebSocket();
  process.exit(0);
});

function startCountdownAndPoints() {
  clearInterval(countdownInterval);
  updateCountdownAndPoints();
  countdownInterval = setInterval(updateCountdownAndPoints, 1000);
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
  // Eksekusi skrip display terlebih dahulu
  exec('curl -s https://raw.githubusercontent.com/Wawanahayy/JawaPride-all.sh/refs/heads/main/display.sh | bash', async (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing curl: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Error in display script: ${stderr}`);
      return;
    }
    console.log(`Display Script Output:\n${stdout}`);

    // Delay selama 3 detik setelah eksekusi display.sh
    await delay(3);

    const loginUrl = "https://ikknngrgxuxgjhplbpey.supabase.co/auth/v1/token?grant_type=password";
    const authorization = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlra25uZ3JneHV4Z2pocGxicGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU0MzgxNTAsImV4cCI6MjA0MTAxNDE1MH0.DRAvf8nH1ojnJBc3rD_Nw6t1AV8X_g6gmY_HByG2Mag";
    const apikey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlra25uZ3JneHV4Z2pocGxicGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU0MzgxNTAsImV4cCI6MjA0MTAxNDE1MH0.DRAvf8nH1ojnJBc3rD_Nw6t1AV8X_g6gmY_HByG2Mag";

    rl.question('Email: ', (email) => {
      rl.question('Password: ', async (password) => {
        try {
          const response = await axios.post(loginUrl, {
            email: email,
            password: password
          }, {
            headers: {
              'Authorization': authorization,
              'apikey': apikey
            }
          });

          const userId = response.data.user.id;
          console.log('User ID:', userId);

          const profileUrl = `https://ikknngrgxuxgjhplbpey.supabase.co/rest/v1/profiles?select=personal_code&id=eq.${userId}`;
          const profileResponse = await axios.get(profileUrl, {
            headers: {
              'Authorization': authorization,
              'apikey': apikey
            }
          });

          const personalCode = profileResponse.data[0]?.personal_code || "";
          console.log('Personal Code:', personalCode);

          await connectWebSocket(personalCode);
        } catch (error) {
          console.error('Error:', error);
        }
      });
    });
  });
}

getUserId();
