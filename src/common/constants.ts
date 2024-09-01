export const DEFAULT_CSS_STYLE =
  ".mark-as-read-4e3b3eef-af02-4d4a-979d-a6e44b8d7165 {\n  color: green !important;\n  font-weight: bold !important;\n  position: relative !important;\n}\n\n.mark-as-read-4e3b3eef-af02-4d4a-979d-a6e44b8d7165::before {\n  content: '✅';\n}\n";
export const DEFAULT_URL_PREPROCESSOR =
  "// ignores URL params\n\ntry {\n  const urlObject = new URL($url);\n\n  // this is a hack to handle a bug in content scripts which causes them to not acknowledge searchParams.keys()\n  const params = [\n    ...(urlObject.searchParams.keys !== undefined\n      ? urlObject.searchParams.keys()\n      : urlObject.searchParams),\n  ];\n  params.forEach((param) => urlObject.searchParams.delete(param));\n\n  return urlObject.href;\n} catch {\n  return $url;\n}\n";

export const MARK_AS_READ_CSS_CLASS =
  "mark-as-read-4e3b3eef-af02-4d4a-979d-a6e44b8d7165";

export const PLACEHOLDER = "{}";

export const STORAGE_KEYS = {
  CssStyle: "cssStyle",
  IsEnabled: "isEnabled",
  ReadPages: "readPages",
  UrlPreprocessor: "urlPreprocessor",
} as const;

export const URL_PREPROCESSOR_ARGUMENT_NAME = "$url";
