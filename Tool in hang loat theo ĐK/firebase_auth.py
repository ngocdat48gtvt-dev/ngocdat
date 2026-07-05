"""Đăng nhập Firebase + license + giới hạn thiết bị (cùng project Quản lý sự cố)."""

from __future__ import annotations

import hashlib
import json
import os
import platform
import subprocess
import sys
import time
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any, Optional

import requests
from PyQt5.QtCore import Qt, QSettings, QThread, pyqtSignal
from PyQt5.QtGui import QIcon
from PyQt5.QtWidgets import (
    QDialog,
    QFormLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMessageBox,
    QPushButton,
    QVBoxLayout,
)

APP_ID = "print_control"
APP_TITLE = "Print QLCL"
SETTINGS_ORG = "QLDTool"
SETTINGS_APP = "PrintControlPRO"
SERVER_REVERIFY_HOURS = 2
PLATFORM_NAME = "windows"


def resource_path(rel: str) -> str:
    if getattr(sys, "frozen", False):
        return os.path.join(sys._MEIPASS, rel)
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), rel)


def apply_app_icon(widget) -> None:
    icon_path = resource_path("printer_icon.ico")
    if os.path.exists(icon_path):
        widget.setWindowIcon(QIcon(icon_path))


def load_firebase_config() -> dict:
    path = resource_path("firebase_config.json")
    if not os.path.exists(path):
        raise FileNotFoundError(
            "Thiếu file firebase_config.json — sao chép từ firebase_config.example.json."
        )
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


LOGIN_STYLESHEET = """
QDialog {
    background-color: #f4f6f9;
    color: #1a2332;
    font-family: "Segoe UI", sans-serif;
    font-size: 13px;
}
QLineEdit {
    background: #ffffff;
    border: 1px solid #c5cdd8;
    border-radius: 6px;
    padding: 8px 10px;
    min-height: 22px;
}
QLineEdit:focus { border-color: #1976d2; }
QPushButton {
    background-color: #1976d2;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 10px 16px;
    font-weight: 600;
}
QPushButton:hover { background-color: #1565c0; }
QPushButton:disabled { background-color: #b0bec5; color: #eceff1; }
QPushButton#btnSecondary {
    background-color: #eceff1;
    color: #37474f;
    border: 1px solid #cfd8dc;
}
QPushButton#btnSecondary:hover { background-color: #dfe6eb; }
QLabel#titleLabel {
    color: #0d47a1;
    font-size: 20px;
    font-weight: 700;
}
QLabel#hintLabel {
    color: #546e7a;
    font-size: 12px;
}
QLabel#errorLabel {
    color: #c62828;
    font-size: 12px;
}
"""


@dataclass
class DeviceInfo:
    device_id: str
    device_name: str
    session_id: str = ""


@dataclass
class AuthSession:
    uid: str
    email: str
    id_token: str
    refresh_token: str
    name: str
    expire_date: str
    allowed_apps: list
    device_id: str = ""
    session_id: str = ""


class FirebaseAuthError(Exception):
    pass


class DeviceLimitError(FirebaseAuthError):
    """Vượt maxDevices — cần gỡ thiết bị cũ."""

    def __init__(
        self,
        max_devices: int,
        blocked_devices: list[DeviceInfo],
        uid: str,
        id_token: str,
        refresh_token: str,
        email: str,
        user_doc: dict,
    ):
        self.max_devices = max_devices
        self.blocked_devices = blocked_devices
        self.uid = uid
        self.id_token = id_token
        self.refresh_token = refresh_token
        self.email = email
        self.user_doc = user_doc
        names = ", ".join(d.device_name for d in blocked_devices[:2]) or "máy khác"
        super().__init__(
            "Tài khoản đã được gắn với thiết bị đầu tiên đăng nhập.\n\n"
            f"Thiết bị hiện tại: {names}\n\n"
            "Không thể tự chuyển sang máy khác.\n"
            "Vui lòng liên hệ nhà cung cấp để reset thiết bị."
        )


