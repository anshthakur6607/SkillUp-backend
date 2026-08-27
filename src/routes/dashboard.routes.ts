/**
 * Dashboard routes — serve data for the dashboard pages.
 *
 * All routes are protected by verifyAuth.
 * Uses the anon client to respect RLS policies.
 */

import { Router } from "express";
import { verifyAuth } from "../middleware/verifyAuth";
import {
  getDashboardStats,
  getCourses,
  getEnrollments,
  getCompetencies,
  getCertificates,
  getRecommendedCourses,
} from "../controllers/dashboardController";

const router = Router();

/**
 * GET /api/dashboard/stats
 * Returns aggregated stats: courses enrolled, completed, hours, certificates, competency score.
 */
router.get("/dashboard/stats", verifyAuth, getDashboardStats);

/**
 * GET /api/dashboard/courses
 * Returns all active courses available for enrollment.
 */
router.get("/dashboard/courses", verifyAuth, getCourses);

/**
 * GET /api/dashboard/enrollments
 * Returns the user's enrolled courses with progress.
 */
router.get("/dashboard/enrollments", verifyAuth, getEnrollments);

/**
 * GET /api/dashboard/competencies
 * Returns the user's competency scores grouped by domain.
 */
router.get("/dashboard/competencies", verifyAuth, getCompetencies);

/**
 * GET /api/dashboard/certificates
 * Returns the user's earned certificates.
 */
router.get("/dashboard/certificates", verifyAuth, getCertificates);

/**
 * GET /api/dashboard/recommended
 * Returns recommended courses for the user.
 */
router.get("/dashboard/recommended", verifyAuth, getRecommendedCourses);

export default router;
