import { PLACEHOLDER } from "../constants";
import { formatMessage } from "./messages";

const DATA_URL = `data:${PLACEHOLDER};charset=utf-8,${PLACEHOLDER}`;

export const createDataUrl = (data: string, contentType: string): string => {
  const encodedData = encodeURIComponent(data);

  return formatMessage(DATA_URL, contentType, encodedData);
};
