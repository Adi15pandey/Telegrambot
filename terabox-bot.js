const TelegramBot = require('node-telegram-bot-api');

// TODO: Replace with your Terabox bot token when you receive it
const TOKEN = '8211542563:AAF6D52irD9t9GowWiVj6CVREDDwtkBV0Jk'; // Your Telegram bot token
const DOMAIN = 'disknova.com';

// Don't start if token is not set
if (!TOKEN || TOKEN === 'YOUR_TERABOX_BOT_TOKEN_HERE') {
  console.error('ERROR: Please set your Terabox bot token in terabox-bot.js');
  console.error('Replace YOUR_TERABOX_BOT_TOKEN_HERE with your actual token');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

console.log('DiskNova Terabox Bot is running...');

function convertLinks(text) {
  console.log('Received text:', text);
  let changed = false;
  let result = text;

  // Detect both terabox.com and 1024terabox.com links
  const pattern = /https?:\/\/([a-z0-9]+\.)?terabox[^\s]*/gi;

  if (pattern.test(result)) {
    result = result.replace(pattern, (match) => {
      try {
        const url = new URL(match);
        return `https://${DOMAIN}${url.pathname}${url.search}${url.hash}`;
      } catch (e) {
        // If URL parsing fails, do a simple replacement
        return match.replace(/https?:\/\/(www\.)?(1024)?terabox[^\s]*/gi, `https://${DOMAIN}`);
      }
    });
    changed = true;
  }

  return changed ? result : null;
}

bot.on('message', (msg) => {
  console.log('New message received:', JSON.stringify(msg, null, 2));
  // Only process text messages
  if (!msg.text) {
    console.log('Message has no text content');
    return;
  }

  const converted = convertLinks(msg.text);
  console.log('Converted link:', converted);
  if (!converted) {
    console.log('No TeraBox links found in message');
    return;
  }

  // Reply to the original message
  bot.sendMessage(
    msg.chat.id,
    `Converted DiskNova link:\n${converted}`,
    { reply_to_message_id: msg.message_id }
  ).catch((error) => {
    console.error('Error sending message:', error);
  });
});

// Handle errors
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

