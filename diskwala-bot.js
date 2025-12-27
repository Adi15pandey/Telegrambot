const TelegramBot = require('node-telegram-bot-api');
const https = require('https');
const http = require('http');

const TOKEN = '8556160171:AAE6LN8tONBWDqWJwP9l_fMuwpqMnYsYXjc';
const DOMAIN = 'disknova.com';

// API Configuration for ID mapping
// TODO: Update these with your actual API endpoint
const ID_MAPPING_API = {
  enabled: true, // Set to false to disable API calls and use direct ID mapping
  endpoint: 'https://disknova.com/api/convert', // Your API endpoint
  method: 'GET', // 'GET' or 'POST'
  paramName: 'diskwalaId', // Parameter name for Diskwala ID
  responseField: 'disknovaId' // Field name in API response containing DiskNova ID
};

// Fallback: Direct ID mapping (if IDs are the same or you have a static mapping)
const ID_MAPPING = {
  // Example: 'diskwala-id': 'disknova-id'
  // '694ee9cc39857e10c6f79735': 'different-disknova-id-here'
};

const bot = new TelegramBot(TOKEN, { polling: true });

console.log('DiskNova Diskwala Bot is running...');

// Function to get DiskNova ID from Diskwala ID via API or mapping
async function getDiskNovaId(diskwalaId) {
  // Check direct mapping first
  if (ID_MAPPING[diskwalaId]) {
    console.log(`Found direct mapping for ${diskwalaId}`);
    return ID_MAPPING[diskwalaId];
  }

  // If API is enabled, call it
  if (ID_MAPPING_API.enabled && ID_MAPPING_API.endpoint) {
    try {
      const apiUrl = ID_MAPPING_API.method === 'GET' 
        ? `${ID_MAPPING_API.endpoint}?${ID_MAPPING_API.paramName}=${diskwalaId}`
        : ID_MAPPING_API.endpoint;
      
      console.log(`Calling API: ${apiUrl}`);
      
      return new Promise((resolve, reject) => {
        const url = new URL(apiUrl);
        const options = {
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname + url.search,
          method: ID_MAPPING_API.method,
          headers: {
            'Content-Type': 'application/json'
          }
        };

        if (ID_MAPPING_API.method === 'POST') {
          const postData = JSON.stringify({ [ID_MAPPING_API.paramName]: diskwalaId });
          options.headers['Content-Length'] = Buffer.byteLength(postData);
        }

        const req = (url.protocol === 'https:' ? https : http).request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const response = JSON.parse(data);
              const disknovaId = response[ID_MAPPING_API.responseField] || response.id || response.disknovaId;
              if (disknovaId) {
                console.log(`API returned DiskNova ID: ${disknovaId}`);
                resolve(disknovaId);
              } else {
                console.log('API response missing ID field, using original ID');
                resolve(diskwalaId); // Fallback to original ID
              }
            } catch (e) {
              console.error('Error parsing API response:', e);
              resolve(diskwalaId); // Fallback to original ID
            }
          });
        });

        req.on('error', (error) => {
          console.error('API request error:', error);
          resolve(diskwalaId); // Fallback to original ID
        });

        if (ID_MAPPING_API.method === 'POST') {
          const postData = JSON.stringify({ [ID_MAPPING_API.paramName]: diskwalaId });
          req.write(postData);
        }
        
        req.end();
      });
    } catch (error) {
      console.error('Error calling ID mapping API:', error);
      return diskwalaId; // Fallback to original ID
    }
  }

  // If no mapping found and API disabled, return original ID
  console.log(`No mapping found for ${diskwalaId}, using original ID`);
  return diskwalaId;
}

function convertLinks(text) {
  let changed = false;
  let result = text;

  // Only detect Diskwala links
  const pattern = /https?:\/\/(www\.)?diskwala[^\s]*/gi;

  if (pattern.test(result)) {
    result = result.replace(pattern, (match) => {
      try {
        const url = new URL(match);
        // Convert /app/ paths to /video/ to match Flutter app configuration
        let pathname = url.pathname;
        if (pathname.startsWith('/app/')) {
          pathname = pathname.replace('/app/', '/video/');
        }
        return `https://${DOMAIN}${pathname}${url.search}${url.hash}`;
      } catch (e) {
        // If URL parsing fails, do a simple replacement
        return match.replace(/https?:\/\/(www\.)?diskwala[^\s]*/gi, `https://${DOMAIN}`);
      }
    });
    changed = true;
  }

  return changed ? result : null;
}

bot.on('message', async (msg) => {
  // Debug: Log all messages to verify bot is receiving them
  console.log('Received message in chat:', msg.chat.id, 'Type:', msg.chat.type);
  
  // Only process text messages
  if (!msg.text) {
    console.log('Message has no text, skipping...');
    return;
  }

  console.log('Processing text:', msg.text.substring(0, 50) + '...');
  
  // Find Diskwala links
  const diskwalaPattern = /https?:\/\/(www\.)?diskwala[^\s]*/gi;
  const matches = msg.text.match(diskwalaPattern);
  
  if (!matches || matches.length === 0) {
    console.log('No Diskwala link found in message');
    return;
  }

  try {
    // Process each Diskwala link found
    let convertedLinks = [];
    
    for (const match of matches) {
      try {
        const url = new URL(match);
        let pathname = url.pathname;
        
        // Extract ID from path (e.g., /app/694ee9cc39857e10c6f79735)
        const pathParts = pathname.split('/');
        const diskwalaId = pathParts[pathParts.length - 1];
        
        if (diskwalaId) {
          console.log(`Extracted Diskwala ID: ${diskwalaId}`);
          
          // Get DiskNova ID (via API or mapping)
          const disknovaId = await getDiskNovaId(diskwalaId);
          
          // Build DiskNova URL
          let disknovaPath = '/video/';
          if (pathname.startsWith('/app/')) {
            disknovaPath = '/video/';
          } else if (pathname.startsWith('/share/')) {
            disknovaPath = '/share/';
          } else if (pathname.startsWith('/file/')) {
            disknovaPath = '/file/';
          }
          
          const disknovaUrl = `https://${DOMAIN}${disknovaPath}${disknovaId}${url.search}${url.hash}`;
          convertedLinks.push(disknovaUrl);
          
          console.log(`Converted: ${match} → ${disknovaUrl}`);
        } else {
          // If no ID found, do simple domain replacement
          const simpleConverted = match.replace(/https?:\/\/(www\.)?diskwala[^\s]*/gi, `https://${DOMAIN}`);
          convertedLinks.push(simpleConverted);
        }
      } catch (e) {
        console.error('Error processing link:', e);
        // Fallback: simple replacement
        const simpleConverted = match.replace(/https?:\/\/(www\.)?diskwala[^\s]*/gi, `https://${DOMAIN}`);
        convertedLinks.push(simpleConverted);
      }
    }

    if (convertedLinks.length > 0) {
      const convertedText = convertedLinks.join('\n');
      
      // Reply to the original message
      bot.sendMessage(
        msg.chat.id,
        `Converted DiskNova link:\n${convertedText}`,
        { 
          reply_to_message_id: msg.message_id
        }
      ).catch((error) => {
        console.error('Error sending message:', error);
      });
    }
  } catch (error) {
    console.error('Error processing message:', error);
  }
});

// Handle errors
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

