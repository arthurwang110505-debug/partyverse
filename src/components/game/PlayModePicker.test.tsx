// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PLAY_MODES } from "@/constants/playModes";
import { PlayModePicker } from "./PlayModePicker";

afterEach(cleanup);

describe("PlayModePicker", () => {
  it("offers every random party mode as a labelled radio group", () => {
    render(<PlayModePicker value="standard" onChange={() => {}} />);
    expect(screen.getByRole("radiogroup", { name: "派對模式" })).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    for (const mode of PLAY_MODES) {
      expect(screen.getByRole("radio", { name: new RegExp(mode.label) })).toHaveProperty(
        "ariaChecked",
        mode.id === "standard" ? "true" : "false",
      );
    }
  });

  it("selects on click", () => {
    const onChange = vi.fn();
    render(<PlayModePicker value="standard" onChange={onChange} />);
    screen.getByRole("radio", { name: /10分鐘最久/ }).click();
    expect(onChange).toHaveBeenCalledWith(PLAY_MODES[2]);
  });

  it("selects the 8-game battle mode", () => {
    const onChange = vi.fn();
    render(<PlayModePicker value="standard" onChange={onChange} />);
    screen.getByRole("radio", { name: /決戰模式/ }).click();
    expect(onChange).toHaveBeenCalledWith(PLAY_MODES[3]);
  });

  it("moves the selection with the arrow keys", () => {
    const onChange = vi.fn();
    render(<PlayModePicker value="flash" onChange={onChange} />);
    screen.getByRole("radio", { name: /3分鐘快閃/ }).dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    expect(onChange).toHaveBeenCalledWith(PLAY_MODES[1]);
  });
});
