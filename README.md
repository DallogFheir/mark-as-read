# mark-as-read

<img src="public/icons/disabled.svg" width="15px" /> **Mark as Read** is a simple Firefox extension to mark webpages as read.

It applies CSS style to all links pointing to those webpages so that you know which ones you've already read.

Customization options include:

- CSS style for read links
- URL preprocessor JavaScript function (for example, to ignore search parameters in URLs)

All read webpages can be exported in JSON format, with exact timestamps when they were marked as read.
They can also be imported back.

## Needed permissions

- access to all websites – for the content script to apply CSS to links
- storage – to store settings
- `script-src 'self' 'unsafe-eval'` content security policy – to execute the URL preprocessor

## Changelog

- 1.3 [current]
  - added warning about overwrite on import
  - moved away from synced storage (because of its size limits)
- 1.2
  - fixed settings page opening on browser update
- 1.1
  - fixed default preprocessor breaking on empty URLs
  - fixed mutation observer not working
  - fixed settings resetting on update
- 1.0
