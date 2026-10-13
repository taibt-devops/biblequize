package com.biblequiz.infrastructure.security;

/**
 * Trang quay về sau đăng nhập Google, chọn theo danh sách cố định: app Đọc hằng ngày ở doc.forbible.org
 * và Làng nhỏ ở forbible.org. Không bao giờ nhận URL từ tham số, để không thành lỗ chuyển hướng mở.
 */
public final class OAuthReturnApp {

    public static final String SESSION_ATTR = "oauth2.returnApp";
    public static final String DOC = "doc";
    public static final String HOME = "home";

    private OAuthReturnApp() {}

    public static boolean isKnown(Object app) {
        return DOC.equals(app) || HOME.equals(app);
    }

    /** {@code doc} → {@code docUrl}, {@code home} → {@code homeUrl} khi đã cấu hình; mọi giá trị khác → {@code frontendUrl}. */
    public static String resolve(Object app, String frontendUrl, String docUrl, String homeUrl) {
        if (DOC.equals(app) && docUrl != null && !docUrl.isBlank()) return docUrl;
        if (HOME.equals(app) && homeUrl != null && !homeUrl.isBlank()) return homeUrl;
        return frontendUrl;
    }
}
