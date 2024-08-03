import Alpine from "alpinejs";
import { Toast } from "bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import {
  DEFAULT_CSS_STYLE,
  DEFAULT_URL_PREPROCESSOR,
  STORAGE_KEYS,
  URL_PREPROCESSOR_ARGUMENT_NAME,
} from "../common/constants";
import type { MarkAsReadStorage, Maybe, ReadPage } from "../common/types";
import { createDataUrl } from "../common/utils/data-url";
import { getCurrentDate } from "../common/utils/datetime";
import { formatMessage } from "../common/utils/messages";
import {
  isObject,
  isValidDateString,
  isValidUrl,
} from "../common/utils/validators";
import {
  ALPINE_DATA_ID,
  DEFAULT_TEST_URL,
  EXPORT_JSON_FILE_NAME,
  INVALID_CODE_ERROR,
  INVALID_JSON_ERROR,
  JSON_CONTENT_TYPE,
} from "./settings-constants";

document.addEventListener("alpine:init", () => {
  Alpine.data(ALPINE_DATA_ID, () => ({
    cssBtnsDisabled: true,
    cssStyle: DEFAULT_CSS_STYLE,
    cssStyleTemp: DEFAULT_CSS_STYLE,
    cssStyleElement: null as Maybe<HTMLStyleElement>,
    testUrl: DEFAULT_TEST_URL,
    testUrlResult: "",
    testUrlError: false,
    urlPreprocessorBtnsDisabled: true,
    urlPreprocessorCode: DEFAULT_URL_PREPROCESSOR,
    urlPreprocessorCodeTemp: DEFAULT_URL_PREPROCESSOR,
    applyCssStyle(): void {
      const head = document.querySelector("head")!;

      if (this.cssStyleElement) {
        this.cssStyleElement.remove();
      }

      this.cssStyleElement = document.createElement("style");
      this.cssStyleElement.textContent = this.cssStyleTemp;
      head.append(this.cssStyleElement);
    },
    applyUrlPreprocessor(): void {
      try {
        const urlPreprocessor = new Function(
          URL_PREPROCESSOR_ARGUMENT_NAME,
          this.urlPreprocessorCodeTemp
        );

        this.testUrlResult = urlPreprocessor(this.testUrl);
        this.testUrlError = false;
      } catch (err) {
        this.testUrlResult = INVALID_CODE_ERROR;
        this.testUrlError = true;

        throw err;
      }
    },
    areThereUnsavedChanges(): boolean {
      return !this.cssBtnsDisabled || !this.urlPreprocessorBtnsDisabled;
    },
    attachChangeToJsonInput(): void {
      this.$refs.jsonInput.addEventListener("change", () =>
        this.importPagesFromJson()
      );
    },
    attachPreventCloseWithUnsavedChanges(): void {
      window.addEventListener("beforeunload", (event) => {
        if (this.areThereUnsavedChanges()) {
          event.preventDefault();
        }
      });
    },
    discardCssChanges(): void {
      this.cssStyleTemp = this.cssStyle;
      this.cssBtnsDisabled = true;
      this.applyCssStyle();
    },
    discardUrlPreprocessorChanges(): void {
      this.urlPreprocessorCodeTemp = this.urlPreprocessorCode;
      this.urlPreprocessorBtnsDisabled = true;
      this.applyUrlPreprocessor();
    },
    downloadJsonFile(jsonContent: string): void {
      const anchorEl = document.createElement("a");

      const currentDate = getCurrentDate();
      anchorEl.download = formatMessage(EXPORT_JSON_FILE_NAME, currentDate);
      anchorEl.href = createDataUrl(jsonContent, JSON_CONTENT_TYPE);

      document.body.append(anchorEl);
      anchorEl.click();
      anchorEl.remove();
    },
    async exportPagesToJson(): Promise<void> {
      const { [STORAGE_KEYS.ReadPages]: pages } =
        await browser.storage.sync.get(STORAGE_KEYS.ReadPages);
      const pagesJson = JSON.stringify(pages);
      this.downloadJsonFile(pagesJson);
    },
    async importPagesFromJson(): Promise<void> {
      const jsonInput = this.$refs.jsonInput as HTMLInputElement;
      const selectedFile = jsonInput.files?.[0];

      if (selectedFile) {
        try {
          const jsonContent = await this.readJsonFile(selectedFile);
          const parsedJson = this.parseJsonToPages(jsonContent);
          await this.saveReadPages(parsedJson);

          this.showToast(this.$refs.toastSuccess);
        } catch (err) {
          this.showToast(this.$refs.toastError);

          throw err;
        }
      }
    },
    async initPage(): Promise<void> {
      await this.loadSettings();
      this.attachPreventCloseWithUnsavedChanges();
      this.attachChangeToJsonInput();
      this.applyCssStyle();
      this.applyUrlPreprocessor();
    },
    async loadSettings(): Promise<void> {
      const {
        [STORAGE_KEYS.CssStyle]: cssStyle,
        [STORAGE_KEYS.UrlPreprocessor]: urlPreprocessor,
      } = (await browser.storage.sync.get([
        STORAGE_KEYS.CssStyle,
        STORAGE_KEYS.UrlPreprocessor,
      ])) as MarkAsReadStorage;

      this.cssStyle = cssStyle ?? DEFAULT_CSS_STYLE;
      this.cssStyleTemp = cssStyle ?? DEFAULT_CSS_STYLE;

      this.urlPreprocessorCode = urlPreprocessor ?? DEFAULT_URL_PREPROCESSOR;
      this.urlPreprocessorCodeTemp =
        urlPreprocessor ?? DEFAULT_URL_PREPROCESSOR;
    },
    onCssStyleChange(): void {
      this.cssBtnsDisabled = this.cssStyleTemp === this.cssStyle;
      this.applyCssStyle();
    },
    onUrlPreprocessorChange(): void {
      this.urlPreprocessorBtnsDisabled =
        this.urlPreprocessorCodeTemp === this.urlPreprocessorCode;
      this.applyUrlPreprocessor();
    },
    parseJsonToPages(jsonContent: string): ReadPage[] {
      const parsedJson = JSON.parse(jsonContent);
      this.validateJson(parsedJson);
      return parsedJson as ReadPage[];
    },
    readJsonFile(file: File): Promise<string> {
      const reader = new FileReader();

      return new Promise((resolve) => {
        reader.addEventListener("load", (event) => {
          const result = event.target?.result;

          if (result != null) {
            resolve(result as string);
          }
        });

        reader.readAsText(file);
      });
    },
    restoreDefaultCss(): void {
      this.cssStyleTemp = DEFAULT_CSS_STYLE;
      this.onCssStyleChange();
    },
    restoreDefaultUrlPreprocessor(): void {
      this.urlPreprocessorCodeTemp = DEFAULT_URL_PREPROCESSOR;
      this.onUrlPreprocessorChange();
    },
    async saveCss(): Promise<void> {
      this.cssStyle = this.cssStyleTemp;
      this.cssBtnsDisabled = true;

      await browser.storage.sync.set({
        [STORAGE_KEYS.CssStyle]: this.cssStyle,
      });
    },
    async saveReadPages(pages: ReadPage[]): Promise<void> {
      await browser.storage.sync.set({ [STORAGE_KEYS.ReadPages]: pages });
    },
    async saveUrlPreprocessor(): Promise<void> {
      this.urlPreprocessorCode = this.urlPreprocessorCodeTemp;
      this.urlPreprocessorBtnsDisabled = true;

      await browser.storage.sync.set({
        [STORAGE_KEYS.UrlPreprocessor]: this.urlPreprocessorCode,
      });
    },
    showToast(toastElement: HTMLElement): void {
      const errorToast = new Toast(toastElement);
      errorToast.show();
    },
    triggerJsonImportSelection(): void {
      this.$refs.jsonInput.click();
    },
    validateJson(json: unknown): void {
      if (!Array.isArray(json)) {
        throw new Error(INVALID_JSON_ERROR);
      }

      json.forEach((el: any) => {
        if (
          !isObject(el) ||
          typeof el.url !== "string" ||
          !isValidUrl(el.url) ||
          typeof el.datetime !== "string" ||
          !isValidDateString(el.datetime)
        ) {
          throw new Error(INVALID_JSON_ERROR);
        }
      });
    },
  }));
});

Alpine.start();
