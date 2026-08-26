-- =============================================================================
-- Migration: 0001_create_enums.sql
-- Purpose:   Create all PostgreSQL enum types used across the schema.
--            Enums enforce a fixed set of allowed values at the database level,
--            preventing typos and invalid states (e.g. role = 'superadmin' when
--            only 'employee', 'manager', 'admin' are valid).
-- =============================================================================

-- User roles: determines what a user can see and do in the system.
-- 'employee' — regular user, can see own data only
-- 'manager'  — can see aggregated (not individual) data for their department
-- 'admin'    — full access to all data and configuration
CREATE TYPE user_role AS ENUM ('employee', 'manager', 'admin');

-- Course content source: where the course material originates.
-- 'igot'      — from the iGOT Karmayogi platform (external government LMS)
-- 'internal'  — created within this system
-- 'nssta_tpac' — from NSSTA TPAC (National Statistical System Training Academy)
CREATE TYPE course_source AS ENUM ('igot', 'internal', 'nssta_tpac');

-- Enrollment status: tracks where a learner is in their course journey.
-- 'not_started' — enrolled but haven't begun yet
-- 'in_progress' — currently working through the course
-- 'completed'   — finished the course
CREATE TYPE enrollment_status AS ENUM ('not_started', 'in_progress', 'completed');

-- Assessment difficulty levels: used to categorize question complexity.
-- Critical for the "where am I going wrong" feature — helps identify
-- whether a user struggles with easy, medium, or hard questions.
CREATE TYPE difficulty_level AS ENUM ('beginner', 'intermediate', 'advanced', 'critical');
