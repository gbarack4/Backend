export interface SlotResult {
  instructorId: string;
  instructor: {
    name: string;
    avatarUrl: string | null;
    pricePerHour: string | null;
  };
  startDatetime: string;
  endDatetime: string;
}

export interface BusyInterval {
  start: number;
  end: number;
}
