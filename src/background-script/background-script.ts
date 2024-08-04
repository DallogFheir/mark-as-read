import { MarkAsReadBackgroundScript } from "./background-script-class";

const main = (): void => {
  new MarkAsReadBackgroundScript().start();
};

main();