class FirebaseAuthClient:
    def __init__(self, config: Optional[dict] = None):
        self.config = config or load_firebase_config()
        self.api_key = self.config["apiKey"]
        self.project_id = self.config["projectId"]
        self._settings = QSettings(SETTINGS_ORG, SETTINGS_APP)

    # ── Device identity ──────────────────────────────────────────────

    def get_device_id(self) -> str:
        saved = self._settings.value("device/id", "", type=str)
        if saved:
            return saved
        raw = f"{platform.node().upper()}#{_get_disk_serial()}"
        device_id = hashlib.sha256(raw.encode()).hexdigest()[:32]
        self._settings.setValue("device/id", device_id)
        self._settings.sync()
        return device_id

    def get_device_name(self) -> str:
        name = platform.node().strip()
        return name or "Windows PC"

    def get_local_session_id(self) -> str:
        return self._settings.value("auth/session_id", "", type=str)

    # ── Firebase Auth ────────────────────────────────────────────────

    def sign_in(self, email: str, password: str) -> dict:
        url = (
            "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword"
            f"?key={self.api_key}"
        )
        resp = requests.post(
            url,
            json={
                "email": email.strip(),
                "password": password,
                "returnSecureToken": True,
            },
            timeout=30,
        )
        data = resp.json()
        if resp.status_code != 200:
            msg = data.get("error", {}).get("message", "Đăng nhập thất bại")
            raise FirebaseAuthError(_map_auth_error(msg))
        return data

    def refresh_id_token(self, refresh_token: str) -> dict:
        url = f"https://securetoken.googleapis.com/v1/token?key={self.api_key}"
        resp = requests.post(
            url,
            data={"grant_type": "refresh_token", "refresh_token": refresh_token},
            timeout=30,
        )
        data = resp.json()
        if resp.status_code != 200:
            raise FirebaseAuthError("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.")
        return data

    def send_password_reset(self, email: str) -> None:
        url = (
            "https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode"
            f"?key={self.api_key}"
        )
        resp = requests.post(
            url,
            json={"requestType": "PASSWORD_RESET", "email": email.strip()},
            timeout=30,
        )
        if resp.status_code != 200:
            data = resp.json()
            msg = data.get("error", {}).get("message", "Không gửi được email reset")
            raise FirebaseAuthError(_map_auth_error(msg))

    # ── Firestore ────────────────────────────────────────────────────

    def _user_doc_url(self, uid: str) -> str:
        return (
            "https://firestore.googleapis.com/v1/projects/"
            f"{self.project_id}/databases/(default)/documents/users/{uid}"
        )

    def fetch_user_license(self, uid: str, id_token: str) -> dict:
        resp = requests.get(
            self._user_doc_url(uid),
            headers={"Authorization": f"Bearer {id_token}"},
            timeout=30,
        )
        if resp.status_code == 404:
            raise FirebaseAuthError(
                "Tài khoản chưa được cấp quyền. Vui lòng liên hệ quản trị viên."
            )
        if resp.status_code != 200:
            raise FirebaseAuthError(
                "Không kiểm tra được license trên server. Thử lại khi có mạng."
            )
        return _firestore_doc_to_dict(resp.json())

    def patch_user_fields(self, uid: str, id_token: str, fields: dict) -> None:
        mask = "&".join(
            f"updateMask.fieldPaths={key}" for key in fields.keys()
        )
        url = f"{self._user_doc_url(uid)}?{mask}"
        body = {
            "fields": {k: _encode_firestore_value(v) for k, v in fields.items()}
        }
        resp = requests.patch(
            url,
            headers={"Authorization": f"Bearer {id_token}"},
            json=body,
            timeout=30,
        )
        if resp.status_code != 200:
            detail = resp.text[:300]
            if resp.status_code == 403:
                raise FirebaseAuthError(
                    "Firestore từ chối ghi thiết bị.\n"
                    "Kiểm tra Firestore Rules (cho phép sessionId + activeDevices)."
                )
            raise FirebaseAuthError(
                f"Không đăng ký được thiết bị ({resp.status_code}): {detail}"
            )

    # ── License ──────────────────────────────────────────────────────

    def validate_license(self, uid: str, user_doc: dict) -> None:
        if user_doc.get("active") is not True:
            raise FirebaseAuthError(
                "Tài khoản bị khóa. Vui lòng liên hệ quản trị viên."
            )
        expire_date = user_doc.get("expireDate") or ""
        if not expire_date:
            raise FirebaseAuthError(
                "Thiếu ngày hết hạn. Vui lòng liên hệ quản trị viên."
            )
        if _is_expired(expire_date):
            raise FirebaseAuthError(
                "Tài khoản đã hết hạn. Vui lòng liên hệ quản trị viên."
            )
        allowed_apps = _normalize_allowed_apps(user_doc)
        if APP_ID not in allowed_apps:
            apps_text = ", ".join(allowed_apps) if allowed_apps else "chưa cấp app nào"
            raise FirebaseAuthError(
                f"Tài khoản không có quyền dùng {APP_TITLE}.\n\n"
                f"App được phép: {apps_text}\n"
                f"Liên hệ quản trị viên để thêm \"{APP_ID}\" vào allowedApps."
            )

    def _is_device_session_valid(
        self, user_doc: dict, device_id: str, local_session_id: str
    ) -> bool:
        if not local_session_id:
            return False
        active = user_doc.get("activeDevices")
        if not isinstance(active, dict) or not active:
            legacy = str(user_doc.get("sessionId") or "")
            return bool(legacy) and legacy == local_session_id
        entry = active.get(device_id)
        if not isinstance(entry, dict):
            return False
        return str(entry.get("sessionId") or "") == local_session_id

    def _build_register_devices(
        self,
        user_doc: dict,
        device_id: str,
        session_id: str,
    ) -> tuple[dict, list[DeviceInfo], int]:
        max_devices = 1
        raw = user_doc.get("activeDevices")
        devices: dict[str, dict] = dict(raw) if isinstance(raw, dict) else {}

        device_name = self.get_device_name()
        _prune_same_machine(devices, device_id, device_name, PLATFORM_NAME)
        entry = _device_entry(session_id, device_name)

        if device_id in devices:
            devices[device_id] = entry
            return devices, [], max_devices

        if len(devices) < max_devices:
            devices[device_id] = entry
            return devices, [], max_devices

        blocked = [
            DeviceInfo(
                did,
                str((data or {}).get("deviceName") or "Thiết bị"),
                str((data or {}).get("sessionId") or ""),
            )
            for did, data in devices.items()
            if did != device_id
        ]
        if not blocked:
            blocked = [
                DeviceInfo(
                    did,
                    str((data or {}).get("deviceName") or "Thiết bị"),
                    str((data or {}).get("sessionId") or ""),
                )
                for did, data in devices.items()
            ]
        return devices, blocked, max_devices

    def register_device(
        self,
        uid: str,
        id_token: str,
        user_doc: dict,
    ) -> str:
        device_id = self.get_device_id()
        session_id = str(int(time.time() * 1000))
        devices, blocked, max_devices = self._build_register_devices(
            user_doc, device_id, session_id
        )

        if blocked:
            raise DeviceLimitError(
                max_devices=max_devices,
                blocked_devices=blocked,
                uid=uid,
                id_token=id_token,
                refresh_token="",
                email="",
                user_doc=user_doc,
            )

        self.patch_user_fields(
            uid,
            id_token,
            {"activeDevices": devices, "sessionId": session_id},
        )
        return session_id

    def _make_session(
        self,
        uid: str,
        email: str,
        id_token: str,
        refresh_token: str,
        user_doc: dict,
        session_id: str,
    ) -> AuthSession:
        return AuthSession(
            uid=uid,
            email=email,
            id_token=id_token,
            refresh_token=refresh_token,
            name=str(user_doc.get("name") or ""),
            expire_date=str(user_doc.get("expireDate") or ""),
            allowed_apps=_normalize_allowed_apps(user_doc),
            device_id=self.get_device_id(),
            session_id=session_id,
        )

    def login(
        self,
        email: str,
        password: str,
    ) -> AuthSession:
        auth_data = self.sign_in(email, password)
        uid = auth_data["localId"]
        id_token = auth_data["idToken"]
        refresh_token = auth_data["refreshToken"]
        user_doc = self.fetch_user_license(uid, id_token)
        self.validate_license(uid, user_doc)

        try:
            session_id = self.register_device(uid, id_token, user_doc)
        except DeviceLimitError as err:
            err.refresh_token = refresh_token
            err.email = auth_data.get("email", email.strip().lower())
            raise

        session = self._make_session(
            uid,
            auth_data.get("email", email.strip().lower()),
            id_token,
            refresh_token,
            user_doc,
            session_id,
        )
        self.save_session_cache(session)
        return session

    def _session_from_cache(
        self,
        cached: dict,
        *,
        id_token: Optional[str] = None,
        refresh_token: Optional[str] = None,
        session_id: Optional[str] = None,
    ) -> AuthSession:
        device_id = cached.get("device_id", "") or self.get_device_id()
        return AuthSession(
            uid=cached["uid"],
            email=cached.get("email", ""),
            id_token=id_token if id_token is not None else cached.get("id_token", ""),
            refresh_token=(
                refresh_token
                if refresh_token is not None
                else cached.get("refresh_token", "")
            ),
            name=cached.get("name", ""),
            expire_date=cached.get("expireDate", ""),
            allowed_apps=_normalize_allowed_apps(cached),
            device_id=device_id,
            session_id=session_id if session_id is not None else cached.get("session_id", ""),
        )

    def _refresh_tokens_if_needed(
        self, cached: dict
    ) -> tuple[str, str]:
        id_token = cached.get("id_token", "")
        refresh_token = cached.get("refresh_token", "")
        if not refresh_token:
            return id_token, refresh_token
        try:
            refreshed = self.refresh_id_token(refresh_token)
            return (
                refreshed.get("id_token", id_token),
                refreshed.get("refresh_token", refresh_token),
            )
        except FirebaseAuthError:
            return id_token, refresh_token

    def try_restore_session(self) -> Optional[AuthSession]:
        """Cùng máy: tự vào lại từ cache; chỉ gọi server sau SERVER_REVERIFY_HOURS."""
        cached = self.load_session_cache()
        if not cached:
            return None

        uid = cached.get("uid", "")
        device_id = cached.get("device_id", "") or self.get_device_id()
        local_session = cached.get("session_id", "")
        if not uid or not local_session:
            return None

        try:
            self.validate_license(uid, cached)
        except FirebaseAuthError:
            self.clear_session_cache()
            return None

        last_verify_ms = int(cached.get("last_verify_ms", 0) or 0)
        if _within_reverify_window(last_verify_ms):
            session = self._session_from_cache(cached)
            return session

        id_token, refresh_token = self._refresh_tokens_if_needed(cached)
        if not id_token and not refresh_token:
            return None

        session_id = local_session
        server_verified = False
        try:
            if not id_token:
                raise FirebaseAuthError("Thiếu token đăng nhập.")
            user_doc = self.fetch_user_license(uid, id_token)
            self.validate_license(uid, user_doc)
            if not self._is_device_session_valid(user_doc, device_id, local_session):
                self.clear_session_cache()
                return None
            session_id = self.register_device(uid, id_token, user_doc)
            server_verified = True
        except (FirebaseAuthError, requests.RequestException):
            session = self._session_from_cache(
                cached,
                id_token=id_token,
                refresh_token=refresh_token,
                session_id=session_id,
            )
            return session

        session = self._session_from_cache(
            cached,
            id_token=id_token,
            refresh_token=refresh_token,
            session_id=session_id,
        )
        if server_verified:
            self.save_session_cache(session)
        return session

    def logout_remote(self, uid: str, id_token: str) -> None:
        device_id = self.get_device_id()
        try:
            user_doc = self.fetch_user_license(uid, id_token)
            raw = user_doc.get("activeDevices")
            devices = dict(raw) if isinstance(raw, dict) else {}
            if device_id in devices:
                del devices[device_id]
                self.patch_user_fields(uid, id_token, {"activeDevices": devices})
        except Exception:
            pass
        self.clear_session_cache()

    # ── Local cache ────────────────────────────────────────────────────

    def save_session_cache(self, session: AuthSession) -> None:
        self._settings.setValue("auth/uid", session.uid)
        self._settings.setValue("auth/email", session.email)
        self._settings.setValue("auth/id_token", session.id_token)
        self._settings.setValue("auth/refresh_token", session.refresh_token)
        self._settings.setValue("auth/name", session.name)
        self._settings.setValue("auth/expireDate", session.expire_date)
        self._settings.setValue("auth/active", True)
        self._settings.setValue("auth/device_id", session.device_id)
        self._settings.setValue("auth/session_id", session.session_id)
        self._settings.setValue(
            "auth/allowedApps",
            json.dumps(session.allowed_apps, ensure_ascii=False),
        )
        self._settings.setValue(
            "auth/last_verify_ms", int(datetime.now().timestamp() * 1000)
        )
        self._settings.sync()

    def load_session_cache(self) -> Optional[dict]:
        uid = self._settings.value("auth/uid", "", type=str)
        if not uid:
            return None
        allowed_raw = self._settings.value("auth/allowedApps", "[]", type=str)
        try:
            allowed_apps = json.loads(allowed_raw)
        except json.JSONDecodeError:
            allowed_apps = []
        return {
            "uid": uid,
            "email": self._settings.value("auth/email", "", type=str),
            "id_token": self._settings.value("auth/id_token", "", type=str),
            "refresh_token": self._settings.value("auth/refresh_token", "", type=str),
            "name": self._settings.value("auth/name", "", type=str),
            "expireDate": self._settings.value("auth/expireDate", "", type=str),
            "active": self._settings.value("auth/active", False, type=bool),
            "device_id": self._settings.value("auth/device_id", "", type=str),
            "session_id": self._settings.value("auth/session_id", "", type=str),
            "allowedApps": allowed_apps,
            "last_verify_ms": int(
                self._settings.value("auth/last_verify_ms", 0, type=int) or 0
            ),
        }

    def clear_session_cache(self) -> None:
        for key in (
            "auth/uid",
            "auth/email",
            "auth/id_token",
            "auth/refresh_token",
            "auth/name",
            "auth/expireDate",
            "auth/active",
            "auth/allowedApps",
            "auth/device_id",
            "auth/session_id",
            "auth/last_verify_ms",
        ):
            self._settings.remove(key)
        self._settings.sync()


