import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import StatusBadge from "../components/StatusBadge";
import { suggestLinks } from "../lib/similarity";

const OPPOSITE_TAB = {
  "Internal DD Request List": "External DD List",
  "External DD List": "Internal DD Request List",
};

const STATUSES = ["Open", "Closed", "Blocked", "At Risk", "Deleted"];

export default function ItemDetail() {
  const { itemId } = useParams();
  const [item, setItem] = useState(null);
  const [linkedItems, setLinkedItems] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const [linking, setLinking] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const loaded = await api.getItem(itemId);
      setItem(loaded);

      if (loaded.linked_items?.length) {
        const linked = await Promise.all(loaded.linked_items.map((id) => api.getItem(id).catch(() => null)));
        setLinkedItems(linked.filter(Boolean));
      } else {
        setLinkedItems([]);
      }

      const oppositeTab = OPPOSITE_TAB[loaded.source_tab];
      if (oppositeTab && loaded.document) {
        const candidates = await api.getItems("deal-1", oppositeTab);
        const alreadyLinked = new Set(loaded.linked_items ?? []);
        const pool = candidates.filter((c) => c.status !== "Deleted" && !alreadyLinked.has(c.item_id));
        setSuggestions(suggestLinks(loaded, pool));
      } else {
        setSuggestions([]);
      }
    } catch (e) {
      setError(e.message);
    }
  }, [itemId]);

  useEffect(() => {
    setItem(null);
    load();
  }, [load]);

  async function handleStatusChange(newStatus) {
    const updated = await api.updateItem(itemId, { status: newStatus });
    setItem(updated);
  }

  async function handleAddComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSavingComment(true);
    try {
      const updated = await api.addComment(itemId, { author: "You", text: commentText.trim() });
      setItem(updated);
      setCommentText("");
    } finally {
      setSavingComment(false);
    }
  }

  async function handleLink(targetId) {
    setLinking(targetId);
    try {
      await api.linkItems(itemId, targetId);
      await load();
    } finally {
      setLinking(null);
    }
  }

  if (error) return <p className="text-[#e0393e]">Failed to load item: {error}</p>;
  if (!item) return <p className="text-[#86868b]">Loading…</p>;

  const unclosedLinks = linkedItems.filter((l) => l.status !== "Closed");

  return (
    <div className="max-w-3xl">
      <Link to="/" className="text-[13px] text-[#0071e3] hover:underline">
        ← Back
      </Link>

      <div className="flex items-start justify-between gap-4 mt-3 mb-1">
        <h1 className="text-[26px] font-semibold tracking-tight text-[#1d1d1f] dark:text-white">
          {item.action_item ?? item.document}
        </h1>
      </div>
      <p className="text-[13px] text-[#86868b] mb-6">
        {item.item_id} · {item.source_tab}
        {item.category && ` · ${item.category}`}
        {item.department && ` · ${item.department}`}
      </p>

      {unclosedLinks.length > 0 && (
        <div className="mb-6 rounded-xl bg-[#fff4e5] dark:bg-[#3a2a0a] ring-1 ring-[#f5a623]/30 px-4 py-3">
          <p className="text-[13px] font-medium text-[#a05a00] dark:text-[#f5a623]">
            Blocked by open dependencies
          </p>
          <ul className="mt-1 text-[13px] text-[#a05a00] dark:text-[#f5a623]/80 list-disc list-inside">
            {unclosedLinks.map((l) => (
              <li key={l.item_id}>
                <Link to={`/items/${l.item_id}`} className="hover:underline">
                  {l.item_id}: {l.action_item ?? l.document} ({l.status})
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl bg-white dark:bg-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-black/5 dark:ring-white/10 divide-y divide-black/5 dark:divide-white/5 overflow-hidden mb-6">
        <Row label="Status">
          <div className="flex items-center gap-3">
            <StatusBadge status={item.status} />
            <select
              value={item.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="rounded-lg border-0 ring-1 ring-black/10 dark:ring-white/15 bg-[#f5f5f7] dark:bg-white/5 px-2.5 py-1 text-[12px] text-[#1d1d1f] dark:text-white"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </Row>
        <Row label="Responsible Party">{item.responsible_party}</Row>
        {item.external_party && <Row label="External Party">{item.external_party}</Row>}
        {item.div_folder && <Row label="DIV Folder">{item.div_folder}</Row>}
        {item.outside_date_raw !== undefined && (
          <Row label="Outside Date">{item.outside_date ?? item.outside_date_raw ?? "—"}</Row>
        )}
        {"is_critical_path" in item && (
          <Row label="Critical Path">{item.is_critical_path ? "Yes" : "No"}</Row>
        )}
        {"is_internal" in item && <Row label="Internal">{item.is_internal ? "Yes" : "No"}</Row>}
        <Row label="Opened">{item.opened_date}</Row>
        <Row label="Last Updated">{item.last_updated}</Row>
      </div>

      {suggestions.length > 0 && (
        <Section title="Suggested Links">
          <p className="text-[13px] text-[#86868b] mb-3">
            These {OPPOSITE_TAB[item.source_tab].toLowerCase()} items look like they refer to the same document.
          </p>
          <div className="space-y-2">
            {suggestions.map(({ item: s, score }) => (
              <div
                key={s.item_id}
                className="flex items-center justify-between gap-3 rounded-xl bg-[#f5f5f7] dark:bg-white/5 px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[#1d1d1f] dark:text-white truncate">{s.document}</p>
                  <p className="text-[11px] text-[#86868b]">
                    {s.item_id} · {Math.round(score * 100)}% match
                  </p>
                </div>
                <button
                  onClick={() => handleLink(s.item_id)}
                  disabled={linking === s.item_id}
                  className="shrink-0 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white px-3.5 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-50"
                >
                  {linking === s.item_id ? "Linking…" : "Link"}
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {linkedItems.length > 0 && (
        <Section title="Linked Items">
          <div className="space-y-2">
            {linkedItems.map((l) => (
              <Link
                key={l.item_id}
                to={`/items/${l.item_id}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-[#f5f5f7] dark:bg-white/5 px-4 py-2.5 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              >
                <span className="text-[13px] font-medium text-[#1d1d1f] dark:text-white truncate">
                  {l.item_id}: {l.action_item ?? l.document}
                </span>
                <StatusBadge status={l.status} />
              </Link>
            ))}
          </div>
        </Section>
      )}

      <Section title="Comments">
        <div className="space-y-3 mb-4">
          {item.comments.length === 0 && <p className="text-[13px] text-[#86868b]">No comments yet.</p>}
          {item.comments.map((c, i) => (
            <div key={i} className="rounded-xl bg-[#f5f5f7] dark:bg-white/5 px-4 py-2.5">
              <p className="text-[11px] font-medium text-[#86868b] uppercase tracking-wide">
                {c.author} · {c.timestamp}
              </p>
              <p className="text-[13px] text-[#1d1d1f] dark:text-white mt-0.5">{c.text}</p>
            </div>
          ))}
        </div>
        <form onSubmit={handleAddComment} className="flex gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment…"
            className="flex-1 rounded-lg border-0 ring-1 ring-black/10 dark:ring-white/15 bg-white dark:bg-[#1d1d1f] px-3 py-1.5 text-[13px] text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0071e3] transition-shadow"
          />
          <button
            type="submit"
            disabled={savingComment}
            className="rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white px-4 py-1.5 text-[13px] font-medium transition-colors disabled:opacity-50"
          >
            Add
          </button>
        </form>
      </Section>

      {item.history.length > 0 && (
        <Section title="History">
          <div className="space-y-2">
            {[...item.history].reverse().map((h, i) => (
              <p key={i} className="text-[13px] text-[#6e6e73] dark:text-white/60">
                <span className="text-[#86868b]">{h.timestamp}</span> — {h.field} changed
                {h.old_value ? ` from "${h.old_value}"` : ""} to "{h.new_value}"
              </p>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3 text-[13px]">
      <span className="text-[#6e6e73] dark:text-white/60 w-40 shrink-0">{label}</span>
      <span className="flex-1 text-[#1d1d1f] dark:text-white">{children}</span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#86868b] mb-3">{title}</h2>
      {children}
    </div>
  );
}
