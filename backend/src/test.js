require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { twiml } = require('twilio');
const chrono = require('chrono-node');
const { Client } = require('@googlemaps/google-maps-services-js');

const prisma = new PrismaClient();
const app = express();
const googleMapsClient = new Client({});
const twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// In-memory store for conversation states. In production, use Redis.
const conversationStates = new Map();

app.use(cors({ origin: 'http://localhost:4200' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- REUSABLE CORE LOGIC ---

async function findPlace(textQuery) {
  try {
    const response = await googleMapsClient.findPlaceFromText({
      params: {
        input: textQuery,
        inputtype: 'textquery',
        fields: ['place_id', 'name', 'formatted_address', 'geometry'],
        key: process.env.GOOGLE_MAPS_API_KEY,
        locationbias: 'circle:200000@54.5,-2.5',
      },
    });
    if (response.data.candidates && response.data.candidates.length > 0) {
      return response.data.candidates[0];
    }
    return null;
  } catch (error) {
    console.error("Google Maps API error:", error);
    return null;
  }
}

async function handleConversationTurn(callSid, speechResult) {
  const voiceResponse = new twiml.VoiceResponse();
  const state = conversationStates.get(callSid);

  if (!state) {
    voiceResponse.say('Sorry, there was an error with your session.');
    return voiceResponse;
  }

  try {
    let nextAction = 'GATHER';

    switch (state.stage) {
      case 'GATHERING_PASSENGERS':
        const passengers = parseInt(speechResult.match(/\d+/)?.[0]);
        if (passengers > 0) {
          state.bookingDetails.passengers = passengers;
          state.stage = 'GATHERING_PICKUP';
          voiceResponse.say('Okay. And where would you like to be picked up from?');
        } else {
          voiceResponse.say('Sorry, I didn\'t catch a valid number of passengers. Please say the number of passengers.');
        }
        break;

      case 'GATHERING_PICKUP':
        const pickupCandidate = await findPlace(speechResult);
        if (pickupCandidate) {
          state.tempLocation = pickupCandidate;
          state.stage = 'CONFIRMING_PICKUP';
          voiceResponse.say(`I found a location: ${pickupCandidate.formatted_address}. Is that correct?`);
        } else {
          voiceResponse.say("I couldn't find that location. Please be more specific.");
        }
        break;

      case 'CONFIRMING_PICKUP':
        if (/yes|correct|yeah/i.test(speechResult)) {
          const { name, formatted_address, geometry } = state.tempLocation;
          state.bookingDetails.pickupLocation = formatted_address || name;
          state.bookingDetails.pickupLat = geometry.location.lat;
          state.bookingDetails.pickupLng = geometry.location.lng;
          state.tempLocation = null;
          state.stage = 'GATHERING_DROPOFF';
          voiceResponse.say('Got it. And where are you heading to?');
        } else {
          state.stage = 'GATHERING_PICKUP';
          voiceResponse.say('My apologies. Let\'s try the pickup location again. Where would you like to be picked up from?');
        }
        break;

      case 'GATHERING_DROPOFF':
        const dropoffCandidate = await findPlace(speechResult);
        if (dropoffCandidate) {
          state.tempLocation = dropoffCandidate;
          state.stage = 'CONFIRMING_DROPOFF';
          voiceResponse.say(`I found a destination: ${dropoffCandidate.formatted_address}. Is that correct?`);
        } else {
          voiceResponse.say("I couldn't find that destination. Please be more specific.");
        }
        break;

      case 'CONFIRMING_DROPOFF':
        if (/yes|correct|yeah/i.test(speechResult)) {
          const { name, formatted_address, geometry } = state.tempLocation;
          state.bookingDetails.dropoffLocation = formatted_address || name;
          state.bookingDetails.dropoffLat = geometry.location.lat;
          state.bookingDetails.dropoffLng = geometry.location.lng;
          state.tempLocation = null;
          state.stage = 'GATHERING_DATETIME';
          voiceResponse.say('Okay. For what date and time?');
        } else {
          state.stage = 'GATHERING_DROPOFF';
          voiceResponse.say('My apologies. Let\'s try the destination again. Where are you heading to?');
        }
        break;

      case 'GATHERING_DATETIME':
        const parsedDate = chrono.parseDate(speechResult, new Date(), { forwardDate: true });
        if (parsedDate) {
          state.bookingDetails.pickupDateTime = parsedDate;
          state.stage = 'CONFIRMING_BOOKING';
          const { passengers, pickupLocation, dropoffLocation, pickupDateTime } = state.bookingDetails;
          voiceResponse.say(`Please confirm: A ride for ${passengers} from ${pickupLocation} to ${dropoffLocation} for ${pickupDateTime.toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })}. Is this correct?`);
        } else {
          voiceResponse.say('I couldn\'t understand that date and time. Please try again, for example, by saying tomorrow at 5 PM.');
        }
        break;

      case 'CONFIRMING_BOOKING':
        if (/yes|correct|yeah/i.test(speechResult)) {
          await prisma.booking.create({ data: { ...state.bookingDetails, status: 'CONFIRMED' } });
          voiceResponse.say('Thank you. Your booking is confirmed. Goodbye.');
          conversationStates.delete(callSid);
          nextAction = 'HANGUP';
        } else {
          state.stage = 'GATHERING_PASSENGERS';
          voiceResponse.say('Okay, let\'s start over. How many passengers will be riding?');
        }
        break;
    }

    if (nextAction === 'GATHER') {
      voiceResponse.gather({ input: 'speech', action: `/api/twilio/gather?CallSid=${callSid}`, speechTimeout: 'auto' });
    } else if (nextAction === 'HANGUP') {
      voiceResponse.hangup();
    }

  } catch (error) {
    console.error('Error processing conversation:', error);
    voiceResponse.say('I encountered an error. Please try calling again.');
    conversationStates.delete(callSid);
  }

  return voiceResponse;
}


// --- TWILIO WEBHOOK ROUTES ---

app.post('/api/twilio/call', (req, res) => {
  const { CallSid, From } = req.body;
  const voiceResponse = new twiml.VoiceResponse();

  conversationStates.set(CallSid, {
    stage: 'GATHERING_PASSENGERS',
    bookingDetails: { phoneNumber: From },
    tempLocation: null,
  });

  voiceResponse.say('Welcome to the AI booking service. How many passengers will be riding?');
  voiceResponse.gather({ input: 'speech', action: `/api/twilio/gather?CallSid=${CallSid}`, speechTimeout: 'auto' });

  res.type('text/xml').send(voiceResponse.toString());
});

app.post('/api/twilio/gather', async (req, res) => {
  const { CallSid } = req.query;
  const speechResult = req.body.SpeechResult;
  const voiceResponse = await handleConversationTurn(CallSid, speechResult);
  res.type('text/xml').send(voiceResponse.toString());
});


// --- TESTING ROUTES ---

app.get('/api/twilio/make-call', async (req, res) => {
  const { toNumber } = req.query;
  if (!toNumber) {
    return res.status(400).send("Please provide a 'toNumber' query parameter.");
  }
  try {
    const call = await twilioClient.calls.create({
      to: toNumber,
      from: process.env.TWILIO_PHONE_NUMBER,
      url: `${process.env.NGROK_URL}/api/twilio/call`,
    });
    console.log(`Initiating call to ${toNumber}, SID: ${call.sid}`);
    res.send(`Successfully initiated call to ${toNumber}. Your phone should be ringing.`);
  } catch (error) {
    console.error('Failed to initiate call:', error);
    res.status(500).send('Failed to initiate call. Check backend logs for details.');
  }
});

/**
 * [TESTING] Simulates a full booking conversation without a real phone call.
 * Visit this URL in your browser to run it.
 * It will create a new booking in the database which you can see on the frontend.
 */
app.get('/api/twilio/simulate-call', async (req, res) => {
    console.log('--- STARTING SIMULATION ---');

    const simulatedCallSid = `SIMULATED_${Date.now()}`;
    const simulatedPhoneNumber = '+15551234567';

    // 1. Manually initialize the call state, just like a real call would
    conversationStates.set(simulatedCallSid, {
        stage: 'GATHERING_PASSENGERS',
        bookingDetails: { phoneNumber: simulatedPhoneNumber },
        tempLocation: null,
    });
    console.log('AI: Welcome to the AI booking service. How many passengers will be riding?');

    // 2. Define the simulated user responses for a full conversation
    const simulatedUserResponses = [
        '2 people',
        'Tower of London',
        'yes',
        'Buckingham Palace',
        'yes',
        'tomorrow at 10 PM',
        'yes'
    ];

    // 3. Loop through each response, feeding it to the conversation handler
    for (const response of simulatedUserResponses) {
        console.log(`USER (simulated): ${response}`);
        const twimlResponse = await handleConversationTurn(simulatedCallSid, response);
        // Extract the text from the <Say> tag in the TwiML response to show what the AI would say next
        const aiResponse = twimlResponse.toString().match(/<Say.*>(.*?)<\/Say>/s)?.[1].trim() || '[No verbal response]';
        console.log(`AI: ${aiResponse.replace(/\s+/g, ' ')}`);
    }

    console.log('--- SIMULATION COMPLETE ---');
    res.send('Simulation complete! A new booking should be in your database. Check the backend console for the full conversation log and the frontend dashboard to see the result.');
});


// --- FRONTEND API ---

app.get('/api/bookings', async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(bookings);
  } catch (error) {
    console.error("Failed to retrieve bookings:", error);
    res.status(500).json({ error: 'Failed to retrieve bookings' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
