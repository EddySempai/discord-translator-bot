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

## 🔄 Arquitectura Dual (PC Primario + Render Respaldo)

Este bot utiliza un sistema de **Alta Disponibilidad con Detección Activa**:
- **Tu PC (`BOT_ROLE=primary`):** Traduce de forma **instantánea** (<0.3s) desde tu conexión residencial. Arranca solo en segundo plano al encender Windows.
- **Render (`BOT_ROLE=fallback`):** Permanece conectado a Discord 24/7. Cuando llega un mensaje, espera 1.8 segundos:
  - Si tu PC está encendido: Detecta que ya fue enviado por tu PC y **descarta el envío** para no duplicar mensajes.
  - Si tu PC está apagado: Render toma el relevo automáticamente y envía la traducción con su motor multi-traductor (Google + MyMemory de respaldo).

---

## 🛠️ Instalación y Uso en tu PC

### 1. Inicio automático con Windows:
El bot ya está configurado en tu carpeta de inicio de Windows (`Startup`). Cada vez que enciendas tu PC, se iniciará de forma totalmente invisible en segundo plano.

### 2. Controles manuales:
- **`iniciar-bot.bat`**: Si quieres abrirlo en una ventana para ver los logs en directo.
- **`start-silent.vbs`**: Inicia el bot en segundo plano sin ninguna ventana abierta.
- **`detener-bot.bat`**: Detiene el bot de inmediato.

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
