# AI Call Center Backend

This is the backend service for the AI-powered ride booking call center. It handles conversational AI, booking management, user authentication, and integration with external services like Twilio, Google Maps, and email.

## Features Implemented

-   **Conversational AI:** Uses Google Gemini API for advanced Natural Language Understanding (NLU) to guide users through the booking process.
-   **Booking Management:** Stores ride booking details (passengers, locations, date/time) in a MySQL database.
-   **Location Verification:** Integrates with Google Maps Places API to verify pickup and drop-off locations.
-   **Email Notifications:** Sends booking confirmation emails to customers using Nodemailer (via Gmail SMTP).
-   **User Authentication & Authorization:**
    -   User registration and login (email/password).
    -   Secure password hashing with `bcryptjs`.
    -   Session management using JSON Web Tokens (JWTs).
    -   Role-based access control (`ADMIN` can see all bookings, `CUSTOMER` sees only their own).
-   **Twilio Integration:**
    -   Handles incoming voice calls via Twilio webhooks.
    -   Uses Twilio's Text-to-Speech (TTS) and Speech-to-Text (STT) capabilities.
    -   Includes a test route to initiate outbound calls via Twilio.
-   **Real-time Updates (Backend part):** Emits `newBooking` events via Socket.IO when a booking is confirmed.
-   **Conversation State Management:** Uses in-memory `Map` for conversation states (can be upgraded to Redis for production).

## Setup Instructions

### Prerequisites

-   Node.js (v18 or higher) and npm
-   MySQL Database server
-   (Optional, but recommended for full functionality) Google Cloud Platform account with **Places API** enabled and billing set up.
-   (Optional, but recommended for full functionality) Google AI Studio account to generate **Gemini API Key**.
-   (Optional) Gmail account with App Password for email sending.

### Installation

1.  Navigate to the `backend` directory:
    ```bash
    cd ai-call-center/backend
    ```
2.  Install Node.js dependencies:
    ```bash
    npm install
    ```

### Database Setup (MySQL)

1.  Ensure your MySQL server is running.
2.  Create a new database (e.g., `ai_call_center`).
3.  Configure your `.env` file (see below).
4.  Run Prisma migrations to create tables:
    ```bash
    npx prisma migrate dev --name init
    ```
    If you encounter `EPERM` errors during `prisma generate`, stop your `npm run dev` server, run `npx prisma generate` manually, and then restart `npm run dev`.

### `.env` Configuration

Create a file named `.env` in the `ai-call-center/backend/` directory with the following variables. Replace placeholder values with your actual credentials.

```env
DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/DATABASE_NAME"

TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your_auth_token_here"
TWILIO_PHONE_NUMBER="+1234567890" # Your Twilio phone number
NGROK_URL="https://your-ngrok-url.ngrok-free.app" # Your ngrok public URL

GOOGLE_MAPS_API_KEY="AIzaSy..." # Your Google Maps Places API Key
GEMINI_API_KEY="AIzaSy..." # Your Google Gemini API Key from AI Studio

EMAIL_USER="your_gmail_address@gmail.com"
EMAIL_PASS="your_16_character_app_password"

JWT_SECRET="your_super_secret_jwt_key_here_make_it_long_and_random"
```

## Running the Backend

```bash
npm run dev
```
This will start the server using `nodemon`, which automatically restarts on code changes. The server will run on `http://localhost:3000`.

## Testing Functionalities

### 1. Simulate a Call (LLM-based AI Flow Test)

This tests the entire AI conversation, Google Maps integration, email sending, and database saving using the Google Gemini API.

1.  Ensure your backend is running (`npm run dev`).
2.  Open your web browser and visit:
    `http://localhost:3000/api/twilio/simulate-call`
3.  **Observe:**
    -   Your backend terminal will show the full simulated conversation log.
    -   A booking confirmation email will be sent to your `EMAIL_USER`.
    -   A new booking will appear on your frontend dashboard (after you log in).
    -   **Note:** This simulation consumes your Gemini API quota. If you hit the quota, use the Basic Simulation below.

### 2. Simulate a Basic Call (Rule-based AI Flow Test)

This tests the core booking flow, email sending, and database saving using a simpler, rule-based AI. It does NOT use the Gemini API, allowing testing even with quota limits.

