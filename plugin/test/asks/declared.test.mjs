/* What a question says about itself: the declaration it ends with, and the subjects that are the
   owner's whatever it declares. */
import assert from "node:assert/strict";
import test from "node:test";

import { OWNER_CATEGORIES, namedCategories, ownerCategories, ownersBefore, reversalOf } from "../../src/asks/declared.mjs";

const asked = (question, labels = ["Parser first (Recommended)", "Renderer first"], extra = {}) =>
  ({ question, header: "Order", options: labels.map((label) => ({ label })), ...extra });

test("a question declares its reversal only in the trailing form, and one without it is the owner's", () => {
  assert.equal(reversalOf(asked("Which slice first? [reversible: git revert the slice commit]")), "git revert the slice commit");
  assert.equal(reversalOf(asked("Which slice first? [reversible: ] ")), null, "an empty declaration declares nothing");
  assert.equal(reversalOf(asked("[reversible: x] Which slice first?")), null, "and it is the question's last words or nothing");
  assert.equal(ownersBefore(asked("Which slice first?"), OWNER_CATEGORIES), "it declares no reversal");
  assert.equal(ownersBefore(asked("Which slice first? [reversible: reorder the steps]"), OWNER_CATEGORIES), null);
});

test("a declared question naming any built-in owner category is the owner's, wherever in it the words sit", () => {
  const cases = [
    ["a secret or credential", asked("How should I supply the gateway token? [reversible: unset it]")],
    ["spend", asked("Should the plan buy the larger tier? [reversible: downgrade]")],
    ["a production or outward-facing write", asked("Which order? [reversible: redo]", ["Deploy now", "Wait"])],
    ["discarding work the owner holds", asked("Which order? [reversible: redo]", ["Keep it", "Discard it"])],
    ["filing or dropping product work", asked("Which order? [reversible: redo]", ["As one", "Split in three"])],
    ["a contract others build against", asked("How should progress reach the browser? [reversible: swap]", ["SSE", "WebSocket"])],
  ];
  for (const [name, question] of cases) {
    assert.deepEqual(namedCategories(question, OWNER_CATEGORIES), [name], question.question);
    assert.match(ownersBefore(question, OWNER_CATEGORIES), new RegExp(`it names ${name}`, "u"));
  }
  const described = asked("Which order? [reversible: redo]", ["Keep it"]);
  described.options.push({ label: "Tidy it", description: "removes the old helper" });
  assert.ok(ownersBefore(described, OWNER_CATEGORIES), "an option's description is read too");
  assert.equal(namedCategories(asked("Which slice first? [reversible: git reset --hard the slice]"), OWNER_CATEGORIES).length, 0,
    "while the declaration itself is how it is undone, not a subject");
});

test("a term the project lists sends a question naming it to the owner", () => {
  const question = asked("Which currency rounding do you want? [reversible: change the rounding flag]");
  assert.equal(ownersBefore(question, ownerCategories([])), null);
  assert.match(ownersBefore(question, ownerCategories(["currency rounding"])), /`currency rounding` \(asks\.owner\)/u);
  assert.equal(ownersBefore(asked("Which currency? [reversible: x]"), ownerCategories(["currency rounding"])), null,
    "a whole phrase, not a word of it");
});

test("no project list removes a built-in owner category", () => {
  const names = OWNER_CATEGORIES.map((one) => one.name);
  for (const terms of [[], ["spend"], ["a secret or credential"], [".*"], [""]]) {
    const held = ownerCategories(terms).map((one) => one.name);
    for (const name of names) assert.ok(held.includes(name), `${JSON.stringify(terms)} kept ${name}`);
  }
  assert.equal(ownersBefore(asked("Which slice first? [reversible: reorder]"), ownerCategories([".*"])), null,
    "and a pattern in the list is a phrase to find, never a pattern that matches everything");
});

test("a declared Vietnamese question naming a built-in owner subject is the owner's with no English word in it", () => {
  const cases = [
    ["a secret or credential", "Nhập mật khẩu của máy chủ ở đâu?"],
    ["spend", "Có nên thanh toán cho bản lớn hơn không?"],
    ["a production or outward-facing write", "Có triển khai bản này bây giờ không?"],
    ["discarding work the owner holds", "Xóa các file nháp này?"],
    ["discarding work the owner holds", "Xoá nhánh này?"],
    ["discarding work the owner holds", "Hủy các thay đổi chưa commit?"],
    ["discarding work the owner holds", "Huỷ các thay đổi này?"],
    ["filing or dropping product work", "Có nên tách việc này làm ba không?"],
    ["a contract others build against", "Có nên đổi tên lệnh này không?"],
  ];
  for (const [name, text] of cases) {
    const question = asked(`${text} [reversible: làm lại]`, ["Có", "Không"], { header: "Hỏi" });
    assert.deepEqual(namedCategories(question, OWNER_CATEGORIES), [name], text);
    assert.equal(ownersBefore(question, OWNER_CATEGORIES), `it names ${name}`, text);
  }
});

