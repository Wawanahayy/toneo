const axios = require('axios');
const chalk = require('chalk');
const WebSocket = require('ws');
const { HttpsProxyAgent } = require('https-proxy-agent');
const fs = require('fs');
const readline = require('readline');
const keypress = require('keypress');
const delay = require('delay');

let sockets = [];
let pingIntervals = [];
let countdownIntervals = [];
let countdowns = [];
let pointsTotals = [];
let pointsToday = [];
let lastUpdateds = [];
let messages = [];
let userIds = [];
let browserIds = [];
let proxies = [];
let accessTokens = [];
let accounts = [];
let useProxy = false;
let enableAutoRetry = false;

function loadAccounts() {
  if (!fs.existsSync('account.txt')) {
    console.error('account.txt tidak ditemukan. Harap tambahkan file dengan data akun.');
    process.exit(1);
  }

  try {
    const data = fs.readFileSync('account.txt', 'utf8');
    accounts = data.split('\n').map(line => {
      const [email, password] = line.split(',');
      if (email && password) {
        return { email: email.trim(), password: password.trim() };
      }
      return null;
    }).filter(account => account !== null);
  } catch (err) {
    console.error('Gagal memuat akun:', err);
  }
}

function loadProxies() {
  if (!fs.existsSync('proxy.txt')) {
    console.error('proxy.txt tidak ditemukan. Harap tambahkan file dengan data proxy.');
    process.exit(1);
  }

  try {
    const data = fs.readFileSync('proxy.txt', 'utf8');
    proxies = data.split('\n').map(line => line.trim()).filter(line => line);
  } catch (err) {
    console.error('Gagal memuat proxy:', err);
  }
}

function normalizeProxyUrl(proxy) {
  if (!proxy.startsWith('http://') && !proxy.startsWith('https://')) {
    proxy = 'http://' + proxy;
  }
  return proxy;
}

async function initialize() {
  loadAccounts();
  loadProxies();
  for (let i = 0; i < accounts.length; i++) {
    countdowns[i] = null;
    pointsTotals[i] = 0;
    pointsToday[i] = 0;
    lastUpdateds[i] = null;
    messages[i] = '';
    userIds[i] = null;
    browserIds[i] = null;
    accessTokens[i] = null;
    getUserId(i);
  }

  // Mulai proses semua akun secara otomatis
  for (let i = 0; i < accounts.length; i++) {
    setTimeout(() => {
      getUserId(i); // Mengambil userId dan mulai koneksi WebSocket
    }, i * 1000); // Interval 1 detik untuk tiap akun
  }

  // Menampilkan log semua akun
  setInterval(() => {
    displayAllAccounts();
  }, 5000); // Update tampilan setiap 5 detik
}

function generateBrowserId(index) {
  return `browserId-${index}-${Math.random().toString(36).substring(2, 15)}`;
}

const { execSync } = require('child_process');

function displayHeader() {
    const width = process.stdout.columns;
    const headerLines = [
        chalk.bgCyan.black('============================================================'),
        chalk.bgGreen.black('=======================  J.W.P.A  =========================='),
        chalk.bgMagenta.white('================= @AirdropJP_JawaPride ====================='),
        chalk.bgYellow.black('=============== https://x.com/JAWAPRIDE_ID ================='),
        chalk.bgRed.white('============= https://linktr.ee/Jawa_Pride_ID =============='), 
        chalk.bgBlue.black('============================================================')
    ];

  console.log("");
  headerLines.forEach(line => {
    const padding = Math.max(0, Math.floor((width - line.length) / 1));
    console.log(chalk.green(' '.repeat(padding) + line));
  });
  console.log("");
}

function formatTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

function formatCountdown(countdown) {
    const minutes = Math.floor(countdown / 60);
    const seconds = countdown % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatDate() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `${day}/${month}/${year}`;
}

function displayAllAccounts() {
  console.clear();
  displayHeader();

  const width = process.stdout.columns;
  const separatorLine = '_'.repeat(width);
  console.log(chalk.cyan(separatorLine));

  console.log(
    chalk.cyan(
        'EMAIL'.padEnd(30, ' ') + 
        'BROWSER ID'.padEnd(25, ' ') + 
        'TOTAL POINT'.padEnd(15, ' ') + 
        'POINT TODAY'.padEnd(14, ' ') + 
        'PESAN'.padEnd(18, ' ') + 
        'PROXY'.padEnd(8, ' ') + 
        'TIME RUN'.padEnd(15, ' ') + 
        'DATE'.padEnd(12, ' ') 
    )
);
console.log(chalk.cyan(separatorLine));

for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const formattedEmail = chalk.red(account.email.padEnd(30, ' '));
    const formattedBrowserId = browserIds[i].padEnd(25, ' ');
    const formattedPointsTotal = pointsTotals[i].toString().padEnd(12, ' ');
    const formattedPointsToday = pointsToday[i].toString().padEnd(14, ' ');
    const formattedMessage = (sockets[i] && sockets[i].readyState === WebSocket.OPEN) 
        ? 'YES'.padEnd(18, ' ')  // Tampilkan YES jika terkoneksi
        : 'NO'.padEnd(18, ' ');  // Tampilkan NO jika tidak terkoneksi
        const formattedProxy = (useProxy && proxies[i % proxies.length] ? proxies[i % proxies.length] : 'NO').padEnd(5, ' ');
        const formattedTime = chalk.green(formatTime().padEnd(13, ' '));
        const formattedDate = chalk.yellow(formatDate().padEnd(13, ' '));
        

    console.log(chalk.white(`${formattedEmail} ${formattedBrowserId} ${formattedPointsTotal} ${formattedPointsToday} ${formattedMessage} ${formattedProxy} ${formattedTime} ${formattedDate}`));
}

  console.log(chalk.cyan(separatorLine));
}


