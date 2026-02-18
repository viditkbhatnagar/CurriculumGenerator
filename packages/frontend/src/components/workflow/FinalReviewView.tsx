'use client';

import { useState } from 'react';
import { CurriculumWorkflow } from '@/types/workflow';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface Props {
  workflow: CurriculumWorkflow;
}

export default function FinalReviewView({ workflow }: Props) {
  const [downloadingWord, setDownloadingWord] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [downloadingPPT, setDownloadingPPT] = useState(false);
  const [downloadingSCORM, setDownloadingSCORM] = useState(false);

  const handleDownloadWord = async () => {
    setDownloadingWord(true);
    try {
      const response = await fetch(`${API_BASE}/api/v3/workflow/${workflow._id}/export/word`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${workflow.projectName}_Curriculum.docx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Failed to generate Word document. Please try again.');
      }
    } catch (error) {
      console.error('Error downloading Word document:', error);
      alert('Error downloading Word document. Please try again.');
    } finally {
      setDownloadingWord(false);
    }
  };

  const handleDownloadPDF = async () => {
    setDownloadingPDF(true);
    try {
      const response = await fetch(`${API_BASE}/api/v3/workflow/${workflow._id}/export/pdf`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${workflow.projectName}_Curriculum.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Failed to generate PDF document. Please try again.');
      }
    } catch (error) {
      console.error('Error downloading PDF document:', error);
      alert('Error downloading PDF document. Please try again.');
    } finally {
      setDownloadingPDF(false);
    }
  };

  const handleDownloadPPTs = async () => {
    setDownloadingPPT(true);
    try {
      const response = await fetch(`${API_BASE}/api/v3/ppt/generate/all/${workflow._id}`, {
        method: 'POST',
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${workflow.projectName}_All_PPTs.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Failed to generate PPTs. Please try again.');
      }
    } catch (error) {
      console.error('Error downloading PPTs:', error);
      alert('Error downloading PPTs. Please try again.');
    } finally {
      setDownloadingPPT(false);
    }
  };

  const handleDownloadSCORM = async () => {
    setDownloadingSCORM(true);
    try {
      const response = await fetch(`${API_BASE}/api/v3/workflow/${workflow._id}/export/scorm`, {
        method: 'POST',
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${workflow.projectName}_SCORM.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to generate SCORM package. Please try again.');
      }
    } catch (error) {
      console.error('Error downloading SCORM:', error);
      alert('Error downloading SCORM package. Please try again.');
    } finally {
      setDownloadingSCORM(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Success Banner */}
      <div className="bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-500/30 rounded-xl p-8 text-center mb-8">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-emerald-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-teal-800 mb-3">🎉 Curriculum Complete!</h1>
        <p className="text-lg text-teal-700 mb-2">{workflow.projectName}</p>
        <p className="text-teal-600">
          Your complete curriculum is ready for download. All 13 steps have been generated with
          lesson plans, PowerPoint decks, assignment packs, and summative exam.
        </p>
      </div>

      {/* Curriculum Summary */}
      <div className="bg-white/50 rounded-xl border border-teal-200/50 p-6 mb-6">
        <h2 className="text-xl font-bold text-teal-800 mb-4">Curriculum Summary</h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          <div className="bg-slate-900/50 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-teal-600">
              {workflow.step10?.moduleLessonPlans?.length || 0}
            </p>
            <p className="text-sm text-teal-600 mt-1">Modules</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-blue-400">
              {workflow.step10?.summary?.totalLessons || 0}
            </p>
            <p className="text-sm text-teal-600 mt-1">Lessons</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-purple-400">
              {workflow.step10?.summary?.totalContactHours || 0}h
            </p>
            <p className="text-sm text-teal-600 mt-1">Contact Hours</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-orange-400">
              {workflow.step10?.moduleLessonPlans?.reduce(
                (sum: number, m: any) => sum + (m.pptDecks?.length || 0),
                0
              ) || 0}
            </p>
            <p className="text-sm text-teal-600 mt-1">PPT Decks</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-amber-400">
              {workflow.step12?.summary?.totalAssignmentPacks || 0}
            </p>
            <p className="text-sm text-teal-600 mt-1">Assignments</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-red-400">
              {workflow.step13?.summary?.totalQuestions || 0}
            </p>
            <p className="text-sm text-teal-600 mt-1">Exam Questions</p>
          </div>
        </div>
      </div>

      {/* Download Options */}
      <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl p-6 mb-6">
        <h2 className="text-xl font-bold text-teal-800 mb-4 flex items-center gap-2">
          <svg
            className="w-6 h-6 text-blue-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Download Complete Curriculum
        </h2>
        <p className="text-teal-600 text-sm mb-6">
          Download your complete curriculum package with all 13 steps, lesson plans, PPT files,
          assignment packs, and summative exam.
        </p>

        {/* Download Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Word Document */}
          <button
            onClick={handleDownloadWord}
            disabled={downloadingWord}
            className="flex items-center gap-3 px-5 py-4 bg-blue-600 hover:bg-blue-500 text-teal-800 rounded-lg transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
              {downloadingWord ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              )}
            </div>
            <div className="flex-1 text-left">
              <div className="font-semibold text-lg">
                {downloadingWord ? 'Generating Word Document...' : 'Download Word Document'}
              </div>
              <div className="text-sm opacity-90">
                {downloadingWord ? 'Please wait, this may take a moment' : 'All 13 Steps (.docx)'}
              </div>
            </div>
            <svg
              className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* PDF Document */}
          <button
            onClick={handleDownloadPDF}
            disabled={downloadingPDF}
            className="flex items-center gap-3 px-5 py-4 bg-red-600 hover:bg-red-500 text-teal-800 rounded-lg transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
              {downloadingPDF ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              )}
            </div>
            <div className="flex-1 text-left">
              <div className="font-semibold text-lg">
                {downloadingPDF ? 'Generating PDF...' : 'Download PDF'}
              </div>
              <div className="text-sm opacity-90">
                {downloadingPDF ? 'Please wait, this may take a moment' : 'All 13 Steps (.pdf)'}
              </div>
            </div>
            <svg
              className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* PowerPoint ZIP */}
          <button
            onClick={handleDownloadPPTs}
            disabled={downloadingPPT}
            className="flex items-center gap-3 px-5 py-4 bg-orange-600 hover:bg-orange-500 text-teal-800 rounded-lg transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
              {downloadingPPT ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              )}
            </div>
            <div className="flex-1 text-left">
              <div className="font-semibold text-lg">
                {downloadingPPT ? 'Generating PPTs...' : 'Download PowerPoints'}
              </div>
              <div className="text-sm opacity-90">
                {downloadingPPT
                  ? 'This may take 10-20 minutes for all modules'
                  : 'All Modules (.zip)'}
              </div>
            </div>
            <svg
              className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* SCORM Package */}
          <button
            onClick={handleDownloadSCORM}
            disabled={downloadingSCORM}
            className="flex items-center gap-3 px-5 py-4 bg-purple-600 hover:bg-purple-500 text-teal-800 rounded-lg transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
              {downloadingSCORM ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                  />
                </svg>
              )}
            </div>
            <div className="flex-1 text-left">
              <div className="font-semibold text-lg">
                {downloadingSCORM ? 'Generating SCORM...' : 'Export SCORM Package'}
              </div>
              <div className="text-sm opacity-90">LMS-Ready (.zip)</div>
            </div>
            <svg
              className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* What's Included */}
      <div className="bg-white/50 rounded-xl border border-teal-200/50 p-6">
        <h3 className="text-lg font-semibold text-teal-800 mb-4">What's Included</h3>
        <div className="space-y-3 text-sm text-teal-700">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <div>
              <p className="font-medium text-teal-800">Word Document (.docx)</p>
              <p className="text-teal-600">
                Complete curriculum with all 13 steps: Program Foundation, Competencies, PLOs,
                Modules, Sources, Readings, Assessments, Case Studies, Glossary, Lesson Plans,
                PowerPoints, Assignment Packs, and Summative Exam
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            <div>
              <p className="font-medium text-teal-800">PDF Document (.pdf)</p>
              <p className="text-teal-600">
                Same content as Word document, in PDF format for easy sharing and viewing
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            <div>
              <p className="font-medium text-teal-800">PowerPoint ZIP (.zip)</p>
              <p className="text-teal-600">
                Individual PowerPoint files for each lesson across all modules, ready for classroom
                delivery
              </p>
              <p className="text-amber-400 text-xs mt-1">
                ⚠️ Note: PPT generation takes 10-20 minutes for all{' '}
                {workflow.step10?.summary?.totalLessons || 0} lessons. Please be patient.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
              />
            </svg>
            <div>
              <p className="font-medium text-teal-800">SCORM Package (.zip)</p>
              <p className="text-teal-600">
                LMS-ready package with all content, assessments, and tracking capabilities for
                online learning platforms
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
