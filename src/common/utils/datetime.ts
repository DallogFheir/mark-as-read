import { PLACEHOLDER } from "../constants";
import { formatMessage } from "./messages";

const DATE_FORMAT = `${PLACEHOLDER}-${PLACEHOLDER}-${PLACEHOLDER}`;
const DATETIME_FORMAT = `${PLACEHOLDER} ${PLACEHOLDER}:${PLACEHOLDER}`;

const formatDatetimePart = (part: number): string =>
  String(part).padStart(2, "0");

const formatDate = (date: Date): string => {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const dateParts = [day, month, year].map(formatDatetimePart);

  return formatMessage(DATE_FORMAT, ...dateParts);
};

export const getCurrentDate = (): string => {
  return formatDate(new Date());
};

export const formatDatetime = (datetime: Date): string => {
  const date = formatDate(datetime);

  const hours = formatDatetimePart(datetime.getHours());
  const minutes = formatDatetimePart(datetime.getMinutes());

  return formatMessage(DATETIME_FORMAT, date, hours, minutes);
};
