require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { twiml } = require('twilio');
const chrono = require('chrono-node');
const { Client } = require('@googlemaps/google-maps-services-js');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const http = require('http');
const { Server } = require('socket.io');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const prisma = new PrismaClient();
const app = express();
const googleMapsClient = new Client({});
const twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const JWT_SECRET = process.env.JWT_SECRET;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// --- Gemini API Setup ---
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// In-memory store for conversation states.
const conversationStates = new Map();

app.use(cors({ origin: 'http://localhost:4200' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Nodemailer Transporter Setup ---
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// --- Email Sending Function ---
async function sendBookingConfirmationEmail(booking) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: booking.phoneNumber + '@text.com', // Placeholder: In a real system, you'd ask for email or use a lookup
    subject: 'Your Ride Booking Confirmation',
    html: `
      <p>Dear Customer,</p>
      <p>Your ride booking has been confirmed!</p>
      <p><strong>Booking Details:</strong></p>
      <ul>
        <li><strong>Passengers:</strong> ${booking.passengers}</li>
        <li><strong>Pickup:</strong> ${booking.pickupLocation}</li>
        <li><strong>Drop-off:</strong> ${booking.dropoffLocation}</li>
        <li><strong>Date & Time:</strong> ${booking.pickupDateTime.toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })}</li>
        <li><strong>Booking ID:</strong> ${booking.id}</li>
      </ul>
      <p>Thank you for choosing our service!</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Booking confirmation email sent successfully!');
  } catch (error) {
    console.error('Error sending booking confirmation email:', error);
  }
}

// --- REUSABLE CORE LOGIC (LLM-INTEGRATED) ---

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
  let state = conversationStates.get(callSid);

  if (!state) {
    voiceResponse.say('Sorry, there was an error with your session. Please call again.');
    return voiceResponse;
  }

  try {
    let nextAction = 'GATHER';

    // --- LLM Integration for NLU ---
    let currentTaskPrompt = '';
    if (state.stage === 'GATHERING_PASSENGERS') currentTaskPrompt = 'The user is providing the number of passengers.';
    else if (state.stage === 'GATHERING_PICKUP') currentTaskPrompt = 'The user is providing their pickup location.';
    else if (state.stage === 'GATHERING_DROPOFF') currentTaskPrompt = 'The user is providing their drop-off location.';
    else if (state.stage === 'GATHERING_DATETIME') currentTaskPrompt = 'The user is providing the pickup date and time.';

    const prompt = `
      You are an AI assistant for a ride booking service. Your goal is to extract booking details from the user.
      ${currentTaskPrompt}
      The user's last spoken input is: "${speechResult}"

      Current booking details (fill in missing):
      Passengers: ${state.bookingDetails.passengers || 'N/A'}
      Pickup Location: ${state.bookingDetails.pickupLocation || 'N/A'}
      Drop-off Location: ${state.bookingDetails.dropoffLocation || 'N/A'}
      Pickup Date/Time: ${state.bookingDetails.pickupDateTime ? state.bookingDetails.pickupDateTime.toISOString() : 'N/A'}

      Based on the user's input and the current booking details, determine the next action.
      Respond ONLY with a JSON object in the format:
      {
        "action": "<next_action>", // e.g., "ask_passengers", "ask_pickup", "ask_dropoff", "ask_datetime", "confirm_booking", "confirm_location", "reset", "error"
        "extracted_passengers": <number> | null,
        "extracted_pickup_location": "<text>" | null, // Extract pickup location here
        "extracted_dropoff_location": "<text>" | null, // Extract drop-off location here
        "extracted_datetime": "<ISO_datetime_string>" | null,
        "confirmation_response": "yes" | "no" | null, // if user is confirming something
        "ai_response": "<text>" // The AI's next spoken response to the user
      }

      If you need to ask for clarification, set the action to the relevant 'ask_' action and provide the question in 'ai_response'.
      If all details are extracted and confirmed, set action to "confirm_booking".
      If the user is confirming a location, set action to "confirm_location" and 'confirmation_response'.
      If the user says something completely irrelevant or wants to start over, set action to "reset".
      Ensure extracted locations are raw text, not verified addresses yet.
      Ensure extracted_datetime is an ISO string if possible, otherwise null.
    `;

    const result = await geminiModel.generateContent(prompt);
    let responseText = result.response.text();
    // Strip markdown code block delimiters
    if (responseText.startsWith('```json')) {
      responseText = responseText.substring(7, responseText.lastIndexOf('```'));
    }
    let llmResponse;
    try {
      llmResponse = JSON.parse(responseText);
      console.log('LLM Response:', llmResponse);
    } catch (e) {
      console.error('Failed to parse LLM response:', responseText, e);
      llmResponse = { action: 'error', ai_response: 'I had trouble understanding. Could you please repeat that?' };
    }

    // --- Process LLM's Action and Update State ---
    // Always update booking details from LLM extraction first, based on current stage context
    if (llmResponse.extracted_passengers && state.stage === 'GATHERING_PASSENGERS') {
      state.bookingDetails.passengers = llmResponse.extracted_passengers;
    }
    if (llmResponse.extracted_pickup_location && state.stage === 'GATHERING_PICKUP') {
      state.bookingDetails.pickupLocation = llmResponse.extracted_pickup_location;
    }
    if (llmResponse.extracted_dropoff_location && state.stage === 'GATHERING_DROPOFF') {
      state.bookingDetails.dropoffLocation = llmResponse.extracted_dropoff_location;
    }
    if (llmResponse.extracted_datetime && state.stage === 'GATHERING_DATETIME') {
      const parsed = chrono.parseDate(llmResponse.extracted_datetime);
      if (parsed) state.bookingDetails.pickupDateTime = parsed;
    }

    // Determine next stage based on current state and LLM's suggested action
    if (!state.bookingDetails.passengers) {
      state.stage = 'GATHERING_PASSENGERS';
      voiceResponse.say(llmResponse.ai_response || 'How many passengers will be riding?');
    } else if (!state.bookingDetails.pickupLocation) {
      state.stage = 'GATHERING_PICKUP';
      voiceResponse.say(llmResponse.ai_response || 'Where would you like to be picked up from?');
    } else if (!state.bookingDetails.dropoffLocation) {
      state.stage = 'GATHERING_DROPOFF';
      voiceResponse.say(llmResponse.ai_response || 'Where are you heading to?');
    } else if (llmResponse.action === 'confirm_location') {
        if (llmResponse.confirmation_response === 'yes') {
            // If user confirms location, move to next stage based on what was just confirmed
            if (state.bookingDetails.pickupLocation && !state.bookingDetails.dropoffLocation) {
                state.stage = 'GATHERING_DROPOFF';
                voiceResponse.say(llmResponse.ai_response || 'Got it. And where are you heading to?');
            } else if (state.bookingDetails.dropoffLocation && !state.bookingDetails.pickupDateTime) {
                state.stage = 'GATHERING_DATETIME';
                voiceResponse.say(llmResponse.ai_response || 'Okay. For what date and time?');
            } else {
                // Fallback if confirmation happens out of expected sequence, or all locations are done
                // This implies all location info is gathered, move to final confirmation
                state.stage = 'CONFIRMING_BOOKING';
                const { passengers, pickupLocation, dropoffLocation, pickupDateTime } = state.bookingDetails;
                voiceResponse.say(`Please confirm: A ride for ${passengers} from ${pickupLocation} to ${dropoffLocation} for ${pickupDateTime.toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })}. Is this correct?`);
            }
        } else {
            // User said no to location confirmation, ask again for the current location type
            if (!state.bookingDetails.pickupLocation) {
                state.stage = 'GATHERING_PICKUP';
                voiceResponse.say(llmResponse.ai_response || 'My apologies. Let\'s try the pickup location again. Where would you like to be picked up from?');
            } else if (!state.bookingDetails.dropoffLocation) {
                state.stage = 'GATHERING_DROPOFF';
                voiceResponse.say(llmResponse.ai_response || 'My apologies. Let\'s try the destination again. Where are you heading to?');
            } else {
                voiceResponse.say(llmResponse.ai_response || 'Okay, let\'s clarify. What can I help you with?');
            }
        }
    } else if (llmResponse.action === 'confirm_booking') {
        if (llmResponse.confirmation_response === 'yes') {
            const newBooking = await prisma.booking.create({ data: { ...state.bookingDetails, status: 'CONFIRMED' } });
            await sendBookingConfirmationEmail(newBooking);
            io.emit('newBooking', newBooking);
            voiceResponse.say('Thank you. Your booking is confirmed. Goodbye.');
            conversationStates.delete(callSid);
            nextAction = 'HANGUP';
        }
    } else if (llmResponse.action === 'reset') {
        state.stage = 'GATHERING_PASSENGERS';
        voiceResponse.say(llmResponse.ai_response || 'Okay, let\'s start over. How many passengers will be riding?');
    }
    // Fallback for unexpected LLM actions or if LLM doesn't provide a specific action
    else {
        voiceResponse.say(llmResponse.ai_response || 'I am not sure how to proceed. Could you please rephrase?');
    }

    // --- End LLM Integration ---

    // Save state
    conversationStates.set(callSid, state);

    if (nextAction === 'GATHER') {
      voiceResponse.gather({ input: 'speech', action: `/api/twilio/gather?CallSid=${callSid}`, speechTimeout: 2 });
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

app.post('/api/twilio/call', async (req, res) => {
  const { CallSid, From } = req.body;
  const voiceResponse = new twiml.VoiceResponse();

  // Find or create user based on phone number
  let user = await prisma.user.findUnique({ where: { email: From } });
  if (!user) {
    const hashedPassword = await bcrypt.hash(From, 10);
    user = await prisma.user.create({
      data: {
        email: From,
        password: hashedPassword,
        role: 'CUSTOMER',
      },
    });
  }

  const initialState = {
    stage: 'GATHERING_PASSENGERS',
    bookingDetails: { phoneNumber: From, userId: user.id },
    tempLocation: null,
  };
  conversationStates.set(CallSid, initialState);

  voiceResponse.say('Welcome to the AI booking service. How many passengers will be riding?');
  voiceResponse.gather({ input: 'speech', action: `/api/twilio/gather?CallSid=${CallSid}`, speechTimeout: 2 });

  res.type('text/xml').send(voiceResponse.toString());
});

app.post('/api/twilio/gather', async (req, res) => {
  const { CallSid } = req.query;
  const speechResult = req.body.SpeechResult;
  const voiceResponse = await handleConversationTurn(CallSid, speechResult);
  res.type('text/xml').send(voiceResponse.toString());
});

// --- AUTHENTICATION ROUTES ---

app.post('/api/auth/register', async (req, res) => {
  const { email, password, role } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: role || 'CUSTOMER',
      },
    });
    res.status(201).json({ message: 'User registered successfully', userId: user.id });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ error: 'User registration failed. Email might already be in use.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ message: 'Logged in successfully', token, role: user.role, userId: user.id });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// --- AUTHENTICATION MIDDLEWARE ---
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401); // No token

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403); // Invalid token
    req.user = user; // Attach user payload to request
    next();
  });
}

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

    // 1. Manually initialize the call state
    const initialState = {
        stage: 'GATHERING_PASSENGERS',
        bookingDetails: { phoneNumber: simulatedPhoneNumber },
        tempLocation: null,
    };
    conversationStates.set(simulatedCallSid, initialState);
    console.log('AI: Welcome to the AI booking service. How many passengers will be riding?');

    // 2. Define the simulated user responses
    const simulatedUserResponses = [
        '2 people',
        'Tower of London',
        'Buckingham Palace',
        'tomorrow at 10 PM',
        'yes'
    ];

    // 3. Loop through each response, feeding it to the conversation handler
    for (const response of simulatedUserResponses) {
        console.log(`USER (simulated): ${response}`);
        const twimlResponse = await handleConversationTurn(simulatedCallSid, response);
        const aiResponse = twimlResponse.toString().match(/<Say.*>(.*?)<\/Say>/s)?.[1].trim() || '[No verbal response]';
        console.log(`AI: ${aiResponse.replace(/\s+/g, ' ')}`);
    }

    console.log('--- SIMULATION COMPLETE ---');
    res.send('Simulation complete! A new booking should be in your database. Check the backend console for the full conversation log and the frontend dashboard to see the result.');
});

