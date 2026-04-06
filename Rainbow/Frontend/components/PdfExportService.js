import { jsPDF } from 'jspdf';

class PdfExportService {
  constructor() {
    this.doc = null;
    this.margin = 20;
    this.pageHeight = 0;
    this.currentY = 0;
    this.lineHeight = 7;
    this.sectionSpacing = 10;
  }

  initPDF() {
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    this.pageHeight = this.doc.internal.pageSize.height;
    this.currentY = this.margin;

    this.doc.setFont('helvetica');
    this.doc.setFontSize(10);
  }

  checkPageBreak(spaceNeeded = 10) {
    if (this.currentY + spaceNeeded > this.pageHeight - this.margin) {
      this.doc.addPage();
      this.currentY = this.margin;
      return true;
    }
    return false;
  }

  extractPatientDemographics(prescription) {
    const patientInfo = {
      name: 'Not specified',
      age: 'Not specified',
      gender: 'Not specified',
      id: 'N/A',
    };

    if (!prescription) return patientInfo;

    const lines = prescription.split('\n');
    let inDemographics = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lowerLine = line.toLowerCase();
      
      // Check if we're entering Patient Demographics section
      if (
        lowerLine.includes('patient demographics:') ||
        lowerLine.includes('**patient demographics**') ||
        lowerLine.includes('patient demographics')
      ) {
        inDemographics = true;
        continue;
      }

      // Stop if we hit another major section (but not sub-items)
      if (inDemographics) {
        // Check if this is a new major section (starts with ** or is a known category)
        const majorSections = ['symptoms', 'physical examination', 'assessment', 'plan of action', 'medicine', 'lab', 'scan', 'instructions', 'next steps'];
        const isMajorSection = majorSections.some(section => 
          lowerLine.includes(`**${section}**`) || 
          (lowerLine.startsWith(section) && lowerLine.includes(':'))
        );
        
        if (isMajorSection) {
          break;
        }
      }

      if (inDemographics) {
        const trimmedLine = line.trim().replace(/^[-•*]\s*/, '');
        const lowerTrimmed = trimmedLine.toLowerCase();

        // Extract name
        if (lowerTrimmed.startsWith('name:')) {
          const extracted = trimmedLine.replace(/^name:\s*/i, '').trim();
          if (extracted && extracted.toLowerCase() !== 'none') {
            patientInfo.name = extracted;
          }
        }

        // Extract age
        if (lowerTrimmed.startsWith('age:')) {
          const extracted = trimmedLine.replace(/^age:\s*/i, '').trim();
          if (extracted && extracted.toLowerCase() !== 'none') {
            patientInfo.age = extracted;
          }
        }

        // Extract gender
        if (lowerTrimmed.startsWith('gender:')) {
          const extracted = trimmedLine.replace(/^gender:\s*/i, '').trim();
          if (extracted && extracted.toLowerCase() !== 'none') {
            patientInfo.gender = extracted;
          }
        }

        // Extract patient ID
        if (lowerTrimmed.startsWith('patient id:')) {
          const extracted = trimmedLine.replace(/^patient\s+id:\s*/i, '').trim();
          if (extracted && extracted.toLowerCase() !== 'none' && extracted !== 'n/a') {
            patientInfo.id = extracted;
          }
        }
      }
    }

