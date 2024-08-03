import { PLACEHOLDER } from "../constants";

const PLACEHOLDERS_VALUES_MISTMATCH =
  "The number of placeholders does not match the number of values.";

export const formatMessage = (
  message: string,
  ...placeholderValues: string[]
): string => {
  let result = message;

  placeholderValues.forEach((value) => {
    if (!result.includes(PLACEHOLDER)) {
      throw new Error(formatMessage(PLACEHOLDERS_VALUES_MISTMATCH));
    }

    result = result.replace(PLACEHOLDER, value);
  });

  if (result.includes(PLACEHOLDER)) {
    throw new Error(formatMessage(PLACEHOLDERS_VALUES_MISTMATCH));
  }

  return result;
};
