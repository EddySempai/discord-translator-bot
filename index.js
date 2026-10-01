import http from 'node:http';
import fs from 'node:fs';
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
  PORT = 3000,
  BOT_ROLE = 'primary' // 'primary' (tu PC) o 'fallback' (Render)
} = process.env;

const isFallback = BOT_ROLE.toLowerCase() === 'fallback';
const FALLBACK_WAIT_MS = 1800; // Render espera 1.8 segundos para verificar si tu PC ya lo tradujo

if (!DISCORD_TOKEN || DISCORD_TOKEN === 'pega_aqui_tu_token_de_discord') {
  console.warn('⚠️  [AVISO] Debes configurar tu DISCORD_TOKEN en el archivo .env antes de iniciar el bot.');
}

if (!CHANNEL_ES_ID || !CHANNEL_EN_ID) {
  console.error('❌ [FATAL] Faltan CHANNEL_ES_ID o CHANNEL_EN_ID en el archivo .env');
  process.exit(1);
}

// Guardar PID local para poder detenerlo limpiamente
try {
  fs.writeFileSync('bot.pid', process.pid.toString());
} catch {
  // Ignorar en entornos de solo lectura
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

// Caché en memoria para Webhooks (ChannelId -> Webhook)
const webhookCache = new Map();

// ==========================================
// 2. SERVIDOR HTTP PARA HEALTH CHECKS
// ==========================================
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'online',
    role: BOT_ROLE.toUpperCase(),
    bot: client.user ? client.user.tag : 'Iniciando...',
    uptime: Math.floor(process.uptime()) + 's',
    timestamp: new Date().toISOString()
  }));
});

server.listen(PORT, () => {
  console.log(`🌐 Servidor HTTP activo en el puerto ${PORT} (Modo: ${BOT_ROLE.toUpperCase()}).`);
});

// ==========================================
// 3. CLIENTE DE DISCORD
// ==========================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ==========================================
// 4. FUNCIONES AUXILIARES
// ==========================================

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

async function getOrCreateWebhook(channel) {
  if (webhookCache.has(channel.id)) {
    return webhookCache.get(channel.id);
  }

  const permissions = channel.permissionsFor(client.user);
  if (!permissions?.has(PermissionsBitField.Flags.ManageWebhooks)) {
    throw new Error(`Permisos insuficientes: Se requiere 'Manage Webhooks' en #${channel.name}`);
  }

  const webhooks = await channel.fetchWebhooks();
  let webhook = webhooks.find(
    (wh) => wh.owner?.id === client.user.id && wh.name === WEBHOOK_NAME
  );

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

  webhookCache.set(channel.id, webhook);
  return webhook;
}

/**
 * Traduce con carrera/fallback: Intenta Google primero; si se traba o bloquea en la nube, usa MyMemory
 */
