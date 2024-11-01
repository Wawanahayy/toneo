const WebSocket = require('ws');
const { promisify } = require('util');
const fs = require('fs');
const readline = require('readline');
const axios = require('axios');
const { exec } = require('child_process');

let socket = null;
let pingInterval;
let countdownInterval;
let displayInterval; // Untuk jam berjalan
let potentialPoints = 0;
let countdown = "Calculating...";
let pointsTotal = 0;
let pointsToday = 0;

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

// Fungsi untuk mendapatkan timestamp dalam format JAM: HH:mm:ss GMT+7
function getCurrentTimestampGMT7() {
  const options = {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };
  
  const timeParts = new Intl.DateTimeFormat('en-US', options).formatToParts(new Date());
  const timestamp = `${timeParts[0].value}:${timeParts[2].value}:${timeParts[4].value}`;
  return `JAM: ${timestamp}`;
}

// Log function
async function logMessage(message) {
  const timestamp = getCurrentTimestampGMT7();
  const logEntry = `${timestamp} - ${message}\n`;
  await fs.promises.appendFile('logs.txt', logEntry);
}

// Fungsi untuk memperbarui jam di konsol
function startDisplayClock() {
  displayInterval = setInterval(() => {
    const currentTime = getCurrentTimestampGMT7();
    process.stdout.write(`\r${currentTime} `); // Menampilkan jam di baris yang sama
  }, 1000);
}

function stopDisplayClock() {
  clearInterval(displayInterval);
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
    startDisplayClock(); // Mulai menampilkan jam berjalan
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
    stopDisplayClock(); // Hentikan jam berjalan
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
    stopDisplayClock(); // Hentikan jam berjalan
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
  stopDisplayClock(); // Hentikan jam berjalan
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

      if (Math.random() < 0.1) { // 10% chance for bonus points
        const bonus = Math.random() * 2; // Random bonus between 0 and 2
        newPoints = Math.min(maxPoints, newPoints + bonus);
        newPoints = parseFloat(newPoints.toFixed(2));
      }

      potentialPoints = newPoints;
    } else {
      countdown = "Calculating...";
      potentialPoints = 25; // Reset potential points after 15 minutes
    }
  } else {
    countdown = "Calculating...";
    potentialPoints = 0;
  }

  await setLocalStorage({ potentialPoints, countdown });
  await logMessage(`Potential points: ${potentialPoints}, Countdown: ${countdown}`);
}

async function getUserId() {
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
    console.log(stdout);
    logMessage(`Display script output: ${stdout}`);

    const loginUrl = "https://ikknngrgxuxgjhplbpey.supabase.co/auth/v1/token?grant_type=password";
    const authorization = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlra25uZ3JneHV4Z2pocGxicGV5LnN1cGFibGUuY29yZSIsImlhdCI6MTY5MjM4NTE2MywiZXhwIjoxOTQ3NTQ1MTYzfQ.m0uHuyjGH_w27fyB_q9xV1SyHMIeRCPwX9ZhZc-AN0I";
    const apikey = "YOUR_API_KEY"; // Ganti dengan API key yang valid

    rl.question('Masukkan User ID: ', async (userId) => {
      try {
        const profileUrl = `https://ikknngrgxuxgjhplbpey.supabase.co/rest/v1/profiles?user_id=eq.${userId}`;
        const profileResponse = await axios.get(profileUrl, {
          headers: {
            'Authorization': authorization,
            'apikey': apikey
          }
        });

        const personalCode = profileResponse.data[0].personal_code;
        console.log('Personal Code:', personalCode);
        await logMessage(`Personal Code: ${personalCode}`);

        await connectWebSocket(userId);
      } catch (error) {
        console.error('Error during login:', error);
        await logMessage(`Error during login: ${error}`);
      }
    });
  });
}

getUserId();
