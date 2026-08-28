/**
 * Course Routes
 *
 * Public: GET /courses, GET /courses/:id
 * Authenticated: POST /courses/:id/enroll, POST /courses/:id/start,
 *                GET /courses/:id/progress, GET /courses/my
 */

import { Router } from 'express';
import { verifyAuth } from '../middleware/verifyAuth';
import {
  getAllCourses,
  getCourseById,
  enrollInCourse,
  startCourse,
  getEnrollmentStatus,
  getMyEnrollments,
} from '../controllers/courseController';

const router = Router();

// Public routes
router.get('/courses', getAllCourses);
router.get('/courses/:id', getCourseById);

// Authenticated routes
router.post('/courses/:id/enroll', verifyAuth, enrollInCourse);
router.post('/courses/:id/start', verifyAuth, startCourse);
router.get('/courses/:id/progress', verifyAuth, getEnrollmentStatus);
router.get('/courses/my', verifyAuth, getMyEnrollments);

export default router;
