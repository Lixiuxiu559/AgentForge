// README artwork. Run from the repository root on macOS:
// swift -module-cache-path /tmp/agentforge-swift-cache docs/assets/render.swift
import AppKit
import ImageIO
import UniformTypeIdentifiers

let output = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
let width = 1280
let ink = NSColor(calibratedRed: 0.91, green: 0.94, blue: 0.98, alpha: 1)
let muted = NSColor(calibratedRed: 0.57, green: 0.64, blue: 0.73, alpha: 1)
let mint = NSColor(calibratedRed: 0.43, green: 0.94, blue: 0.73, alpha: 1)
let violet = NSColor(calibratedRed: 0.66, green: 0.58, blue: 1, alpha: 1)
let blue = NSColor(calibratedRed: 0.40, green: 0.73, blue: 1, alpha: 1)
let border = NSColor(calibratedRed: 0.17, green: 0.22, blue: 0.29, alpha: 1)
let panel = NSColor(calibratedRed: 0.055, green: 0.078, blue: 0.11, alpha: 1)

func rect(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat,
          _ color: NSColor, radius: CGFloat = 0, stroke: NSColor? = nil) {
    let path = NSBezierPath(roundedRect: NSRect(x: x, y: y, width: w, height: h),
                            xRadius: radius, yRadius: radius)
    color.setFill()
    path.fill()
    if let stroke = stroke {
        stroke.setStroke()
        path.lineWidth = 1
        path.stroke()
    }
}

func line(_ x: CGFloat, _ y: CGFloat, _ toX: CGFloat, _ toY: CGFloat,
          _ color: NSColor, thickness: CGFloat = 1) {
    let path = NSBezierPath()
    path.move(to: NSPoint(x: x, y: y))
    path.line(to: NSPoint(x: toX, y: toY))
    path.lineWidth = thickness
    color.setStroke()
    path.stroke()
}

func label(_ text: String, _ x: CGFloat, _ y: CGFloat, _ size: CGFloat,
           _ color: NSColor = ink, weight: NSFont.Weight = .regular, mono: Bool = false) {
    let font = mono ? NSFont.monospacedSystemFont(ofSize: size, weight: weight)
                    : NSFont.systemFont(ofSize: size, weight: weight)
    (text as NSString).draw(at: NSPoint(x: x, y: y), withAttributes: [
        .font: font, .foregroundColor: color,
    ])
}

func canvas(height: Int, draw: () -> Void) -> CGImage {
    let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height,
                                 bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true,
                                 isPlanar: false, colorSpaceName: .deviceRGB,
                                 bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    let context = NSGraphicsContext(bitmapImageRep: bitmap)!
    NSGraphicsContext.current = context
    context.cgContext.translateBy(x: 0, y: CGFloat(height))
    context.cgContext.scaleBy(x: 1, y: -1)
    // The flipped drawing context keeps text and layout coordinates top to bottom.
    NSGraphicsContext.current = NSGraphicsContext(cgContext: context.cgContext, flipped: true)
    rect(0, 0, CGFloat(width), CGFloat(height),
         NSColor(calibratedRed: 0.027, green: 0.043, blue: 0.067, alpha: 1))
    draw()
    NSGraphicsContext.restoreGraphicsState()
    return bitmap.cgImage!
}

func png(_ image: CGImage, _ name: String) throws {
    let rep = NSBitmapImageRep(cgImage: image)
    try rep.representation(using: .png, properties: [:])!.write(to: output.appendingPathComponent(name))
}

func forgeMark(_ x: CGFloat, _ y: CGFloat, size: CGFloat) {
    let unit = size / 4
    for (col, row) in [(0, 1), (1, 0), (1, 1), (1, 2), (2, 1), (2, 2), (2, 3), (3, 2)] {
        rect(x + CGFloat(col) * unit, y + CGFloat(row) * unit, unit - 2, unit - 2,
             row < 2 ? mint : violet, radius: 2)
    }
}

