import PptxGenJS from 'pptxgenjs';

// ─── CATSKILL PARTNERS BRAND PALETTE (extracted from actual deck) ───────────
const NAVY    = '132240';
const GREEN   = '2D6A4F';
const GREEN2  = '1A4731';
const GOLD    = 'B8962E';
const WHITE   = 'FFFFFF';
const LGRAY   = 'F9F9F7';
const MGRAY   = 'C8C8C3';
const DGRAY   = '2C2C2C';
const TEAL    = '1A7A8A';

// ─── FONT: Calibri (matches deck exactly) ───────────────────────────────────
const FONT    = 'Calibri';
const FONT_H  = 'Calibri'; // Inter ExtraBold not available in pptxgenjs

// ─── SLIDE SIZE: 13.33 x 7.5 (widescreen 16:9) ─────────────────────────────
function makePptx() {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5
  pptx.author = 'Catskill Partners';
  pptx.company = 'Catskill Partners';
  return pptx;
}

// ─── HELPER: Add branded header bar to every slide ─────────────────────────
function addHeader(slide, pptx, title, subtitle = '') {
  // Navy header band
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: 0.72,
    fill: { color: NAVY }, line: { color: NAVY }
  });
  // Gold accent left bar
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 0.06, h: '100%',
    fill: { color: GOLD }, line: { color: GOLD }
  });
  // Slide title in header
  if (title) {
    slide.addText(title, {
      x: 0.22, y: 0.1, w: 11.8, h: 0.52,
      fontFace: FONT_H, fontSize: 20, bold: true, color: WHITE,
      valign: 'middle'
    });
  }
  // Gold footer bar
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 7.3, w: '100%', h: 0.08,
    fill: { color: GOLD }, line: { color: GOLD }
  });
  // Footer text
  slide.addText('CATSKILL PARTNERS  |  CONFIDENTIAL  |  info@catskillpartners.com', {
    x: 0.2, y: 7.32, w: 9, h: 0.18,
    fontFace: FONT, fontSize: 7, color: MGRAY
  });
}

// ─── HELPER: Add slide number ───────────────────────────────────────────────
function addSlideNum(slide, n) {
  slide.addText(`${n}`, {
    x: 12.8, y: 7.32, w: 0.4, h: 0.18,
    fontFace: FONT, fontSize: 7, color: MGRAY, align: 'right'
  });
}

// ─── HELPER: Parse structured slide output from Claude ──────────────────────
function parseSlides(text) {
  const slides = [];

  // Try structured format first: ---SLIDE N: Title---
  const structuredRe = /---SLIDE\s+\d+:\s*([^\n-]+)---\n([\s\S]*?)(?=---SLIDE|\s*$)/gi;
  let match;
  while ((match = structuredRe.exec(text)) !== null) {
    const title = match[1].trim();
    const body = match[2].trim();

    const headlineMatch = body.match(/HEADLINE:\s*([^\n]+)/i);
    const statMatch = body.match(/STAT CALLOUT:\s*([^\n]+)/i);
    const notesMatch = body.match(/SPEAKER NOTES:\s*([\s\S]+?)(?=\n[A-Z]+:|$)/i);
    const sourceMatch = body.match(/SOURCE:\s*([^\n]+)/i);

    const bulletSection = body.match(/BULLETS:\n([\s\S]+?)(?=\n[A-Z]+:|$)/i);
    let bullets = [];
    if (bulletSection) {
      bullets = bulletSection[1].split('\n')
        .map(l => l.replace(/^[-•*·]\s*/, '').trim())
        .filter(l => l && l.length > 3)
        .slice(0, 6);
    } else {
      // Fall back: lines starting with - or bullet
      bullets = body.split('\n')
        .filter(l => l.match(/^[-•*·]/))
        .map(l => l.replace(/^[-•*·]\s*/, '').trim())
        .filter(Boolean)
        .slice(0, 6);
    }

    slides.push({
      title,
      headline: headlineMatch?.[1]?.trim() || '',
      bullets,
      stat: statMatch?.[1]?.trim() || '',
      notes: notesMatch?.[1]?.trim() || '',
      source: sourceMatch?.[1]?.trim() || ''
    });
  }

  // Fallback: split on double newlines
  if (slides.length < 2) {
    const blocks = text.split(/\n{2,}/).filter(b => b.trim().length > 10);
    blocks.forEach((block, i) => {
      const lines = block.split('\n').filter(l => l.trim());
      if (!lines.length) return;
      const title = lines[0].replace(/^[#\d\.\-\*]+\s*/, '').replace(/\*\*/g, '').trim();
      const bullets = lines.slice(1)
        .map(l => l.replace(/^[-•*·\d\.]+\s*/, '').replace(/\*\*/g, '').trim())
        .filter(l => l.length > 3)
        .slice(0, 6);
      slides.push({ title, headline: '', bullets, stat: '', notes: '', source: '' });
    });
  }

  return slides;
}

// ─── SLIDE BUILDERS ─────────────────────────────────────────────────────────

function buildCoverSlide(pptx, title, subtitle, date) {
  const slide = pptx.addSlide();
  // Full navy background
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: '100%',
    fill: { color: NAVY }, line: { color: NAVY }
  });
  // Gold left accent bar
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 0.18, h: '100%',
    fill: { color: GOLD }, line: { color: GOLD }
  });
  // Gold horizontal bar mid
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.18, y: 4.5, w: 13.15, h: 0.04,
    fill: { color: GOLD }, line: { color: GOLD }
  });
  // CLARITY. CRAFT. CAPITAL. tag
  slide.addText('CLARITY. CRAFT. CAPITAL.', {
    x: 0.6, y: 1.1, w: 10, h: 0.45,
    fontFace: FONT_H, fontSize: 13, bold: true, color: GOLD,
    charSpacing: 4
  });
  slide.addText('We are operators first.', {
    x: 0.6, y: 1.6, w: 8, h: 0.38,
    fontFace: FONT, fontSize: 12, color: MGRAY, italic: true
  });
  // Main title
  slide.addText(title, {
    x: 0.6, y: 2.1, w: 12.4, h: 1.6,
    fontFace: FONT_H, fontSize: 38, bold: true, color: WHITE,
    valign: 'top'
  });
  // Subtitle
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.6, y: 3.85, w: 10, h: 0.55,
      fontFace: FONT, fontSize: 17, color: MGRAY
    });
  }
  // Date
  if (date) {
    slide.addText(date, {
      x: 0.6, y: 4.65, w: 6, h: 0.35,
      fontFace: FONT, fontSize: 11, color: GOLD
    });
  }
  // Footer
  slide.addText('info@catskillpartners.com  |  www.catskillpartners.com', {
    x: 0.6, y: 7.1, w: 8, h: 0.3,
    fontFace: FONT, fontSize: 9, color: MGRAY
  });
  return slide;
}

