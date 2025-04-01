import { Plugin, showMessage, getFrontend } from "siyuan";
import "@/index.scss";
import { SettingUtils } from "./libs/setting-utils";

const STORAGE_NAME = "menu-config";
let hideTimer = null;
let isScrollBarActive = false;

export default class SiyuanDatabaseLandscape_scrollbar extends Plugin {
  private isMobile: boolean;
  private settingUtils: SettingUtils;



  async onload() {
    this.data[STORAGE_NAME] = { readonlyText: "Readonly" };
    const frontEnd = getFrontend();
    this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";
    this.settingUtils = new SettingUtils({
      plugin: this,
      name: STORAGE_NAME,
    });
    this.settingUtils.addItem({
      key: "begging",
      value: "",
      type: "hint",
      title: this.i18n.beggingTitle,
      description: this.i18n.beggingDesc,
    });
    this.settingUtils.addItem({
      key: "Hint",
      value: "",
      type: "hint",
      title: "About",
      description: "CopyRight and close source by @zxkmm. <br>Source will be avaliable if reached 200 stars. <br><a href='https://github.com/zxkmm/siyuan_database_landscape_scrollbar' target='_blank'>https://github.com/zxkmm/siyuan_database_landscape_scrollbar</a>",
    });
    try {
      this.settingUtils.load();
    } catch (error) {
      console.error(
        "Error loading settings storage, probably empty config json:",
        error
      );
    }
  }

  onLayoutReady() {
    console.log("OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOPS :)");
    this.settingUtils.load();
  }

  async onunload() {
  }

  uninstall() {
  }
}
