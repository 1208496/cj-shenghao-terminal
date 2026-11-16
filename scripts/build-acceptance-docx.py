#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成 rc.22 验收报告 docx（标准库直写 OOXML，不依赖 python-docx）。"""
import os
import zipfile
from xml.sax.saxutils import escape

OUT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(OUT_DIR, "reports", "rc.22-验收报告.docx")

FONT = "Microsoft YaHei"
MONO = "Consolas"


def esc(text):
    return escape(str(text))


def run(text, bold=False, size=21, color=None, mono=False, italic=False):
    font = MONO if mono else FONT
    # CT_RPr order: rFonts -> b -> bCs -> i -> color -> sz -> szCs
    props = ['<w:rFonts w:ascii="%s" w:hAnsi="%s" w:eastAsia="%s" w:cs="%s"/>' % (font, font, FONT, font)]
    if bold:
        props.append("<w:b/><w:bCs/>")
    if italic:
        props.append("<w:i/>")
    if color:
        props.append('<w:color w:val="%s"/>' % color)
    props.append('<w:sz w:val="%d"/><w:szCs w:val="%d"/>' % (size, size))
    return '<w:r><w:rPr>%s</w:rPr><w:t xml:space="preserve">%s</w:t></w:r>' % ("".join(props), esc(text))


def para(content, align=None, before=0, after=60, line=300, ind=0, keep=False):
    # CT_PPr order: keepNext -> spacing -> ind -> jc
    ppr = []
    if keep:
        ppr.append("<w:keepNext/>")
    ppr.append('<w:spacing w:before="%d" w:after="%d" w:line="%d" w:lineRule="auto"/>' % (before, after, line))
    if ind:
        ppr.append('<w:ind w:left="%d"/>' % ind)
    if align:
        ppr.append('<w:jc w:val="%s"/>' % align)
    body = content if isinstance(content, str) else "".join(content)
    return "<w:p><w:pPr>%s</w:pPr>%s</w:p>" % ("".join(ppr), body)


def h1(text, before=280, after=120):
    return para(run(text, bold=True, size=28, color="1F3B2D"), before=before, after=after, keep=True)


def h2(text, before=200, after=90):
    return para(run(text, bold=True, size=23, color="2F5540"), before=before, after=after, keep=True)


def bullet(text, size=21, ind=340):
    return para([run("· ", bold=True, size=size, color="557A64"), run(text, size=size)], ind=ind, after=45)


def note(text, size=19, color="6B5B4A"):
    return para(run(text, size=size, color=color, italic=True), before=40, after=90)


def table(headers, rows, widths, header_fill="E8F1E7", size=19):
    grid = "".join('<w:gridCol w:w="%d"/>' % w for w in widths)
    borders = (
        "<w:tblBorders>"
        '<w:top w:val="single" w:sz="6" w:color="C9DBCC"/>'
        '<w:left w:val="single" w:sz="6" w:color="C9DBCC"/>'
        '<w:bottom w:val="single" w:sz="6" w:color="C9DBCC"/>'
        '<w:right w:val="single" w:sz="6" w:color="C9DBCC"/>'
        '<w:insideH w:val="single" w:sz="4" w:color="DCE7DD"/>'
        '<w:insideV w:val="single" w:sz="4" w:color="DCE7DD"/>'
        "</w:tblBorders>"
    )
    tbl_pr = (
        '<w:tblPr><w:tblW w:w="%d" w:type="dxa"/>%s<w:tblLayout w:type="fixed"/>'
        '<w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="90" w:type="dxa"/>'
        '<w:bottom w:w="60" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar></w:tblPr>'
        % (sum(widths), borders)
    )

    def cell(text, w, header=False):
        fill = '<w:shd w:val="clear" w:color="auto" w:fill="%s"/>' % header_fill if header else ""
        bold = header
        return (
            '<w:tc><w:tcPr><w:tcW w:w="%d" w:type="dxa"/>%s<w:vAlign w:val="center"/></w:tcPr>'
            "<w:p><w:pPr><w:spacing w:before=\"20\" w:after=\"20\" w:line=\"260\" w:lineRule=\"auto\"/></w:pPr>%s</w:p></w:tc>"
            % (w, fill, run(text, bold=bold, size=size))
        )

    head = "<w:tr><w:trPr><w:tblHeader/></w:trPr>%s</w:tr>" % "".join(
        cell(h, widths[i], header=True) for i, h in enumerate(headers)
    )
    body = "".join(
        "<w:tr>%s</w:tr>" % "".join(cell(row[i], widths[i]) for i in range(len(headers))) for row in rows
    )
    return "<w:tbl>%s<w:tblGrid>%s</w:tblGrid>%s%s</w:tbl>%s" % (
        tbl_pr,
        grid,
        head,
        body,
        para("", after=40),
    )


