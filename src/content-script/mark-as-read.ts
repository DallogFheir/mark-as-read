import {
  MARK_AS_READ_CSS_CLASS,
  STORAGE_KEYS,
  URL_PREPROCESSOR_ARGUMENT_NAME,
} from "../common/constants";
import type {
  MarkAsReadMessage,
  MarkAsReadStorage,
  Maybe,
  ReadPage,
  UrlPreprocessor,
} from "../common/types";
import { MARK_AS_READ_NOT_INITIALIZED } from "./content-script-constants";
import type { AnchorNodes } from "./content-script-types";
import { MarkAsReadError } from "./errors";

const ANCHOR_TAG_NAME = "A";

export class MarkAsRead {
  #cssStyle: Maybe<string> = null;
  #cssStyleElement: Maybe<HTMLStyleElement> = null;
  #readPages: Maybe<ReadPage[]> = null;
  #urlPreprocessor: Maybe<UrlPreprocessor> = null;

  async start(): Promise<void> {
    await this.#loadSettings();
    this.#addCssStyleElement();
    await this.#informBackgroundIsCurrentPageRead();
    this.#registerStorageChangeListener();
    this.#registerMessageListener();
    this.#applyCssClassToAnchorNodes();
    this.#registerAnchorMutationObserver();
    this.#registerHeadMutationObserver();
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

  #splitAnchorNodes(nodes: Node[]): AnchorNodes {
    const anchorNodes: AnchorNodes = {
      read: [],
      unread: [],
    };

    nodes.forEach((node) => {
      if (!this.#isAnchorNode(node)) {
        return;
      }

      const arrayToPush = this.#isUrlRead(node.href)
        ? anchorNodes.read
        : anchorNodes.unread;
      arrayToPush.push(node);
    });

    return anchorNodes;
  }

  async #informBackgroundIsCurrentPageRead(): Promise<void> {
    const currentUrl = window.location.href;

    if (this.#isUrlRead(currentUrl)) {
      const matchInfo = this.#readPages!.find(({ url }) => url === currentUrl)!;

      await browser.runtime.sendMessage({
        isRead: true,
        match: {
          url: matchInfo.url,
          datetime: matchInfo.datetime,
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

  #isUrlRead(url: string): boolean {
    this.#checkInitialized();

    const processedUrl = this.#urlPreprocessor!(url);
    return this.#readPages!.find(({ url }) => url === processedUrl) != null;
  }

  async #loadSettings(): Promise<void> {
    const {
      [STORAGE_KEYS.CssStyle]: cssStyle,
      [STORAGE_KEYS.ReadPages]: readPages,
      [STORAGE_KEYS.UrlPreprocessor]: urlPreprocessor,
    } = (await browser.storage.sync.get([
      STORAGE_KEYS.CssStyle,
      STORAGE_KEYS.ReadPages,
      STORAGE_KEYS.UrlPreprocessor,
    ])) as MarkAsReadStorage;

    this.#cssStyle = cssStyle;
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

  #onStorageChange(changes: {
    [key: string]: browser.storage.StorageChange;
  }): void {
    Object.entries(changes).forEach(([key, { newValue }]) => {
      switch (key) {
        case STORAGE_KEYS.CssStyle: {
          this.#cssStyle = newValue;
          this.#updateCssStyleElement();
          break;
        }
        case STORAGE_KEYS.ReadPages: {
          this.#readPages = newValue;
          this.#applyCssClassWithPreprocessingAll();
          break;
        }
        case STORAGE_KEYS.UrlPreprocessor: {
          this.#urlPreprocessor = this.#parseUrlPreprocessor(newValue);
          this.#applyCssClassWithPreprocessingAll();
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
    const anchorMutationObserver = new MutationObserver((mutations) =>
      this.#onBodyChange(mutations)
    );

    anchorMutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  #registerHeadMutationObserver(): void {
    const headMutationObserver = new MutationObserver((mutations) =>
      this.#onHeadChildrenChange(mutations)
    );

    headMutationObserver.observe(document.head, { childList: true });
  }

  #registerMessageListener(): void {
    browser.runtime.onMessage.addListener(() =>
      this.#toggleCurrentPageIsRead()
    );
  }

  #registerStorageChangeListener(): void {
    browser.storage.sync.onChanged.addListener((changes) =>
      this.#onStorageChange(changes)
    );
  }

  #removeCssClassFromAnchorNode(anchorNode: HTMLAnchorElement): void {
    anchorNode.classList.remove(MARK_AS_READ_CSS_CLASS);
  }

  async #toggleCurrentPageIsRead(): Promise<void> {
    const currentUrl = window.location.href;
    const processedUrl = this.#urlPreprocessor!(currentUrl);

    if (this.#isUrlRead(currentUrl)) {
      this.#readPages = this.#readPages!.filter(
        ({ url }) => url !== currentUrl
      );
    } else {
      this.#readPages!.push({
        url: processedUrl,
        datetime: new Date().toISOString(),
      });
    }

    await browser.storage.sync.set({
      [STORAGE_KEYS.ReadPages]: this.#readPages,
    });

    await this.#informBackgroundIsCurrentPageRead();
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
