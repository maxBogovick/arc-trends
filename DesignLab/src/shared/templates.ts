import type { DesignNode } from './types'

export type FileTemplateId = 'blank' | 'mobile-onboarding' | 'saas-dashboard' | 'landing-page' | 'design-system'

export interface FileTemplate {
  id: FileTemplateId
  name: string
  summary: string
  bestFor: string
  nodeCount: number
}

type TemplateNode = Omit<DesignNode, 'id' | 'fileId'>

export const FILE_TEMPLATES: FileTemplate[] = [
  {
    id: 'blank',
    name: 'Blank canvas',
    summary: 'Start with an empty file and build from scratch.',
    bestFor: 'Experiments',
    nodeCount: 0,
  },
  {
    id: 'mobile-onboarding',
    name: 'Mobile onboarding',
    summary: 'Two phone screens with hierarchy, CTA states, and copy blocks.',
    bestFor: 'Product flows',
    nodeCount: 15,
  },
  {
    id: 'saas-dashboard',
    name: 'SaaS dashboard',
    summary: 'A dense admin layout with navigation, metric cards, chart area, and table shell.',
    bestFor: 'Data UI',
    nodeCount: 17,
  },
  {
    id: 'landing-page',
    name: 'Landing page',
    summary: 'A hero section with navigation, offer copy, CTAs, proof, and feature blocks.',
    bestFor: 'Marketing pages',
    nodeCount: 18,
  },
  {
    id: 'design-system',
    name: 'Design system starter',
    summary: 'Buttons, inputs, color tokens, type samples, and component states.',
    bestFor: 'UI libraries',
    nodeCount: 17,
  },
]

const baseNode = {
  parentId: null,
  rotation: 0,
  opacity: 1,
  stroke: null,
  strokeWidth: 0,
  shadow: 'none',
  fontSize: null,
  fontWeight: null,
  textAlign: 'left',
} satisfies Partial<TemplateNode>

function frame(name: string, x: number, y: number, width: number, height: number, fill: string): TemplateNode {
  return {
    ...baseNode,
    type: 'frame',
    name,
    x,
    y,
    width,
    height,
    fill,
    radius: 24,
    text: null,
  }
}

function rect(
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  radius = 12,
  shadow: DesignNode['shadow'] = 'none'
): TemplateNode {
  return {
    ...baseNode,
    type: 'rectangle',
    name,
    x,
    y,
    width,
    height,
    fill,
    radius,
    shadow,
    text: null,
  }
}

function ellipse(name: string, x: number, y: number, width: number, height: number, fill: string): TemplateNode {
  return {
    ...baseNode,
    type: 'ellipse',
    name,
    x,
    y,
    width,
    height,
    fill,
    radius: 9999,
    text: null,
  }
}

function text(
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  value: string,
  fontSize = 24,
  fontWeight = 600,
  textAlign: DesignNode['textAlign'] = 'left'
): TemplateNode {
  return {
    ...baseNode,
    type: 'text',
    name,
    x,
    y,
    width,
    height,
    fill,
    text: value,
    radius: 0,
    fontSize,
    fontWeight,
    textAlign,
  }
}

function input(name: string, x: number, y: number, width: number, height: number, placeholder: string): TemplateNode {
  return {
    ...baseNode,
    type: 'input',
    name,
    x,
    y,
    width,
    height,
    fill: '#ffffff',
    text: placeholder,
    radius: 12,
    stroke: '#cbd5e1',
    strokeWidth: 1,
    shadow: 'none',
    fontSize: 15,
    fontWeight: 500,
    textAlign: 'left',
  }
}

function button(name: string, x: number, y: number, width: number, height: number, label: string): TemplateNode {
  return {
    ...baseNode,
    type: 'button',
    name,
    x,
    y,
    width,
    height,
    fill: '#7c5cfc',
    text: label,
    radius: 14,
    shadow: 'soft',
    fontSize: 16,
    fontWeight: 700,
    textAlign: 'center',
  }
}

