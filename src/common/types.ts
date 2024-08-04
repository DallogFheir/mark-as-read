export type Maybe<T> = T | null | undefined;

export interface MarkAsReadMessage {
  isRead: boolean;
  match?: ReadPage;
}

export interface MarkAsReadStorage {
  isEnabled: boolean;
  cssStyle: string;
  readPages: ReadPage[];
  urlPreprocessor: string;
}

export interface ReadPage {
  url: string;
  datetime: string;
}

export type UrlPreprocessor = (url: string) => string;
