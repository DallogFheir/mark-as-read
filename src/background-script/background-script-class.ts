import {
  DEFAULT_CSS_STYLE,
  DEFAULT_URL_PREPROCESSOR,
  STORAGE_KEYS,
} from "../common/constants";
import { MarkAsReadError } from "../common/errors";
import type {
  MarkAsReadMessage,
  MarkAsReadStorage,
  Maybe,
} from "../common/types";
import { formatDatetime } from "../common/utils/datetime";
import { formatMessage } from "../common/utils/messages";
import { isObject } from "../common/utils/validators";
import {
  BADGE_CLICK_MODIFIERS,
  CLICK_DATA_UNDEFINED,
  DISABLED_BADGE_MESSAGE,
  ICON_PATHS,
  IS_READ_BUT_NO_MATCH,
  PRESS_TO_MARK_AS_READ_BADGE_MESSAGE,
  READ_BADGE_MESSAGE,
  TAB_UNDEFINED,
} from "./background-script-constants";

export class MarkAsReadBackgroundScript {
  #onBrowserActionClick: (
    tab: browser.tabs.Tab,
    clickData: Maybe<browser.browserAction.OnClickData>
  ) => Promise<void>;
  #onExtensionInstalled: (
    details: browser.runtime._OnInstalledDetails
  ) => Promise<void>;
  #onMessage: (
    message: any,
    sender: browser.runtime.MessageSender
  ) => Promise<void>;

  constructor() {
    this.#onBrowserActionClick = this.#_onBrowserActionClick.bind(this);
    this.#onExtensionInstalled = this.#_onExtensionInstalled.bind(this);
    this.#onMessage = this.#_onMessage.bind(this);
  }

  async start(): Promise<void> {
    browser.runtime.onInstalled.addListener(this.#onExtensionInstalled);
    browser.browserAction.onClicked.addListener(this.#onBrowserActionClick);

    if (await this.#isEnabled()) {
      this.#startBackgroundScript();
    }
  }

  async #informContentScriptMarkAsRead(tabId: number): Promise<void> {
    if (await this.#isEnabled()) {
      await browser.tabs.sendMessage(tabId, null);
    }
  }

  async #initSettings(): Promise<void> {
    const {
      [STORAGE_KEYS.CssStyle]: cssStyle,
      [STORAGE_KEYS.IsEnabled]: isEnabled,
      [STORAGE_KEYS.ReadPages]: readPages,
      [STORAGE_KEYS.UrlPreprocessor]: urlPreprocessor,
    } = await browser.storage.sync.get([
      STORAGE_KEYS.CssStyle,
      STORAGE_KEYS.IsEnabled,
      STORAGE_KEYS.ReadPages,
      STORAGE_KEYS.UrlPreprocessor,
    ]);

    await browser.storage.sync.set({
      [STORAGE_KEYS.CssStyle]: cssStyle ?? DEFAULT_CSS_STYLE,
      [STORAGE_KEYS.IsEnabled]: isEnabled ?? true,
      [STORAGE_KEYS.ReadPages]: readPages ?? [],
      [STORAGE_KEYS.UrlPreprocessor]:
        urlPreprocessor ?? DEFAULT_URL_PREPROCESSOR,
    } satisfies MarkAsReadStorage);

    this.#startBackgroundScript();
  }

  async #isEnabled(): Promise<boolean> {
    const { [STORAGE_KEYS.IsEnabled]: isEnabled } =
      (await browser.storage.sync.get([
        STORAGE_KEYS.IsEnabled,
      ])) as MarkAsReadStorage;

    return isEnabled;
  }

  async #_onBrowserActionClick(
    { id: tabId }: browser.tabs.Tab,
    clickData: Maybe<browser.browserAction.OnClickData>
  ): Promise<void> {
    if (tabId == null || !clickData) {
      throw new MarkAsReadError(CLICK_DATA_UNDEFINED);
    }

    const { modifiers } = clickData;

    const modifier = modifiers[0];
    switch (modifier) {
      case BADGE_CLICK_MODIFIERS.OpenSettings: {
        this.#openSettingsPage();
        break;
      }
      case BADGE_CLICK_MODIFIERS.ToggleEnable: {
        this.#toggleExtensionEnabledState(tabId);
        break;
      }
      default: {
        this.#informContentScriptMarkAsRead(tabId);
        break;
      }
    }
  }

  async #_onMessage(
    message: any,
    { tab }: browser.runtime.MessageSender
  ): Promise<void> {
    if (!tab || tab.id == null) {
      throw new MarkAsReadError(TAB_UNDEFINED);
    }

    if (isObject(message) && "isRead" in message) {
      const { isRead, match }: MarkAsReadMessage = message;

      if (isRead) {
        if (!match) {
          throw new MarkAsReadError(IS_READ_BUT_NO_MATCH);
        }

        await this.#setBadgeToMatched(tab.id, match.datetime);
      } else {
        await this.#setBadgeToNotMatched(tab.id);
      }
    }
  }

  async #_onExtensionInstalled({
    reason,
  }: browser.runtime._OnInstalledDetails): Promise<void> {
    if (reason === "install") {
      await browser.runtime.openOptionsPage();
      await this.#initSettings();
    }
  }

  #openSettingsPage(): void {
    browser.runtime.openOptionsPage();
  }

  async #setBadgeToDisabled(tabId: number): Promise<void> {
    await browser.browserAction.setTitle({
      title: DISABLED_BADGE_MESSAGE,
      tabId: tabId,
    });
    await browser.browserAction.setIcon({
      path: ICON_PATHS.Disabled,
      tabId: tabId,
    });
  }

  async #setBadgeToMatched(
    tabId: number,
    datetimeString: string
  ): Promise<void> {
    const datetime = new Date(Date.parse(datetimeString));
    const formattedDatetime = formatDatetime(datetime);
    const title = formatMessage(READ_BADGE_MESSAGE, formattedDatetime);

    await browser.browserAction.setTitle({ title, tabId: tabId });
    await browser.browserAction.setIcon({
      path: ICON_PATHS.Read,
      tabId: tabId,
    });
  }

  async #setBadgeToNotMatched(tabId: number): Promise<void> {
    await browser.browserAction.setTitle({
      title: PRESS_TO_MARK_AS_READ_BADGE_MESSAGE,
      tabId: tabId,
    });
    await browser.browserAction.setIcon({
      path: ICON_PATHS.Unread,
      tabId: tabId,
    });
  }

  #startBackgroundScript(): void {
    browser.runtime.onMessage.addListener(this.#onMessage);
  }

  #stopBackgroundScript(): void {
    browser.runtime.onMessage.removeListener(this.#onMessage);
  }

  async #toggleExtensionEnabledState(tabId: number): Promise<void> {
    const wasEnabled = await this.#isEnabled();

    await browser.storage.sync.set({ [STORAGE_KEYS.IsEnabled]: !wasEnabled });

    if (wasEnabled) {
      await this.#setBadgeToDisabled(tabId);
      this.#stopBackgroundScript();
    } else {
      this.#startBackgroundScript();
    }
  }
}
