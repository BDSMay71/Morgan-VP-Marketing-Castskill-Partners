import PptxGenJS from 'pptxgenjs';

const NAVY = '132240';
const GREEN = '2D6A4F';
const GOLD = 'B8962E';
const WHITE = 'FFFFFF';
const LIGHT_GRAY = 'F5F5F5';

function parseSlides(text) {
  // Split on slide markers: "Slide N:", "## Slide", "SLIDE N", numbered headers
  const slideBlocks = text.split(/(?:^|\n)(?:#{1,3}\s*)?(?:Slide\s+\d+|SLIDE\s+\d+|\d+\.\s+(?=[A-Z]))/im).filter(s => s.trim());

  if (slideBlocks.length < 2) {
    // Try splitting on double newlines as paragraph breaks
    return text.split(/\n{3,}/).filter(s => s.trim()).map((block, i) => {
      const lines = block.trim().split('\n').filter(l => l.trim());
      return {
        title: lines[0]?.replace(/^[#*-]+\s*/, '').trim() || `Slide ${i + 1}`,
        bullets: lines.slice(1).map(l => l.replace(/^[-•*·]\s*/, '').trim()).filter(Boolean)
      };
    });
  }

  return slideBlocks.map((block, i) => {
    const lines = block.trim().split('\n').filter(l => l.trim());
    const title = lines[0]?.replace(/^[:#*-]+\s*/, '').replace(/\*\*/g, '').trim() || `Slide ${i + 1}`;
    const bullets = lines.slice(1)
      .map(l => l.replace(/^[-•*·:]\s*/, '').replace(/\*\*/g, '').trim())
      .filter(l => l && l.length > 2);
    return { title, bullets };
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { content, title = 'Catskill Partners', subtitle = '' } = req.body;
    if (!content) return res.status(400).json({ error: 'No content provided' });

    const slides = parseSlides(content);
    const pptx = new PptxGenJS();

    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'Catskill Partners';
    pptx.subject = title;

    // Define master layout
    pptx.defineSlideMaster({
      title: 'CATSKILL_MASTER',
      background: { color: WHITE },
      objects: [
        // Navy header bar
        { rect: { x: 0, y: 0, w: '100%', h: 0.08, fill: { color: NAVY } } },
        // Gold accent bottom line
        { rect: { x: 0, y: 7.42, w: '100%', h: 0.08, fill: { color: GOLD } } },
        // Footer text
        { text: { text: 'CATSKILL PARTNERS  |  CONFIDENTIAL', options: { x: 0.4, y: 7.3, w: 8, h: 0.2, fontSize: 7, color: '999999', fontFace: 'Calibri' } } },
        { text: { text: 'info@catskillpartners.com', options: { x: 9, y: 7.3, w: 3, h: 0.2, fontSize: 7, color: '999999', fontFace: 'Calibri', align: 'right' } } },
      ]
    });

    // ── COVER SLIDE ──────────────────────────────────
    const cover = pptx.addSlide({ masterName: 'CATSKILL_MASTER' });
    cover.background = { color: NAVY };
    // Full navy background override
    cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: '100%', fill: { color: NAVY } });
    // Gold accent bar
    cover.addShape(pptx.ShapeType.rect, { x: 0, y: 6.8, w: '100%', h: 0.12, fill: { color: GOLD } });
    // Title
    cover.addText(title, {
      x: 0.8, y: 2.5, w: 10.8, h: 1.4,
      fontSize: 40, bold: true, color: WHITE,
      fontFace: 'Calibri', align: 'left'
    });
    // Subtitle
    if (subtitle) {
      cover.addText(subtitle, {
        x: 0.8, y: 4.0, w: 10.8, h: 0.6,
        fontSize: 20, color: 'AAAAAA', fontFace: 'Calibri', align: 'left'
      });
    }
    // Brand tagline
    cover.addText('CLARITY. CRAFT. CAPITAL.', {
      x: 0.8, y: 5.2, w: 6, h: 0.4,
      fontSize: 13, bold: true, color: GOLD,
      fontFace: 'Calibri', charSpacing: 3
    });
    cover.addText('We are operators first.', {
      x: 0.8, y: 5.65, w: 6, h: 0.35,
      fontSize: 12, color: 'CCCCCC', fontFace: 'Calibri', italic: true
    });

    // ── CONTENT SLIDES ───────────────────────────────
    slides.forEach((slide, idx) => {
      const s = pptx.addSlide({ masterName: 'CATSKILL_MASTER' });

      // Navy left accent bar
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 0.08, w: 0.12, h: 7.34, fill: { color: NAVY } });

      // Slide number
      s.addText(`${idx + 1}`, {
        x: 11.8, y: 7.25, w: 0.5, h: 0.25,
        fontSize: 8, color: '999999', fontFace: 'Calibri', align: 'right'
      });

      // Title
      s.addText(slide.title, {
        x: 0.35, y: 0.22, w: 11.4, h: 0.72,
        fontSize: 26, bold: true, color: NAVY,
        fontFace: 'Calibri', align: 'left'
      });

      // Gold divider under title
      s.addShape(pptx.ShapeType.rect, { x: 0.35, y: 1.0, w: 11.4, h: 0.03, fill: { color: GOLD } });

      // Bullet content
      if (slide.bullets.length > 0) {
        const bulletItems = slide.bullets.slice(0, 8).map(b => ({
          text: b,
          options: { bullet: { code: '2022', indent: 10 }, color: '1A1A1A', fontSize: 16, fontFace: 'Calibri', paraSpaceAfter: 8 }
        }));

        s.addText(bulletItems, {
          x: 0.55, y: 1.15, w: 11.1, h: 6.0,
          valign: 'top', fontFace: 'Calibri'
        });
      }
    });

    // ── CLOSING SLIDE ────────────────────────────────
    const closing = pptx.addSlide({ masterName: 'CATSKILL_MASTER' });
    closing.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: '100%', fill: { color: NAVY } });
    closing.addShape(pptx.ShapeType.rect, { x: 0, y: 6.8, w: '100%', h: 0.12, fill: { color: GOLD } });
    closing.addText("Let's Build Enduring Value Together", {
      x: 0.8, y: 2.6, w: 10.8, h: 1.2,
      fontSize: 34, bold: true, color: WHITE, fontFace: 'Calibri'
    });
    closing.addText('info@catskillpartners.com', {
      x: 0.8, y: 4.1, w: 6, h: 0.5,
      fontSize: 16, color: GOLD, fontFace: 'Calibri'
    });
    closing.addText('CLARITY. CRAFT. CAPITAL.', {
      x: 0.8, y: 5.0, w: 6, h: 0.4,
      fontSize: 13, bold: true, color: GOLD, fontFace: 'Calibri', charSpacing: 3
    });

    // Generate as base64
    const b64 = await pptx.write({ outputType: 'base64' });

    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({ pptx: b64, slides: slides.length + 2 });

  } catch (err) {
    console.error('PPTX error:', err);
    res.status(500).json({ error: 'Failed to generate PPTX', detail: err.message });
  }
}
