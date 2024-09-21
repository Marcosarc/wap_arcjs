const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Hola Mundo! Esta es una prueba de despliegue en Vercel con Node.js 20.x');
});

app.get('/status', (req, res) => {
    res.json({ 
        status: 'ok',
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage()
    });
});

app.get('/info', async (req, res) => {
    const info = {
        platform: process.platform,
        arch: process.arch,
        version: process.version,
        uptime: process.uptime(),
        cpuUsage: process.cpuUsage(),
        resourceUsage: process.resourceUsage()
    };
    res.json(info);
});

module.exports = app;

// Solo si no estás usando vercel.json para definir la función
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Servidor de prueba corriendo en http://localhost:${port}`);
    });
}