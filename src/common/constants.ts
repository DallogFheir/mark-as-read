export const DEFAULT_CSS_STYLE =
  ".mark-as-read-4e3b3eef-af02-4d4a-979d-a6e44b8d7165 {\n  color: green !important;\n  font-weight: bold !important;\n  position: relative !important;\n}\n\n.mark-as-read-4e3b3eef-af02-4d4a-979d-a6e44b8d7165::before {\n  content: '✅';\n  position: absolute;\n  top: -0.5em;\n  right: -0.5em;\n}\n";
export const DEFAULT_URL_PREPROCESSOR =
  "// ignores hash and URL params\n\nconst urlObject = new URL($url);\n\nurlObject.hash = '';\n\nlet params = null;\n// this is a hack to handle a bug in content scripts which causes them to not acknowledge searchParams.keys()\ntry {\n  params = [...urlObject.searchParams.keys()];\n} catch {\n  params = [...urlObject.searchParams];\n}\nparams.forEach((param) => urlObject.searchParams.delete(param));\n\nreturn urlObject.href;\n";

export const MARK_AS_READ_CSS_CLASS =
  "mark-as-read-4e3b3eef-af02-4d4a-979d-a6e44b8d7165";

export const PLACEHOLDER = "{}";

export const STORAGE_KEYS = {
  CssStyle: "cssStyle",
  ReadPages: "readPages",
  UrlPreprocessor: "urlPreprocessor",
} as const;

export const URL_PREPROCESSOR_ARGUMENT_NAME = "$url";
