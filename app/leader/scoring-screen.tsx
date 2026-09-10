"use client";

import { useMemo, useRef, useState } from "react";
import { awardPointsAction, recordAttendanceAction } from "./actions";
import type {
  AttendanceStatus,
  AttentionScout,
  RosterScout,
} from "@/lib/server/leader-roster";

const TIERS = [
  { value: "minor", label: "Minor", points: 10 },
  { value: "standard", label: "Standard", points: 25 },
  { value: "major", label: "Major", points: 50 },
  { value: "epic", label: "Epic", points: 100 },
] as const;

type TierValue = (typeof TIERS)[number]["value"];

const EXCUSE_CATEGORIES = [
  { value: "unwell", label: "Unwell" },
  { value: "exams", label: "Exams" },
  { value: "family", label: "Family" },
  { value: "travel", label: "Travel" },
  { value: "transport", label: "Transport" },
  { value: "other", label: "Other" },
  { value: "none_given", label: "Prefer not to say" },
] as const;

const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  present: "P",
  absent: "A",
  excused: "E",
};

const ATTENDANCE_ACTIVE_CLASS: Record<AttendanceStatus, string> = {
  present: "bg-emerald-600 text-white",
  absent: "bg-rose-600 text-white",
  excused: "bg-amber-500 text-white",
};

