import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const connectionString=process.env.DATABASE_URL;
if(!connectionString) throw new Error("DATABASE_URL is required.");

const globalForDb=globalThis as typeof globalThis & { invoqlySql?: ReturnType<typeof postgres> };
const sql=globalForDb.invoqlySql??postgres(connectionString,{max:5,idle_timeout:20,connect_timeout:10,prepare:false});
if(process.env.NODE_ENV!=="production") globalForDb.invoqlySql=sql;

export const db=drizzle(sql,{schema});
export { schema };
