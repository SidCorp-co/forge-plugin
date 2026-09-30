/* What a question says about itself before anything judges it: whether the session declared how its
   answer is undone, and whether it names a subject that is the owner's whatever it declares. The
   words are a check against a false declaration and never a reason to decide.
   plugin/hooks/how/ask-decide.md. */
import { escaped } from "../markdown.mjs";

/* The tool's schema strips any key it does not declare before a hook sees the call, so the
   declaration rides the one field the owner also reads: the question's own last words. */
const DECLARED = /\[reversible:\s*([^\]\n]*[^\]\s])\s*\]\s*$/u;

/** The question's own words, its declaration taken off: how it is undone is not what it asks. */
export const withoutDeclaration = (question) => String(question?.question ?? "").replace(DECLARED, "");

/** How one question says it is undone, or null where it says nothing. */
export const reversalOf = (question) => DECLARED.exec(String(question?.question ?? ""))?.[1] ?? null;

/** The one line a session is told about the form, spelt once for the gate and its page. */
export const DECLARE_FORM = "[reversible: <the one command or correction that undoes the choice>]";

/* JavaScript's `\b` is ASCII-only even under `u`, so a term beside a Vietnamese letter never bounds:
   every `\b` in a built-in pattern is this one instead, and English terms keep their meaning. */
const WORDLIKE = String.raw`\p{L}\p{M}\p{N}_`;
const LETTER = `[${WORDLIKE}]`;
const BOUNDARY = String.raw`(?:(?<=${LETTER})(?!${LETTER})|(?<!${LETTER})(?=${LETTER}))`;
const bounded = (source) => new RegExp(source.replaceAll(String.raw`\b`, BOUNDARY), "iu");

/* Vietnamese spells a tone on either vowel of `oa`, `oe` and `uy` (`xóa` and `xoá`), so a term is
   matched in both placements; the text itself is NFC before anything reads it. */
const TONE_FIRST = /([ou])([\u0300\u0301\u0303\u0309\u0323])([aey])/gu;
const TONE_LAST = /([ou])([aey])([\u0300\u0301\u0303\u0309\u0323])/gu;
const spellings = (term) => {
  const nfd = term.normalize("NFD");
  return [...new Set([nfd, nfd.replace(TONE_FIRST, "$1$3$2"), nfd.replace(TONE_LAST, "$1$3$2")]
    .map((one) => one.normalize("NFC")))];
};
/* Literal Vietnamese terms, each a whole phrase, beside patterns written out where a word needs a
   guard (`bỏ qua` is to skip, `gỡ lỗi` to debug, `đồng ý` to agree). */
const phrase = (term) => escaped(term).replace(/ /gu, String.raw`\s+`);
const vietnamese = (terms, patterns = []) => [
  ...terms.flatMap(spellings).map(phrase),
  ...patterns,
].join("|");

/* Vietnamese typed without its diacritics is still Vietnamese, so each literal term is also read
   folded, but only against the words of a question that carry no diacritic themselves: folding a
   word that has them would merge `tiến` (progress) into `tiền` (money). `đ` alone does not count, as it
   is a letter of its own that a writer skipping tone marks still types. The guarded patterns are not
   folded, since `gỡ` and `bỏ` fold into the English `go` and `bo`. */
const folded = (text) => text.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/giu, "d");
const bare = (text) => folded(text.replace(new RegExp(String.raw`${LETTER}*[^\x00-\x7fđ\s\p{P}\p{S}]${LETTER}*`, "giu"), " "));

const category = (name, english, terms, patterns) => ({
  name,
  pattern: bounded(String.raw`${english}|\b(?:${vietnamese(terms, patterns)})\b`),
  unaccented: bounded(String.raw`\b(?:${[...new Set(terms.map(folded))].map(phrase).join("|")})\b`),
});
const words = (list) => String.raw`\b(?:${list.join("|")})\b`;

/* Six subjects whose answer is the owner's input. The first five are the issue's; the sixth is what
   the owner's own overrides held that none of the five reached — a transport, a command's shape.
   Each is read in English and in Vietnamese, the two languages the owners here write in. */
