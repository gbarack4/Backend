export interface CreditAvailabilityQuery {
  instructorId: string;
  month: string;
  durationMinutes: number;
}

export interface CreditAvailabilitySlot {
  instructorId: string;
  startDatetime: string;
  endDatetime: string;
  startTime: string;
  endTime: string;
}

export interface CreditAvailabilityDay {
  date: string;
  slotCount: number;
  slots: CreditAvailabilitySlot[];
}

export interface MonthAvailabilityRecord {
  instructorId: string;
  dayOfWeek: number;
  startTime: string | null;
  endTime: string | null;
  slotInterval: number;
  travelTime: number;
  locations: Array<{
    id: string;
  }>;
  breaks: Array<{
    startTime: string;
    endTime: string;
  }>;
  instructor: {
    bookings: Array<{
      startDatetime: string;
      endDatetime: string;
    }>;
    availabilityBlocks: Array<{
      startDatetime: string;
      endDatetime: string;
    }>;
  };
}
