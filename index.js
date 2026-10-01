import http from 'node:http';
import {
  Client,
  GatewayIntentBits,
  Events,
  PermissionsBitField,
  ChannelType
} from 'discord.js';
import { translate } from '@vitalets/google-translate-api';
import dotenv from 'dotenv';

dotenv.config();

// ==========================================
// 1. CONFIGURACIÓN Y VARIABLES DE ENTORNO
// ==========================================
const {
  DISCORD_TOKEN,
  CHANNEL_ES_ID,
  CHANNEL_EN_ID,
  PORT = 3000
} = process.env;

if (!DISCORD_TOKEN || DISCORD_TOKEN === 'pega_aqui_tu_token_de_discord') {
  console.warn('⚠️  [AVISO] Debes configurar tu DISCORD_TOKEN en el archivo .env antes de iniciar el bot.');
}

if (!CHANNEL_ES_ID || !CHANNEL_EN_ID) {
  console.error('❌ [FATAL] Faltan CHANNEL_ES_ID o CHANNEL_EN_ID en el archivo .env');
  process.exit(1);
}

// Mapeo declarativo para traducción bidireccional
const TRANSLATION_MAP = {
  [CHANNEL_ES_ID]: {
    targetChannelId: CHANNEL_EN_ID,
    sourceLang: 'es',
    targetLang: 'en',
    label: '#general_es ➡️ #general_en'
  },
  [CHANNEL_EN_ID]: {
    targetChannelId: CHANNEL_ES_ID,
    sourceLang: 'en',
    targetLang: 'es',
    label: '#general_en ➡️ #general_es'
  }
};

const WEBHOOK_NAME = 'AutoTranslate-Bridge';
const DISCORD_MSG_LIMIT = 2000;

// Caché en memoria para reutilizar Webhooks (ChannelId -> Webhook)
const webhookCache = new Map();

// ==========================================
// 2. SERVIDOR HTTP PARA HOSTING 24/7 (RENDER, KOYEB, RAILWAY)
// ==========================================
// Muchas plataformas gratuitas requieren un puerto abierto con respuesta HTTP 200 para no apagar el contenedor.
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'online',
    bot: client.user ? client.user.tag : 'Iniciando...',
    uptime: Math.floor(process.uptime()) + 's',
    timestamp: new Date().toISOString()
  }));
});

server.listen(PORT, () => {
  console.log(`🌐 Servidor HTTP activo en el puerto ${PORT} (listo para UptimeRobot / Health checks de hosting).`);
});

// ==========================================
// 3. CLIENTE DE DISCORD Y CONFIGURACIÓN DE INTENTS
// ==========================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent // Requerido: Privileged Intent en Discord Developer Portal
  ]
});

// ==========================================
// 4. FUNCIONES AUXILIARES
// ==========================================

/**
 * Divide textos largos (>2000 caracteres) respetando párrafos o palabras.
 * @param {string} text 
 * @param {number} maxLength 
 * @returns {string[]}
 */
function splitMessage(text, maxLength = DISCORD_MSG_LIMIT) {
  if (text.length <= maxLength) return [text];

  const chunks = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    let splitIndex = remaining.lastIndexOf('\n', maxLength);
    if (splitIndex === -1 || splitIndex < maxLength * 0.7) {
      splitIndex = remaining.lastIndexOf(' ', maxLength);
    }
    if (splitIndex === -1 || splitIndex < maxLength * 0.7) {
      splitIndex = maxLength;
    }

    chunks.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }

  return chunks;
}

/**
 * Obtiene un webhook propio existente en el canal o crea uno nuevo de forma persistente.
 * @param {import('discord.js').TextChannel} channel 
 * @returns {Promise<import('discord.js').Webhook>}
 */
async function getOrCreateWebhook(channel) {
  // 1. Revisar caché en memoria
  if (webhookCache.has(channel.id)) {
    return webhookCache.get(channel.id);
  }

  // 2. Comprobar permisos
  const permissions = channel.permissionsFor(client.user);
  if (!permissions?.has(PermissionsBitField.Flags.ManageWebhooks)) {
    throw new Error(`Permisos insuficientes: Se requiere 'Manage Webhooks' en #${channel.name}`);
  }

  // 3. Buscar si ya existe un webhook creado previamente por este bot
  const webhooks = await channel.fetchWebhooks();
  let webhook = webhooks.find(
    (wh) => wh.owner?.id === client.user.id && wh.name === WEBHOOK_NAME
  );

  // 4. Si no existe, crear uno nuevo
  if (!webhook) {
    webhook = await channel.createWebhook({
      name: WEBHOOK_NAME,
      avatar: client.user.displayAvatarURL({ extension: 'png' }),
      reason: 'Sincronización automática de traducción bidireccional'
    });
    console.log(`✨ [WEBHOOK] Creado nuevo webhook en #${channel.name}`);
  } else {
    console.log(`♻️  [WEBHOOK] Reutilizando webhook existente en #${channel.name}`);
  }

  // 5. Guardar en memoria
  webhookCache.set(channel.id, webhook);
  return webhook;
}