function buildContentSlide(pptx, slideData, slideNum) {
  const slide = pptx.addSlide();
  slide.background = { color: LGRAY };

  addHeader(slide, pptx, slideData.title);
  addSlideNum(slide, slideNum);

  const hasStat = slideData.stat && slideData.stat.length > 0;
  const contentW = hasStat ? 8.6 : 12.8;

  // Headline (sub-header below nav bar)
  if (slideData.headline) {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.22, y: 0.78, w: contentW, h: 0.42,
      fill: { color: 'EBF5EE' }, line: { color: GREEN, pt: 0.5 }
    });
    slide.addText(slideData.headline, {
      x: 0.35, y: 0.78, w: contentW - 0.2, h: 0.42,
      fontFace: FONT, fontSize: 13, bold: true, color: GREEN,
      valign: 'middle'
    });
  }

  // Bullet points
  const bulletTop = slideData.headline ? 1.32 : 0.84;
  const bulletH = 7.1 - bulletTop;

  if (slideData.bullets.length > 0) {
    const bulletItems = slideData.bullets.map((b, i) => {
      // First bullet bigger/bolder
      return {
        text: b,
        options: {
          bullet: { type: 'number', style: 'arabicPeriod', indent: 20 },
          color: i === 0 ? DGRAY : '444444',
          fontSize: i === 0 ? 15 : 14,
          bold: i === 0,
          fontFace: FONT,
          paraSpaceAfter: 10,
          paraSpaceBefore: i === 0 ? 4 : 0
        }
      };
    });

    slide.addText(bulletItems, {
      x: 0.22, y: bulletTop, w: contentW, h: bulletH - 0.3,
      valign: 'top', fontFace: FONT
    });
  }

  // Stat callout box (right side)
  if (hasStat) {
    const statParts = slideData.stat.split('\n');
    const bigStat = statParts[0] || '';
    const statLabel = statParts.slice(1).join(' ') || '';

    // Callout box
    slide.addShape(pptx.ShapeType.rect, {
      x: 9.18, y: 0.78, w: 3.98, h: 6.42,
      fill: { color: NAVY }, line: { color: GOLD, pt: 1.5 }
    });
    // Gold accent top
    slide.addShape(pptx.ShapeType.rect, {
      x: 9.18, y: 0.78, w: 3.98, h: 0.08,
      fill: { color: GOLD }, line: { color: GOLD }
    });

    // Big stat number
    slide.addText(bigStat, {
      x: 9.18, y: 1.4, w: 3.98, h: 2.0,
      fontFace: FONT_H, fontSize: 52, bold: true, color: GOLD,
      align: 'center', valign: 'middle'
    });

    // Stat label
    if (statLabel) {
      slide.addText(statLabel, {
        x: 9.3, y: 3.55, w: 3.74, h: 1.5,
        fontFace: FONT, fontSize: 13, color: WHITE,
        align: 'center', wrap: true
      });
    }

    // Source
    if (slideData.source) {
      slide.addText(`Source: ${slideData.source}`, {
        x: 9.3, y: 6.8, w: 3.74, h: 0.32,
        fontFace: FONT, fontSize: 8, color: MGRAY,
        align: 'center', italic: true
      });
    }
  }

  return slide;
}

