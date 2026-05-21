import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { RecommendationError } from "../domain/errors.js";
import type {
  Compatibility,
  GeneracionModelo,
  PerfilCategoria,
  PerfilUsoActivo,
  ProductLed,
  SaveConsultationInput,
  TipoPolarizado,
  VehicleModel
} from "../domain/types.js";
import type { RecommendationRepository } from "./ports.js";
import { DecideOpticalSystemUseCase } from "./decide-optical-system-use-case.js";
import { ResolveRecommendationUseCase } from "./resolve-recommendation-use-case.js";

const model: VehicleModel = {
  id: 20,
  idMarca: 10,
  anioDesde: 2018,
  anioHasta: null
};

const profiles: Record<number, PerfilUsoActivo> = {
  1: {
    id: 1,
    categoria: "horario_manejo",
    valor: "nocturno",
    descripcion: "Mayormente de noche"
  },
  2: {
    id: 2,
    categoria: "zona_manejo",
    valor: "carretera",
    descripcion: "Carretera"
  },
  3: {
    id: 3,
    categoria: "uso_vehiculo",
    valor: "trabajo",
    descripcion: "Trabajo"
  }
};

const tint: TipoPolarizado = {
  id: 5,
  codigo: "35%"
};

const generation: GeneracionModelo = {
  id: 30,
  idModelo: model.id,
  anioDesde: 2018,
  anioHasta: null
};

const compatibility: Compatibility = {
  id: 40,
  idModelo: model.id,
  idGeneracionModelo: generation.id,
  anioDesde: 2018,
  anioHasta: null,
  posicionLuz: "cruce",
  idCasquillo: 50,
  tipoSistemaOptico: "lupa_proyector"
};

const products: ProductLed[] = [
  {
    id: 60,
    idMarcaLed: 1,
    modelo: "Linea Media",
    idCasquillo: 50,
    posicionAplicable: "cruce",
    sistemaOpticoCompatible: "lupa_proyector",
    lumens: 6000,
    potenciaWatts: 45,
    gamaNombre: "media"
  },
  {
    id: 61,
    idMarcaLed: 1,
    modelo: "Linea Premium",
    idCasquillo: 50,
    posicionAplicable: "cruce",
    sistemaOpticoCompatible: "lupa_proyector",
    lumens: 9000,
    potenciaWatts: 80,
    gamaNombre: "premium"
  }
];

class FakeRecommendationRepository implements RecommendationRepository {
  public savedConsultations: SaveConsultationInput[] = [];
  public compatibilities: Compatibility[] = [compatibility];
  public opticalOptions: string[] = ["lupa_proyector"];

  async findModelForBrand(modeloId: number, marcaId: number): Promise<VehicleModel | null> {
    return modeloId === model.id && marcaId === model.idMarca ? model : null;
  }

  async findModelById(modeloId: number): Promise<VehicleModel | null> {
    return modeloId === model.id ? model : null;
  }

  async findActivePerfilByCategory(
    id: number,
    categoria: PerfilCategoria
  ): Promise<PerfilUsoActivo | null> {
    const profile = profiles[id];
    return profile?.categoria === categoria ? profile : null;
  }

  async findActiveTintById(id: number): Promise<TipoPolarizado | null> {
    return id === tint.id ? tint : null;
  }

  async findActiveOpticalSystemCodeById(id: number): Promise<string | null> {
    return id === 1 ? "lupa_proyector" : null;
  }

  async findGenerationsForModelYear(): Promise<GeneracionModelo[]> {
    return [generation];
  }

  async findCompatibilitiesForGeneration(): Promise<Compatibility[]> {
    return [...this.compatibilities];
  }

  async findCompatibilitiesForModelYear(): Promise<Compatibility[]> {
    return [...this.compatibilities];
  }

  async findCompatibleProducts(): Promise<ProductLed[]> {
    return products;
  }

  async findCasquilloCodes(ids: number[]): Promise<Array<{ id: number; codigo: string }>> {
    return ids.map((id) => ({ id, codigo: "H4" }));
  }

  async findOpticalSystemOptions(): Promise<string[]> {
    return [...this.opticalOptions];
  }

  async saveConsultation(input: SaveConsultationInput): Promise<number> {
    this.savedConsultations.push(input);
    return 99;
  }
}

describe("ResolveRecommendationUseCase", () => {
  it("resolves a recommendation without Express or PostgreSQL", async () => {
    const repository = new FakeRecommendationRepository();
    const useCase = new ResolveRecommendationUseCase(repository);

    const result = await useCase.execute({
      marcaId: 10,
      modeloId: 20,
      anioVehiculo: 2020,
      horarioManejoPerfilId: 1,
      zonaManejoPerfilId: 2,
      usoVehiculoPerfilId: 3,
      tipoPolarizadoId: 5,
      tipoSistemaOpticoId: 1
    });

    assert.equal(result.consultaId, 99);
    assert.equal(result.nivelConfianza, "alta");
    assert.equal(result.resultados[0]?.posicionLuz, "cruce");
    assert.equal(result.resultados[0]?.productos[0]?.productoId, 61);
    assert.equal(repository.savedConsultations.length, 1);
  });

  it("asks for optical system when the model has multiple compatible systems", async () => {
    const repository = new FakeRecommendationRepository();
    repository.compatibilities = [
      compatibility,
      {
        ...compatibility,
        id: 41,
        tipoSistemaOptico: "reflector_abierto"
      }
    ];
    const useCase = new ResolveRecommendationUseCase(repository);

    await assert.rejects(
      () =>
        useCase.execute({
          marcaId: 10,
          modeloId: 20,
          anioVehiculo: 2020,
          horarioManejoPerfilId: 1,
          zonaManejoPerfilId: 2,
          usoVehiculoPerfilId: 3,
          tipoPolarizadoId: 5,
          tipoSistemaOpticoId: null
        }),
      (error) =>
        error instanceof RecommendationError &&
        error.status === 422 &&
        error.message.includes("lupa/proyector")
    );
  });
});

describe("DecideOpticalSystemUseCase", () => {
  it("returns a question decision when more than one optical system applies", async () => {
    const repository = new FakeRecommendationRepository();
    repository.opticalOptions = ["lupa_proyector", "reflector_abierto"];
    const useCase = new DecideOpticalSystemUseCase(repository);

    const decision = await useCase.execute(20, 2020);

    assert.equal(decision.requiresQuestion, true);
    assert.deepEqual(decision.options, ["lupa_proyector", "reflector_abierto"]);
    assert.equal(decision.resolvedTipoSistemaOptico, null);
  });
});
