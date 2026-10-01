// Servidor mínimo en Express con endpoints de saludo y de salud.
const express = require('express');
const path = require('path');
const { Worker } = require('worker_threads');

const app = express();
// Puerto configurable por variable de entorno (por defecto 3000)
const PORT = process.env.PORT || 3000;

// Endpoint raíz: hello world
app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

// Endpoint de salud
app.get('/health', (req, res) => {
  res.json({ status: 'ok', active: true });
});



// --------------------------------------------------------------------------------
// 1) RUTA RÁPIDA
// El Event Loop recibe la petición, responde y queda libre al instante.
// Úsala como "termómetro": si esta ruta tarda, el Event Loop está bloqueada.
// --------------------------------------------------------------------------------
app.get('/fast', (req, res) => {
  res.json({ status: 'ok', message: 'Respuesta rápida (Event Loop libre)'})
});

// --------------------------------------------------------------------------------
// 2) I/O LENTO (simula una base de datos lenta)
// setTimeout delega la espera al sistema (Libuv) y el Event Loop sigue libreria
// Mientras esperamos 4 sea. Ifast responde sin problemal
// --------------------------------------------------------------------------------
app.get('/slow-io', (req, res) => {
  setTimeout(() => {
    // El callback vuelve a la cola cuando pasa el tiempo; el Event Loop lo ejecuta
    res.json({ message: 'I/O resuelto después de 4 seg' });
  }, 4000);
});

// --------------------------------------------------------------------------------
// 3) X CPU PESADA EN EL HILO PRINCIPAL (INTENCIONALMENTE MALO)
// El bucle es sincrono: el Event Loop NO puede atender nada más hasta que termine.
// Durante ese tiempo Ifast. Islow-lo y cualauer otra petición quedan congelados
// --------------------------------------------------------------------------------
app.get('/heavy-cpu-block', (req, res) => {
  console.time("heavy-cpu-block");
  for (let i=0; i<50000000000000000; i++) {}
  console.timeEnd("heavy-cpu-block");
  res.json({ message: 'CPU terminada. El Event loop estuvo secuestrado.' });
});

// --------------------------------------------------------------------------------
// 4) CPU PESADA EN UN WORKER THREAD (LA FORMA CORRECTA)
// La misma carga de CPU que /heavy-cpu-block, pero delegada a un hilo aparte.
// El Event Loop del hilo principal queda LIBRE: /fast sigue respondiendo al
// instante mientras el worker calcula. Al terminar, el worker avisa y respondemos.
// --------------------------------------------------------------------------------
app.get('/heavy-cpu-worker', (req, res) => {
  console.time('heavy-cpu-worker (main)');

  // Crear el worker que corre el bucle intensivo en otro hilo
  const worker = new Worker(path.join(__dirname, 'heavy-cpu-worker.js'));

  // Cuando el worker termina, envía el resultado y respondemos la petición
  worker.on('message', (result) => {
    console.timeEnd('heavy-cpu-worker (main)');
    res.json(result);
  });

  // Manejo de error del worker
  worker.on('error', (err) => {
    res.status(500).json({ error: err.message });
  });

  // Aviso si el worker termina con un código distinto de 0
  worker.on('exit', (code) => {
    if (code !== 0) {
      console.error(`Worker finalizó con código de salida ${code}`);
    }
  });
});

// Iniciar el servidor (al final, después de registrar TODAS las rutas)
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});