# ------------------------------------------------------------------ 文档内容
body = []
body.append(para(run("《神豪终端》rc.22 升级验收报告", bold=True, size=40, color="1F3B2D"), align="center", after=60))
body.append(para(run("好感 + 堕落双轴 · 双通道提现 · 十倍暴击", size=23, color="557A64"), align="center", after=240))

body.append(
    table(
        ["项目", "内容"],
        [
            ["报告编号", "SHZD-ACC-20261117-RC22"],
            ["被测版本", "2.0.0-rc.22（cardContractRevision 18）"],
            ["基线版本", "2.0.0-rc.21（cardContractRevision 17）"],
            ["被测产物", "dist/2.0.0-rc.22/神豪终端.json（290,255 字节）"],
            ["测试日期", "2026-11-17"],
            ["测试环境", "Windows · Node 24.14 · SillyTavern http://127.0.0.1:8000 · ego lite 0.6.3.14"],
            ["验收结论", "功能验收通过；发现 4 项协议执行缺口（非代码缺陷），建议 rc.23 收紧提示词"],
        ],
        [1900, 7100],
    )
)

body.append(h1("一、被测产物与发布状态"))
body.append(note("以下数值取自构建产物、git 提交与 Supabase 指针回读，未经叙述性推测。"))
body.append(
    table(
        ["检查项", "实测值"],
        [
            ["版本号", "2.0.0-rc.22（project.json / package.json / package-lock.json 三处一致）"],
            ["合同修订号", "18（rc.21 为 17）"],
            ["世界书契约 hash", "a0764a5b0ed7…（rc.21 为 9cbac7f8…）"],
            ["运行时 sha256", "48e90c52eccf…，244,541 字节"],
            ["整卡体积", "290,255 字节"],
            ["源码提交（SHA_A）", "aecb82012025f741be8278e6a4119baf1db04f9c"],
            ["发版提交（SHA_B）", "6af00ecb8d26b371714f8953879575e5e4267c65"],
            ["Supabase 指针", "cj_shenghao_terminal_v2_ref = 6af00ecb8d26b371714f8953879575e5e4267c65"],
            ["紧急停用开关", "cj_shenghao_terminal_v2_off = 空"],
            ["端到端核对", "E2E_OK：testingcf / fastly / cdn 三节点均 244,541 字节，sha256 与元数据一致"],
        ],
        [2400, 6600],
    )
)
body.append(
    note(
        "结论：rc.22 已按 HANDOFF 的七步发版流程发布到 release 分支并切换指针，玩家导入整卡即可加载该版本。"
    )
)

