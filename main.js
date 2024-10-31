// Tambahkan fungsi untuk kedip pesan
function kedipKedipPesan(pesan, durasi) {
    const originalConsoleLog = console.log; // Simpan log asli

    const interval = setInterval(() => {
        originalConsoleLog(pesan); // Tampilkan pesan
    }, 500); // Tampilkan pesan setiap 500 ms

    setTimeout(() => {
        clearInterval(interval); // Hentikan kedipan setelah durasi
    }, durasi);
}

// Di dalam socket.onmessage
socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    console.log("Received message from WebSocket:", data);
    
    // Tambahkan log untuk memeriksa kapan data diterima
    console.log("Data received at:", new Date().toISOString());

    if (data.pointsTotal !== undefined && data.pointsToday !== undefined) {
        const lastUpdated = new Date().toISOString();
        await setLocalStorage({
            lastUpdated: lastUpdated,
            pointsTotal: data.pointsTotal,
            pointsToday: data.pointsToday,
        });
        
        pointsTotal = data.pointsTotal;
        pointsToday = data.pointsToday;

        // Tambahkan logging dan kedip pesan
        const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' });
        const pesan = `POINT UPDATE | TOTAL POINT DAILY: ${pointsToday} | TOTAL POINT: ${pointsTotal} | JAM: ${timestamp}`;
        kedipKedipPesan(pesan, 10000); // Berkedip selama 10 detik
    }
};
