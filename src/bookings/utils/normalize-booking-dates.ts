type BookingDateFields = {
  startDatetime: string;
  endDatetime: string;
  cancelledAt: string | null;
};

export function normalizeBookingDates<T extends BookingDateFields>(booking: T) {
  return {
    ...booking,
    startDatetime: new Date(booking.startDatetime).toISOString(),
    endDatetime: new Date(booking.endDatetime).toISOString(),
    cancelledAt: booking.cancelledAt ? new Date(booking.cancelledAt).toISOString() : null,
  };
}
