from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    Flowable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "outputs"
OUTPUT_DIR.mkdir(exist_ok=True)
PDF_PATH = OUTPUT_DIR / "proyecto-plataforma-cobranza.pdf"


PRIMARY = colors.HexColor("#0B5CAB")
ACCENT = colors.HexColor("#15947F")
DARK = colors.HexColor("#172033")
MUTED = colors.HexColor("#667085")
LIGHT = colors.HexColor("#F2F6F9")
BORDER = colors.HexColor("#D9E0EA")
WARNING = colors.HexColor("#A66900")


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="CoverTitle", fontName="Helvetica-Bold", fontSize=30, leading=34, textColor=colors.white))
styles.add(ParagraphStyle(name="CoverSub", fontName="Helvetica", fontSize=13, leading=18, textColor=colors.white))
styles.add(ParagraphStyle(name="H1x", fontName="Helvetica-Bold", fontSize=20, leading=25, textColor=DARK, spaceAfter=10))
styles.add(ParagraphStyle(name="H2x", fontName="Helvetica-Bold", fontSize=13, leading=17, textColor=DARK, spaceBefore=8, spaceAfter=5))
styles.add(ParagraphStyle(name="Bodyx", fontName="Helvetica", fontSize=9.7, leading=14, textColor=DARK))
styles.add(ParagraphStyle(name="Smallx", fontName="Helvetica", fontSize=8.5, leading=12, textColor=MUTED))
styles.add(ParagraphStyle(name="Bulx", fontName="Helvetica", fontSize=9.4, leading=13, textColor=DARK, leftIndent=12, bulletIndent=0))
styles.add(ParagraphStyle(name="CardTitle", fontName="Helvetica-Bold", fontSize=10, leading=13, textColor=DARK))
styles.add(ParagraphStyle(name="CardText", fontName="Helvetica", fontSize=8.4, leading=11.5, textColor=DARK))


class CoverBand(Flowable):
    def __init__(self, width, height):
        super().__init__()
        self.width = width
        self.height = height

    def draw(self):
        c = self.canv
        c.setFillColor(PRIMARY)
        c.rect(0, 0, self.width, self.height, fill=1, stroke=0)
        c.setFillColor(ACCENT)
        c.rect(self.width * 0.72, 0, self.width * 0.28, self.height, fill=1, stroke=0)
        c.setStrokeColor(colors.white)
        c.setLineWidth(1)
        for i in range(5):
            x = self.width * 0.72 + i * 22
            c.line(x, 0, x + 90, self.height)


class FlowDiagram(Flowable):
    def __init__(self, width=17 * cm, height=5.7 * cm):
        super().__init__()
        self.width = width
        self.height = height

    def draw(self):
        c = self.canv
        steps = [
            ("Base", "Afiliados\ny planes"),
            ("Mensual", "Seleccion\ny tickets"),
            ("Cobrador", "Cobros,\nrecibos y\nnovedades"),
            ("Control", "Totales\npor plan"),
            ("Rendicion", "Comision\ny cierre"),
        ]
        box_w = self.width / 5 - 10
        y = 45
        for i, (title, text) in enumerate(steps):
            x = i * (box_w + 10)
            c.setFillColor(LIGHT)
            c.setStrokeColor(BORDER)
            c.roundRect(x, y, box_w, 72, 6, fill=1, stroke=1)
            c.setFillColor(PRIMARY if i in (0, 1) else ACCENT if i == 2 else WARNING)
            c.roundRect(x, y + 50, box_w, 22, 6, fill=1, stroke=0)
            c.setFillColor(colors.white)
            c.setFont("Helvetica-Bold", 8.5)
            c.drawCentredString(x + box_w / 2, y + 57, title)
            c.setFillColor(DARK)
            c.setFont("Helvetica", 8)
            for j, line in enumerate(text.split("\n")):
                c.drawCentredString(x + box_w / 2, y + 34 - j * 10, line)
            if i < len(steps) - 1:
                c.setStrokeColor(PRIMARY)
                c.setLineWidth(1.2)
                c.line(x + box_w + 2, y + 36, x + box_w + 8, y + 36)
                c.line(x + box_w + 8, y + 36, x + box_w + 4, y + 40)
                c.line(x + box_w + 8, y + 36, x + box_w + 4, y + 32)


