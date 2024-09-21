const express = require('express');
const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode');

const app = express();
const port = 3000;

let client;
let qrCodeData = null;
let isClientReady = false;
let isInitializing = false;

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.send(`
        <html>
            <body>
                <h1>WhatsApp Web Authentication</h1>
                <div id="status"></div>
                <div id="qr-container"></div>
                <button id="init-button" onclick="initializeWhatsApp()">Iniciar WhatsApp</button>
                <script>
                    function initializeWhatsApp() {
                        fetch('/initialize')
                            .then(response => response.json())
                            .then(data => {
                                document.getElementById('status').innerHTML = data.message;
                                checkStatus();
                            });
                    }

                    function checkStatus() {
                        fetch('/status')
                            .then(response => response.json())
                            .then(data => {
                                if (data.ready) {
                                    document.getElementById('status').innerHTML = '<h2>WhatsApp está listo para recibir mensajes</h2>';
                                    document.getElementById('qr-container').innerHTML = '';
                                    document.getElementById('init-button').style.display = 'none';
                                } else if (data.qrCode) {
                                    document.getElementById('status').innerHTML = '<h2>Escanea el código QR con tu WhatsApp para iniciar sesión</h2>';
                                    document.getElementById('qr-container').innerHTML = '<img src="' + data.qrCode + '" alt="QR Code" />';
                                } else {
                                    document.getElementById('status').innerHTML = '<h2>Inicializando cliente de WhatsApp...</h2>';
                                    setTimeout(checkStatus, 1000);
                                }
                            });
                    }
                </script>
            </body>
        </html>
    `);
});

app.get('/initialize', (req, res) => {
    if (isInitializing || isClientReady) {
        res.json({ message: 'WhatsApp ya está inicializado o inicializando.' });
        return;
    }

    isInitializing = true;
    client = new Client({
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    client.on('qr', async (qr) => {
        console.log('Nuevo código QR recibido');
        qrCodeData = await qrcode.toDataURL(qr);
    });

    client.on('ready', () => {
        console.log('Cliente de WhatsApp está listo!');
        isClientReady = true;
        qrCodeData = null;
    });

    client.on('message_create', message => {
        console.log(message.body);
        if (message.body === '!ping') {
            message.reply('pong');
        }
    });

    client.initialize();

    res.json({ message: 'Inicializando cliente de WhatsApp...' });
});

app.get('/status', (req, res) => {
    res.json({ ready: isClientReady, qrCode: qrCodeData });
});

app.get('/send-message', async (req, res) => {
    const { phone, message } = req.query;

    if (!phone || !message) {
        return res.status(400).json({ error: 'Se requieren los parámetros phone y message' });
    }

    if (!isClientReady) {
        return res.status(503).json({ error: 'El cliente de WhatsApp aún no está listo. Por favor, espera.' });
    }

    try {
        const chatId = `${phone}@c.us`;
        const response = await client.sendMessage(chatId, message);
        console.log('Mensaje enviado:', response);
        res.json({ success: true, message: 'Mensaje enviado con éxito' });
    } catch (err) {
        console.error('Error al enviar mensaje:', err);
        res.status(500).json({ error: 'Error al enviar el mensaje' });
    }
});

app.listen(port, () => {
    console.log(`Servidor API corriendo en http://localhost:${port}`);
});