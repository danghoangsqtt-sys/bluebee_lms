
import { AppVersionInfo } from "../types";
import packageJson from "../package.json";

/**
 * GITHUB REPOSITORY CONFIGURATION
 * Chỉnh sửa repo tại đây để trỏ đến đúng nguồn dữ liệu package.json
 */
const GITHUB_REPO = "danghoangsqtt-sys/esafe-electro-v3";
const REMOTE_VERSION_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/package.json`;

/**
 * So sánh phiên bản theo chuẩn Semantic Versioning (Major.Minor.Patch)
 * @returns 1 nếu remote > local, -1 nếu remote < local, 0 nếu bằng nhau
 */
const compareVersions = (remote: string, local: string): number => {
  const r = remote.split('.').map(Number);
  const l = local.split('.').map(Number);
  
  // Đảm bảo so sánh đủ 3 thành phần chính
  for (let i = 0; i < 3; i++) {
    const rPart = r[i] || 0;
    const lPart = l[i] || 0;
    if (rPart > lPart) return 1;
    if (rPart < lPart) return -1;
  }
  return 0;
};

/**
 * Kiểm tra xem phiên bản từ xa có mới hơn phiên bản hiện tại không
 */
const isNewerVersion = (remote: string, local: string): boolean => {
  return compareVersions(remote, local) === 1;
};

/**
 * Thực hiện kiểm tra cập nhật từ máy chủ GitHub
 */
export const checkAppUpdate = async (): Promise<AppVersionInfo> => {
  const localVersion = packageJson.version;
  console.debug(`[DHSYSTEM-UPDATE] Khởi chạy kiểm tra cập nhật...`);
  console.debug(`[DHSYSTEM-UPDATE] Local Version: v${localVersion}`);
  
  try {
    // Thêm timestamp để chống cache từ trình duyệt hoặc CDN của GitHub
    const timestamp = new Date().getTime();
    const response = await fetch(`${REMOTE_VERSION_URL}?t=${timestamp}`);
    
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} - Không thể truy cập tệp cấu hình từ xa.`);
    }
    
    const remoteData = await response.json();
    const remoteVersion = remoteData.version;
    
    console.debug(`[DHSYSTEM-UPDATE] Remote Version: v${remoteVersion}`);

    const hasUpdate = isNewerVersion(remoteVersion, localVersion);

    if (hasUpdate) {
      console.log(`[DHSYSTEM-UPDATE] Phát hiện phiên bản mới: v${remoteVersion}`);
    } else {
      console.log(`[DHSYSTEM-UPDATE] Hệ thống đang ở phiên bản mới nhất.`);
    }

    return {
      currentVersion: localVersion,
      latestVersion: remoteVersion,
      // Ưu tiên thông tin từ remote, nếu không có thì lấy giá trị mặc định
      releaseDate: remoteData.releaseDate || new Date().toLocaleDateString('vi-VN'),
      changelog: remoteData.changelog || "Bản cập nhật hệ thống định kỳ nhằm tối ưu hiệu năng và bảo mật.",
      updateUrl: `https://github.com/${GITHUB_REPO}/releases`,
      isUpdateAvailable: hasUpdate
    };
  } catch (error) {
    console.error("[DHSYSTEM-UPDATE] Lỗi khi kiểm tra cập nhật:", error);
    // Trả về trạng thái hiện tại để không làm gián đoạn trải nghiệm người dùng
    return {
      currentVersion: localVersion,
      latestVersion: localVersion,
      releaseDate: "",
      changelog: "",
      updateUrl: "",
      isUpdateAvailable: false
    };
  }
};
