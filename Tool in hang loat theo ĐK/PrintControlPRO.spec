# -*- mode: python ; coding: utf-8 -*-

block_cipher = None


def _drop_api_ms_win(binaries):
    """Không gói api-ms-win-* từ JDK trong PATH — gây crash im lặng trên máy khác."""
    return [
        entry
        for entry in binaries
        if not entry[0].lower().startswith("api-ms-win")
    ]


datas = [
    ('firebase_config.json', '.'),
    ('printer_icon.ico', '.'),
]

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=[
        'firebase_auth',
        'win32print',
        'win32gui',
        'win32con',
        'win32api',
        'win32com',
        'win32com.client',
        'pythoncom',
        'pywintypes',
        'xlwings',
        'PyPDF2',
        'requests',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

a.binaries = _drop_api_ms_win(a.binaries)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='Print QLCL',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='printer_icon.ico',
)
