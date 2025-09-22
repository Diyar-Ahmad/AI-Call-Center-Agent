export interface Booking {
  id: number;
  createdAt: string; // Using string for simplicity, can be Date
  updatedAt: string;
  phoneNumber: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickupDateTime: string;
  passengers: number;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
}