export function ScoringScreen({
  sessionId,
  initialRoster,
  attentionNeeded,
}: {
  sessionId: string;
  initialRoster: RosterScout[];
  attentionNeeded: AttentionScout[];
}) {
  const [roster, setRoster] = useState(initialRoster);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tier, setTier] = useState<TierValue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [excuseFormFor, setExcuseFormFor] = useState<string | null>(null);
  const [showAttention, setShowAttention] = useState(false);

  // The actual double-submit guard. A `useTransition` `isPending` flag is
  // NOT synchronous — React schedules that update at low priority, so two
  // clicks dispatched back-to-back can both read `isPending === false`
  // before React ever commits the first one (confirmed with a Playwright
  // test that fired two click events synchronously: the button's `disabled`
  // attribute hadn't updated yet by the time the second one landed). A ref,
  // set and checked with a plain `if` before any state update, is checked
  // synchronously in JS and closes that race entirely. `isSaving` (state)
  // still drives the visible disabled/"Saving…" UI — belt and braces, not
  // the actual guard.
  const isSavingRef = useRef(false);

  // One key per "batch" (this exact set of scouts + tier), reused across a
  // retry so a double-tap or a flaky-network retry never double-awards —
  // award_points()'s own idempotency (Task 04) is the real backstop, this
  // just means a retry actually replays the same key instead of minting a
  // new one.
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  const selectedCount = selected.size;

  function toggleScout(personId: string) {
    if (isSaving) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(personId)) next.delete(personId);
      else next.add(personId);
      return next;
    });
  }

  function selectTier(value: TierValue) {
    if (isSaving) return;
    setTier(value);
  }

  const canConfirm = selectedCount > 0 && tier !== null && !isSaving;

  async function confirm() {
    if (isSavingRef.current || !canConfirm || tier === null) return;
    isSavingRef.current = true;
    setIsSaving(true);

    const personIds = Array.from(selected);
    const idempotencyKey = idempotencyKeyRef.current;
    setError(null);

    // Optimistic: mark these scouts as awarded immediately.
    setRoster((prev) =>
      prev.map((s) =>
        personIds.includes(s.personId) ? { ...s, awardedToday: true } : s,
      ),
    );

    const result = await awardPointsAction({
      sessionId,
      personIds,
      tier,
      idempotencyKey,
    });

    if (result.ok) {
      setSelected(new Set());
      setTier(null);
      idempotencyKeyRef.current = crypto.randomUUID();
    } else {
      // Roll back the optimistic mark, keep selection + tier so retry
      // (same idempotency key) is a single tap.
      setRoster((prev) =>
        prev.map((s) =>
          personIds.includes(s.personId) ? { ...s, awardedToday: false } : s,
        ),
      );
      setError(result.error ?? "Could not save that award.");
    }

    isSavingRef.current = false;
    setIsSaving(false);
  }

  // present/absent record immediately — no extra info needed. excused opens
  // the inline form below the row instead (a category is required).
  async function markAttendance(personId: string, status: AttendanceStatus) {
    if (status === "excused") {
      setExcuseFormFor(personId);
      return;
    }
    const previous =
      roster.find((s) => s.personId === personId)?.attendanceStatus ?? null;
    setRoster((prev) =>
      prev.map((s) => (s.personId === personId ? { ...s, attendanceStatus: status } : s)),
    );
    const result = await recordAttendanceAction({ sessionId, personId, status });
    if (!result.ok) {
      setRoster((prev) =>
        prev.map((s) =>
          s.personId === personId ? { ...s, attendanceStatus: previous } : s,
        ),
      );
      setError(result.error ?? "Could not save attendance.");
    }
  }

  async function submitExcuse(personId: string, excuseCategory: string, note: string) {
    setExcuseFormFor(null);
    const previous =
      roster.find((s) => s.personId === personId)?.attendanceStatus ?? null;
    setRoster((prev) =>
      prev.map((s) =>
        s.personId === personId ? { ...s, attendanceStatus: "excused" } : s,
      ),
    );
    const result = await recordAttendanceAction({
      sessionId,
      personId,
      status: "excused",
      excuseCategory,
      note: note.trim() || null,
    });
    if (!result.ok) {
      setRoster((prev) =>
        prev.map((s) =>
          s.personId === personId ? { ...s, attendanceStatus: previous } : s,
        ),
      );
      setError(result.error ?? "Could not save that excuse.");
    }
  }

  const selectedNames = useMemo(
    () => roster.filter((s) => selected.has(s.personId)).map((s) => s.displayName),
    [roster, selected],
  );

  return (
    <div className="flex min-h-dvh flex-col">
      {attentionNeeded.length > 0 ? (
        <div className="border-b border-amber-300 bg-amber-50">
          <button
            type="button"
            onClick={() => setShowAttention((v) => !v)}
            className="flex min-h-10 w-full items-center justify-between px-4 text-sm font-medium text-amber-900"
          >
            <span>
              {attentionNeeded.length} scout{attentionNeeded.length === 1 ? "" : "s"} need
              attention
            </span>
            <span aria-hidden>{showAttention ? "▾" : "▸"}</span>
          </button>
          {showAttention ? (
            <ul className="px-4 pb-2 text-sm text-amber-900">
              {attentionNeeded.map((s) => (
                <li key={s.personId}>
                  {s.displayName} — {s.totalAbsences} absences
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <ul className="flex-1 overflow-y-auto pb-48">
        {roster.map((scout) => {
          const isSelected = selected.has(scout.personId);
          return (
            <li key={scout.personId}>
              <div
                className={`flex min-h-12 w-full items-stretch border-b border-zinc-200 ${
                  isSelected ? "bg-zinc-900 text-white" : "bg-white text-zinc-900"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleScout(scout.personId)}
                  aria-pressed={isSelected}
                  className="flex flex-1 items-center gap-3 px-4 py-3 text-start"
                >
                  <span
                    aria-hidden
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                      isSelected ? "bg-white text-zinc-900" : "bg-zinc-200 text-zinc-700"
                    }`}
                  >
                    {scout.displayName.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="flex-1 text-base font-medium">
                    {scout.displayName}
                  </span>
                  {scout.awardedToday ? (
                    <span
                      className={`text-sm ${isSelected ? "text-zinc-200" : "text-zinc-500"}`}
                    >
                      ✓ scored
                    </span>
                  ) : null}
                </button>

                <div
                  role="group"
                  aria-label={`Attendance for ${scout.displayName}`}
                  className="flex items-center gap-1 px-2"
                >
                  {(["present", "absent", "excused"] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      aria-label={status}
                      aria-pressed={scout.attendanceStatus === status}
                      onClick={(e) => {
                        e.stopPropagation();
                        markAttendance(scout.personId, status);
                      }}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded text-xs font-bold ${
                        scout.attendanceStatus === status
                          ? ATTENDANCE_ACTIVE_CLASS[status]
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {ATTENDANCE_LABEL[status]}
                    </button>
                  ))}
                </div>
              </div>

              {excuseFormFor === scout.personId ? (
                <ExcuseForm
                  onCancel={() => setExcuseFormFor(null)}
                  onSubmit={(category, note) =>
                    submitExcuse(scout.personId, category, note)
                  }
                />
              ) : null}
            </li>
          );
        })}
      </ul>

      <div
        className="fixed inset-x-0 bottom-0 flex flex-col gap-2 border-t border-zinc-300 bg-white px-4 pt-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <p className="text-sm text-zinc-600" aria-live="polite">
          {selectedCount === 0
            ? "Tap scouts to select"
            : `${selectedCount} selected: ${selectedNames.join(", ")}`}
        </p>

        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error} — tap a tier again to retry.
          </p>
        ) : null}

        <div className="grid grid-cols-4 gap-2">
          {TIERS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => selectTier(t.value)}
              disabled={isSaving}
              aria-pressed={tier === t.value}
              className={`min-h-12 rounded-lg text-sm font-semibold ${
                tier === t.value ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-900"
              }`}
            >
              {t.label}
              <br />
              {t.points}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={confirm}
          disabled={!canConfirm}
          className="min-h-12 rounded-lg bg-emerald-600 text-base font-semibold text-white disabled:opacity-40"
        >
          {isSaving ? "Saving…" : "Confirm"}
        </button>
      </div>
    </div>
  );
}

function ExcuseForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (category: string, note: string) => void;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");

  return (
    <div className="flex flex-col gap-2 border-b border-zinc-200 bg-amber-50 px-4 py-3">
      <label className="flex flex-col gap-1 text-sm">
        Excuse category
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="min-h-10 rounded border border-zinc-300 bg-white px-2"
        >
          <option value="" disabled>
            Choose one — &quot;Prefer not to say&quot; is always fine
          </option>
          {EXCUSE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Note (optional)
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={280}
          rows={2}
          className="rounded border border-zinc-300 px-2 py-1"
        />
        <span className="text-xs text-amber-800">
          Do not enter medical details here — choose &quot;Unwell&quot; instead.
        </span>
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-10 flex-1 rounded-lg bg-zinc-100 text-sm font-medium text-zinc-900"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!category}
          onClick={() => onSubmit(category, note)}
          className="min-h-10 flex-1 rounded-lg bg-amber-600 text-sm font-semibold text-white disabled:opacity-40"
        >
          Save excuse
        </button>
      </div>
    </div>
  );
}
