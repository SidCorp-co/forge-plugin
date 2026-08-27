"""Call-to-action discipline: a button says the verb, the screen says the noun.

`Lưu` works on every form in the product. `Lưu khách hàng` works on one, needs its
own key, and drifts from `Lưu cơ hội` the moment someone edits one of them. The
checks here find labels that grew an object the English source never had, and
report the per-screen action keys a shared generic key would already cover.
"""

import re
from collections import defaultdict

# The bare English CTAs, and the bare Vietnamese label each one should land on.
GENERIC = {
    "save": "Lưu", "cancel": "Hủy", "delete": "Xóa", "remove": "Xóa", "edit": "Sửa",
    "create": "Tạo", "add": "Thêm", "close": "Đóng", "submit": "Gửi", "send": "Gửi",
    "apply": "Áp dụng", "reset": "Đặt lại", "retry": "Thử lại", "confirm": "Xác nhận",
    "continue": "Tiếp tục", "back": "Quay lại", "next": "Tiếp", "done": "Xong",
    "copy": "Sao chép", "share": "Chia sẻ", "invite": "Mời", "upload": "Tải lên",
    "download": "Tải về", "select": "Chọn", "search": "Tìm", "filter": "Lọc",
    "clear": "Xóa", "refresh": "Làm mới", "open": "Mở", "view": "Xem", "run": "Chạy",
    "export": "Xuất", "import": "Nhập", "rename": "Đổi tên", "duplicate": "Nhân bản",
    "discard": "Bỏ", "dismiss": "Bỏ qua", "skip": "Bỏ qua", "start": "Bắt đầu",
    "stop": "Dừng", "pause": "Tạm dừng", "resume": "Tiếp tục", "assign": "Gán",
    "archive": "Lưu trữ", "restore": "Khôi phục", "publish": "Phát hành",
    "preview": "Xem trước", "print": "In", "sign in": "Đăng nhập",
    "sign out": "Đăng xuất", "sign up": "Đăng ký", "log in": "Đăng nhập",
    "log out": "Đăng xuất", "update": "Cập nhật", "revoke": "Thu hồi",
    "activate": "Kích hoạt", "deactivate": "Vô hiệu hóa", "reactivate": "Kích hoạt lại",
    "convert": "Chuyển đổi", "reject": "Từ chối", "approve": "Duyệt",
}

# Vietnamese verbs are written in syllables, so word count says nothing: "Áp dụng"
# is one verb and "Xóa tỷ giá" is a verb plus an object. Only a lexicon separates
# them. A file's own generic layer extends this set at runtime.
VI_BARE = {
    "lưu", "hủy", "huỷ", "xóa", "xoá", "sửa", "tạo", "thêm", "đóng", "gửi", "mở",
    "xem", "chọn", "lọc", "chạy", "nhập", "xuất", "gán", "mời", "in", "tiếp",
    "xong", "bỏ", "dừng", "duyệt", "chép", "áp dụng", "đặt lại", "thử lại",
    "xác nhận", "tiếp tục", "quay lại", "sao chép", "chia sẻ", "tải lên", "tải về",
    "tải xuống", "làm mới", "đổi tên", "nhân bản", "bỏ qua", "bắt đầu", "tạm dừng",
    "lưu trữ", "khôi phục", "phát hành", "xem trước", "đăng nhập", "đăng xuất",
    "đăng ký", "cập nhật", "thu hồi", "kích hoạt", "vô hiệu hóa", "vô hiệu hoá",
    "kích hoạt lại", "chuyển đổi", "từ chối", "hoàn thành", "hoàn tác", "tìm",
    "tìm kiếm", "gửi lại", "mở lại", "đóng lại", "tải lại", "thoát", "đồng ý",
}

# Key paths where a specific label is the correct answer: statuses and steps name a
# state, permissions name a right, audit entries name an event, and an aria label on
# an icon button has no visible screen to supply the noun.
NOT_A_BUTTON = re.compile(
    r"(status|state|step|switch|loading|title|column|group|target|reason|"
    r"permission|audit|placeholder|menu|aria|label|heading|badge|tab|nav|"
    r"empty|hint|notice|error|toast)",
    re.I,
)


def normalize(text):
    return text.strip().strip("…").strip(".?!:").strip().lower()


def is_action_key(label):
    return not NOT_A_BUTTON.search(label)


SHARED_NAMESPACE = re.compile(r"^(common|shared|actions?|buttons?|ui|global)\.", re.I)


def generic_index(pairs):
    """Bare CTAs the file already carries: vi label → the key that owns it.

    `pairs` is (key label, english, vietnamese). Two ways in: the label is a known
    bare verb, or it lives in a shared namespace, where being the one reusable key
    is the whole point. A per-screen key never teaches its own label to the checker
    — otherwise `rates.removeRate` would license "Xóa tỷ giá" and check itself.
    """
    index = {}
    for label, english, vietnamese in pairs:
        if normalize(english) not in GENERIC or not vietnamese:
            continue
        if normalize(vietnamese) in VI_BARE or SHARED_NAMESPACE.match(label):
            index.setdefault(normalize(vietnamese), label)
    return index


def accepted(index=None):
    return VI_BARE | set(index or {})


def is_bare(vietnamese, index=None):
    label = normalize(vietnamese)
    # One syllable is always one word, so it cannot be a verb plus an object.
    if label and " " not in label:
        return True
    return label in accepted(index)


def inflated(pairs, index=None):
    """Labels the translation made specific when the source was generic.

    English says `Remove`; Vietnamese says `Xóa tỷ giá`. The button now belongs to
    one screen. This is a defect regardless of how the rest of the file is written.
    """
    findings = []
    for label, english, vietnamese in pairs:
        key = normalize(english)
        if key not in GENERIC or not vietnamese:
            continue
        if not is_action_key(label) or is_bare(vietnamese, index):
            continue
        suggestion = GENERIC[key]
        owner = (index or {}).get(normalize(suggestion))
        findings.append({
            "key": label,
            "en": english,
            "vi": vietnamese,
            "suggested": suggestion,
            "existing": owner,
        })
    return findings


def collapse_groups(pairs, index=None, minimum=3):
    """Per-screen action keys a shared generic key would already cover."""
    groups = defaultdict(list)
    for label, english, vietnamese in pairs:
        words = normalize(english).split()
        if not 2 <= len(words) <= 4 or words[0] not in GENERIC:
            continue
        if not is_action_key(label) or "{" in vietnamese:
            continue
        # "Close outcome" → "Kết quả đóng" is a noun phrase, not a button whose verb
        # could be shared. Only a label that leads with the verb is a candidate.
        if not normalize(vietnamese).startswith(normalize(GENERIC[words[0]])):
            continue
        groups[words[0]].append({"key": label, "en": english, "vi": vietnamese})

    out = []
    for verb, members in groups.items():
        if len(members) < minimum:
            continue
        bare = GENERIC[verb]
        out.append({
            "verb": verb,
            "bare": bare,
            "existing": (index or {}).get(normalize(bare)),
            "members": sorted(members, key=lambda m: m["key"]),
        })
    return sorted(out, key=lambda g: -len(g["members"]))
