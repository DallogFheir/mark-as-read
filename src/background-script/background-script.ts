import {
  DEFAULT_CSS_STYLE,
  DEFAULT_URL_PREPROCESSOR,
  STORAGE_KEYS,
} from "../common/constants";
import type { MarkAsReadMessage, Maybe } from "../common/types";
import { formatDatetime } from "../common/utils/datetime";
import { formatMessage } from "../common/utils/messages";
import { isObject } from "../common/utils/validators";
import { MarkAsReadError } from "../content-script/errors";
import {
  CLICK_DATA_UNDEFINED,
  ICON_PATHS,
  IS_READ_BUT_NO_MATCH,
  PRESS_TO_MARK_AS_READ_BADGE_MESSAGE,
  READ_BADGE_MESSAGE,
  TAB_UNDEFINED,
} from "./background-script-constants";

class BackgroundScript {
  start(): void {
    browser.runtime.onInstalled.addListener(() => this.#initSettings());
    browser.runtime.onMessage.addListener((message, { tab }) =>
      this.#onMessage(message, tab)
    );
    browser.browserAction.onClicked.addListener((tabs, clickData) =>
      this.#onBrowserActionClick(tabs, clickData)
    );
  }

  #getIconData(iconPath: string): { [key: number]: string } {
    const sizes = [16, 32];

    const paths = Object.fromEntries(
      sizes.map((size) => [size, formatMessage(iconPath, String(size))])
    );

    return paths;
  }

  async #initSettings(): Promise<void> {
    await browser.storage.sync.set({
      [STORAGE_KEYS.CssStyle]: DEFAULT_CSS_STYLE,
      [STORAGE_KEYS.ReadPages]: [],
      [STORAGE_KEYS.UrlPreprocessor]: DEFAULT_URL_PREPROCESSOR,
    });
  }

  async #onBrowserActionClick(
    { id: tabId }: browser.tabs.Tab,
    clickData: Maybe<browser.browserAction.OnClickData>
  ): Promise<void> {
    if (tabId == null || !clickData) {
      throw new MarkAsReadError(CLICK_DATA_UNDEFINED);
    }

    const { modifiers } = clickData;
    // TODO disable extension on ctrl click

    await browser.tabs.sendMessage(tabId, null);
  }

  async #onMessage(message: any, tab: Maybe<browser.tabs.Tab>): Promise<void> {
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

  async #setBadgeToMatched(
    tabId: number,
    datetimeString: string
  ): Promise<void> {
    const datetime = new Date(Date.parse(datetimeString));
    const formattedDatetime = formatDatetime(datetime);
    const title = formatMessage(READ_BADGE_MESSAGE, formattedDatetime);

    await browser.browserAction.setTitle({ title, tabId: tabId });
    await browser.browserAction.setIcon({
      path: this.#getIconData(ICON_PATHS.Read),
      tabId: tabId,
    });
  }

  async #setBadgeToNotMatched(tabId: number): Promise<void> {
    await browser.browserAction.setTitle({
      title: PRESS_TO_MARK_AS_READ_BADGE_MESSAGE,
      tabId: tabId,
    });
    await browser.browserAction.setIcon({
      path: this.#getIconData(ICON_PATHS.Unread),
      tabId: tabId,
    });
  }
}

new BackgroundScript().start();
