/**
 * Export Routes
 * API endpoints for document export functionality
 * Implements Requirements 5.3, 5.5
 */

import { Router, Request, Response } from 'express';
import documentExportService from '../services/documentExportService';
import { validateJWT, loadUser } from '../middleware/auth';

const router = Router();

/**
 * Export program specification as DOCX
 * GET /api/export/program/:programId/docx
 */
router.get('/program/:programId/docx', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { programId } = req.params;

    const buffer = await documentExportService.exportProgramSpecDOCX(programId);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="program-spec-${programId}.docx"`);
    res.send(buffer);
  } catch (error: any) {
    console.error('Error exporting program spec as DOCX:', error);
    res.status(500).json({
      error: {
        code: 'EXPORT_ERROR',
        message: 'Failed to export program specification as DOCX',
        details: error.message,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    });
  }
});

/**
 * Export program specification as PDF
 * GET /api/export/program/:programId/pdf
 */
router.get('/program/:programId/pdf', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { programId } = req.params;

    const buffer = await documentExportService.exportProgramSpecPDF(programId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="program-spec-${programId}.pdf"`);
    res.send(buffer);
  } catch (error: any) {
    console.error('Error exporting program spec as PDF:', error);
    res.status(500).json({
      error: {
        code: 'EXPORT_ERROR',
        message: 'Failed to export program specification as PDF',
        details: error.message,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    });
  }
});

/**
 * Export unit specification as DOCX
 * GET /api/export/unit/:unitId/docx
 */
router.get('/unit/:unitId/docx', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { unitId } = req.params;

    const buffer = await documentExportService.exportUnitSpecDOCX(unitId);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="unit-spec-${unitId}.docx"`);
    res.send(buffer);
  } catch (error: any) {
    console.error('Error exporting unit spec as DOCX:', error);
    res.status(500).json({
      error: {
        code: 'EXPORT_ERROR',
        message: 'Failed to export unit specification as DOCX',
        details: error.message,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    });
  }
});

/**
 * Export unit specification as PDF
 * GET /api/export/unit/:unitId/pdf
 */
router.get('/unit/:unitId/pdf', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { unitId } = req.params;

    const buffer = await documentExportService.exportUnitSpecPDF(unitId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="unit-spec-${unitId}.pdf"`);
    res.send(buffer);
  } catch (error: any) {
    console.error('Error exporting unit spec as PDF:', error);
    res.status(500).json({
      error: {
        code: 'EXPORT_ERROR',
        message: 'Failed to export unit specification as PDF',
        details: error.message,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    });
  }
});

/**
 * Export assessment package as DOCX
 * GET /api/export/assessment/:programId/docx
 */
router.get('/assessment/:programId/docx', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { programId } = req.params;

    const buffer = await documentExportService.exportAssessmentPackageDOCX(programId);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="assessment-package-${programId}.docx"`);
    res.send(buffer);
  } catch (error: any) {
    console.error('Error exporting assessment package as DOCX:', error);
    res.status(500).json({
      error: {
        code: 'EXPORT_ERROR',
        message: 'Failed to export assessment package as DOCX',
        details: error.message,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    });
  }
});

/**
 * Export assessment package as PDF
 * GET /api/export/assessment/:programId/pdf
 */
router.get('/assessment/:programId/pdf', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { programId } = req.params;

    const buffer = await documentExportService.exportAssessmentPackagePDF(programId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="assessment-package-${programId}.pdf"`);
    res.send(buffer);
  } catch (error: any) {
    console.error('Error exporting assessment package as PDF:', error);
    res.status(500).json({
      error: {
        code: 'EXPORT_ERROR',
        message: 'Failed to export assessment package as PDF',
        details: error.message,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    });
  }
});

/**
 * Export curriculum as SCORM package
 * GET /api/export/scorm/:programId
 */
router.get('/scorm/:programId', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { programId } = req.params;

    const buffer = await documentExportService.exportSCORMPackage(programId);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="scorm-package-${programId}.zip"`);
    res.send(buffer);
  } catch (error: any) {
    console.error('Error exporting SCORM package:', error);
    res.status(500).json({
      error: {
        code: 'EXPORT_ERROR',
        message: 'Failed to export SCORM package',
        details: error.message,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    });
  }
});

export default router;
