import { z } from "zod";

export const resolveRecommendationRequestSchema = z.object({
  marcaId: z.coerce.number().int().min(1, "marcaId debe ser mayor a 0"),
  modeloId: z.coerce.number().int().min(1, "modeloId debe ser mayor a 0"),
  anioVehiculo: z.coerce.number().int().min(1900, "anioVehiculo invalido").max(2100, "anioVehiculo invalido"),
  horarioManejoPerfilId: z.coerce.number().int().min(1, "horarioManejoPerfilId debe ser mayor a 0"),
  zonaManejoPerfilId: z.coerce.number().int().min(1, "zonaManejoPerfilId debe ser mayor a 0"),
  usoVehiculoPerfilId: z.coerce.number().int().min(1, "usoVehiculoPerfilId debe ser mayor a 0"),
  tipoPolarizadoId: z.coerce.number().int().min(1, "tipoPolarizadoId debe ser mayor a 0"),
  tipoSistemaOpticoId: z.coerce.number().int().min(1, "tipoSistemaOpticoId debe ser mayor a 0").optional().nullable()
});

export const decisionSistemaOpticoQuerySchema = z.object({
  anioVehiculo: z.coerce.number().int().min(1900, "anioVehiculo invalido").max(2100, "anioVehiculo invalido")
});