export function createTemplateNodes(templateId: FileTemplateId): TemplateNode[] {
  if (templateId === 'blank') return []

  if (templateId === 'mobile-onboarding') {
    return [
      frame('Screen / Welcome', 80, 80, 390, 844, '#ffffff'),
      rect('Hero gradient', 112, 124, 326, 320, '#ede9fe', 28),
      ellipse('Product orb', 188, 176, 174, 174, '#7c5cfc'),
      ellipse('Accent orb', 302, 284, 82, 82, '#38bdf8'),
      text('Headline', 112, 492, 320, 88, '#111827', 'Design product flows with your team', 34, 700),
      text('Body copy', 112, 600, 300, 54, '#64748b', 'Use this file to test onboarding copy, CTA hierarchy, and mobile spacing.', 16, 500),
      rect('Primary CTA', 112, 704, 326, 56, '#7c5cfc', 16, 'soft'),
      text('Primary CTA label', 190, 721, 170, 22, '#ffffff', 'Start designing', 16, 700, 'center'),
      frame('Screen / Checklist', 530, 80, 390, 844, '#f8fafc'),
      text('Checklist title', 562, 132, 280, 38, '#111827', 'Launch checklist', 28, 700),
      rect('Task row / Copy', 562, 210, 326, 74, '#ffffff', 16, 'soft'),
      rect('Task row / Visuals', 562, 304, 326, 74, '#ffffff', 16, 'soft'),
      rect('Task row / QA', 562, 398, 326, 74, '#ffffff', 16, 'soft'),
      text('Checklist copy', 586, 226, 250, 32, '#111827', 'Review empty states and error copy', 17, 600),
      text('Status label', 586, 492, 230, 24, '#7c5cfc', 'Useful next step: wire backend events', 16, 700),
    ]
  }

  if (templateId === 'saas-dashboard') {
    return [
      frame('Dashboard / Desktop', 80, 80, 1280, 820, '#f8fafc'),
      rect('Sidebar', 80, 80, 248, 820, '#111827', 0),
      text('Product logo', 112, 112, 160, 28, '#ffffff', 'Arc Console', 20, 700),
      rect('Active nav', 104, 190, 184, 40, '#7c5cfc', 10),
      text('Nav label', 124, 201, 120, 18, '#ffffff', 'Overview', 14, 700),
      rect('Top bar', 328, 80, 1032, 72, '#ffffff', 0, 'soft'),
      text('Page title', 360, 102, 220, 28, '#111827', 'Revenue operations', 24, 700),
      rect('Metric / MRR', 360, 188, 220, 126, '#ffffff', 16, 'soft'),
      rect('Metric / Activation', 604, 188, 220, 126, '#ffffff', 16, 'soft'),
      rect('Metric / Churn', 848, 188, 220, 126, '#ffffff', 16, 'soft'),
      rect('Metric / Tickets', 1092, 188, 220, 126, '#ffffff', 16, 'soft'),
      text('MRR value', 386, 230, 120, 32, '#111827', '$84.2k', 30, 700),
      text('Activation value', 630, 230, 120, 32, '#111827', '68%', 30, 700),
      rect('Chart panel', 360, 350, 600, 356, '#ffffff', 18, 'soft'),
      rect('Table panel', 988, 350, 324, 356, '#ffffff', 18, 'soft'),
      rect('Chart line', 396, 540, 520, 8, '#38bdf8', 9999),
      text('Dev note', 396, 382, 430, 24, '#64748b', 'Connect this file to real API metrics and table rows.', 16, 600),
    ]
  }

  if (templateId === 'landing-page') {
    return [
      frame('Landing / Hero', 80, 80, 1440, 820, '#0f172a'),
      rect('Navigation', 80, 80, 1440, 76, 'rgba(255,255,255,0.06)', 0),
      text('Brand', 124, 104, 160, 24, '#ffffff', 'DesignLab', 20, 700),
      text('Nav links', 1050, 106, 250, 20, '#cbd5e1', 'Product   Docs   Pricing', 14, 600),
      text('Hero headline', 164, 246, 720, 132, '#ffffff', 'Prototype complex products before the backend exists', 58, 800),
      text('Hero body', 168, 410, 560, 62, '#cbd5e1', 'A practical canvas for teams to test UI states, API contracts, and collaboration flows.', 20, 500),
      rect('Primary CTA', 168, 520, 180, 56, '#7c5cfc', 16, 'medium'),
      text('CTA label', 205, 538, 112, 20, '#ffffff', 'Open a demo', 16, 700, 'center'),
      rect('Secondary CTA', 368, 520, 190, 56, 'rgba(255,255,255,0.09)', 16),
      text('Secondary label', 402, 538, 122, 20, '#ffffff', 'View roadmap', 16, 700, 'center'),
      rect('Preview panel', 910, 210, 420, 400, '#ffffff', 28, 'strong'),
      rect('Preview nav', 910, 210, 420, 58, '#f1f5f9', 28),
      rect('Preview chart', 950, 330, 340, 170, '#ede9fe', 18),
      rect('Preview row 1', 950, 530, 340, 18, '#e2e8f0', 9999),
      rect('Preview row 2', 950, 566, 240, 18, '#e2e8f0', 9999),
      ellipse('Glow accent', 1220, 166, 180, 180, '#38bdf8'),
      text('Proof stat', 168, 660, 210, 34, '#38bdf8', '5 API domains', 30, 800),
      text('Proof copy', 168, 704, 320, 24, '#94a3b8', 'Files, nodes, comments, replies, realtime.', 16, 600),
    ]
  }

  return [
    frame('Design system / Foundations', 80, 80, 820, 580, '#f8fafc'),
    text('Title', 120, 120, 400, 42, '#111827', 'Component foundations', 34, 800),
    text('Subtitle', 120, 174, 460, 24, '#64748b', 'Use this starter to compare visual states and backend component metadata.', 16, 500),
    rect('Color / Primary', 120, 240, 120, 120, '#7c5cfc', 18, 'soft'),
    rect('Color / Cyan', 260, 240, 120, 120, '#38bdf8', 18, 'soft'),
    rect('Color / Pink', 400, 240, 120, 120, '#f472b6', 18, 'soft'),
    rect('Color / Green', 540, 240, 120, 120, '#22c55e', 18, 'soft'),
    text('Type / Display', 120, 420, 360, 44, '#111827', 'Display heading', 38, 800),
    text('Type / Body', 120, 484, 380, 28, '#475569', 'Body text for product interfaces and documentation.', 18, 500),
    frame('Design system / Components', 960, 80, 640, 580, '#ffffff'),
    text('Components title', 1000, 126, 260, 34, '#111827', 'States', 28, 800),
    button('Button / Primary', 1000, 214, 176, 50, 'Continue'),
    rect('Button / Secondary', 1200, 214, 176, 50, '#f8fafc', 14),
    text('Button secondary label', 1234, 229, 108, 20, '#111827', 'Cancel', 16, 700, 'center'),
    input('Input / Default', 1000, 314, 376, 50, 'Email address'),
    rect('Alert / Info', 1000, 414, 420, 70, '#eff6ff', 16),
    text('Alert copy', 1024, 436, 320, 22, '#1d4ed8', 'Map this to backend validation states.', 16, 700),
  ]
}
