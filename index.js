const express = require('express');
const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode');

const app = express();
const port = process.env.PORT || 3000;

let client;
let qrCodeData = null;
let isClientReady = false;
let qrGenerationTimeout;

function initializeWhatsAppClient() {
    client = new Client({
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    client.on('qr', async (qr) => {
        console.log('Nuevo código QR recibido');
        qrCodeData = await qrcode.toDataURL(qr);
        clearTimeout(qrGenerationTimeout);
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

    // Establecer un tiempo máximo para la generación del QR
    qrGenerationTimeout = setTimeout(() => {
        if (!qrCodeData) {
            qrCodeData = 'timeout';
        }
    }, 30000); // 30 segundos de tiempo de espera
}

app.get('/', (req, res) => {
    res.send(`
        <html>
            <body>
                <h1>Estado de WhatsApp</h1>
                <div id="status"></div>
                <div id="qr-code"></div>
                <script>
                    function checkStatus() {
                        fetch('/status')
                            .then(response => response.json())
                            .then(data => {
                                const statusDiv = document.getElementById('status');
                                const qrCodeDiv = document.getElementById('qr-code');
                                
                                if (data.ready) {
                                    statusDiv.innerHTML = '<h2>WhatsApp está listo para recibir mensajes</h2>';
                                    qrCodeDiv.innerHTML = '';
                                } else if (data.qrCode) {
                                    if (data.qrCode === 'timeout') {
                                        statusDiv.innerHTML = '<h2>Tiempo de espera agotado para generar el QR. Por favor, recarga la página.</h2>';
                                    } else {
                                        statusDiv.innerHTML = '<h2>Escanea el código QR con tu WhatsApp para iniciar sesión</h2>';
                                        qrCodeDiv.innerHTML = '<img src="' + data.qrCode + '" alt="QR Code" />';
                                    }
                                } else {
                                    statusDiv.innerHTML = '<h2>Inicializando cliente de WhatsApp...</h2>';
                                    setTimeout(checkStatus, 1000);
                                }
                            });
                    }
                    checkStatus();
                </script>
            </body>
        </html>
    `);
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

// Inicializar el cliente de WhatsApp al iniciar la aplicación
initializeWhatsAppClient();

app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});