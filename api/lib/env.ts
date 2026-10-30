import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Falta la variable de entorno obligatoria: ${name}`);
  }
  return value ?? "";
}

const appSecret = required("APP_SECRET");
if (process.env.NODE_ENV === "production" && appSecret.length < 32) {
  throw new Error("APP_SECRET debe tener al menos 32 caracteres aleatorios.");
}

export const env = {
  appSecret: appSecret || "solo-desarrollo-no-usar-en-produccion-0000",
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: required("DATABASE_URL"),
  // Primer administrador (solo se usa si aún no existe ningún usuario)
  adminUsername: process.env.ADMIN_USERNAME ?? "",
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
  adminName: process.env.ADMIN_NAME ?? "Administrador THP",
};