# ── Firestore helpers ────────────────────────────────────────────────


def _get_disk_serial() -> str:
    try:
        out = subprocess.check_output("vol C:", shell=True).decode(errors="ignore")
        for line in out.splitlines():
            if "Serial Number" in line:
                return line.split("Serial Number is")[-1].strip().replace("-", "")
    except Exception:
        pass
    return "NA"


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000000Z")


def _prune_same_machine(
    devices: dict[str, dict],
    keep_device_id: str,
    device_name: str,
    platform: str,
) -> None:
    """Gỡ bản ghi cũ cùng tên máy — 1 máy không chiếm nhiều slot."""
    name_key = device_name.strip().casefold()
    if not name_key:
        return
    stale = [
        did
        for did, data in devices.items()
        if did != keep_device_id
        and str((data or {}).get("deviceName", "")).strip().casefold() == name_key
        and str((data or {}).get("platform") or platform) == platform
    ]
    for did in stale:
        devices.pop(did, None)


def _device_entry(session_id: str, device_name: str) -> dict:
    return {
        "sessionId": session_id,
        "deviceName": device_name,
        "platform": PLATFORM_NAME,
        "lastLoginAt": _now_iso(),
    }


def _encode_firestore_value(value: Any) -> dict:
    if value is None:
        return {"nullValue": None}
    if isinstance(value, bool):
        return {"booleanValue": value}
    if isinstance(value, int):
        return {"integerValue": str(value)}
    if isinstance(value, float):
        return {"doubleValue": value}
    if isinstance(value, str):
        if _looks_like_timestamp(value):
            return {"timestampValue": value}
        return {"stringValue": value}
    if isinstance(value, list):
        return {
            "arrayValue": {
                "values": [_encode_firestore_value(v) for v in value]
            }
        }
    if isinstance(value, dict):
        return {
            "mapValue": {
                "fields": {k: _encode_firestore_value(v) for k, v in value.items()}
            }
        }
    return {"stringValue": str(value)}


