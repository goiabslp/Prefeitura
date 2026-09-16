import http from 'http';

const ports = [5173, 5174, 5175, 3000];

async function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/services/diariasEventosService.ts`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ port, status: res.statusCode, data });
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function run() {
  for (const p of ports) {
    const res = await checkPort(p);
    if (res && res.status === 200) {
      console.log(`Vite está respondendo na porta ${p}!`);
      console.log("Trecho de DIARIA_EVENTO_COLUMNS retornado pelo Vite:");
      const lines = res.data.split('\n');
      lines.forEach(l => {
        if (l.includes('DIARIA_EVENTO_COLUMNS') || l.includes('ultimo_checkpoint')) {
          console.log(" ->", l.trim());
        }
      });

      // Checar também licitacaoService.ts
      const licRes = await new Promise(r => {
        http.get(`http://localhost:${p}/services/licitacaoService.ts`, (res2) => {
          let d = '';
          res2.on('data', c => d += c);
          res2.on('end', () => r(d));
        });
      });
      console.log("Trecho de LICITACAO_COLUMNS retornado pelo Vite:");
      licRes.split('\n').forEach(l => {
        if (l.includes('LICITACAO_COLUMNS') || l.includes('solicitante_id')) {
          console.log(" ->", l.trim());
        }
      });
      return;
    }
  }
  console.log("Nenhuma das portas testadas respondeu.");
}

run();
