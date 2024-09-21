const express = require('express');
const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode');

const app = express();

let client;
let qrCodeData = null;
let isClientReady = false;

app.get('/', (req, res) => {
    if (isClientReady) {
        res.send('<h1>WhatsApp está listo para recibir mensajes</h1>');
    } else if (qrCodeData) {
        res.send(`
            <h1>Escanea el código QR con tu WhatsApp para iniciar sesión</h1>
            <img src="${qrCodeData}" alt="QR Code" />
        `);
    } else {
        res.send('Inicializando cliente de WhatsApp...');
        initializeWhatsAppClient();
    }
});

app.get('/status', (req, res) => {
    res.json({ ready: isClientReady });
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
}

module.exports = app;