async function translateText(text, to) {
  // Motor 1: Google Translate
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const result = await translate(text, { to, fetchOptions: { signal: controller.signal } });
    clearTimeout(timeout);
    if (result?.text) return result.text;
  } catch (err) {
    console.warn(`⚠️ [TRADUCTOR] Motor primario lento/bloqueado (${err.message}). Conectando motor secundario...`);
  }

  // Motor 2 (Respaldo): MyMemory API
  try {
    const from = to === 'en' ? 'es' : 'en';
    const response = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`
    );
    const data = await response.json();
    if (data?.responseData?.translatedText) {
      return data.responseData.translatedText;
    }
  } catch (secErr) {
    console.error('❌ [ERROR] Falló motor secundario:', secErr.message);
  }

  throw new Error('Todos los motores de traducción fallaron.');
}

// ==========================================
// 5. EVENTOS PRINCIPALES DE DISCORD
// ==========================================

client.once(Events.ClientReady, (c) => {
  console.log(`\n=================================================`);
  console.log(`🤖 Bot iniciado como: ${c.user.tag}`);
  console.log(`🏷️  Rol de esta instancia: [ ${BOT_ROLE.toUpperCase()} ]`);
  if (isFallback) {
    console.log(`🛡️  Modo Respaldo activo: Solo actuará si tu PC está apagado.`);
  } else {
    console.log(`⚡ Modo Primario activo: Traducción instantánea local.`);
  }
  console.log(`📡 Sincronización: ${CHANNEL_ES_ID} <==> ${CHANNEL_EN_ID}`);
  console.log(`=================================================\n`);
});

client.on(Events.MessageCreate, async (message) => {
  try {
    // 1. Filtrado básico de bucles y validación
    if (message.author.bot) return;
    if (message.webhookId) return;
    if (message.system) return;
    if (!message.content || message.content.trim() === '') return;

    const config = TRANSLATION_MAP[message.channelId];
    if (!config) return;

    const authorName = message.member?.displayName || message.author.globalName || message.author.username;
    const sanitizedUsername = authorName.slice(0, 80);

    // 2. COORDINACIÓN DUAL (RACE / FALLBACK)
    // Si esta instancia es Render (fallback), espera 1.8 segundos y verifica si el PC ya envió la traducción
    if (isFallback) {
      await new Promise((res) => setTimeout(res, FALLBACK_WAIT_MS));

      const targetChannel = await client.channels.fetch(config.targetChannelId);
      if (!targetChannel) return;

      // Leer los últimos 6 mensajes del canal destino
      const recentMessages = await targetChannel.messages.fetch({ limit: 6 });
      const alreadyProcessed = recentMessages.some((msg) => {
        const isRecent = (Date.now() - msg.createdTimestamp) < 15000; // últimos 15 seg
        const isWebhook = Boolean(msg.webhookId);
        const isSameUser = msg.author.username === sanitizedUsername;
        return isRecent && isWebhook && isSameUser;
      });

      if (alreadyProcessed) {
        console.log(`🛡️ [RESPALDO] Mensaje de "${sanitizedUsername}" ya fue traducido por tu PC. Omitiendo.`);
        return;
      }

      console.log(`🚨 [RESPALDO] Tu PC no respondió a tiempo. Render toma el relevo para "${sanitizedUsername}"...`);
    }

    // 3. Obtener canal destino
    const targetChannel = await client.channels.fetch(config.targetChannelId);
    if (!targetChannel || targetChannel.type !== ChannelType.GuildText) return;

    // 4. Traducir
    const translatedText = await translateText(message.content, config.targetLang);
    if (!translatedText || translatedText.trim() === '') return;

    // 5. Enviar por Webhook
    let webhook = await getOrCreateWebhook(targetChannel);
    const authorAvatar = message.author.displayAvatarURL({
      extension: 'png',
      forceStatic: false,
      size: 256
    });

    const chunks = splitMessage(translatedText, DISCORD_MSG_LIMIT);

    for (const chunk of chunks) {
      try {
        await webhook.send({
          content: chunk,
          username: sanitizedUsername,
          avatarURL: authorAvatar,
          allowedMentions: { parse: [] }
        });
      } catch (sendErr) {
        if (sendErr.code === 10015) {
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

    const tag = isFallback ? '[RENDER RESPALDO]' : '[PC PRIMARIO]';
    console.log(`${tag} ${config.label} | ${authorName}: "${message.content.slice(0, 30)}..." ➡️ "${translatedText.slice(0, 30)}..."`);

  } catch (error) {
    console.error('❌ [ERROR]', error.message);
  }
});

// ==========================================
// 6. CIERRE LIMPIO
// ==========================================
function cleanup() {
  try {
    if (fs.existsSync('bot.pid')) fs.unlinkSync('bot.pid');
  } catch {}
  server.close(() => {
    client.destroy();
    process.exit(0);
  });
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

client.login(DISCORD_TOKEN).catch((err) => {
  console.error('❌ [ERROR LOGIN DISCORD]:', err.message);
});