async function connectWebSocket(index) {
  if (sockets[index]) return;
  const version = "v0.2";
  const url = "wss://secure.ws.teneo.pro";
  const wsUrl = `${url}/websocket?accessToken=${encodeURIComponent(accessTokens[index])}&version=${encodeURIComponent(version)}`;

  const proxy = proxies[index % proxies.length];
  const agent = useProxy && proxy ? new HttpsProxyAgent(normalizeProxyUrl(proxy)) : null;

  sockets[index] = new WebSocket(wsUrl, { agent });

  sockets[index].onopen = async () => {
    lastUpdateds[index] = new Date().toISOString();
    console.log(`Akun ${index + 1} Terhubung, ${lastUpdateds[index]}`);
    startPinging(index);
    startCountdownAndPoints(index);
  };

  sockets[index].onmessage = async (event) => {
    const data = JSON.parse(event.data);
    if (data.pointsTotal !== undefined && data.pointsToday !== undefined) {
      lastUpdateds[index] = new Date().toISOString();
      pointsTotals[index] = data.pointsTotal;
      pointsToday[index] = data.pointsToday;
      messages[index] = data.message;
    }

    if (data.message === "Pulse from server") {
      console.log(`Pulse dari server diterima untuk Akun ${index + 1}. Mulai ping...`);
      setTimeout(() => {
        startPinging(index);
      }, 10000);
    }
  };

  sockets[index].onclose = () => {
    console.log(`Akun ${index + 1} Terputus`);
    reconnectWebSocket(index);
  };

  sockets[index].onerror = (error) => {
    console.error(`Kesalahan WebSocket untuk Akun ${index + 1}:`, error);
  };
}

async function reconnectWebSocket(index) {
  const version = "v0.2";
  const url = "wss://secure.ws.teneo.pro";
  const wsUrl = `${url}/websocket?accessToken=${encodeURIComponent(accessTokens[index])}&version=${encodeURIComponent(version)}`;

  const proxy = proxies[index % proxies.length];
  const agent = useProxy && proxy ? new HttpsProxyAgent(normalizeProxyUrl(proxy)) : null;

  setTimeout(() => {
    sockets[index] = new WebSocket(wsUrl, { agent });
    sockets[index].onopen = () => {
      console.log(`Akun ${index + 1} Terhubung Lagi`);
      startPinging(index);
    };
  }, 5000);
}

async function startPinging(index) {
  if (pingIntervals[index]) clearInterval(pingIntervals[index]);

  const delayTime = Math.floor(Math.random() * 4000) + 1000; // Delay antara 1-4 detik
  pingIntervals[index] = setInterval(() => {
    if (sockets[index] && sockets[index].readyState === WebSocket.OPEN) {
      sockets[index].send(JSON.stringify({ action: 'ping' }));
      if (countdowns[index] === null) {
        countdowns[index] = 900; // Mulai hitung mundur dari 15 detik saat ping pertama
      }
    }
  }, delayTime);
}

async function startCountdownAndPoints(index) {
  if (countdownIntervals[index]) clearInterval(countdownIntervals[index]);

  countdownIntervals[index] = setInterval(() => {
    if (countdowns[index] > 0) {
      countdowns[index]--;
    }
  }, 1000);
}

async function getUserId(index) {
  const loginUrl = "https://auth.teneo.pro/api/login";

  const proxy = proxies[index % proxies.length];
  const agent = useProxy && proxy ? new HttpsProxyAgent(normalizeProxyUrl(proxy)) : null;

  try {
    const response = await axios.post(loginUrl, {
      email: accounts[index].email,
      password: accounts[index].password
    }, {
      httpsAgent: agent,
      headers: {
        'Authorization': `Bearer ${accessTokens[index]}`,
        'Content-Type': 'application/json',
        'authority': 'auth.teneo.pro',
        'x-api-key': 'OwAG3kib1ivOJG4Y0OCZ8lJETa6ypvsDtGmdhcjA'
      }
    });

    const { user, access_token } = response.data;
    userIds[index] = user.id;
    accessTokens[index] = access_token;
    browserIds[index] = generateBrowserId(index);
    connectWebSocket(index);
  } catch (error) {
    console.error(`Gagal login untuk akun ${index + 1}: ${error}`);
  }
}

initialize();