class BarsGraphic(Flowable):
    def __init__(self, width=17 * cm, height=5.2 * cm):
        super().__init__()
        self.width = width
        self.height = height

    def draw(self):
        c = self.canv
        labels = ["Planillas", "Errores", "Control", "Rendicion", "Movil"]
        values = [35, 45, 85, 90, 95]
        x0 = 20
        y0 = 24
        bar_w = 52
        gap = 33
        c.setStrokeColor(BORDER)
        c.line(x0, y0, self.width - 20, y0)
        for i, (label, value) in enumerate(zip(labels, values)):
            x = x0 + i * (bar_w + gap)
            h = value
            c.setFillColor(PRIMARY if i < 2 else ACCENT)
            c.rect(x, y0, bar_w, h, fill=1, stroke=0)
            c.setFillColor(DARK)
            c.setFont("Helvetica-Bold", 8)
            c.drawCentredString(x + bar_w / 2, y0 + h + 8, f"{value}%")
            c.setFont("Helvetica", 7.5)
            c.drawCentredString(x + bar_w / 2, 8, label)


def p(text, style="Bodyx"):
    return Paragraph(text, styles[style])


def bullet(text):
    return Paragraph(text, styles["Bulx"], bulletText="•")


def section_title(text):
    return Paragraph(text, styles["H1x"])