let hero = canvas(height: 540) {
    // A restrained engineering grid, with an accent rail that joins the two halves.
    for x in stride(from: 0, through: 1280, by: 40) {
        line(CGFloat(x), 0, CGFloat(x), 540, border.withAlphaComponent(0.20))
    }
    for y in stride(from: 0, through: 540, by: 40) {
        line(0, CGFloat(y), 1280, CGFloat(y), border.withAlphaComponent(0.20))
    }
    rect(1, 1, 1278, 538, .clear, radius: 18, stroke: border)
    forgeMark(60, 48, size: 36)
    label("ENGINEERING SKILLS FOR CODING AGENTS", 112, 55, 15, mint, weight: .medium, mono: true)
    label("AgentForge", 58, 122, 76, ink, weight: .bold)
    label("From intent", 62, 226, 42, ink, weight: .medium)
    label("to verified code.", 62, 278, 42, mint, weight: .medium)
    label("Understand the task. Build with a plan.", 64, 360, 21, muted)
    label("Review the change. Show the evidence.", 64, 392, 21, muted)
    line(64, 452, 1216, 452, border)
    label("Codex   /   Claude Code   /   DeepSeek Harness", 64, 480, 19, muted)
    label("13 SKILLS  ·  MIT", 1006, 483, 16, mint, mono: true)

    // A visual of reusable skills, deliberately presented as a diagram rather than a host UI.
    let x: CGFloat = 752
    let cards: [(String, String, String, NSColor)] = [
        ("01", "Understand", "research  /  wiki", blue),
        ("02", "Build", "implementation-workflow", violet),
        ("03", "Verify", "diff-review  /  audits", mint),
    ]
    for (i, card) in cards.enumerated() {
        let y = CGFloat(112 + i * 104)
        if i < 2 { line(x + 24, y + 84, x + 24, y + 104, border, thickness: 2) }
        rect(x, y, 464, 84, panel, radius: 12, stroke: border)
        rect(x, y + 18, 3, 48, card.3, radius: 1)
        label(card.0, x + 24, y + 27, 21, card.3, mono: true)
        label(card.1, x + 78, y + 12, 25, ink, weight: .semibold)
        label(card.2, x + 78, y + 49, 17, muted, mono: true)
    }
}
try png(hero, "hero.png")

let titles = ["Understand", "Build & test", "Review"]
let skills = ["research", "implementation-workflow", "diff-review"]
let details = [
    ["Trace the code paths", "Check constraints", "Collect evidence"],
    ["Break down the work", "Implement the change", "Run relevant checks"],
    ["Correctness", "Repository standards", "Requirements"],
]
let colors = [blue, violet, mint]
let outputs = ["Evidence & constraints", "Code & validation results", "Findings by review axis"]

func workflow(stage: Int, progress: CGFloat, complete: Bool = false) -> CGImage {
    canvas(height: 510) {
        rect(1, 1, 1278, 508, .clear, radius: 18, stroke: border)
        forgeMark(40, 34, size: 28)
        label("ONE TASK. A FEW SKILLS. CLEAR OUTPUTS.", 86, 38, 18, ink, weight: .medium, mono: true)
        label("ILLUSTRATIVE WORKFLOW", 956, 41, 14, muted, mono: true)
        for i in 0..<3 {
            let x = CGFloat(40 + i * 410)
            let active = complete || i == stage
            let accent = active ? colors[i] : border
            rect(x, 108, 380, 280, panel, radius: 14, stroke: accent)
            rect(x + 20, 128, 38, 30, accent.withAlphaComponent(0.12), radius: 6)
            label(String(format: "%02d", i + 1), x + 27, 133, 16, active ? colors[i] : muted, mono: true)
            label(titles[i], x + 20, 178, 31, active ? ink : muted, weight: .semibold)
            label(skills[i], x + 20, 226, 19, active ? colors[i] : muted, mono: true)
            for (j, detail) in details[i].enumerated() {
                rect(x + 22, CGFloat(275 + j * 31), 4, 4, active ? colors[i] : border, radius: 2)
                label(detail, x + 36, CGFloat(265 + j * 31), 20, active ? ink : muted)
            }
            rect(x + 20, 370, 340, 3, border, radius: 1)
            let filled: CGFloat = complete || i < stage ? 1 : (i == stage ? progress : 0)
            if filled > 0 { rect(x + 20, 370, 340 * filled, 3, colors[i], radius: 1) }
            if i < 2 {
                line(x + 386, 245, x + 404, 245, border, thickness: 2)
                line(x + 399, 240, x + 404, 245, border, thickness: 2)
                line(x + 399, 250, x + 404, 245, border, thickness: 2)
            }
        }
        line(40, 420, 1240, 420, border)
        label("OUTPUT", 40, 449, 15, muted, mono: true)
        label(complete ? "Choose the skills your task needs." : outputs[stage], 134, 442, 25,
              complete ? ink : colors[stage], weight: .medium)
        label("AgentForge", 1113, 451, 17, muted, weight: .medium)
    }
}

try png(workflow(stage: 2, progress: 1, complete: true), "workflow.png")
let frameCount = 61
let destination = CGImageDestinationCreateWithURL(output.appendingPathComponent("workflow.gif") as CFURL,
                                                  UTType.gif.identifier as CFString, frameCount, nil)!
CGImageDestinationSetProperties(destination, [kCGImagePropertyGIFDictionary: [
    kCGImagePropertyGIFLoopCount: 0,
]] as CFDictionary)
for frame in 0..<frameCount {
    let complete = frame == frameCount - 1
    let stage = min(frame / 20, 2)
    let progress = CGFloat(frame % 20 + 1) / 20
    let properties = [kCGImagePropertyGIFDictionary: [
        kCGImagePropertyGIFDelayTime: complete ? 2.4 : 0.12,
    ]] as CFDictionary
    autoreleasepool {
        CGImageDestinationAddImage(destination, workflow(stage: stage, progress: progress, complete: complete), properties)
    }
}
guard CGImageDestinationFinalize(destination) else { fatalError("Could not encode workflow.gif") }
print("Rendered hero.png, workflow.png, workflow.gif in \(output.path)")