/**
 * Traduce el texto al idioma especificado.
 * @param {string} text 
 * @param {string} to 
 * @returns {Promise<string>}
 */
async function translateText(text, to) {
  try {
    const result = await translate(text, { to });
    return result.text;
  } catch (error) {
    console.error(`❌ [TRANSLATE ERROR] Fallo al traducir a "${to}":`, error.message);
    throw error;
  }
}

// ==========================================
// 5. EVENTOS PRINCIPALES DE DISCORD
// ==========================================

client.once(Events.ClientReady, (c) => {
  console.log(`\n=================================================`);
  console.log(`🤖 Bot iniciado como: ${c.user.tag}`);
  console.log(`📡 Sincronización activa:`);
  console.log(`   - Español: Canal ID ${CHANNEL_ES_ID}`);
  console.log(`   - Inglés:  Canal ID ${CHANNEL_EN_ID}`);
  console.log(`=================================================\n`);
});

client.on(Events.MessageCreate, async (message) => {
  try {
    // 1. FILTRADO ESTRICTO DE BUCLES Y MENSAJES INVÁLIDOS
    if (message.author.bot) return;        // Ignora otros bots y a sí mismo
    if (message.webhookId) return;         // Ignora mensajes enviados por webhooks
    if (message.system) return;            // Ignora notificaciones del sistema
    if (!message.content || message.content.trim() === '') return; // Ignora mensajes sin texto (solo imágenes/stickers)

    // 2. COMPROBAR SI PERTENECE A LOS CANALES MONITOREADOS
    const config = TRANSLATION_MAP[message.channelId];
    if (!config) return;

    // 3. OBTENER CANAL DESTINO
    const targetChannel = await client.channels.fetch(config.targetChannelId);
    if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
      console.error(`⚠️  [ERROR] Canal de destino ${config.targetChannelId} no encontrado o no es de texto.`);
      return;
    }

    // 4. TRADUCIR CONTENIDO
    const translatedText = await translateText(message.content, config.targetLang);
    if (!translatedText || translatedText.trim() === '') return;

    // 5. OBTENER/REUTILIZAR WEBHOOK
    let webhook;
    try {
      webhook = await getOrCreateWebhook(targetChannel);
    } catch (whErr) {
      console.error(`❌ [ERROR WEBHOOK] No se pudo obtener el webhook en #${targetChannel.name}:`, whErr.message);
      return;
    }

    // 6. FORMATEAR IDENTIDAD DEL AUTOR ORIGINAL
    const authorName = message.member?.displayName || message.author.globalName || message.author.username;
    const sanitizedUsername = authorName.slice(0, 80); // Límite de Discord para nombres de webhook
    const authorAvatar = message.author.displayAvatarURL({
      extension: 'png',
      forceStatic: false,
      size: 256
    });

    // 7. DIVIDIR MENSAJES EXTENSOS Y ENVIAR
    const chunks = splitMessage(translatedText, DISCORD_MSG_LIMIT);

    for (const chunk of chunks) {
      try {
        await webhook.send({
          content: chunk,
          username: sanitizedUsername,
          avatarURL: authorAvatar,
          // SEGURIDAD: Evita que un mensaje traduzca e invoque @everyone o @here accidental o maliciosamente
          allowedMentions: { parse: [] }
        });
      } catch (sendErr) {
        // Manejo de recuperación si alguien borró el webhook en Discord (Error 10015: Unknown Webhook)
        if (sendErr.code === 10015) {
          console.warn(`⚠️  [WARN] Webhook eliminado externamente. Re-creando...`);
          webhookCache.delete(targetChannel.id);
          webhook = await getOrCreateWebhook(targetChannel);
          await webhook.send({
            content: chunk,
            username: sanitizedUsername,
            avatarURL: authorAvatar,
            allowedMentions: { parse: [] }
          });
        } else {
          throw sendErr;
        }
      }
    }

    console.log(`[TRADUCIDO] ${config.label} | ${authorName}: "${message.content.slice(0, 30)}..." ➡️ "${translatedText.slice(0, 30)}..."`);

  } catch (error) {
    console.error('❌ [ERROR INESPERADO]', error);
  }
});

// ==========================================
// 6. CIERRE SEGURO DEL PROCESO
// ==========================================
function handleShutdown(signal) {
  console.log(`\n🛑 Recibida señal ${signal}. Cerrando bot y servidor HTTP limpiamente...`);
  server.close(() => {
    client.destroy();
    process.exit(0);
  });
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

// ==========================================
// 7. CONEXIÓN A DISCORD
// ==========================================
if (DISCORD_TOKEN && DISCORD_TOKEN !== 'pega_aqui_tu_token_de_discord') {
  client.login(DISCORD_TOKEN).catch((err) => {
    console.error('❌ [ERROR LOGIN DISCORD] Revisa que tu DISCORD_TOKEN sea válido:', err.message);
  });
} else {
  console.log('ℹ️  Pega tu token en el archivo .env para conectar el bot a Discord.');
}
