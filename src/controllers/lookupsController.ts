/**
 * Lookups controller — serves dropdown data for profile setup.
 */
import { Request, Response, NextFunction } from "express";
import { supabaseAnon } from "../config/supabaseClient";
import { AppError } from "../middleware/errorHandler";

type LookupTable = "indian_states" | "central_ministries" | "organisations" | "designations" | "departments_lookup";

const VALID_TABLES: LookupTable[] = ["indian_states", "central_ministries", "organisations", "designations", "departments_lookup"];

export async function getLookups(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { type } = req.params;
    if (!VALID_TABLES.includes(type as LookupTable)) {
      return next(new AppError("Invalid lookup type. Valid types: " + VALID_TABLES.join(", "), 400));
    }
    const { data, error } = await supabaseAnon
      .from(type)
      .select("*")
      .order("name");
    if (error) return next(new AppError("Failed to fetch lookups", 500));
    res.json({ status: "ok", data: data || [] });
  } catch {
    next(new AppError("Failed to fetch lookups", 500));
  }
}

export async function getOrganisationsByMinistry(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { ministry } = req.query;
    if (!ministry || typeof ministry !== "string") {
      return next(new AppError("ministry query parameter is required", 400));
    }
    const { data, error } = await supabaseAnon
      .from("organisations")
      .select("*")
      .eq("ministry", ministry)
      .order("name");
    if (error) return next(new AppError("Failed to fetch organisations", 500));
    res.json({ status: "ok", data: data || [] });
  } catch {
    next(new AppError("Failed to fetch organisations", 500));
  }
}

export async function getDepartmentsByMinistry(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { ministry, state } = req.query;
    let query = supabaseAnon.from("departments_lookup").select("*");
    if (ministry && typeof ministry === "string") {
      query = query.eq("ministry", ministry);
    } else if (state && typeof state === "string") {
      query = query.eq("state", state);
    } else {
      return next(new AppError("ministry or state query parameter is required", 400));
    }
    const { data, error } = await query.order("name");
    if (error) return next(new AppError("Failed to fetch departments", 500));
    res.json({ status: "ok", data: data || [] });
  } catch {
    next(new AppError("Failed to fetch departments", 500));
  }
}