def _looks_like_timestamp(s: str) -> bool:
    return len(s) >= 20 and s[4] == "-" and "T" in s


def _firestore_doc_to_dict(doc: dict) -> dict:
    fields = doc.get("fields", {})
    return {k: _decode_firestore_value(v) for k, v in fields.items()}


def _decode_firestore_value(value: dict):
    if "stringValue" in value:
        return value["stringValue"]
    if "booleanValue" in value:
        return value["booleanValue"]
    if "integerValue" in value:
        return int(value["integerValue"])
    if "doubleValue" in value:
        return float(value["doubleValue"])
    if "timestampValue" in value:
        return value["timestampValue"]
    if "arrayValue" in value:
        values = value["arrayValue"].get("values", [])
        return [_decode_firestore_value(v) for v in values]
    if "mapValue" in value:
        fields = value["mapValue"].get("fields", {})
        return {k: _decode_firestore_value(v) for k, v in fields.items()}
    if "nullValue" in value:
        return None
    return None


def _normalize_allowed_apps(user_doc: dict) -> list:
    apps = user_doc.get("allowedApps")
    if isinstance(apps, list):
        return [str(a).strip() for a in apps if str(a).strip()]
    legacy = user_doc.get("productId")
    if isinstance(legacy, str) and legacy.strip():
        return [legacy.strip()]
    return []


