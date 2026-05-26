"""
One-shot script to regenerate public/sample-courrier.pdf.
Not used at runtime — kept for traceability.

Run from app/:  python public/generate-sample-pdf.py
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, black
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
)
from pathlib import Path

GREEN = HexColor("#006b3a")
GOLD = HexColor("#c1973f")
INK = HexColor("#0a0a0a")
INK_3 = HexColor("#5a5a5a")
GOLD_BG = HexColor("#fbf8f1")

OUT = Path(__file__).parent / "sample-courrier.pdf"


def build():
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=22 * mm,
        rightMargin=22 * mm,
        topMargin=22 * mm,
        bottomMargin=22 * mm,
        title="Demande d'agrement - Cameroun Solar Power SA (echantillon)",
        author="Cameroun Solar Power SA",
        subject="Test document for cmipaportal.com",
    )

    styles = getSampleStyleSheet()

    # ---- Custom styles ----
    kicker = ParagraphStyle(
        "kicker",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=INK_3,
        spaceAfter=4,
    )
    from_block = ParagraphStyle(
        "fromBlock",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=INK,
        spaceAfter=2,
    )
    from_company = ParagraphStyle(
        "fromCompany",
        parent=from_block,
        fontName="Helvetica-Bold",
        fontSize=11,
        textColor=GREEN,
        spaceAfter=4,
    )
    to_block = ParagraphStyle(
        "to",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=13,
        textColor=INK,
        alignment=TA_RIGHT,
        spaceBefore=18,
        spaceAfter=16,
    )
    ref_line = ParagraphStyle(
        "ref",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=INK_3,
    )
    object_style = ParagraphStyle(
        "object",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10.5,
        leading=14,
        textColor=INK,
        backColor=GOLD_BG,
        borderColor=GOLD,
        borderWidth=0,
        borderPadding=(8, 8, 8, 8),
        leftIndent=4,
        spaceBefore=14,
        spaceAfter=18,
    )
    body = ParagraphStyle(
        "body",
        parent=styles["Normal"],
        fontName="Times-Roman",
        fontSize=11,
        leading=15,
        textColor=INK,
        alignment=TA_JUSTIFY,
        spaceAfter=10,
    )
    h2 = ParagraphStyle(
        "h2",
        parent=styles["Normal"],
        fontName="Times-Bold",
        fontSize=12.5,
        leading=15,
        textColor=GREEN,
        spaceBefore=14,
        spaceAfter=6,
    )
    signature_name = ParagraphStyle(
        "sigName",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=13,
        textColor=INK,
        alignment=TA_RIGHT,
    )
    signature_title = ParagraphStyle(
        "sigTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=9.5,
        leading=12,
        textColor=INK_3,
        alignment=TA_RIGHT,
    )

    flow = []

    flow.append(Paragraph("SOCIÉTÉ PAR ACTIONS SIMPLIFIÉE · BP 1234 DOUALA", kicker))
    flow.append(Paragraph("Cameroun Solar Power SA", from_company))
    flow.append(Paragraph(
        "Quartier Bonanjo, immeuble Atlantique, 4ème étage<br/>"
        "Douala — Cameroun<br/>"
        "Tél. : +237 6 55 44 33 22 · contact@solarcm.cm<br/>"
        "RCCM : RC/DLA/2023/B/4521 · NIU : M052300012345A",
        from_block,
    ))

    flow.append(Paragraph(
        "À Monsieur le Directeur Général<br/>"
        "<b>Agence de Promotion des Investissements</b><br/>"
        "Yaoundé — Cameroun",
        to_block,
    ))

    flow.append(Paragraph("N/Réf. : SP-2026-INV-007", ref_line))
    flow.append(Paragraph("V/Réf. : —", ref_line))
    flow.append(Paragraph("Date : Douala, le 26 mai 2026", ref_line))

    flow.append(Paragraph(
        "Objet : Demande d'agrément au régime des grands investissements pour "
        "le projet de centrale solaire photovoltaïque de 50 MW à Édéa, département "
        "de la Sanaga-Maritime.",
        object_style,
    ))

    flow.append(Paragraph("Monsieur le Directeur Général,", body))

    flow.append(Paragraph(
        "J'ai l'honneur, en ma qualité de Directrice Générale de la société "
        "<b>Cameroun Solar Power SA</b>, de solliciter respectueusement auprès "
        "de votre haute autorité l'octroi de l'agrément au régime des grands "
        "investissements prévu par l'Ordonnance n° 2025/002 du 18 juillet 2025 "
        "fixant les incitations à l'investissement privé en République du Cameroun.",
        body,
    ))

    flow.append(Paragraph("1. Présentation du projet", h2))
    flow.append(Paragraph(
        "Le projet consiste en la construction et l'exploitation d'une centrale "
        "solaire photovoltaïque d'une puissance installée de <b>50 MW</b> sur un "
        "site de 65 hectares situé dans la commune d'Édéa, département de la "
        "Sanaga-Maritime, région du Littoral. L'énergie produite sera injectée "
        "sur le réseau interconnecté Sud (RIS) géré par ENEO-Cameroun via une "
        "sous-station 90/30 kV à construire en partenariat avec la SONATREL.",
        body,
    ))

    flow.append(Paragraph("2. Investissement total et plan de financement", h2))
    flow.append(Paragraph(
        "Le coût total du projet est estimé à <b>32,5 milliards de francs CFA</b>, "
        "financé à hauteur de 35 % en fonds propres (apports de la société-mère "
        "SolarPower International et de partenaires institutionnels camerounais) "
        "et 65 % en dette long terme garantie par la Banque Africaine de "
        "Développement et la Société Financière Internationale.",
        body,
    ))

    flow.append(Paragraph("3. Impact économique et social", h2))
    flow.append(Paragraph(
        "Le projet créera <b>180 emplois directs</b> en phase de construction "
        "(24 mois) et <b>42 emplois directs permanents</b> en phase "
        "d'exploitation, dont 90 % de nationaux camerounais. Un programme de "
        "formation aux métiers du solaire sera déployé en partenariat avec "
        "l'Institut Universitaire de la Côte (Douala). La production annuelle "
        "attendue (≈ 95 GWh) permettra d'éviter l'émission de 67 000 tonnes "
        "de CO₂ par an.",
        body,
    ))

    flow.append(Paragraph("4. Pièces jointes au présent dossier", h2))
    flow.append(Paragraph(
        "Conformément à l'article 14 de l'Ordonnance précitée et au décret "
        "d'application n° 2025-048, sont annexés à la présente :",
        body,
    ))
    flow.append(Paragraph(
        "• Statuts de la société et K-bis (RCCM mis à jour le 04/05/2026)<br/>"
        "• Étude de faisabilité technique et financière (cabinet PwC Cameroun)<br/>"
        "• Étude d'impact environnemental et social (cabinet Tractebel)<br/>"
        "• Lettre d'intérêt signée par ENEO-Cameroun (PPA en négociation)<br/>"
        "• Bilans certifiés des 3 derniers exercices de la société-mère<br/>"
        "• Pièce d'identité du Directeur Général signataire",
        ParagraphStyle("list", parent=body, leftIndent=16, spaceAfter=8),
    ))

    flow.append(Paragraph(
        "Nous restons à votre disposition pour tout entretien ou complément "
        "d'information que vous jugerez utile, et vous prions d'agréer, "
        "Monsieur le Directeur Général, l'expression de notre haute considération.",
        body,
    ))

    flow.append(Spacer(1, 36))
    flow.append(Paragraph("Aïcha BOUBA", signature_name))
    flow.append(Paragraph("Directrice Générale", signature_title))
    flow.append(Paragraph("Cameroun Solar Power SA", signature_title))

    flow.append(Spacer(1, 32))
    flow.append(Paragraph(
        "<i>Cet exemplaire est un échantillon de test destiné à la plateforme "
        "cmipaportal.com — il ne constitue pas un courrier réel.</i>",
        ParagraphStyle("footer", parent=body, fontSize=8.5, textColor=INK_3, alignment=TA_LEFT),
    ))

    doc.build(flow)
    print(f"✓ Wrote {OUT}  ({OUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    build()
