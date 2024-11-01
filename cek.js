const WebSocket = require('ws');
const { promisify } = require('util');
const fs = require('fs');
const readline = require('readline');
const axios = require('axios');
const { exec } = require('child_process'); // Import exec untuk menjalankan perintah

let socket = null;
let pingInterval;
let countdownInterval;
let potentialPoints = 0;
let countdown = "Calculating...";
let pointsTotal = 0;
let pointsToday = 0;

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

// Fungsi untuk mendapatkan timestamp dalam format JAM: HH:mm:ss GMT+7
function getCurrentTimestampGMT7() {
  const options = {
    timeZone: 'Asia/Bangkok', // GMT+7
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };
  
  const timeParts = new Intl.DateTimeFormat('en-US', options).formatToParts(new Date());
  const timestamp = `${timeParts[0].value}:${timeParts[2].value}:${timeParts[4].value}`; // Mengambil jam, menit, dan detik
  return `JAM: ${timestamp}`; // Format akhir
}

// Log function
async function logMessage(message) {
  const timestamp = getCurrentTimestampGMT7(); // Mendapatkan timestamp
  const logEntry = `${timestamp} - ${message}\n`; // Menyertakan timestamp dalam log
  await fs.promises.appendFile('logs.txt', logEntry);
}

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
    const connectionTime = getCurrentTimestampGMT7();
    await setLocalStorage({ lastUpdated: connectionTime });
    console.log("WebSocket connected at", connectionTime);
    await logMessage(`WebSocket connected at ${connectionTime}`);
    startPinging();
    startCountdownAndPoints();
  };

  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    console.log("Received message from WebSocket:", data);
    await logMessage(`Received message: ${JSON.stringify(data)}`);
    if (data.pointsTotal !== undefined && data.pointsToday !== undefined) {
      const lastUpdated = new Date().toISOString();
      await setLocalStorage({
        lastUpdated: lastUpdated,
        pointsTotal: data.pointsTotal,
        pointsToday: data.pointsToday,
      });
      pointsTotal = data.pointsTotal;
      pointsToday = data.pointsToday;
      await logMessage(`Points updated - Total: ${pointsTotal}, Today: ${pointsToday}`);
    }
  };

  socket.onclose = () => {
    socket = null;
    console.log("WebSocket disconnected");
    logMessage("WebSocket disconnected");
    stopPinging();
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
    logMessage(`WebSocket error: ${error}`);
  };
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
      await logMessage('PING sent');
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
  console.log('Received SIGINT. Stopping pinging...');
  logMessage('Received SIGINT. Stopping pinging...');
  stopPinging();
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
  await logMessage(`Potential points: ${potentialPoints}, Countdown: ${countdown}`);
}

async function getUserId() {
  // Menampilkan header menggunakan curl
  exec("curl -s https://raw.githubusercontent.com/Wawanahayy/JawaPride-all.sh/refs/heads/main/display.sh | bash", (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing display.sh: ${error.message}`);
      logMessage(`Error executing display.sh: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Error: ${stderr}`);
      logMessage(`Error: ${stderr}`);
      return;
    }
    console.log(stdout); // Tampilkan output dari display.sh
    logMessage(`Display script output: ${stdout}`);

    const loginUrl = "https://ikknngrgxuxgjhplbpey.supabase.co/auth/v1/token?grant_type=password";
    const authorization = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlra25uZ3JneHV4Z2pocGxicGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU0MzgxNTAsImV4cCI6MjA0MTAxNDE1MH0.DRAvf8nH1ojnJBc3rD_Nw6t1AV8X_g6gmY_HByG2Mag";
    const apikey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlra25uZ3JneHV4Z2pocGxicGV5Iiwicm9zZSI6ImFub24iLCJpYXQiOjE3MjU0MzgxNTAsImV4cCI6MjA0MTAxNDE1MH0.DRAvf8nH1ojnJBc3rD_Nw6t1AV8X_g6gmY_HByG2Mag";

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
          await logMessage(`User ID: ${userId}`);

          const profileUrl = `https://ikknngrgxuxgjhplbpey.supabase.co/rest/v1/profiles?select=personal_code&id=eq.${userId}`;
          const profileResponse = await axios.get(profileUrl, {
            headers: {
              'Authorization': authorization,
              'apikey': apikey
            }
          });

          const personalCode = profileResponse.data[0].personal_code;
          console.log('Personal Code:', personalCode);
          await logMessage(`Personal Code: ${personalCode}`);

          await connectWebSocket(personalCode);

        } catch (error) {
          console.error('Error logging in:', error);
          await logMessage(`Error logging in: ${error}`);
        } finally {
          rl.close();
        }
      });
    });
  });
}

// Memulai proses
getUserId();
