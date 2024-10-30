require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
const { exec } = require('child_process');
const chalk = require('chalk');

exec("curl -s https://raw.githubusercontent.com/Wawanahayy/JawaPride-all.sh/refs/heads/main/display.sh | bash", (error, stdout, stderr) => {
  if (error) {
    console.error(chalk.red(`Kesalahan saat menjalankan display.sh: ${error.message}`));
    return;
  }
  if (stderr) {
    console.error(chalk.red(`Kesalahan: ${stderr}`));
    return;
  }
  console.log(stdout);
});

const colors = [chalk.redBright, chalk.greenBright, chalk.yellowBright, chalk.blueBright, chalk.magentaBright, chalk.cyanBright];
let colorIndex = 0;

function getNextColor() {
  const color = colors[colorIndex];
  colorIndex = (colorIndex + 1) % colors.length;
  return color;
}

function blinkLog(message) {
  let count = 0;
  const interval = setInterval(() => {
    console.log(getNextColor()(message));
    count += 1;
    if (count >= 10) clearInterval(interval); // Menghentikan kedipan setelah 10 kali
  }, 200);
}

console.log(getNextColor()('SUPABASE_URL:'), getNextColor()(process.env.SUPABASE_URL));
console.log(getNextColor()('SUPABASE_KEY (10 karakter pertama):'), getNextColor()(process.env.SUPABASE_KEY.substring(0, 10)));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

let totalPoints = 0;
let pointsToday = 0;

async function ambilPoinPengguna(userId) {
  try {
    const { data, error } = await supabase
      .from('user_points')
      .select('total_poin, poin_UPDATE')
      .eq('id_pengguna', userId)
      .single();

    if (error) throw error;

    return data || { total_poin: 0, poin_hari_ini: 0 };
  } catch (error) {
    blinkLog(`Gagal mengambil poin pengguna: ${error.message}`);
    return { total_poin: 0, poin_hari_ini: 0 };
  }
}

function buatKoneksiWebSocket(userId, tokenAkses) {
  const wsUrl = `wss://secure.ws.teneo.pro/websocket?userId=${encodeURIComponent(userId)}&version=v0.2`;
  const socket = new WebSocket(wsUrl, {
    headers: { Authorization: `Bearer ${tokenAkses}` }
  });

  socket.on('open', () => {
    blinkLog('WebSocket terhubung');
    socket.send(JSON.stringify({ type: "KONEKSI" }));
  });

  socket.on('message', (data) => {
    const parsedData = JSON.parse(data.toString());
    if (parsedData.pointsTotal !== undefined) {
      totalPoints = parsedData.pointsTotal;
      pointsToday = parsedData.pointsToday;
      blinkLog(`Diterima pembaruan poin: ${pointsToday} | Total poin: ${totalPoints}`);
    }
  });

  socket.on('error', (error) => {
    blinkLog(`WebSocket error: ${error}`);
  });

  socket.on('close', (code, reason) => {
    blinkLog(`WebSocket ditutup: ${code}, ${reason}`);
    setTimeout(() => {
      blinkLog('Mencoba untuk menyambung kembali...');
      buatKoneksiWebSocket(userId, tokenAkses);
    }, 5000); // Coba sambung kembali setelah 5 detik
  });

  return socket;
}

async function jalankanProgram() {
  try {
    blinkLog('Menggunakan token akses untuk autentikasi...');

    const { data, error } = await supabase.auth.signInWithPassword({
      email: process.env.SUPABASE_USER_EMAIL,
      password: process.env.SUPABASE_USER_PASSWORD,
    });

    if (error) throw error;

    const session = data.session;
    blinkLog('Autentikasi berhasil');
    blinkLog('Token Akses success');

    supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token
    });

    const poinPengguna = await ambilPoinPengguna(data.user.id);
    totalPoints = poinPengguna.total_poin;
    const socket = buatKoneksiWebSocket(data.user.id, session.access_token);

    setInterval(() => {
      const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' });
      blinkLog(`POINT UPDATE | TOTAL POINT DAILY: ${pointsToday} | POINT UPDATE: ${pointsToday} | ALL POINT: ${totalPoints} | JAM: ${timestamp}`);
    }, 300000); // 300000 ms = 5 menit

    setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        blinkLog('WebSocket masih terhubung');
      } else {
        blinkLog('WebSocket tidak terhubung');
      }
    }, 300000); // 300000 ms = 5 menit

    setInterval(async () => {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        blinkLog(`Error memperbarui sesi: ${refreshError.message}`);
      } else {
        blinkLog('Sesi diperbarui. Token akses success');
        supabase.auth.setSession(refreshData.session);
      }
    }, 180000); 

  } catch (error) {
    blinkLog(`Kesalahan: ${error.message}`);
  }
}

jalankanProgram();
