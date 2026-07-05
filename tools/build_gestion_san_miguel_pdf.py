from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.pdfgen import canvas
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Polygon
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "output" / "pdf"
OUT_DIR.mkdir(parents=True, exist_ok=True)
PDF_PATH = OUT_DIR / "proyecto-gestion-san-miguel.pdf"

PAGE_W, PAGE_H = A4
MARGIN_X = 1.55 * cm
MARGIN_TOP = 1.55 * cm
MARGIN_BOTTOM = 1.35 * cm

GOLD = colors.HexColor("#F2B705")
NAVY = colors.HexColor("#17324D")
TEAL = colors.HexColor("#0F8B8D")
SOFT_BG = colors.HexColor("#F5F7FA")
MID = colors.HexColor("#5B6B7A")
LINE = colors.HexColor("#D8E0E8")
RED = colors.HexColor("#C33A32")


def draw_logo(c: canvas.Canvas, x, y, scale=1.0):
    c.saveState()
    c.setFillColor(GOLD)
    c.translate(x, y)
    c.scale(scale, scale)
    c.bezier(0, 0, 34, 9, 37, 51, 28, 70)
    c.bezier(50, 45, 51, 16, 26, -3, 0, 0)
    c.bezier(35, -6, 67, 18, 61, 64)
    c.bezier(80, 41, 84, 12, 60, -2, 35, -6)
    c.bezier(12, -3, -10, 11, -26, 30)
    c.bezier(-10, 22, 3, 14, 0, 0)
    c.restoreState()


class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        page_count = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(page_count)
            super().showPage()
        super().save()

    def draw_page_number(self, page_count):
        if self._pageNumber == 1:
            return
        self.setFont("Helvetica", 8)
        self.setFillColor(MID)
        self.drawRightString(PAGE_W - MARGIN_X, 0.75 * cm, f"Pagina {self._pageNumber} de {page_count}")
        self.setStrokeColor(LINE)
        self.line(MARGIN_X, 1.05 * cm, PAGE_W - MARGIN_X, 1.05 * cm)


def later_pages(c, doc):
    c.saveState()
    draw_logo(c, MARGIN_X + 0.15 * cm, PAGE_H - 1.15 * cm, 0.23)
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(NAVY)
    c.drawString(MARGIN_X + 1.0 * cm, PAGE_H - 0.86 * cm, "GESTION SAN MIGUEL")
    c.setFont("Helvetica", 8)
    c.setFillColor(MID)
    c.drawRightString(PAGE_W - MARGIN_X, PAGE_H - 0.86 * cm, "Proyecto de sistema de gestion integral")
    c.setStrokeColor(LINE)
    c.line(MARGIN_X, PAGE_H - 1.22 * cm, PAGE_W - MARGIN_X, PAGE_H - 1.22 * cm)
    c.restoreState()


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="CoverTitle",
    fontName="Helvetica-Bold",
    fontSize=26,
    leading=31,
    textColor=NAVY,
    alignment=TA_CENTER,
    spaceAfter=8,
))
styles.add(ParagraphStyle(
    name="CoverSubtitle",
    fontName="Helvetica",
    fontSize=13,
    leading=18,
    textColor=MID,
    alignment=TA_CENTER,
    spaceAfter=20,
))
styles.add(ParagraphStyle(
    name="H1x",
    fontName="Helvetica-Bold",
    fontSize=16,
    leading=20,
    textColor=NAVY,
    spaceBefore=6,
    spaceAfter=8,
))
styles.add(ParagraphStyle(
    name="H2x",
    fontName="Helvetica-Bold",
    fontSize=11.5,
    leading=15,
    textColor=NAVY,
    spaceBefore=8,
    spaceAfter=4,
))
styles.add(ParagraphStyle(
    name="TableHeader",
    fontName="Helvetica-Bold",
    fontSize=9.2,
    leading=11,
    textColor=colors.white,
    alignment=TA_LEFT,
))
styles.add(ParagraphStyle(
    name="Bodyx",
    fontName="Helvetica",
    fontSize=9.3,
    leading=13.2,
    textColor=colors.HexColor("#17212B"),
    spaceAfter=6,
))
styles.add(ParagraphStyle(
    name="Smallx",
    fontName="Helvetica",
    fontSize=8.2,
    leading=11,
    textColor=MID,
))
styles.add(ParagraphStyle(
    name="Bulletx",
    parent=styles["Bodyx"],
    leftIndent=12,
    firstLineIndent=-7,
    bulletIndent=0,
    spaceAfter=4,
))
styles.add(ParagraphStyle(
    name="CardTitle",
    fontName="Helvetica-Bold",
    fontSize=10,
    leading=12,
    textColor=NAVY,
    alignment=TA_CENTER,
))
styles.add(ParagraphStyle(
    name="CardBody",
    fontName="Helvetica",
    fontSize=8,
    leading=10,
    textColor=colors.HexColor("#253544"),
    alignment=TA_CENTER,
))