body.append(h1("二、测试方法"))
body.append(h2("2.1 测试脚本"))
body.append(bullet("scripts/live-test-ego.mjs —— 过认证 → 连接 API → 导入整卡 → 打开角色 → 判据取证。"))
body.append(bullet("scripts/live-test-rc22-resume.mjs —— 接管已有空间，走开局向导（含两位初始熟人）并断言手机界面。"))
body.append(bullet("变量层直接读取 Mvu.getMvuData({type:'message'}) 的 stat_data.shenghao，绕开界面只看真实数据。"))
body.append(h2("2.2 已修复的测试脚本缺陷（本轮暴露）"))
body.append(
    table(
        ["缺陷", "现象", "修复"],
        [
            [
                "确认弹窗按钮选择器错误",
                "SillyTavern 的确认按钮是 <div class=\"popup-button-ok\">，脚本按文本找 <button>，三个弹窗（内置世界书/内置正则/嵌入式脚本）一个都没点掉；正则未启用导致开场 iframe 不生成，表现为「脚本没有加载」",
                "改为循环点击 .popup .popup-button-ok 直至无弹窗；iframe 仍缺失时调用 reloadCurrentChat() 重渲染",
            ],
            [
                "导入卡按名字模糊匹配",
                "characterMatch=\"神豪\" 会命中另一张同名旧卡（都市神豪之我爱装逼托马斯版），后续全在测错卡",
                "记录导入前后的卡片标题集合取差集，按 data-chid 打开；支持 reuseChid 复用已导入角色",
            ],
            [
                "开局前误判手机未渲染",
                "开局前 state 为 null，宿主只创建 74×108 折叠位，脚本据此判失败",
                "判据改为「开局后 .phone-screen 有文本」，不再以 iframe 是否存在为准",
            ],
        ],
        [1900, 4300, 2800],
    )
)
body.append(h2("2.3 环境限制"))
body.append(
    note(
        "ego 的 Chromium 无法访问 jsDelivr 与 raw.githubusercontent（全域 Failed to fetch），而本机 Invoke-WebRequest 与用户浏览器均正常。"
        "卡的固定加载器每次打开都要从 jsDelivr 取 dist/terminal.js，因此 ego 内会显示红字「脚本没有下载或启动成功」。"
        "该现象属 ego 环境问题，与卡无关；同一张卡在用户本机浏览器导入正常。"
    )
)

body.append(h1("三、验收结果"))
body.append(h2("3.1 功能项"))
body.append(
    table(
        ["检查项", "结果", "实测证据"],
        [
            ["导入 rc.22 整卡", "通过", "新增卡「神豪终端」，标签「都市, 自由人生, 神豪终端, v2」已导入"],
            ["内置世界书 / 正则 / 嵌入式脚本", "通过", "确认弹窗逐一点掉后开场 iframe srcdoc 达 171,740 字符，开局向导渲染"],
            ["开局熟人表单新字段", "通过", "出现「初始堕落度（0–100）」「罩杯」「她对你的称呼」"],
            ["此刻页双轴", "通过", "「♥ 好感 43/100 · ❖ 堕落 2/100」"],
            ["基础档案新字段", "通过", "「称呼你：陆总」「三围 86／62／89 CM（C 罩杯）」"],
            ["她们页", "通过", "「平面设计师 · 称呼「陆总」 · ♥ 72 · ❖ 40」，提示语「好感满70或堕落满60即可提现」"],
            ["详情页双数值 + 提现文案", "通过", "「♥ 72 好感度 · 恋爱发展」「❖ 40 堕落度 · 半推半就」"],
            ["私密与亲密记录卡", "通过", "「处子状态：未知 / 孕期：未孕 / 与你亲密次数：1 次 / 最近一次：翠湖公寓主卧首次交欢」"],
            ["★ 特别关注", "通过", "点击后按钮变「★ 已关注」，此刻页出现「★ 特别关注 · 异地实况 (1) · 林知夏」"],
            ["堕落度实机写入", "通过", "corruption 0→2→12→22→28→34，facts 出现 CORRUPTION_CHANGE"],
            ["单轮 ±12 限幅", "通过", "单轮增量 +10 / +6 / +6，均未越界"],
        ],
        [2500, 900, 5600],
    )
)
body.append(h2("3.2 经济与数值项"))
body.append(
    table(
        ["检查项", "结果", "实测证据"],
        [
            ["好感 70 解锁提现（方案 B1）", "通过", "苏晚好感 72 →「可提现」，按钮可点击"],
            ["十倍暴击 · 微光档", "通过", "52 分 / 55 分 → +¥5,000"],
            ["十倍暴击 · 心动档", "通过", "65 / 66 / 68 / 72 分 → +¥20,000"],
            ["十倍暴击 · 超凡档", "通过", "92 分 → +¥300,000"],
            ["提现倍率与预计到账", "通过", "奖池 ¥390,000 × 见习十倍 → 预计实到 ¥3,900,000"],
            ["账本与退款公式未受影响", "通过", "消费 ¥0、暴击 ¥390,000，提现记录与消费记录结构不变"],
        ],
        [2500, 900, 5600],
    )
)