/**
 * [TESTING] Simulates a full booking conversation without a real phone call, using basic NLU.
 * This version does NOT use the Gemini API, allowing testing even with quota limits.
 * Visit this URL in your browser to run it.
 * It will create a new booking in the database which you can see on the frontend.
 */
app.get('/api/twilio/simulate-call-basic', async (req, res) => {
    console.log('--- STARTING BASIC SIMULATION ---');

    const simulatedCallSid = `BASIC_SIMULATED_${Date.now()}`;
    const simulatedPhoneNumber = '+15551234567';

    // 1. Find or create user based on phone number for basic simulation
    let user = await prisma.user.findUnique({ where: { email: simulatedPhoneNumber } });
    if (!user) {
        const hashedPassword = await bcrypt.hash(simulatedPhoneNumber, 10);
        user = await prisma.user.create({
            data: {
                email: simulatedPhoneNumber,
                password: hashedPassword,
                role: 'CUSTOMER',
            },
        });
    }

    // 2. Manually initialize the call state with userId
    const initialState = {
        stage: 'GATHERING_PASSENGERS',
        bookingDetails: { phoneNumber: simulatedPhoneNumber, userId: user.id },
        tempLocation: null,
    };
    conversationStates.set(simulatedCallSid, initialState);
    console.log('AI (Basic): Welcome to the basic AI booking service. How many passengers will be riding?');

    // 3. Define the simulated user responses
    const simulatedUserResponses = [
        '2 people',
        'Tower of London',
        'Buckingham Palace',
        'tomorrow at 10 PM',
        'yes'
    ];

    // 4. Loop through each response, feeding it to the conversation handler
    for (const response of simulatedUserResponses) {
        console.log(`USER (Basic Simulated): ${response}`);
        const voiceResponse = new twiml.VoiceResponse();
        let state = conversationStates.get(simulatedCallSid);

        if (!state) {
            voiceResponse.say('Sorry, there was an error with your session.');
            // return voiceResponse;
        }

        let nextAction = 'GATHER';

        // --- Basic NLU Logic (No LLM) ---
        switch (state.stage) {
            case 'GATHERING_PASSENGERS':
                const passengers = parseInt(response.match(/\d+/)?.[0]);
                if (passengers > 0) {
                    state.bookingDetails.passengers = passengers;
                    state.stage = 'GATHERING_PICKUP';
                    voiceResponse.say('Okay. And where would you like to be picked up from?');
                } else {
                    voiceResponse.say('Sorry, I didn\'t catch a valid number of passengers. Please say the number of passengers.');
                }
                break;

            case 'GATHERING_PICKUP':
                state.bookingDetails.pickupLocation = response;
                state.stage = 'GATHERING_DROPOFF';
                voiceResponse.say('Got it. And where are you heading to?');
                break;

            case 'GATHERING_DROPOFF':
                state.bookingDetails.dropoffLocation = response;
                state.stage = 'GATHERING_DATETIME';
                voiceResponse.say('Okay. For what date and time?');
                break;

            case 'GATHERING_DATETIME':
                const parsedDate = chrono.parseDate(response, new Date(), { forwardDate: true });
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
                if (/yes|correct|yeah/i.test(response)) {
                    const newBooking = await prisma.booking.create({ data: { ...state.bookingDetails, status: 'CONFIRMED' } });
                    await sendBookingConfirmationEmail(newBooking);
                    io.emit('newBooking', newBooking);
                    voiceResponse.say('Thank you. Your booking is confirmed. Goodbye.');
                    conversationStates.delete(simulatedCallSid);
                    nextAction = 'HANGUP';
                } else {
                    voiceResponse.say('Okay, let\'s start over. How many passengers will be riding?');
                    state.stage = 'GATHERING_PASSENGERS';
                }
                break;
        }

        // Save state
        conversationStates.set(simulatedCallSid, state);

        const aiResponse = voiceResponse.toString().match(/<Say.*>(.*?)<\/Say>/s)?.[1].trim() || '[No verbal response]';
        console.log(`AI (Basic): ${aiResponse.replace(/\s+/g, ' ')}`);
    }

    console.log('--- BASIC SIMULATION COMPLETE ---');
    res.send('Basic Simulation complete! A new booking should be in your database. Check the backend console for the full conversation log and the frontend dashboard to see the result.');
});

// --- FRONTEND API ---

// Protected route for fetching bookings
app.get('/api/bookings', authenticateToken, async (req, res) => {
  try {
    // If user is admin, fetch all bookings. Otherwise, fetch only their bookings.
    const bookings = req.user.role === 'ADMIN'
      ? await prisma.booking.findMany({ orderBy: { createdAt: 'desc' } })
      : await prisma.booking.findMany({ where: { userId: req.user.userId }, orderBy: { createdAt: 'desc' } });
    res.json(bookings);
  } catch (error) {
    console.error("Failed to retrieve bookings:", error);
    res.status(500).json({ error: 'Failed to retrieve bookings' });
  }
});

const PORT = process.env.PORT || 3000;
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:4200",
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('a user connected');
  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});