def card_table(items, cols=2):
    rows = []
    for i in range(0, len(items), cols):
        row = []
        for title, body in items[i : i + cols]:
            row.append([
                Paragraph(title, styles["CardTitle"]),
                Spacer(1, 3),
                Paragraph(body, styles["CardText"]),
            ])
        while len(row) < cols:
            row.append("")
        rows.append(row)
    table = Table(rows, colWidths=[8.1 * cm] * cols, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.6, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    return table


def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(doc.leftMargin, 1.1 * cm, "Proyecto Plataforma de Gestion y Cobranza")
    canvas.drawRightString(A4[0] - doc.rightMargin, 1.1 * cm, f"Pagina {doc.page}")
    canvas.restoreState()


def build_pdf():
    doc = SimpleDocTemplate(
        str(PDF_PATH),
        pagesize=A4,
        rightMargin=1.6 * cm,
        leftMargin=1.6 * cm,
        topMargin=1.6 * cm,
        bottomMargin=1.8 * cm,
    )
    story = []

    cover = CoverBand(17.8 * cm, 7.2 * cm)
    story.append(cover)
    story.append(Spacer(1, -6.5 * cm))
    story.append(Paragraph("Plataforma de Gestion y Cobranza para Afiliados", styles["CoverTitle"]))
    story.append(Spacer(1, 8))
    story.append(Paragraph("App administrativa y movil para organizar clientes, tickets, recibos, cobradores, novedades, totales y rendicion final.", styles["CoverSub"]))
    story.append(Spacer(1, 4.8 * cm))
    story.append(p("Propuesta de proyecto", "H1x"))
    story.append(p("Una solucion pensada para reemplazar planillas manuales y ordenar el circuito completo de cobranza mensual.", "Bodyx"))
    story.append(Spacer(1, 16))
    story.append(card_table([
        ("Administracion", "Prepara la cobranza mensual, gestiona afiliados, asigna cobradores y controla totales."),
        ("Cobradores", "Trabajan desde el celular, buscan por poliza, registran cobros, recibos y novedades."),
    ]))
    story.append(PageBreak())

    story.append(section_title("1. Vision General"))
    story.append(p("La plataforma centraliza el circuito de cobranza mensual de seguros, mutuales o servicios por afiliados. Combina una base administrativa con una app movil para cobradores, permitiendo que cada pago, recibo, novedad y rendicion quede registrado.", "Bodyx"))
    story.append(Spacer(1, 10))
    story.append(FlowDiagram())
    story.append(Spacer(1, 14))
    story.append(card_table([
        ("Base unica", "Listado general de afiliados con poliza, plan, valor, telefono, direccion, dependencia o cobrador."),
        ("Cobranza mensual", "Seleccion de afiliados, carga de tickets, aumento porcentual y base para el mes siguiente."),
        ("App movil", "Busqueda por poliza, registro de tickets cobrados, recibos y novedades libres."),
        ("Control final", "Totales por plan, efectivo, transferencia, comision del 12% y rendicion final."),
    ]))
    story.append(PageBreak())

    story.append(section_title("2. Modulos Del Sistema"))
    modules = [
        ("Base de clientes / afiliados", "Alta, edicion, seleccion individual o masiva, dependencia/cobrador asignado y planes validos: A 238, A 269, G 238, 09, G 269, C y Vida."),
        ("Planilla mensual", "Generada desde los seleccionados. Permite agregar/quitar afiliados, cargar tickets y aplicar aumentos porcentuales."),
        ("Cobranza por tickets", "El cobrador busca por numero de poliza, ve tickets disponibles, monto por ticket y registra cantidad cobrada."),
        ("Recibos", "Cobros sin tickets con numero de recibo, nombre, poliza, plan, mes cobrado, monto y modo E/T."),
        ("Novedades libres", "Observaciones del cobrador sin categorias obligatorias: domicilio incorrecto, cambio de telefono, no encontrado, etc."),
        ("Totales y rendicion", "Control por plan, medio de pago, importes, tickets no cobrados, comision del 12% y total a rendir."),
    ]
    story.append(card_table(modules))
    story.append(Spacer(1, 14))
    data = [
        ["Modulo", "Resultado esperado"],
        ["Base", "Datos ordenados y actualizados"],
        ["Mensual", "Tickets y valores del periodo"],
        ["Cobrador", "Cobros y novedades en tiempo real"],
        ["Totales", "Control por plan y medio de pago"],
        ["Rendicion", "Cierre con comision y diferencia"],
    ]
    table = Table(data, colWidths=[5 * cm, 11.2 * cm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("BACKGROUND", (0, 1), (-1, -1), colors.white),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
        ("PADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(table)
    story.append(PageBreak())

    story.append(section_title("3. Flujo Del Cobrador"))
    story.append(p("La experiencia movil esta orientada a la carga rapida en calle. El cobrador solo ve los tickets o afiliados asignados a su dependencia/cobrador.", "Bodyx"))
    story.append(Spacer(1, 8))
    for text in [
        "Busca al asegurado por numero de poliza.",
        "Visualiza nombre, plan, tickets disponibles, monto por ticket y total posible.",
        "Carga cantidad de tickets cobrados y selecciona E efectivo o T transferencia.",
        "Si selecciona T, registra numero de comprobante.",
        "Puede cargar recibos con numero de recibo y novedades libres aunque no exista cobro.",
    ]:
        story.append(bullet(text))
    story.append(Spacer(1, 16))
    story.append(BarsGraphic())
    story.append(Spacer(1, 12))
    story.append(card_table([
        ("Cobro por ticket", "Descuenta tickets disponibles y separa efectivo de transferencia."),
        ("Cobro por recibo", "Permite registrar pagos sin tickets, identificados por numero de recibo y plan."),
        ("Novedades", "Texto libre para actualizar informacion del afiliado y mejorar la gestion administrativa."),
        ("Asignacion", "Cada cobrador visualiza lo correspondiente por dependencia o cobrador asignado."),
    ]))
    story.append(PageBreak())

    story.append(section_title("4. Control, Totales Y Rendicion"))
    story.append(p("El sistema calcula automaticamente los totales mensuales por plan, separando cantidades e importes por efectivo y transferencia.", "Bodyx"))
    story.append(Spacer(1, 10))
    totals = [
        ["Concepto", "Calculo"],
        ["Tickets recibidos", "Cantidad asignada en la planilla mensual"],
        ["Tickets cobrados E/T", "Cantidad e importe por medio de pago"],
        ["Tickets no cobrados", "Tickets recibidos menos tickets cobrados"],
        ["Recibos E/T", "Conteo por numero de recibo + plan e importe"],
        ["Comision", "12% del total cobrado"],
        ["Total a rendir", "Total cobrado menos comision"],
    ]
    totals_table = Table(totals, colWidths=[5.5 * cm, 10.7 * cm])
    totals_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
        ("PADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(totals_table)
    story.append(Spacer(1, 14))
    story.append(p("La rendicion se realiza una sola vez al finalizar el periodo. Permite cargar monto rendido en efectivo y transferencias rendidas con fecha, monto y comprobante.", "Bodyx"))
    story.append(PageBreak())

    story.append(section_title("5. Beneficios Y Potencial Comercial"))
    for text in [
        "Reemplaza planillas dispersas por una base unica y trazable.",
        "Reduce errores de carga, duplicaciones y perdida de informacion.",
        "Ordena el trabajo de cobradores desde una app movil simple.",
        "Permite controlar efectivo, transferencias, recibos y tickets no cobrados.",
        "Registra novedades reales desde el territorio.",
        "Escala a distintas organizaciones con afiliados, cuotas o cobranzas periodicas.",
    ]:
        story.append(bullet(text))
    story.append(Spacer(1, 16))
    story.append(card_table([
        ("Propuesta de valor", "Una herramienta integral para administrar cobranzas periodicas con control mensual y rendicion automatica."),
        ("Cliente objetivo", "Seguros, mutuales, servicios por afiliados, cobranzas domiciliarias y organizaciones con cobradores externos."),
        ("Modelo escalable", "Puede crecer por cantidad de afiliados, cobradores, dependencias o planes activos."),
        ("Diferencial", "Integra administracion, cobrador movil, novedades, totales y rendicion en un mismo flujo."),
    ]))
    story.append(Spacer(1, 18))
    story.append(p("<b>En una frase:</b> una plataforma movil y administrativa para organizar la cobranza mensual de afiliados, controlar tickets y recibos, registrar pagos y novedades, y cerrar la rendicion con totales automaticos por plan, medio de pago, cobrador y periodo.", "Bodyx"))

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)


if __name__ == "__main__":
    build_pdf()
    print(PDF_PATH)
