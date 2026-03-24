import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppLayout from "./AppLayout";

vi.mock("../components/ChatWidget", () => ({
  default: ({ show }) => (show ? <div data-testid="chat-widget" /> : null)
}));

vi.mock("../services/authService", () => ({
  hasAuthSession: vi.fn(),
  logoutAdmin: vi.fn()
}));

const { hasAuthSession } = await import("../services/authService");

describe("AppLayout", () => {
  beforeEach(() => {
    hasAuthSession.mockReset();
  });

  it("muestra el widget en la ruta publica", () => {
    hasAuthSession.mockReturnValue(false);

    render(
      <MemoryRouter initialEntries={["/encuesta"]}>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route path="encuesta" element={<div>Encuesta</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId("chat-widget")).toBeInTheDocument();
  });

  it("no muestra el widget en login", () => {
    hasAuthSession.mockReturnValue(false);

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route path="login" element={<div>Login</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByTestId("chat-widget")).not.toBeInTheDocument();
  });

  it("no muestra el widget cuando hay sesion admin", () => {
    hasAuthSession.mockReturnValue(true);

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route path="dashboard" element={<div>Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByTestId("chat-widget")).not.toBeInTheDocument();
  });
});
