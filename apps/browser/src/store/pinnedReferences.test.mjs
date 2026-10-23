import assert from "node:assert/strict";
import { test } from "node:test";
const { useBrowser } = await import("./browser.ts");
const { awayFromPin } = await import("./organize.ts");
const { parkWindowPins, adoptParkedPins } = await import("./parkedPins.ts");
const S = () => useBrowser.getState();
const HOME = "https://example.com/home";
const AWAY = "https://example.com/away";
function setup() {
  S().hydrate({});
  const w = S().createWindow({ url: "https://regular.com" });
  const id = S().newTab(w, { url: HOME });
  const g = S().groupTabs([id], { name: "Pinned" });
  return { w, id, g };
}

test("grouped pins return without unloading and reset on unload", () => {
  const { id, g } = setup();
  assert.equal(S().tabs[id].pinned, false);
  assert.equal(S().tabs[id].pinnedUrl, HOME);
  S().updateTab(id, { url: AWAY });
  assert.equal(awayFromPin(S().tabs[id]), true);
  S().returnToPinnedUrl(id);
  assert.equal(S().tabs[id].navigation.url, HOME);
  assert.ok(S().tabs[id].navigation);
  S().setPinnedUrl(id, "https://example.com/other");
  S().updateTab(id, { url: AWAY });
  S().closeTab(id);
  assert.equal(S().tabs[id].url, "https://example.com/other");
  assert.equal(S().tabs[id].unloaded, true);
  assert.ok(S().groups[g].tabIds.includes(id));
  S().activate(id);
  assert.equal(S().tabs[id].url, "https://example.com/other");
});

test("placement retains reference between pinned containers and clears it on leaving", () => {
  const { w, id } = setup();
  S().updateTab(id, { url: AWAY });
  S().placeTabs([id], { pinned: true });
  assert.equal(S().tabs[id].pinnedUrl, HOME);
  const b = S().newTab(w, { url: "https://b.com" });
  const second = S().groupTabs([b]);
  S().placeTabs([id], { pinned: false, groupId: second });
  assert.equal(S().tabs[id].pinnedUrl, HOME);
  S().placeTabs([id], { pinned: false });
  assert.equal(S().tabs[id].pinnedUrl, null);
  S().addTabsToGroup(second, [id]);
  assert.equal(S().tabs[id].pinnedUrl, AWAY);
  S().removeTabsFromGroup([id]);
  assert.equal(S().tabs[id].pinnedUrl, null);
  S().addTabsToGroup(second, [id]);
  S().ungroup(second);
  assert.equal(S().tabs[id].pinnedUrl, null);
});

test("group pin toggles and regrouping update references", () => {
  const { id, g } = setup();
  S().updateTab(id, { url: AWAY });
  S().updateGroup(g, { pinned: false });
  assert.equal(S().tabs[id].pinnedUrl, null);
  S().moveGroup(g, { pinned: true });
  assert.equal(S().tabs[id].pinnedUrl, AWAY);
  S().updateTab(id, { url: HOME });
  S().moveGroup(g, { pinned: false });
  assert.equal(S().tabs[id].pinnedUrl, null);
  S().updateGroup(g, { pinned: true });
  assert.equal(S().tabs[id].pinnedUrl, HOME);
  S().createGroup([id]);
  assert.equal(S().tabs[id].pinnedUrl, null);
});

test("legacy grouped pins hydrate at current URL and retain references through parking", () => {
  const { w, id } = setup();
  const data = structuredClone({ windows: S().windows, tabs: S().tabs, groups: S().groups });
  data.tabs[id].pinnedUrl = null;
  S().hydrate(data);
  assert.equal(S().tabs[id].pinnedUrl, HOME);
  S().updateTab(id, { url: AWAY });
  const parked = parkWindowPins({}, S().windows[w], S());
  const snap = parked.default.tabs.find((t) => t.id === id);
  assert.equal(snap.pinnedUrl, HOME);
  assert.equal(snap.url, AWAY);
  assert.equal(snap.restoreFrom, undefined);
  const base = S();
  const adopted = adoptParkedPins({ ...base, tabs: {}, groups: {}, parkedPins: parked, windows: { [w]: { ...base.windows[w], tabIds: [] } } }, w, "default");
  assert.equal(adopted.tabs[id].pinnedUrl, HOME);
  assert.equal(adopted.tabs[id].pinned, false);
});

test("group duplicates and restores retain references; ordinary duplicates do not", () => {
  const { id, g } = setup();
  S().updateTab(id, { url: AWAY });
  const copy = S().duplicateGroup(g);
  assert.equal(S().tabs[S().groups[copy].tabIds[0]].pinnedUrl, HOME);
  const single = S().duplicateTab(id);
  assert.equal(S().tabs[single].pinnedUrl, null);
  S().closeGroup(g);
  S().restoreClosed(S().closedGroups.at(-1).id);
  const restored = Object.values(S().groups).find((group) => group.id !== copy);
  assert.equal(S().tabs[restored.tabIds[0]].pinnedUrl, HOME);
});

test("mirrored group references follow edits without navigating a loaded page", () => {
  const { id } = setup();
  const other = S().createWindow({ url: "https://other.com" });
  const copy = Object.values(S().tabs).find((t) => t.windowId === other && t.pinKey === id);
  assert.equal(copy.pinnedUrl, HOME);
  S().updateTab(id, { url: AWAY });
  S().setPinnedUrl(copy.id, "https://example.com/replaced");
  assert.equal(S().tabs[id].pinnedUrl, "https://example.com/replaced");
  assert.equal(S().tabs[id].url, AWAY);
  S().closeTab(id);
  assert.equal(S().tabs[id].url, "https://example.com/replaced");
});


test("moving a group member to another profile clears its reference", () => {
  const { id } = setup();
  S().updateTab(id, { url: AWAY });
  const profile = S().createProfile({ name: "Other" });
  S().moveTabToProfile(id, profile);
  assert.equal(S().tabs[id].pinnedUrl, null);
  assert.equal(awayFromPin(S().tabs[id]), false);
});

test("a blank pinned-group member keeps its first confirmed URL through navigation and unload", () => {
  const { g } = setup();
  const id = S().newTabInGroup(g);
  assert.equal(S().tabs[id].pinnedUrl, null);
  S().navigate(id, HOME);
  S().navigated(id, { url: HOME, title: "Home" }, {});
  assert.equal(S().tabs[id].pinnedUrl, HOME);
  S().navigate(id, AWAY);
  S().navigated(id, { url: AWAY, title: "Away" }, {});
  assert.equal(S().tabs[id].pinnedUrl, HOME);
  S().closeTab(id);
  assert.equal(S().tabs[id].url, HOME);
  assert.equal(S().tabs[id].unloaded, true);
  S().activate(id);
  assert.equal(S().tabs[id].navigation.url, HOME);
});

test("first confirmed redirects initialize blank pins once and ordinary tabs remain unpinned", () => {
  const { w, g } = setup();
  for (const kind of ["group", "standalone", "ordinary"]) {
    const id = kind === "group" ? S().newTabInGroup(g) : S().newTab(w, { pinned: kind === "standalone" });
    S().navigate(id, "https://example.com/redirect");
    S().navigated(id, { url: HOME, title: "Redirect destination" }, {});
    assert.equal(S().tabs[id].pinnedUrl, kind === "ordinary" ? null : HOME);
    S().navigated(id, { url: AWAY, title: "Later redirect" }, {});
    assert.equal(S().tabs[id].pinnedUrl, kind === "ordinary" ? null : HOME);
  }
});
