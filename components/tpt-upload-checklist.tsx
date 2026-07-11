'use client';

import { useState } from 'react';
import { TPTChecklist } from '@/lib/tpt-checklist';
import { CheckCircle2, Circle, Download, Copy, AlertCircle } from 'lucide-react';

interface TPTUploadChecklistProps {
  checklist: TPTChecklist;
  onDownloadChecklist?: () => void;
}

export function TPTUploadChecklist({
  checklist,
  onDownloadChecklist,
}: TPTUploadChecklistProps) {
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(
    new Set()
  );
  const [copiedMetadata, setCopiedMetadata] = useState(false);

  const toggleStep = (stepId: string) => {
    const newCompleted = new Set(completedSteps);
    if (newCompleted.has(stepId)) {
      newCompleted.delete(stepId);
    } else {
      newCompleted.add(stepId);
    }
    setCompletedSteps(newCompleted);
  };

  const copyMetadataToClipboard = () => {
    navigator.clipboard.writeText(checklist.preformattedMetadata);
    setCopiedMetadata(true);
    setTimeout(() => setCopiedMetadata(false), 2000);
  };

  const completionPercentage = Math.round(
    (completedSteps.size / checklist.steps.length) * 100
  );

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          TPT Upload Checklist
        </h1>
        <p className="text-gray-600 mb-4">
          {checklist.bundleName}
        </p>

        {/* Progress Bar */}
        <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className="bg-blue-600 h-full transition-all duration-300"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
        <p className="text-sm text-gray-600 mt-2">
          {completedSteps.size} of {checklist.steps.length} steps completed ({completionPercentage}%)
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8 flex gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-1">Teachers Pay Teachers Manual Upload</p>
          <p>
            TPT doesn't have a public upload API. This checklist guides you through manual upload 
            and includes pre-formatted metadata you can copy directly into TPT's product form.
          </p>
        </div>
      </div>

      {/* Download Button */}
      {onDownloadChecklist && (
        <div className="mb-8">
          <button
            onClick={onDownloadChecklist}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Checklist as Text
          </button>
        </div>
      )}

      {/* Steps */}
      <div className="space-y-6 mb-8">
        {checklist.steps.map((step) => (
          <div
            key={step.id}
            className={`border rounded-lg p-6 transition-all ${
              completedSteps.has(step.id)
                ? 'bg-green-50 border-green-200'
                : 'bg-white border-gray-200'
            }`}
          >
            {/* Step Header */}
            <button
              onClick={() => toggleStep(step.id)}
              className="w-full flex items-start gap-4 cursor-pointer group"
            >
              <div className="pt-1">
                {completedSteps.has(step.id) ? (
                  <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                ) : (
                  <Circle className="w-6 h-6 text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
                )}
              </div>
              <div className="flex-1 text-left">
                <h3 className={`text-lg font-semibold ${
                  completedSteps.has(step.id) ? 'text-green-900 line-through' : 'text-gray-900'
                }`}>
                  {step.title}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {step.description}
                </p>
              </div>
            </button>

            {/* Instructions */}
            <div className="ml-10 mt-4 space-y-2">
              {step.instructions.map((instruction, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <span className="text-gray-400 mt-1">•</span>
                  <p className="text-gray-700">{instruction}</p>
                </div>
              ))}
            </div>

            {/* Metadata Display (for step 5) */}
            {step.id === '5-metadata' && (
              <div className="ml-10 mt-6">
                <div className="bg-white border border-gray-300 rounded p-4 font-mono text-sm text-gray-800 whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
                  {checklist.preformattedMetadata}
                </div>
                <button
                  onClick={copyMetadataToClipboard}
                  className="mt-3 inline-flex items-center gap-2 px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 rounded transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  {copiedMetadata ? 'Copied!' : 'Copy Metadata'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Bundle Information</h3>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-600">Bundle Name</dt>
            <dd className="font-medium text-gray-900">{checklist.bundleName}</dd>
          </div>
          <div>
            <dt className="text-gray-600">Bundle ID</dt>
            <dd className="font-medium text-gray-900 font-mono text-xs">{checklist.bundleId}</dd>
          </div>
          <div>
            <dt className="text-gray-600">Resources Included</dt>
            <dd className="font-medium text-gray-900">
              {checklist.steps.find(s => s.id === '1-prepare')?.instructions[3]?.match(/\d+/) || 'N/A'}
            </dd>
          </div>
          <div>
            <dt className="text-gray-600">Generated</dt>
            <dd className="font-medium text-gray-900">
              {new Date(checklist.generatedAt).toLocaleDateString()}
            </dd>
          </div>
        </dl>
      </div>

      {/* Footer */}
      <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
        <p className="font-semibold mb-2">💡 Pro Tips:</p>
        <ul className="space-y-1 ml-4 list-disc">
          <li>Keep this checklist open while uploading to TPT</li>
          <li>Use the pre-formatted metadata to save time</li>
          <li>Double-check file count before publishing</li>
          <li>Save your TPT bundle URL for your records</li>
        </ul>
      </div>
    </div>
  );
}
