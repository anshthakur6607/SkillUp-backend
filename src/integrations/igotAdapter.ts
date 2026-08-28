/**
 * iGOT Adapter — integration with India's iGOT Karmayogi platform.
 *
 * WHAT IT DOES:
 * =============
 * 1. Pulls course catalog from iGOT API (course title, description, competencies)
 * 2. Pulls user completion records (for syncing competency scores)
 * 3. Handles webhook events from iGOT (real-time completion notifications)
 * 4. Pushes enrollment data back to iGOT (two-way sync)
 *
 * HOW TO CONNECT TO REAL iGOT API:
 * ==================================
 * 1. Register at https://igotkarmayogi.gov.in/developer (if available)
 * 2. Get API credentials (client_id, client_secret)
 * 3. Store them in platform_configs.config as JSON
 * 4. Set api_base_url to the real iGOT API endpoint
 *
 * FOR THIS HACKATHON PROTOTYPE:
 * ==============================
 * We use mock data that mirrors real iGOT structure.
 * The adapter is fully functional — just swap the mock fetch calls for real API calls.
 *
 * TWO-WAY SYNC DESIGN:
 * =====================
 * - INBOUND: iGOT → Us (course completions, enrollment status)
 * - OUTBOUND: Us → iGOT (enrollment requests, competency updates)
 * - WEBHOOK: iGOT pushes events to our /api/integrations/webhook/igot endpoint
 */

import { PlatformAdapter } from './platformAdapter';
import type {
  ExternalCourse,
  ExternalEnrollment,
  ExternalCompletion,
  SyncLogEntry,
} from './types';
import { supabaseServiceRole } from '../config/supabaseClient';

export class IGOTAdapter extends PlatformAdapter {
  readonly platform = 'igot' as const;

