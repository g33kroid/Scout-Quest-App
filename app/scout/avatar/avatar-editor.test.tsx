import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AvatarEditor } from "./avatar-editor";

// The action is a "use server" module; stub it so the editor is exercised in
// isolation (jsdom, no server runtime).
const setAvatarConfigAction = vi.fn();
vi.mock("@/lib/server/avatar-action", () => ({
  setAvatarConfigAction: (config: unknown) => setAvatarConfigAction(config),
}));

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

describe("AvatarEditor", () => {
  beforeEach(() => {
    setAvatarConfigAction.mockReset();
    push.mockReset();
    refresh.mockReset();
  });

  // The point of this test: react-avatar-studio's AvatarCustomizeInline is an
  // older package (peer react >=16); this proves it actually mounts under
  // React 19 without throwing, and that our save/cancel chrome renders.
  test("mounts under React 19 and renders the save control", () => {
    render(<AvatarEditor seed="seed-1" config={null} locale="en" />);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Shuffle" })).toBeInTheDocument();
  });

  test("save persists the config and navigates home", async () => {
    setAvatarConfigAction.mockResolvedValue(true);
    render(<AvatarEditor seed="seed-1" config={null} locale="en" />);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    // flush the transition's awaited action
    await vi.waitFor(() => expect(setAvatarConfigAction).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/scout"));
  });

  test("surfaces an error when the save is rejected", async () => {
    setAvatarConfigAction.mockResolvedValue(false);
    render(<AvatarEditor seed="seed-1" config={null} locale="en" />);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await vi.waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/could not save/i),
    );
    expect(push).not.toHaveBeenCalled();
  });
});
