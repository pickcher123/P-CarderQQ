import { messagingApi } from '@line/bot-sdk';

let lineClient: messagingApi.MessagingApiClient | null = null;

function getLineClient() {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
  if (!channelAccessToken) {
    return null;
  }
  if (!lineClient) {
    lineClient = new messagingApi.MessagingApiClient({
      channelAccessToken,
    });
  }
  return lineClient;
}

export async function pushLineMessage(userId: string, message: string) {
  const client = getLineClient();
  if (!client) {
    console.warn('LINE_CHANNEL_ACCESS_TOKEN is not set');
    return;
  }
  
  try {
    await client.pushMessage({
      to: userId,
      messages: [
        {
          type: 'text',
          text: message,
        },
      ],
    });
  } catch (error) {
    console.error('Error pushing LINE message:', error);
  }
}