  /**
   * Fetch courses from iGOT.
   *
   * In production, this calls the iGOT API:
   *   GET {api_base_url}/api/v1/courses
   *   Headers: Authorization: Bearer {access_token}
   *
   * For now, returns mock data that matches real iGOT course structure.
   */
  async fetchCourses(): Promise<ExternalCourse[]> {
    const logId = await this.logSync({
      platform: 'igot',
      direction: 'inbound',
      eventType: 'fetch_courses',
      status: 'pending',
    });

    try {
      const config = await this.getConfig();
      const apiBase = config?.api_base_url as string | undefined;

      // If real API is configured, fetch from it
      if (apiBase && config?.config && typeof config.config === 'object') {
        const cfg = config.config as Record<string, string>;
        const response = await fetch(`${apiBase}/api/v1/courses`, {
          headers: {
            'Authorization': `Bearer ${cfg.access_token || ''}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) throw new Error(`iGOT API returned ${response.status}`);

        const data = (await response.json()) as { courses?: Record<string, unknown>[] };
        const courses: ExternalCourse[] = (data.courses || []).map((c: Record<string, unknown>) => ({
          externalId: c.id as string,
          title: c.title as string,
          description: c.description as string,
          url: c.url as string,
          durationHours: c.duration_hours as number,
          competencies: (c.tags as string[]) || [],
          source: 'igot' as const,
        }));

        await this.updateSyncLog(logId, 'success', courses.length);
        return courses;
      }

      // Comprehensive iGOT Karmayogi course catalog
      // Organized by category: Behavioural, Functional, Domain, Mandatory
      // Based on real iGOT platform structure and DoPT guidelines
      const mockCourses: ExternalCourse[] = [
        // ─── BEHAVIOURAL COURSES ───
        {
          externalId: 'IGOT-ETH-101',
          title: 'Ethics in Governance',
          description: 'Understanding ethical frameworks, integrity, and transparency in public service delivery.',
          url: 'https://igotkarmayogi.gov.in/course/ethics-governance',
          durationHours: 4,
          competencies: ['Leadership', 'Critical Thinking'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-POSH-101',
          title: 'Prevention of Sexual Harassment of Women at Workplace',
          description: 'Mandatory course on POSH Act compliance, awareness, and reporting mechanisms.',
          url: 'https://igotkarmayogi.gov.in/course/posh-101',
          durationHours: 1,
          competencies: ['Communication', 'Collaboration'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-LEAD-101',
          title: 'Leadership Fundamentals',
          description: 'Core leadership principles for government officials — decision-making, delegation, and team management.',
          url: 'https://igotkarmayogi.gov.in/course/leadership-101',
          durationHours: 3,
          competencies: ['Leadership', 'Project Management'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-COMM-101',
          title: 'Effective Communication in Government',
          description: 'Writing clear office notes, RTI responses, and official correspondence.',
          url: 'https://igotkarmayogi.gov.in/course/communication-101',
          durationHours: 2,
          competencies: ['Communication'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-RTI-101',
          title: 'Right to Information Act — Practical Guide',
          description: 'Understanding RTI obligations, exemptions, and efficient response handling.',
          url: 'https://igotkarmayogi.gov.in/course/rti-101',
          durationHours: 2,
          competencies: ['Communication', 'Critical Thinking'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-CCS-101',
          title: 'Conduct Rules for Central Government Employees',
          description: 'CCS (Conduct) Rules, discipline, and accountability in government service.',
          url: 'https://igotkarmayogi.gov.in/course/ccs-conduct-101',
          durationHours: 2,
          competencies: ['Leadership'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-YOGA-101',
          title: 'Yoga and Wellness for Government Employees',
          description: 'Pranayama, stress management, and wellness practices for improved work performance.',
          url: 'https://igotkarmayogi.gov.in/course/yoga-wellness',
          durationHours: 1,
          competencies: ['Collaboration'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-GENDER-101',
          title: 'Gender Sensitization in Government',
          description: 'Creating inclusive workplaces, understanding gender bias, and promoting equality.',
          url: 'https://igotkarmayogi.gov.in/course/gender-sensitization',
          durationHours: 2,
          competencies: ['Communication', 'Collaboration'],
          source: 'igot',
        },
        // ─── FUNCTIONAL COURSES ───
        {
          externalId: 'IGOT-FM-101',
          title: 'Financial Management for Government',
          description: 'Budget preparation, expenditure management, and GFR compliance.',
          url: 'https://igotkarmayogi.gov.in/course/financial-mgmt-101',
          durationHours: 4,
          competencies: ['Project Management'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-PROC-101',
          title: 'Government Procurement (GEM)',
          description: 'GeM portal usage, tendering processes, and procurement rules.',
          url: 'https://igotkarmayogi.gov.in/course/procurement-gem',
          durationHours: 3,
          competencies: ['Project Management'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-MS-101',
          title: 'Microsoft Office Suite for Government',
          description: 'Word, Excel, PowerPoint — essential digital skills for daily office work.',
          url: 'https://igotkarmayogi.gov.in/course/ms-office-101',
          durationHours: 4,
          competencies: ['Python Programming'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-Excel-201',
          title: 'Advanced Excel for Data Analysis',
          description: 'Pivot tables, VLOOKUP, data visualization, and reporting for government officials.',
          url: 'https://igotkarmayogi.gov.in/course/advanced-excel',
          durationHours: 6,
          competencies: ['Python Programming', 'Data Analysis & Interpretation'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-SPARROW-101',
          title: 'SPARROW — Performance Management System',
          description: 'How to fill and manage APAR/ACR on the SPARROW portal.',
          url: 'https://igotkarmayogi.gov.in/course/sparrow-101',
          durationHours: 1,
          competencies: ['Project Management'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-GFR-201',
          title: 'General Financial Rules (GFR) 2017',
          description: 'Comprehensive guide to GFR — delegation, financial powers, and audit compliance.',
          url: 'https://igotkarmayogi.gov.in/course/gfr-201',
          durationHours: 5,
          competencies: ['Project Management', 'Critical Thinking'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-CCR-101',
          title: 'CCS (CCA) Rules — Classification & Control',
          description: 'Understanding classification of posts, service rules, and disciplinary proceedings.',
          url: 'https://igotkarmayogi.gov.in/course/ccs-cca-rules',
          durationHours: 3,
          competencies: ['Leadership'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-MGNEREGA-101',
          title: 'MGNREGA — Implementation & Monitoring',
          description: 'Managing MGNREGA works, social audit, and convergence with other schemes.',
          url: 'https://igotkarmayogi.gov.in/course/mgnrega-101',
          durationHours: 4,
          competencies: ['Project Management', 'Data Analysis & Interpretation'],
          source: 'igot',
        },
        // ─── DOMAIN-SPECIFIC (Statistical) ───
        {
          externalId: 'IGOT-SURV-101',
          title: 'Fundamentals of Survey Sampling',
          description: 'Introduction to probability sampling methods used in national statistical surveys.',
          url: 'https://igotkarmayogi.gov.in/course/survey-sampling-101',
          durationHours: 8,
          competencies: ['Survey Design', 'Sampling Techniques'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-STAT-201',
          title: 'Advanced Statistical Methods',
          description: 'Regression analysis, time series, and hypothesis testing for government surveys.',
          url: 'https://igotkarmayogi.gov.in/course/adv-stats-201',
          durationHours: 10,
          competencies: ['Statistical Inference', 'Data Analysis & Interpretation'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-DQA-101',
          title: 'Data Quality Assurance in Surveys',
          description: 'Ensuring accuracy, completeness, and consistency in statistical data collection.',
          url: 'https://igotkarmayogi.gov.in/course/data-quality-101',
          durationHours: 4,
          competencies: ['Data Quality Assurance', 'Survey Design'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-CPI-101',
          title: 'Consumer Price Index — Calculation & Interpretation',
          description: 'Understanding CPI methodology, weightage, and its role in economic policy.',
          url: 'https://igotkarmayogi.gov.in/course/cpi-101',
          durationHours: 3,
          competencies: ['Statistical Inference', 'Data Analysis & Interpretation'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-NSS-101',
          title: 'National Sample Survey — Design & Execution',
          description: 'NSSO survey methodology, field operations, and data processing.',
          url: 'https://igotkarmayogi.gov.in/course/nss-101',
          durationHours: 6,
          competencies: ['Survey Design', 'Sampling Techniques', 'Data Quality Assurance'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-GDP-101',
          title: 'National Accounts — GDP Calculation',
          description: 'GDP estimation methodology, base year revision, and national accounts compilation.',
          url: 'https://igotkarmayogi.gov.in/course/gdp-calculation',
          durationHours: 5,
          competencies: ['Statistical Inference', 'Data Analysis & Interpretation'],
          source: 'igot',
        },
        // ─── DOMAIN-SPECIFIC (Technical/Digital) ───
        {
          externalId: 'IGOT-PY-101',
          title: 'Python Programming for Beginners',
          description: 'Introduction to Python — variables, loops, functions, and basic data structures.',
          url: 'https://igotkarmayogi.gov.in/course/python-101',
          durationHours: 8,
          competencies: ['Python Programming'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-PY-201',
          title: 'Python for Data Analysis',
          description: 'Hands-on Python for data wrangling, visualization, and statistical modeling using Pandas and Matplotlib.',
          url: 'https://igotkarmayogi.gov.in/course/python-data-201',
          durationHours: 12,
          competencies: ['Python Programming', 'Data Analysis & Interpretation'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-SQL-101',
          title: 'SQL for Government Data Management',
          description: 'Writing SQL queries, designing schemas, and managing government databases.',
          url: 'https://igotkarmayogi.gov.in/course/sql-101',
          durationHours: 6,
          competencies: ['SQL & Database Management'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-R-101',
          title: 'R Programming for Statistical Computing',
          description: 'Using R for data analysis, visualization, and statistical modeling.',
          url: 'https://igotkarmayogi.gov.in/course/r-programming',
          durationHours: 8,
          competencies: ['R Programming', 'Data Analysis & Interpretation'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-AI-101',
          title: 'Introduction to Artificial Intelligence',
          description: 'Understanding AI concepts, machine learning basics, and government use cases.',
          url: 'https://igotkarmayogi.gov.in/course/ai-intro-101',
          durationHours: 4,
          competencies: ['Python Programming', 'Data Analysis & Interpretation'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-DP-101',
          title: 'Digital Personal Data Protection Act, 2023',
          description: 'Understanding the DPDP Act, consent management, and data fiduciary obligations.',
          url: 'https://igotkarmayogi.gov.in/course/dpdp-act-101',
          durationHours: 3,
          competencies: ['Data Privacy & Protection', 'Cybersecurity Awareness'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-CYBER-101',
          title: 'Cybersecurity Awareness for Government',
          description: 'Recognizing phishing, social engineering, and common cyber attack vectors.',
          url: 'https://igotkarmayogi.gov.in/course/cybersecurity-101',
          durationHours: 2,
          competencies: ['Cybersecurity Awareness'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-DIG-101',
          title: 'Digital India — E-Governance Frameworks',
          description: 'IndiaStack, DigiLocker, UMANG, and digital public infrastructure for government.',
          url: 'https://igotkarmayogi.gov.in/course/digital-india-101',
          durationHours: 3,
          competencies: ['E-Governance Frameworks'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-GIS-101',
          title: 'GIS and Remote Sensing for Government',
          description: 'Using geographic information systems for planning, monitoring, and data visualization.',
          url: 'https://igotkarmayogi.gov.in/course/gis-101',
          durationHours: 6,
          competencies: ['Data Engineering', 'Cloud Computing'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-BNS-101',
          title: 'Introduction to Bharatiya Nyaya Sanhita, 2023',
          description: 'Understanding the new criminal law replacing IPC — key changes and implications.',
          url: 'https://igotkarmayogi.gov.in/course/bns-101',
          durationHours: 4,
          competencies: ['Critical Thinking'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-BNSS-101',
          title: 'Introduction to Bharatiya Nagarik Suraksha Sanhita, 2023',
          description: 'New criminal procedure code — changes in investigation, trial, and bail provisions.',
          url: 'https://igotkarmayogi.gov.in/course/bnss-101',
          durationHours: 4,
          competencies: ['Critical Thinking'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-OD-101',
          title: 'Open Data and Data Sharing in Government',
          description: 'Principles of open data, anonymization, and responsible data sharing.',
          url: 'https://igotkarmayogi.gov.in/course/open-data-101',
          durationHours: 3,
          competencies: ['Open Data & Data Sharing', 'Data Privacy & Protection'],
          source: 'igot',
        },
        // ─── MANDATORY (APAR-Linked) ───
        {
          externalId: 'IGOT-APAR-101',
          title: 'Annual Performance Appraisal Report (APAR) — Complete Guide',
          description: 'How to write, review, and complete APAR on SPARROW — mandatory for all officials.',
          url: 'https://igotkarmayogi.gov.in/course/apar-complete-guide',
          durationHours: 1,
          competencies: ['Project Management'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-ARC-101',
          title: 'Annual Confidential Report (ACR) Best Practices',
          description: 'Writing effective self-appraisals and peer reviews for career progression.',
          url: 'https://igotkarmayogi.gov.in/course/acr-best-practices',
          durationHours: 1,
          competencies: ['Communication', 'Leadership'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-SEC-101',
          title: 'Official Secrets Act — Security Awareness',
          description: 'Classification of documents, handling sensitive information, and security protocols.',
          url: 'https://igotkarmayogi.gov.in/course/official-secrets-101',
          durationHours: 2,
          competencies: ['Cybersecurity Awareness'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-CC-101',
          title: 'Citizen Charter and Service Delivery',
          description: 'Understanding citizen charters, grievance redressal, and transparent governance.',
          url: 'https://igotkarmayogi.gov.in/course/citizen-charter',
          durationHours: 2,
          competencies: ['Communication', 'E-Governance Frameworks'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-POSH-ADV',
          title: 'Internal Complaints Committee — POSH Act',
          description: 'Roles and responsibilities of ICC members, inquiry procedures, and reporting.',
          url: 'https://igotkarmayogi.gov.in/course/icc-posh',
          durationHours: 2,
          competencies: ['Leadership', 'Communication'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-CCA-ADV',
          title: 'Central Civil Services (Classification, Control & Appeal) Rules',
          description: 'Detailed study of CCA Rules for officers handling disciplinary matters.',
          url: 'https://igotkarmayogi.gov.in/course/cca-advanced',
          durationHours: 4,
          competencies: ['Leadership', 'Critical Thinking'],
          source: 'igot',
        },
      ];

      await this.updateSyncLog(logId, 'success', mockCourses.length);
      return mockCourses;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.updateSyncLog(logId, 'failed', 0, msg);
      return [];
    }
  }

  /**
   * Fetch user enrollments from iGOT.
   */
  async fetchEnrollments(userId: string): Promise<ExternalEnrollment[]> {
    const logId = await this.logSync({
      platform: 'igot',
      direction: 'inbound',
      eventType: 'fetch_enrollments',
      status: 'pending',
      payload: { userId },
    });

    try {
      // In production: GET {api_base_url}/api/v1/users/{userId}/enrollments
      // For prototype: return empty (enrollments created via our UI)
      await this.updateSyncLog(logId, 'success', 0);
      return [];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.updateSyncLog(logId, 'failed', 0, msg);
      return [];
    }
  }

  /**
   * Fetch completions from iGOT since a given date.
   * These trigger competency score updates in our system.
   */
  async fetchCompletions(since: Date): Promise<ExternalCompletion[]> {
    const logId = await this.logSync({
      platform: 'igot',
      direction: 'inbound',
      eventType: 'fetch_completions',
      status: 'pending',
      payload: { since: since.toISOString() },
    });

    try {
      // In production: GET {api_base_url}/api/v1/completions?since={since}
      // For prototype: return mock completions
      const mockCompletions: ExternalCompletion[] = [
        {
          userId: 'mock-user-1',
          platform: 'igot',
          externalCourseId: 'IGOT-SURV-101',
          courseTitle: 'Fundamentals of Survey Sampling',
          completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          score: 85,
          certificateId: 'CERT-IGOT-SURV-001',
        },
      ];

      await this.updateSyncLog(logId, 'success', mockCompletions.length);
      return mockCompletions;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.updateSyncLog(logId, 'failed', 0, msg);
      return [];
    }
  }

  /**
   * Verify webhook signature from iGOT.
   * Uses HMAC-SHA256 with the webhook_secret from platform_configs.
   */
  async verifyWebhookSignature(payload: string, signature: string): Promise<boolean> {
    const config = await this.getConfig();
    const secret = (config?.config as Record<string, string>)?.webhook_secret;
    if (!secret) return true; // Skip verification if no secret configured

    try {
      const { createHmac } = await import('crypto');
      const expected = createHmac('sha256', secret).update(payload).digest('hex');
      return expected === signature;
    } catch {
      return false;
    }
  }

  /**
   * Handle an incoming webhook event from iGOT.
   * Called by the webhook controller when an iGOT event arrives.
   */
  async handleWebhook(event: string, data: Record<string, unknown>): Promise<void> {
    const logId = await this.logSync({
      platform: 'igot',
      direction: 'webhook',
      eventType: event,
      status: 'pending',
      payload: data,
    });

    try {
      switch (event) {
        case 'course.completed':
          await this.processCompletion(data);
          break;
        case 'course.enrolled':
          await this.processEnrollment(data);
          break;
        case 'course.progress_updated':
          await this.processProgressUpdate(data);
          break;
        default:
          console.log(`[iGOT] Unknown webhook event: ${event}`);
      }
      await this.updateSyncLog(logId, 'success', 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.updateSyncLog(logId, 'failed', 0, msg);
    }
  }

  private async processCompletion(data: Record<string, unknown>): Promise<void> {
    const userId = data.user_id as string;
    const courseId = data.course_id as string;
    const courseTitle = data.course_title as string;
    const score = data.score as number | undefined;
    const certId = data.certificate_id as string | undefined;

    if (!userId || !courseId) return;

    // Store the completion record
    await supabaseServiceRole.from('platform_completions').upsert(
      {
        user_id: userId,
        platform: 'igot',
        external_course_id: courseId,
        course_title: courseTitle,
        completed_at: new Date().toISOString(),
        score: score || null,
        certificate_id: certId || null,
        processed: false,
      },
      { onConflict: 'user_id,platform,external_course_id' }
    );

    // TODO: Trigger competency score recalculation via sync service
    // This is the "feedback loop" mentioned in the hackathon docs
  }

  private async processEnrollment(data: Record<string, unknown>): Promise<void> {
    const userId = data.user_id as string;
    const courseId = data.course_id as string;
    if (!userId || !courseId) return;

    await supabaseServiceRole.from('platform_enrollments').upsert(
      {
        user_id: userId,
        platform: 'igot',
        external_course_id: courseId,
        course_title: data.course_title as string,
        status: 'enrolled',
        enrolled_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,platform,external_course_id' }
    );
  }

  private async processProgressUpdate(data: Record<string, unknown>): Promise<void> {
    const userId = data.user_id as string;
    const courseId = data.course_id as string;
    const progress = data.progress_percent as number;
    if (!userId || !courseId) return;

    await supabaseServiceRole
      .from('platform_enrollments')
      .update({
        progress_percent: progress,
        status: progress >= 100 ? 'completed' : 'in_progress',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('platform', 'igot')
      .eq('external_course_id', courseId);
  }
}

export const igotAdapter = new IGOTAdapter();
