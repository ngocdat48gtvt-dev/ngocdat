import sys
import os
import json
import time
import traceback
import xlwings as xw
import win32print
import win32gui
import win32con
import win32api
from PyQt5.QtWidgets import *
from PyQt5.QtCore import Qt, QEvent, QSettings, QRect, QEventLoop
from PyPDF2 import PdfMerger
from PyQt5.QtGui import QIcon, QFont, QColor
import tempfile
from PyQt5.QtWidgets import QLabel
from PyQt5.QtWidgets import QGridLayout
from firebase_auth import require_login
SETTINGS_ORG = "QLDTool"
SETTINGS_APP = "PrintControlPRO"
MAPPING_ROW_HEIGHT = 28

def app_dir():
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


def resource_path(rel):
    if getattr(sys, "frozen", False):
        bundled = os.path.join(sys._MEIPASS, rel)
        if os.path.exists(bundled):
            return bundled
    return os.path.join(app_dir(), rel)


ICON_APP = resource_path("printer_icon.ico")
CONFIG_FILE = os.path.join(app_dir(), "print_config.json")

APP_STYLESHEET = """
QMainWindow, QWidget {
    background-color: #f4f6f9;
    color: #1a2332;
    font-family: "Segoe UI", "Microsoft YaHei UI", sans-serif;
    font-size: 12px;
}
QGroupBox {
    background-color: #ffffff;
    border: 1px solid #d8dee9;
    border-radius: 8px;
    margin-top: 10px;
    padding: 14px 8px 6px 8px;
    font-weight: 600;
}
QGroupBox::title {
    subcontrol-origin: margin;
    subcontrol-position: top left;
    left: 10px;
    top: 1px;
    padding: 0 4px;
    color: #1565c0;
    background-color: #ffffff;
}
QLineEdit, QComboBox {
    background: #ffffff;
    border: 1px solid #c5cdd8;
    border-radius: 4px;
    padding: 2px 6px;
    min-height: 22px;
    max-height: 26px;
}
QLineEdit:focus, QComboBox:focus {
    border-color: #1976d2;
}
QPushButton {
    background-color: #1976d2;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 3px 10px;
    min-height: 24px;
    max-height: 28px;
    font-weight: 600;
    font-size: 12px;
}
QPushButton:hover { background-color: #1565c0; }
QPushButton:pressed { background-color: #0d47a1; }
QPushButton:disabled {
    background-color: #b0bec5;
    color: #eceff1;
}
QPushButton#btnDanger {
    background-color: #e53935;
}
QPushButton#btnDanger:hover { background-color: #c62828; }
QPushButton#btnSecondary {
    background-color: #eceff1;
    color: #37474f;
    border: 1px solid #cfd8dc;
}
QPushButton#btnSecondary:hover { background-color: #dfe6eb; }
QRadioButton, QCheckBox { spacing: 4px; }
QTableWidget {
    background: #ffffff;
    border: 1px solid #d8dee9;
    border-radius: 6px;
    gridline-color: #e8ecf1;
}
QHeaderView::section {
    background-color: #e3f2fd;
    color: #0d47a1;
    font-weight: 600;
    padding: 4px 6px;
    border: none;
    border-bottom: 2px solid #90caf9;
}
QProgressBar {
    border: 1px solid #cfd8dc;
    border-radius: 4px;
    text-align: center;
    background: #eceff1;
    max-height: 18px;
}
QProgressBar::chunk {
    background-color: #42a5f5;
    border-radius: 3px;
}
QLabel#bannerWorkbook {
    background-color: #e3f2fd;
    color: #0d47a1;
    padding: 5px 10px;
    border-radius: 6px;
    font-weight: 600;
    border: 1px solid #bbdefb;
}
QLabel#hintLabel {
    color: #546e7a;
    font-size: 11px;
    padding: 0 2px 2px 2px;
}
QLabel#sectionTitle {
    background-color: #1976d2;
    color: white;
    font-weight: 600;
    padding: 5px 10px;
    border-radius: 4px;
    font-size: 11px;
}
QFrame#sectionFrame {
    background: #ffffff;
    border: 1px solid #bbdefb;
    border-radius: 4px;
    padding: 6px 8px;
}
QFrame#panelRight {
    background: #ffffff;
    border: 1px solid #bbdefb;
    border-radius: 4px;
}
"""


class CenteredCheckDelegate(QStyledItemDelegate):
    """Vẽ checkbox căn giữa ô (QTableWidget mặc định luôn lệch trái)."""

    def paint(self, painter, option, index):
        if not (index.flags() & Qt.ItemIsUserCheckable):
            return super().paint(painter, option, index)

        opt = QStyleOptionButton()
        state = index.data(Qt.CheckStateRole)
        if state == Qt.Checked:
            opt.state = QStyle.State_On
        elif state == Qt.PartiallyChecked:
            opt.state = QStyle.State_NoChange
        else:
            opt.state = QStyle.State_Off
        opt.state |= QStyle.State_Enabled
        if option.state & QStyle.State_MouseOver:
            opt.state |= QStyle.State_MouseOver

        widget = option.widget
        style = widget.style() if widget else QApplication.style()
        indicator = style.subElementRect(QStyle.SE_CheckBoxIndicator, opt, widget)
        x = option.rect.x() + (option.rect.width() - indicator.width()) // 2
        y = option.rect.y() + (option.rect.height() - indicator.height()) // 2
        opt.rect = QRect(x, y, indicator.width(), indicator.height())
        style.drawControl(QStyle.CE_CheckBox, opt, painter, widget)

    def editorEvent(self, event, model, option, index):
        if not (index.flags() & Qt.ItemIsUserCheckable):
            return super().editorEvent(event, model, option, index)
        if (
            event.type() == QEvent.MouseButtonRelease
            and event.button() == Qt.LeftButton
            and option.rect.contains(event.pos())
        ):
            checked = index.data(Qt.CheckStateRole) == Qt.Checked
            model.setData(
                index,
                Qt.Unchecked if checked else Qt.Checked,
                Qt.CheckStateRole,
            )
            return True
        return super().editorEvent(event, model, option, index)


def connect_excel_workbook(parent=None):
    """Kết nối workbook Excel đang mở; nếu chưa có thì mở Excel hoặc hỏi chọn file."""
    def active_book():
        try:
            return xw.books.active
        except xw.XlwingsError:
            return None

    def first_book():
        try:
            if len(xw.books) > 0:
                return xw.books[0]
        except xw.XlwingsError:
            pass
        return None

    wb = active_book() or first_book()
    if wb:
        return wb

    try:
        xw.App(visible=True)
    except Exception:
        pass

    wb = active_book() or first_book()
    if wb:
        return wb

    path, _ = QFileDialog.getOpenFileName(
        parent,
        "Chọn file Excel",
        "",
        "Excel Files (*.xlsx *.xlsm *.xls)",
    )
    if not path:
        return None

    try:
        if len(xw.apps) == 0:
            xw.App(visible=True)
    except Exception:
        xw.App(visible=True)

    return xw.Book(path)