body.append(h1("四、问题清单"))
body.append(h2("4.1 代码缺陷：无"))
body.append(para(run("本轮测试未发现 rc.22 的代码级缺陷。字段接收、差额结算、限幅、投影与界面渲染链路均已验证。", size=21)))
body.append(h2("4.2 协议执行缺口（提示词强度问题，建议 rc.23 处理）"))
body.append(
    table(
        ["字段", "实机表现", "判断依据"],
        [
            ["physiology.virgin", "剧情已发生首次交欢，仍为 null，界面显示「处子状态：未知」", "字段可写可渲染（同轮 withUserCount 正常落盘）"],
            ["intimacy.unlockedTags", "仍为空数组，界面显示「还没有已解锁的亲密体验」", "数组 preprocess 容错已单测覆盖，问题在模型未提交"],
            ["physiology.cycle / traits", "生理周期与敏感带摘要全空", "协议仅写「按事实更新」，未设为强制"],
            ["offscreen", "林知夏已打星且离场、对话中被点名提及，字段仍为空", "模型在 currentThought 里提到了她，但没写 offscreen"],
        ],
        [2000, 3900, 3100],
    )
)
body.append(
    note(
        "建议修改（仅动 protocol.txt 措辞，不动代码逻辑）：把上述四处从「按事实增量更新」改为硬条件，例如"
        "「本轮发生亲密行为时必须同时写 unlockedTags、withUserCount、lastIntimate」「打星且不在场的人物每轮必须写一句 offscreen」。"
    )
)

body.append(h1("五、未验证与风险"))
body.append(bullet("corruption ≥ 60 而 affection < 70 的实机提现路径：当前苏晚好感已达 72，无法区分是哪条通道解锁，仅有单测覆盖。"))
body.append(bullet("真实亲密剧情下 unlockedTags 的标签语义质量：模型当前不写该字段，无从评估。"))
body.append(bullet("ego 环境 jsDelivr 不可达的成因（代理 / DNS / 拦截规则）仍未确认，影响的是测试环境而非卡本身。"))
body.append(bullet("多轮长对话下的奖池累积上限、退款追回与提现并发：本轮未做压力验证。"))

body.append(h1("六、结论与建议"))
body.append(
    para(
        [
            run("结论：", bold=True),
            run(
                "rc.22 的核心目标（双轴数值、双通道提现、涩涩高分阶梯、十倍暴击）在真实 SillyTavern 中全部生效，"
                "经济账本与退款公式未受影响，界面渲染与变量数据一致，可以交付测试。"
            ),
        ]
    )
)
body.append(
    para(
        [
            run("建议：", bold=True),
            run(
                "① 出 rc.23，仅收紧 protocol.txt 中 physiology / intimacy / offscreen 四处强制要求；"
                "② 补一条实机用例覆盖「堕落 60 且好感不足 70」的提现通道；"
                "③ 在脚本中固化本轮修复的选择器与导入识别逻辑，避免回归。"
            ),
        ]
    )
)