export const OWNER_CATEGORIES = [
  category("a secret or credential",
    String.raw`\b(?:secrets?|credentials?|passwords?|passphrases?|tokens?|api[- ]?keys?|`
      + String.raw`(?:private|ssh|access|signing|license|gateway|provider|service)[- ]keys?|reveal|oauth|pat|`
      + String.raw`paste (?:it|the \S+)|env(?:ironment)? var(?:iable)?s?)\b|\b(?:the|a|your|its|my)\s+`
      + String.raw`(?!(?:issue|project|config|configuration|setting|settings|sort|primary|foreign|cache|map|lookup|`
      + String.raw`json|object|dictionary|record|table|same|one|first|last|next)\b)[\w.-]+\s+keys?\b`,
    ["mật khẩu", "bí mật", "khóa riêng", "khóa api", "khóa ssh", "khóa truy cập", "khóa ký", "mã truy cập",
      "mã xác thực", "mã bảo mật", "mã otp", "thông tin đăng nhập", "biến môi trường", "tiết lộ", "dán khóa", "dán mã"]),
  category("spend",
    String.raw`\b(?:money|pay|paid|payment|billing|billed|invoice|purchase|buy|`
      + String.raw`subscription|price|pricing|credit card|dollars?|usd|vnd)\b|\$\s?\d`,
    ["tiền", "thanh toán", "trả phí", "chi phí", "phí", "mua", "hóa đơn", "gói cước", "thẻ tín dụng", "ngân sách", "vnđ"],
    [String.raw`\d[\d.,]*\s*(?:(?:nghìn|ngàn|triệu|tỷ|tỉ|k)\s*)?đồng`]),
  category("a production or outward-facing write",
    words(["production", "prod", "live (?:site|domain|domains|server|servers|users?|traffic|zones?)",
      "deploy(?:s|ed|ing|ment)?", "releases?", "publish(?:es|ed|ing)?", "go live", "customers?", "e-?mails?",
      "announce(?:ment)?", "public", "dns", "domains?", "force[- ]push", "push(?:es|ed)? to (?:origin|main|master|remote)"]),
    ["triển khai", "phát hành", "xuất bản", "công bố", "khách hàng", "người dùng thật", "môi trường thật",
      "máy chủ thật", "chạy thật", "lên sóng", "đẩy lên", "đẩy thẳng", "tên miền", "công khai", "gửi thư"]),
  category("discarding work the owner holds",
    words(["discard(?:s|ed|ing)?", "delet(?:e|es|ed|ing)", "remov(?:e|es|ed|ing)", "drop(?:s|ped|ping)?",
      "reset", "revert(?:s|ed|ing)?", "overwrit(?:e|es|ing|ten)", "stash(?:es|ed)?", "wipe", "purge", "prune",
      "throw away", "uncommitted", "unstaged", "dirty", "modifications?", "your (?:changes|work|edits|files)"]),
    ["xóa", "hủy", "loại bỏ", "vứt", "hoàn tác", "đặt lại", "ghi đè", "dọn dẹp", "làm sạch", "chưa commit",
      "chưa lưu", "chưa đẩy", "thay đổi của bạn", "việc của bạn", "làm lại từ đầu"],
    [String.raw`bỏ\b(?!\s+qua\b)`, String.raw`gỡ\b(?!\s+lỗi\b)`]),
  category("filing or dropping product work",
    words(["file(?:d|s)? (?:it|them|an? issues?|issues?)", "filing", "backlog", "tickets?",
      String.raw`(?:file|open|create|split|close|drop|park|merge|fold|reopen)\w*\b[^.?\n]{0,40}\bissues?`,
      String.raw`(?:one|two|three|four|nine|\d+|separate|own|single|grouped|several) issues?`,
      "split(?:ting)?", "close (?:it|them|the issue)", "park(?:ed|ing)?", "fold (?:it|them) into", "scope"]),
    ["tạo issue", "mở issue", "đóng issue", "nộp issue", "ghi issue", "tách", "gộp", "hoãn", "tồn đọng", "phạm vi", "phiếu"]),
  category("a contract others build against",
    words(["wire", "protocol", "transport", "sse", "websockets?", "stream(?:s|ing)?", "api", "endpoints?",
      "schema", "(?:wire|data|file|output|payload) formats?", "bin", "binar(?:y|ies)", "subcommands?", "verbs?", "cli", "packages?", "boundar(?:y|ies)",
      "renam(?:e|ed|ing)"]),
    ["giao thức", "định dạng dữ liệu", "định dạng tệp", "định dạng file", "định dạng đầu ra", "lược đồ", "đổi tên",
      "giao diện lập trình", "điểm cuối", "gói", "ranh giới", "lệnh con", "luồng dữ liệu", "nhị phân"]),
];

