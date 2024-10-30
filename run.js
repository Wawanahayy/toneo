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

console.log(chalk.blue('SUPABASE_URL:'), chalk.green(process.env.SUPABASE_URL));
console.log(chalk.blue('SUPABASE_KEY (10 karakter pertama):'), chalk.green(process.env.SUPABASE_KEY.substring(0, 10)));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const colors = [chalk.red, chalk.green, chalk.yellow, chalk.blue, chalk.magenta, chalk.cyan];
let colorIndex = 0;

function getNextColor() {
  const color = colors[colorIndex];
  colorIndex = (colorIndex + 1) % colors.length;
  return color;
}

let totalPoints = 0;
let pointsToday = 0;

function getCurrentTimestamp() {
  return new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' });
}

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
    console.error(chalk.red('Gagal mengambil poin pengguna:'), error.message);
    return { total_poin: 0, poin_hari_ini: 0 };
  }
}

function buatKoneksiWebSocket(userId, tokenAkses) {
  const wsUrl = `wss://secure.ws.teneo.pro/websocket?userId=${encodeURIComponent(userId)}&version=v0.2`;
  const socket = new WebSocket(wsUrl, {
    headers: { Authorization: `Bearer ${tokenAkses}` }
  });

  socket.on('open', () => {
    console.log(chalk.green('WebSocket terhubung'));
    socket.send(JSON.stringify({ type: "KONEKSI" }));
  });

  socket.on('message', (data) => {
    const parsedData = JSON.parse(data.toString());
    if (parsedData.pointsTotal !== undefined) {
      totalPoints = parsedData.pointsTotal;
      pointsToday = parsedData.pointsToday;
      console.log(getNextColor()(`Diterima pembaruan poin: ${pointsToday} | Total poin: ${totalPoints}`));
    }
  });

  socket.on('error', (error) => {
    console.error(chalk.red('WebSocket error:'), error);
  });

  socket.on('close', (code, reason) => {
    console.log(chalk.red('WebSocket ditutup:'), code, reason);
    setTimeout(() => {
      console.log(chalk.yellow('Mencoba untuk menyambung kembali...'));
      buatKoneksiWebSocket(userId, tokenAkses);
    }, 5000); // Coba sambung kembali setelah 5 detik
  });

  return socket;
}

async function jalankanProgram() {
  try {
    console.log(chalk.blue('Menggunakan token akses untuk autentikasi...'));

    const { data, error } = await supabase.auth.signInWithPassword({
      email: process.env.SUPABASE_USER_EMAIL,
      password: process.env.SUPABASE_USER_PASSWORD,
    });

    if (error) throw error;

    const session = data.session;
    console.log(chalk.green('Autentikasi berhasil'));
    console.log(chalk.green('Token Akses sukses'));

    supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token
    });

    const poinPengguna = await ambilPoinPengguna(data.user.id);
    totalPoints = poinPengguna.total_poin;
    const socket = buatKoneksiWebSocket(data.user.id, session.access_token);

    // Print pembaruan poin setiap 5 menit dengan timestamp
    setInterval(() => {
      const timestamp = getCurrentTimestamp();
      console.log(getNextColor()(`POINT UPDATE | TOTAL POINT DAILY: ${pointsToday} | POINT UPDATE: ${pointsToday} | ALL POINT: ${totalPoints} | JAM: ${timestamp}`));
    }, 300000); // 300000 ms = 5 menit

    // Total poin kedip-kedip
    setInterval(() => {
      const timestamp = getCurrentTimestamp();
      console.log(getNextColor()(`TOTAL POINT: ${totalPoints} | JAM: ${timestamp}`));
    }, 1000); // 1000 ms = 1 detik untuk efek kedip-kedip

    // Cek apakah WebSocket terhubung setiap 5 menit
    setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        console.log(chalk.green('WebSocket masih terhubung'));
      } else {
        console.log(chalk.red('WebSocket tidak terhubung'));
      }
    }, 300000); // 300000 ms = 5 menit

    // Refresh session setiap 30 menit
    setInterval(async () => {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.error(chalk.red('Error memperbarui sesi:'), refreshError);
      } else {
        console.log(chalk.green('Sesi diperbarui. Token akses baru:'), refreshData.session.access_token);
        supabase.auth.setSession(refreshData.session);
      }
    }, 180000); // 1800000 ms = 30 menit

  } catch (error) {
    console.error(chalk.red('Kesalahan:'), error.message);
  }
}

jalankanProgram();