def _is_expired(expire_date: str) -> bool:
    try:
        exp = date.fromisoformat(expire_date)
    except ValueError:
        return True
    return date.today() > exp


def _within_reverify_window(last_verify_ms: int) -> bool:
    if last_verify_ms <= 0:
        return False
    elapsed_ms = int(datetime.now().timestamp() * 1000) - last_verify_ms
    return elapsed_ms < SERVER_REVERIFY_HOURS * 60 * 60 * 1000


def _map_auth_error(code: str) -> str:
    mapping = {
        "EMAIL_NOT_FOUND": "Email chưa đăng ký trên hệ thống.",
        "INVALID_PASSWORD": "Mật khẩu không đúng.",
        "INVALID_LOGIN_CREDENTIALS": "Email hoặc mật khẩu không đúng.",
        "USER_DISABLED": "Tài khoản bị vô hiệu hóa.",
        "TOO_MANY_ATTEMPTS_TRY_LATER": "Thử quá nhiều lần. Đợi vài phút rồi thử lại.",
        "INVALID_EMAIL": "Email không hợp lệ.",
    }
    return mapping.get(code, f"Lỗi đăng nhập: {code}")


# ── UI ───────────────────────────────────────────────────────────────


class _LoginWorker(QThread):
    finished_ok = pyqtSignal(object)
    finished_err = pyqtSignal(str)
    finished_device_limit = pyqtSignal(object)

    def __init__(self, client: FirebaseAuthClient, email: str, password: str):
        super().__init__()
        self.client = client
        self.email = email
        self.password = password

    def run(self):
        try:
            session = self.client.login(self.email, self.password)
            self.finished_ok.emit(session)
        except DeviceLimitError as exc:
            self.finished_device_limit.emit(exc)
        except Exception as exc:
            self.finished_err.emit(str(exc))


