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

export type CatalogRepository = {
  findModelForBrand(modeloId: number, marcaId: number): Promise<VehicleModel | null>;
  findModelById(modeloId: number): Promise<VehicleModel | null>;
  findActivePerfilByCategory(
    id: number,
    categoria: PerfilCategoria
  ): Promise<PerfilUsoActivo | null>;
  findActiveTintById(id: number): Promise<TipoPolarizado | null>;
  findActiveOpticalSystemCodeById(id: number): Promise<string | null>;
  findOpticalSystemOptions(modeloId: number, anioVehiculo: number): Promise<string[]>;
};

export type CompatibilityRepository = {
  findGenerationsForModelYear(modeloId: number, anioVehiculo: number): Promise<GeneracionModelo[]>;
  findCompatibilitiesForGeneration(
    modeloId: number,
    generationId: number,
    anioVehiculo: number
  ): Promise<Compatibility[]>;
  findCompatibilitiesForModelYear(modeloId: number, anioVehiculo: number): Promise<Compatibility[]>;
};

export type ProductRepository = {
  findCompatibleProducts(
    idCasquillo: number,
    posicionLuz: string,
    tipoSistemaOptico: string | null
  ): Promise<ProductLed[]>;
  findCasquilloCodes(ids: number[]): Promise<Array<{ id: number; codigo: string }>>;
};

export type ConsultationRepository = {
  saveConsultation(input: SaveConsultationInput): Promise<number>;
};

export type TransactionManager = {
  runInTransaction<T>(work: () => Promise<T>): Promise<T>;
};

export type RecommendationRepository = CatalogRepository &
  CompatibilityRepository &
  ProductRepository &
  ConsultationRepository;
