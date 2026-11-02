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

// Both languages use the same layout and animation timing. Keep skill identifiers unchanged.
func render(locale: String) throws {
    let isChinese = locale == "zh-CN"
    func copy(_ zh: String, _ en: String) -> String { isChinese ? zh : en }
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
        label(copy("面向 Coding Agent 的工程技能", "ENGINEERING SKILLS FOR CODING AGENTS"), 112, 55, isChinese ? 19 : 15, mint, weight: .medium, mono: !isChinese)
        label("AgentForge", 58, 122, 76, ink, weight: .bold)
        label(copy("读懂项目，", "From intent"), 62, 226, 42, ink, weight: .medium)
        label(copy("交付可靠代码。", "to verified code."), 62, 278, 42, mint, weight: .medium)
        label(copy("用项目 Wiki 沉淀知识，读懂代码。", "Build a project Wiki. Understand the code."), 64, 360, 21, muted)
        label(copy("有章法地实施，用证据验证结果。", "Plan the change. Verify the result."), 64, 392, 21, muted)
        line(64, 452, 1216, 452, border)
        label("Codex   /   Claude Code   /   DeepSeek Harness", 64, 480, 19, muted)
        label(copy("13 个技能 · MIT", "13 SKILLS  ·  MIT"), 1006, 483, 16, mint, mono: true)

        // A visual of reusable skills, deliberately presented as a diagram rather than a host UI.
        let x: CGFloat = 752
        let cards: [(String, String, String, NSColor)] = [
            ("01", copy("项目 Wiki", "Project Wiki"), copy("wiki  /  可追溯的项目知识", "wiki  /  source-linked knowledge"), mint),
            ("02", copy("代码调查", "Investigate"), copy("research  /  调查与取证", "research  /  evidence"), blue),
            ("03", copy("功能实现", "Build"), "implementation-workflow", violet),
            ("04", copy("验证评审", "Verify"), copy("diff-review  /  质量审计", "diff-review  /  audits"), mint),
        ]
        for (i, card) in cards.enumerated() {
            let y = CGFloat(96 + i * 86)
            rect(x, y, 464, 74, panel, radius: 12, stroke: border)
            rect(x, y + 16, 3, 42, card.3, radius: 1)
            label(card.0, x + 24, y + 23, 21, card.3, mono: true)
            label(card.1, x + 78, y + 8, 25, ink, weight: .semibold)
            label(card.2, x + 78, y + 44, 16, muted, mono: true)
        }
    }
    try png(hero, "hero.\(locale).png")

    let titles = isChinese ? ["项目 Wiki", "代码调查", "实现与测试", "代码评审"]
                           : ["Project Wiki", "Investigate", "Build & test", "Review"]
    let skillLabels = [["wiki"], ["research"], ["implementation-", "workflow"], ["diff-review"]]
    let details = isChinese ? [
        ["梳理系统架构", "关联源码证据", "维护项目知识"],
        ["追踪代码路径", "核对约束条件", "收集调查证据"],
        ["拆分开发任务", "实现代码改动", "运行适用检查"],
        ["代码正确性", "仓库编码规范", "需求实现情况"],
    ] : [
        ["Map architecture", "Link source evidence", "Maintain project docs"],
        ["Trace code paths", "Check constraints", "Collect evidence"],
        ["Break down the work", "Implement changes", "Run relevant checks"],
        ["Correctness", "Repository standards", "Requirements"],
    ]
    let colors = [mint, blue, violet, mint]
    let outputs = isChinese ? ["可追溯、可维护的项目 Wiki", "调查证据与约束条件",
                               "代码改动与验证结果", "按评审维度列出的问题"]
                            : ["Source-linked, maintainable project Wiki", "Evidence & constraints",
                               "Code & validation results", "Findings by review axis"]

    func workflow(stage: Int, progress: CGFloat, complete: Bool = false) -> CGImage {
        canvas(height: 590) {
            rect(1, 1, 1278, 588, .clear, radius: 18, stroke: border)
            forgeMark(40, 34, size: 28)
            label(copy("项目知识 · 代码实现 · 验证证据", "PROJECT KNOWLEDGE. CODE. EVIDENCE."), 86, 38, 18, ink, weight: .medium, mono: true)
            label(copy("能力组合示意", "ILLUSTRATIVE WORKFLOW"), 956, 41, 14, muted, mono: true)
            for i in titles.indices {
                let x = CGFloat(40 + i * 306)
                let active = complete || i == stage
                let accent = active ? colors[i] : border
                rect(x, 108, 282, 340, panel, radius: 14, stroke: accent)
                rect(x + 20, 128, 38, 30, accent.withAlphaComponent(0.12), radius: 6)
                label(String(format: "%02d", i + 1), x + 27, 133, 16, active ? colors[i] : muted, mono: true)
                label(titles[i], x + 20, 178, 28, active ? ink : muted, weight: .semibold)
                for (j, skill) in skillLabels[i].enumerated() {
                    label(skill, x + 20, CGFloat(226 + j * 26), 19, active ? colors[i] : muted, mono: true)
                }
                for (j, detail) in details[i].enumerated() {
                    rect(x + 22, CGFloat(325 + j * 31), 4, 4, active ? colors[i] : border, radius: 2)
                    label(detail, x + 36, CGFloat(315 + j * 31), 18, active ? ink : muted)
                }
                rect(x + 20, 430, 242, 3, border, radius: 1)
                let filled: CGFloat = complete || i < stage ? 1 : (i == stage ? progress : 0)
                if filled > 0 { rect(x + 20, 430, 242 * filled, 3, colors[i], radius: 1) }
                if i < titles.count - 1 { label("+", x + 288, 260, 22, muted) }
            }
            line(40, 480, 1240, 480, border)
            label(copy("交付产物", "OUTPUT"), 40, 519, 15, muted, mono: true)
            label(complete ? copy("按任务选择需要的技能。", "Choose the skills your task needs.") : outputs[stage], 134, 512, 25,
                  complete ? ink : colors[stage], weight: .medium)
            label("AgentForge", 1113, 521, 17, muted, weight: .medium)
        }
    }

    try png(workflow(stage: titles.count - 1, progress: 1, complete: true), "workflow.\(locale).png")
    let frameCount = titles.count * 20 + 1
    let destination = CGImageDestinationCreateWithURL(output.appendingPathComponent("workflow.\(locale).gif") as CFURL,
                                                      UTType.gif.identifier as CFString, frameCount, nil)!
    CGImageDestinationSetProperties(destination, [kCGImagePropertyGIFDictionary: [
        kCGImagePropertyGIFLoopCount: 0,
    ]] as CFDictionary)
    for frame in 0..<frameCount {
        let complete = frame == frameCount - 1
        let stage = min(frame / 20, titles.count - 1)
        let progress = CGFloat(frame % 20 + 1) / 20
        let properties = [kCGImagePropertyGIFDictionary: [
            kCGImagePropertyGIFDelayTime: complete ? 2.4 : 0.12,
        ]] as CFDictionary
        autoreleasepool {
            CGImageDestinationAddImage(destination, workflow(stage: stage, progress: progress, complete: complete), properties)
        }
    }
    guard CGImageDestinationFinalize(destination) else { fatalError("Could not encode workflow.\(locale).gif") }
    print("Rendered \(locale) artwork in \(output.path)")
}

for locale in ["zh-CN", "en"] {
    try render(locale: locale)
}
