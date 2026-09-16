import http from 'http';

const checkPort = (port) => new Promise(resolve => {
  const req = http.get(`http://localhost:${port}`, (res) => {
    resolve({ port, status: res.statusCode });
  });
  req.on('error', () => resolve(null));
  req.setTimeout(500, () => { req.destroy(); resolve(null); });
});

async function findVite() {
  const candidates = [3000, 3001, 5173, 5174, 5175, 8080, 4173];
  for (const p of candidates) {
    const res = await checkPort(p);
    if (res) console.log(`Porta ${p} está ATIVA (status ${res.status})`);
  }
}

findVite();