body.append(h1("附录 A · 复现命令"))
for line in [
    "npm test                                     # 266 / 266 通过",
    "node scripts/build.mjs --checkpoint           # BUILD_OK dist/2.0.0-rc.22-checkpoint",
    "node scripts/check.mjs --checkpoint           # CHECK_OK",
    "ego-browser nodejs -e \"await import('file:///E:/SHZDCHOSSS/scripts/live-test-ego.mjs')\"",
    "ego-browser nodejs -e \"await import('file:///E:/SHZDCHOSSS/scripts/live-test-rc22-resume.mjs')\"",
]:
    body.append(para(run(line, mono=True, size=18), ind=240, after=40))

body.append(h1("附录 B · 证据文件"))
body.append(
    table(
        ["类型", "路径"],
        [
            ["实机截图", "C:/Users/Administrator/ego/live-test/2026-11-16T20-14-43-rc22-turn/scene-after-turn.png"],
            ["实机截图", "C:/Users/Administrator/ego/live-test/2026-11-16T20-19-24-rc22-verify/detail-withdraw.png"],
            ["测试记录", "E:/SHZDCHOSSS/tests/live-ego.md"],
            ["交接文档", "E:/SHZDCHOSSS/HANDOFF.md"],
            ["交付整卡", "E:/SHZDCHOSSS/dist/2.0.0-rc.22/神豪终端.json"],
        ],
        [1500, 7500],
    )
)
body.append(
    para(run("报告生成：DSH 执行 / 2026-11-17 / 所有数值均可由附录 A 的命令与附录 B 的产物复查", size=18, color="7A8A7C"), before=240)
)

section = (
    "<w:sectPr>"
    '<w:pgSz w:w="11906" w:h="16838"/>'
    '<w:pgMar w:top="1300" w:right="1400" w:bottom="1300" w:left="1400" w:header="720" w:footer="720" w:gutter="0"/>'
    "</w:sectPr>"
)

document_xml = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    "<w:body>%s%s</w:body></w:document>" % ("".join(body), section)
)

styles_xml = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    "<w:docDefaults><w:rPrDefault><w:rPr>"
    '<w:rFonts w:ascii="%s" w:hAnsi="%s" w:eastAsia="%s" w:cs="%s"/>'
    '<w:sz w:val="21"/><w:szCs w:val="21"/>'
    "</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr>"
    '<w:spacing w:after="60" w:line="300" w:lineRule="auto"/>'
    "</w:pPr></w:pPrDefault></w:docDefaults>"
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/>'
    '<w:pPr><w:spacing w:after="60" w:line="300" w:lineRule="auto"/></w:pPr></w:style>'
    "</w:styles>" % (FONT, FONT, FONT, FONT)
)

content_types = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    '<Default Extension="xml" ContentType="application/xml"/>'
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
    "</Types>"
)

rels = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
    "</Relationships>"
)

doc_rels = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    "</Relationships>"
)

core_xml = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
    'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" '
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
    "<dc:title>《神豪终端》rc.22 升级验收报告</dc:title>"
    "<dc:creator>DSH</dc:creator>"
    "<cp:lastModifiedBy>DSH</cp:lastModifiedBy>"
    '<dcterms:created xsi:type="dcterms:W3CDTF">2026-11-17T04:30:00Z</dcterms:created>'
    '<dcterms:modified xsi:type="dcterms:W3CDTF">2026-11-17T04:30:00Z</dcterms:modified>'
    "</cp:coreProperties>"
)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("[Content_Types].xml", content_types)
    z.writestr("_rels/.rels", rels)
    z.writestr("word/document.xml", document_xml)
    z.writestr("word/styles.xml", styles_xml)
    z.writestr("word/_rels/document.xml.rels", doc_rels)
    z.writestr("docProps/core.xml", core_xml)

print("WROTE", OUT, os.path.getsize(OUT), "bytes")
