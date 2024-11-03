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
let countdown = "Calculating...";
let pointsTotal = 0;
let pointsToday = 0;
let startTime; // Untuk menyimpan waktu mulai

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Fungsi untuk membaca akun dari file
async function getAccounts() {
  try {
    const data = await readFileAsync('accounts.json', 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// Fungsi untuk menambahkan akun ke file
async function addAccount(email, password) {
  const accounts = await getAccounts();
  accounts.push({ email, password });
  await writeFileAsync('accounts.json', JSON.stringify(accounts, null, 2));
}

// Fungsi untuk mendapatkan proxy dari file
async function getProxies() {
  try {
    const data = await readFileAsync('proxies.json', 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// Fungsi untuk menambahkan proxy ke file
async function addProxy(proxy) {
  const proxies = await getProxies();
  proxies.push(proxy);
  await writeFileAsync('proxies.json', JSON.stringify(proxies, null, 2));
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

  startTime = new Date(); // Menyimpan waktu mulai saat koneksi WebSocket

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

// ... (bagian kode lainnya tidak berubah)

async function main() {
  rl.question('Do you want to add an account? (yes/no): ', async (answer) => {
    if (answer.toLowerCase() === 'yes') {
      rl.question('Email: ', (email) => {
        rl.question('Password: ', async (password) => {
          await addAccount(email, password);
          console.log('Account added!');
          rl.close();
          const accounts = await getAccounts();
          console.log('Current accounts:', accounts);
        });
      });
    } else {
      rl.question('Do you want to add a proxy? (yes/no): ', async (answer) => {
        if (answer.toLowerCase() === 'yes') {
          rl.question('Proxy: ', async (proxy) => {
            await addProxy(proxy);
            console.log('Proxy added!');
            rl.close();
            const proxies = await getProxies();
            console.log('Current proxies:', proxies);
          });
        } else {
          const userId = await getUserId();
          if (userId) {
            await connectWebSocket(userId);
          } else {
            console.error("Failed to retrieve user ID.");
          }
        }
      });
    }
  });
}

main().catch(console.error);