/* The screen reads two languages, so a question it cannot place in either goes to the owner rather
   than past a screen that never read it. A letter outside both alphabets is one it cannot read at
   all; otherwise the text has to carry a mark of one of the two: a common English word, or a letter
   or a common word only Vietnamese has. */
const ALPHABET = /[a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/iu;
const ENGLISH = bounded(String.raw`\b(?:the|this|these|that|those|which|what|when|where|how|why|should|shall|would|`
  + String.raw`could|can|does|are|it|its|or|and|with|from|into|you|your|we|keep|first|now|instead)\b`);
const VIETNAMESE = new RegExp(String.raw`[ăđơưạảằắẳẵặầấẩẫậẹẻẽềếểễệỉĩịọỏồốổỗộờớởỡợụủũừứửữựỳỷỹỵ]|`
  + bounded(String.raw`\b(?:này|các|không|có|được|của|với|những|hoặc|nên|và|là|để|trước|bạn|mình|tôi|chưa|rồi|nào|gì|`
  + String.raw`thế|một|cũng|đã|sẽ|đang|thì|mà|vào|lên|xuống)\b`).source, "iu");
const READS = "it reads English and Vietnamese";

/** Why the screen cannot read this text, or null where it can. */
const unreadable = (text) => {
  const letter = [...text.matchAll(/\p{L}/gu)].find(([one]) => !ALPHABET.test(one))?.[0];
  if (letter) return `it holds \`${letter}\`, a letter the screen cannot read (${READS})`;
  if (ENGLISH.test(text) || VIETNAMESE.test(text)) return null;
  return `it is in a language the screen cannot read (${READS})`;
};

/** The project's own terms, each a whole word or phrase and never a pattern: an entry that fails to
 *  compile or matches everything is not a category a project meant to add. */
export const ownerCategories = (terms = []) => [
  ...OWNER_CATEGORIES,
  ...terms.filter((term) => String(term).trim()).map((term) => ({ name: `\`${term}\` (asks.owner)`,
    pattern: new RegExp(String.raw`(?<![${WORDLIKE}-])(?:${spellings(String(term)).map(escaped).join("|")})(?![${WORDLIKE}-])`, "iu") })),
];

/* Everything a question puts in front of the owner, the declaration itself excepted: a reversal
   naming `git revert` is how the session says it is undone, not a subject. */
const textOf = (question) => [
  withoutDeclaration(question),
  question?.header,
  ...(Array.isArray(question?.options) ? question.options.flatMap((one) => [one?.label, one?.description]) : []),
].filter((one) => typeof one === "string").join("\n").normalize("NFC");

/** The owner categories one question names, by name; empty where it names none. */
export const namedCategories = (question, categories) => {
  const text = textOf(question);
  const plain = bare(text);
  return categories.filter((one) => one.pattern.test(text) || one.unaccented?.test(plain)).map((one) => one.name);
};

/** Why a question is the owner's before any precedent is read, or null where it may be judged. */
export const ownersBefore = (question, categories) => {
  if (!reversalOf(question)) return "it declares no reversal";
  if (!Array.isArray(question?.options) || question.options.length < 2) return "it offers no options to choose between";
  const named = namedCategories(question, categories);
  return named.length ? `it names ${named.join(", ")}` : unreadable(textOf(question));
};
