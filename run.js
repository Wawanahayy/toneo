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

// Array warna
const colors = [chalk.red, chalk.green, chalk.yellow, chalk.blue, chalk.magenta, chalk.cyan];
let colorIndex = 0; // Indeks warna untuk digunakan

function getNextColor() {
  const color = colors[colorIndex];
  colorIndex = (colorIndex + 1) % colors.length; // Ganti indeks warna
  return color;
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
    console.log(chalk.yellow('Pesan diterima:'), data.toString());
  });

  socket.on('error', (error) => {
    console.error(chalk.red('WebSocket error:'), error);
  });

  socket.on('close', (code, reason) => {
    console.log(chalk.red('WebSocket ditutup:'), code, reason);
  });

  return socket;
}

function mulaiPembaruanPoin(socket, poinAwal) {
  let poin = {
    total_poin: poinAwal.total_poin || 0,
    poin_hari_ini: 0 // Mulai dari 0 setiap hari
  };

  setInterval(() => {
    // Menghitung poin baru hari ini
    const poinBaruHariIni = Math.floor(Math.random() * 5); // Simulasi tambahan poin
    poin.poin_hari_ini += poinBaruHariIni; // Tambahkan poin baru ke hari ini
    poin.total_poin += poinBaruHariIni; // Tambahkan poin baru ke total poin

    // Ambil warna berikutnya
    const color = getNextColor();

    console.log(color(`POINT UPDATE | TOTAL POINT DAILY: ${poin.poin_hari_ini} | POINT UPDATE: ${poinBaruHariIni} | ALL POINT: ${poin.total_poin}`));

    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "UPDATE_POINTS",
        pointsTotal: poin.total_poin,
        pointsToday: poin.poin_hari_ini
      }));
    }
  }, 60000);
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
    console.log(chalk.green('Token Akses:'), session.access_token);
    console.log(chalk.green('Token Penyegaran:'), session.refresh_token);

    supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token
    });

    const poinPengguna = await ambilPoinPengguna(data.user.id);
    const socket = buatKoneksiWebSocket(data.user.id, session.access_token);
    mulaiPembaruanPoin(socket, poinPengguna);
    
    // Bagian untuk refresh session
    setInterval(async () => {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.error(chalk.red('Error memperbarui sesi:'), refreshError);
      } else {
        console.log(chalk.green('Sesi diperbarui. Token akses baru:'), refreshData.session.access_token);
        supabase.auth.setSession(refreshData.session);
      }
    }, 3000000);

  } catch (error) {
    console.error(chalk.red('Kesalahan:'), error.message);
  }
}

jalankanProgram();
