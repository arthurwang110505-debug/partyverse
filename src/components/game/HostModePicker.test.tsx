// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { HOST_MODES } from "@/constants/hostMode";
import { HostModePicker } from "./HostModePicker";

afterEach(cleanup);

const picker = (mode: "tv" | "phone", hostPlays = true) => (
  <HostModePicker mode={mode} hostPlays={hostPlays} onChange={() => {}} onHostPlaysChange={() => {}} />
);

describe("HostModePicker", () => {
  it("offers big-screen and phone hosting as a radio group", () => {
    render(picker("tv"));
    expect(screen.getByRole("radiogroup", { name: "主持方式" })).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByRole("radio", { name: /大螢幕主持/ })).toHaveProperty("ariaChecked", "true");
    expect(screen.getByRole("radio", { name: /手機主持/ })).toHaveProperty("ariaChecked", "false");
    expect(HOST_MODES.map((mode) => mode.id)).toEqual(["tv", "phone"]);
  });

  it("only offers '我也想玩' for phone hosting", () => {
    const { unmount } = render(picker("tv"));
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByText(/電視／電腦只顯示主持畫面，不占玩家名額/)).toBeTruthy();
    unmount();

    render(picker("phone"));
    expect(screen.getByRole("checkbox", { name: /我也要一起玩/ })).toHaveProperty("checked", true);
  });

  it("explains a presenting phone host does not take a seat", () => {
    render(picker("phone", false));
    expect(screen.getByRole("checkbox")).toHaveProperty("checked", false);
    expect(screen.getByText(/這支手機只負責主持與顯示，不占玩家名額/)).toBeTruthy();
  });

  it("reports mode and host-seat changes", () => {
    const onChange = vi.fn();
    const onHostPlaysChange = vi.fn();
    render(
      <HostModePicker mode="phone" hostPlays onChange={onChange} onHostPlaysChange={onHostPlaysChange} />,
    );
    screen.getByRole("radio", { name: /大螢幕主持/ }).click();
    expect(onChange).toHaveBeenCalledWith(HOST_MODES[0]);

    screen.getByRole("checkbox").click();
    expect(onHostPlaysChange).toHaveBeenCalledWith(false);
  });
});
