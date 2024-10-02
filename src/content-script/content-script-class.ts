import {
  MARK_AS_READ_CSS_CLASS,
  STORAGE_KEYS,
  URL_PREPROCESSOR_ARGUMENT_NAME,
} from "../common/constants";
import { MarkAsReadError } from "../common/errors";
import type {
  MarkAsReadMessage,
  MarkAsReadStorage,
  Maybe,
  ReadPage,
  UrlPreprocessor,
} from "../common/types";
import { MARK_AS_READ_NOT_INITIALIZED } from "./content-script-constants";
import type { AnchorNodes } from "./content-script-types";

const ANCHOR_TAG_NAME = "A";

export class MarkAsReadContentScript {
  #anchorMutationObserver: Maybe<MutationObserver> = null;
  #cssStyle: Maybe<string> = null;
  #cssStyleElement: Maybe<HTMLStyleElement> = null;
  #headMutationObserver: Maybe<MutationObserver> = null;
  #isEnabled: boolean = false;
  #readPages: Maybe<ReadPage[]> = null;
  #urlPreprocessor: Maybe<UrlPreprocessor> = null;

  #onStorageChange: (changes: {
    [key: string]: browser.storage.StorageChange;
  }) => void;
  #toggleCurrentPageIsRead: () => Promise<void>;

  constructor() {
    this.#onStorageChange = this.#_onStorageChange.bind(this);
    this.#toggleCurrentPageIsRead = this.#_toggleCurrentPageIsRead.bind(this);
  }

  async start(): Promise<void> {
    await this.#loadSettings();
    this.#registerStorageChangeListener();

    if (this.#isEnabled) {
      await this.#startContentScript();
    }
  }

  #addCssClassToAnchorNode(anchorNode: HTMLAnchorElement): void {
    anchorNode.classList.add(MARK_AS_READ_CSS_CLASS);
  }

  #addCssStyleElement(): void {
    if (!this.#cssStyleElement) {
      this.#cssStyleElement = document.createElement("style");
      this.#cssStyleElement.textContent = this.#cssStyle ?? "";
    }

    document.head.append(this.#cssStyleElement);
  }

  #applyCssClassToAnchorNodes(): void {
    const anchorNodes = document.querySelectorAll("a");
    const { read } = this.#splitAnchorNodes([...anchorNodes]);
    read.forEach(this.#addCssClassToAnchorNode);
  }

  #applyCssClassWithPreprocessingAll(): void {
    const anchorNodes = document.querySelectorAll("a");
    const { read, unread } = this.#splitAnchorNodes([...anchorNodes]);
    read.forEach(this.#addCssClassToAnchorNode);
    unread.forEach(this.#removeCssClassFromAnchorNode);
    this.#informBackgroundIsCurrentPageRead();
  }

  #checkInitialized(): void {
    const shouldBeInitializedFields = [
      this.#cssStyle,
      this.#cssStyleElement,
      this.#readPages,
      this.#urlPreprocessor,
    ];

    if (shouldBeInitializedFields.some((field) => !field)) {
      throw new MarkAsReadError(MARK_AS_READ_NOT_INITIALIZED);
    }
  }

  async #informBackgroundIsCurrentPageRead(): Promise<void> {
    const currentUrl = window.location.href;
    const readPage = this.#getReadPageFromUrl(currentUrl);

    if (readPage) {
      await browser.runtime.sendMessage({
        isRead: true,
        match: {
          url: readPage.url,
          datetime: readPage.datetime,
        },
      } satisfies MarkAsReadMessage);
    } else {
      await browser.runtime.sendMessage({
        isRead: false,
      } satisfies MarkAsReadMessage);
    }
  }

  #isAnchorNode(node: Node): node is HTMLAnchorElement {
    return node.nodeName === ANCHOR_TAG_NAME;
  }

  #getReadPageFromUrl(url: string): Maybe<ReadPage> {
    this.#checkInitialized();

    const processedUrl = this.#urlPreprocessor!(url);
    return this.#readPages!.find(({ url }) => url === processedUrl);
  }

  async #loadSettings(): Promise<void> {
    const {
      [STORAGE_KEYS.CssStyle]: cssStyle,
      [STORAGE_KEYS.IsEnabled]: isEnabled,
      [STORAGE_KEYS.ReadPages]: readPages,
      [STORAGE_KEYS.UrlPreprocessor]: urlPreprocessor,
    } = (await browser.storage.local.get([
      STORAGE_KEYS.CssStyle,
      STORAGE_KEYS.IsEnabled,
      STORAGE_KEYS.ReadPages,
      STORAGE_KEYS.UrlPreprocessor,
    ])) as MarkAsReadStorage;

    this.#cssStyle = cssStyle;
    this.#isEnabled = isEnabled;
    this.#readPages = readPages;
    this.#urlPreprocessor = this.#parseUrlPreprocessor(urlPreprocessor);
  }

  #onBodyChange(mutations: MutationRecord[]): void {
    const allAddedNodes = mutations.reduce((acc, { addedNodes }) => {
      return [...acc, ...addedNodes];
    }, [] as Node[]);

    const { read } = this.#splitAnchorNodes(allAddedNodes);

    read.forEach(this.#addCssClassToAnchorNode);
  }

  #onHeadChildrenChange(mutations: MutationRecord[]): void {
    if (this.#wasCssStyleRemoved(mutations)) {
      this.#addCssStyleElement();
    }
  }

  async #_onStorageChange(changes: {
    [key: string]: browser.storage.StorageChange;
  }): Promise<void> {
    Object.entries(changes).forEach(([key, { newValue }]) => {
      switch (key) {
        case STORAGE_KEYS.CssStyle: {
          if (this.#isEnabled) {
            this.#cssStyle = newValue;
            this.#updateCssStyleElement();
          }
          break;
        }
        case STORAGE_KEYS.IsEnabled: {
          this.#isEnabled = newValue;

          if (this.#isEnabled) {
            this.#startContentScript();
          } else {
            this.#stopContentScript();
          }

          break;
        }
        case STORAGE_KEYS.ReadPages: {
          if (this.#isEnabled) {
            this.#readPages = newValue;
            this.#applyCssClassWithPreprocessingAll();
          }
          break;
        }
        case STORAGE_KEYS.UrlPreprocessor: {
          if (this.#isEnabled) {
            this.#urlPreprocessor = this.#parseUrlPreprocessor(newValue);
            this.#applyCssClassWithPreprocessingAll();
          }
          break;
        }
      }
    });
  }

  #parseUrlPreprocessor(urlPreprocessorCode: string): UrlPreprocessor {
    return new Function(
      URL_PREPROCESSOR_ARGUMENT_NAME,
      urlPreprocessorCode
    ) as UrlPreprocessor;
  }

  #registerAnchorMutationObserver(): void {
    if (!this.#anchorMutationObserver) {
      this.#anchorMutationObserver = new MutationObserver(
        this.#onBodyChange.bind(this)
      );
    }

    this.#anchorMutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  #registerHeadMutationObserver(): void {
    if (!this.#headMutationObserver) {
      this.#headMutationObserver = new MutationObserver(
        this.#onHeadChildrenChange.bind(this)
      );
    }

    this.#headMutationObserver.observe(document.head, { childList: true });
  }

  #registerMessageListener(): void {
    browser.runtime.onMessage.addListener(this.#toggleCurrentPageIsRead);
  }

  #registerStorageChangeListener(): void {
    browser.storage.local.onChanged.addListener(this.#onStorageChange);
  }

  #removeCssClassFromAnchorNode(anchorNode: HTMLAnchorElement): void {
    anchorNode.classList.remove(MARK_AS_READ_CSS_CLASS);
  }

  #removeCssClassFromAnchorNodes(): void {
    const allAnchorNodes = document.querySelectorAll("a");

    allAnchorNodes.forEach(this.#removeCssClassFromAnchorNode);
  }

  #removeCssStyleElement(): void {
    this.#cssStyleElement?.remove();
    this.#cssStyleElement = null;
  }

  #splitAnchorNodes(nodes: Node[]): AnchorNodes {
    const anchorNodes: AnchorNodes = {
      read: [],
      unread: [],
    };

    nodes.forEach((node) => {
      if (!this.#isAnchorNode(node)) {
        return;
      }

      const arrayToPush = this.#getReadPageFromUrl(node.href)
        ? anchorNodes.read
        : anchorNodes.unread;
      arrayToPush.push(node);
    });

    return anchorNodes;
  }

  async #startContentScript(): Promise<void> {
    this.#registerMessageListener();
    this.#addCssStyleElement();
    await this.#informBackgroundIsCurrentPageRead();
    this.#applyCssClassToAnchorNodes();
    this.#registerAnchorMutationObserver();
    this.#registerHeadMutationObserver();
  }

  #stopContentScript(): void {
    this.#removeCssStyleElement();
    this.#removeCssClassFromAnchorNodes();
    this.#unregisterAnchorMutationObserver();
    this.#unregisterHeadMutationObserver();
  }

  async #_toggleCurrentPageIsRead(): Promise<void> {
    const currentUrl = window.location.href;
    const processedUrl = this.#urlPreprocessor!(currentUrl);

    if (this.#getReadPageFromUrl(currentUrl)) {
      this.#readPages = this.#readPages!.filter(
        ({ url }) => url !== currentUrl
      );
    } else {
      this.#readPages!.push({
        url: processedUrl,
        datetime: new Date().toISOString(),
      });
    }

    await browser.storage.local.set({
      [STORAGE_KEYS.ReadPages]: this.#readPages,
    });

    await this.#informBackgroundIsCurrentPageRead();
  }

  #unregisterAnchorMutationObserver(): void {
    this.#anchorMutationObserver?.disconnect();
  }

  #unregisterHeadMutationObserver(): void {
    this.#headMutationObserver?.disconnect();
  }

  #updateCssStyleElement(): void {
    this.#checkInitialized();

    this.#cssStyleElement!.textContent = this.#cssStyle!;
  }

  #wasCssStyleRemoved(mutations: MutationRecord[]): boolean {
    return mutations.some(
      ({ removedNodes }) =>
        !this.#cssStyleElement ||
        [...removedNodes].includes(this.#cssStyleElement)
    );
  }
}
