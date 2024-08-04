import { MarkAsReadContentScript } from "./content-script-class";

const main = (): void => {
  new MarkAsReadContentScript().start();
};

main();