def p(text, style="Bodyx"):
    return Paragraph(text, styles[style])


def bullet(text):
    return Paragraph(f"- {text}", styles["Bulletx"])


def table(data, widths, header=True):
    t = Table(data, colWidths=widths, hAlign="LEFT", repeatRows=1 if header else 0)
    commands = [
        ("BOX", (0, 0), (-1, -1), 0.5, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]
    if header:
        commands += [
            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ]
    t.setStyle(TableStyle(commands))
    return t


def module_cards(items):
    rows = []
    row = []
    for title, body, color in items:
        cell = [
            Paragraph(title, styles["CardTitle"]),
            Spacer(1, 4),
            Paragraph(body, styles["CardBody"]),
        ]
        row.append(cell)
        if len(row) == 3:
            rows.append(row)
            row = []
    if row:
        while len(row) < 3:
            row.append("")
        rows.append(row)
    t = Table(rows, colWidths=[5.75 * cm, 5.75 * cm, 5.75 * cm], hAlign="LEFT")
    style = [
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOX", (0, 0), (-1, -1), 0.5, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.white),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]
    for r in range(len(rows)):
        for c in range(3):
            if rows[r][c] != "":
                style.append(("BACKGROUND", (c, r), (c, r), color if (color := items[min(r * 3 + c, len(items) - 1)][2]) else SOFT_BG))
    t.setStyle(TableStyle(style))
    return t


def flow_diagram():
    d = Drawing(520, 155)
    boxes = [
        (16, 91, 105, 44, "REMITOS", "Particular, convenio o pre necesidad", TEAL),
        (154, 91, 115, 44, "DOCUMENTACION", "Control de recibidos y faltantes", NAVY),
        (305, 91, 105, 44, "FACTURACION", "Numero, fecha y usuario", GOLD),
        (154, 24, 115, 44, "COBRANZAS", "Pagos, saldos y medios", colors.HexColor("#7C5CC4")),
        (305, 24, 105, 44, "CAJA", "Ingresos, egresos y turnos", RED),
    ]
    for x, y, w, h, title, sub, color in boxes:
        d.add(Rect(x, y, w, h, rx=6, ry=6, fillColor=colors.white, strokeColor=color, strokeWidth=1.4))
        d.add(String(x + w / 2, y + 27, title, textAnchor="middle", fontName="Helvetica-Bold", fontSize=9, fillColor=NAVY))
        d.add(String(x + w / 2, y + 13, sub, textAnchor="middle", fontName="Helvetica", fontSize=5.8, fillColor=MID))
    arrows = [
        (121, 113, 154, 113),
        (269, 113, 305, 113),
        (212, 91, 212, 68),
        (269, 46, 305, 46),
    ]
    for x1, y1, x2, y2 in arrows:
        d.add(Line(x1, y1, x2, y2, strokeColor=MID, strokeWidth=1.2))
        if x1 != x2:
            d.add(Polygon([x2, y2, x2 - 6, y2 + 3, x2 - 6, y2 - 3], fillColor=MID, strokeColor=MID))
        else:
            d.add(Polygon([x2, y2, x2 - 3, y2 + 6, x2 + 3, y2 + 6], fillColor=MID, strokeColor=MID))
    d.add(String(16, 148, "Flujo operativo propuesto", fontName="Helvetica-Bold", fontSize=11, fillColor=NAVY))
    return d


def cover_page(story):
    story.append(Spacer(1, 2.35 * cm))
    story.append(p("GESTION SAN MIGUEL", "CoverTitle"))
    story.append(p("Proyecto de sistema integral para oficinas, servicios funebres y cobranza", "CoverSubtitle"))
    story.append(Spacer(1, 0.3 * cm))
    data = [[
        p("<b>Alcance inicial</b><br/>Caja, Remitos, Cobranzas, Pre Necesidad, Documentacion, Facturacion y Cobranza Tres Provincias.", "Bodyx"),
        p("<b>Objetivo</b><br/>Centralizar la gestion operativa, documental, administrativa y de cobranza de tres oficinas.", "Bodyx"),
    ]]
    t = Table(data, colWidths=[8.5 * cm, 8.5 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SOFT_BG),
        ("BOX", (0, 0), (-1, -1), 0.5, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.white),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
    ]))
    story.append(t)
    story.append(Spacer(1, 1.0 * cm))
    story.append(flow_diagram())
    story.append(Spacer(1, 0.7 * cm))
    story.append(p("Documento preparado para presentar la ampliacion funcional de la app hacia una plataforma de gestion integral.", "Smallx"))


