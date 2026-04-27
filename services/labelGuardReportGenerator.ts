
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AnalysisResult, Severity, LGComplianceStatus, AnalysisValidity, LabelFile } from '../types-labelguard';

export const generatePDF = (result: AnalysisResult, fileName: string) => {
  const doc = new jsPDF();
  addReportToDoc(doc, result, fileName);
  doc.save(`FDA_Report_${fileName.replace(/\.[^/.]+$/, '')}.pdf`);
};

export const generateBatchPDF = (files: LabelFile[]) => {
  const doc = new jsPDF();
  const successfulFiles = files.filter(f => f.status === 'done' && f.result);
  if (successfulFiles.length === 0) return;

  successfulFiles.forEach((file, index) => {
    if (index > 0) doc.addPage();
    if (file.result) addReportToDoc(doc, file.result, file.file.name);
  });

  doc.save(`FDA_Batch_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
};

const addReportToDoc = (doc: jsPDF, result: AnalysisResult, fileName: string) => {
  const pageWidth = doc.internal.pageSize.width;

  // Header
  doc.setFontSize(20);
  doc.setTextColor(22, 78, 99);
  doc.text('FDA LabelGuard Report', 14, 20);

  // Metadata
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`File: ${fileName}`, 14, 30);
  doc.text(`Date: ${new Date().toLocaleString()}`, 14, 35);

  // Status
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text('Status:', 14, 45);

  let statusColor = [100, 100, 100];
  let statusText: string = result.status;

  switch (result.status) {
    case LGComplianceStatus.PASS:              statusColor = [22, 163, 74];   statusText = 'COMPLIANT';    break;
    case LGComplianceStatus.FAIL:              statusColor = [220, 38, 38];   statusText = 'CRITICAL FAIL'; break;
    case LGComplianceStatus.MINOR_ISSUES:      statusColor = [234, 88, 12];   statusText = 'MINOR ISSUES'; break;
    case LGComplianceStatus.POTENTIAL_WARNING: statusColor = [202, 138, 4];   statusText = 'NEEDS REVIEW'; break;
    case LGComplianceStatus.INVALID_INPUT:     statusColor = [100, 116, 139]; statusText = 'SKIPPED';      break;
  }

  doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(statusText, 35, 45);

  // Early exit for invalid input
  if (result.validity !== AnalysisValidity.VALID) {
    doc.setFontSize(11);
    doc.setTextColor(60);
    doc.setFont('helvetica', 'normal');
    const summary = doc.splitTextToSize(`Reason: ${result.executiveSummary}`, pageWidth - 28);
    doc.text(summary, 14, 60);
    return;
  }

  // Executive Summary
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0);
  doc.setFontSize(12);
  doc.text('Executive Summary', 14, 60);

  doc.setFontSize(10);
  doc.setTextColor(60);
  const splitSummary = doc.splitTextToSize(result.executiveSummary, pageWidth - 28);
  doc.text(splitSummary, 14, 66);

  let finalY = 66 + splitSummary.length * 5;

  // Mandatory Checklist
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.text('Mandatory Elements', 14, finalY + 10);

  const checklistData = result.mandatoryElements.map(e => [e.element, e.present ? 'OK' : 'MISSING', e.notes]);

  autoTable(doc, {
    startY: finalY + 15,
    head: [['Element', 'Status', 'Notes']],
    body: checklistData,
    theme: 'striped',
    headStyles: { fillColor: [52, 73, 94] },
    styles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 50, fontStyle: 'bold' }, 1: { cellWidth: 20 }, 2: { cellWidth: 'auto' } },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        if (data.cell.raw === 'MISSING') {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [22, 163, 74];
        }
      }
    }
  });

  finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;

  // Violations Table
  if (result.violations.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.text('Violations & Recommendations', 14, finalY);

    const violationData = result.violations.map(v => [
      v.ruleName,
      v.severity,
      `${v.description}\n\nFIX: ${v.recommendation}${v.suggestedText ? `\n\nSuggestion: "${v.suggestedText}"` : ''}`
    ]);

    autoTable(doc, {
      startY: finalY + 5,
      head: [['Rule', 'Severity', 'Details']],
      body: violationData,
      theme: 'grid',
      headStyles: { fillColor: [30, 64, 175] },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 0: { cellWidth: 40, fontStyle: 'bold' }, 1: { cellWidth: 25, fontStyle: 'bold' }, 2: { cellWidth: 'auto' } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          const severity = data.cell.raw;
          if (severity === Severity.CRITICAL)      data.cell.styles.textColor = [220, 38, 38];
          else if (severity === Severity.WARNING)  data.cell.styles.textColor = [234, 88, 12];
          else                                     data.cell.styles.textColor = [37, 99, 235];
        }
      }
    });
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(22, 163, 74);
    doc.text('No violations detected.', 14, finalY + 5);
  }
};
