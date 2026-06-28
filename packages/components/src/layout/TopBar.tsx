import { getDesktopApi } from "../services/desktop-api";

const desktopPlatform = getDesktopApi()?.platform?.os;
const reserveOverlayInset =
  desktopPlatform === "win32" || desktopPlatform === "linux";

const TopBar = () => {
  let className = "drag-region h-12 flex items-center px-4 lg:px-6";
  if (reserveOverlayInset) {
    className = `${className} pr-[140px]`;
  }

  return (
    <div
      className={className}
    />
  );
};

export default TopBar;
