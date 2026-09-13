export const LEGAL_MINIMUM_AGE = 21;

export const isOfLegalAge = (dateOfBirth) => {
  if (!dateOfBirth) return false;
  const today = new Date();
  const dob = new Date(dateOfBirth);
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age >= LEGAL_MINIMUM_AGE;
};

export const TIMEZONE = "Asia/Kolkata";
export const LEGAL_OPENING_HOUR = 10;
export const LEGAL_CLOSING_HOUR = 22;

export const isWithinLegalOrderingHours = () => {
  const currentHour = new Date().toLocaleString("en-US", { timeZone: TIMEZONE, hour: "numeric", hour12: false });
  return parseInt(currentHour) >= LEGAL_OPENING_HOUR && parseInt(currentHour) < LEGAL_CLOSING_HOUR;
};
