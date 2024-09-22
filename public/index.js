const express = require('express');
const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');

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
                <button id="close-button" onclick="closeWhatsApp()" style="display:none;">Cerrar WhatsApp</button>
                <script>
                    function initializeWhatsApp() {
                        fetch('/initialize')
                            .then(response => response.json())
                            .then(data => {
                                document.getElementById('status').innerHTML = data.message;
                                checkStatus();
                            });
                    }

                    function closeWhatsApp() {
                        fetch('/close')
                            .then(response => response.json())
                            .then(data => {
                                document.getElementById('status').innerHTML = data.message;
                                document.getElementById('qr-container').innerHTML = '';
                                document.getElementById('init-button').style.display = 'inline';
                                document.getElementById('close-button').style.display = 'none';
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
                                    document.getElementById('close-button').style.display = 'inline';
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
    console.log('Solicitud de inicialización recibida.');

    if (isInitializing || isClientReady) {
        console.log('Cerrando sesión anterior...');
        closeWhatsAppSession();
    }

    isInitializing = true;
    isClientReady = false;
    qrCodeData = null;

    // Borrar el archivo de sesión si existe
    if (fs.existsSync('./session.json')) {
        fs.unlinkSync('./session.json');
    }

    client = new Client({
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        },
        session: null // Forzar nueva sesión
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
        console.log('Mensaje recibido:', message.body);
        if (message.body === '!ping') {
            message.reply('pong');
        }
    });

    client.on('error', (error) => {
        console.error('Error del cliente:', error);
    });

    client.initialize()
        .then(() => {
            console.log('Cliente de WhatsApp inicializado con éxito.');
        })
        .catch(err => {
            console.error('Error al inicializar el cliente de WhatsApp:', err);
        });

    res.json({ message: 'Inicializando cliente de WhatsApp...' });
});

app.get('/close', (req, res) => {
    closeWhatsAppSession();
    res.json({ message: 'Sesión de WhatsApp cerrada.' });
});

function closeWhatsAppSession() {
    if (client) {
        client.destroy();
        client = null;
    }
    isClientReady = false;
    isInitializing = false;
    qrCodeData = null;
    console.log('Sesión de WhatsApp cerrada.');
}

app.get('/status', (req, res) => {
    res.json({ ready: isClientReady, qrCode: qrCodeData });
});

app.get('/send-message', async (req, res) => {
    const { phone, message } = req.query;

    if (!phone || !message) {
        console.error('Error: Se requieren los parámetros phone y message');
        return res.status(400).json({ error: 'Se requieren los parámetros phone y message' });
    }

    if (!isClientReady) {
        console.log('Cliente de WhatsApp aún no está listo.');
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