test("a sum in đồng is spend while đồng ý and đồng bộ are not", () => {
  const vi = (text) => asked(`${text} [reversible: làm lại]`, ["Có", "Không"], { header: "Hỏi" });
  for (const text of ["Trả 500 đồng cho bản này?", "Chi 2 triệu đồng cho máy chủ này?", "Giá 50.000 VNĐ có được không?"]) {
    assert.deepEqual(namedCategories(vi(text), OWNER_CATEGORIES), ["spend"], text);
  }
  for (const text of ["Bạn đồng ý với thứ tự này không?", "Có nên đồng bộ trước không?"]) {
    assert.equal(ownersBefore(vi(text), OWNER_CATEGORIES), null, text);
  }
});

test("a declared question in a language or a script the screen does not read is the owner's", () => {
  const language = /^it is in a language the screen cannot read \(it reads English and Vietnamese\)$/u;
  for (const text of ["Faut-il garder les brouillons ?", "¿Mantenemos los borradores?", "Welche Reihenfolge nehmen wir?",
    "Mantemos os rascunhos não usados?"]) {
    assert.match(String(ownersBefore(asked(`${text} [reversible: redo]`, ["A", "B"], { header: "Ordre" }), OWNER_CATEGORIES)), language, text);
  }
  assert.match(String(ownersBefore(asked("Proceed? [reversible: redo]", ["A", "B"], { header: "Next" }), OWNER_CATEGORIES)), language,
    "a terse English question carrying no mark of English is not one the screen can place, so it goes to the owner too");
  for (const [text, letter] of [["Soll ich die Entwürfe behalten?", "ü"], ["先做哪一个?", "先"], ["Какой порядок?", "К"],
    ["Which order should the 草稿 take?", "草"]]) {
    assert.equal(ownersBefore(asked(`${text} [reversible: redo]`, ["A", "B"], { header: "Order" }), OWNER_CATEGORIES),
      `it holds \`${letter}\`, a letter the screen cannot read (it reads English and Vietnamese)`, text);
  }
});

test("a declared English or Vietnamese question naming no owner subject may still be judged", () => {
  assert.equal(ownersBefore(asked("Which slice first? [reversible: reorder the steps]"), OWNER_CATEGORIES), null);
  assert.equal(ownersBefore(asked("Làm phần parser trước hay renderer trước? [reversible: đổi thứ tự]", ["Parser", "Renderer"],
    { header: "Thứ tự" }), OWNER_CATEGORIES), null);
  assert.equal(ownersBefore(asked("Bỏ qua bước này nhé? [reversible: chạy lại bước đó]", ["Có", "Không"], { header: "Bước" }),
    OWNER_CATEGORIES), null, "bỏ qua is to skip, not to discard");
  assert.equal(ownersBefore(asked("Gỡ lỗi phần nào trước? [reversible: đổi thứ tự]", ["Parser", "Renderer"], { header: "Gỡ lỗi" }),
    OWNER_CATEGORIES), null, "gỡ lỗi is to debug, not to remove");
});

test("a Vietnamese term the project lists is matched as a whole word in either tone placement", () => {
  const vi = (text) => asked(`${text} [reversible: làm lại]`, ["Có", "Không"], { header: "Hỏi" });
  const terms = ownerCategories(["hoá học"]);
  assert.match(String(ownersBefore(vi("Có dùng hóa học ở đây không?"), terms)), /`hoá học` \(asks\.owner\)/u);
  assert.equal(ownersBefore(vi("Có dùng hóa họcx ở đây không?"), terms), null, "a whole phrase, not the start of a word");
  assert.equal(ownersBefore(vi("Bạn đồng ý không?"), ownerCategories(["ồng"])), null, "nor the end of one after a Vietnamese letter");
  for (const name of OWNER_CATEGORIES.map((one) => one.name)) assert.ok(terms.some((one) => one.name === name), name);
});

test("a Vietnamese owner term typed without its diacritics is still the owner's, and only words without them are folded", () => {
  for (const text of ["Xoa these files?", "Xoa cac file nhap nay?", "Huy these changes first?"]) {
    assert.deepEqual(namedCategories(asked(`${text} [reversible: redo]`), OWNER_CATEGORIES), ["discarding work the owner holds"], text);
  }
  for (const text of ["Day len ban nay?", "Đay len ban nay?"]) {
    assert.deepEqual(namedCategories(asked(`${text} [reversible: redo]`), OWNER_CATEGORIES), ["a production or outward-facing write"],
      `${text}: đ is kept by a writer who skips the tone marks`);
  }
  assert.equal(ownersBefore(asked("Cải tiến phần nào trước? [reversible: đổi thứ tự]", ["Parser", "Renderer"], { header: "Thứ tự" }),
    OWNER_CATEGORIES), null, "tiến (progress) is not folded into tiền (money)");
  assert.equal(ownersBefore(asked("Should I go with the parser first? [reversible: redo]"), OWNER_CATEGORIES), null,
    "and gỡ is not read into the English go");
});
