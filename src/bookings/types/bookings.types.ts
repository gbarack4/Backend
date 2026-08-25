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

export type InstructorStartSlot = {
  instructorId: string;
  startDatetime: string;
  endDatetime: string;
};

export type InstructorSlotsMap = Record<string, InstructorStartSlot[]>;
