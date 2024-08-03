export const isObject = (value: unknown): boolean => {
  return typeof value === "object" && value !== null;
};

export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const isValidDateString = (dateString: string): boolean => {
  try {
    Date.parse(dateString);
    return true;
  } catch {
    return false;
  }
};
