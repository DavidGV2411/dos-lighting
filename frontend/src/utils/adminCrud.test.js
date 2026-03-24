import { describe, expect, it } from "vitest";
import {
  buildDeleteErrorMessage,
  hasDuplicate,
  includesNormalized,
  normalizeText
} from "./adminCrud.js";

describe("adminCrud", () => {
  it("normalizeText removes accents and trims", () => {
    expect(normalizeText("  Año Vehículo  ")).toBe("ano vehiculo");
  });

  it("includesNormalized matches without case or accents", () => {
    expect(includesNormalized("Luz Ártica", "artica")).toBe(true);
    expect(includesNormalized("Luz Artica", "RTI")).toBe(true);
    expect(includesNormalized("Luz Artica", "xenon")).toBe(false);
  });

  it("hasDuplicate ignores current item id", () => {
    const items = [
      { id: 1, nombre: "Corolla" },
      { id: 2, nombre: "Yaris" }
    ];

    expect(
      hasDuplicate(items, 2, (item) => item.nombre.toLowerCase() === "corolla")
    ).toBe(true);
    expect(
      hasDuplicate(items, 1, (item) => item.nombre.toLowerCase() === "corolla")
    ).toBe(false);
  });

  it("buildDeleteErrorMessage gives integrity hint on 409", () => {
    expect(buildDeleteErrorMessage("el producto", { status: 409 })).toBe(
      "No se puede eliminar el producto porque esta relacionado con otros registros."
    );
    expect(
      buildDeleteErrorMessage("la compatibilidad", {
        status: 500,
        message: "Fallo inesperado"
      })
    ).toBe("Fallo inesperado");
  });
});