1.  Ensure your backend is running (`npm run dev`).
2.  **To link the booking to a specific customer user for testing:**
    -   Register a `CUSTOMER` user on the frontend (e.g., `mycustomer@example.com`).
    -   Open `ai-call-center/backend/src/index.js`.
    -   Find the `app.get('/api/twilio/simulate-call-basic', ...)` route.
    -   Change `const simulatedPhoneNumber = '+15551234567';` to `const simulatedPhoneNumber = 'mycustomer@example.com';` (use the email of your customer user).
    -   Save the file (backend will restart).
3.  Open your web browser and visit:
    `http://localhost:3000/api/twilio/simulate-call-basic`
4.  **Observe:**
    -   Your backend terminal will show the full simulated conversation log (AI responses will be simpler).
    -   A booking confirmation email will be sent to your `EMAIL_USER`.
    -   A new booking will appear on your frontend dashboard (after you log in).

### 3. Initiate an Outbound Twilio Call (Requires Twilio Setup)

This tests the real phone call integration. **Note: Twilio trial accounts can only call verified numbers.**

1.  Ensure your backend is running (`npm run dev`).
2.  Start `ngrok` in a separate terminal:
    ```bash
    ngrok http 3000
    ```
    Copy the `https://` forwarding URL.
3.  **Update `NGROK_URL` in your backend's `.env` file** with this new URL.
4.  Open your web browser and visit:
    `http://localhost:3000/api/twilio/make-call?toNumber=+1234567890` (Replace `+1234567890` with your verified phone number).
5.  **Observe:** Your phone should ring, and you will interact with the AI agent.

### 4. User Authentication

-   **Register:** Send a POST request to `http://localhost:3000/api/auth/register` with `email`, `password`, and `role` (e.g., `ADMIN` or `CUSTOMER`).
-   **Login:** Send a POST request to `http://localhost:3000/api/auth/login` with `email` and `password`. It will return a JWT.

### 5. Fetching Bookings (Protected Route)

-   **Admin:** Make a GET request to `http://localhost:3000/api/bookings` with an `Authorization: Bearer <ADMIN_JWT>` header. You will see all bookings.
-   **Customer:** Make a GET request to `http://localhost:3000/api/bookings` with an `Authorization: Bearer <CUSTOMER_JWT>` header. You will only see bookings associated with that user ID.

## Troubleshooting

-   **`ECONNREFUSED` (Redis):** Means Redis server is not running or accessible. Ensure Redis is started (e.g., `docker run --name my-redis -p 6379:6379 -d redis`).
-   **`GoogleGenerativeAIFetchError: 404 Not Found` (Gemini):** Ensure `GEMINI_API_KEY` is correct and the model name (`gemini-1.5-flash`) is supported. Your quota might be exceeded.
-   **`Google Maps API error: 403` (Maps):** Ensure `GOOGLE_MAPS_API_KEY` is correct, **Places API** is enabled, and **billing is enabled** on your Google Cloud project.
-   **Twilio `unverified number` error:** Twilio trial accounts can only call verified numbers. Verify your number in Twilio console or upgrade your account.
-   **`Failed to parse LLM response`:** Gemini is wrapping JSON in markdown. The code should handle this, but if it persists, check the `handleConversationTurn` function.
------------------------------------------------------------------------
------------------------------------------------------------------------
# System Flow: AI Call Center with Real APIs


  Phase 1: Call Initiation & Initial Greeting

  1.  Customer Calls Twilio Number:
      *   A customer dials your dedicated Twilio phone number.
      *   Twilio receives the incoming call.


   2. Twilio Webhook to Your Backend (Initial Call):
   3. Backend Processes Initial Call:
   4. Twilio Speaks to Customer:
   5. Customer Speaks:
   6. Twilio Webhook to Your Backend (Gathered Input):
   7. Backend Processes Gathered Input (LLM NLU):
   8. Google Gemini API Processes NLU:
   9. Backend Processes Gemini's Response & Integrates Google Maps:
   10. Twilio Continues Conversation:
   12. Booking Saved to Database:
   13. Email Confirmation:
   14. Real-time Dashboard Update:
   15. Call Ends:
   16. Frontend Dashboard Access:
  This comprehensive flow demonstrates how your system leverages various APIs to provide an intelligent and automated call center experience.

# Setup
1. Copy `.env.example` to `.env`
2. Fill in your own credentials
3. Run the project as usual