function buildSectionDivider(pptx, sectionTitle, sectionNum) {
  const slide = pptx.addSlide();
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: '100%',
    fill: { color: GREEN2 }, line: { color: GREEN2 }
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 0.18, h: '100%',
    fill: { color: GOLD }, line: { color: GOLD }
  });
  slide.addText(`0${sectionNum}`, {
    x: 0.6, y: 1.5, w: 3, h: 1.2,
    fontFace: FONT_H, fontSize: 72, bold: true, color: GOLD,
    transparency: 40
  });
  slide.addText(sectionTitle, {
    x: 0.6, y: 2.8, w: 11.8, h: 1.5,
    fontFace: FONT_H, fontSize: 36, bold: true, color: WHITE
  });
  slide.addText('CATSKILL PARTNERS', {
    x: 0.6, y: 6.8, w: 6, h: 0.45,
    fontFace: FONT, fontSize: 10, color: GOLD, charSpacing: 3
  });
  return slide;
}

function buildClosingSlide(pptx) {
  const slide = pptx.addSlide();
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: '100%',
    fill: { color: NAVY }, line: { color: NAVY }
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 0.18, h: '100%',
    fill: { color: GOLD }, line: { color: GOLD }
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 5.6, w: '100%', h: 0.04,
    fill: { color: GOLD }, line: { color: GOLD }
  });
  slide.addText("Let's Build Enduring Value Together", {
    x: 0.6, y: 1.8, w: 12.0, h: 1.5,
    fontFace: FONT_H, fontSize: 36, bold: true, color: WHITE
  });
  slide.addText('We partner with management teams, investors, and strategic operators\nwho share our belief in clarity, craft, and stewardship of capital.', {
    x: 0.6, y: 3.5, w: 10, h: 1.0,
    fontFace: FONT, fontSize: 14, color: MGRAY, lineSpacingMultiple: 1.3
  });
  slide.addText('info@catskillpartners.com', {
    x: 0.6, y: 5.8, w: 5, h: 0.45,
    fontFace: FONT, fontSize: 15, color: GOLD, bold: true
  });
  slide.addText('www.catskillpartners.com', {
    x: 0.6, y: 6.3, w: 5, h: 0.35,
    fontFace: FONT, fontSize: 12, color: MGRAY
  });
  slide.addText('CLARITY. CRAFT. CAPITAL.', {
    x: 7.5, y: 5.8, w: 5.5, h: 0.45,
    fontFace: FONT_H, fontSize: 13, bold: true, color: GOLD,
    charSpacing: 3, align: 'right'
  });
  return slide;
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { content, title = 'Catskill Partners', subtitle = '', audience = '', purpose = '', date = '' } = req.body;
    if (!content) return res.status(400).json({ error: 'No content provided' });

    const pptx = makePptx();
    pptx.title = title;

    const presentationDate = date || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Cover slide
    buildCoverSlide(pptx, title, subtitle || audience || purpose, presentationDate);

    // Parse slides from Claude output
    const slides = parseSlides(content);

    // Detect section dividers: slides whose title is ALL CAPS and short (likely section headers)
    let sectionCount = 0;
    let slideNum = 1;

    slides.forEach((slideData) => {
      const isSectionHeader = slideData.title === slideData.title.toUpperCase()
        && slideData.title.length < 40
        && slideData.bullets.length === 0
        && !slideData.stat;

      if (isSectionHeader) {
        sectionCount++;
        buildSectionDivider(pptx, slideData.title, sectionCount);
      } else {
        buildContentSlide(pptx, slideData, slideNum++);
      }
    });

    // Closing slide
    buildClosingSlide(pptx);

    const b64 = await pptx.write({ outputType: 'base64' });
    res.status(200).json({
      pptx: b64,
      slides: slides.length + 2,
      title
    });

  } catch (err) {
    console.error('PPTX error:', err);
    res.status(500).json({ error: 'Failed to generate PPTX', detail: err.message });
  }
}
