# AI Call Center Frontend

This is the frontend application for the AI-powered ride booking call center. It provides a user interface for managing bookings and interacting with the backend services.

## Features Implemented

-   **Modern UI:** Built with Angular and Angular Material for a clean, responsive, and visually appealing design.
-   **User Authentication & Authorization:**
    -   Login and Registration pages.
    -   Securely communicates with the backend using JWTs.
    -   Role-based views (`ADMIN` sees all bookings, `CUSTOMER` sees only their own).
-   **Real-time Updates (Frontend part):** Ready to display new bookings as they are created (requires backend Socket.IO integration).
-   **Communication Buttons:** Provides direct links for calling, messaging, and WhatsApp to the Twilio number (visible to logged-in users).
-   **Improved HCI:** Enhanced navigation with a side menu, clear button styling, and improved AI patience.

## Setup Instructions

### Prerequisites

-   Node.js (v18 or higher) and npm
-   Angular CLI (installed globally: `npm install -g @angular/cli`)

### Installation

1.  Navigate to the `frontend` directory:
    ```bash
    cd ai-call-center/frontend
    ```
2.  Install Node.js dependencies:
    ```bash
    npm install
    ```

### `.env` Configuration

Create a file named `.env` in the `ai-call-center/frontend/` directory with the following variable. Replace the placeholder with your actual Twilio phone number.

```env
TWILIO_PHONE_NUMBER="+1234567890" # Your Twilio phone number
```

### Environment Files Configuration

Ensure your Angular environment files (`src/environments/environment.ts` and `src/environments/environment.development.ts`) are correctly configured to use the `TWILIO_PHONE_NUMBER`.

**`src/environments/environment.ts`**

```typescript
export const environment = {
  production: true,
  twilioPhoneNumber: ''
};
```

**`src/environments/environment.development.ts`**

```typescript
export const environment = {
  production: false,
  twilioPhoneNumber: '+1234567890' // REPLACE WITH YOUR ACTUAL TWILIO PHONE NUMBER
};
```

## Running the Frontend

```bash
npm start
```
This will compile the Angular application and serve it, usually on `http://localhost:4200`. Your browser should automatically open to this address.

## Testing Functionalities

1.  **Access the Application:** Open your browser to `http://localhost:4200`.
2.  **Login/Register:**
    -   You will be redirected to the Login page.
    -   Click "Register here" to create a new user (e.g., `admin@example.com` with role `ADMIN`, and `customer@example.com` with role `CUSTOMER`).
    -   Log in with your created credentials.
3.  **Dashboard View:**
    -   **Admin:** After logging in as `ADMIN`, you will see all bookings and the "Phone Number" column.
    -   **Customer:** After logging in as `CUSTOMER`, you will only see bookings associated with your user ID (if any) and the "Phone Number" column will be hidden.
4.  **Communication Buttons:** If logged in, you will see "Call Twilio", "Message Twilio", and "WhatsApp Twilio" buttons. Clicking them will attempt to open the respective communication app.

## Troubleshooting

-   **`NG8001: 'mat-nav-list' is not a known element`:** Ensure `MatListModule` is imported in `src/app/app.ts`.
-   **`TS2339: Property 'env' does not exist on type 'ImportMeta'.`:** Ensure `src/app/bookings/bookings.ts` uses `environment.twilioPhoneNumber` and `src/environments/environment.ts`/`.development.ts` are correctly set up.
-   **`routerLink` not working:** Ensure `RouterLink` is imported in the `imports` array of the component where `routerLink` is used (e.g., `login.ts`, `register.ts`).
-   **Material Icons not showing:** Ensure `<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">` is present in `src/index.html`.
-   **Backend Connection Issues:** Ensure your backend server is running on `http://localhost:3000` and CORS is correctly configured.
