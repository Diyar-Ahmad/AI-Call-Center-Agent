import express from 'express';
import http from 'http';
import WebSocket from 'ws';
import twilio from 'twilio';
import { SpeechClient } from '@google-cloud/speech';
import { SessionsClient } from '@google-cloud/dialogflow-cx';
import { v4 as uuidv4 } from 'uuid';
import { googleCloudConfig } from './config';

// --- AUTHENTICATION REMINDER ---
// Run `gcloud auth application-default login` in your terminal.

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Configure Cloud Clients
const speechClient = new SpeechClient();
// Note: The apiEndpoint must match your agent's location (e.g., 'us-central1-dialogflow.googleapis.com')
const dialogflowClient = new SessionsClient({ apiEndpoint: `${googleCloudConfig.location}-dialogflow.googleapis.com` });

app.post('/voice', (req, res) => {
  const websocketUrl = `wss://${req.headers.host}/`;
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say({ voice: 'alice' }, 'Hello! How can I help you book your ride today?');
  const connect = twiml.connect();
  connect.stream({ url: websocketUrl });
  twiml.pause({ length: 20 });
  res.type('text/xml');
  res.send(twiml.toString());
});

wss.on('connection', (ws) => {
  console.log('WebSocket connection established');
  let recognizeStream: any = null;
  let streamSid: string;
  const sessionId = uuidv4(); // Unique session for this call

  ws.on('message', (message) => {
    const msg = JSON.parse(message.toString());

    switch (msg.event) {
      case 'connected':
        console.log('Twilio stream connected');
        break;

      case 'start':
        streamSid = msg.start.streamSid;
        console.log(`Twilio media stream started (SID: ${streamSid})`);
        
        recognizeStream = speechClient
          .streamingRecognize({
            config: {
              encoding: 'MULAW',
              sampleRateHertz: 8000,
              languageCode: 'en-GB',
              model: 'phone_call',
            },
            interimResults: false,
          })
          .on('error', (err) => console.error('STT Error:', err))
          .on('data', async (data) => {
            const transcript = data.results[0]?.alternatives[0]?.transcript || '';
            if (transcript) {
              console.log(`Transcription: ${transcript}`);
              // Send the transcript to Dialogflow
              const dialogflowResponse = await detectIntent(transcript, sessionId);
              console.log(`Dialogflow says: ${dialogflowResponse}`);
              // Send the response back to the caller
              sendReplyToCaller(dialogflowResponse, streamSid);
            }
          });
        break;

      case 'media':
        if (recognizeStream) {
          recognizeStream.write(msg.media.payload);
        }
        break;

      case 'stop':
        console.log('Twilio media stream stopped');
        if (recognizeStream) {
          recognizeStream.destroy();
        }
        break;
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
    if (recognizeStream) {
      recognizeStream.destroy();
    }
  });

  async function detectIntent(query: string, sessionId: string): Promise<string> {
    const sessionPath = dialogflowClient.projectLocationAgentSessionPath(
      googleCloudConfig.projectId,
      googleCloudConfig.location,
      googleCloudConfig.agentId,
      sessionId
    );

    const request = {
      session: sessionPath,
      queryInput: {
        text: {
          text: query,
        },
        languageCode: googleCloudConfig.languageCode,
      },
    };

    try {
      const [response] = await dialogflowClient.detectIntent(request);
      const result = response.queryResult?.responseMessages?.[0]?.text?.text?.[0] || "I don't have an answer for that.";
      return result;
    } catch (error) {
      console.error('Dialogflow Error:', error);
      return "Sorry, I ran into a technical issue.";
    }
  }

  function sendReplyToCaller(text: string, streamSid: string) {
    // This function is a placeholder. A real implementation to stream audio back
    // is more complex and requires sending raw audio chunks.
    // For now, we simply log the intended reply to the console.
    console.log(`AI would say: ${text}`);
    
    // To make the agent speak, you would send a <Say> command back through the stream.
    // This is a simplified way to show the concept.
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say({ voice: 'alice' }, text);

    const mediaMessage = {
      event: 'media',
      streamSid,
      media: {
        payload: Buffer.from(twiml.toString()).toString('base64'),
      },
    };
    // ws.send(JSON.stringify(mediaMessage)); // This line is illustrative
  }
});

server.listen(PORT, () => {
  console.log(`Server and WebSocket listening on port ${PORT}`);
});
