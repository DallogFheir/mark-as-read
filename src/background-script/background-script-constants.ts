import { PLACEHOLDER } from "../common/constants";

export const BADGE_CLICK_MODIFIERS = {
  ToggleEnable: "Ctrl",
  OpenSettings: "Shift",
};

export const CLICK_DATA_UNDEFINED = "Click data is undefined.";
export const TAB_UNDEFINED = "Browser tab is undefined.";

export const IS_READ_BUT_NO_MATCH =
  "Message with 'isRead' set to true but no 'match' property.";

export const ICON_PATHS = {
  Disabled: `icons/disabled.svg`,
  Read: `icons/read.svg`,
  Unread: `icons/unread.svg`,
};

export const PRESS_TO_MARK_AS_READ_BADGE_MESSAGE = "press to mark as read";
export const READ_BADGE_MESSAGE = `marked as read at ${PLACEHOLDER}`;
export const DISABLED_BADGE_MESSAGE = "press while holding Control to enable";
