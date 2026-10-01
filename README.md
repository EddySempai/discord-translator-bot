# 🌐 Discord Auto-Translator Bot (Real-Time Bidirectional)

Bot de Discord desarrollado en **Node.js (ES Modules)** y **Discord.js v14** para traducción automática bidireccional en tiempo real entre `#general_es` y `#general_en` sin costes ni límites de pago de API.

---

## 🚀 Características

- **Traducción Automática Bidireccional:**
  - Mensaje en `#general_es` ➡️ traducido al inglés en `#general_en`.
  - Mensaje en `#general_en` ➡️ traducido al español en `#general_es`.
- **Replicación de Identidad por Webhooks:** Reutiliza o crea webhooks automáticamente replicando el avatar y apodo del usuario que escribió el mensaje original.
- **Prevención Estricta de Bucles:** Filtra bots, webhooks, mensajes del sistema y mensajes vacíos.
- **Seguridad contra Mass-Pings:** Filtra menciones indebidas (`@everyone` / `@here`).
- **Soporte de Mensajes Extensos:** Divide automáticamente mensajes mayores a 2000 caracteres de manera limpia.
- **Servidor HTTP integrado:** Incluye endpoint de salud (`/`) para mantener el bot activo 24/7 en servicios como Render, Koyeb o Railway.

---

## 🛠️ Instalación y Uso Local

### 1. Clonar o entrar al directorio:
```bash
cd D:/proyects/discord-translator-bot
```

### 2. Instalar dependencias:
```bash
npm install
```

### 3. Configurar `.env`:
Abre el archivo `.env` y pega tu token secreto del bot:
```env
DISCORD_TOKEN=tu_token_aqui
CHANNEL_ES_ID=1442996870812274801
CHANNEL_EN_ID=1555357281309294652
PORT=3000
```

### 4. Iniciar el Bot:
- **Modo Desarrollo:**
  ```bash
  npm run dev
  ```
- **Modo Producción:**
  ```bash
  npm start
  ```

---

## ⚙️ Permisos necesarios en Discord Developer Portal

1. Entra en tu aplicación en [Discord Developer Portal](https://discord.com/developers/applications).
2. Ve a la sección **Bot**:
   - Activa obligatoriamente **Message Content Intent** en *Privileged Gateway Intents*.
3. En **OAuth2 -> URL Generator**:
   - Scopes: `bot`
   - Permisos del Bot:
     - `Manage Webhooks` (Gestionar Webhooks)
     - `Read Messages/View Channels` (Ver Canales)
     - `Send Messages` (Enviar Mensajes)
     - `Read Message History` (Leer Historial de Mensajes)

---

## ☁️ Despliegue 24/7 Gratuito (Render / Koyeb)

El bot incluye un servidor HTTP ligero en el puerto `PORT` (por defecto 3000), lo que permite alojarlo en plataformas gratuitas:

### Opción A: Render.com (Recomendado)
1. Sube este repositorio a tu GitHub.
2. En [Render.com](https://render.com), crea un nuevo **Web Service** conectado a este repositorio.
3. Configuración:
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node index.js`
4. En **Environment Variables**, añade:
   - `DISCORD_TOKEN`
   - `CHANNEL_ES_ID`
   - `CHANNEL_EN_ID`
5. Para evitar que entre en suspensión por inactividad tras 15 minutos en el plan gratuito de Render, añade la URL pública que te dé Render a un monitor gratuito como [UptimeRobot](https://uptimerobot.com) haciendo un ping HTTP cada 5 o 10 minutos.

### Opción B: Koyeb / Railway / Discloud
- **Koyeb:** Crear servicio `Web Service` conectando el repositorio de GitHub con las mismas variables de entorno.
- **Discloud:** Plataforma especializada en bots de Discord con plan gratuito mensual permanente.
