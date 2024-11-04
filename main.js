const WebSocket = require('ws');
const { promisify } = require('util');
const fs = require('fs');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent'); // Ubah ini

let socket = null;
let startTime;

const readFileAsync = promisify(fs.readFile);

async function readJSONFile(filePath) {
  try {
    const data = await readFileAsync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

async function connectWebSocket(userId, proxy) {
  if (socket) return;
  const version = "v0.2";
  const url = "wss://secure.ws.teneo.pro"; // URL WebSocket
  const wsUrl = `${url}/websocket?userId=${encodeURIComponent(userId)}&version=${encodeURIComponent(version)}`;

  // Mengatur proxy di WebSocket
  const agent = proxy ? new HttpsProxyAgent(proxy) : undefined;

  const wsOptions = {
    agent
  };

  socket = new WebSocket(wsUrl, wsOptions);

  startTime = new Date();

  socket.onopen = () => {
    console.log("WebSocket connected");
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log(`Received message:`, data);
  };

  socket.onclose = () => {
    socket = null;
    console.log("WebSocket disconnected");
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };
}

async function getUserId(account, index) {
  const loginUrl = "https://ikknngrgxuxgjhplbpey.supabase.co/auth/v1/token?grant_type=password";
  const authorization = "Bearer YOUR_AUTHORIZATION_TOKEN"; // Ganti dengan token otorisasi yang sesuai
  const apikey = "YOUR_API_KEY"; // Ganti dengan API key yang sesuai

  const email = account.email;
  const password = account.password;

  return new Promise(async (resolve) => {
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
        console.log(`User ID for account ${index + 1}: ${response.data.user.id}`);
        resolve(response.data.user.id);
      } else {
        console.error(`User not found for account ${index + 1}.`);
        resolve(null);
      }
    } catch (error) {
      console.error(`Error during login for account ${index + 1}:`, error.response ? error.response.data : error.message);
      resolve(null);
    }
  });
}

async function main() {
  const accounts = await readJSONFile('akun.json');
  const proxies = await readJSONFile('proxy.json');

  if (!accounts || !proxies || accounts.length !== proxies.length) {
    console.error("Error: accounts and proxies must be present and have the same length.");
    return;
  }

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const proxy = proxies[i];
    const userId = await getUserId(account, i);
    if (userId) {
      await connectWebSocket(userId, proxy);
    } else {
      console.error(`Failed to retrieve user ID for account ${i + 1}.`);
    }
  }
}

main().catch(console.error);