    return patientInfo;
  }

  async addHeader(prescription, userInfo, metadata) {
    // Extract patient info from prescription's Patient Demographics section
    const patientInfo = this.extractPatientDemographics(prescription);

    this.doc.setFillColor(142, 59, 122);
    this.doc.rect(0, 0, this.doc.internal.pageSize.width, 35, 'F');

    // Add logo
    const logoW = 55;
    const logoH = 28;
    const logoX = this.margin;
    const logoY = 3.5;
    try {
      const response = await fetch('/rainbow-logo.png');
      const blob = await response.blob();
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
      this.doc.addImage(dataUrl, 'PNG', logoX, logoY, logoW, logoH);
    } catch (error) {
      console.warn('Could not load logo:', error);
    }

    const textX = logoX + logoW + 5;

    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Rainbow Hospital', textX, 14);

    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('FC-29, Plot No.5, Geetanjali, Near Malviya Nagar Metro Station Gate No.1, Delhi', textX, 22);
    this.doc.text('Phone: +91 8037836526', textX, 29);

    this.currentY = 45;

    this.doc.setFillColor(240, 240, 240);
    this.doc.rect(
      this.margin,
      this.currentY,
      this.doc.internal.pageSize.width - 2 * this.margin,
      30,
      'F'
    );

    this.doc.setTextColor(0, 0, 0);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('PATIENT INFORMATION', this.margin + 5, this.currentY + 8);

    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');

    const patientData = [
      `Name: ${patientInfo.name}`,
      `Age: ${patientInfo.age} | Gender: ${patientInfo.gender}`,
      `Date: ${new Date().toLocaleDateString()}`,
      `Time: ${new Date().toLocaleTimeString()}`,
    ];

    patientData.forEach((line, index) => {
      this.doc.text(line, this.margin + 5, this.currentY + 15 + index * 4);
    });

    const doctorInfo = [
      `Doctor: ${userInfo?.name || userInfo?.email || 'Dr. Unknown'}`,
      `Specialty: General Medicine`,
      `Model: ${metadata?.model || 'Nova-Lite'}`,
    ];

    doctorInfo.forEach((line, index) => {
      this.doc.text(
        line,
        this.doc.internal.pageSize.width - this.margin - 60,
        this.currentY + 15 + index * 4
      );
    });

    this.currentY += 35;
  }

  parsePrescriptionSections(text) {
    if (!text) return [];

    const lines = text.split('\n');
    const sections = [];
    let currentSection = null;
    let currentContent = [];

    // Match the exact categories the AI prompt outputs
    const categories = [
      'Patient Demographics',
      'Chief Complaints',
      'Present Illness',
      'Past Medical/Surgical History',
      'Family History',
      'Personal/Social History',
      'Developmental History',
      'Examination',
      'Diagnosis',
      'Procedure',
      'OB History',
      'Doctor Note',
      'Doctor Recommendation and Advice',
    ];

    const isMedicalDocHeader = (str) => {
      const cleaned = str.toLowerCase().replace(/[*•\-:\s]/g, '');
      return cleaned === 'medicaldocumentation';
    };

    for (const line of lines) {
      // Skip the "Medical Documentation:" header line itself
      if (isMedicalDocHeader(line)) continue;

      const category = categories.find(
        (cat) =>
          line.toLowerCase().includes(cat.toLowerCase() + ':') ||
          line.toLowerCase().includes('**' + cat.toLowerCase() + '**')
      );

      if (category) {
        if (currentSection) {
          sections.push({ category: currentSection, content: currentContent });
        }
        currentSection = category;
        // Strip markdown, bullets, and the category label to get inline content
        const headerContent = line
          .replace(/\*\*/g, '')
          .replace(/^[-•]\s*/, '')
          .replace(new RegExp(category + ':\\s*', 'i'), '')
          .trim();
        currentContent = headerContent && !isMedicalDocHeader(headerContent)
          ? [headerContent]
          : [];
      } else if (currentSection) {
        const trimmedLine = line.trim();
        if (trimmedLine && !isMedicalDocHeader(trimmedLine)) {
          const cleanLine = trimmedLine.replace(/^[-•]\s*/, '').trim();
          if (cleanLine) currentContent.push(cleanLine);
        }
      }
    }

    if (currentSection) sections.push({ category: currentSection, content: currentContent });

    // Exclude Patient Demographics (shown in header) and skip sections with no real content
    return sections.filter(section => {
      if (section.category === 'Patient Demographics') return false;
      const realContent = section.content.filter(
        item => item.trim() && item.trim().toLowerCase() !== 'none'
      );
      return realContent.length > 0;
    });
  }

  addPrescriptionContent(prescription) {
    const sections = this.parsePrescriptionSections(prescription);

    this.checkPageBreak(15);
    // Changed from pink (236, 47, 140) to purple #AB00D1 (171, 0, 209)
    this.doc.setFillColor(171, 0, 209);
    this.doc.rect(
      this.margin,
      this.currentY,
      this.doc.internal.pageSize.width - 2 * this.margin,
      8,
      'F'
    );

    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('MEDICAL DOCUMENTATION', this.margin + 5, this.currentY + 5.5);

    this.currentY += 15;

    sections.forEach((section) => {
      this.checkPageBreak(20);

      // Changed from pink (142, 59, 122) to purple #AB00D1 (171, 0, 209)
      this.doc.setTextColor(171, 0, 209);
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(section.category.toUpperCase(), this.margin, this.currentY);

      this.currentY += 5;

      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'normal');

      const filteredContent = section.content.filter(
        (item) => item.trim() && item.toLowerCase() !== 'medical documentation' && item.trim().toLowerCase() !== 'none'
      );

      if (filteredContent.length === 0) {
        this.doc.text('No data available', this.margin + 5, this.currentY);
        this.currentY += 4;
      } else {
        filteredContent.forEach((item) => {
          this.checkPageBreak(5);

          const cleanItem = item.replace(/^[-•]\s*/, '').trim();
          if (cleanItem) {
            const lines = this.doc.splitTextToSize(
              `• ${cleanItem}`,
              this.doc.internal.pageSize.width - 2 * this.margin - 10
            );
            lines.forEach((line) => {
              this.checkPageBreak(5);
              this.doc.text(line, this.margin + 5, this.currentY);
              this.currentY += 4;
            });
          }
        });
      }

      this.currentY += this.sectionSpacing;
    });
  }

  addFooter() {
    const pageCount = this.doc.internal.getNumberOfPages();

    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);

      this.doc.setFontSize(8);
      this.doc.setTextColor(100, 100, 100);
      this.doc.text(
        `Page ${i} of ${pageCount}`,
        this.doc.internal.pageSize.width / 2,
        this.doc.internal.pageSize.height - 10,
        { align: 'center' }
      );

      this.doc.text(
        'Confidential Medical Document - For Authorized Use Only',
        this.doc.internal.pageSize.width / 2,
        this.doc.internal.pageSize.height - 5,
        { align: 'center' }
      );
    }
  }

  addDiarizationResults(diarizationResults) {
    if (!diarizationResults?.statistics) return;

    this.checkPageBreak(25);

    this.doc.setFillColor(70, 130, 180);
    this.doc.rect(
      this.margin,
      this.currentY,
      this.doc.internal.pageSize.width - 2 * this.margin,
      8,
      'F'
    );

    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('CONVERSION ANALYSIS', this.margin + 5, this.currentY + 5.5);

    this.currentY += 15;

    this.doc.setTextColor(0, 0, 0);
    this.doc.setFontSize(9);

    const stats = diarizationResults.statistics;
    const analysisData = [
      `Total Speakers: ${stats.total_speakers}`,
      `Speaker IDs: ${stats.speaker_ids.join(', ')}`,
      `Total Segments: ${stats.total_segments}`,
      `Total Duration: ${stats.total_duration_seconds} seconds`,
      `Average Segment Length: ${stats.average_segment_duration_seconds?.toFixed(2) || 'N/A'} seconds`,
    ];

    analysisData.forEach((line) => {
      this.checkPageBreak(5);
      this.doc.text(line, this.margin, this.currentY);
      this.currentY += 4.5;
    });

    this.currentY += 5;
  }

  async exportPrescriptionPDF({
    prescription,
    user,
    metadata = {},
    diarizationResults = null,
    filename = `Medical_Prescription_${new Date().toISOString().replace(/[:.]/g, '-')}`,
  }) {
    try {
      this.initPDF();
      await this.addHeader(prescription, user, metadata);
      this.addPrescriptionContent(prescription);

      if (diarizationResults) {
        this.addDiarizationResults(diarizationResults);
      }

      this.addFooter();
      this.doc.save(`${filename}.pdf`);
      return true;
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error(`Failed to generate PDF: ${error.message}`);
    }
  }
}

// Export singleton instance
const pdfExportService = new PdfExportService();
export default pdfExportService;