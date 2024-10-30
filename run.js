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

function blinkLog(message, duration = 2000, interval = 200) {
  const endTime = Date.now() + duration;
  const blinkInterval = setInterval(() => {
    console.log(getNextColor()(message));
    if (Date.now() >= endTime) clearInterval(blinkInterval);
  }, interval);
}

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
    }, 18000); // Coba sambung kembali 
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

    // Cek status WebSocket 
    setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        blinkLog('Status WebSocket: Masih terhubung');
      } else {
        blinkLog('Status WebSocket: Tidak terhubung');
      }
    }, 120000); // 10000 ms = 10 detik

  } catch (error) {
    blinkLog(`Kesalahan: ${error.message}`);
  }
}

jalankanProgram();