class PrintControl(QMainWindow):

    def __init__(self, auth_session=None):
        super().__init__()
        self.auth_session = auth_session
        self.wb = xw.books.active
        self.initial_wb_name = self.wb.name
        self.hidden_mapping_sheets = set()
        self.sheet_print_order = []
        self._selected_order_col = None
        self.setWindowTitle("Print QLCL")
        if os.path.exists(ICON_APP):
            self.setWindowIcon(QIcon(ICON_APP))
        self.setStyleSheet(APP_STYLESHEET)
        self.setMinimumSize(420, 400)
        central = QWidget()
        main_layout = QVBoxLayout()
        main_layout.setContentsMargins(8, 6, 8, 6)
        main_layout.setSpacing(4)
        central.setLayout(main_layout)
        self.table_autofit = QTableWidget()
        self.table_autofit.setColumnCount(2)
        self.table_autofit.setHorizontalHeaderLabels(["Sheet", "AutoFit Rows"])
        self.table_autofit.verticalHeader().setVisible(False)
        self.table_autofit.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        self.load_autofit_table()
        # ===== WORKBOOK INFO =====
        self.lbl_workbook = QLabel(f"📄 {self.initial_wb_name}")
        self.lbl_workbook.setObjectName("bannerWorkbook")
        self.lbl_workbook.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Preferred)

        btn_tile_excel = QPushButton("Canh cạnh Excel")
        btn_tile_excel.setObjectName("btnSecondary")
        btn_tile_excel.setToolTip(
            "Xếp Excel bên trái, tool bên phải — không cần tự chia màn hình"
        )
        btn_tile_excel.clicked.connect(self.tile_beside_excel)

        banner_row = QHBoxLayout()
        banner_row.setSpacing(8)
        banner_row.addWidget(self.lbl_workbook, 1)
        banner_row.addWidget(btn_tile_excel)
        main_layout.addLayout(banner_row)

        # ================= WIDGETS Ô NHẬP =================
        self.combo_sheet_var = QComboBox()
        self.combo_sheet_var.setMinimumWidth(88)
        self.combo_sheet_var.setSizeAdjustPolicy(QComboBox.AdjustToContents)
        self.load_sheets()

        self.txt_cell_var = QLineEdit()
        self.txt_cell_var.setMaximumWidth(52)

        self.txt_from = QLineEdit("1")
        self.txt_from.setMaximumWidth(48)

        self.txt_to = QLineEdit("10")
        self.txt_to.setMaximumWidth(48)

        self.txt_roi_rac = QLineEdit()
        self.txt_roi_rac.setPlaceholderText("VD: 1,3,5 — để trống thì in từ → đến")

        self.txt_check_cell = QLineEdit()
        self.txt_check_cell.setMaximumWidth(52)

        self.hover_roi_rac = QLabel(
            "Nếu nhập: 1,3,5 → in đúng các giá trị này\n"
            "Nếu để trống → in từ 'Từ' đến 'Đến'"
        )
        self.hover_roi_rac.setWindowFlags(Qt.ToolTip)
        self.hover_roi_rac.setStyleSheet("""
            QLabel {
                background-color: #2196F3;
                color: white;
                padding: 8px 12px;
                border-radius: 8px;
                font-size: 11px;
            }
        """)
        self.hover_roi_rac.adjustSize()
        self.hover_roi_rac.hide()
        self.txt_roi_rac.installEventFilter(self)

        self.btn_pick_condition = QPushButton("Quét chọn điều kiện")
        self.btn_pick_condition.setToolTip(
            "Bôi đen ô điều kiện trên Excel → Xác nhận → tick sheet in bên dưới"
        )
        self.btn_pick_condition.clicked.connect(self.pick_condition_range)
        self.btn_pick_condition.installEventFilter(self)

        self.hover_help = QLabel(
            "Bấm nút → bôi đen (hoặc Ctrl+click nhiều vùng) ô điều kiện trên Excel\n"
            "→ bấm Xác nhận. Sau đó tick sheet in ở bảng bên dưới."
        )
        self.hover_help.setWindowFlags(Qt.ToolTip)
        self.hover_help.setStyleSheet("""
            QLabel {
                background-color: #37474f;
                color: white;
                padding: 8px 12px;
                border-radius: 8px;
                font-size: 11px;
            }
        """)
        self.hover_help.adjustSize()
        self.hover_help.hide()

        self.chk_hide_sheet_cols = QCheckBox("Ẩn cột trống")
        self.chk_hide_sheet_cols.setToolTip(
            "Ẩn cột sheet phụ trên bảng điều kiện.\nDouble-click để chọn lại sheet ẩn."
        )
        self.chk_hide_sheet_cols.toggled.connect(self._on_toggle_hide_sheet_cols)
        self.chk_hide_sheet_cols.installEventFilter(self)

        # ================= CỘT TRÁI: 3 SECTION =================
        left_panel = QVBoxLayout()
        left_panel.setSpacing(4)
        left_panel.setContentsMargins(0, 0, 0, 0)

        sec1_layout = QHBoxLayout()
        sec1_layout.setSpacing(6)
        sec1_layout.addWidget(QLabel("Sheet chứa biến"))
        sec1_layout.addWidget(self.combo_sheet_var)
        sec1_layout.addWidget(QLabel("Ô chứa biến"))
        sec1_layout.addWidget(self.txt_cell_var)
        sec1_layout.addWidget(QLabel("Ô chứa điều kiện"))
        sec1_layout.addWidget(self.txt_check_cell)
        sec1_layout.addWidget(self.btn_pick_condition)
        sec1_layout.addStretch()

        left_panel.addWidget(self._section_title("1. BIẾN SỐ / ĐIỀU KIỆN LỌC"))
        left_panel.addWidget(self._section_frame(sec1_layout))

        sec2_layout = QHBoxLayout()
        sec2_layout.setSpacing(6)
        sec2_layout.addWidget(QLabel("In từ"))
        sec2_layout.addWidget(self.txt_from)
        sec2_layout.addWidget(QLabel("In đến"))
        sec2_layout.addWidget(self.txt_to)
        sec2_layout.addStretch()

        left_panel.addWidget(self._section_title("2. PHẠM VI IN"))
        left_panel.addWidget(self._section_frame(sec2_layout))

        sec3_layout = QHBoxLayout()
        sec3_layout.setSpacing(8)
        sec3_layout.addWidget(self.txt_roi_rac, 1)
        sec3_layout.addWidget(self.chk_hide_sheet_cols)

        left_panel.addWidget(self._section_title("3. IN RỜI RẠC"))
        left_panel.addWidget(self._section_frame(sec3_layout))

        left_widget = QWidget()
        left_widget.setLayout(left_panel)

        # ================= CỘT PHẢI: GIÃN DÒNG =================
        self.table_autofit.setHorizontalHeaderLabels(["Sheet", "Giãn dòng"])
        right_panel = QVBoxLayout()
        right_panel.setSpacing(4)
        right_panel.setContentsMargins(6, 6, 6, 6)
        right_panel.addWidget(self._section_title("Giãn dòng (gộp dòng khi in)"))
        right_panel.addWidget(self.table_autofit, 1)

        right_widget = QFrame()
        right_widget.setObjectName("panelRight")
        right_widget.setLayout(right_panel)
        self.table_autofit.horizontalHeader().setStretchLastSection(True)
        self.table_autofit.setColumnWidth(0, 100)
        self.table_autofit.setVerticalScrollMode(QAbstractItemView.ScrollPerPixel)

        row_top = QHBoxLayout()
        row_top.setSpacing(8)
        row_top.addWidget(left_widget, 3)
        row_top.addWidget(right_widget, 2)
        main_layout.addLayout(row_top)

        # ================= BẢNG CHỌN SHEET THEO ĐIỀU KIỆN =================
        main_layout.addWidget(self._section_title("4. CHỌN SHEET IN THEO ĐIỀU KIỆN"))
        cond_layout = QVBoxLayout()
        cond_layout.setContentsMargins(0, 0, 0, 0)
        cond_layout.setSpacing(0)
        cond_frame = self._section_frame(cond_layout)
        cond_frame.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)

        self.table_left = QTableWidget()
        self.table_right = QTableWidget()
        self.table_right.setItemDelegate(CenteredCheckDelegate(self.table_right))
        hdr_print = self.table_right.horizontalHeader()
        hdr_print.setSectionsClickable(True)
        hdr_print.setSectionsMovable(True)
        hdr_print.setDragEnabled(True)
        hdr_print.setDragDropMode(QHeaderView.InternalMove)
        hdr_print.setHighlightSections(True)
        hdr_print.sectionClicked.connect(self._on_print_order_header_clicked)
        hdr_print.sectionMoved.connect(self._on_print_column_moved)

        self.table_left.setMinimumWidth(88)
        self.table_left.setMaximumWidth(160)

        self.table_left.verticalHeader().setVisible(False)
        self.table_right.verticalHeader().setVisible(False)
        self._setup_mapping_table_row_heights()

        self.table_left.setVerticalScrollMode(QAbstractItemView.ScrollPerPixel)
        self.table_right.setVerticalScrollMode(QAbstractItemView.ScrollPerPixel)

        # cho table giãn full
        self.table_left.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        self.table_right.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)

        # ================= SPLITTER (CHÌA KHÓA) =================
        splitter = QSplitter(Qt.Horizontal)
        splitter.addWidget(self.table_left)
        splitter.addWidget(self.table_right)

        splitter.setStretchFactor(0, 1)
        splitter.setStretchFactor(1, 4)
        splitter.setChildrenCollapsible(False)
        splitter.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)

        cond_layout.addWidget(splitter, 1)
        cond_layout.setStretch(0, 1)
        main_layout.addWidget(cond_frame, 1)

        # ================= CẤU HÌNH & XUẤT IN =================
        profile_layout = QHBoxLayout()
        profile_layout.setContentsMargins(0, 0, 0, 0)
        profile_layout.setSpacing(6)

        self.combo_profile = QComboBox()
        self.combo_profile.setMinimumWidth(100)
        self.combo_profile.currentIndexChanged.connect(self.load_selected_profile)

        btn_new_profile = QPushButton("Tạo mới")
        btn_new_profile.setObjectName("btnSecondary")
        btn_new_profile.setToolTip("Tạo cấu hình mới — bỏ hết tick sheet")
        btn_new_profile.clicked.connect(self.new_profile)

        btn_save_profile = QPushButton("Lưu")
        btn_save_profile.setObjectName("btnSecondary")
        btn_save_profile.setToolTip("Lưu cấu hình hiện tại")
        btn_save_profile.clicked.connect(self.save_profile)

        btn_delete_profile = QPushButton("Xoá")
        btn_delete_profile.setObjectName("btnDanger")
        btn_delete_profile.setToolTip("Xoá cấu hình đang chọn khỏi danh sách")
        btn_delete_profile.clicked.connect(self.delete_profile)

        profile_layout.addWidget(QLabel("Tên cấu hình"))
        profile_layout.addWidget(self.combo_profile, 1)
        profile_layout.addWidget(btn_new_profile)
        profile_layout.addWidget(btn_save_profile)
        profile_layout.addWidget(btn_delete_profile)

        col_config = QVBoxLayout()
        col_config.setSpacing(4)
        col_config.setContentsMargins(0, 0, 0, 0)
        col_config.addWidget(self._section_title("5. CẤU HÌNH ĐÃ LƯU"))
        col_config.addWidget(self._section_frame(profile_layout))

        out_layout = QHBoxLayout()
        out_layout.setContentsMargins(0, 0, 0, 0)
        out_layout.setSpacing(6)

        self.radio_pdf = QRadioButton("PDF")
        self.radio_print = QRadioButton("In trực tiếp")
        self.radio_pdf.setChecked(True)

        self.combo_printer = QComboBox()
        self.combo_printer.setMinimumWidth(72)
        self.load_printers()

        out_layout.addWidget(self.radio_pdf)
        out_layout.addWidget(self.radio_print)
        out_layout.addWidget(QLabel("Máy in"))
        out_layout.addWidget(self.combo_printer, 1)

        col_out = QVBoxLayout()
        col_out.setSpacing(4)
        col_out.setContentsMargins(0, 0, 0, 0)
        col_out.addWidget(self._section_title("6. XUẤT / IN"))
        col_out.addWidget(self._section_frame(out_layout))

        row_bottom = QHBoxLayout()
        row_bottom.setSpacing(8)
        row_bottom.setContentsMargins(0, 2, 0, 0)
        row_bottom.addLayout(col_config, 3)
        row_bottom.addLayout(col_out, 2)
        main_layout.addLayout(row_bottom)

        # ================= PROGRESS =================
        self.progress = QProgressBar()
        self.progress.setVisible(False)
        main_layout.addWidget(self.progress)

        self.status_label = QLabel("")
        self.status_label.setAlignment(Qt.AlignCenter)
        self.status_label.setStyleSheet("color: #1565c0; font-weight: 600; font-size: 11px;")
        main_layout.addWidget(self.status_label)

        # ================= BUTTONS =================
        self.btn_print = QPushButton("In / Xuất PDF")
        self.btn_print.clicked.connect(self.run_print)

        self.btn_stop = QPushButton("Dừng")
        self.btn_stop.setObjectName("btnDanger")
        self.btn_stop.setEnabled(False)
        self.btn_stop.clicked.connect(self.request_stop)

        btn_layout = QHBoxLayout()
        btn_layout.addStretch()
        btn_layout.addWidget(self.btn_print)
        btn_layout.addWidget(self.btn_stop)
        btn_layout.addStretch()
        main_layout.addLayout(btn_layout)
        main_layout.setStretch(0, 0)  # banner
        main_layout.setStretch(1, 0)  # biến + giãn dòng
        main_layout.setStretch(2, 0)  # tiêu đề section 4
        main_layout.setStretch(3, 1)  # bảng điều kiện
        main_layout.setStretch(4, 0)  # cấu hình + xuất
        main_layout.setStretch(5, 0)
        main_layout.setStretch(6, 0)
        main_layout.setStretch(7, 0)
        central.setLayout(main_layout)

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setWidget(central)
        scroll.setFrameShape(QFrame.NoFrame)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAsNeeded)
        scroll.setVerticalScrollBarPolicy(Qt.ScrollBarAsNeeded)
        self.setCentralWidget(scroll)

        self.stop_requested = False
        self.load_profiles()
        self._apply_default_geometry()

    def _window_settings(self):
        return QSettings(SETTINGS_ORG, SETTINGS_APP)

    def _geometry_on_screen(self):
        frame = self.frameGeometry()
        for screen in QApplication.screens():
            if screen.availableGeometry().intersects(frame):
                return True
        return False

    def _restore_saved_geometry(self):
        settings = self._window_settings()
        geometry = settings.value("geometry")
        if geometry is None:
            return False
        if not self.restoreGeometry(geometry):
            return False
        state = settings.value("windowState")
        if state is not None:
            self.restoreState(state)
        return self._geometry_on_screen()

    def _excel_hwnd(self):
        try:
            hwnd = int(self.wb.app.hwnd)
        except (AttributeError, TypeError, ValueError):
            return None
        if hwnd and win32gui.IsWindow(hwnd):
            return hwnd
        return None

    def _monitor_work_area(self, hwnd):
        monitor = win32api.MonitorFromWindow(
            hwnd, win32con.MONITOR_DEFAULTTONEAREST
        )
        info = win32api.GetMonitorInfo(monitor)
        return info["Work"]

    def tile_beside_excel(self):
        """Excel bên trái, tool bên phải — dùng chung một màn hình."""
        excel_hwnd = self._excel_hwnd()
        if not excel_hwnd:
            return False

        if win32gui.IsIconic(excel_hwnd):
            win32gui.ShowWindow(excel_hwnd, win32con.SW_RESTORE)
        if win32gui.IsZoomed(excel_hwnd):
            win32gui.ShowWindow(excel_hwnd, win32con.SW_RESTORE)

        work = self._monitor_work_area(excel_hwnd)
        work_l = work["left"]
        work_t = work["top"]
        work_w = work["right"] - work["left"]
        work_h = work["bottom"] - work["top"]

        tool_w = max(self.minimumWidth(), min(540, int(work_w * 0.32)))
        min_excel_w = 480
        if work_w - tool_w < min_excel_w:
            tool_w = max(self.minimumWidth(), work_w - min_excel_w)
        excel_w = work_w - tool_w
        tool_x = work_l + excel_w

        win32gui.SetWindowPos(
            excel_hwnd,
            win32con.HWND_TOP,
            work_l,
            work_t,
            excel_w,
            work_h,
            win32con.SWP_SHOWWINDOW,
        )
        self.setGeometry(tool_x, work_t, tool_w, work_h)
        self.show()
        self.raise_()
        try:
            self._activate_excel()
        except Exception:
            pass
        return True

    def _apply_default_geometry(self):
        """Ưu tiên kích thước lần trước; lần đầu canh cạnh Excel."""
        restored = self._restore_saved_geometry()
        tiled = False
        if not restored:
            self.show()
            QApplication.processEvents()
            tiled = self.tile_beside_excel()
            if not tiled:
                screen_obj = QApplication.primaryScreen()
                if screen_obj is None:
                    self.resize(900, 525)
                else:
                    screen = screen_obj.availableGeometry()
                    w = int(screen.width() * 0.75)
                    h = int(screen.height() * 0.95 * 0.75)
                    self.resize(w, h)
                    frame = self.frameGeometry()
                    frame.moveCenter(screen.center())
                    self.move(frame.topLeft())
                self.show()
        else:
            self.show()

        if not tiled:
            self.raise_()
            self.activateWindow()

    def closeEvent(self, event):
        settings = self._window_settings()
        settings.setValue("geometry", self.saveGeometry())
        settings.setValue("windowState", self.saveState())
        super().closeEvent(event)

    def request_stop(self):
        self.stop_requested = True

    def load_autofit_table(self):
        sheets = [s.name for s in self.wb.sheets]

        self.table_autofit.setRowCount(len(sheets))

        for i, name in enumerate(sheets):
            self.table_autofit.setItem(i, 0, QTableWidgetItem(name))

            txt = QLineEdit()
            txt.setPlaceholderText("VD: 10 hoặc 10,21")
            self.table_autofit.setCellWidget(i, 1, txt)
    def get_autofit_rows_save(self):
        """Lưu cấu hình: {tên sheet: '10,12'}."""
        saved = {}
        for row in range(self.table_autofit.rowCount()):
            item = self.table_autofit.item(row, 0)
            widget = self.table_autofit.cellWidget(row, 1)
            if not item or not widget:
                continue
            name = item.text().strip()
            text = widget.text().strip()
            if name and text:
                saved[name] = text
        return saved

    def apply_autofit_rows(self, autofit_map):
        """Khôi phục bảng giãn dòng từ cấu hình đã lưu."""
        if not isinstance(autofit_map, dict):
            autofit_map = {}
        for row in range(self.table_autofit.rowCount()):
            item = self.table_autofit.item(row, 0)
            widget = self.table_autofit.cellWidget(row, 1)
            if not item or not widget:
                continue
            name = item.text().strip()
            value = autofit_map.get(name, "")
            if isinstance(value, list):
                value = ",".join(str(x) for x in value)
            else:
                value = str(value).strip() if value else ""
            widget.setText(value)

    def get_autofit_map(self):
        """Khi in: {tên sheet: [10, 12, ...]}."""
        result = {}
        for row in range(self.table_autofit.rowCount()):
            item = self.table_autofit.item(row, 0)
            widget = self.table_autofit.cellWidget(row, 1)
            if not item or not widget:
                continue
            name = item.text().strip()
            text = widget.text().strip()
            if name and text:
                rows = [int(x.strip()) for x in text.split(",") if x.strip()]
                result[name] = rows
        return result

    def _mapping_cell_checked(self, row, col):
        item = self.table_right.item(row, col)
        return item is not None and item.checkState() == Qt.Checked

    def _has_mapping_selection(self):
        for row in range(self.table_left.rowCount()):
            for col in range(self.table_right.columnCount()):
                if self._mapping_cell_checked(row, col):
                    return True
        return False

    # ================= LOAD DATA =================
    def _fit_combo_dropdown_width(self, combo, min_width=200):
        combo.setMinimumWidth(min_width)
        fm = combo.fontMetrics()
        width = min_width
        for i in range(combo.count()):
            width = max(width, fm.horizontalAdvance(combo.itemText(i)) + 48)
        combo.view().setMinimumWidth(width)

    def load_sheets(self):
        self.combo_sheet_var.clear()
        for s in self.wb.sheets:
            self.combo_sheet_var.addItem(s.name)
        self._fit_combo_dropdown_width(self.combo_sheet_var, min_width=200)

    def load_printers(self):
        printers = win32print.EnumPrinters(2)
        self.combo_printer.clear()
        for p in printers:
            self.combo_printer.addItem(p[2])

    def eventFilter(self, obj, event):

        # Hover nút chọn điều kiện
        if hasattr(self, "btn_pick_condition") and obj == self.btn_pick_condition:

            if event.type() == QEvent.Enter:
                pos = self.btn_pick_condition.mapToGlobal(
                    self.btn_pick_condition.rect().bottomLeft()
                )
                self.hover_help.move(pos.x(), pos.y() + 5)
                self.hover_help.show()

            elif event.type() in (QEvent.Leave, QEvent.MouseButtonPress):
                self.hover_help.hide()

        # Hover ô in rời rạc
        if hasattr(self, "txt_roi_rac") and obj == self.txt_roi_rac:

            if event.type() == QEvent.Enter:
                pos = self.txt_roi_rac.mapToGlobal(
                    self.txt_roi_rac.rect().bottomLeft()
                )
                self.hover_roi_rac.move(pos.x(), pos.y() + 5)
                self.hover_roi_rac.show()

            elif event.type() in (QEvent.Leave, QEvent.MouseButtonPress):
                self.hover_roi_rac.hide()

        if hasattr(self, "chk_hide_sheet_cols") and obj == self.chk_hide_sheet_cols:
            if event.type() == QEvent.MouseButtonDblClick:
                self.edit_hidden_mapping_sheets()
                return True

        return super().eventFilter(obj, event)

    def _section_title(self, text):
        lbl = QLabel(text)
        lbl.setObjectName("sectionTitle")
        return lbl

    def _section_frame(self, layout):
        frame = QFrame()
        frame.setObjectName("sectionFrame")
        frame.setLayout(layout)
        return frame

    # ================= CHỌN VÙNG =================
    def _activate_excel(self):
        try:
            self.wb.app.activate()
            win = self.wb.app.api.ActiveWindow
            if win is not None:
                win.Activate()
        except Exception:
            pass

    def _flatten_cell_values(self, values):
        out = []
        if values is None:
            return out
        if not isinstance(values, list):
            text = str(values).strip()
            if text:
                out.append(text)
            return out
        for row in values:
            if isinstance(row, list):
                for cell in row:
                    if cell is not None and str(cell).strip():
                        out.append(str(cell).strip())
            elif row is not None and str(row).strip():
                out.append(str(row).strip())
        return out

    def _conditions_from_selection(self, selection):
        conditions = []
        if selection is None:
            return conditions
        try:
            areas = selection.api.Areas
            if areas is not None and areas.Count > 1:
                for i in range(1, areas.Count + 1):
                    conditions.extend(
                        self._flatten_cell_values(areas(i).Value)
                    )
                return conditions
        except Exception:
            pass
        return self._flatten_cell_values(selection.value)

    def _condition_key(self, text):
        return str(text).strip().casefold()

    def _normalize_condition_value(self, raw):
        if raw is None:
            return ""
        if isinstance(raw, float) and raw == int(raw):
            return str(int(raw))
        return str(raw).strip()

    def _unique_preserve_order(self, items):
        """Giữ thứ tự lần đầu; bỏ rỗng và điều kiện trùng (không phân biệt hoa thường)."""
        seen = set()
        out = []
        for item in items:
            if item is None:
                continue
            display = str(item).strip()
            if not display:
                continue
            key = self._condition_key(display)
            if key in seen:
                continue
            seen.add(key)
            out.append(display)
        return out

    def pick_condition_range(self):
        try:
            self._activate_excel()
            self.status_label.setText(
                "Đang chờ: bôi đen ô điều kiện trên Excel, rồi bấm Xác nhận..."
            )
            QApplication.processEvents()

            dlg = QMessageBox(self)
            dlg.setWindowTitle("Quét điều kiện từ Excel")
            dlg.setIcon(QMessageBox.Information)
            dlg.setText(
                "1. Trên Excel, bôi đen các ô chứa giá trị điều kiện\n"
                "   (giữ Ctrl để chọn thêm nhiều vùng rời nhau)\n"
                "2. Bấm Xác nhận khi chọn xong"
            )
            btn_ok = dlg.addButton("Xác nhận", QMessageBox.AcceptRole)
            dlg.addButton("Hủy", QMessageBox.RejectRole)
            dlg.exec_()

            if dlg.clickedButton() != btn_ok:
                self.status_label.setText("")
                return

            self._activate_excel()
            selection = self.wb.app.selection
            if selection is None:
                QMessageBox.warning(self, "Lỗi", "Chưa chọn ô nào trên Excel.")
                self.status_label.setText("")
                return

            raw = self._conditions_from_selection(selection)
            conditions = self._unique_preserve_order(raw)
            if not conditions:
                QMessageBox.warning(self, "Lỗi", "Vùng chọn không có giá trị.")
                self.status_label.setText("")
                return

            dropped = len(raw) - len(conditions)
            self.build_mapping_table(conditions)
            msg = f"Đã lấy {len(conditions)} điều kiện từ Excel ✔"
            if dropped > 0:
                msg += f" (đã bỏ {dropped} ô trùng)"
            self.status_label.setText(msg)

        except Exception as e:
            self.status_label.setText("")
            QMessageBox.critical(self, "Lỗi", str(e))

    def _mapping_condition_font(self):
        font = QFont()
        font.setPointSize(11)
        font.setBold(True)
        return font

    def _setup_mapping_table_row_heights(self):
        for tbl in (self.table_left, self.table_right):
            vh = tbl.verticalHeader()
            vh.setDefaultSectionSize(MAPPING_ROW_HEIGHT)
            vh.setSectionResizeMode(QHeaderView.Fixed)
            vh.setMinimumSectionSize(MAPPING_ROW_HEIGHT)
            try:
                vh.sectionResized.disconnect(self._on_mapping_row_section_resized)
            except TypeError:
                pass
            vh.sectionResized.connect(self._on_mapping_row_section_resized)

    def _on_mapping_row_section_resized(self, logical_index, old_size, new_size):
        del old_size
        sender = self.sender()
        if sender is self.table_left.verticalHeader():
            other = self.table_right
        else:
            other = self.table_left
        if logical_index < 0 or logical_index >= other.rowCount():
            return
        if other.rowHeight(logical_index) == new_size:
            return
        ovh = other.verticalHeader()
        ovh.blockSignals(True)
        try:
            other.setRowHeight(logical_index, new_size)
        finally:
            ovh.blockSignals(False)

    def _sync_mapping_row_heights(self):
        if not hasattr(self, "table_left") or not hasattr(self, "table_right"):
            return
        rows = max(self.table_left.rowCount(), self.table_right.rowCount())
        for row in range(rows):
            self.table_left.setRowHeight(row, MAPPING_ROW_HEIGHT)
            self.table_right.setRowHeight(row, MAPPING_ROW_HEIGHT)

    def _pure_sheet_name(self, label):
        if not label:
            return ""
        text = str(label).strip()
        if ". " in text:
            left, right = text.split(". ", 1)
            if left.isdigit():
                return right.strip()
        return text

    def _ordered_sheet_names(self):
        all_names = [s.name for s in self.wb.sheets]
        if not self.sheet_print_order:
            self.sheet_print_order = all_names[:]
        ordered = [n for n in self.sheet_print_order if n in all_names]
        for n in all_names:
            if n not in ordered:
                ordered.append(n)
        self.sheet_print_order = ordered
        return ordered

    def _save_mapping_state(self):
        conditions = []
        checks = set()
        for r in range(self.table_left.rowCount()):
            citem = self.table_left.item(r, 0)
            cond = citem.text().strip() if citem else ""
            if not cond:
                continue
            conditions.append(cond)
            for c in range(self.table_right.columnCount()):
                hdr = self.table_right.horizontalHeaderItem(c)
                sname = self._pure_sheet_name(hdr.text() if hdr else "")
                if self._mapping_cell_checked(r, c):
                    checks.add((cond, sname))
        conditions = self._unique_preserve_order(conditions)
        return conditions, checks

    def _restore_mapping_state(self, conditions, checks):
        self.build_mapping_table(conditions)
        self.table_right.blockSignals(True)
        try:
            for r, cond in enumerate(conditions):
                for c in range(self.table_right.columnCount()):
                    hdr = self.table_right.horizontalHeaderItem(c)
                    sname = self._pure_sheet_name(hdr.text() if hdr else "")
                    if (cond, sname) in checks:
                        it = self.table_right.item(r, c)
                        if it:
                            it.setCheckState(Qt.Checked)
        finally:
            self.table_right.blockSignals(False)
        self._refresh_all_rows_print_order()

    def _checked_sheets_for_row(self, row):
        """Danh sách tên sheet đã tick, theo thứ tự cột trái→phải trên bảng."""
        result = []
        hdr_view = self.table_right.horizontalHeader()
        for visual_col in range(hdr_view.count()):
            col = hdr_view.logicalIndex(visual_col)
            if self.table_right.isColumnHidden(col):
                continue
            if not self._mapping_cell_checked(row, col):
                continue
            hdr = self.table_right.horizontalHeaderItem(col)
            name = self._pure_sheet_name(hdr.text() if hdr else "")
            if name:
                result.append(name)
        return result

    def _refresh_row_print_order(self, row):
        for col in range(self.table_right.columnCount()):
            it = self.table_right.item(row, col)
            if not it:
                continue
            if self.table_right.isColumnHidden(col):
                it.setBackground(QColor("#FFFFFF"))
                continue
            if it.checkState() == Qt.Checked:
                it.setBackground(QColor("#E8F5E9"))
            else:
                it.setBackground(QColor("#FFFFFF"))
        self.table_right.viewport().update()

    def _refresh_all_rows_print_order(self):
        for r in range(self.table_left.rowCount()):
            self._refresh_row_print_order(r)
        self._sync_mapping_row_heights()

    def _on_mapping_item_changed(self, item):
        if item.column() < 0:
            return
        self._refresh_row_print_order(item.row())
        self._sync_mapping_row_heights()

    def _sync_print_order_from_table(self):
        order = []
        for col in range(self.table_right.columnCount()):
            hdr = self.table_right.horizontalHeaderItem(col)
            if hdr:
                order.append(self._pure_sheet_name(hdr.text()))
        self.sheet_print_order = order
        self._apply_mapping_column_visibility()
        self._refresh_all_rows_print_order()

    def _on_print_column_moved(self, logical_index, old_visual, new_visual):
        del logical_index, old_visual, new_visual
        self._sync_print_order_from_table()

    def _on_print_order_header_clicked(self, col):
        self._selected_order_col = col
        hdr = self.table_right.horizontalHeaderItem(col)
        name = self._pure_sheet_name(hdr.text() if hdr else "")
        for c in range(self.table_right.columnCount()):
            if c == col:
                self.table_right.horizontalHeaderItem(c).setBackground(QColor("#BBDEFB"))
            else:
                item = self.table_right.horizontalHeaderItem(c)
                if item:
                    item.setBackground(QColor("#E3F2FD"))

    def build_mapping_table(self, conditions):
        conditions = self._unique_preserve_order(conditions)
        sheet_names = self._ordered_sheet_names()
        cond_font = self._mapping_condition_font()

        # ===== CLEAR CŨ =====
        self.table_left.clear()
        self.table_right.clear()

        self.table_left.setRowCount(0)
        self.table_right.setRowCount(0)

        # ===== SET SIZE =====
        self.table_left.setRowCount(len(conditions))
        self.table_left.setColumnCount(1)

        self.table_right.setRowCount(len(conditions))
        self.table_right.setColumnCount(len(sheet_names))

        # ===== HEADER =====
        self.table_left.setHorizontalHeaderLabels(["ĐIỀU KIỆN"])
        self.table_right.setHorizontalHeaderLabels(sheet_names)

        # ===== STYLE HEADER =====
        header_style = """
        QHeaderView::section {
            background-color: #BBDEFB;
            font-weight: bold;
            padding: 4px;
            border: 1px solid #90A4AE;
        }
        """

        self.table_left.horizontalHeader().setStyleSheet(header_style)
        self.table_right.horizontalHeader().setStyleSheet(header_style)

        # ===== FIX UI =====
        self.table_left.verticalHeader().setVisible(False)
        self.table_right.verticalHeader().setVisible(False)

        self.table_left.setMinimumWidth(88)
        self.table_left.setMaximumWidth(160)

        self.table_left.setVerticalScrollMode(QAbstractItemView.ScrollPerPixel)
        self.table_right.setVerticalScrollMode(QAbstractItemView.ScrollPerPixel)
        self._setup_mapping_table_row_heights()

        self.table_left.horizontalHeader().setDefaultAlignment(Qt.AlignCenter)
        self.table_right.horizontalHeader().setDefaultAlignment(Qt.AlignCenter)
        self.table_left.horizontalHeader().setStretchLastSection(True)
        self.table_right.horizontalHeader().setStretchLastSection(True)

        self.table_left.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        self.table_right.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)

        self.table_left.setStyleSheet("""
            QTableWidget::item {
                padding: 4px 6px;
            }
        """)
        self.table_right.setStyleSheet("""
            QTableWidget::item {
                padding: 4px;
            }
        """)

        # ===== FILL DATA =====
        for row, cond in enumerate(conditions):

            cond_item = QTableWidgetItem(str(cond))
            cond_item.setFont(cond_font)
            cond_item.setTextAlignment(Qt.AlignCenter)
            cond_item.setFlags(Qt.ItemIsEnabled | Qt.ItemIsSelectable)
            self.table_left.setItem(row, 0, cond_item)

            for col in range(len(sheet_names)):
                chk_item = QTableWidgetItem()
                chk_item.setFlags(Qt.ItemIsUserCheckable | Qt.ItemIsEnabled)
                chk_item.setCheckState(Qt.Unchecked)
                chk_item.setTextAlignment(Qt.AlignCenter)
                self.table_right.setItem(row, col, chk_item)

        # ===== SYNC SCROLL =====
        self.table_left.verticalScrollBar().valueChanged.connect(
            self.table_right.verticalScrollBar().setValue
        )
        self.table_right.verticalScrollBar().valueChanged.connect(
            self.table_left.verticalScrollBar().setValue
        )

        try:
            self.table_right.itemChanged.disconnect(self._on_mapping_item_changed)
        except TypeError:
            pass
        self.table_right.itemChanged.connect(self._on_mapping_item_changed)

        self._sync_mapping_row_heights()
        self._apply_mapping_column_visibility()
        self._refresh_all_rows_print_order()

    def _is_likely_aux_sheet(self, name):
        n = name.lower().replace(" ", "")
        hints = ("list", "data", "dmnt", "dm", "mmnl", "dauvao", "đầuvào")
        return any(h in n for h in hints)

    def edit_hidden_mapping_sheets(self):
        sheets = [s.name for s in self.wb.sheets]
        dlg = QDialog(self)
        dlg.setWindowTitle("Chọn sheet ẩn khỏi bảng điều kiện")
        dlg.resize(380, 440)

        layout = QVBoxLayout(dlg)
        layout.addWidget(QLabel(
            "Tick sheet không cần chọn khi in (vd. DM NT, List, Data…).\n"
            "Chỉ ẩn cột trên bảng tool — không xóa/ẩn sheet trong file Excel.\n"
            "Bật «Ẩn cột sheet không in» để thu gọn bảng điều kiện."
        ))

        list_widget = QListWidget()
        for name in sheets:
            item = QListWidgetItem(name)
            item.setFlags(item.flags() | Qt.ItemIsUserCheckable)
            if name in self.hidden_mapping_sheets:
                item.setCheckState(Qt.Checked)
            else:
                item.setCheckState(Qt.Unchecked)
            list_widget.addItem(item)
        layout.addWidget(list_widget)

        preset_row = QHBoxLayout()
        btn_preset = QPushButton("Gợi ý sheet phụ (List, Data…)")
        btn_preset.setObjectName("btnSecondary")

        def apply_preset():
            for i in range(list_widget.count()):
                it = list_widget.item(i)
                it.setCheckState(
                    Qt.Checked if self._is_likely_aux_sheet(it.text()) else Qt.Unchecked
                )

        btn_preset.clicked.connect(apply_preset)
        preset_row.addWidget(btn_preset)
        layout.addLayout(preset_row)

        btn_row = QHBoxLayout()
        ok_btn = QPushButton("OK")
        cancel_btn = QPushButton("Hủy")
        ok_btn.clicked.connect(dlg.accept)
        cancel_btn.clicked.connect(dlg.reject)
        btn_row.addStretch()
        btn_row.addWidget(ok_btn)
        btn_row.addWidget(cancel_btn)
        layout.addLayout(btn_row)

        if dlg.exec_() != QDialog.Accepted:
            return

        self.hidden_mapping_sheets = set()
        for i in range(list_widget.count()):
            it = list_widget.item(i)
            if it.checkState() == Qt.Checked:
                self.hidden_mapping_sheets.add(it.text())

        self.chk_hide_sheet_cols.blockSignals(True)
        self.chk_hide_sheet_cols.setChecked(True)
        self.chk_hide_sheet_cols.blockSignals(False)
        self._apply_mapping_column_visibility()

    def _on_toggle_hide_sheet_cols(self, checked):
        if checked and not self.hidden_mapping_sheets:
            self.edit_hidden_mapping_sheets()
        if checked and not self.hidden_mapping_sheets:
            self.chk_hide_sheet_cols.blockSignals(True)
            self.chk_hide_sheet_cols.setChecked(False)
            self.chk_hide_sheet_cols.blockSignals(False)
            return
        self._apply_mapping_column_visibility()

    def _apply_mapping_column_visibility(self):
        if not hasattr(self, "table_right"):
            return
        hide = (
            hasattr(self, "chk_hide_sheet_cols")
            and self.chk_hide_sheet_cols.isChecked()
        )
        hidden = self.hidden_mapping_sheets if hasattr(self, "hidden_mapping_sheets") else set()
        for col in range(self.table_right.columnCount()):
            hdr = self.table_right.horizontalHeaderItem(col)
            if not hdr:
                continue
            name = self._pure_sheet_name(hdr.text())
            self.table_right.setColumnHidden(col, bool(hide and name in hidden))

    # ================= PROFILE SAVE =================
    def clear_mapping_checks(self):
        """Bỏ tick toàn bộ sheet trong bảng chọn điều kiện."""
        if not hasattr(self, "table_right"):
            return
        self.table_right.blockSignals(True)
        try:
            for row in range(self.table_right.rowCount()):
                for col in range(self.table_right.columnCount()):
                    item = self.table_right.item(row, col)
                    if item:
                        item.setCheckState(Qt.Unchecked)
        finally:
            self.table_right.blockSignals(False)
        self._refresh_all_rows_print_order()

    def new_profile(self):
        """Tạo cấu hình mới: bỏ chọn profile đang dùng và xóa hết tick sheet."""
        self.combo_profile.blockSignals(True)
        try:
            self.combo_profile.setCurrentIndex(-1)
        finally:
            self.combo_profile.blockSignals(False)
        self.clear_mapping_checks()
        self.status_label.setText("Cấu hình mới — tick sheet in rồi bấm «Lưu cấu hình»")

    def save_profile(self):
        name, ok = QInputDialog.getText(self, "Lưu cấu hình", "Nhập tên cấu hình:")
        if not ok or not name.strip():
            return
        name = name.strip()

        config = self.collect_current_config()

        data = {}
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)

        if "profiles" not in data:
            data["profiles"] = {}

        data["profiles"][name] = config

        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4)

        self.load_profiles()
        idx = self.combo_profile.findText(name)
        if idx >= 0:
            self.combo_profile.setCurrentIndex(idx)
        QMessageBox.information(
            self,
            "Xong",
            "Đã lưu cấu hình:\n"
            "• Biến số, điều kiện, máy in\n"
            "• Giãn dòng từng sheet\n"
            "• Sheet ẩn trên bảng điều kiện",
        )

    def load_profiles(self):
        self.combo_profile.blockSignals(True)
        try:
            self.combo_profile.clear()
            if not os.path.exists(CONFIG_FILE):
                return
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            if "profiles" in data:
                for name in data["profiles"]:
                    self.combo_profile.addItem(name)
        except (json.JSONDecodeError, OSError) as e:
            print("Không đọc được cấu hình:", e)
        finally:
            self.combo_profile.blockSignals(False)

    def load_selected_profile(self):
        name = self.combo_profile.currentText()
        if not name or not os.path.exists(CONFIG_FILE):
            return

        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)

        config = data["profiles"].get(name)
        if not config:
            return

        self.apply_config(config)

    def delete_profile(self):
        name = self.combo_profile.currentText()
        if not name:
            return

        reply = QMessageBox.question(
            self,
            "Xoá cấu hình",
            f"Bạn có chắc muốn xoá cấu hình «{name}»?\nHành động này không thể hoàn tác.",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No,
        )
        if reply != QMessageBox.Yes:
            return

        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)

        if name in data.get("profiles", {}):
            del data["profiles"][name]

        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4)

        self.load_profiles()

    # ================= CONFIG HANDLER =================
    def collect_current_config(self):
        config = {
            "sheet_var": self.combo_sheet_var.currentText(),
            "cell_var": self.txt_cell_var.text(),
            "cell_check": self.txt_check_cell.text(),
            "from": self.txt_from.text(),
            "to": self.txt_to.text(),
            "roi_rac": self.txt_roi_rac.text(),
            "printer": self.combo_printer.currentText(),
            "mode_pdf": self.radio_pdf.isChecked(),
            "mapping": {}
        }
        config["autofit_map"] = self.get_autofit_rows_save()
        config["hidden_mapping_sheets"] = sorted(self.hidden_mapping_sheets)
        config["hide_mapping_columns"] = self.chk_hide_sheet_cols.isChecked()
        config["sheet_print_order"] = self._ordered_sheet_names()
        seen_cond = set()
        for row in range(self.table_left.rowCount()):
            citem = self.table_left.item(row, 0)
            if not citem:
                continue
            cond = citem.text().strip()
            if not cond:
                continue
            key = self._condition_key(cond)
            if key in seen_cond:
                continue
            seen_cond.add(key)
            config["mapping"][cond] = []
            for sheet_name in self._checked_sheets_for_row(row):
                config["mapping"][cond].append(sheet_name)

        return config

    def apply_config(self, config):
        self.combo_sheet_var.setCurrentText(config.get("sheet_var", ""))
        self.txt_cell_var.setText(config.get("cell_var", ""))
        self.txt_check_cell.setText(config.get("cell_check", ""))
        self.txt_from.setText(config.get("from", "1"))
        self.txt_to.setText(config.get("to", "10"))
        self.txt_roi_rac.setText(config.get("roi_rac", ""))
        self.combo_printer.setCurrentText(config.get("printer", ""))
        self.radio_pdf.setChecked(config.get("mode_pdf", True))
        self.radio_print.setChecked(not config.get("mode_pdf", True))

        self.sheet_print_order = config.get("sheet_print_order", [])
        mapping = config.get("mapping", {})
        by_key = {}
        for cond, sheets in mapping.items():
            key = self._condition_key(cond)
            if key not in by_key:
                by_key[key] = (str(cond).strip(), sheets)

        self.build_mapping_table([display for display, _ in by_key.values()])

        for row in range(self.table_left.rowCount()):
            citem = self.table_left.item(row, 0)
            cond = citem.text().strip() if citem else ""
            sheets_for_cond = mapping.get(cond, [])
            if not sheets_for_cond:
                entry = by_key.get(self._condition_key(cond))
                if entry:
                    sheets_for_cond = entry[1]
            for col in range(self.table_right.columnCount()):
                hdr = self.table_right.horizontalHeaderItem(col)
                sheet_name = self._pure_sheet_name(hdr.text() if hdr else "")
                item = self.table_right.item(row, col)
                if item and sheet_name in sheets_for_cond:
                    item.setCheckState(Qt.Checked)
        self._refresh_all_rows_print_order()

        self.apply_autofit_rows(config.get("autofit_map", {}))

        self.hidden_mapping_sheets = set(config.get("hidden_mapping_sheets", []))
        self.chk_hide_sheet_cols.blockSignals(True)
        self.chk_hide_sheet_cols.setChecked(
            bool(config.get("hide_mapping_columns", self.hidden_mapping_sheets))
        )
        self.chk_hide_sheet_cols.blockSignals(False)
        self._apply_mapping_column_visibility()

    def _sheet_last_col(self, ws, cap=80):
        try:
            return min(max(1, int(ws.used_range.last_cell.column)), cap)
        except Exception:
            return 30

    def _merge_area_for_row(self, ws, row_num):
        """Tìm vùng ô gộp chứa row_num (kể cả khi không phải hàng đầu của vùng gộp)."""
        last_col = self._sheet_last_col(ws)

        for col in range(1, last_col + 1):
            try:
                cell = ws.cells(row_num, col)
                if cell.api.MergeCells:
                    area = cell.api.MergeArea
                    r1 = area.Row
                    r2 = r1 + area.Rows.Count - 1
                    if r1 <= row_num <= r2:
                        return area
            except Exception:
                continue
        return None

    def _merged_cols_width(self, ws, merge_area):
        start_col = merge_area.Column
        n_cols = merge_area.Columns.Count
        total = 0.0
        for i in range(n_cols):
            total += float(ws.cells(1, start_col + i).column_width)
        return max(total, 8.0)

    def _cell_display_text(self, cell):
        try:
            text = cell.api.Text
            if text is not None and str(text).strip():
                return str(text)
        except Exception:
            pass
        val = cell.value
        return "" if val is None else str(val)

    def _set_tmp_col_width_match_merge(self, ws, tmp_cell, merge_area):
        """Đặt độ rộng cột tạm theo points của vùng gộp (chính xác hơn cộng column_width)."""
        merge_pts = float(merge_area.Width)
        try:
            ref_pts = float(ws.cells(1, tmp_cell.column).width)
            if merge_pts > 0 and ref_pts > 0:
                tmp_cell.column_width = float(tmp_cell.column_width) * (merge_pts / ref_pts)
                return
        except Exception:
            pass
        tmp_cell.column_width = self._merged_cols_width(ws, merge_area)

    def _set_merge_row_heights(self, ws, top_row, n_rows, height):
        height = max(float(ws.api.StandardHeight), height)
        if n_rows <= 1:
            ws.api.Rows(top_row).RowHeight = height
        else:
            each = height / n_rows
            for i in range(n_rows):
                ws.api.Rows(top_row + i).RowHeight = each

    def _pump_ui(self, message=None):
        if message is not None:
            self.status_label.setText(message)
        QApplication.processEvents(QEventLoop.AllEvents, 100)

    def _set_print_progress(self, page_index, page_total, sheet_name):
        self.status_label.setText(
            f"[{page_index}/{page_total}] Đang in — sheet: {sheet_name}"
        )
        QApplication.processEvents(QEventLoop.AllEvents, 100)

    def _refresh_workbook(self):
        try:
            self.wb = xw.books[self.initial_wb_name]
        except Exception:
            self.wb = xw.books.active
            self.initial_wb_name = self.wb.name
            if hasattr(self, "lbl_workbook"):
                self.lbl_workbook.setText(f"📄 {self.initial_wb_name}")
        return self.wb

    def _ensure_excel_running(self):
        if len(xw.apps) == 0:
            xw.App(visible=True)
        self._refresh_workbook()
        try:
            self.wb.app.visible = True
        except Exception:
            pass

    def _get_live_sheet(self, sheet_name):
        """Lấy lại sheet qua COM (tránh RPC/unavailable sau giãn dòng hoặc Excel kẹt)."""
        self._ensure_excel_running()
        self._activate_excel()
        ws = self.wb.sheets[sheet_name]
        try:
            if ws.api.Visible != -1:
                ws.api.Visible = -1
        except Exception:
            pass
        try:
            ws.activate()
        except Exception:
            pass
        QApplication.processEvents(QEventLoop.AllEvents, 50)
        return ws

    def _print_batch_begin(self):
        """Tối ưu tốc độ in hàng loạt (không tắt Calculate — tránh BBNT/PYC kẹt nội dung cũ)."""
        self._print_batch_saved = None
        try:
            app = self.wb.app.api
            self._print_batch_saved = (
                app.ScreenUpdating,
                app.DisplayAlerts,
            )
            app.ScreenUpdating = False
            app.DisplayAlerts = False
        except Exception:
            pass

    def _print_batch_end(self):
        saved = getattr(self, "_print_batch_saved", None)
        if saved is not None:
            try:
                app = self.wb.app.api
                app.ScreenUpdating, app.DisplayAlerts = saved
            except Exception:
                pass
        self._print_batch_saved = None

    def _excel_print_begin(self):
        """Chỉ tắt cập nhật màn hình Excel — không tắt Events (tránh treo khi xuất PDF/in)."""
        self._excel_print_saved = None
        try:
            app = self.wb.app.api
            self._excel_print_saved = (app.ScreenUpdating, app.DisplayAlerts)
            app.ScreenUpdating = False
            app.DisplayAlerts = False
        except Exception:
            pass

    def _excel_print_end(self):
        saved = getattr(self, "_excel_print_saved", None)
        if saved is not None:
            try:
                app = self.wb.app.api
                app.ScreenUpdating, app.DisplayAlerts = saved
            except Exception:
                pass
        self._excel_print_saved = None

    def _excel_set_variable_fast(self, sheet_var, cell_var, value):
        sheet_var.range(cell_var).value = value
        self._excel_recalc_workbook(sheet_var)

    def _excel_recalc_workbook(self, sheet_var=None, extra_sheets=None):
        """Tính lại toàn workbook — BBNT/HT/3TP thường tham chiếu ô biến trên PYC."""
        try:
            self.wb.app.api.CalculateFull()
        except Exception:
            try:
                self.wb.app.api.Calculate()
            except Exception:
                try:
                    self.wb.app.calculate()
                except Exception:
                    pass
        if sheet_var is not None:
            try:
                sheet_var.api.Calculate()
            except Exception:
                pass
        for name in extra_sheets or []:
            try:
                self.wb.sheets[name].api.Calculate()
            except Exception:
                pass

    def _read_condition_cell(self, sheet_var, cell_check):
        """Đọc ô điều kiện sau khi Excel đã tính xong (tránh lấy giá trị cũ)."""
        self._excel_recalc_workbook(sheet_var)
        rng = sheet_var.range(cell_check)
        try:
            text = rng.api.Text
            if text is not None and str(text).strip():
                return text
        except Exception:
            pass
        return rng.value

    def _excel_force_calculate(self, ws=None, full_rebuild=False):
        """Tính lại công thức. In hàng loạt dùng Calculate nhẹ; autofit mới dùng Full."""
        try:
            app = self.wb.app.api
            if full_rebuild:
                app.CalculateFull()
            else:
                if ws is not None:
                    try:
                        ws.api.Calculate()
                    except Exception:
                        pass
                app.Calculate()
        except Exception:
            try:
                self.wb.app.calculate()
            except Exception:
                pass
        if full_rebuild:
            time.sleep(0.05)

    def _registered_autofit_rows(self, rows):
        return sorted({int(r) for r in rows})

    def _autofit_sheet_for_print(self, ws, rows):
        """Giãn nhanh khi in — chỉ AutoFit ô gộp, các dòng đã đăng ký."""
        processed_merges = set()
        for row_num in self._registered_autofit_rows(rows):
            merge_area = self._merge_area_for_row(ws, row_num)
            if merge_area is None:
                try:
                    ws.api.Rows(row_num).EntireRow.AutoFit()
                except Exception:
                    pass
                continue
            mkey = self._merge_area_key(merge_area)
            if mkey in processed_merges:
                continue
            processed_merges.add(mkey)
            try:
                top_left = merge_area.Cells(1, 1)
                top_left.WrapText = True
                self._set_vertical_align_top(top_left)
                merge_area.Rows.AutoFit()
            except Exception:
                try:
                    ws.api.Rows(row_num).EntireRow.AutoFit()
                except Exception:
                    pass

    def _autofit_before_print(self, sheet, rows):
        self._autofit_sheet_for_print(sheet, rows)

    def _export_sheet_pdf(self, sheet_name, path, ws=None):
        path = os.path.abspath(path)
        parent = os.path.dirname(path)
        if parent:
            os.makedirs(parent, exist_ok=True)

        last_err = None
        for attempt in range(2):
            try:
                if ws is None:
                    ws = self.wb.sheets[sheet_name]
                    try:
                        if ws.api.Visible != -1:
                            ws.api.Visible = -1
                    except Exception:
                        pass
                ws.api.ExportAsFixedFormat(
                    Type=0,
                    Filename=path,
                    Quality=0,
                    IncludeDocProperties=False,
                    IgnorePrintAreas=False,
                    OpenAfterPublish=False,
                )
                if not os.path.isfile(path):
                    raise RuntimeError("Excel không tạo được file PDF.")
                return
            except Exception as e:
                last_err = e
                print(f"ExportAsFixedFormat ({sheet_name}) lần {attempt + 1}:", e)
                ws = None
                time.sleep(0.3)
                try:
                    self._refresh_workbook()
                except Exception:
                    pass

        raise RuntimeError(
            f"Không xuất PDF sheet «{sheet_name}».\n"
            "Giữ Excel mở, không bấm đóng file khi đang in.\n\n"
            f"Chi tiết: {last_err}"
        ) from last_err

    def _print_sheet_silent(self, sheet_name, ws=None):
        last_err = None
        for attempt in range(2):
            try:
                if ws is None:
                    ws = self.wb.sheets[sheet_name]
                    try:
                        if ws.api.Visible != -1:
                            ws.api.Visible = -1
                    except Exception:
                        pass
                ws.api.PrintOut(Preview=False)
                return
            except Exception as e:
                last_err = e
                ws = None
                time.sleep(0.3)
                try:
                    self._refresh_workbook()
                except Exception:
                    pass

        raise RuntimeError(
            f"Không in được sheet «{sheet_name}».\n\nChi tiết: {last_err}"
        ) from last_err

    def _merge_area_key(self, merge_area):
        try:
            return str(merge_area.Address).replace("$", "")
        except Exception:
            return f"{merge_area.Row}:{merge_area.Column}"

    def _estimate_line_count(self, text, merge_area):
        text = str(text).replace("\r\n", "\n").strip()
        if not text:
            return 1
        explicit = text.count("\n") + 1
        try:
            width_pts = float(merge_area.Width)
        except Exception:
            width_pts = 400.0
        chars_per_line = max(28, int(width_pts / 5.2))
        wrapped = max(1, (len(text.replace("\n", "")) + chars_per_line - 1) // chars_per_line)
        return max(explicit, wrapped)

    def _estimate_min_row_height(self, ws, line_count, n_rows):
        std = float(ws.api.StandardHeight)
        total = line_count * std * 1.06
        if n_rows > 1:
            return total / n_rows
        return total

    def _set_vertical_align_top(self, cell):
        try:
            cell.api.VerticalAlignment = -4160  # xlTop
        except Exception:
            pass

    def _copy_font_to_cell(self, src_cell, dst_cell):
        try:
            s, d = src_cell.api.Font, dst_cell.api.Font
            d.Name = s.Name
            d.Size = s.Size
            d.Bold = s.Bold
        except Exception:
            pass

    def _pick_tmp_col(self, ws):
        """Cột tạm sát vùng dùng — không dùng cột 16384 (dễ phình/hỏng file .xlsm)."""
        try:
            last_col = int(ws.used_range.last_cell.column)
        except Exception:
            last_col = 10
        return min(max(last_col + 2, 3), 255)

    def _cleanup_tmp_col(self, ws, tmp_col):
        try:
            last_row = int(ws.used_range.last_cell.row)
        except Exception:
            last_row = 200
        try:
            col_rng = ws.range((1, tmp_col), (max(last_row, 1), tmp_col))
            col_rng.clear_contents()
            try:
                col_rng.column_width = float(ws.api.StandardWidth)
            except Exception:
                col_rng.column_width = 8.43
        except Exception:
            pass

    def _restore_excel_app_defaults(self):
        """Khôi phục Excel nếu tool thoát giữa chừng (tránh file kẹt trạng thái lỗi)."""
        self._excel_print_end()
        try:
            app = self.wb.app.api
            app.ScreenUpdating = True
            app.EnableEvents = True
            app.DisplayAlerts = True
            app.Interactive = True
            calc = getattr(self, "_excel_saved_calc", None)
            if calc is not None:
                app.Calculation = calc
        except Exception:
            pass

    def closeEvent(self, event):
        try:
            self._restore_excel_app_defaults()
        except Exception:
            pass
        super().closeEvent(event)

    def _height_from_tmp_measure(self, ws, merge_area, top_row, tmp_col, text):
        tmp = ws.cells(top_row, tmp_col)
        old_val = tmp.value
        old_wrap = tmp.api.WrapText
        old_width = tmp.column_width
        std = float(ws.api.StandardHeight)
        try:
            ws.api.Rows(top_row).RowHeight = std
            self._set_tmp_col_width_match_merge(ws, tmp, merge_area)
            self._copy_font_to_cell(merge_area.Cells(1, 1), tmp)
            tmp.value = text
            tmp.api.WrapText = True
            tmp.api.EntireRow.AutoFit()
            h1 = float(tmp.api.RowHeight)

            # Đo lần 2 (ổn định hơn khi Excel vừa tính xong công thức)
            ws.api.Rows(top_row).RowHeight = std
            tmp.api.EntireRow.AutoFit()
            h2 = float(tmp.api.RowHeight)
            return max(h1, h2)
        finally:
            tmp.value = old_val
            tmp.api.WrapText = old_wrap
            tmp.column_width = old_width

    def _height_from_excel_autofit(self, ws, merge_area, top_row, n_rows):
        try:
            merge_area.WrapText = True
            merge_area.Rows.AutoFit()
            return float(ws.api.Rows(top_row).RowHeight)
        except Exception:
            return 0.0

    def _autofit_light_row(self, ws, row_num):
        """Giãn nhẹ hàng kẽ (1 dòng) giữa các dòng đã cấu hình — tránh lệch khoảng cách."""
        merge_area = self._merge_area_for_row(ws, row_num)
        if merge_area is None:
            ws.api.Rows(row_num).EntireRow.AutoFit()
            return
        top_left = merge_area.Cells(1, 1)
        self._set_vertical_align_top(top_left)
        top_left.WrapText = True
        try:
            merge_area.Rows.AutoFit()
        except Exception:
            ws.api.Rows(row_num).EntireRow.AutoFit()

    def _autofit_one_row(self, ws, row_num, tmp_col, processed_merges, user_configured=True):
        merge_area = self._merge_area_for_row(ws, row_num)

        if merge_area is None:
            ws.api.Rows(row_num).EntireRow.AutoFit()
            return

        mkey = self._merge_area_key(merge_area)
        if mkey in processed_merges:
            return
        processed_merges.add(mkey)

        if not user_configured:
            self._autofit_light_row(ws, row_num)
            return

        top_row = merge_area.Row
        n_rows = merge_area.Rows.Count
        top_left = merge_area.Cells(1, 1)
        top_left.WrapText = True
        self._set_vertical_align_top(top_left)

        text = self._cell_display_text(top_left)
        if not str(text).strip():
            self._set_merge_row_heights(ws, top_row, n_rows, float(ws.api.StandardHeight))
            return

        line_count = self._estimate_line_count(text, merge_area)
        est_min = self._estimate_min_row_height(ws, line_count, n_rows)

        h_tmp = self._height_from_tmp_measure(ws, merge_area, top_row, tmp_col, text)
        h_xl = self._height_from_excel_autofit(ws, merge_area, top_row, n_rows)

        raw_max = max(h_tmp, h_xl)
        # Kéo chiều cao sát nội dung, tránh dư khoảng trắng dưới ô gộp
        new_height = est_min + (raw_max - est_min) * 0.9
        cap = est_min * 1.1 + max(0, line_count - 1) * 2
        new_height = max(est_min, min(new_height, cap))
        pad = 2 if line_count >= 2 else 1
        self._set_merge_row_heights(ws, top_row, n_rows, new_height + pad)

    def autofit_sheet(self, ws, rows):
        """Giãn chiều cao dòng đầy đủ (đo cột tạm) — không gọi khi in; dùng _autofit_sheet_for_print."""
        tmp_col = self._pick_tmp_col(ws)
        processed_merges = set()
        try:
            self._excel_force_calculate(ws, full_rebuild=False)
            for row_num in self._registered_autofit_rows(rows):
                self._autofit_one_row(
                    ws,
                    row_num,
                    tmp_col,
                    processed_merges,
                    user_configured=True,
                )
        except Exception as e:
            print("AutoFit lỗi:", e)
        finally:
            self._cleanup_tmp_col(ws, tmp_col)
    # ================= PRINT =================
    def _print_one_sheet(self, wb, sheet_var, sheet_name, value, page_index, page_total,
                         autofit_map, pdf_mode, temp_dir, temp_files):
        self._set_print_progress(page_index, page_total, sheet_name)
        ws = wb.sheets[sheet_name]
        self._excel_recalc_workbook(sheet_var, extra_sheets=[sheet_name])
        if sheet_name in autofit_map:
            try:
                self._autofit_before_print(ws, autofit_map[sheet_name])
            except Exception as ex:
                print(f"Giãn dòng khi in lỗi ({sheet_name}):", ex)
        if pdf_mode:
            temp_path = os.path.join(temp_dir, f"{sheet_name}_{value}.pdf")
            self._export_sheet_pdf(sheet_name, temp_path, ws=ws)
            temp_files.append(temp_path)
        else:
            self._print_sheet_silent(sheet_name, ws=ws)

    def run_print(self):
        autofit_map = self.get_autofit_map()

        try:
            self._refresh_workbook()
            try:
                active_name = xw.books.active.name
            except Exception:
                active_name = self.wb.name

            if active_name != self.initial_wb_name:
                QMessageBox.warning(
                    self,
                    "Cảnh báo",
                    f"Bạn đang thao tác trên workbook khác!\n\n"
                    f"Ban đầu: {self.initial_wb_name}\n"
                    f"Hiện tại: {active_name}",
                )
                return

            wb = self.wb
            sheet_name = self.combo_sheet_var.currentText().strip()
            if not sheet_name:
                QMessageBox.warning(self, "Lỗi", "Chưa chọn sheet chứa biến.")
                return

            sheet_var = wb.sheets[sheet_name]
            cell_var = self.txt_cell_var.text().strip()
            cell_check = self.txt_check_cell.text().strip()

            if not cell_var:
                QMessageBox.warning(self, "Lỗi", "Chưa nhập ô biến")
                return

            if self.txt_roi_rac.text().strip():
                values = [int(x.strip()) for x in self.txt_roi_rac.text().split(",")]
            else:
                values = list(range(
                    int(self.txt_from.text()),
                    int(self.txt_to.text()) + 1,
                ))

            if not values:
                QMessageBox.warning(self, "Lỗi", "Không có giá trị để in")
                return

            mapping_exists = self._has_mapping_selection()
            if mapping_exists and not cell_check:
                QMessageBox.warning(
                    self,
                    "Lỗi",
                    "Đã tick sheet theo điều kiện nhưng chưa nhập «Ô chứa điều kiện».",
                )
                return

            pdf_mode = self.radio_pdf.isChecked()
            self.stop_requested = False
            self.btn_stop.setEnabled(True)
            self.btn_print.setEnabled(False)
            self.progress.setVisible(True)
            self.progress.setMaximum(len(values))
            self.progress.setValue(0)
            QApplication.setOverrideCursor(Qt.WaitCursor)
            self._ensure_excel_running()
            self._activate_excel()
            self._print_batch_begin()

            temp_files = []
            temp_dir = tempfile.mkdtemp()
            merger = None
            old_printer = None
            excel_app = wb.app.api

            if pdf_mode:
                merger = PdfMerger()
            else:
                old_printer = excel_app.ActivePrinter
                printer_name = self.combo_printer.currentText()
                port = None
                for p in win32print.EnumPrinters(2):
                    if p[2] == printer_name:
                        handle = win32print.OpenPrinter(printer_name)
                        printer_info = win32print.GetPrinter(handle, 2)
                        port = printer_info["pPortName"]
                        win32print.ClosePrinter(handle)
                        break
                if not port:
                    QMessageBox.warning(self, "Lỗi", "Không tìm thấy máy in")
                    return
                excel_app.ActivePrinter = f"{printer_name} on {port}"

            try:
                total = len(values)
                for index, value in enumerate(values, start=1):
                    if self.stop_requested:
                        break

                    self._excel_set_variable_fast(sheet_var, cell_var, value)

                    if not mapping_exists:
                        self._print_one_sheet(
                            wb, sheet_var, sheet_var.name, value, index, total,
                            autofit_map, pdf_mode, temp_dir, temp_files,
                        )
                    else:
                        raw_cond = self._read_condition_cell(sheet_var, cell_check)
                        current_condition = self._normalize_condition_value(raw_cond)
                        matched = False

                        for row in range(self.table_left.rowCount()):
                            if self.stop_requested:
                                break
                            citem = self.table_left.item(row, 0)
                            if not citem:
                                continue
                            cond = citem.text().strip()
                            if (
                                not cond
                                or self._condition_key(cond)
                                != self._condition_key(current_condition)
                            ):
                                continue

                            sheets = self._checked_sheets_for_row(row)
                            if not sheets:
                                continue
                            matched = True
                            self.status_label.setText(
                                f"[{index}/{total}] Biến {value} → điều kiện «{current_condition}»"
                            )
                            QApplication.processEvents(QEventLoop.AllEvents, 30)

                            for sheet_name in sheets:
                                if self.stop_requested:
                                    break
                                self._print_one_sheet(
                                    wb, sheet_var, sheet_name, value, index, total,
                                    autofit_map, pdf_mode, temp_dir, temp_files,
                                )
                            break

                        if not matched:
                            self.status_label.setText(
                                f"[{index}/{total}] Bỏ qua biến {value} "
                                f"(ô {cell_check}=«{current_condition}» — không khớp bảng điều kiện)"
                            )
                            QApplication.processEvents(QEventLoop.AllEvents, 50)

                    self.progress.setValue(index)

                if pdf_mode and not self.stop_requested and temp_files:
                    self._pump_ui("Đang gộp file PDF…")
                    for pdf in temp_files:
                        merger.append(pdf)
                    save_path, _ = QFileDialog.getSaveFileName(
                        self,
                        "Lưu file PDF",
                        "",
                        "PDF Files (*.pdf)",
                    )
                    if save_path:
                        with open(save_path, "wb") as f:
                            merger.write(f)

                if self.stop_requested:
                    QMessageBox.information(self, "Dừng", "Đã dừng in.")
                elif pdf_mode:
                    if temp_files:
                        QMessageBox.information(self, "Xong", "Đã tạo file PDF thành công!")
                    else:
                        QMessageBox.warning(
                            self,
                            "Không có PDF",
                            "Không xuất được trang nào.\n"
                            "Kiểm tra ô biến, ô điều kiện và tick sheet in.",
                        )
                else:
                    QMessageBox.information(self, "Xong", "In hoàn thành!")

                self.status_label.setText("Hoàn thành ✔")

            finally:
                self._print_batch_end()
                try:
                    self._restore_excel_app_defaults()
                except Exception:
                    pass
                if merger is not None:
                    try:
                        merger.close()
                    except Exception:
                        pass
                if not pdf_mode and old_printer is not None:
                    try:
                        excel_app.ActivePrinter = old_printer
                    except Exception:
                        pass
                for f in temp_files:
                    if os.path.exists(f):
                        try:
                            os.remove(f)
                        except OSError:
                            pass
                try:
                    os.rmdir(temp_dir)
                except OSError:
                    pass

        except Exception as e:
            print(traceback.format_exc())
            QMessageBox.critical(self, "Lỗi in", str(e))
            self.status_label.setText("Lỗi in ✖")

        finally:
            QApplication.restoreOverrideCursor()
            self.progress.setVisible(False)
            self.btn_stop.setEnabled(False)
            self.btn_print.setEnabled(True)

def main():
    app = QApplication(sys.argv)
    if os.path.exists(ICON_APP):
        app.setWindowIcon(QIcon(ICON_APP))
    try:
        try:
            auth_session = require_login()
        except FileNotFoundError as exc:
            QMessageBox.critical(None, "Thiếu cấu hình Firebase", str(exc))
            return 1
        if auth_session is None:
            return 0

        if connect_excel_workbook() is None:
            QMessageBox.warning(
                None,
                "Cần Excel",
                "Tool cần Microsoft Excel.\n\n"
                "Hãy mở file Excel trước, hoặc chọn file khi được hỏi.",
            )
            return 1

        window = PrintControl(auth_session=auth_session)
        if not window.isVisible():
            window.show()
        return app.exec_()
    except Exception as e:
        QMessageBox.critical(
            None,
            "Lỗi khởi động",
            f"{e}\n\n{traceback.format_exc()}",
        )
        return 1


if __name__ == "__main__":
    sys.exit(main())
    