def build_story():
    story = []
    cover_page(story)
    story.append(PageBreak())

    story.append(p("Resumen Ejecutivo", "H1x"))
    story.append(p(
        "La plataforma se proyecta como un sistema integral para una empresa de servicios funebres con tres oficinas. "
        "El sistema parte del modulo ya trabajado de Cobranza Tres Provincias, pero lo transforma en una solucion mas amplia "
        "para gestionar servicios, caja, documentacion, facturacion, pre necesidad y cobranzas."
    ))
    story.append(p(
        "La idea central es que todos los servicios nazcan desde un remito o contrato, y que desde alli se pueda seguir "
        "su estado documental, financiero y administrativo hasta el cierre de caja y la facturacion."
    ))

    story.append(p("Modulos Propuestos", "H1x"))
    story.append(module_cards([
        ("CAJA", "Ingresos, egresos, medios de pago, turnos, oficinas y cierre operativo.", colors.HexColor("#EAF7F7")),
        ("REMITOS", "Registro de servicios particulares, por convenio o por pre necesidad.", colors.HexColor("#EEF4FF")),
        ("COBRANZAS", "Pagos, saldos, recibos, cuotas y movimientos asociados a servicios.", colors.HexColor("#F3EFFF")),
        ("PRE NECESIDAD", "Contratos anticipados, cuotas, saldos y disponibilidad futura del servicio.", colors.HexColor("#FFF7E1")),
        ("DOCUMENTACION", "Control de documentacion recibida, faltante, pendiente y lista para facturar.", colors.HexColor("#FFF1F1")),
        ("FACTURACION", "Servicios enviados a facturar, numero, fecha y usuario responsable.", colors.HexColor("#F1F5F9")),
        ("COBRANZA TRES PROVINCIAS", "Modulo existente de afiliados, tickets, cobradores y rendicion.", colors.HexColor("#EAF2FF")),
    ]))

    story.append(p("Estructura General", "H1x"))
    story.append(p(
        "Cobranza Tres Provincias pasa a ser un modulo mas dentro de Gestion San Miguel. "
        "La plataforma debera permitir trabajar con distintos roles y usuarios, separando lo que corresponde a oficina, "
        "cobradores, administracion y futuros sectores operativos."
    ))
    story.append(table([
        [p("Area", "TableHeader"), p("Funcion principal", "TableHeader")],
        [p("Oficinas"), p("Cada oficina registra servicios, caja, cobranzas y documentacion propia.")],
        [p("Usuarios y turnos"), p("Los movimientos de caja y gestion quedan asociados al usuario y al turno correspondiente.")],
        [p("Servicios"), p("Todo servicio se registra por remito, ya sea particular, convenio o pre necesidad.")],
        [p("Seguimiento"), p("Documentacion y facturacion permiten ver el estado de cada servicio hasta su cierre.")],
    ], [4.3 * cm, 13.0 * cm]))

    story.append(PageBreak())
    story.append(p("Modulo Remitos", "H1x"))
    story.append(p(
        "El remito sera el origen operativo de cada servicio funebre. En todos los casos se completa un remito, "
        "pero el tipo de remito cambia segun la forma de cobertura o pago."
    ))
    story.append(table([
        [p("Tipo de remito", "TableHeader"), p("Comportamiento esperado", "TableHeader")],
        [p("Particular"), p("Se registra responsable de pago, importe, saldos, cobranzas, documentacion y facturacion.")],
        [p("Convenio"), p("Al tildar Convenio se activa una lista desplegable para elegir el convenio. Al seleccionarlo, aparecen los requisitos documentales que exige ese convenio.")],
        [p("Pre Necesidad"), p("Se vincula a un contrato previo, con pagos y saldos ya registrados. Si el servicio se usa antes de terminar de pagar, se calcula el saldo a cancelar durante el velatorio.")],
    ], [4.4 * cm, 12.9 * cm]))
    story.append(p("En remitos por convenio, al seleccionar el convenio correspondiente se podra tildar la documentacion recibida en el momento. Lo pendiente quedara para seguimiento posterior en Documentacion.", "Bodyx"))

    story.append(p("Modulo Documentacion", "H1x"))
    story.append(p(
        "Documentacion sera el tablero central de control de todos los servicios. No se plantea un modulo operativo separado de Convenios; "
        "en cambio, los remitos se agrupan y filtran desde Documentacion."
    ))
    story.append(table([
        [p("Filtro principal", "TableHeader"), p("Resultado", "TableHeader")],
        [p("Convenios"), p("Muestra todos los servicios por convenio, inicialmente pensados para controlar los pendientes de facturacion.")],
        [p("Particulares"), p("Muestra todos los servicios particulares que requieren documentacion y seguimiento.")],
        [p("Pendientes / Facturados / Todos"), p("Permite separar los servicios pendientes de facturacion, los ya facturados o revisar el total.")],
    ], [5.3 * cm, 12.0 * cm]))
    story.append(p("Al abrir cada servicio se vera la documentacion necesaria, la documentacion recibida, lo que falta, observaciones y estado documental.", "Bodyx"))
    story.append(p("Cuando la documentacion este completa, el servicio podra pasar a Facturacion con estado Enviado a Facturacion.", "Bodyx"))

    story.append(p("Modulo Facturacion", "H1x"))
    story.append(p(
        "Facturacion recibira los servicios que ya estan listos para facturar. El estado cambiara a Facturado cuando se carguen "
        "el numero de factura, la fecha de factura y el usuario que realizo la accion."
    ))
    story.append(table([
        [p("Estado", "TableHeader"), p("Descripcion", "TableHeader")],
        [p("Pendiente"), p("El servicio todavia tiene documentacion o datos por completar.")],
        [p("Enviado a Facturacion"), p("La documentacion esta completa y el servicio fue derivado para facturar.")],
        [p("Facturado"), p("Se cargo numero, fecha de factura y usuario responsable.")],
    ], [5.3 * cm, 12.0 * cm]))

    story.append(PageBreak())
    story.append(p("Modulo Caja", "H1x"))
    story.append(p(
        "Caja debera registrar los movimientos economicos de cada oficina y turno. Se contemplan ingresos y egresos, "
        "con distintos medios de pago: efectivo, tarjeta, transferencia y otros que puedan agregarse."
    ))
    story.append(table([
        [p("Movimiento", "TableHeader"), p("Ejemplos", "TableHeader"), p("Datos a registrar", "TableHeader")],
        [p("Ingresos"), p("Servicios funebres, Pre Necesidad, Cobranza Tres Provincias."), p("Origen, comprobante, monto, medio de pago, oficina, usuario y turno.")],
        [p("Egresos"), p("Gastos, retiros, pagos menores, depositos bancarios u otros movimientos."), p("Concepto, monto, medio de pago, comprobante, usuario, turno y observacion.")],
        [p("Cierre"), p("Control al finalizar el turno."), p("Saldo inicial, movimientos, saldo final, diferencias y firma/validacion de entrega y recepcion.")],
    ], [3.8 * cm, 6.0 * cm, 7.5 * cm]))
    story.append(p("Para cobranzas de servicios, el sistema deberia permitir buscar por DNI del fallecido, nombre o numero de remito. Al encontrar el servicio, traera fecha, monto, pagos realizados y saldo pendiente.", "Bodyx"))
    story.append(p("Los movimientos de Tres Provincias no deberian cargarse dos veces: se vincularan con el modulo de Cobranza Tres Provincias y se reflejaran en Caja o rendicion segun corresponda.", "Bodyx"))

    story.append(p("Comprobantes y Talonarios", "H1x"))
    story.append(p(
        "La empresa trabaja con talonarios de recibos para Servicios, Pre Necesidad y Tres Provincias, ademas de tickets de Tres Provincias. "
        "El sistema debera registrar el tipo de comprobante, numeracion, origen y usuario responsable."
    ))
    story.append(table([
        [p("Comprobante", "TableHeader"), p("Uso", "TableHeader")],
        [p("Recibo de Servicios"), p("Pagos relacionados con servicios funebres particulares o saldos.")],
        [p("Recibo de Pre Necesidad"), p("Cobro de cuotas o cancelacion de saldos de contratos de pre necesidad.")],
        [p("Recibo Tres Provincias"), p("Cobros manuales asociados al modulo de Cobranza Tres Provincias.")],
        [p("Ticket Tres Provincias"), p("Cobro por tickets mensuales ya controlados desde el modulo correspondiente.")],
    ], [5.0 * cm, 12.3 * cm]))

    story.append(PageBreak())
    story.append(p("Modulo Pre Necesidad", "H1x"))
    story.append(p(
        "Pre Necesidad es un sistema propio similar a un seguro, orientado a personas que no pueden acceder a seguros convencionales "
        "por edad, salud u otros motivos. La persona elige un tipo de servicio y lo paga en 12 o 18 cuotas mensuales."
    ))
    story.append(table([
        [p("Elemento", "TableHeader"), p("Detalle", "TableHeader")],
        [p("Titular"), p("Persona que contrata o paga. Puede coincidir o no con el beneficiario.")],
        [p("Beneficiario"), p("Persona para la cual queda disponible el servicio.")],
        [p("Contrato"), p("Debe tener numeracion propia, distinta de los remitos convencionales.")],
        [p("Plan de pago"), p("Monto total, cantidad de cuotas, valor mensual, pagos realizados y saldo.")],
        [p("Estado"), p("En pago, completo, disponible, usado o con saldo a cancelar.")],
    ], [4.5 * cm, 12.8 * cm]))
    story.append(p(
        "Cuando se contrata Pre Necesidad, el sistema ya deja cargado un registro anticipado con datos del titular, beneficiario, servicio elegido, monto y cuotas. "
        "Cuando el servicio se utiliza, ese contrato se vincula al remito operativo y se completan los datos o documentacion faltante."
    ))
    story.append(p(
        "Si el servicio se necesita antes de terminar de pagar, el sistema debera informar el saldo pendiente para que sea cancelado durante el velatorio."
    ))

    story.append(p("Cobranza Tres Provincias", "H1x"))
    story.append(p(
        "El modulo actual de Cobranza Tres Provincias se conserva como parte del sistema. Mantiene la gestion de afiliados, tickets, cobradores, recibos, novedades, pedidos, totales y rendicion."
    ))
    story.append(p(
        "Este modulo debera integrarse con Caja para que sus cobros se reflejen como movimientos correspondientes a Tres Provincias, evitando doble carga."
    ))

    story.append(PageBreak())
    story.append(p("Flujo General Propuesto", "H1x"))
    story.append(flow_diagram())
    story.append(Spacer(1, 0.4 * cm))
    story.append(table([
        [p("Paso", "TableHeader"), p("Descripcion", "TableHeader")],
        [p("1. Carga inicial"), p("Se registra el remito o contrato de Pre Necesidad, indicando si el servicio es particular, convenio o pre necesidad.")],
        [p("2. Documentacion"), p("Se tilda lo recibido y queda visible lo pendiente. La vista permite filtrar Convenios o Particulares y Pendientes, Facturados o Todos.")],
        [p("3. Cobranzas"), p("Se registran pagos, saldos y medios de pago vinculados al servicio o contrato.")],
        [p("4. Caja"), p("Los movimientos impactan en la caja de la oficina y turno correspondiente.")],
        [p("5. Facturacion"), p("Cuando la documentacion esta completa, se envia a facturacion y luego se registra numero, fecha y usuario.")],
    ], [3.2 * cm, 14.1 * cm]))

    story.append(p("Beneficios Esperados", "H1x"))
    for item in [
        "Centralizar la informacion de tres oficinas en una sola plataforma.",
        "Evitar duplicacion de cargas entre remitos, cobranzas, documentacion, caja y facturacion.",
        "Controlar saldos, pagos y medios de pago por servicio.",
        "Saber rapidamente que servicios estan pendientes de documentacion o facturacion.",
        "Dar seguimiento a contratos de Pre Necesidad desde la venta hasta el uso del servicio.",
        "Mantener Cobranza Tres Provincias integrada al sistema general.",
        "Mejorar el control de caja por usuario, turno y oficina.",
    ]:
        story.append(bullet(item))

    story.append(p("Etapas Sugeridas", "H1x"))
    story.append(table([
        [p("Etapa", "TableHeader"), p("Objetivo", "TableHeader"), p("Resultado esperado", "TableHeader")],
        [p("1. Base estructural"), p("Crear navegacion general y modulos principales."), p("Sistema preparado para Gestion San Miguel, con Cobranza Tres Provincias como modulo.")],
        [p("2. Remitos y Documentacion"), p("Cargar servicios y controlar documentacion."), p("Servicios particulares y convenios con seguimiento documental.")],
        [p("3. Caja y Cobranzas"), p("Registrar pagos, egresos y cierre de turnos."), p("Control financiero por oficina, usuario y medio de pago.")],
        [p("4. Pre Necesidad"), p("Gestionar contratos, cuotas y saldos."), p("Planes disponibles, en pago o usados, vinculados a remitos.")],
        [p("5. Facturacion"), p("Cerrar el circuito administrativo."), p("Servicios facturados con numero, fecha y usuario responsable.")],
    ], [3.2 * cm, 6.7 * cm, 7.4 * cm]))

    story.append(Spacer(1, 0.5 * cm))
    story.append(p("<b>En una frase:</b> una plataforma integral para gestionar servicios funebres, caja, cobranzas, documentacion, facturacion, pre necesidad y Cobranza Tres Provincias, con seguimiento por oficina, usuario y estado operativo.", "Bodyx"))
    return story


def build():
    frame = Frame(MARGIN_X, MARGIN_BOTTOM, PAGE_W - 2 * MARGIN_X, PAGE_H - MARGIN_TOP - MARGIN_BOTTOM, id="normal")
    doc = BaseDocTemplate(
        str(PDF_PATH),
        pagesize=A4,
        leftMargin=MARGIN_X,
        rightMargin=MARGIN_X,
        topMargin=MARGIN_TOP,
        bottomMargin=MARGIN_BOTTOM,
        title="Proyecto Gestion San Miguel",
        author="Gestion San Miguel",
    )
    doc.addPageTemplates([
        PageTemplate(id="cover", frames=[frame]),
        PageTemplate(id="body", frames=[Frame(MARGIN_X, MARGIN_BOTTOM, PAGE_W - 2 * MARGIN_X, PAGE_H - 2.1 * cm - MARGIN_BOTTOM, id="body")], onPage=later_pages),
    ])
    story = build_story()
    story.insert(1, None)
    doc.build([item for item in story if item is not None], canvasmaker=NumberedCanvas)
    print(PDF_PATH)


if __name__ == "__main__":
    build()
