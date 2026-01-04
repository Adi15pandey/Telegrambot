const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const config = require('./config');

// Bot token from BotFather
const TOKEN = '8469664190:AAHNwOarWITUhanxLixQoMEZv45XSI26r0U';
const DISKNOVA_API = `https://api.${config.DISKNOVA_DOMAIN}/v1`;

// Verify configuration
if (!config.DISKNOVA_API_KEY) {
  console.error('ERROR: Missing DiskNova API key in config.js');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

console.log('TeraBox to DiskNova Converter Bot is running...');

async function processTeraboxLink(teraboxUrl) {
  try {
    // 1. First, try to get file info from TeraBox
    const fileInfo = await getTeraboxFileInfo(teraboxUrl);
    
    // 2. Download the file (you'll need to implement this based on TeraBox's API)
    // const fileBuffer = await downloadFromTerabox(fileInfo.downloadUrl);
    
    // 3. Upload to DiskNova
    const disknovaUrl = await uploadToDisknova(fileInfo);
    
    return disknovaUrl;
  } catch (error) {
    console.error('Error processing TeraBox link:', error);
    return null;
  }
}

async function getTeraboxFileInfo(url) {
  // Implement TeraBox API call to get file info
  // This is a placeholder - you'll need to implement the actual API call
  return {
    filename: 'video.mp4',
    size: 0,
    mimeType: 'video/mp4',
    downloadUrl: url // This should be the direct download URL
  };
}

async function uploadToDisknova(fileInfo) {
  try {
    // This is a placeholder - implement actual DiskNova API call
    const response = await axios.post(
      `${DISKNOVA_API}/upload`,
      {
        file: fileInfo.filename,
        size: fileInfo.size,
        type: fileInfo.mimeType
      },
      {
        headers: {
          'Authorization': `Bearer ${config.DISKNOVA_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data.url; // Return the DiskNova URL
  } catch (error) {
    console.error('Error uploading to DiskNova:', error);
    throw error;
  }
}

bot.on('message', async (msg) => {
  if (!msg.text) return;

  try {
    // Check if the message contains a TeraBox link
    const teraboxPattern = /https?:\/\/(?:www\.|s\.)?(?:1024)?terabox\.com\/[\w\/]+/i;
    const match = msg.text.match(teraboxPattern);
    
    if (match) {
      const teraboxUrl = match[0];
      
      // Send initial response
      const processingMsg = await bot.sendMessage(
        msg.chat.id,
        '⏳ Processing your TeraBox link...',
        { reply_to_message_id: msg.message_id }
      );
      
      // Process the link
      const disknovaUrl = await processTeraboxLink(teraboxUrl);
      
      if (disknovaUrl) {
        // Update the message with the result
        await bot.editMessageText(
          `✅ Here's your DiskNova link:\n${disknovaUrl}\n\nNote: The video is being processed and may take a moment to be available.`,
          {
            chat_id: msg.chat.id,
            message_id: processingMsg.message_id,
            disable_web_page_preview: false
          }
        );
      } else {
        await bot.editMessageText(
          '❌ Failed to process the TeraBox link. Please try again later.',
          {
            chat_id: msg.chat.id,
            message_id: processingMsg.message_id
          }
        );
      }
    }
  } catch (error) {
    console.error('Error processing message:', error);
    bot.sendMessage(
      msg.chat.id,
      '❌ An error occurred while processing your request. Please try again later.',
      { reply_to_message_id: msg.message_id }
    );
  }
});

// Handle errors
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});