class LoginDialog(QDialog):
    def __init__(self, client: Optional[FirebaseAuthClient] = None, parent=None):
        super().__init__(parent)
        self.client = client or FirebaseAuthClient()
        self.session: Optional[AuthSession] = None
        self._worker: Optional[_LoginWorker] = None
        self._pending_limit: Optional[DeviceLimitError] = None
        self.setWindowTitle(f"Đăng nhập — {APP_TITLE}")
        self.setModal(True)
        self.setMinimumWidth(420)
        self.setStyleSheet(LOGIN_STYLESHEET)
        apply_app_icon(self)
        self._build_ui()

    def _build_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(28, 24, 28, 24)
        layout.setSpacing(12)

        title = QLabel(APP_TITLE)
        title.setObjectName("titleLabel")
        title.setAlignment(Qt.AlignCenter)
        layout.addWidget(title)

        subtitle = QLabel(
            "Đăng nhập bằng tài khoản Firebase.\n"
            "Mỗi tài khoản chỉ gắn 1 máy — đổi máy cần liên hệ nhà cung cấp reset."
        )
        subtitle.setObjectName("hintLabel")
        subtitle.setAlignment(Qt.AlignCenter)
        subtitle.setWordWrap(True)
        layout.addWidget(subtitle)

        form = QFormLayout()
        self.txt_email = QLineEdit()
        self.txt_email.setPlaceholderText("email@gmail.com")
        self.txt_pass = QLineEdit()
        self.txt_pass.setEchoMode(QLineEdit.Password)
        self.txt_pass.setPlaceholderText("Mật khẩu")
        self.txt_pass.returnPressed.connect(self._on_login)
        form.addRow("Email", self.txt_email)
        form.addRow("Mật khẩu", self.txt_pass)
        layout.addLayout(form)

        self.lbl_error = QLabel("")
        self.lbl_error.setObjectName("errorLabel")
        self.lbl_error.setWordWrap(True)
        self.lbl_error.hide()
        layout.addWidget(self.lbl_error)

        btn_row = QHBoxLayout()
        self.btn_login = QPushButton("Đăng nhập")
        self.btn_login.clicked.connect(self._on_login)
        self.btn_cancel = QPushButton("Thoát")
        self.btn_cancel.setObjectName("btnSecondary")
        self.btn_cancel.clicked.connect(self.reject)
        btn_row.addWidget(self.btn_login)
        btn_row.addWidget(self.btn_cancel)
        layout.addLayout(btn_row)

        self.btn_forgot = QPushButton("Quên mật khẩu?")
        self.btn_forgot.setObjectName("btnSecondary")
        self.btn_forgot.setFlat(True)
        self.btn_forgot.clicked.connect(self._on_forgot_password)
        layout.addWidget(self.btn_forgot, alignment=Qt.AlignCenter)

        cached = self.client.load_session_cache()
        if cached and cached.get("email"):
            self.txt_email.setText(cached["email"])

    def _set_busy(self, busy: bool, message: str = ""):
        self.btn_login.setEnabled(not busy)
        self.btn_cancel.setEnabled(not busy)
        self.btn_forgot.setEnabled(not busy)
        self.txt_email.setEnabled(not busy)
        self.txt_pass.setEnabled(not busy)
        if message:
            self.lbl_error.setText(message)
            self.lbl_error.show()
        elif not busy:
            self.lbl_error.hide()

    def _start_login_worker(self):
        email = self.txt_email.text().strip()
        password = self.txt_pass.text()
        self._worker = _LoginWorker(self.client, email, password)
        self._worker.finished_ok.connect(self._on_login_ok)
        self._worker.finished_err.connect(self._on_login_err)
        self._worker.finished_device_limit.connect(self._on_device_limit)
        self._worker.start()

    def _on_login(self):
        email = self.txt_email.text().strip()
        password = self.txt_pass.text()
        if not email or not password:
            self._set_busy(False, "Nhập đầy đủ email và mật khẩu.")
            return
        self._set_busy(True, "Đang đăng nhập & kiểm tra thiết bị...")
        self._start_login_worker()

    def _on_login_ok(self, session: AuthSession):
        self.session = session
        self.accept()

    def _on_login_err(self, message: str):
        self._set_busy(False, message)

    def _on_device_limit(self, err: DeviceLimitError):
        self._set_busy(False)
        QMessageBox.warning(self, "Thiết bị đã được gắn", str(err))
        self.lbl_error.setText(str(err))
        self.lbl_error.show()

    def _on_forgot_password(self):
        email = self.txt_email.text().strip()
        if not email:
            QMessageBox.warning(self, "Quên mật khẩu", "Nhập email trước.")
            return
        try:
            self.client.send_password_reset(email)
            QMessageBox.information(
                self,
                "Đã gửi email",
                "Link đặt lại mật khẩu đã gửi về email của bạn.",
            )
        except FirebaseAuthError as exc:
            QMessageBox.warning(self, "Lỗi", str(exc))


def require_login(parent=None) -> Optional[AuthSession]:
    """Hiện form đăng nhập; trả về session hoặc None nếu user thoát."""
    client = FirebaseAuthClient()
    cached = client.try_restore_session()
    if cached:
        return cached
    dialog = LoginDialog(client=client, parent=parent)
    if dialog.exec_() == QDialog.Accepted and dialog.session:
        return dialog.session
    return None


def logout() -> None:
    client = FirebaseAuthClient()
    cached = client.load_session_cache()
    if cached and cached.get("uid") and cached.get("id_token"):
        client.logout_remote(cached["uid"], cached["id_token"])
    else:
        client.clear_session_cache()
